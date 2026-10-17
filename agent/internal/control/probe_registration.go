package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeinstance"
)

type registeredProbe struct {
	gate              *probe.Gate
	node, boot        string
	epoch, generation uint64
	fingerprint       [32]byte
	guard             *authorization.Guard
	until             time.Time
	ctx               context.Context
	cancel            context.CancelFunc
	done              chan struct{}
	claims            map[string]struct{}           // Runner mutex; never evict under the same instance identity.
	receipts          map[string]*probeClaimReceipt // Runner mutex; accepted receipts and one-start monitoring tombstones.
}

// Caller holds runner.mutex. Gate closure never calls back into Runner.
func (runner *Runner) closeProbeLocked() *registeredProbe {
	previous := runner.probeRegistration
	runner.probeRegistration = nil
	if previous != nil {
		previous.gate.Close()
		previous.cancel()
	}
	return previous
}

func (runner *Runner) probeInstanceExchange(ctx context.Context, request probeinstance.Request) (*probeinstance.Response, error) {
	work, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	message, err := http.NewRequestWithContext(work, "POST", strings.TrimRight(runner.options.URL, "/")+"/agent/v3/probe/instance", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	message.Header.Set("Content-Type", "application/json")
	message.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(request.SessionEpoch, 10))
	response, err := runner.client.Do(message)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err = io.ReadAll(io.LimitReader(response.Body, 4097))
	if err != nil {
		return nil, err
	}
	if len(raw) > 4096 {
		return nil, probe.ErrInvalid
	}
	if response.StatusCode != http.StatusOK {
		var problem struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(raw, &problem)
		return nil, httpError{response.StatusCode, problem.Code}
	}
	ack, err := probeinstance.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeinstance.CheckResponse(request, *ack); err != nil {
		return nil, err
	}
	if work.Err() != nil {
		return nil, work.Err()
	}
	return ack, nil
}

func (runner *Runner) probeCurrentLocked(session *registeredProbe) bool {
	return !runner.probeStopped && session.ctx.Err() == nil && time.Now().Before(session.until) &&
		runner.options.NodeID == session.node && runner.options.BootID == session.boot &&
		runner.hello.SessionEpoch == session.epoch && runner.credentialFingerprint == session.fingerprint &&
		runner.guard == session.guard && session.guard != nil && session.guard.Check() == nil
}

// registerProbe serializes rotation and closes its predecessor before any remote work.
func (runner *Runner) registerProbe(ctx context.Context) (*registeredProbe, error) {
	runner.probeChange.Lock()
	defer runner.probeChange.Unlock()
	runner.mutex.Lock()
	previous := runner.closeProbeLocked()
	node, boot, epoch, fingerprint, guard := runner.options.NodeID, runner.options.BootID,
		runner.hello.SessionEpoch, runner.credentialFingerprint, runner.guard
	stopped := runner.probeStopped
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()
	if previous != nil {
		<-previous.done
	}
	if stopped || ctx.Err() != nil || guard == nil || guard.Check() != nil {
		return nil, probe.ErrDenied
	}
	negotiated, err := runner.negotiateProbe(ctx)
	if err != nil {
		return nil, err
	}
	accepted := false
	defer func() {
		if !accepted {
			negotiated.gate.Close()
		}
	}()
	request, err := probeinstance.NewRequest(node, boot, epoch, negotiated.gate.InstanceID(), "inspect", 0)
	if err != nil {
		return nil, err
	}
	inspection, err := runner.probeInstanceExchange(ctx, *request)
	if err != nil {
		return nil, err
	}
	serverTime, err := time.Parse(time.RFC3339Nano, inspection.ServerTime)
	if err != nil || guard.ValidateServerTime(serverTime) != nil {
		return nil, probe.ErrDenied
	}
	request.Action, request.ExpectedGeneration = "register", inspection.Generation
	started := time.Now()
	ack, err := runner.probeInstanceExchange(ctx, *request)
	if err != nil {
		return nil, err
	}
	serverTime, err = time.Parse(time.RFC3339Nano, ack.ServerTime)
	if err != nil || guard.ValidateServerTime(serverTime) != nil {
		return nil, probe.ErrDenied
	}
	expires, err := time.Parse(time.RFC3339Nano, *ack.ExpiresAt)
	if err != nil {
		return nil, err
	}
	// Use a monotonic local deadline anchored before the request; subtract clock uncertainty.
	remaining := expires.Sub(serverTime) - skew
	if remaining <= 2*time.Second || remaining > 30*time.Second {
		return nil, probe.ErrDenied
	}
	work, cancel := context.WithCancel(ctx)
	session := &registeredProbe{gate: negotiated.gate, node: node, boot: boot, epoch: epoch, generation: ack.Generation,
		fingerprint: fingerprint, guard: guard, until: started.Add(remaining), ctx: work, cancel: cancel, done: make(chan struct{})}
	runner.mutex.Lock()
	if !runner.probeCurrentLocked(session) {
		runner.mutex.Unlock()
		cancel()
		return nil, probe.ErrDenied
	}
	runner.probeRegistration = session
	go runner.monitorProbe(session)
	runner.mutex.Unlock()
	accepted = true
	return session, nil
}

func (runner *Runner) monitorProbe(session *registeredProbe) {
	defer close(session.done)
	defer session.gate.Close()
	defer session.cancel()
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(time.Until(session.until))
	defer deadline.Stop()
	for {
		select {
		case <-session.ctx.Done():
			return
		case <-deadline.C:
			return
		case <-ticker.C:
			runner.mutex.Lock()
			current := runner.probeRegistration == session && runner.probeCurrentLocked(session)
			runner.mutex.Unlock()
			if !current {
				return
			}
		}
	}
}

func (runner *Runner) revokeProbe(ctx context.Context) error {
	runner.probeChange.Lock()
	defer runner.probeChange.Unlock()
	runner.mutex.Lock()
	session := runner.closeProbeLocked()
	runner.mutex.Unlock()
	if session == nil {
		return nil
	}
	<-session.done
	request, err := probeinstance.NewRequest(session.node, session.boot, session.epoch, session.gate.InstanceID(), "revoke", session.generation)
	if err != nil {
		return err
	}
	_, err = runner.probeInstanceExchange(ctx, *request)
	return err
}

func (runner *Runner) maintainProbe(ctx context.Context) {
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = runner.revokeProbe(cleanup)
	}()
	delay := 5 * time.Second
	for ctx.Err() == nil {
		session, err := runner.registerProbe(ctx)
		wait := delay
		if err == nil {
			wait = max(time.Until(session.until)-2*time.Second, time.Second)
			delay = 5 * time.Second
		} else {
			var problem httpError
			if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED") {
				return
			}
			fmt.Fprintln(os.Stderr, "Probe instance registration pending")
			delay = min(delay*2, 30*time.Second)
		}
		timer := time.NewTimer(wait)
		var ended <-chan struct{}
		if session != nil {
			ended = session.done
		}
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		case <-ended:
			timer.Stop()
		}
	}
}

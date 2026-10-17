package control

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probedelivery"
)

const (
	probeObservationAge = 250 * time.Millisecond
	probeExchangeLimit  = 200 * time.Millisecond
	probeStatusInterval = 50 * time.Millisecond
)

type probeDeliveryOffer struct {
	permitID string
	binding  probe.Binding
	until    time.Time
	timeout  time.Duration
}

type probeDeliverySlot struct {
	active   bool
	nextPoll time.Time
}
type probeDeliveryBudget struct {
	mutex  sync.Mutex
	nodes  map[string]probeDeliverySlot
	active int
}

// Shared across Runner construction and instance rotation; unrelated to socket execution admission.
var probeDeliveries = probeDeliveryBudget{nodes: make(map[string]probeDeliverySlot)}

func (budget *probeDeliveryBudget) acquire(node string, poll bool, now time.Time) (func(), error) {
	budget.mutex.Lock()
	defer budget.mutex.Unlock()
	for key, slot := range budget.nodes {
		if !slot.active && !now.Before(slot.nextPoll) {
			delete(budget.nodes, key)
		}
	}
	slot, exists := budget.nodes[node]
	if slot.active || budget.active >= 4 || !exists && len(budget.nodes) >= 128 || poll && now.Before(slot.nextPoll) {
		return nil, probe.ErrBusy
	}
	slot.active = true
	if poll {
		slot.nextPoll = now.Add(time.Second)
	}
	budget.nodes[node] = slot
	budget.active++
	var once sync.Once
	return func() {
		once.Do(func() {
			budget.mutex.Lock()
			defer budget.mutex.Unlock()
			current := budget.nodes[node]
			current.active = false
			budget.nodes[node] = current
			budget.active--
		})
	}, nil
}

func probeRequestID() (string, error) {
	var bytes [32]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes[:]), nil
}
func deliveryBinding(b probedelivery.Binding) probe.Binding {
	return probe.Binding{NodeID: b.NodeId, BootID: b.BootId, SessionEpoch: b.SessionEpoch,
		SnapshotGeneration: b.SnapshotGeneration, AssignmentID: b.AssignmentId, ForwardID: b.ForwardId,
		ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
		BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision}
}

func (runner *Runner) probeDeliveryExchange(ctx context.Context, session *registeredProbe, path string, input any) ([]byte, time.Time, error) {
	started := time.Now()
	work, cancel := context.WithDeadline(ctx, minProbeDeadline(session.until, started.Add(probeExchangeLimit)))
	defer cancel()
	stop := context.AfterFunc(session.ctx, cancel)
	defer stop()
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, started, err
	}
	runner.mutex.Lock()
	baseURL, clientPointer := runner.options.URL, runner.client
	runner.mutex.Unlock()
	message, err := http.NewRequestWithContext(work, "POST", strings.TrimRight(baseURL, "/")+path, bytes.NewReader(raw))
	if err != nil {
		return nil, started, err
	}
	if message.URL.Scheme != "https" || message.URL.Host == "" || message.URL.User != nil ||
		message.URL.RawQuery != "" || message.URL.Fragment != "" || clientPointer == nil {
		return nil, started, probe.ErrDenied
	}
	message.Header.Set("Content-Type", "application/json")
	message.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(session.epoch, 10))
	client := *clientPointer
	client.CheckRedirect = func(*http.Request, []*http.Request) error {
		return fmt.Errorf("Probe delivery redirects are forbidden")
	}
	response, err := client.Do(message)
	if err != nil {
		return nil, started, err
	}
	defer response.Body.Close()
	raw, err = io.ReadAll(io.LimitReader(response.Body, 4097))
	if err != nil {
		return nil, started, err
	}
	if len(raw) > 4096 {
		return nil, started, probe.ErrInvalid
	}
	if work.Err() != nil {
		return nil, started, work.Err()
	}
	if response.StatusCode != http.StatusOK {
		var problem struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(raw, &problem)
		return nil, started, httpError{response.StatusCode, problem.Code}
	}
	return raw, started, nil
}

func probeFreshUntil(session *registeredProbe, started time.Time, observedAt, serverTime string) (time.Time, error) {
	observed, e1 := time.Parse(time.RFC3339Nano, observedAt)
	server, e2 := time.Parse(time.RFC3339Nano, serverTime)
	if e1 != nil || e2 != nil || server.Before(observed) || server.Sub(observed) > probeObservationAge ||
		session.guard.ValidateServerTime(server) != nil {
		return time.Time{}, probe.ErrDenied
	}
	// Subtract remote observation age AND all local elapsed time; receipt time never starts a new window.
	until := started.Add(probeObservationAge - server.Sub(observed))
	if !time.Now().Before(until) {
		return time.Time{}, probe.ErrDenied
	}
	return until, nil
}

// Internal single exchange, not a background poll loop or executable grant.
func (runner *Runner) pollProbe(ctx context.Context) (*probeDeliveryOffer, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || !runner.probeCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()
	release, err := probeDeliveries.acquire(session.node, true, time.Now())
	if err != nil {
		return nil, err
	}
	defer release()
	id, err := probeRequestID()
	if err != nil {
		return nil, err
	}
	request := probedelivery.PollRequest{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-poll", NodeId: session.node,
		BootId: session.boot, SessionEpoch: session.epoch, InstanceId: session.gate.InstanceID(), InstanceGeneration: session.generation, RequestId: id}
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probedelivery.ParsePollRequest(raw); err != nil {
		return nil, err
	}
	raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/poll", request)
	if err != nil {
		return nil, err
	}
	ack, err := probedelivery.ParsePollResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probedelivery.CheckPollResponse(request, *ack); err != nil {
		return nil, err
	}
	freshUntil, err := probeFreshUntil(session, started, ack.ObservedAt, ack.ServerTime)
	if err != nil {
		return nil, err
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || runner.probeRegistration != session || !runner.probeCurrentLocked(session) || !time.Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	if ack.Offer == nil {
		return nil, nil
	}
	if _, used := session.claims[ack.Offer.PermitId]; used {
		return nil, probe.ErrReplay
	}
	binding := deliveryBinding(ack.Offer.Binding)
	target, err := runner.probeTargetLocked(binding)
	if err != nil {
		return nil, err
	}
	expires, _ := time.Parse(time.RFC3339Nano, ack.Offer.ExpiresAt)
	server, _ := time.Parse(time.RFC3339Nano, ack.ServerTime)
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		return nil, probe.ErrDenied
	}
	until := minProbeDeadline(started.Add(remaining), minProbeDeadline(session.until, target.ExecutionUntil))
	if !time.Now().Before(until) || !time.Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	return &probeDeliveryOffer{permitID: ack.Offer.PermitId, binding: binding, until: until,
		timeout: time.Duration(ack.Offer.TimeoutMs) * time.Millisecond}, nil
}

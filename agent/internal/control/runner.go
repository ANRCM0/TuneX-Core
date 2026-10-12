package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/state"
)

type Options struct {
	URL, NodeID, BootID, Certificate, PrivateKey, CA, Journal, JournalKey string
	Rotate                                                                bool
}
type httpError struct {
	status int
	code   string
}

func (problem httpError) Error() string {
	return fmt.Sprintf("Control HTTP %d: %s", problem.status, problem.code)
}

type running struct {
	assignment contracts.Assignment
	stream     execution
	ticket     *authorization.Ticket
}
type execution interface {
	Close()
	Drain()
	Remaining() uint64
	SetAuthorization(func() error)
}

func startExecution(a contracts.Assignment, p contracts.Policy, check func() error) (execution, error) {
	switch a.Protocol {
	case "tcp":
		return forward.StartAuthorized(a, p, check)
	case "udp":
		return forward.StartUDPAuthorized(a, p, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}
func replaceExecution(old execution, a contracts.Assignment, check func() error) (execution, error) {
	switch stream := old.(type) {
	case *forward.TCP:
		return stream.ReplaceAuthorized(a, check)
	case *forward.UDP:
		return stream.ReplaceAuthorized(a, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

type draining struct {
	instance running
	started  time.Time
	deadline time.Time
}
type Runner struct {
	options               Options
	client                *http.Client
	key                   []byte
	journal               state.Journal
	hello                 contracts.HelloResponse
	sequence              uint64
	pending               []byte
	instances             map[string]running
	drains                map[string]draining
	observations          []contracts.Observation
	mutex                 sync.Mutex
	deadline              time.Time
	guard                 *authorization.Guard
	ticket                *authorization.Ticket
	clock                 authorization.Clock
	certificate           tls.Certificate
	credentialUntil       time.Time
	credentialFingerprint [32]byte
	roots                 *x509.CertPool
}

func New(options Options) (*Runner, error) {
	if !strings.HasPrefix(options.URL, "https://") {
		return nil, fmt.Errorf("HTTPS Control URL required")
	}
	ca, err := os.ReadFile(options.CA)
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		return nil, fmt.Errorf("Invalid Control CA")
	}
	key, err := os.ReadFile(options.JournalKey)
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("INTEGRITY_FAILURE: journal protection key unavailable")
	}
	journal, err := state.Load(options.Journal, key)
	if err != nil {
		return nil, err
	}
	runner := &Runner{options: options, key: key, journal: journal, instances: make(map[string]running), roots: roots}
	if err := runner.reloadCredential(); err != nil {
		return nil, err
	}
	transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, GetClientCertificate: func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
		runner.mutex.Lock()
		defer runner.mutex.Unlock()
		certificate := runner.certificate
		return &certificate, nil
	}, MinVersion: tls.VersionTLS13}}
	runner.client = &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("Control redirects are forbidden") }}
	return runner, nil
}
func (runner *Runner) request(ctx context.Context, method, path string, body []byte, epoch bool) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(runner.options.URL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if epoch {
		request.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(runner.hello.SessionEpoch, 10))
	}
	response, err := runner.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 4194305))
	if err != nil {
		return nil, err
	}
	if response.StatusCode != 200 {
		var problem struct {
			Code string `json:"code"`
		}
		json.Unmarshal(raw, &problem)
		return nil, httpError{response.StatusCode, problem.Code}
	}
	return raw, nil
}
func (runner *Runner) stop() {
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	for key, instance := range runner.instances {
		instance.stream.Close()
		delete(runner.instances, key)
	}
	for key, drain := range runner.drains {
		drain.instance.stream.Close()
		delete(runner.drains, key)
	}
}
func (runner *Runner) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer runner.stop()
	defer runner.client.CloseIdleConnections()
	hello := contracts.HelloRequest{ProtocolVersion: 2, NodeId: runner.options.NodeID, BootId: runner.options.BootID, AgentBuild: "vnext-phase2", Capabilities: []string{"native.direct.v1", "tcp", "udp"}, LastStoredSnapshotGeneration: runner.journal.Generation}
	body, _ := json.Marshal(hello)
	var raw []byte
	var err error
	for delay := time.Second; ; delay = min(delay*2, 30*time.Second) {
		raw, err = runner.request(ctx, "POST", "/agent/v2/hello", body, false)
		if err == nil {
			break
		}
		var problem httpError
		if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED" || problem.code == "INTEGRITY_FAILURE") {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}
	message, err := contracts.ParseMessage("HelloResponse", raw)
	if err != nil {
		return err
	}
	runner.hello = message.(contracts.HelloResponse)
	if runner.hello.NodeId != runner.options.NodeID || runner.hello.BootId != runner.options.BootID {
		return fmt.Errorf("AUTHORIZATION_DENIED: Hello identity mismatch")
	}
	if err := runner.initializeGuard(); err != nil {
		return err
	}
	serverTime, err := time.Parse(time.RFC3339Nano, runner.hello.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.guard.ValidateServerTime(serverTime); err != nil {
		return err
	}
	// Credential validity and wall/monotonic drift are checked independently of network retry/poll intervals.
	guardDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		defer close(guardDone)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				runner.mutex.Lock()
				problem := runner.guard.Check()
				if problem == nil && runner.ticket != nil {
					problem = runner.ticket.Allow()
				}
				expired := problem != nil
				if expired {
					fmt.Fprintln(os.Stderr, "Agent authorization ended:", problem)
					cancel()
					for key, instance := range runner.instances {
						instance.stream.Close()
						delete(runner.instances, key)
					}
					for key, drain := range runner.drains {
						drain.instance.stream.Close()
						delete(runner.drains, key)
					}
				}
				for key, drain := range runner.drains {
					if drain.instance.ticket.Allow() != nil {
						drain.instance.stream.Close()
						runner.drains[key] = drain
					}
				}
				runner.mutex.Unlock()
			}
		}
	}()
	defer func() { cancel(); <-guardDone }()
	// The guard exits when the derived run context is cancelled, including fatal parser/state errors.
	retired := false
	rotateRequested := runner.options.Rotate
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if retired {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Second):
				continue
			}
		}
		if rotateRequested {
			if err := runner.rotate(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "Credential rotation retry pending:", err)
			} else {
				rotateRequested = false
			}
		}
		if err := runner.reloadCredential(); err != nil {
			return err
		}
		if err := runner.poll(ctx); err != nil {
			fmt.Fprintln(os.Stderr, "Agent reconcile failed:", err)
			var problem httpError
			if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED") {
				retired = true
			}
		} else if len(runner.pending) > 0 {
			if err := runner.report(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "Agent report retry pending:", err)
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(runner.hello.Policy.PollIntervalSeconds) * time.Second):
		}
	}
}
func (runner *Runner) poll(ctx context.Context) error {
	if runner.guard == nil {
		if err := runner.initializeGuard(); err != nil {
			return err
		}
	}
	if runner.ticket != nil {
		if err := runner.ticket.Allow(); err != nil {
			return err
		}
	}
	if len(runner.pending) > 0 {
		if err := runner.report(ctx); err != nil {
			return err
		}
	}
	raw, err := runner.request(ctx, "GET", "/agent/v2/snapshot?sinceGeneration="+strconv.FormatUint(runner.journal.Generation, 10), nil, true)
	if err != nil {
		return err
	}
	value, err := contracts.ParseMessage("Snapshot", raw)
	if err != nil {
		return err
	}
	snapshot := value.(contracts.Snapshot)
	if snapshot.NodeId != runner.options.NodeID || snapshot.SessionEpoch != runner.hello.SessionEpoch {
		return fmt.Errorf("SESSION_SUPERSEDED")
	}
	if snapshot.SnapshotGeneration < runner.journal.Generation || (snapshot.SnapshotGeneration == runner.journal.Generation && snapshot.SnapshotDigest != runner.journal.Digest) {
		return fmt.Errorf("INTEGRITY_FAILURE: Snapshot history changed")
	}
	now := time.Now()
	valid, err := time.Parse(time.RFC3339Nano, snapshot.ValidUntil)
	if err != nil {
		return err
	}
	issued, err := time.Parse(time.RFC3339Nano, snapshot.IssuedAt)
	if err != nil {
		return err
	}
	changed := snapshot.SnapshotGeneration > runner.journal.Generation
	ticket := runner.ticket
	if changed {
		ticket, err = runner.guard.Accept(issued, valid)
		if err != nil {
			return err
		}
	} else if ticket == nil {
		return fmt.Errorf("INTEGRITY_FAILURE: restart requires a new snapshot generation")
	}
	next := runner.journal
	next.Fences = make(map[string]uint64)
	next.Retired = make(map[string]uint64)
	for key, value := range runner.journal.Fences {
		next.Fences[key] = value
	}
	for key, value := range runner.journal.Retired {
		next.Retired[key] = value
	}
	incoming := make(map[string]bool)
	var prior contracts.Snapshot
	if len(runner.journal.Snapshot) > 0 {
		if err := json.Unmarshal(runner.journal.Snapshot, &prior); err != nil {
			return fmt.Errorf("INTEGRITY_FAILURE: persisted snapshot corrupted")
		}
	}
	for _, assignment := range snapshot.Assignments {
		if (assignment.Protocol != "tcp" && assignment.Protocol != "udp") || assignment.Phase != "active" || assignment.Driver.Id != "native.direct.v1" {
			return fmt.Errorf("UNSUPPORTED_CAPABILITY")
		}
		key := fmt.Sprintf("%s/%d", assignment.Protocol, assignment.Listener.Port)
		for _, old := range prior.Assignments {
			if old.AssignmentId == assignment.AssignmentId && old.DeploymentGeneration == assignment.DeploymentGeneration && old.BindingFence == assignment.BindingFence && (old.Driver.ConfigDigest != assignment.Driver.ConfigDigest || old.Listener != assignment.Listener || old.Protocol != assignment.Protocol) {
				return fmt.Errorf("INTEGRITY_FAILURE: execution configuration changed without a new generation/fence")
			}
		}
		incoming[key] = true
		if assignment.BindingFence < next.Fences[key] || assignment.BindingFence <= next.Retired[key] {
			return fmt.Errorf("FENCING_REJECTED")
		}
		next.Fences[key] = assignment.BindingFence
	}
	for key, fence := range next.Fences {
		if !incoming[key] {
			next.Retired[key] = max(next.Retired[key], fence)
		}
	}
	for _, tombstone := range snapshot.Tombstones {
		key := fmt.Sprintf("%s/%d", tombstone.Protocol, tombstone.Port)
		next.Retired[key] = max(next.Retired[key], tombstone.BindingFence)
	}
	next.Generation = snapshot.SnapshotGeneration
	next.Digest = snapshot.SnapshotDigest
	next.Snapshot = append([]byte(nil), raw...)
	if changed {
		if err := state.Save(runner.options.Journal, runner.key, next); err != nil {
			return fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
		}
	}
	runner.journal = next
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || ticket.Allow() != nil {
		return fmt.Errorf("LEASE_EXPIRED: Authorization ended before execution")
	}
	oldDeadline := runner.deadline
	if changed {
		runner.ticket = ticket
		runner.deadline = ticket.Deadline()
	}
	if ticket.Allow() != nil {
		return fmt.Errorf("LEASE_EXPIRED: Accepted authorization already ended")
	}
	runner.observations = nil
	for _, assignment := range snapshot.Assignments {
		if ctx.Err() != nil || ticket.Allow() != nil {
			return fmt.Errorf("LEASE_EXPIRED: Authorization ended before bind")
		}
		key := fmt.Sprintf("%s/%d", assignment.Protocol, assignment.Listener.Port)
		obs := contracts.Observation{AssignmentId: assignment.AssignmentId, DeploymentGeneration: assignment.DeploymentGeneration, BindingFence: assignment.BindingFence, Phase: "active", Condition: "ready", Retryable: false}
		if existing, ok := runner.instances[key]; ok && (existing.assignment.Driver.ConfigDigest != assignment.Driver.ConfigDigest || existing.assignment.DeploymentGeneration != assignment.DeploymentGeneration || existing.assignment.BindingFence != assignment.BindingFence) {
			stream, startErr := replaceExecution(existing.stream, assignment, ticket.Allow)
			if startErr == nil {
				runner.beginDrain(existing, now, oldDeadline)
				runner.instances[key] = running{assignment, stream, ticket}
			}
			if startErr != nil {
				runner.beginDrain(existing, now, oldDeadline)
				delete(runner.instances, key)
				stream, startErr = startExecution(assignment, runner.hello.Policy, ticket.Allow)
				if startErr == nil {
					runner.instances[key] = running{assignment, stream, ticket}
					runner.observations = append(runner.observations, obs)
					continue
				}
				code := "PORT_IN_USE"
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = true
			}
		} else if !ok {
			stream, startErr := startExecution(assignment, runner.hello.Policy, ticket.Allow)
			if startErr != nil {
				code := "PORT_IN_USE"
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = true
			} else {
				runner.instances[key] = running{assignment, stream, ticket}
			}
		} else {
			existing.stream.SetAuthorization(ticket.Allow)
			existing.ticket = ticket
			runner.instances[key] = existing
		}
		runner.observations = append(runner.observations, obs)
	}
	for key, instance := range runner.instances {
		if !incoming[key] {
			runner.beginDrain(instance, now, oldDeadline)
			delete(runner.instances, key)
		}
	}
	if runner.sequence >= contracts.MaxCounter {
		return fmt.Errorf("RESOURCE_LIMIT: Report sequence exhausted")
	}
	runner.sequence++
	drains := []contracts.Drain{}
	for _, drain := range runner.drains {
		a := drain.instance.assignment
		count := drain.instance.stream.Remaining()
		condition := "draining"
		if count == 0 || drain.instance.ticket.Allow() != nil {
			drain.instance.stream.Close()
			count = 0
			condition = "removed"
		}
		drains = append(drains, contracts.Drain{AssignmentId: a.AssignmentId, DeploymentGeneration: a.DeploymentGeneration, BindingFence: a.BindingFence, StartedAt: drain.started.UTC().Format(time.RFC3339Nano), Deadline: drain.deadline.UTC().Format(time.RFC3339Nano), RemainingConnections: count, Condition: condition})
	}
	report := contracts.ReportRequest{ProtocolVersion: 2, NodeId: runner.options.NodeID, BootId: runner.options.BootID, SessionEpoch: runner.hello.SessionEpoch, ReportSequence: runner.sequence, ObservedAt: now.UTC().Format(time.RFC3339Nano), AcceptedSnapshotGeneration: runner.journal.Generation, Observations: runner.observations, Drains: drains}
	if report.Observations == nil {
		report.Observations = []contracts.Observation{}
	}
	runner.pending, err = json.Marshal(report)
	return err
}
func (runner *Runner) beginDrain(instance running, now, previousCutoff time.Time) {
	if runner.drains == nil {
		runner.drains = make(map[string]draining)
	}
	key := fmt.Sprintf("%s/%d/%d", instance.assignment.AssignmentId, instance.assignment.DeploymentGeneration, instance.assignment.BindingFence)
	if _, exists := runner.drains[key]; exists {
		return
	}
	instance.ticket = instance.ticket.Drain(time.Duration(instance.assignment.DrainTimeoutSeconds) * time.Second)
	instance.stream.SetAuthorization(instance.ticket.Allow)
	instance.stream.Drain()
	deadline := instance.ticket.Deadline()
	if !previousCutoff.IsZero() && previousCutoff.Before(deadline) {
		deadline = previousCutoff
	}
	if deadline.Before(now) {
		deadline = now
	}
	runner.drains[key] = draining{instance: instance, started: now, deadline: deadline}
}
func (runner *Runner) initializeGuard() error {
	clock := runner.clock
	if clock == nil {
		clock = authorization.SystemClock
	}
	guard, err := authorization.New(clock, time.Duration(runner.hello.Policy.MaxClockSkewSeconds)*time.Second, time.Duration(runner.hello.Policy.LeaseSeconds)*time.Second, runner.credentialUntil)
	if err != nil {
		return err
	}
	runner.guard = guard
	return nil
}
func (runner *Runner) report(ctx context.Context) error {
	raw, err := runner.request(ctx, "POST", "/agent/v2/report", runner.pending, true)
	if err != nil {
		return err
	}
	value, err := contracts.ParseMessage("ReportAck", raw)
	if err != nil {
		return err
	}
	ack := value.(contracts.ReportAck)
	if ack.NodeId != runner.options.NodeID || ack.BootId != runner.options.BootID || ack.SessionEpoch != runner.hello.SessionEpoch || ack.ReportSequence != runner.sequence {
		return fmt.Errorf("INTEGRITY_FAILURE: ACK mismatch")
	}
	var sent contracts.ReportRequest
	json.Unmarshal(runner.pending, &sent)
	runner.mutex.Lock()
	for _, drain := range sent.Drains {
		if drain.Condition == "removed" {
			delete(runner.drains, fmt.Sprintf("%s/%d/%d", drain.AssignmentId, drain.DeploymentGeneration, drain.BindingFence))
		}
	}
	runner.mutex.Unlock()
	runner.pending = nil
	return nil
}

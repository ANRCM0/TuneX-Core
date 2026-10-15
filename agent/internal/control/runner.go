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
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/state"
)

type Options struct {
	URL, NodeID, BootID, Certificate, PrivateKey, CA, Journal, JournalKey string
	Rotate                                                                bool
	Relay                                                                 bool
	Multihop                                                              bool
	ImportTransitJournal                                                  string
	TimeProof, TimeProofKey                                               string
	Diagnostics                                                           string
}
type httpError struct {
	status int
	code   string
}

func (problem httpError) Error() string {
	return fmt.Sprintf("Control HTTP %d: %s", problem.status, problem.code)
}

type running struct {
	assignment adp3.Assignment
	stream     execution
	ticket     *authorization.Ticket
}
type execution interface {
	Close()
	Drain()
	Remaining() uint64
	SetAuthorization(func() error)
}

// The local direct engine uses its private listener/config structs; all wire messages are parsed as ADP/3 first.
func directExecution(a adp3.Assignment) (contracts.Assignment, error) {
	if a.Role != "direct" || a.Driver.Id != "native.direct.v1" || a.Resource.Protocol != a.Protocol {
		return contracts.Assignment{}, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	raw, err := json.Marshal(a.Driver.Config)
	if err != nil {
		return contracts.Assignment{}, err
	}
	var config contracts.DirectConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return contracts.Assignment{}, err
	}
	return contracts.Assignment{AssignmentId: a.AssignmentId, ForwardId: a.ForwardId, ForwardRevision: a.ForwardRevision, DeploymentGeneration: a.DeploymentGeneration, BindingFence: a.BindingFence, Role: "direct", Protocol: a.Protocol, Phase: a.Phase, Listener: contracts.Listen{Address: a.Resource.Address, Port: a.Resource.Port}, Driver: contracts.Driver{Id: "native.direct.v1", SchemaVersion: 1, ConfigDigest: a.Driver.ConfigDigest, Config: config}, DrainTimeoutSeconds: a.DrainTimeoutSeconds}, nil
}
func startExecution(a adp3.Assignment, p adp3.Policy, check func() error) (execution, error) {
	direct, err := directExecution(a)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	var policy contracts.Policy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return nil, err
	}
	switch a.Protocol {
	case "tcp":
		return forward.StartAuthorized(direct, policy, check)
	case "udp":
		return forward.StartUDPAuthorized(direct, policy, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}
func replaceExecution(old execution, a adp3.Assignment, check func() error) (execution, error) {
	direct, err := directExecution(a)
	if err != nil {
		return nil, err
	}
	switch stream := old.(type) {
	case *forward.TCP:
		return stream.ReplaceAuthorized(direct, check)
	case *forward.UDP:
		return stream.ReplaceAuthorized(direct, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

func (runner *Runner) assignmentCheck(a adp3.Assignment, ticket *authorization.Ticket) (func() error, error) {
	if a.Role == "direct" {
		return ticket.Allow, nil
	}
	_, until, err := runner.relayIdentity()
	if err != nil {
		return nil, err
	}
	return func() error {
		if err := ticket.Allow(); err != nil {
			return err
		}
		if !time.Now().Before(until) {
			return fmt.Errorf("LEASE_EXPIRED: Relay credential authorization ended")
		}
		return nil
	}, nil
}

func relayPhase(engine *relay.Engine, phase string) error {
	switch phase {
	case "prepared":
		return nil
	case "active":
		return engine.Activate()
	case "draining":
		engine.Drain()
		return nil
	default:
		return fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

func executionError(a adp3.Assignment, err error) (string, bool) {
	if a.Role == "direct" {
		return "PORT_IN_USE", true
	}
	code := strings.SplitN(err.Error(), ":", 2)[0]
	switch code {
	case "AUTHENTICATION_FAILED", "AUTHORIZATION_DENIED", "INVALID_CONFIG", "INTEGRITY_FAILURE", "UNSUPPORTED_CAPABILITY", "TARGET_REJECTED", "LEASE_EXPIRED":
		return code, false
	case "RESOURCE_LIMIT", "DOWNSTREAM_NOT_ACTIVE", "DOWNSTREAM_UNAVAILABLE", "TARGET_UNAVAILABLE":
		return code, true
	default:
		if strings.Contains(err.Error(), "bind:") {
			return "PORT_IN_USE", true
		}
		return "DOWNSTREAM_UNAVAILABLE", true
	}
}

func (runner *Runner) startAssignment(a adp3.Assignment, check func() error) (execution, error) {
	if a.Role == "direct" {
		return startExecution(a, runner.hello.Policy, check)
	}
	identity, _, err := runner.relayIdentity()
	if err != nil {
		return nil, err
	}
	if a.Driver.Id == "native.multihop.v1" {
		if !runner.options.Multihop {
			return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Multi-hop execution disabled")
		}
		maximum := runner.hello.Policy.MaxTcpConnectionsPerAssignment
		if a.Protocol == "udp" {
			maximum = runner.hello.Policy.MaxUdpSessionsPerAssignment
		}
		engine, err := relay.PrepareMultihop(a, identity, int(min(maximum, 4096)), check)
		if err != nil {
			return nil, err
		}
		if err = relayPhase(engine, a.Phase); err != nil {
			engine.Close()
			return nil, err
		}
		return engine, nil
	}
	raw, err := json.Marshal(a)
	if err != nil {
		return nil, err
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	body["protocolVersion"] = json.RawMessage("3")
	body["nodeId"], _ = json.Marshal(runner.options.NodeID)
	body["sessionEpoch"], _ = json.Marshal(runner.hello.SessionEpoch)
	raw, err = json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var assignment adp3relay.Assignment
	if err := adp3relay.Parse("Assignment", raw, &assignment); err != nil {
		return nil, err
	}
	assignment.Phase = "prepared"
	maximum := runner.hello.Policy.MaxTcpConnectionsPerAssignment
	if a.Protocol == "udp" {
		maximum = runner.hello.Policy.MaxUdpSessionsPerAssignment
	}
	engine, err := relay.Prepare(assignment, identity, int(min(maximum, 4096)), check)
	if err != nil {
		return nil, err
	}
	if err := relayPhase(engine, a.Phase); err != nil {
		engine.Close()
		return nil, err
	}
	return engine, nil
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
	runtimeState          state.RuntimeJournal
	hello                 adp3.HelloResponse
	sequence              uint64
	pending               []byte
	instances             map[string]running
	drains                map[string]draining
	observations          []adp3.Observation
	mutex                 sync.Mutex
	deadline              time.Time
	guard                 *authorization.Guard
	ticket                *authorization.Ticket
	clock                 authorization.Clock
	certificate           tls.Certificate
	credentialUntil       time.Time
	credentialFingerprint [32]byte
	roots                 *x509.CertPool
	relayCertificate      tls.Certificate
	relayUntil            time.Time
	relayRenewAfter       time.Time
}

func New(options Options) (*Runner, error) {
	if options.Multihop && !options.Relay || options.ImportTransitJournal != "" && !options.Multihop {
		return nil, fmt.Errorf("INVALID_CONFIG: Multi-hop requires Relay and explicit journal migration")
	}
	if !strings.HasPrefix(options.URL, "https://") {
		return nil, fmt.Errorf("HTTPS Control URL required")
	}
	if err := authorization.ValidateProofBoundary(options.TimeProof, options.TimeProofKey, filepath.Dir(options.Journal)); err != nil {
		return nil, err
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
	runtimeJournal, err := state.LoadRuntimeJournal(options.Journal, key, options.NodeID)
	if err != nil {
		return nil, err
	}
	if runtimeJournal.ExecutionExtension != nil && !options.Multihop {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Migrated journal requires multi-hop-aware Runner")
	}
	runner := &Runner{options: options, key: key, journal: runtimeJournal.Journal, runtimeState: runtimeJournal, instances: make(map[string]running), roots: roots}
	if err := runner.reloadCredential(); err != nil {
		return nil, err
	}
	if options.Multihop {
		runtimeJournal, err = state.EnableRuntimeExecution(options.Journal, key, options.NodeID, options.ImportTransitJournal)
		if err != nil {
			return nil, err
		}
		runner.journal = runtimeJournal.Journal
		runner.runtimeState = runtimeJournal
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
	hello := adp3.HelloRequest{ProtocolVersion: 3, NodeId: runner.options.NodeID, BootId: runner.options.BootID, AgentBuild: "vnext-adp3-direct", Capabilities: []string{"adp.3", "native.direct.v1", "tcp", "udp"}, LastStoredSnapshotGeneration: runner.journal.Generation}
	if runner.options.Relay {
		hello.Capabilities = append(hello.Capabilities, "native.relay.v1", "relay.wire.1")
	}
	if runner.options.Multihop {
		hello.Capabilities = append(hello.Capabilities, "adp.execution.1", "native.multihop.v1", "multihop.wire.1")
	}
	body, _ := json.Marshal(hello)
	var raw []byte
	var err error
	for delay := time.Second; ; delay = min(delay*2, 30*time.Second) {
		raw, err = runner.request(ctx, "POST", "/agent/v3/hello", body, false)
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
	message, err := adp3.Parse("HelloResponse", raw)
	if err != nil {
		return err
	}
	runner.hello = message.(adp3.HelloResponse)
	if runner.hello.NodeId != runner.options.NodeID || runner.hello.BootId != runner.options.BootID {
		return fmt.Errorf("AUTHORIZATION_DENIED: Hello identity mismatch")
	}
	if err := runner.initializeGuard(); err != nil {
		return err
	}
	if runner.options.Diagnostics != "" {
		diagnosticDone := make(chan struct{})
		go func() {
			defer close(diagnosticDone)
			ticker := time.NewTicker(500 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					if err := runner.writeDiagnostics(false); err != nil {
						fmt.Fprintln(os.Stderr, "Local diagnostics unavailable")
					}
				}
			}
		}()
		defer func() { cancel(); <-diagnosticDone; runner.stop(); runner.writeDiagnostics(true) }()
	}
	serverTime, err := time.Parse(time.RFC3339Nano, runner.hello.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.guard.ValidateServerTime(serverTime); err != nil {
		return err
	}
	if runner.options.Relay {
		if err := runner.ensureRelayCredential(ctx); err != nil {
			return err
		}
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
		runner.mutex.Lock()
		machineDue := time.Until(runner.credentialUntil) <= runner.credentialRenewalLead()
		runner.mutex.Unlock()
		if rotateRequested || machineDue {
			if err := runner.rotate(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "Credential rotation retry pending:", err)
			} else {
				rotateRequested = false
			}
		}
		if err := runner.reloadCredential(); err != nil {
			return err
		}
		if runner.options.Relay && runner.relayRenewalDue() {
			if err := runner.renewRelayCredential(ctx); err != nil {
				fmt.Fprintln(os.Stderr, "Relay credential renewal retry pending:", err)
				// A response may be lost after issuance. Replaying the same durable CSR
				// before reconciling prevents a successor engine from capturing the old key.
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(time.Duration(runner.hello.Policy.PollIntervalSeconds) * time.Second):
				}
				continue
			}
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
	raw, err := runner.request(ctx, "GET", "/agent/v3/snapshot?sinceGeneration="+strconv.FormatUint(runner.journal.Generation, 10), nil, true)
	if err != nil {
		return err
	}
	value, err := adp3.Parse("Snapshot", raw)
	if err != nil {
		return err
	}
	snapshot := value.(adp3.Snapshot)
	if snapshot.ExecutionExtension != nil && !runner.options.Multihop {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY: Multi-hop execution disabled")
	}
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
	var prior adp3.Snapshot
	if len(runner.journal.Snapshot) > 0 {
		if err := json.Unmarshal(runner.journal.Snapshot, &prior); err != nil {
			return fmt.Errorf("INTEGRITY_FAILURE: persisted snapshot corrupted")
		}
	}
	for _, assignment := range snapshot.Assignments {
		if assignment.Role == "direct" && (assignment.Phase != "active" || assignment.Driver.Id != "native.direct.v1") {
			return fmt.Errorf("UNSUPPORTED_CAPABILITY")
		}
		if assignment.Role != "direct" {
			if !runner.options.Relay || assignment.Driver.Id != "native.relay.v1" && !(runner.options.Multihop && assignment.Driver.Id == "native.multihop.v1") {
				return fmt.Errorf("UNSUPPORTED_CAPABILITY")
			}
			if _, _, err := runner.relayIdentity(); err != nil {
				return err
			}
		}
		key := fmt.Sprintf("%s/%d", assignment.Resource.Protocol, assignment.Resource.Port)
		for _, old := range prior.Assignments {
			if old.AssignmentId == assignment.AssignmentId && old.DeploymentGeneration == assignment.DeploymentGeneration && old.BindingFence == assignment.BindingFence && (old.Driver.ConfigDigest != assignment.Driver.ConfigDigest || old.Resource != assignment.Resource || old.Protocol != assignment.Protocol) {
				return fmt.Errorf("INTEGRITY_FAILURE: execution configuration changed without a new generation/fence")
			}
			if old.AssignmentId == assignment.AssignmentId && old.DeploymentGeneration == assignment.DeploymentGeneration && old.BindingFence == assignment.BindingFence && (old.Phase == "draining" && assignment.Phase != "draining" || old.Phase == "active" && assignment.Phase == "prepared") {
				return fmt.Errorf("FENCING_REJECTED: Relay instance phase regressed")
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
		key := fmt.Sprintf("%s/%d", tombstone.PhysicalProtocol, tombstone.Port)
		next.Retired[key] = max(next.Retired[key], tombstone.BindingFence)
	}
	next.Generation = snapshot.SnapshotGeneration
	next.Digest = snapshot.SnapshotDigest
	next.Snapshot = append([]byte(nil), raw...)
	if changed {
		current := runner.runtimeState
		if current.NodeID == "" {
			current = state.RuntimeJournal{ProtocolVersion: 3, NodeID: runner.options.NodeID, Journal: runner.journal}
		}
		stored, err := state.AcceptRuntimeSnapshot(runner.options.Journal, runner.key, current, snapshot)
		if err != nil {
			return err
		}
		next = stored.Journal
		runner.runtimeState = stored
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	runner.journal = next
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
		key := fmt.Sprintf("%s/%d", assignment.Resource.Protocol, assignment.Resource.Port)
		check, err := runner.assignmentCheck(assignment, ticket)
		if err != nil {
			return err
		}
		condition := "ready"
		if assignment.Phase == "prepared" {
			condition = "prepared"
		}
		if assignment.Phase == "draining" {
			condition = "draining"
		}
		obs := adp3.Observation{AssignmentId: assignment.AssignmentId, DeploymentGeneration: assignment.DeploymentGeneration, BindingFence: assignment.BindingFence, Phase: assignment.Phase, Condition: condition, Retryable: false}
		if existing, ok := runner.instances[key]; ok && (existing.assignment.Driver.ConfigDigest != assignment.Driver.ConfigDigest || existing.assignment.DeploymentGeneration != assignment.DeploymentGeneration || existing.assignment.BindingFence != assignment.BindingFence) {
			stream, startErr := replaceExecution(existing.stream, assignment, check)
			if startErr == nil {
				runner.beginDrain(existing, now, oldDeadline)
				runner.instances[key] = running{assignment, stream, ticket}
			}
			if startErr != nil {
				runner.beginDrain(existing, now, oldDeadline)
				delete(runner.instances, key)
				stream, startErr = runner.startAssignment(assignment, check)
				if startErr == nil {
					runner.instances[key] = running{assignment, stream, ticket}
					runner.observations = append(runner.observations, obs)
					continue
				}
				code, retryable := executionError(assignment, startErr)
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = retryable
			}
		} else if !ok {
			stream, startErr := runner.startAssignment(assignment, check)
			if startErr != nil {
				code, retryable := executionError(assignment, startErr)
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = retryable
			} else {
				runner.instances[key] = running{assignment, stream, ticket}
			}
		} else {
			existing.stream.SetAuthorization(check)
			if engine, ok := existing.stream.(*relay.Engine); ok {
				if err := relayPhase(engine, assignment.Phase); err != nil {
					code, retryable := executionError(assignment, err)
					obs.Condition, obs.ErrorCode, obs.Retryable = "error", &code, retryable
				}
			}
			existing.assignment = assignment
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
	drains := []adp3.Drain{}
	for _, drain := range runner.drains {
		a := drain.instance.assignment
		count := drain.instance.stream.Remaining()
		condition := "draining"
		if count == 0 || drain.instance.ticket.Allow() != nil {
			drain.instance.stream.Close()
			count = 0
			condition = "removed"
		}
		drains = append(drains, adp3.Drain{AssignmentId: a.AssignmentId, DeploymentGeneration: a.DeploymentGeneration, BindingFence: a.BindingFence, StartedAt: drain.started.UTC().Format(time.RFC3339Nano), Deadline: drain.deadline.UTC().Format(time.RFC3339Nano), RemainingConnections: count, Condition: condition})
	}
	report := adp3.ReportRequest{ProtocolVersion: 3, NodeId: runner.options.NodeID, BootId: runner.options.BootID, SessionEpoch: runner.hello.SessionEpoch, ReportSequence: runner.sequence, ObservedAt: now.UTC().Format(time.RFC3339Nano), AcceptedSnapshotGeneration: runner.journal.Generation, Observations: runner.observations, Drains: drains}
	if report.Observations == nil {
		report.Observations = []adp3.Observation{}
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
		clock = authorization.SynchronizedClock(time.Duration(runner.hello.Policy.MaxClockSkewSeconds)*time.Second, authorization.ProofOptions{Path: runner.options.TimeProof, KeyPath: runner.options.TimeProofKey})
	}
	guard, err := authorization.New(clock, time.Duration(runner.hello.Policy.MaxClockSkewSeconds)*time.Second, time.Duration(runner.hello.Policy.LeaseSeconds)*time.Second, runner.credentialUntil)
	if err != nil {
		return err
	}
	runner.guard = guard
	return nil
}
func (runner *Runner) report(ctx context.Context) error {
	raw, err := runner.request(ctx, "POST", "/agent/v3/report", runner.pending, true)
	if err != nil {
		return err
	}
	value, err := adp3.Parse("ReportAck", raw)
	if err != nil {
		return err
	}
	ack := value.(adp3.ReportAck)
	if ack.NodeId != runner.options.NodeID || ack.BootId != runner.options.BootID || ack.SessionEpoch != runner.hello.SessionEpoch || ack.ReportSequence != runner.sequence {
		return fmt.Errorf("INTEGRITY_FAILURE: ACK mismatch")
	}
	var sent adp3.ReportRequest
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

package control

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/controlchannel"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

type Options struct {
	URL, NodeID, BootID, Certificate, PrivateKey, CA, Journal, JournalKey string
	Rotate                                                                bool
	Relay                                                                 bool
	Multihop                                                              bool
	ProbeRegistration                                                     bool
	ProbeExecution                                                        bool
	ProbeIngress                                                          bool
	ProbeServices                                                         bool
	ProbeEcho                                                             bool
	ImportTransitJournal                                                  string
	TimeProof, TimeProofKey                                               string
	Diagnostics                                                           string
	Telemetry                                                             bool
	ForwardTelemetry                                                      bool
	HostTelemetry                                                         bool
	ProbeTelemetry                                                        bool
}
type httpError struct {
	status int
	code   string
}

func (problem httpError) Error() string {
	return (executionchannel.HTTPError{Status: problem.status, Code: problem.code}).Error()
}

type running struct {
	assignment adp3.Assignment
	stream     execution
	ticket     *authorization.Ticket
}

func (runner *Runner) assignmentCheck(driver executionDriver, ticket *authorization.Ticket) (func() error, error) {
	if !driver.descriptor.requiresRelay {
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
		if !runner.scheduler().Now().Before(until) {
			return fmt.Errorf("LEASE_EXPIRED: Relay credential authorization ended")
		}
		return nil
	}, nil
}

type draining struct {
	instance running
	started  time.Time
	deadline time.Time
}
type Runner struct {
	providers                  Providers
	effects                    Effects
	local                      LocalServices
	probeCounterClock          runtimeplatform.Scheduler
	options                    Options
	client                     *http.Client
	key                        []byte
	journal                    state.Journal
	runtimeState               state.RuntimeJournal
	hello                      adp3.HelloResponse
	sequence                   uint64
	pending                    []byte
	instances                  map[string]running
	drains                     map[string]draining
	observations               []adp3.Observation
	mutex                      sync.Mutex
	deadline                   time.Time
	guard                      *authorization.Guard
	ticket                     *authorization.Ticket
	clock                      authorization.Clock
	certificate                tls.Certificate
	credentialUntil            time.Time
	credentialFingerprint      [32]byte
	roots                      *x509.CertPool
	relayCertificate           tls.Certificate
	relayUntil                 time.Time
	relayRenewAfter            time.Time
	probeChange                sync.Mutex
	probeRegistration          *registeredProbe
	probeStopped               bool
	forwardCounterTails        []forwardCounterTail
	forwardCounterTailsEvicted uint64
	forwardCounterTailsExpired uint64
	forwardCounterCursor       uint64
	forwardTelemetryCursor     uint64
	probeCounterTails          []probeCounterTail
	probeCounterRetiring       []probeCounterSource
	probeCounterTailsEvicted   uint64
	probeCounterTailsExpired   uint64
	probeCounterCursor         uint64
}

func New(options Options) (*Runner, error) { return newRunner(options, defaultProviders()) }

func newRunner(options Options, providers Providers) (*Runner, error) {
	return newRunnerWithEffects(options, providers, defaultEffects())
}

func newRunnerWithEffects(options Options, providers Providers, effects Effects) (*Runner, error) {
	return newRunnerWithLocalServices(options, providers, effects, defaultLocalServices())
}

func newRunnerWithLocalServices(options Options, providers Providers, effects Effects, local LocalServices) (*Runner, error) {
	if options.ProbeEcho && (!options.ProbeServices || !options.ProbeIngress || !options.ProbeExecution || !options.ProbeRegistration) {
		return nil, fmt.Errorf("INVALID_CONFIG: Echo Probe requires explicit services, ingress, execution and registration")
	}
	if options.ProbeServices && (!options.ProbeIngress || !options.ProbeExecution || !options.ProbeRegistration) {
		return nil, fmt.Errorf("INVALID_CONFIG: Service Probe requires explicit ingress, execution and registration")
	}
	if options.ProbeIngress && (!options.ProbeExecution || !options.ProbeRegistration) {
		return nil, fmt.Errorf("INVALID_CONFIG: Ingress Probe requires explicit Probe execution and registration")
	}
	if options.ProbeExecution && !options.ProbeRegistration {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe execution requires explicit Probe registration")
	}
	if options.Multihop && !options.Relay || options.ImportTransitJournal != "" && !options.Multihop {
		return nil, fmt.Errorf("INVALID_CONFIG: Multi-hop requires Relay and explicit journal migration")
	}
	if err := controlchannel.ValidateControlURL(options.URL); err != nil {
		return nil, err
	}
	if err := effects.Bootstrap.ValidateProofBoundary(options.TimeProof, options.TimeProofKey, options.Journal); err != nil {
		return nil, err
	}
	roots, err := effects.Bootstrap.LoadRoots(options.CA)
	if err != nil {
		return nil, err
	}
	key, err := effects.Bootstrap.LoadProtectionKey(options.JournalKey)
	if err != nil {
		return nil, err
	}
	loadedRuntime, err := effects.Bootstrap.LoadRuntime(options.Journal, key, options.NodeID)
	if err != nil {
		return nil, err
	}
	runtimeJournal := state.RuntimeJournalFromFacts(loadedRuntime)
	if runtimeJournal.ExecutionExtension != nil && !options.Multihop {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Migrated journal requires multi-hop-aware Runner")
	}
	runner := &Runner{providers: providers, effects: effects, local: local, probeCounterClock: nativeProbeCounterScheduler(), options: options, key: key, journal: runtimeJournal.Journal, runtimeState: runtimeJournal, instances: make(map[string]running), roots: roots}
	if err := runner.reloadCredential(); err != nil {
		return nil, err
	}
	if options.Multihop {
		loadedRuntime, err = effects.Bootstrap.EnableRuntime(options.Journal, key, options.NodeID, options.ImportTransitJournal)
		if err != nil {
			return nil, err
		}
		runtimeJournal = state.RuntimeJournalFromFacts(loadedRuntime)
		runner.journal = runtimeJournal.Journal
		runner.runtimeState = runtimeJournal
	}
	runner.client = runner.channelProvider().NewClient(roots, func() tls.Certificate {
		runner.mutex.Lock()
		defer runner.mutex.Unlock()
		return runner.certificate
	})
	return runner, nil
}
func (runner *Runner) request(ctx context.Context, method, path string, body []byte, epoch bool) ([]byte, error) {
	raw, err := runner.channelProvider().Request(ctx, runner.client, runner.options.URL, method, path, body, epoch, runner.hello.SessionEpoch)
	var problem executionchannel.HTTPError
	if errors.As(err, &problem) {
		return nil, httpError{status: problem.Status, code: problem.Code}
	}
	return raw, err
}
func (runner *Runner) stop() {
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	runner.probeStopped = true
	runner.closeProbeLocked()
	for key, instance := range runner.instances {
		instance.stream.Close()
		runner.retainForwardCounterTailLocked(instance)
		delete(runner.instances, key)
	}
	for key, drain := range runner.drains {
		drain.instance.stream.Close()
		runner.retainForwardCounterTailLocked(drain.instance)
		delete(runner.drains, key)
	}
}
func (runner *Runner) Run(ctx context.Context) error {
	started := runner.scheduler().Now()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer runner.stop()
	defer runner.channelProvider().CloseIdleConnections(runner.client)
	hello := adp3.HelloRequest{ProtocolVersion: 3, NodeId: runner.options.NodeID, BootId: runner.options.BootID, AgentBuild: "vnext-adp3-direct", Capabilities: builtinExecutionDrivers.capabilities(runner.executionFeatures()), LastStoredSnapshotGeneration: runner.journal.Generation}
	body, _ := nativeexecution.EncodeRunnerHello(hello)
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
		case <-runner.scheduler().After(delay):
		}
	}
	message, err := nativeexecution.DecodeRunnerHello(raw)
	if err != nil {
		return err
	}
	runner.hello = message
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
			ticker := runner.scheduler().NewTicker(500 * time.Millisecond)
			defer ticker.Stop()
			counterTicker := runner.scheduler().NewTicker(10 * time.Second)
			defer counterTicker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C():
					if err := runner.writeDiagnostics(false); err != nil {
						runner.localLog().Warn("Local diagnostics unavailable")
					}
				case <-counterTicker.C():
					if err := runner.writeForwardCounters(false); err != nil {
						runner.localLog().Warn("Local forward counters unavailable")
					}
				}
			}
		}()
		defer func() {
			cancel()
			<-diagnosticDone
			runner.stop()
			runner.writeDiagnostics(true)
			runner.writeForwardCounters(true)
		}()
	}
	serverTime, err := nativeexecution.ParseWireTime(runner.hello.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.guard.ValidateServerTime(serverTime); err != nil {
		return err
	}
	if runner.options.Telemetry {
		telemetryDone := make(chan struct{})
		go func() { defer close(telemetryDone); runner.maintainTelemetry(ctx, started) }()
		defer func() { cancel(); <-telemetryDone }()
	}
	if runner.options.ForwardTelemetry {
		forwardTelemetryDone := make(chan struct{})
		go func() { defer close(forwardTelemetryDone); runner.maintainForwardTelemetry(ctx, started) }()
		defer func() { cancel(); <-forwardTelemetryDone }()
	}
	if runner.options.HostTelemetry {
		hostTelemetryDone := make(chan struct{})
		go func() { defer close(hostTelemetryDone); runner.maintainHostTelemetry(ctx, started) }()
		defer func() { cancel(); <-hostTelemetryDone }()
	}
	if runner.options.ProbeTelemetry {
		probeTelemetryDone := make(chan struct{})
		go func() { defer close(probeTelemetryDone); runner.maintainProbeTelemetry(ctx, started) }()
		defer func() { cancel(); <-probeTelemetryDone }()
	}
	if runner.options.Relay {
		if err := runner.ensureRelayCredential(ctx); err != nil {
			return err
		}
	}
	// Credential validity and wall/monotonic drift are checked independently of network retry/poll intervals.
	guardDone := make(chan struct{})
	go func() {
		ticker := runner.scheduler().NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		defer close(guardDone)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C():
				runner.mutex.Lock()
				problem := runner.guard.Check()
				if problem == nil && runner.ticket != nil {
					problem = runner.ticket.Allow()
				}
				expired := problem != nil
				if expired {
					runner.closeProbeLocked()
					runner.localLog().Warn("Agent authorization ended:", problem)
					cancel()
					for key, instance := range runner.instances {
						instance.stream.Close()
						runner.retainForwardCounterTailLocked(instance)
						delete(runner.instances, key)
					}
					for key, drain := range runner.drains {
						drain.instance.stream.Close()
						runner.retainForwardCounterTailLocked(drain.instance)
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
	var probeCancel context.CancelFunc
	if runner.options.ProbeRegistration {
		probeContext, stopProbe := context.WithCancel(ctx)
		probeCancel = stopProbe
		probeDone := make(chan struct{})
		go func() { defer close(probeDone); runner.maintainProbe(probeContext) }()
		defer func() { stopProbe(); <-probeDone }()
	}
	if runner.options.ProbeExecution {
		probeContext, stopExecution := context.WithCancel(ctx)
		executionDone := make(chan struct{})
		go func() { defer close(executionDone); runner.maintainProbeExecution(probeContext) }()
		defer func() { stopExecution(); <-executionDone }()
	}
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
			case <-runner.scheduler().After(time.Second):
				continue
			}
		}
		runner.mutex.Lock()
		machineDue := runner.scheduler().Until(runner.credentialUntil) <= runner.credentialRenewalLead()
		runner.mutex.Unlock()
		if rotateRequested || machineDue {
			if err := runner.rotate(ctx); err != nil {
				runner.localLog().Warn("Credential rotation retry pending:", err)
			} else {
				rotateRequested = false
			}
		}
		if err := runner.reloadCredential(); err != nil {
			return err
		}
		if runner.options.Relay && runner.relayRenewalDue() {
			if err := runner.renewRelayCredential(ctx); err != nil {
				runner.localLog().Warn("Relay credential renewal retry pending:", err)
				// A response may be lost after issuance. Replaying the same durable CSR
				// before reconciling prevents a successor engine from capturing the old key.
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-runner.scheduler().After(time.Duration(runner.hello.Policy.PollIntervalSeconds) * time.Second):
				}
				continue
			}
		}
		if err := runner.poll(ctx); err != nil {
			runner.localLog().Warn("Agent reconcile failed:", err)
			var problem httpError
			if errors.As(err, &problem) && (problem.status == 401 || problem.status == 403 || problem.code == "SESSION_SUPERSEDED") {
				retired = true
				if probeCancel != nil {
					probeCancel()
				}
			}
		} else if len(runner.pending) > 0 {
			if err := runner.report(ctx); err != nil {
				runner.localLog().Warn("Agent report retry pending:", err)
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-runner.scheduler().After(time.Duration(runner.hello.Policy.PollIntervalSeconds) * time.Second):
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
	raw, err := runner.request(ctx, "GET", controlchannel.RuntimeSnapshotPath(runner.journal.Generation), nil, true)
	if err != nil {
		return err
	}
	snapshot, err := nativeexecution.DecodeRunnerSnapshot(raw)
	if err != nil {
		return err
	}
	if snapshot.ExecutionExtension != nil && !runner.options.Multihop {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY: Multi-hop execution disabled")
	}
	if snapshot.NodeId != runner.options.NodeID || snapshot.SessionEpoch != runner.hello.SessionEpoch {
		return fmt.Errorf("SESSION_SUPERSEDED")
	}
	if snapshot.SnapshotGeneration < runner.journal.Generation || (snapshot.SnapshotGeneration == runner.journal.Generation && snapshot.SnapshotDigest != runner.journal.Digest) {
		return fmt.Errorf("INTEGRITY_FAILURE: Snapshot history changed")
	}
	now := runner.scheduler().Now()
	issued, valid, err := nativeexecution.RunnerSnapshotWindow(snapshot)
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
		prior, err = nativeexecution.DecodeRetainedRunnerSnapshot(runner.journal.Snapshot)
		if err != nil {
			return fmt.Errorf("INTEGRITY_FAILURE: persisted snapshot corrupted")
		}
	}
	drivers := make(map[string]executionDriver, len(snapshot.Assignments))
	for _, assignment := range snapshot.Assignments {
		driver, err := builtinExecutionDrivers.resolve(assignment, runner.executionFeatures())
		if err != nil {
			return err
		}
		drivers[assignment.AssignmentId] = driver
		if driver.descriptor.requiresRelay {
			if _, _, err := runner.relayIdentity(); err != nil {
				return err
			}
		}
		key := state.PhysicalSlotKey(assignment.Resource.Protocol, assignment.Resource.Port)
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
		key := state.PhysicalSlotKey(tombstone.PhysicalProtocol, tombstone.Port)
		next.Retired[key] = max(next.Retired[key], tombstone.BindingFence)
	}
	next.Generation = snapshot.SnapshotGeneration
	next.Digest = snapshot.SnapshotDigest
	next.Snapshot = append([]byte(nil), raw...)
	if changed {
		current := runner.runtimeState
		if current.NodeID == "" {
			current = state.NativeRuntimeJournal(runner.options.NodeID, runner.journal)
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
		key := state.PhysicalSlotKey(assignment.Resource.Protocol, assignment.Resource.Port)
		driver := drivers[assignment.AssignmentId]
		check, err := runner.assignmentCheck(driver, ticket)
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
			stream, startErr := driver.replaceInstance(existing, assignment, check)
			if startErr == nil {
				runner.beginDrain(existing, now, oldDeadline)
				runner.instances[key] = running{assignment, stream, ticket}
			}
			if startErr != nil {
				runner.beginDrain(existing, now, oldDeadline)
				delete(runner.instances, key)
				stream, startErr = driver.start(runner.executionHost(driver), assignment, check)
				if startErr == nil {
					runner.instances[key] = running{assignment, stream, ticket}
					runner.observations = append(runner.observations, obs)
					continue
				}
				code, retryable := driver.classify(startErr)
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = retryable
			}
		} else if !ok {
			stream, startErr := driver.start(runner.executionHost(driver), assignment, check)
			if startErr != nil {
				code, retryable := driver.classify(startErr)
				obs.Condition = "error"
				obs.ErrorCode = &code
				obs.Retryable = retryable
			} else {
				runner.instances[key] = running{assignment, stream, ticket}
			}
		} else {
			existing.stream.SetAuthorization(check)
			if err := driver.phase(existing.stream, assignment.Phase); err != nil {
				code, retryable := driver.classify(err)
				obs.Condition, obs.ErrorCode, obs.Retryable = "error", &code, retryable
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
		drains = append(drains, nativeexecution.RunnerDrain(a, drain.started, drain.deadline, count, condition))
	}
	runner.pending, err = nativeexecution.EncodeRunnerReportAt(runner.options.NodeID, runner.options.BootID,
		runner.hello.SessionEpoch, runner.sequence, now, runner.journal.Generation, runner.observations, drains)
	return err
}
func (runner *Runner) beginDrain(instance running, now, previousCutoff time.Time) {
	if runner.drains == nil {
		runner.drains = make(map[string]draining)
	}
	key := nativeexecution.RunnerDrainKey(instance.assignment.AssignmentId, instance.assignment.DeploymentGeneration, instance.assignment.BindingFence)
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
	ack, err := nativeexecution.DecodeRunnerReportAck(raw)
	if err != nil {
		return err
	}
	if ack.NodeId != runner.options.NodeID || ack.BootId != runner.options.BootID || ack.SessionEpoch != runner.hello.SessionEpoch || ack.ReportSequence != runner.sequence {
		return fmt.Errorf("INTEGRITY_FAILURE: ACK mismatch")
	}
	sent := nativeexecution.DecodePendingRunnerReport(runner.pending)
	runner.mutex.Lock()
	for _, drain := range sent.Drains {
		if drain.Condition == "removed" {
			key := nativeexecution.RunnerDrainKey(drain.AssignmentId, drain.DeploymentGeneration, drain.BindingFence)
			if entry, exists := runner.drains[key]; exists {
				runner.retainForwardCounterTailLocked(entry.instance)
			}
			delete(runner.drains, key)
		}
	}
	runner.mutex.Unlock()
	runner.pending = nil
	return nil
}

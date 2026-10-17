package control

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeclaim"
	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/proberesult"
)

type probeExecutionOptions struct {
	timeout  time.Duration
	wrap     func(probe.Resolver) probe.Resolver
	status   func(int, *probedelivery.StatusResponse, http.ResponseWriter, *http.Request) bool
	workflow bool
	claim    func(http.ResponseWriter, *http.Request) bool
	result   func(*proberesult.Response, http.ResponseWriter, *http.Request) bool
}

type probeExecutionFixture struct {
	runner      *Runner
	binding     probe.Binding
	receipt     *probeClaimReceipt
	claimAck    atomic.Pointer[probeclaim.Response]
	claims      atomic.Int32
	statuses    atomic.Int32
	connections atomic.Int32
	polls       atomic.Int32
	reports     atomic.Int32
	reported    atomic.Pointer[proberesult.Request]
	eof         chan struct{}
}

var probeExecutionNode atomic.Uint64

// Synthetic registry/Control, real TLS claims/status and a real numeric target.
// This does not replace the separate real Agent + MySQL acceptance gate.
func executionFixture(t *testing.T, options probeExecutionOptions) *probeExecutionFixture {
	t.Helper()
	runner, binding, _ := probeTestRunner(t)
	node := fmt.Sprintf("exec-%d", probeExecutionNode.Add(1))
	runner.options.NodeID, binding.NodeID = node, node
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	f := &probeExecutionFixture{runner: runner, binding: binding, eof: make(chan struct{}, 32)}
	targetDone := make(chan struct{})
	go func() {
		defer close(targetDone)
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			f.connections.Add(1)
			_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
			var data [1]byte
			n, err := connection.Read(data[:])
			_ = connection.Close()
			if n != 0 || err != io.EOF {
				t.Error("Probe did not close with zero application bytes")
			}
			f.eof <- struct{}{}
		}
	}()
	t.Cleanup(func() { _ = listener.Close(); <-targetDone })
	current := runner.instances["tcp/22001"]
	target := *current.assignment.Driver.Config.Target
	target.Port = uint64(listener.Addr().(*net.TCPAddr).Port)
	current.assignment.Driver.Config.Target = &target
	digest, err := contracts.ComputeDigest(current.assignment.Driver.Config)
	if err != nil {
		t.Fatal(err)
	}
	current.assignment.Driver.ConfigDigest, f.binding.ConfigDigest = digest, digest
	runner.instances["tcp/22001"] = current
	var resolve probe.Resolver = runner.resolveProbeTarget
	if options.wrap != nil {
		resolve = options.wrap(resolve)
	}
	executor, err := probe.New(resolve)
	if err != nil {
		t.Fatal(err)
	}
	gate, err := probe.NewGate(node, binding.BootID, binding.SessionEpoch, executor)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	session := &registeredProbe{gate: gate, node: node, boot: binding.BootID, epoch: binding.SessionEpoch,
		generation: 1, fingerprint: runner.credentialFingerprint, guard: runner.guard, until: time.Now().Add(20 * time.Second),
		ctx: ctx, cancel: cancel, done: make(chan struct{})}
	runner.probeRegistration = session
	go runner.monitorProbe(session)
	if options.timeout == 0 {
		options.timeout = time.Second
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.Header.Get("X-TuneX-Session-Epoch") != "2" {
			t.Error("incorrect host request")
		}
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
		stamp := func(at time.Time) string { return at.UTC().Format("2006-01-02T15:04:05.000Z") }
		now := time.Now()
		switch r.URL.Path {
		case "/agent/v3/probe/claim":
			f.claims.Add(1)
			req, err := probeclaim.ParseRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			ack := &probeclaim.Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-claim-ack", NodeId: req.NodeId,
				BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId, InstanceGeneration: req.InstanceGeneration,
				PermitId: req.PermitId, Binding: wireClaimBinding(f.binding), TimeoutMs: uint64(options.timeout / time.Millisecond),
				IssuedAt: stamp(now.Add(-50 * time.Millisecond)), ExpiresAt: stamp(now.Add(1950 * time.Millisecond)),
				ConsumedAt: stamp(now), ServerTime: stamp(now), State: "consumed"}
			f.claimAck.Store(ack)
			if options.claim != nil && options.claim(w, r) {
				return
			}
			_ = json.NewEncoder(w).Encode(ack)
		case "/agent/v3/probe/poll":
			if !options.workflow {
				t.Error("unexpected production poll")
				w.WriteHeader(404)
				return
			}
			f.polls.Add(1)
			req, err := probedelivery.ParsePollRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			ack := probedelivery.PollResponse{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-poll-ack",
				NodeId: req.NodeId, BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId,
				InstanceGeneration: req.InstanceGeneration, RequestId: req.RequestId, ObservedAt: stamp(now), ServerTime: stamp(now),
				Offer: &probedelivery.Offer{PermitId: "permit-a", Binding: wireDeliveryBinding(f.binding),
					TimeoutMs: uint64(options.timeout / time.Millisecond), IssuedAt: stamp(now.Add(-50 * time.Millisecond)),
					ExpiresAt: stamp(now.Add(1950 * time.Millisecond))}}
			_ = json.NewEncoder(w).Encode(ack)
		case "/agent/v3/probe/status":
			n := int(f.statuses.Add(1))
			req, err := probedelivery.ParseStatusRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			ack := f.statusAck(*req, now)
			if options.status != nil && options.status(n, &ack, w, r) {
				return
			}
			_ = json.NewEncoder(w).Encode(ack)
		case "/agent/v3/probe/result":
			if !options.workflow && options.result == nil {
				t.Error("unexpected production result")
				w.WriteHeader(404)
				return
			}
			f.reports.Add(1)
			req, err := proberesult.ParseRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			f.reported.Store(req)
			digest, err := proberesult.ResultDigest(*req)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			ack := proberesult.Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-result-ack", NodeId: req.NodeId,
				BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId, InstanceGeneration: req.InstanceGeneration,
				PermitId: req.PermitId, RequestId: req.RequestId, ResultDigest: digest, AcceptedAt: stamp(now), ServerTime: stamp(now),
				Health: "unknown"}
			if options.result != nil && options.result(&ack, w, r) {
				return
			}
			_ = json.NewEncoder(w).Encode(ack)
		default:
			t.Error("execution admission made an unsolicited poll/result/registration request")
			w.WriteHeader(404)
		}
	}))
	runner.options.URL, runner.client = server.URL, server.Client()
	t.Cleanup(func() {
		runner.stop()
		select {
		case <-session.done:
		case <-time.After(3 * time.Second):
			t.Error("instance monitor did not drain")
		}
		deadline := time.Now().Add(3 * time.Second)
		for {
			probeDeliveries.mutex.Lock()
			active := probeDeliveries.nodes[node].active
			probeDeliveries.mutex.Unlock()
			if !active {
				break
			}
			if time.Now().After(deadline) {
				t.Error("execution watch reservation leaked")
				break
			}
			time.Sleep(time.Millisecond)
		}
		server.Close()
	})
	if options.workflow {
		runner.options.ProbeRegistration, runner.options.ProbeExecution = true, true
	} else {
		f.receipt, err = runner.claimProbe(context.Background(), "permit-a", f.binding)
		if err != nil {
			t.Fatal(err)
		}
	}
	return f
}

func (f *probeExecutionFixture) statusAck(req probedelivery.StatusRequest, now time.Time) probedelivery.StatusResponse {
	claim := f.claimAck.Load()
	stamp := now.UTC().Format("2006-01-02T15:04:05.000Z")
	return probedelivery.StatusResponse{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-status-ack", NodeId: req.NodeId,
		BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId, InstanceGeneration: req.InstanceGeneration,
		RequestId: req.RequestId, PermitId: req.PermitId, Binding: wireDeliveryBinding(f.binding), TimeoutMs: claim.TimeoutMs,
		IssuedAt: claim.IssuedAt, ExpiresAt: claim.ExpiresAt, ConsumedAt: claim.ConsumedAt, CheckedAt: stamp, ServerTime: stamp, State: "consumed"}
}

func assertProbeNoTarget(t *testing.T, f *probeExecutionFixture) {
	t.Helper()
	select {
	case <-f.eof:
		t.Fatal("denied execution reached the target")
	case <-time.After(30 * time.Millisecond):
	}
	if f.connections.Load() != 0 {
		t.Fatal("denied execution opened a target connection")
	}
}

func TestProbeExecutionOneUseConnectOnlyReportAndNoProtectedWrites(t *testing.T) {
	f := executionFixture(t, probeExecutionOptions{})
	before := f.runner.journal
	execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt)
	if err != nil {
		t.Fatal(err)
	}
	defer execution.Close()
	request, err := execution.resultRequest()
	if err != nil || request.Status != "connected" || request.Code != "tcp-connected" || request.Source != "agent-reported" ||
		request.ApplicationHealth != "unknown" || request.ApplicationPayloadBytes != 0 || request.PermitId != f.receipt.permitID ||
		request.Binding.ConfigDigest != f.binding.ConfigDigest || request.InstanceId != f.receipt.session.gate.InstanceID() {
		t.Fatalf("incorrect report: %+v %v", request, err)
	}
	raw, _ := json.Marshal(request)
	if _, err := proberesult.ParseRequest(raw); err != nil || len(raw) > 4096 {
		t.Fatalf("report is not the closed wire contract: %v", err)
	}
	for _, forbidden := range []string{"127.0.0.1", "allowedDestination", "credential", "fingerprint", "scopeId", "actor"} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("report leaked %s", forbidden)
		}
	}
	request.Status, request.Binding.ConfigDigest = "healthy", "foreign"
	fresh, err := execution.resultRequest()
	if err != nil || fresh.Status != "connected" || fresh.Binding.ConfigDigest != f.binding.ConfigDigest {
		t.Fatal("caller mutated retained report")
	}
	select {
	case <-f.eof:
	case <-time.After(time.Second):
		t.Fatal("target connection did not close")
	}
	execution.Close()
	if _, err := execution.resultRequest(); err == nil {
		t.Fatal("closed execution still exports reports")
	}
	if next, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) || next != nil ||
		f.connections.Load() != 1 || f.claims.Load() != 1 {
		t.Fatalf("receipt executed twice: %v", err)
	}
	if !reflect.DeepEqual(before, f.runner.journal) || len(f.runner.instances) != 1 || len(f.runner.drains) != 0 {
		t.Fatal("probe changed execution state")
	}
}

func TestProbeExecutionConcurrentReceiptOnlyOpensOneConnection(t *testing.T) {
	f := executionFixture(t, probeExecutionOptions{})
	type outcome struct {
		execution *probeExecution
		err       error
	}
	outcomes := make(chan outcome, 16)
	for range 16 {
		go func() {
			e, err := f.runner.executeConsumedProbe(context.Background(), f.receipt)
			outcomes <- outcome{e, err}
		}()
	}
	success := 0
	for range 16 {
		out := <-outcomes
		if out.err == nil {
			success++
			out.execution.Close()
		} else if !errors.Is(out.err, probe.ErrReplay) {
			t.Fatal(out.err)
		}
	}
	select {
	case <-f.eof:
	case <-time.After(time.Second):
		t.Fatal("target did not drain")
	}
	if success != 1 || f.connections.Load() != 1 || f.claims.Load() != 1 {
		t.Fatal("concurrent duplicate executed more than once")
	}
}

func TestProbeExecutionRequiresOriginalReceiptAndFreshInitialStatus(t *testing.T) {
	for _, mode := range []string{"nil", "copy", "old-instance", "local-ticket", "cancelled", "withdrawn", "binding", "stale", "clock-regressed"} {
		t.Run(mode, func(t *testing.T) {
			f := executionFixture(t, probeExecutionOptions{status: func(_ int, ack *probedelivery.StatusResponse, w http.ResponseWriter, _ *http.Request) bool {
				switch mode {
				case "withdrawn":
					w.WriteHeader(409)
					return true
				case "binding":
					ack.Binding.BindingFence++
				case "stale":
					at, _ := time.Parse(time.RFC3339Nano, ack.CheckedAt)
					ack.CheckedAt = at.Add(-251 * time.Millisecond).Format("2006-01-02T15:04:05.000Z")
				}
				return false
			}})
			receipt := f.receipt
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			f.runner.mutex.Lock()
			switch mode {
			case "nil":
				receipt = nil
			case "copy":
				copy := *receipt
				receipt = &copy
			case "old-instance":
				f.runner.probeRegistration = nil
			case "local-ticket":
				f.runner.ticket = nil
			case "cancelled":
				cancel()
			case "clock-regressed":
				receipt.serverAt = time.Now().Add(500 * time.Millisecond)
			}
			f.runner.mutex.Unlock()
			if execution, err := f.runner.executeConsumedProbe(ctx, receipt); err == nil || execution != nil {
				t.Fatal("unverified execution admitted")
			}
			if mode == "withdrawn" || mode == "binding" || mode == "stale" || mode == "clock-regressed" {
				if _, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) || f.statuses.Load() != 1 {
					t.Fatal("failed initial status refunded the execution attempt")
				}
			} else if f.statuses.Load() != 0 {
				t.Fatal("invalid preflight reached Control")
			}
			assertProbeNoTarget(t, f)
			// Restore ownership so fixture cleanup can close this synthetic session.
			f.runner.mutex.Lock()
			f.runner.probeRegistration = f.receipt.session
			f.runner.mutex.Unlock()
		})
	}
}

func TestProbeExecutionBusyAdmissionAndSocketCooldownNeverRefundReceipt(t *testing.T) {
	t.Run("watch-busy", func(t *testing.T) {
		f := executionFixture(t, probeExecutionOptions{})
		release, err := probeDeliveries.acquire(f.binding.NodeID, false, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		defer release()
		if execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrBusy) || execution != nil {
			t.Fatal("busy monitor admitted execution")
		}
		release()
		if _, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) || f.statuses.Load() != 0 {
			t.Fatal("busy start was retryable")
		}
		assertProbeNoTarget(t, f)
	})
	t.Run("socket-cooldown", func(t *testing.T) {
		f := executionFixture(t, probeExecutionOptions{})
		execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt)
		if err != nil {
			t.Fatal(err)
		}
		execution.Close()
		second, err := f.runner.claimProbe(context.Background(), "permit-b", f.binding)
		if err != nil {
			t.Fatal(err)
		}
		if execution, err := f.runner.executeConsumedProbe(context.Background(), second); !errors.Is(err, probe.ErrBusy) || execution != nil {
			t.Fatalf("socket cooldown bypassed: %v", err)
		}
		if _, err := f.runner.executeConsumedProbe(context.Background(), second); !errors.Is(err, probe.ErrReplay) {
			t.Fatal("socket budget failure refunded receipt")
		}
		select {
		case <-f.eof:
		case <-time.After(time.Second):
			t.Fatal("target did not drain")
		}
		if f.connections.Load() != 1 {
			t.Fatal("cooldown opened another connection")
		}
	})
}

func TestProbeExecutionRevocationCancellationAndTimeoutDiscardInFlightWork(t *testing.T) {
	for _, mode := range []string{"snapshot", "credential", "ticket", "instance", "parent", "withdrawn", "timeout"} {
		t.Run(mode, func(t *testing.T) {
			entered := make(chan struct{})
			options := probeExecutionOptions{wrap: func(probe.Resolver) probe.Resolver {
				return func(ctx context.Context, _ probe.Binding) (probe.Target, error) {
					close(entered)
					<-ctx.Done()
					return probe.Target{}, ctx.Err()
				}
			}, status: func(n int, _ *probedelivery.StatusResponse, w http.ResponseWriter, _ *http.Request) bool {
				if mode == "withdrawn" && n >= 2 {
					w.WriteHeader(409)
					return true
				}
				return false
			}}
			if mode == "timeout" {
				options.timeout = 100 * time.Millisecond
			}
			f := executionFixture(t, options)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			finished := make(chan error, 1)
			go func() {
				execution, err := f.runner.executeConsumedProbe(ctx, f.receipt)
				if execution != nil {
					execution.Close()
					err = nil
				}
				finished <- err
			}()
			select {
			case <-entered:
			case <-time.After(time.Second):
				t.Fatal("executor did not enter")
			}
			f.runner.mutex.Lock()
			ticket := f.runner.ticket
			switch mode {
			case "snapshot":
				f.runner.journal.Generation++
			case "credential":
				f.runner.credentialFingerprint[0]++
			case "ticket":
				f.runner.ticket = nil
			case "instance":
				f.runner.closeProbeLocked()
			case "parent":
				cancel()
			}
			f.runner.mutex.Unlock()
			select {
			case err := <-finished:
				if err == nil {
					t.Fatal("revoked/expired execution succeeded")
				}
			case <-time.After(3 * time.Second):
				t.Fatal("execution did not drain")
			}
			f.runner.mutex.Lock()
			switch mode {
			case "snapshot":
				f.runner.journal.Generation--
			case "credential":
				f.runner.credentialFingerprint[0]--
			case "ticket":
				f.runner.ticket = ticket
			}
			f.runner.mutex.Unlock()
			if execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); err == nil || execution != nil {
				t.Fatal("restored authority resurrected the attempt")
			}
			assertProbeNoTarget(t, f)
		})
	}
}

func TestProbeExecutionLateTransportKeepsAdmissionUntilDrainAndNeverReports(t *testing.T) {
	enteredHTTP, cancelledHTTP, releaseHTTP := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var released atomic.Bool
	release := func() {
		if released.CompareAndSwap(false, true) {
			close(releaseHTTP)
		}
	}
	defer release()
	f := executionFixture(t, probeExecutionOptions{wrap: func(probe.Resolver) probe.Resolver {
		return func(ctx context.Context, _ probe.Binding) (probe.Target, error) {
			<-ctx.Done()
			return probe.Target{}, ctx.Err()
		}
	}})
	original := f.runner.client.Transport
	var calls atomic.Int32
	f.runner.client = &http.Client{Transport: probeRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			return original.RoundTrip(r)
		}
		close(enteredHTTP)
		<-r.Context().Done()
		close(cancelledHTTP)
		<-releaseHTTP
		raw, _ := io.ReadAll(r.Body)
		request, err := probedelivery.ParseStatusRequest(raw)
		if err != nil {
			return nil, err
		}
		body, _ := json.Marshal(f.statusAck(*request, time.Now()))
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(body)))}, nil
	})}
	finished := make(chan error, 1)
	go func() {
		execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt)
		if execution != nil {
			execution.Close()
			err = nil
		}
		finished <- err
	}()
	select {
	case <-enteredHTTP:
	case <-time.After(time.Second):
		t.Fatal("second exchange not reached")
	}
	select {
	case <-cancelledHTTP:
	case <-time.After(time.Second):
		t.Fatal("stale exchange not cancelled")
	}
	select {
	case <-finished:
		t.Fatal("admission released before HTTP drained")
	default:
	}
	probeDeliveries.mutex.Lock()
	active := probeDeliveries.nodes[f.binding.NodeID].active
	probeDeliveries.mutex.Unlock()
	if !active {
		t.Fatal("watch slot refunded while worker is blocked")
	}
	release()
	select {
	case err := <-finished:
		if err == nil {
			t.Fatal("late success revived execution")
		}
	case <-time.After(time.Second):
		t.Fatal("worker failed to drain")
	}
	assertProbeNoTarget(t, f)
}

func TestProbeExecutionReportRequiresLiveAuthorityAndCannotRenewMeasurement(t *testing.T) {
	for _, mode := range []string{"parent", "ticket", "snapshot", "close", "report-expiry", "shortened", "shortened-only-validity", "withdrawn"} {
		t.Run(mode, func(t *testing.T) {
			deny := atomic.Bool{}
			f := executionFixture(t, probeExecutionOptions{status: func(_ int, _ *probedelivery.StatusResponse, w http.ResponseWriter, _ *http.Request) bool {
				if deny.Load() {
					w.WriteHeader(409)
					return true
				}
				return false
			}})
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			execution, err := f.runner.executeConsumedProbe(ctx, f.receipt)
			if err != nil {
				t.Fatal(err)
			}
			defer execution.Close()
			original, err := execution.resultRequest()
			if err != nil {
				t.Fatal(err)
			}
			f.runner.mutex.Lock()
			switch mode {
			case "parent":
				cancel()
			case "ticket":
				f.runner.ticket = nil
			case "snapshot":
				f.runner.journal.Generation++
			case "report-expiry":
				execution.reportUntil = time.Now()
			}
			f.runner.mutex.Unlock()
			if mode == "close" {
				execution.Close()
			}
			if mode == "shortened" {
				if err := execution.watch.tighten(time.Now().Add(50 * time.Millisecond)); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "shortened-only-validity" {
				if err := execution.watch.tighten(execution.validityUntil.Add(-time.Microsecond)); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "withdrawn" {
				deny.Store(true)
				waitProbeWatch(t, execution.watch)
			}
			if request, err := execution.resultRequest(); err == nil || request != (proberesult.Request{}) {
				t.Fatal("dead authority still exported a report")
			}
			if execution.body != original {
				t.Fatal("invalidation rewrote measurement or expiry")
			}
			if execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt); err == nil || execution != nil {
				t.Fatal("report failure created another execution")
			}
		})
	}
}

func executionSerializationFixture(t *testing.T) (probeClaimReceipt, time.Time, probe.Result) {
	t.Helper()
	runner, binding, _ := probeTestRunner(t)
	executor, _ := probe.New(runner.resolveProbeTarget)
	gate, err := probe.NewGate(binding.NodeID, binding.BootID, binding.SessionEpoch, executor)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(gate.Close)
	now := time.Now()
	server := now.UTC().Truncate(time.Millisecond).Add(-400 * time.Millisecond)
	stamp := func(at time.Time) string { return at.Format("2006-01-02T15:04:05.000Z") }
	receipt := probeClaimReceipt{permitID: "permit-a", binding: binding, timeout: time.Second, until: now.Add(750 * time.Millisecond),
		serverAt: server, requestedAt: now.Add(-110 * time.Millisecond), receivedAt: now.Add(-100 * time.Millisecond), issuedAt: stamp(server.Add(-100 * time.Millisecond)),
		expiresAt: stamp(server.Add(1900 * time.Millisecond)), consumedAt: stamp(server),
		session: &registeredProbe{gate: gate, node: binding.NodeID, boot: binding.BootID, epoch: binding.SessionEpoch, generation: 1}}
	result := probe.Result{Binding: binding, Point: "agent-direct-egress", Status: "connected", Code: "tcp-connected",
		ApplicationHealth: "unknown", IndependentProbe: true, MeasuredAt: now.Add(-20*time.Millisecond + 250*time.Microsecond),
		ValidUntil: now.Add(500*time.Millisecond + 999*time.Microsecond), Elapsed: 5500 * time.Microsecond}
	return receipt, now.Add(-50 * time.Millisecond), result
}

func TestProbeExecutionSerializationConservativeClockMappingRoundingAndBounds(t *testing.T) {
	receipt, started, result := executionSerializationFixture(t)
	body, until, err := probeResultRequest(receipt, started, receipt.until, result)
	if err != nil {
		t.Fatal(err)
	}
	measured, _ := time.Parse(time.RFC3339Nano, body.MeasuredAt)
	valid, _ := time.Parse(time.RFC3339Nano, body.ValidUntil)
	if !measured.Equal(receipt.serverAt.Add(80*time.Millisecond)) || !valid.Equal(receipt.serverAt.Add(600*time.Millisecond)) ||
		!until.Equal(result.ValidUntil.Add(-11*time.Millisecond-999*time.Microsecond)) || body.ElapsedMs != 6 || body.ApplicationPayloadBytes != 0 ||
		body.Source != "agent-reported" {
		t.Fatal("clock mapping, flooring, or elapsed rounding differs")
	}
	// Mapping must not hide a local measurement from the future.
	shift := 12 * time.Hour
	receipt.requestedAt, receipt.receivedAt, receipt.until = receipt.requestedAt.Add(shift), receipt.receivedAt.Add(shift), receipt.until.Add(shift)
	result.MeasuredAt, result.ValidUntil = result.MeasuredAt.Add(shift), result.ValidUntil.Add(shift)
	if _, _, err := probeResultRequest(receipt, started.Add(shift), receipt.until, result); err == nil {
		t.Fatal("future local measurement was hidden by mapping")
	}
	// Network failure remains an observation, not health or raw network text.
	receipt, started, result = executionSerializationFixture(t)
	result.Status, result.Code = "unreachable", "tcp-connect-failed"
	if body, _, err := probeResultRequest(receipt, started, receipt.until, result); err != nil || body.Status != "unreachable" || body.ApplicationHealth != "unknown" {
		t.Fatal("valid failed connect cannot serialize")
	}
}

func TestProbeExecutionSerializationRejectsUncertainAlteredAndExpiredEvidence(t *testing.T) {
	changes := map[string]func(*probeClaimReceipt, *time.Time, *probe.Result){
		"session":                func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.session = nil },
		"missing-anchor":         func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.receivedAt = time.Time{} },
		"missing-request-anchor": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.requestedAt = time.Time{} },
		"inverted-exchange": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) {
			r.requestedAt = r.receivedAt.Add(time.Millisecond)
		},
		"no-report-window": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) {
			r.requestedAt = r.requestedAt.Add(-time.Second)
		},
		"missing-server": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.serverAt = time.Time{} },
		"server-before-consume": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) {
			r.serverAt = r.serverAt.Add(-time.Millisecond)
		},
		"server-after-expiry": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) {
			r.serverAt = r.serverAt.Add(2 * time.Second)
		},
		"anchor-after-start": func(r *probeClaimReceipt, at *time.Time, _ *probe.Result) { r.receivedAt = at.Add(time.Millisecond) },
		"binding":            func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Binding.BindingFence++ },
		"point":              func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Point = "relay" },
		"dependent":          func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.IndependentProbe = false },
		"health":             func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.ApplicationHealth = "healthy" },
		"status":             func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Status = "timeout" },
		"code":               func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Code = "arbitrary error" },
		"pair":               func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Code = "tcp-connect-failed" },
		"future":             func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.MeasuredAt = time.Now().Add(time.Second) },
		"before-start":       func(_ *probeClaimReceipt, at *time.Time, v *probe.Result) { v.MeasuredAt = at.Add(-time.Millisecond) },
		"before-consume": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) {
			r.consumedAt = r.serverAt.Add(90 * time.Millisecond).Format("2006-01-02T15:04:05.000Z")
		},
		"negative-elapsed": func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Elapsed = -1 },
		"over-timeout":     func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Elapsed = 2 * time.Second },
		"elapsed-history":  func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.Elapsed = 100 * time.Millisecond },
		"expiry":           func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.until = time.Now().Add(-time.Second) },
		"extended": func(r *probeClaimReceipt, _ *time.Time, v *probe.Result) {
			v.ValidUntil = r.until.Add(time.Millisecond)
		},
		"zero-window":        func(_ *probeClaimReceipt, _ *time.Time, v *probe.Result) { v.ValidUntil = v.MeasuredAt },
		"noninteger-timeout": func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.timeout += time.Microsecond },
		"oversized-timeout":  func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.timeout = 3 * time.Second },
		"under-timeout":      func(r *probeClaimReceipt, _ *time.Time, _ *probe.Result) { r.timeout = time.Millisecond },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			receipt, started, result := executionSerializationFixture(t)
			change(&receipt, &started, &result)
			if body, _, err := probeResultRequest(receipt, started, receipt.until, result); err == nil || body != (proberesult.Request{}) {
				t.Fatal("invalid evidence was clamped or serialized")
			}
		})
	}
}

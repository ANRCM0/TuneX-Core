package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"net"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/controlchannel"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/payloadstats"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

var _ func(string, []byte, string, uint64, []string, nativeexecution.OfflineTransitCertificate, *nativeexecution.OfflineTransitRoots, func() error, func(adp3transit.Assignment) error) (*TransitController, error) = NewTransitController
var _ executionhost.PreparedInstance = (*transitConstructionPrepared)(nil)

type transitConstructionPrepared struct{ activated, closed int }

func (e *transitConstructionPrepared) Activate() error { e.activated++; return nil }
func (e *transitConstructionPrepared) Close()          { e.closed++ }

func TestNativeConstructionCompleteURLLiteralPrefixAndEffectPrecedence(t *testing.T) {
	for _, v := range []struct {
		raw   string
		valid bool
	}{
		{"", false}, {"HTTPS://control.invalid", false}, {"http://control.invalid", false}, {" https://control.invalid", false}, {"https:/control.invalid", false}, {"https://", true}, {"https://%", true}, {"https://user:pass@host/path?query#fragment", true}, {"https:// host\n", true}, {"https://host///", true},
	} {
		t.Run(fmt.Sprintf("%q", v.raw), func(t *testing.T) {
			err := controlchannel.ValidateControlURL(v.raw)
			if (err == nil) != v.valid || err != nil && err.Error() != "HTTPS Control URL required" {
				t.Fatal("literal prefix normalization/error changed", err)
			}
			b, providers, effects, local := bootstrapOwnerCompleteFixture()
			b.options.URL = v.raw
			b.fail = "proof"
			runner, err := NewWithLocalServices(b.options, providers, effects, local)
			if runner != nil {
				t.Fatal("failure constructed Runner")
			}
			if v.valid {
				if err != b.failure || !reflect.DeepEqual(b.trace, []string{"proof"}) {
					t.Fatal("accepted literal did not reach original first effect", err, b.trace)
				}
			} else if err == nil || err.Error() != "HTTPS Control URL required" || len(b.trace) != 0 {
				t.Fatal("URL refusal reached Bootstrap", err, b.trace)
			}
			b.options.ProbeEcho = true
			b.trace = nil
			if _, err = NewWithLocalServices(b.options, providers, effects, local); err == nil || err.Error() != "INVALID_CONFIG: Echo Probe requires explicit services, ingress, execution and registration" || len(b.trace) != 0 {
				t.Fatal("feature gate no longer precedes URL", err, b.trace)
			}
		})
	}
	for _, v := range []struct {
		n    uint64
		text string
	}{{0, "0"}, {1, "1"}, {^uint64(0), "18446744073709551615"}} {
		if got := controlchannel.RuntimeSnapshotPath(v.n); got != "/agent/v3/snapshot?sinceGeneration="+v.text {
			t.Fatal("snapshot uint64 decimal changed", got)
		}
	}
	for _, v := range []struct {
		status     int
		code, want string
	}{{0, "", "Control HTTP 0: "}, {403, "DENIED", "Control HTTP 403: DENIED"}} {
		native := executionchannel.HTTPError{Status: v.status, Code: v.code}
		legacy := httpError{status: v.status, code: v.code}
		// Native text is authoritative; independent formatting checked below against
		// its original public contract rather than imposing a different message.
		if legacy.Error() != native.Error() || legacy.Error() != v.want {
			t.Fatal("legacy HTTP text diverged")
		}
		var found httpError
		if !errors.As(fmt.Errorf("wrapped: %w", legacy), &found) || found != legacy {
			t.Fatal("legacy errors.As/value identity changed")
		}
	}
}

func TestNativeConstructionCompletePhysicalAndDrainKeysHaveNoNormalization(t *testing.T) {
	for _, p := range []string{"tcp", "udp", "", "opaque/a", "TCP", "a%2Fb"} {
		for _, v := range []struct {
			n    uint64
			text string
		}{{0, "0"}, {^uint64(0), "18446744073709551615"}} {
			if state.PhysicalSlotKey(p, v.n) != p+"/"+v.text || state.TransitSlotKey(v.n) != "tcp/"+v.text {
				t.Fatal("physical/literal TCP slot normalized", p, v.n)
			}
			for _, id := range []string{"", "assignment", "a/b", "id%2F", "节点"} {
				for _, f := range []struct {
					n    uint64
					text string
				}{{0, "0"}, {^uint64(0), "18446744073709551615"}} {
					if got := nativeexecution.RunnerDrainKey(id, v.n, f.n); got != id+"/"+v.text+"/"+f.text {
						t.Fatal("drain tuple escaped/clamped", got)
					}
				}
			}
		}
	}
}

func TestNativeConstructionCompleteTransitPrerequisiteLoadAuthAndCopies(t *testing.T) {
	capabilities := []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"}
	roots := x509.NewCertPool()
	certificate := tls.Certificate{Certificate: [][]byte{{1, 2, 3}}, Leaf: &x509.Certificate{Raw: []byte{4}}}
	failure := errors.New("original constructor authorization failure")
	authCalls, reserveCalls := 0, 0
	authorize := func() error { authCalls++; return failure }
	reserve := func(adp3transit.Assignment) error { reserveCalls++; return nil }
	first := "AUTHORIZATION_DENIED: Live Transit authorizer, peer identity, Node epoch and resource guard required"
	for _, missing := range []string{"all", "authorizer", "reservation", "roots", "certificate", "epoch"} {
		a, r, cert, pool, epoch := authorize, reserve, certificate, roots, uint64(8)
		switch missing {
		case "all":
			a = nil
			r = nil
			cert = tls.Certificate{}
			pool = nil
			epoch = 0
		case "authorizer":
			a = nil
		case "reservation":
			r = nil
		case "roots":
			pool = nil
		case "certificate":
			cert = tls.Certificate{}
		case "epoch":
			epoch = 0
		}
		c, err := NewTransitController("missing-journal", nil, "node", epoch, nil, cert, pool, a, r)
		if c != nil || err == nil || err.Error() != first || authCalls != 0 || reserveCalls != 0 {
			t.Fatal("missing prerequisites lost priority over capabilities/load/auth", missing, err)
		}
	}
	if c, err := NewTransitController("missing-journal", nil, "node", 8, nil, certificate, roots, authorize, reserve); c != nil || err == nil || err.Error() == first || authCalls != 0 {
		t.Fatal("capabilities must precede load/auth", err)
	}
	key := bytes.Repeat([]byte{19}, 32)
	path := filepath.Join(t.TempDir(), "transit.json")
	if c, err := NewTransitController(path, key, "node", 8, capabilities, certificate, roots, authorize, reserve); c != nil || err == nil || err == failure || authCalls != 0 {
		t.Fatal("load must precede authorization", err)
	}
	if err := state.InitializeTransitJournal(path, key, "node"); err != nil {
		t.Fatal(err)
	}
	if c, err := NewTransitController(path, key, "node", 8, capabilities, certificate, roots, authorize, reserve); c != nil || err != failure || authCalls != 1 || reserveCalls != 0 {
		t.Fatal("authorization failure identity/stage", err)
	}
	authorize = func() error { authCalls++; return nil }
	c, err := NewTransitController(path, key, "node", 8, capabilities, certificate, roots, authorize, reserve)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	if authCalls != 2 || reserveCalls != 0 || c.path != path || c.node != "node" || c.epoch != 8 || c.now == nil || c.engines == nil || len(c.engines) != 0 || c.journal.Generation != 0 {
		t.Fatal("constructor state/effects changed")
	}
	if c.identity.Certificate.Leaf != certificate.Leaf || &c.identity.Certificate.Certificate[0][0] != &certificate.Certificate[0][0] || c.identity.Roots == roots || !c.identity.Roots.Equal(roots) {
		t.Fatal("original certificate alias/root clone changed")
	}
	key[0]++
	capabilities[0] = "caller-mutated"
	roots.AddCert(&x509.Certificate{Raw: []byte{1}, RawSubject: []byte{1}})
	if c.key[0] != 19 || c.capabilities[0] != "adp.multihop.1" || c.identity.Roots.Equal(roots) {
		t.Fatal("key/capabilities/roots no longer detached")
	}
	e := &transitConstructionPrepared{}
	c.engines["partial"] = e
	c.Close()
	c.Close()
	if e.closed != 1 || e.activated != 0 {
		t.Fatal("prepared lifecycle added Activate/repeated Close")
	}
	if executionhost.PreparedInstanceVersion != 1 || nativeDirectDriver().descriptor.hostInterfaceVersion != 1 {
		t.Fatal("prepared or driver host version changed")
	}
	// NewTransitController captures the native Now method, never calls it. This
	// asserts the actual constructor body; no production clock hook is introduced.
	source, err := parser.ParseFile(token.NewFileSet(), "transit_runner.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, decl := range source.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "NewTransitController" {
			continue
		}
		found = true
		ast.Inspect(fn.Body, func(n ast.Node) bool {
			if call, ok := n.(*ast.CallExpr); ok {
				if selector, ok := call.Fun.(*ast.SelectorExpr); ok && selector.Sel.Name == "Now" {
					t.Fatal("constructor sampled Now")
				}
			}
			return true
		})
	}
	if !found {
		t.Fatal("constructor declaration missing")
	}

}

func TestNativeConstructionCompleteAckRetainsTicketsTailsAndRetryMaps(t *testing.T) {
	for _, mode := range []string{"lost", "stale", "removed"} {
		t.Run(mode, func(t *testing.T) {
			r, _, clock, trace := newTimeOwnerRunner()
			guardRunner, _, _ := probeTestRunner(t)
			r.guard = guardRunner.guard
			r.ticket = guardRunner.ticket
			r.options.ForwardTelemetry = true
			r.sequence = 7
			a := runnerOwnerAssignment(t, 4)
			a.AssignmentId = "removed"
			a.BindingFence = 5
			stream := &forwardFinalStream{runner: r, locked: true, available: true, values: payloadstats.Snapshot{Epoch: "original-counter-epoch", PayloadSentBytes: 17}}
			instance := running{assignment: a, stream: stream, ticket: r.ticket}
			key := nativeexecution.RunnerDrainKey("removed", 4, 5)
			otherKey := nativeexecution.RunnerDrainKey("retained", 4, 5)
			r.drains = map[string]draining{key: {instance: instance}, otherKey: {instance: instance}}
			drainAlias := r.drains
			r.instances = map[string]running{"tcp/23456": instance}
			instanceAlias := r.instances
			raw, err := nativeexecution.EncodeRunnerReportAt("node", "boot", 2, 7, clock.now, 1, nil, []adp3.Drain{{AssignmentId: "removed", DeploymentGeneration: 4, BindingFence: 5, Condition: "removed"}})
			if err != nil {
				t.Fatal(err)
			}
			r.pending = raw
			failure := errors.New("lost ACK")
			ack := adp3.ReportAck{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ReportSequence: 7, Status: "accepted"}
			if mode == "stale" {
				ack.ReportSequence = 6
			}
			r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
				if method != "POST" || path != "/agent/v3/report" || !bytes.Equal(body, r.pending) || !epoch || session != 2 {
					t.Fatal("original retry request changed")
				}
				if mode == "lost" {
					return nil, failure
				}
				return json.Marshal(ack)
			}}
			err = r.report(context.Background())
			if r.ticket != instance.ticket || r.instances["tcp/23456"].ticket != instance.ticket || r.drains[otherKey].instance.ticket != instance.ticket || len(instanceAlias) != 1 || len(r.instances) != 1 {
				t.Fatal("ACK replaced live/retained authority or map")
			}
			if mode == "removed" {
				if err != nil || len(r.pending) != 0 || len(drainAlias) != 1 || len(r.forwardCounterTails) != 1 || stream.reads != 1 || clock.calls != 1 {
					t.Fatal("accepted removed ACK failed original tail/delete stage", err)
				}
				tail := r.forwardCounterTails[0]
				if tail.counters != stream.values || !tail.available || tail.identity.AssignmentID != "removed" || tail.identity.BindingFence != 5 {
					t.Fatal("ACK retained wrong terminal counters")
				}
				// A duplicate response after pending consumption cannot retain another tail.
				if err := r.report(context.Background()); err != nil || len(r.forwardCounterTails) != 1 || len(r.drains) != 1 || stream.reads != 1 {
					t.Fatal("empty pending duplicate changed tail/map", err)
				}
			} else {
				if err == nil || !bytes.Equal(r.pending, raw) || len(drainAlias) != 2 || len(r.forwardCounterTails) != 0 || stream.reads != 0 || clock.calls != 0 {
					t.Fatal("lost/stale ACK mutated pending/drain/tail", err)
				}
				if mode == "lost" && err != failure {
					t.Fatal("lost ACK error identity changed")
				}
			}
		})
	}
}

func TestNativeConstructionCompleteDirectProjectionRefusalAndNumericEndpointMatrix(t *testing.T) {
	r, binding, _ := probeTestRunner(t)
	a := r.instances["tcp/22001"].assignment
	got, err := nativeexecution.DirectProbeDestination(a, "tcp", binding.ConfigDigest, 1)
	if err != nil || got.Host != "127.0.0.1" || got.Port != 80 || !reflect.DeepEqual(got.AllowedDestinationCIDRs, []string{"127.0.0.0/8"}) {
		t.Fatal("native projection baseline", got, err)
	}
	for _, mutate := range []func(*adp3.Assignment){func(a *adp3.Assignment) { a.Phase = "prepared" }, func(a *adp3.Assignment) { a.Protocol = "udp" }, func(a *adp3.Assignment) { a.Resource.Protocol = "udp" }, func(a *adp3.Assignment) { a.Driver.SchemaVersion = 2 }, func(a *adp3.Assignment) { a.Driver.Id = "other" }, func(a *adp3.Assignment) { a.Driver.Config.Target = &adp3.Target{Host: "127.0.0.1", Port: 0} }, func(a *adp3.Assignment) { a.Driver.Config.Target = &adp3.Target{Host: "127.0.0.1", Port: 65536} }} {
		bad := a
		mutate(&bad)
		if _, err := nativeexecution.DirectProbeDestination(bad, "tcp", binding.ConfigDigest, 1); err == nil || err.Error() != "AUTHORIZATION_DENIED: Native Probe configuration unavailable" {
			t.Fatal("native projection denial identity changed", err)
		}
	}
	if _, err := nativeexecution.DirectProbeDestination(a, "tcp", binding.ConfigDigest, 2); err == nil {
		t.Fatal("policy revision bypassed")
	}
	for _, mutate := range []func(*Runner){func(r *Runner) { v := r.instances["tcp/22001"]; v.ticket = nil; r.instances["tcp/22001"] = v }, func(r *Runner) { r.instances["duplicate"] = r.instances["tcp/22001"] }} {
		runner, b, _ := probeTestRunner(t)
		mutate(runner)
		if _, err := runner.resolveProbeTarget(context.Background(), b); err != probe.ErrDenied {
			t.Fatal("duplicate or nil instance Ticket reached native projection", err)
		}
	}
	for _, v := range []struct {
		configured, observed string
		port                 uint64
		valid                bool
		host                 string
	}{
		{"127.0.0.1", "127.0.0.1", 1, true, "127.0.0.1"}, {"::ffff:127.0.0.1", "127.0.0.1", 65535, true, "127.0.0.1"}, {"127.0.0.1", "127.0.0.2", 80, false, ""}, {"0.0.0.0", "0.0.0.0", 80, false, ""}, {"::", "::", 80, false, ""}, {"224.0.0.1", "224.0.0.1", 80, false, ""}, {"fe80::1%eth0", "fe80::1%eth0", 80, false, ""}, {"169.254.169.254", "169.254.169.254", 80, false, ""}, {"100.100.100.200", "100.100.100.200", 80, false, ""}, {"fd00:ec2::254", "fd00:ec2::254", 80, false, ""}, {"example.test", "example.test", 80, false, ""}, {"127.0.0.1", "127.0.0.1", 0, false, ""}, {"127.0.0.1", "127.0.0.1", 65536, false, ""},
	} {
		host, port, valid := nativeexecution.ProbeIngressEndpoint(v.configured, v.port, v.observed, v.port, []string{"0.0.0.0/0", "::/0"})
		if valid != v.valid || valid && (host != v.host || port != int(v.port)) {
			t.Fatal("native observed endpoint rule changed", v, host, port, valid)
		}
	}
	if _, _, valid := nativeexecution.ProbeIngressEndpoint("127.0.0.1", 80, "127.0.0.1", 81, []string{"127.0.0.0/8"}); valid {
		t.Fatal("port mismatch fallback")
	}
	if _, _, valid := nativeexecution.ProbeIngressEndpoint("127.0.0.1", 80, "127.0.0.1", 80, []string{"192.0.2.0/24"}); valid {
		t.Fatal("ingress policy fallback")
	}
	for _, v := range []struct {
		host, service string
		port          int
		servicePort   uint64
		valid         bool
	}{{"127.0.0.1", "127.0.0.1", 80, 80, true}, {"127.0.0.1", "127.0.0.2", 80, 80, false}, {"127.0.0.1", "127.0.0.1", 80, 81, false}, {"::ffff:127.0.0.1", "::ffff:127.0.0.1", 80, 80, false}, {"169.254.169.254", "169.254.169.254", 80, 80, false}, {"example.test", "example.test", 80, 80, false}} {
		if nativeexecution.ProbeServiceDestinationAllowed(v.host, v.port, []string{"0.0.0.0/0", "::/0"}, v.service, v.servicePort) != v.valid {
			t.Fatal("service replaced native business endpoint", v)
		}
	}
}

type nativeConstructionClock struct {
	platformruntime.Schedule
	mu        sync.Mutex
	deadlines []time.Time
	events    []string
	started   chan struct{}
	stopped   bool
}

func (c *nativeConstructionClock) Now() time.Time {
	c.mu.Lock()
	c.events = append(c.events, "now")
	c.mu.Unlock()
	return time.Now()
}
func (c *nativeConstructionClock) WithDeadline(parent context.Context, deadline time.Time) (context.Context, context.CancelFunc) {
	c.mu.Lock()
	c.deadlines = append(c.deadlines, deadline)
	index := len(c.deadlines)
	c.events = append(c.events, fmt.Sprint("deadline", index))
	c.mu.Unlock()
	ctx, cancel := context.WithDeadline(parent, deadline)
	return ctx, func() { c.mu.Lock(); c.events = append(c.events, fmt.Sprint("cancel", index)); c.mu.Unlock(); cancel() }
}
func (c *nativeConstructionClock) NewTicker(interval time.Duration) runtimeplatform.Ticker {
	if interval != 25*time.Millisecond {
		panic("Probe watch interval changed")
	}
	close(c.started)
	return nativeConstructionTicker{clock: c, ch: make(chan time.Time)}
}

type nativeConstructionTicker struct {
	clock *nativeConstructionClock
	ch    chan time.Time
}

func (t nativeConstructionTicker) C() <-chan time.Time { return t.ch }
func (t nativeConstructionTicker) Stop() {
	t.clock.mu.Lock()
	t.clock.stopped = true
	t.clock.events = append(t.clock.events, "ticker-stop")
	t.clock.mu.Unlock()
}

type nativeConstructionEntropy struct {
	size, calls int
	failure     error
}

func (e *nativeConstructionEntropy) ReadRandom(p []byte) (int, error) {
	e.calls++
	e.size = len(p)
	for i := range p {
		p[i] = 0x31
	}
	return len(p), e.failure
}

type nativeConstructionDial struct {
	clock      *nativeConstructionClock
	calls      int
	deadline   time.Time
	connection *nativeConstructionConnection
}

func (d *nativeConstructionDial) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	d.calls++
	if network != "tcp" || address != "127.0.0.1:80" {
		panic("native Probe network/address changed")
	}
	d.deadline, _ = ctx.Deadline()
	select {
	case <-d.clock.started:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return d.connection, nil
}

type nativeConstructionConnection struct {
	net.Conn
	closed int
}

func (c *nativeConstructionConnection) Close() error { c.closed++; return nil }

func TestNativeConstructionCompleteExplicitProbeDeadlineWatchDeferAndEntropy(t *testing.T) {
	for _, timeout := range []time.Duration{100 * time.Millisecond, 2 * time.Second} {
		r, b, _ := probeTestRunner(t)
		b.NodeID = fmt.Sprint("construction-bound-", timeout)
		target, err := r.resolveProbeTarget(context.Background(), func() probe.Binding { x := b; x.NodeID = "node-a"; return x }())
		if err != nil {
			t.Fatal(err)
		}
		target.Binding = b
		clock := &nativeConstructionClock{started: make(chan struct{})}
		entropy := &nativeConstructionEntropy{}
		connection := &nativeConstructionConnection{}
		dial := &nativeConstructionDial{clock: clock, connection: connection}
		executor, err := probe.NewWithEffects(func(context.Context, probe.Binding) (probe.Target, error) { return target, nil }, probe.Effects{Schedule: clock, Entropy: entropy, Dial: dial})
		if err != nil {
			t.Fatal(err)
		}
		until := time.Now().Add(1900 * time.Millisecond)
		target.ExecutionUntil = until
		permit := probe.Permit{Binding: b, Until: until, Check: func() error { return nil }}
		result, err := executor.Run(context.Background(), permit, timeout)
		if err != nil || result.Binding != b || dial.calls != 1 || connection.closed != 1 || !clock.stopped || entropy.calls != 0 {
			t.Fatal("explicit Probe effects/result/cleanup changed", err)
		}
		if len(clock.deadlines) != 2 || clock.deadlines[1] != until || dial.deadline.After(clock.deadlines[0]) || dial.deadline.After(until) {
			t.Fatal("original two deadline projections changed", clock.deadlines, dial.deadline)
		}
		events := clock.events
		tail := []string{"ticker-stop", "now", "cancel2", "cancel1"}
		if len(events) < 4 || !reflect.DeepEqual(events[len(events)-4:], tail) {
			t.Fatal("watch join/release/cancel defer order changed", events)
		}
		for _, invalid := range []time.Duration{100*time.Millisecond - time.Nanosecond, 2*time.Second + time.Nanosecond} {
			before := len(clock.events)
			if _, err := executor.Run(context.Background(), permit, invalid); err != probe.ErrInvalid || len(clock.events) != before || dial.calls != 1 {
				t.Fatal("timeout bounds did work before refusal", invalid, err)
			}
		}
		failure := errors.New("entropy failure")
		entropy.failure = failure
		if gate, err := probe.NewGate(b.NodeID, b.BootID, b.SessionEpoch, executor); gate != nil || err != probe.ErrDenied || entropy.calls != 1 || entropy.size != 32 {
			t.Fatal("Gate random failure/32-byte read changed", err)
		}
		entropy.failure = nil
		gate, err := probe.NewGate(b.NodeID, b.BootID, b.SessionEpoch, executor)
		if err != nil || len(gate.InstanceID()) != 64 || gate.InstanceID() != strings.Repeat("31", 32) || entropy.calls != 2 {
			t.Fatal("Gate random instance identity changed", err)
		}
		gate.Close()
	}
}

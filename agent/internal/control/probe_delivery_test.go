package control

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probedelivery"
)

type probeDeliveryFixture struct {
	runner  *Runner
	binding probe.Binding
	receipt *probeClaimReceipt
	calls   atomic.Int32
	mutex   sync.Mutex
	ids     map[string]bool
}

func wireDeliveryBinding(b probe.Binding) probedelivery.Binding {
	return probedelivery.Binding{NodeId: b.NodeID, BootId: b.BootID, SessionEpoch: b.SessionEpoch,
		SnapshotGeneration: b.SnapshotGeneration, AssignmentId: b.AssignmentID, ForwardId: b.ForwardID, ForwardRevision: b.ForwardRevision,
		DeploymentGeneration: b.DeploymentGeneration, BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision}
}
func deliveryFixture(t *testing.T, claim bool,
	change func(int, *probedelivery.PollResponse, *probedelivery.StatusResponse, http.ResponseWriter, *http.Request) bool) *probeDeliveryFixture {
	t.Helper()
	runner, binding, _ := probeClaimFixture(t, nil)
	f := &probeDeliveryFixture{runner: runner, binding: binding, ids: make(map[string]bool)}
	if claim {
		var err error
		f.receipt, err = runner.claimProbe(context.Background(), "permit-a", binding)
		if err != nil {
			t.Fatal(err)
		}
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := int(f.calls.Add(1))
		if r.Method != "POST" || r.Header.Get("X-TuneX-Session-Epoch") != "2" {
			t.Error("incorrect delivery request")
		}
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
		stamp := func(at time.Time) string { return at.UTC().Format("2006-01-02T15:04:05.000Z") }
		now := time.Now()
		var poll *probedelivery.PollResponse
		var status *probedelivery.StatusResponse
		var id string
		if r.URL.Path == "/agent/v3/probe/poll" {
			req, err := probedelivery.ParsePollRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			id = req.RequestId
			poll = &probedelivery.PollResponse{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-poll-ack", NodeId: req.NodeId,
				BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId, InstanceGeneration: req.InstanceGeneration,
				RequestId: req.RequestId, ObservedAt: stamp(now), ServerTime: stamp(now), Offer: &probedelivery.Offer{PermitId: "permit-a",
					Binding: wireDeliveryBinding(binding), TimeoutMs: 1000, IssuedAt: stamp(now.Add(-100 * time.Millisecond)), ExpiresAt: stamp(now.Add(1900 * time.Millisecond))}}
		} else if r.URL.Path == "/agent/v3/probe/status" && f.receipt != nil {
			req, err := probedelivery.ParseStatusRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			id = req.RequestId
			status = &probedelivery.StatusResponse{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-status-ack", NodeId: req.NodeId,
				BootId: req.BootId, SessionEpoch: req.SessionEpoch, InstanceId: req.InstanceId, InstanceGeneration: req.InstanceGeneration,
				RequestId: req.RequestId, PermitId: req.PermitId, Binding: wireDeliveryBinding(binding), TimeoutMs: 1000,
				IssuedAt: f.receipt.issuedAt, ExpiresAt: f.receipt.expiresAt, ConsumedAt: f.receipt.consumedAt,
				CheckedAt: stamp(now), ServerTime: stamp(now), State: "consumed"}
		} else {
			t.Error("incorrect delivery route")
			w.WriteHeader(404)
			return
		}
		f.mutex.Lock()
		if f.ids[id] {
			t.Error("request correlation ID reused")
		}
		f.ids[id] = true
		f.mutex.Unlock()
		if change != nil && change(n, poll, status, w, r) {
			return
		}
		if poll != nil {
			_ = json.NewEncoder(w).Encode(poll)
		} else {
			_ = json.NewEncoder(w).Encode(status)
		}
	}))
	runner.mutex.Lock()
	runner.options.URL, runner.client = server.URL, server.Client()
	runner.mutex.Unlock()
	t.Cleanup(func() {
		runner.stop()
		server.Close()
		// Each sequential test owns node-a. Clear only completed poll cooldown, not an active reservation.
		ticker := time.NewTicker(time.Millisecond)
		defer ticker.Stop()
		deadline := time.NewTimer(3 * time.Second)
		defer deadline.Stop()
		for {
			probeDeliveries.mutex.Lock()
			active := probeDeliveries.nodes["node-a"].active
			probeDeliveries.mutex.Unlock()
			if !active {
				break
			}
			select {
			case <-ticker.C:
			case <-deadline.C:
				t.Error("delivery reservation did not drain")
				return
			}
		}
		probeDeliveries.mutex.Lock()
		defer probeDeliveries.mutex.Unlock()
		if probeDeliveries.nodes["node-a"].active {
			t.Error("delivery reservation leaked")
		} else {
			delete(probeDeliveries.nodes, "node-a")
		}
	})
	return f
}
func waitProbeWatch(t *testing.T, watch *probeAuthorityWatch) {
	t.Helper()
	select {
	case <-watch.done:
	case <-time.After(3 * time.Second):
		t.Fatal("watch did not terminate")
	}
	if watch.Check() == nil {
		t.Fatal("closed watch remained usable")
	}
}

func TestProbeDeliveryPollBoundedEmptyAndCurrentOffers(t *testing.T) {
	for _, empty := range []bool{false, true} {
		t.Run(map[bool]string{false: "one", true: "empty"}[empty], func(t *testing.T) {
			f := deliveryFixture(t, false, func(_ int, p *probedelivery.PollResponse, _ *probedelivery.StatusResponse, _ http.ResponseWriter, _ *http.Request) bool {
				if empty {
					p.Offer = nil
				}
				return false
			})
			before := f.runner.journal
			offer, err := f.runner.pollProbe(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			if empty {
				if offer != nil {
					t.Fatal("empty became offer")
				}
			} else if offer == nil || offer.binding != f.binding || offer.permitID != "permit-a" || offer.timeout != time.Second || !time.Now().Before(offer.until) {
				t.Fatal("incorrect offer")
			}
			if !reflect.DeepEqual(before, f.runner.journal) || len(f.runner.instances) != 1 || len(f.runner.drains) != 0 {
				t.Fatal("poll changed execution")
			}
			if _, err = f.runner.pollProbe(context.Background()); !errors.Is(err, probe.ErrBusy) || f.calls.Load() != 1 {
				t.Fatal("poll cooldown reset")
			}
		})
	}
}
func TestProbeDeliveryPollRejectsForeignStaleAndBurnedOffers(t *testing.T) {
	for _, name := range []string{"request", "instance", "generation", "binding", "clock", "age", "enabled", "burned", "local"} {
		t.Run(name, func(t *testing.T) {
			f := deliveryFixture(t, false, func(_ int, p *probedelivery.PollResponse, _ *probedelivery.StatusResponse, _ http.ResponseWriter, _ *http.Request) bool {
				switch name {
				case "request":
					p.RequestId = strings.Repeat("d", 64)
				case "instance":
					p.InstanceId = strings.Repeat("d", 64)
				case "generation":
					p.InstanceGeneration++
				case "binding":
					p.Offer.Binding.BindingFence++
				case "clock":
					p.ServerTime = "2026-01-01T00:00:00.000Z"
				case "age":
					at, _ := time.Parse(time.RFC3339Nano, p.ServerTime)
					p.ObservedAt = at.Add(-250 * time.Millisecond).Format("2006-01-02T15:04:05.000Z")
				case "enabled":
					p.ExecutionEnabled = true
				}
				return false
			})
			if name == "burned" {
				f.runner.mutex.Lock()
				f.runner.probeRegistration.claims = map[string]struct{}{"permit-a": {}}
				f.runner.mutex.Unlock()
			}
			if name == "local" {
				f.runner.mutex.Lock()
				f.runner.journal.Generation++
				f.runner.mutex.Unlock()
			}
			if offer, err := f.runner.pollProbe(context.Background()); err == nil || offer != nil {
				t.Fatal("unsafe offer accepted")
			}
		})
	}
}
func TestProbeDeliveryStatusMatchesReceiptAndCannotRestart(t *testing.T) {
	second := make(chan struct{})
	f := deliveryFixture(t, true, func(n int, _ *probedelivery.PollResponse, _ *probedelivery.StatusResponse, _ http.ResponseWriter, _ *http.Request) bool {
		if n == 2 {
			close(second)
		}
		return false
	})
	before := f.runner.journal
	watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt)
	if err != nil {
		t.Fatal(err)
	}
	defer watch.Close()
	if watch.Check() != nil {
		t.Fatal("initial successful observation unavailable")
	}
	select {
	case <-second:
	case <-time.After(time.Second):
		t.Fatal("no repeated observation")
	}
	watch.Close()
	if !reflect.DeepEqual(before, f.runner.journal) || len(f.runner.instances) != 1 || len(f.runner.drains) != 0 {
		t.Fatal("monitor changed execution")
	}
	if _, err = f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) {
		t.Fatal("monitor restarted")
	}
	if f.calls.Load() < 2 {
		t.Fatal("missing status exchanges")
	}
}
func TestProbeDeliveryStatusRejectsEveryChangedBindingAndOriginalReceiptField(t *testing.T) {
	changes := map[string]func(*probedelivery.StatusResponse){
		"node":       func(a *probedelivery.StatusResponse) { a.NodeId = "foreign"; a.Binding.NodeId = "foreign" },
		"boot":       func(a *probedelivery.StatusResponse) { a.BootId = "foreign"; a.Binding.BootId = "foreign" },
		"epoch":      func(a *probedelivery.StatusResponse) { a.SessionEpoch++; a.Binding.SessionEpoch++ },
		"snapshot":   func(a *probedelivery.StatusResponse) { a.Binding.SnapshotGeneration++ },
		"assignment": func(a *probedelivery.StatusResponse) { a.Binding.AssignmentId = "foreign" },
		"forward":    func(a *probedelivery.StatusResponse) { a.Binding.ForwardId = "foreign" },
		"revision":   func(a *probedelivery.StatusResponse) { a.Binding.ForwardRevision++ },
		"deployment": func(a *probedelivery.StatusResponse) { a.Binding.DeploymentGeneration++ },
		"fence":      func(a *probedelivery.StatusResponse) { a.Binding.BindingFence++ },
		"digest":     func(a *probedelivery.StatusResponse) { a.Binding.ConfigDigest = "sha256:" + strings.Repeat("f", 64) },
		"egress":     func(a *probedelivery.StatusResponse) { a.Binding.EgressPolicyRevision++ },
		"instance":   func(a *probedelivery.StatusResponse) { a.InstanceId = strings.Repeat("f", 64) },
		"generation": func(a *probedelivery.StatusResponse) { a.InstanceGeneration++ },
		"request":    func(a *probedelivery.StatusResponse) { a.RequestId = strings.Repeat("f", 64) },
		"permit":     func(a *probedelivery.StatusResponse) { a.PermitId = "foreign" },
		"issued": func(a *probedelivery.StatusResponse) {
			v, _ := time.Parse(time.RFC3339Nano, a.IssuedAt)
			a.IssuedAt = v.Add(time.Millisecond).Format("2006-01-02T15:04:05.000Z")
		},
		"expires": func(a *probedelivery.StatusResponse) {
			v, _ := time.Parse(time.RFC3339Nano, a.ExpiresAt)
			a.ExpiresAt = v.Add(-time.Millisecond).Format("2006-01-02T15:04:05.000Z")
		},
		"consumed": func(a *probedelivery.StatusResponse) {
			v, _ := time.Parse(time.RFC3339Nano, a.ConsumedAt)
			a.ConsumedAt = v.Add(-time.Millisecond).Format("2006-01-02T15:04:05.000Z")
		},
		"timeout": func(a *probedelivery.StatusResponse) { a.TimeoutMs = 1001 },
		"enabled": func(a *probedelivery.StatusResponse) { a.ExecutionEnabled = true },
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			f := deliveryFixture(t, true, func(_ int, _ *probedelivery.PollResponse, a *probedelivery.StatusResponse, _ http.ResponseWriter, _ *http.Request) bool {
				change(a)
				return false
			})
			if watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt); err == nil || watch != nil {
				t.Fatal("unsafe status accepted")
			}
			// An admitted start stays burned even when its first status is rejected.
			if _, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) || f.calls.Load() != 1 {
				t.Fatal("failed monitor retried")
			}
		})
	}
}
func TestProbeDeliveryWithdrawalStopsWithoutRetryOrResurrection(t *testing.T) {
	for _, mode := range []string{"denied", "lost", "duplicate", "oversize", "redirect", "timeout"} {
		t.Run(mode, func(t *testing.T) {
			f := deliveryFixture(t, true, func(n int, _ *probedelivery.PollResponse, _ *probedelivery.StatusResponse, w http.ResponseWriter, r *http.Request) bool {
				if n == 1 {
					return false
				}
				switch mode {
				case "denied":
					w.WriteHeader(409)
				case "lost":
					conn, _, err := w.(http.Hijacker).Hijack()
					if err == nil {
						_ = conn.Close()
					}
				case "duplicate":
					_, _ = io.WriteString(w, `{"kind":"probe-status-ack","kind":"probe-status-ack"}`)
				case "oversize":
					_, _ = io.WriteString(w, strings.Repeat(" ", 4097))
				case "redirect":
					w.Header().Set("Location", "/forbidden")
					w.WriteHeader(307)
				case "timeout":
					<-r.Context().Done()
				}
				return true
			})
			watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt)
			if err != nil {
				t.Fatal(err)
			}
			defer watch.Close()
			waitProbeWatch(t, watch)
			if f.calls.Load() != 2 {
				t.Fatal("failure retried or redirect followed")
			}
			if _, err = f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) {
				t.Fatal("failed work resurrected")
			}
		})
	}
}
func TestProbeDeliveryLocalRevocationAndCancellationCloseWatch(t *testing.T) {
	for _, mode := range []string{"snapshot", "session", "credential", "ticket", "instance", "parent", "close"} {
		t.Run(mode, func(t *testing.T) {
			f := deliveryFixture(t, true, nil)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			watch, err := f.runner.monitorConsumedProbe(ctx, f.receipt)
			if err != nil {
				t.Fatal(err)
			}
			defer watch.Close()
			f.runner.mutex.Lock()
			switch mode {
			case "snapshot":
				f.runner.journal.Generation++
			case "session":
				f.runner.hello.SessionEpoch++
			case "credential":
				f.runner.credentialFingerprint[0]++
			case "ticket":
				f.runner.ticket = nil
			case "instance":
				f.runner.closeProbeLocked()
			}
			f.runner.mutex.Unlock()
			if mode == "parent" {
				cancel()
			}
			if mode == "close" {
				watch.Close()
			}
			if watch.Check() == nil {
				t.Fatal("local revocation not observed synchronously")
			}
			if mode == "ticket" {
				f.runner.mutex.Lock()
				f.runner.ticket = f.runner.instances["tcp/22001"].ticket
				f.runner.mutex.Unlock()
				if watch.Check() == nil {
					t.Fatal("restored local authority revived closed watch")
				}
			}
			waitProbeWatch(t, watch)
		})
	}
}
func TestProbeDeliveryFreshnessAndImmutableDeadlineNeverRenewFromReceiptTime(t *testing.T) {
	f := deliveryFixture(t, true, nil)
	session := f.receipt.session
	started := time.Now().Add(-100 * time.Millisecond)
	server := time.Now().UTC().Truncate(time.Millisecond)
	stamp := func(v time.Time) string { return v.Format("2006-01-02T15:04:05.000Z") }
	until, err := probeFreshUntil(session, started, stamp(server.Add(-50*time.Millisecond)), stamp(server))
	if err != nil || !until.Equal(started.Add(200*time.Millisecond)) {
		t.Fatal("round-trip/server age not deducted")
	}
	if _, err = probeFreshUntil(session, time.Now().Add(-300*time.Millisecond), stamp(server), stamp(server)); err == nil {
		t.Fatal("late observation renewed")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	watch := &probeAuthorityWatch{ctx: ctx, cancel: cancel, changed: make(chan struct{}, 1), until: time.Now().Add(time.Second), freshUntil: time.Now().Add(time.Second)}
	if watch.current() == nil {
		t.Fatal("uninitialized monitor usable")
	}
	if err = watch.publish(time.Now().Add(200*time.Millisecond), server, server); err != nil {
		t.Fatal(err)
	}
	original := watch.until
	if err = watch.tighten(time.Now().Add(2 * time.Second)); err != nil || watch.until != original {
		t.Fatal("execution deadline extended")
	}
	if err = watch.publish(time.Now().Add(200*time.Millisecond), server.Add(-time.Millisecond), server); err == nil {
		t.Fatal("server observation time regressed")
	}
	watch.fail(probe.ErrDenied)
	if err = watch.publish(time.Now().Add(200*time.Millisecond), server.Add(time.Millisecond), server.Add(time.Millisecond)); err == nil || watch.current() == nil {
		t.Fatal("late reply revived watch")
	}
}
func TestProbeDeliveryBudgetBoundsAndPollCooldownSurviveRotation(t *testing.T) {
	budget := probeDeliveryBudget{nodes: make(map[string]probeDeliverySlot)}
	now := time.Now()
	releases := make([]func(), 0, 4)
	for _, node := range []string{"a", "b", "c", "d"} {
		release, err := budget.acquire(node, true, now)
		if err != nil {
			t.Fatal(err)
		}
		releases = append(releases, release)
	}
	if _, err := budget.acquire("e", false, now); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("global cap bypassed")
	}
	if _, err := budget.acquire("a", false, now); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("node overlap allowed")
	}
	releases[0]()
	releases[0]()
	if _, err := budget.acquire("a", true, now); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("rotation refunded cooldown")
	}
	release, err := budget.acquire("a", false, now)
	if err != nil {
		t.Fatal("consumed status blocked by discovery cooldown")
	}
	release()
	for _, release := range releases {
		release()
	}
	for i := 0; i < 128; i++ {
		node := strings.Repeat("x", i+1)
		release, err := budget.acquire(node, true, now.Add(2*time.Second))
		if err != nil {
			t.Fatal(err)
		}
		release()
	}
	if _, err := budget.acquire("new", true, now.Add(2*time.Second)); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("tracked cap bypassed")
	}
	release, err = budget.acquire("new", true, now.Add(4*time.Second))
	if err != nil {
		t.Fatal("expired cooldown not pruned")
	}
	release()
	t.Run("busy-start-cannot-retry", func(t *testing.T) {
		f := deliveryFixture(t, true, nil)
		release, err := probeDeliveries.acquire("node-a", false, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		defer release()
		if watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrBusy) || watch != nil {
			t.Fatal("busy monitor start was admitted")
		}
		release()
		if watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) || watch != nil {
			t.Fatal("resource admission failure refunded monitor start")
		}
		if f.calls.Load() != 0 {
			t.Fatal("busy or replayed monitor reached network")
		}
	})
}

type probeRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn probeRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestProbeDeliveryCancelledTransportRetainsSlotUntilDrainAndLateSuccessCannotRevive(t *testing.T) {
	f := deliveryFixture(t, true, nil)
	entered, cancelled, release := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	f.runner.mutex.Lock()
	client := *f.runner.client
	base := client.Transport
	var requests atomic.Int32
	client.Transport = probeRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		if requests.Add(1) == 1 {
			return base.RoundTrip(request)
		}
		close(entered)
		<-request.Context().Done()
		close(cancelled)
		<-release // Intentionally uncooperative transport: the admission must not be released early.
		stamp := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
		var input probedelivery.StatusRequest
		_ = json.NewDecoder(request.Body).Decode(&input)
		ack := probedelivery.StatusResponse{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-status-ack", NodeId: input.NodeId,
			BootId: input.BootId, SessionEpoch: input.SessionEpoch, InstanceId: input.InstanceId, InstanceGeneration: input.InstanceGeneration,
			RequestId: input.RequestId, PermitId: input.PermitId, Binding: wireDeliveryBinding(f.binding), TimeoutMs: 1000,
			IssuedAt: f.receipt.issuedAt, ExpiresAt: f.receipt.expiresAt, ConsumedAt: f.receipt.consumedAt, CheckedAt: stamp, ServerTime: stamp, State: "consumed"}
		raw, _ := json.Marshal(ack)
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(raw))), Header: make(http.Header)}, nil
	})
	f.runner.client = &client
	f.runner.mutex.Unlock()
	watch, err := f.runner.monitorConsumedProbe(context.Background(), f.receipt)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { unblock(); watch.Close() }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("second request missing")
	}
	watch.fail(probe.ErrDenied)
	select {
	case <-cancelled:
	case <-time.After(time.Second):
		t.Fatal("HTTP cancellation not propagated")
	}
	if watch.Check() == nil {
		t.Fatal("cancelled work still usable")
	}
	probeDeliveries.mutex.Lock()
	active := probeDeliveries.nodes["node-a"].active
	probeDeliveries.mutex.Unlock()
	if !active {
		t.Fatal("slot released before HTTP worker terminated")
	}
	select {
	case <-watch.done:
		t.Fatal("done closed while transport blocked")
	default:
	}
	if _, err = f.runner.pollProbe(context.Background()); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("new request overlapped cancelled worker")
	}
	unblock()
	waitProbeWatch(t, watch)
	if requests.Load() != 2 {
		t.Fatal("late success scheduled another status")
	}
	if _, err = f.runner.monitorConsumedProbe(context.Background(), f.receipt); !errors.Is(err, probe.ErrReplay) {
		t.Fatal("late reply enabled restart")
	}
}

func TestProbeDeliveryPreflightRejectsForgedReceiptAndInvalidLocalAuthorityWithoutIO(t *testing.T) {
	for _, mode := range []string{"nil", "copy", "ticket", "expired", "foreign-session", "cancelled-parent", "stopped", "skew"} {
		t.Run(mode, func(t *testing.T) {
			f := deliveryFixture(t, true, nil)
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
			case "ticket":
				f.runner.ticket = nil
			case "expired":
				receipt.until = time.Now().Add(-time.Second)
			case "foreign-session":
				receipt.session = nil
			case "cancelled-parent":
				cancel()
			case "stopped":
				f.runner.probeStopped = true
			case "skew":
				f.runner.hello.Policy.MaxClockSkewSeconds = 3
			}
			f.runner.mutex.Unlock()
			if watch, err := f.runner.monitorConsumedProbe(ctx, receipt); err == nil || watch != nil || f.calls.Load() != 0 {
				t.Fatal("invalid monitor reached network")
			}
		})
	}
}

func TestProbeDeliveryPollHTTPFailureAndCancellationNeverRetry(t *testing.T) {
	for _, mode := range []string{"redirect", "oversize", "denied", "cancelled", "timeout", "http", "local-after-reply"} {
		t.Run(mode, func(t *testing.T) {
			var f *probeDeliveryFixture
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			f = deliveryFixture(t, false, func(_ int, _ *probedelivery.PollResponse, _ *probedelivery.StatusResponse, w http.ResponseWriter, r *http.Request) bool {
				switch mode {
				case "redirect":
					w.Header().Set("Location", "/forbidden")
					w.WriteHeader(307)
				case "oversize":
					_, _ = io.WriteString(w, strings.Repeat(" ", 4097))
				case "denied":
					w.WriteHeader(409)
				case "cancelled":
					cancel()
				case "timeout":
					<-r.Context().Done()
				case "local-after-reply":
					f.runner.mutex.Lock()
					f.runner.journal.Generation++
					f.runner.mutex.Unlock()
					return false
				}
				return true
			})
			if mode == "http" {
				f.runner.options.URL = strings.Replace(f.runner.options.URL, "https:", "http:", 1)
			}
			if offer, err := f.runner.pollProbe(ctx); err == nil || offer != nil {
				t.Fatal("uncertain HTTP outcome accepted")
			}
			if f.calls.Load() > 1 {
				t.Fatal("poll retried or redirect followed")
			}
			if mode == "http" && f.calls.Load() != 0 {
				t.Fatal("plaintext reached network")
			}
			if _, err := f.runner.pollProbe(context.Background()); !errors.Is(err, probe.ErrBusy) {
				t.Fatal("failure refunded poll cooldown")
			}
		})
	}
}

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
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeclaim"
)

func wireClaimBinding(b probe.Binding) probeclaim.Binding {
	return probeclaim.Binding{NodeId: b.NodeID, BootId: b.BootID, SessionEpoch: b.SessionEpoch,
		SnapshotGeneration: b.SnapshotGeneration, AssignmentId: b.AssignmentID, ForwardId: b.ForwardID,
		ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
		BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision}
}
func probeClaimFixture(t *testing.T, change func(*Runner, *probeclaim.Response, http.ResponseWriter) bool) (*Runner, probe.Binding, *atomic.Int32) {
	t.Helper()
	runner, binding, sample := probeTestRunner(t)
	probeRegistryServer(t, runner, sample.Wall)
	if _, err := runner.registerProbe(context.Background()); err != nil {
		t.Fatal(err)
	}
	count := &atomic.Int32{}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count.Add(1)
		if r.Method != "POST" || r.URL.Path != "/agent/v3/probe/claim" || r.Header.Get("X-TuneX-Session-Epoch") != "2" {
			t.Error("incorrect claim request")
		}
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
		request, err := probeclaim.ParseRequest(raw)
		if err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		stamp := func(at time.Time) string { return at.UTC().Format("2006-01-02T15:04:05.000Z") }
		ack := probeclaim.Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-claim-ack", NodeId: request.NodeId,
			BootId: request.BootId, SessionEpoch: request.SessionEpoch, InstanceId: request.InstanceId,
			InstanceGeneration: request.InstanceGeneration, PermitId: request.PermitId, Binding: wireClaimBinding(binding),
			TimeoutMs: 1000, IssuedAt: stamp(sample.Wall.Add(-100 * time.Millisecond)), ExpiresAt: stamp(sample.Wall.Add(1900 * time.Millisecond)),
			ConsumedAt: stamp(sample.Wall), ServerTime: stamp(sample.Wall), State: "consumed"}
		if change != nil && change(runner, &ack, w) {
			return
		}
		_ = json.NewEncoder(w).Encode(ack)
	}))
	runner.options.URL, runner.client = server.URL, server.Client()
	t.Cleanup(server.Close)
	return runner, binding, count
}

func TestProbeClaimReceiptChecksHostBindingWithoutExecutionOrJournalMutation(t *testing.T) {
	runner, binding, count := probeClaimFixture(t, nil)
	before := runner.journal
	started := time.Now()
	receipt, err := runner.claimProbe(context.Background(), "permit-a", binding)
	if err != nil || receipt == nil {
		t.Fatalf("claim failed: %v", err)
	}
	if receipt.binding != binding || receipt.permitID != "permit-a" || receipt.timeout != time.Second ||
		!receipt.until.After(time.Now()) || receipt.until.After(started.Add(2*time.Second)) {
		t.Fatal("incorrect minimized receipt")
	}
	if !reflect.DeepEqual(before, runner.journal) || len(runner.instances) != 1 || len(runner.drains) != 0 {
		t.Fatal("claim changed execution state")
	}
	if _, err := runner.claimProbe(context.Background(), "permit-a", binding); !errors.Is(err, probe.ErrReplay) || count.Load() != 1 {
		t.Fatalf("claim repeated remote I/O: %v count=%d", err, count.Load())
	}
}

func TestProbeClaimRejectsEveryForeignBindingAndBurnsFailedClaims(t *testing.T) {
	changes := map[string]func(*probeclaim.Response){
		"node":       func(a *probeclaim.Response) { a.Binding.NodeId = "foreign" },
		"boot":       func(a *probeclaim.Response) { a.Binding.BootId = "foreign" },
		"epoch":      func(a *probeclaim.Response) { a.Binding.SessionEpoch++ },
		"snapshot":   func(a *probeclaim.Response) { a.Binding.SnapshotGeneration++ },
		"assignment": func(a *probeclaim.Response) { a.Binding.AssignmentId = "foreign" },
		"forward":    func(a *probeclaim.Response) { a.Binding.ForwardId = "foreign" },
		"revision":   func(a *probeclaim.Response) { a.Binding.ForwardRevision++ },
		"deployment": func(a *probeclaim.Response) { a.Binding.DeploymentGeneration++ },
		"fence":      func(a *probeclaim.Response) { a.Binding.BindingFence++ },
		"digest":     func(a *probeclaim.Response) { a.Binding.ConfigDigest = "sha256:" + strings.Repeat("f", 64) },
		"egress":     func(a *probeclaim.Response) { a.Binding.EgressPolicyRevision++ },
		"instance":   func(a *probeclaim.Response) { a.InstanceId = strings.Repeat("f", 64) },
		"generation": func(a *probeclaim.Response) { a.InstanceGeneration++ },
		"permit":     func(a *probeclaim.Response) { a.PermitId = "foreign" },
		"enabled":    func(a *probeclaim.Response) { a.ExecutionEnabled = true },
		"clock": func(a *probeclaim.Response) {
			at, _ := time.Parse(time.RFC3339Nano, a.ServerTime)
			a.ServerTime = at.Add(-time.Minute).UTC().Format("2006-01-02T15:04:05.000Z")
			a.ConsumedAt, a.IssuedAt = a.ServerTime, a.ServerTime
			a.ExpiresAt = at.Add(-time.Minute + time.Second).UTC().Format("2006-01-02T15:04:05.000Z")
		},
	}
	for name, change := range changes {
		t.Run(name, func(t *testing.T) {
			runner, binding, count := probeClaimFixture(t, func(_ *Runner, ack *probeclaim.Response, _ http.ResponseWriter) bool { change(ack); return false })
			if receipt, err := runner.claimProbe(context.Background(), "permit-a", binding); err == nil || receipt != nil {
				t.Fatal("unsafe receipt accepted")
			}
			// A clock rejection may close the whole instance first; either denial still forbids another HTTP request.
			if _, err := runner.claimProbe(context.Background(), "permit-a", binding); err == nil || count.Load() != 1 {
				t.Fatal("failed claim was retried")
			}
		})
	}
}

func TestProbeClaimRechecksLocalAuthorityAfterRemoteWork(t *testing.T) {
	for _, scenario := range []string{"snapshot", "session", "credential", "instance", "ticket", "expiry"} {
		t.Run(scenario, func(t *testing.T) {
			runner, binding, count := probeClaimFixture(t, func(runner *Runner, _ *probeclaim.Response, _ http.ResponseWriter) bool {
				runner.mutex.Lock()
				defer runner.mutex.Unlock()
				switch scenario {
				case "snapshot":
					runner.journal.Generation++
				case "session":
					runner.hello.SessionEpoch++
				case "credential":
					runner.credentialFingerprint[0]++
				case "instance":
					runner.closeProbeLocked()
				case "ticket":
					runner.ticket = nil
				case "expiry":
					replacement := *runner.probeRegistration
					replacement.until = time.Now().Add(-time.Second)
					runner.probeRegistration = &replacement
				}
				return false
			})
			if receipt, err := runner.claimProbe(context.Background(), "permit-a", binding); err == nil || receipt != nil || count.Load() != 1 {
				t.Fatal("stale local execution retained a receipt")
			}
		})
	}
}

func TestProbeClaimUncertainHTTPOutcomesRemainBurnedWithoutRedirectOrRetry(t *testing.T) {
	for _, scenario := range []string{"oversize", "denied", "lost", "redirect", "duplicate", "cancel"} {
		t.Run(scenario, func(t *testing.T) {
			work, cancel := context.WithCancel(context.Background())
			defer cancel()
			runner, binding, count := probeClaimFixture(t, func(_ *Runner, _ *probeclaim.Response, w http.ResponseWriter) bool {
				switch scenario {
				case "oversize":
					_, _ = w.Write([]byte(strings.Repeat(" ", 4097)))
				case "denied":
					w.WriteHeader(409)
				case "lost":
					connection, _, err := w.(http.Hijacker).Hijack()
					if err != nil {
						t.Error(err)
					} else {
						_ = connection.Close()
					}
				case "redirect":
					w.Header().Set("Location", "/forbidden")
					w.WriteHeader(http.StatusTemporaryRedirect)
				case "duplicate":
					_, _ = w.Write([]byte(`{"kind":"probe-claim-ack","kind":"probe-claim-ack"}`))
				case "cancel":
					cancel()
				}
				return true
			})
			if receipt, err := runner.claimProbe(work, "permit-a", binding); err == nil || receipt != nil {
				t.Fatal("uncertain outcome accepted")
			}
			if _, err := runner.claimProbe(context.Background(), "permit-a", binding); !errors.Is(err, probe.ErrReplay) || count.Load() != 1 {
				t.Fatalf("claim retried uncertain outcome: %v count=%d", err, count.Load())
			}
		})
	}
}

func TestProbeClaimConcurrentBurnCapacityAndPreflight(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	runner, binding, count := probeClaimFixture(t, func(_ *Runner, _ *probeclaim.Response, _ http.ResponseWriter) bool {
		close(entered)
		<-release
		return false
	})
	// Always release before server cleanup, including a failed assertion.
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	done := make(chan error, 1)
	go func() { _, err := runner.claimProbe(context.Background(), "permit-a", binding); done <- err }()
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("claim did not reach server")
	}
	if _, err := runner.claimProbe(context.Background(), "permit-a", binding); !errors.Is(err, probe.ErrReplay) {
		t.Fatal("concurrent replay accepted")
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	runner.mutex.Lock()
	for i := 0; i < 256; i++ {
		runner.probeRegistration.claims[strings.Repeat("x", i+1)] = struct{}{}
	}
	runner.mutex.Unlock()
	if _, err := runner.claimProbe(context.Background(), "permit-b", binding); !errors.Is(err, probe.ErrBusy) || count.Load() != 1 {
		t.Fatal("claim capacity evicted IDs")
	}
	runner.mutex.Lock()
	runner.journal.Generation++
	runner.mutex.Unlock()
	if _, err := runner.claimProbe(context.Background(), "permit-c", binding); err == nil || count.Load() != 1 {
		t.Fatal("invalid host state reached network")
	}
}

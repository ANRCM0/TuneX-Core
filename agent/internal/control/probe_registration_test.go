package control

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeinstance"
	"github.com/tunex/vnext/agent/internal/probenegotiation"
)

type probeRegistryFixture struct {
	mutex          sync.Mutex
	generation     uint64
	instance       string
	state          string
	requests       []string
	beforeRegister func()
	mutateAck      func(*probeinstance.Response)
	lifetime       time.Duration
}

func probeRegistryServer(t *testing.T, runner *Runner, now time.Time) *probeRegistryFixture {
	t.Helper()
	state := &probeRegistryFixture{lifetime: 30 * time.Second}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.Header.Get("X-TuneX-Session-Epoch") != "2" {
			t.Error("incorrect machine request")
		}
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
		if r.URL.Path == "/agent/v3/probe/hello" {
			request, err := probenegotiation.ParseRequest(raw)
			if err != nil {
				t.Error(err)
				w.WriteHeader(400)
				return
			}
			ack := probeTestAck(*request)
			ack.ServerTime = now.UTC().Format("2006-01-02T15:04:05.000Z")
			_ = json.NewEncoder(w).Encode(ack)
			return
		}
		if r.URL.Path != "/agent/v3/probe/instance" {
			t.Error("incorrect instance route")
			w.WriteHeader(404)
			return
		}
		request, err := probeinstance.ParseRequest(raw)
		if err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		state.mutex.Lock()
		defer state.mutex.Unlock()
		state.requests = append(state.requests, request.Action)
		if request.Action == "register" {
			if state.beforeRegister != nil {
				state.beforeRegister()
			}
			if request.ExpectedGeneration != state.generation {
				w.WriteHeader(409)
				return
			}
			state.generation++
			state.instance = request.InstanceId
			state.state = "registered"
		}
		if request.Action == "revoke" {
			if request.ExpectedGeneration != state.generation || request.InstanceId != state.instance {
				w.WriteHeader(409)
				return
			}
			state.state = "revoked"
		}
		ack := probeinstance.Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-instance-ack", Action: request.Action,
			NodeId: request.NodeId, BootId: request.BootId, SessionEpoch: request.SessionEpoch, InstanceId: request.InstanceId,
			ExpectedGeneration: request.ExpectedGeneration, Generation: state.generation, State: state.state,
			ServerTime: now.UTC().Format("2006-01-02T15:04:05.000Z")}
		if state.generation == 0 {
			ack.State = "absent"
		} else {
			start, end, id := now.UTC().Format("2006-01-02T15:04:05.000Z"), now.Add(state.lifetime).UTC().Format("2006-01-02T15:04:05.000Z"), state.instance
			ack.RegisteredAt, ack.ExpiresAt, ack.CurrentInstanceId = &start, &end, &id
		}
		if state.mutateAck != nil {
			state.mutateAck(&ack)
		}
		_ = json.NewEncoder(w).Encode(ack)
	}))
	runner.options.URL, runner.client = server.URL, server.Client()
	t.Cleanup(func() { runner.stop(); server.Close() })
	return state
}

func probeGateClosed(t *testing.T, session *registeredProbe, binding probe.Binding) {
	t.Helper()
	select {
	case <-session.done:
	case <-time.After(3 * time.Second):
		t.Fatal("Probe monitor did not stop")
	}
	_, err := session.gate.Run(context.Background(), probe.Grant{PermitID: "closed-check", InstanceID: session.gate.InstanceID(),
		Permit: probe.Permit{Binding: binding, Until: time.Now().Add(time.Second), Check: func() error { return nil }}, Timeout: time.Second})
	if !errors.Is(err, probe.ErrDenied) {
		t.Fatalf("closed gate retained admission: %v", err)
	}
}

func TestProbeRegistrationOwnsRotatesAndRevokesCurrentGate(t *testing.T) {
	runner, binding, sample := probeTestRunner(t)
	state := probeRegistryServer(t, runner, sample.Wall)
	first, err := runner.registerProbe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	state.mutex.Lock()
	state.beforeRegister = func() {
		select {
		case <-first.done:
		default:
			t.Error("predecessor still active during replacement")
		}
	}
	state.mutex.Unlock()
	second, err := runner.registerProbe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	probeGateClosed(t, first, binding)
	if first.gate.InstanceID() == second.gate.InstanceID() || second.generation != 2 {
		t.Fatal("rotation did not install a fresh current instance")
	}
	if runner.journal.Generation != 3 || len(runner.instances) != 1 {
		t.Fatal("registration changed forwarding state")
	}
	if err := runner.revokeProbe(context.Background()); err != nil {
		t.Fatal(err)
	}
	probeGateClosed(t, second, binding)
	state.mutex.Lock()
	defer state.mutex.Unlock()
	if state.state != "revoked" || state.generation != 2 || runner.probeRegistration != nil {
		t.Fatal("revocation lost ownership binding")
	}
}

func TestProbeRegistrationRejectsUnsafeOrSupersededAcknowledgements(t *testing.T) {
	for _, scenario := range []string{"enabled", "instance", "generation", "clock", "session", "certificate", "oversize"} {
		t.Run(scenario, func(t *testing.T) {
			runner, _, sample := probeTestRunner(t)
			state := probeRegistryServer(t, runner, sample.Wall)
			state.mutex.Lock()
			state.mutateAck = func(ack *probeinstance.Response) {
				if ack.Action != "register" {
					return
				}
				switch scenario {
				case "enabled":
					ack.ExecutionEnabled = true
				case "instance":
					foreign := strings.Repeat("b", 64)
					ack.CurrentInstanceId = &foreign
				case "generation":
					ack.Generation++
				case "clock":
					ack.ServerTime = sample.Wall.Add(time.Minute).UTC().Format("2006-01-02T15:04:05.000Z")
				case "session":
					runner.mutex.Lock()
					runner.hello.SessionEpoch++
					runner.mutex.Unlock()
				case "certificate":
					runner.mutex.Lock()
					runner.credentialFingerprint[0]++
					runner.mutex.Unlock()
				case "oversize":
					ack.NodeId = strings.Repeat("a", 5000)
				}
			}
			state.mutex.Unlock()
			if session, err := runner.registerProbe(context.Background()); err == nil || session != nil {
				t.Fatal("unsafe registration retained a gate")
			}
			runner.mutex.Lock()
			current := runner.probeRegistration
			runner.mutex.Unlock()
			if current != nil {
				t.Fatal("rejected response installed a current gate")
			}
		})
	}
}

func TestProbeRegistrationStopCannotBeUndoneByLateAcknowledgement(t *testing.T) {
	runner, _, sample := probeTestRunner(t)
	state := probeRegistryServer(t, runner, sample.Wall)
	entered, release := make(chan struct{}), make(chan struct{})
	var released sync.Once
	defer released.Do(func() { close(release) })
	state.mutex.Lock()
	state.beforeRegister = func() { close(entered); <-release }
	state.mutex.Unlock()
	finished := make(chan error, 1)
	go func() { _, err := runner.registerProbe(context.Background()); finished <- err }()
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("registration did not reach server")
	}
	runner.stop()
	released.Do(func() { close(release) })
	select {
	case err := <-finished:
		if err == nil {
			t.Fatal("late response resurrected stopped Runner")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("registration did not end")
	}
	if runner.probeRegistration != nil {
		t.Fatal("stopped Runner retained a gate")
	}
}

func TestProbeRegistrationMonitorClosesOnContextIdentityAndGuardLoss(t *testing.T) {
	for _, scenario := range []string{"context", "session", "boot", "certificate", "guard"} {
		t.Run(scenario, func(t *testing.T) {
			runner, binding, sample := probeTestRunner(t)
			probeRegistryServer(t, runner, sample.Wall)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			session, err := runner.registerProbe(ctx)
			if err != nil {
				t.Fatal(err)
			}
			runner.mutex.Lock()
			switch scenario {
			case "context":
				cancel()
			case "session":
				runner.hello.SessionEpoch++
			case "boot":
				runner.options.BootID = "new-boot"
			case "certificate":
				runner.credentialFingerprint[0]++
			case "guard":
				runner.guard = nil
			}
			runner.mutex.Unlock()
			probeGateClosed(t, session, binding)
		})
	}
}

func TestProbeRegistrationMonotonicFreshnessDeadlineClosesGate(t *testing.T) {
	runner, binding, sample := probeTestRunner(t)
	state := probeRegistryServer(t, runner, sample.Wall)
	state.mutex.Lock()
	state.lifetime = 2100 * time.Millisecond
	state.mutex.Unlock()
	session, err := runner.registerProbe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	probeGateClosed(t, session, binding)
}

func TestProbeRegistrationSupervisorClosesAndRevokesOnShutdown(t *testing.T) {
	runner, _, sample := probeTestRunner(t)
	state := probeRegistryServer(t, runner, sample.Wall)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); runner.maintainProbe(ctx) }()
	deadline := time.Now().Add(3 * time.Second)
	for {
		runner.mutex.Lock()
		current := runner.probeRegistration
		runner.mutex.Unlock()
		if current != nil {
			break
		}
		if time.Now().After(deadline) {
			cancel()
			t.Fatal("supervisor did not register")
		}
		time.Sleep(time.Millisecond)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("supervisor did not finish")
	}
	state.mutex.Lock()
	defer state.mutex.Unlock()
	if state.state != "revoked" {
		t.Fatal("shutdown did not revoke the registered instance")
	}
	if strconv.FormatUint(state.generation, 10) != "1" {
		t.Fatal("shutdown unexpectedly renewed registration")
	}
}

func TestProbeRegistrationRecoversOwnerAfterRejectedAcknowledgement(t *testing.T) {
	runner, _, sample := probeTestRunner(t)
	state := probeRegistryServer(t, runner, sample.Wall)
	state.mutex.Lock()
	state.mutateAck = func(ack *probeinstance.Response) {
		if ack.Action == "register" {
			ack.ExecutionEnabled = true
		}
	}
	state.mutex.Unlock()
	if session, err := runner.registerProbe(context.Background()); err == nil || session != nil {
		t.Fatal("invalid acknowledgement installed a gate")
	}
	state.mutex.Lock()
	orphan := state.instance
	if state.generation != 1 || orphan == "" {
		t.Fatal("fixture did not persist the unaccepted registration")
	}
	state.mutateAck = nil
	state.mutex.Unlock()
	session, err := runner.registerProbe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if session.generation != 2 || session.gate.InstanceID() == orphan {
		t.Fatal("recovery reused an unaccepted identity instead of current CAS")
	}
	if err := runner.revokeProbe(context.Background()); err != nil {
		t.Fatal(err)
	}
}

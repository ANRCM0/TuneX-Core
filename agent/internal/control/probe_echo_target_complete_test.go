package control

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

// These tests replace only the compiled driver's observation seam. All target,
// binding, Guard, ticket, context and current-instance decisions run in Runner.
type echoTargetCompleteInstance struct {
	probeTestStream
	identity byte
}

func echoTargetCompleteFixture(t *testing.T, measurement string) (*wireOwnerFixture, probeecho.Execution, *int, *bool, *executionProbeTarget) {
	t.Helper()
	f := newWireOwnerFixture(t, 4)
	protocol := "tcp"
	if measurement == probeecho.MeasurementUDP {
		protocol = "udp"
	}
	current := f.runner.instances["tcp/22001"]
	current.stream = &echoTargetCompleteInstance{identity: 1}
	current.assignment.Protocol, current.assignment.Resource.Protocol = protocol, protocol
	current.assignment.Driver.Config.Target.Port = 22001
	digest, err := contracts.ComputeDigest(current.assignment.Driver.Config)
	if err != nil {
		t.Fatal(err)
	}
	current.assignment.Driver.ConfigDigest, f.binding.ConfigDigest = digest, digest
	delete(f.runner.instances, "tcp/22001")
	f.runner.instances[protocol+"/22001"] = current
	input, _ := wireOwnerEchoExecution(t, f, measurement)
	calls, denied := new(int), new(bool)
	observed := &executionProbeTarget{address: "127.0.0.1", port: 22001}
	observed.check = func() error {
		if *denied {
			return errors.New("observation revoked")
		}
		return nil
	}
	observe := func(instance execution) (executionProbeTarget, error) {
		*calls++
		if instance != current.stream {
			t.Fatal("observation received another instance")
		}
		if f.runner.mutex.TryLock() {
			f.runner.mutex.Unlock()
			t.Fatal("driver observation escaped original Runner lock")
		}
		return *observed, nil
	}
	old := builtinExecutionDrivers
	drivers := append([]executionDriver(nil), old.ordered...)
	for i := range drivers {
		if drivers[i].descriptor.id == "native.direct.v1" {
			drivers[i].probeIngress = func(instance execution) (executionProbeTarget, error) {
				if protocol != "tcp" {
					t.Fatal("UDP selected TCP hook")
				}
				return observe(instance)
			}
			drivers[i].probeUDPIngress = func(instance execution) (executionProbeTarget, error) {
				if protocol != "udp" {
					t.Fatal("TCP selected UDP hook")
				}
				return observe(instance)
			}
		}
	}
	builtinExecutionDrivers, err = newExecutionRegistry(drivers...)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { builtinExecutionDrivers = old })
	return f, input, calls, denied, observed
}

func echoTargetCompleteRehash(t *testing.T, input *probeecho.Execution) {
	t.Helper()
	var err error
	input.Context.ConfigDigest, err = contracts.ComputeDigest(input.Context.Config)
	if err != nil {
		t.Fatal(err)
	}
	s := input.Context.Selection
	input.Context.ContextDigest, err = contracts.ComputeDigest(map[string]any{"scopeId": s.ScopeId, "serviceId": s.ServiceId, "revision": s.Revision, "configRevision": s.ConfigRevision, "configDigest": s.ConfigDigest, "config": input.Context.Config})
	if err != nil {
		t.Fatal(err)
	}
	input.Invocation.Service = input.Context.Selection
	input.Challenge.InvocationDigest, err = probeecho.InvocationDigest(input.Invocation)
	if err != nil {
		t.Fatal(err)
	}
}

func TestProbeEchoTargetCompleteTCPUDPCurrentLockDeadlineAndDetachedInput(t *testing.T) {
	for _, measurement := range []string{probeecho.MeasurementTCP, probeecho.MeasurementUDP} {
		t.Run(measurement, func(t *testing.T) {
			f, input, calls, denied, observed := echoTargetCompleteFixture(t, measurement)
			// Native context is valid before the production path is invoked; this
			// prevents an earlier decoder refusal from masking downstream checks.
			input.Context.Config.ValidUntil = uint64(f.schedule.now.Add(500 * time.Millisecond).UnixMilli())
			echoTargetCompleteRehash(t, &input)
			if _, err := probenative.ParseEchoContext(input.Context); err != nil {
				t.Fatal("valid typed echo fixture", err)
			}
			target, err := f.runner.resolveProbeEchoTarget(context.Background(), f.binding, input)
			if err != nil || *calls != 1 || target.Host != "127.0.0.1" || target.Port != 22001 || target.Measurement != measurement || target.Echo == nil || !sameProbeEchoInput(target.Echo, &input) || target.Check == nil || !target.ExecutionUntil.Equal(f.schedule.now.Add(500*time.Millisecond)) {
				t.Fatal("Runner echo target projection", target, err, *calls)
			}
			if !f.runner.mutex.TryLock() {
				t.Fatal("resolver retained Runner lock")
			}
			f.runner.mutex.Unlock()
			journalBefore := f.runner.journal
			input.Context.Config.Endpoint.Protocols[0] = "mutated"
			input.Challenge.Nonce = "mutated"
			if target.Echo.Context.Config.Endpoint.Protocols[0] != "tcp" || target.Check() != nil || *calls != 2 {
				t.Fatal("callback retained caller execution or missed current observation")
			}
			*denied = true
			if target.Check() != probe.ErrDenied {
				t.Fatal("current observation Check lost")
			}
			*denied = false
			observed.port++
			if target.Check() != probe.ErrDenied {
				t.Fatal("observed endpoint replacement retained authority")
			}
			observed.port--
			f.schedule.now = f.schedule.now.Add(500 * time.Millisecond)
			if target.Check() != probe.ErrDenied {
				t.Fatal("expired service context retained callback authority")
			}
			f.schedule.now = f.schedule.now.Add(-500 * time.Millisecond)
			if !reflect.DeepEqual(journalBefore, f.runner.journal) {
				t.Fatal("echo projection modified protected Journal")
			}
			for key, current := range f.runner.instances {
				current.stream = &echoTargetCompleteInstance{identity: 2}
				f.runner.instances[key] = current
			}
			before := *calls
			if target.Check() != probe.ErrDenied || *calls != before {
				t.Fatal("instance replacement reached old observation callback")
			}
		})
	}
}

func TestProbeEchoTargetCompleteRefusalStagesAndAuthority(t *testing.T) {
	for _, mode := range []string{"feature", "service", "missing", "binding", "decode", "purpose", "expired", "future", "selection", "nonce", "digest", "protocol", "business-port", "driver", "stale-binding", "nil-observed-check", "observed-zone", "observed-protocol"} {
		t.Run(mode, func(t *testing.T) {
			f, input, calls, _, observed := echoTargetCompleteFixture(t, probeecho.MeasurementTCP)
			candidate := &input
			var service *observationtrust.Context
			wantNow, wantObserve := 1, 0
			switch mode {
			case "feature":
				f.runner.options.ProbeEcho = false
				wantNow = 0
			case "service":
				service = &observationtrust.Context{}
				wantNow = 0
			case "missing":
				candidate = nil
				wantNow = 0
			case "binding":
				input.Invocation.Binding.BindingFence++
				wantNow = 0
			case "decode":
				input.Context.ConfigDigest = "invalid"
			case "purpose":
				input.Context.Config.Purpose = "invalid"
				echoTargetCompleteRehash(t, &input)
			case "expired":
				input.Context.Config.ValidUntil = uint64(f.schedule.now.UnixMilli())
				echoTargetCompleteRehash(t, &input)
			case "future":
				input.Context.Config.ValidFrom = uint64(f.schedule.now.Add(time.Second).UnixMilli())
				echoTargetCompleteRehash(t, &input)
			case "selection":
				input.Invocation.Service.Revision++
			case "nonce":
				input.Challenge.Nonce = "mismatch"
			case "digest":
				input.Challenge.InvocationDigest = "sha256:invalid"
			case "protocol":
				input.Context.Config.Endpoint.Protocols = []string{"udp"}
				echoTargetCompleteRehash(t, &input)
			case "business-port":
				input.Context.Config.Endpoint.Port++
				echoTargetCompleteRehash(t, &input)
			case "driver":
				for key, current := range f.runner.instances {
					current.assignment.Driver.Id = "not-compiled"
					f.runner.instances[key] = current
				}
			case "stale-binding":
				f.runner.journal.Generation++
			case "nil-observed-check":
				observed.check = nil
				wantObserve = 1
			case "observed-zone":
				observed.address = "127.0.0.1%eth0"
				wantObserve = 1
			case "observed-protocol":
				for key, current := range f.runner.instances {
					current.assignment.Resource.Protocol = "udp"
					f.runner.instances[key] = current
				}
			}
			before := f.schedule.nowCalls
			f.runner.mutex.Lock()
			_, err := f.runner.probeEchoTargetLocked(f.binding, probeecho.MeasurementTCP, service, candidate)
			f.runner.mutex.Unlock()
			if err != probe.ErrDenied || f.schedule.nowCalls-before != wantNow || *calls != wantObserve {
				t.Fatal("echo refusal stage", mode, err, f.schedule.nowCalls-before, *calls)
			}
		})
	}
}

func TestProbeEchoTargetCompleteCodecCompositionAndNilComparison(t *testing.T) {
	f, input, _, _, _ := echoTargetCompleteFixture(t, probeecho.MeasurementTCP)
	raw, err := probenative.EncodeEchoContext(input.Context)
	if err != nil {
		t.Fatal(err)
	}
	decoded, decodeErr := probenative.DecodeEchoContext(raw)
	parsed, parseErr := probenative.ParseEchoContext(input.Context)
	if decodeErr != nil || parseErr != nil || !reflect.DeepEqual(decoded, parsed) || !reflect.DeepEqual(*parsed, input.Context) {
		t.Fatal("valid native context composition", decodeErr, parseErr)
	}
	if !sameProbeEchoInput(nil, nil) || sameProbeEchoInput(&input, nil) || sameProbeEchoInput(nil, &input) {
		t.Fatal("parent nil execution checks")
	}
	copy := probeecho.CloneExecution(input)
	if !sameProbeEchoInput(&input, &copy) {
		t.Fatal("detached equal execution refused")
	}
	copy.Context.Config.Endpoint.Protocols[0] = "changed"
	if sameProbeEchoInput(&input, &copy) {
		t.Fatal("protocol value difference ignored")
	}
	a, b := probeecho.Execution{}, probeecho.Execution{}
	b.Context.Config.Endpoint.Protocols = []string{}
	if sameProbeEchoInput(&a, &b) {
		t.Fatal("nil and empty protocol slices collapsed")
	}
	// ServiceContext has only concrete scalar/slice fields and no MarshalJSON;
	// json.Marshal cannot produce an encode error for this current public shape.
	// Retain source-order coverage of that defensive branch without fabricating
	// runtime encode-error evidence or adding an injectable production codec.
	wireOwnerOrdered(t, wireOwnerCalls(t, "probe_echo_target.go", "probeEchoTargetLocked"), "EncodeEchoContext", "DecodeEchoContext", "Now")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	before := f.schedule.nowCalls
	if _, err := f.runner.resolveProbeEchoTarget(ctx, f.binding, input); err != context.Canceled || f.schedule.nowCalls != before {
		t.Fatal("cancelled resolver reached native context/time work", err)
	}
}

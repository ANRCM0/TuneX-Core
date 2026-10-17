package control

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/state"
)

type probeTestStream struct{}

func (*probeTestStream) Close()                        {}
func (*probeTestStream) Drain()                        {}
func (*probeTestStream) Remaining() uint64             { return 0 }
func (*probeTestStream) SetAuthorization(func() error) {}

func probeTestRunner(t *testing.T) (*Runner, probe.Binding, *authorization.Sample) {
	t.Helper()
	now := time.Now()
	sample := &authorization.Sample{Wall: now, Uptime: time.Hour}
	guard, err := authorization.New(func() (authorization.Sample, error) { return *sample, nil },
		time.Second, 5*time.Minute, now.Add(10*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := guard.Accept(now, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	target, revision, metadata, cidrs := adp3.Target{Host: "127.0.0.1", Port: 80}, uint64(1), false, []string{"127.0.0.0/8"}
	config := adp3.RuntimeConfig{Target: &target, EgressPolicyRevision: &revision,
		AllowMetadataTargets: &metadata, AllowedDestinationCidrs: &cidrs}
	digest, err := contracts.ComputeDigest(config)
	if err != nil {
		t.Fatal(err)
	}
	assignment := adp3.Assignment{AssignmentId: "assignment-a", ForwardId: "forward-a", ForwardRevision: 1,
		DeploymentGeneration: 4, BindingFence: 5, Role: "direct", Protocol: "tcp", Phase: "active",
		Resource: adp3.Resource{Address: "127.0.0.1", Port: 22001, Protocol: "tcp"},
		Driver:   adp3.Driver{Id: "native.direct.v1", SchemaVersion: 1, ConfigDigest: digest, Config: config}}
	runner := &Runner{options: Options{NodeID: "node-a", BootID: "boot-a"}, guard: guard, ticket: ticket,
		hello: adp3.HelloResponse{SessionEpoch: 2}, journal: state.Journal{Generation: 3},
		instances: map[string]running{"tcp/22001": {assignment: assignment, ticket: ticket, stream: &probeTestStream{}}}}
	binding := probe.Binding{NodeID: "node-a", BootID: "boot-a", AssignmentID: "assignment-a", ForwardID: "forward-a",
		ConfigDigest: digest, SessionEpoch: 2, SnapshotGeneration: 3, ForwardRevision: 1,
		DeploymentGeneration: 4, BindingFence: 5, EgressPolicyRevision: 1}
	return runner, binding, sample
}

func TestProbeHostReadsCurrentPhysicalBindingWithoutMutation(t *testing.T) {
	runner, binding, _ := probeTestRunner(t)
	before := runner.journal
	target, err := runner.resolveProbeTarget(context.Background(), binding)
	if err != nil || target.Binding != binding || target.Host != "127.0.0.1" || target.Port != 80 ||
		target.Check == nil || target.Check() != nil || target.ExecutionUntil != runner.ticket.Deadline() {
		t.Fatalf("incorrect authorized host projection: %+v %v", target, err)
	}
	target.AllowedDestinationCIDRs[0] = "0.0.0.0/0"
	fresh, err := runner.resolveProbeTarget(context.Background(), binding)
	if err != nil || fresh.AllowedDestinationCIDRs[0] != "127.0.0.0/8" {
		t.Fatal("projection mutated execution config")
	}
	if !reflect.DeepEqual(before, runner.journal) || len(runner.instances) != 1 || len(runner.drains) != 0 {
		t.Fatal("probe changed deployment or protected state")
	}
	// A previously returned callback must see replacement, not captured old facts.
	runner.journal.Generation++
	if !errors.Is(target.Check(), probe.ErrDenied) {
		t.Fatal("old projection retained authority after Snapshot replacement")
	}
}

func TestProbeHostRejectsForeignStaleInactiveAndTamperedBindings(t *testing.T) {
	for _, mutate := range []func(*Runner, *probe.Binding){
		func(_ *Runner, b *probe.Binding) { b.NodeID = "foreign-node" },
		func(_ *Runner, b *probe.Binding) { b.BootID = "other-boot" },
		func(_ *Runner, b *probe.Binding) { b.SessionEpoch++ },
		func(_ *Runner, b *probe.Binding) { b.SnapshotGeneration++ },
		func(_ *Runner, b *probe.Binding) { b.AssignmentID = "missing" },
		func(_ *Runner, b *probe.Binding) { b.ForwardID = "foreign-forward" },
		func(_ *Runner, b *probe.Binding) { b.ForwardRevision++ },
		func(_ *Runner, b *probe.Binding) { b.DeploymentGeneration++ },
		func(_ *Runner, b *probe.Binding) { b.BindingFence++ },
		func(_ *Runner, b *probe.Binding) { b.EgressPolicyRevision++ },
		func(r *Runner, _ *probe.Binding) { r.guard = nil },
		func(r *Runner, _ *probe.Binding) { r.ticket = nil },
		func(r *Runner, _ *probe.Binding) { delete(r.instances, "tcp/22001") },
		func(r *Runner, _ *probe.Binding) { r.instances["tcp/other"] = r.instances["tcp/22001"] },
		func(r *Runner, _ *probe.Binding) {
			instance := r.instances["tcp/22001"]
			instance.assignment.Phase = "draining"
			r.instances["tcp/22001"] = instance
		},
		func(r *Runner, _ *probe.Binding) {
			instance := r.instances["tcp/22001"]
			instance.assignment.Protocol = "udp"
			r.instances["tcp/22001"] = instance
		},
		func(r *Runner, _ *probe.Binding) {
			instance := r.instances["tcp/22001"]
			instance.assignment.Driver.Config.Target.Host = "169.254.169.254"
		},
		func(r *Runner, _ *probe.Binding) {
			instance := r.instances["tcp/22001"]
			instance.stream = nil
			r.instances["tcp/22001"] = instance
		},
	} {
		runner, binding, _ := probeTestRunner(t)
		mutate(runner, &binding)
		if _, err := runner.resolveProbeTarget(context.Background(), binding); !errors.Is(err, probe.ErrDenied) {
			t.Fatalf("unsafe host binding accepted: %v", err)
		}
	}
}

func TestProbeHostExecutionExpiryCannotBeReplacedByProbePermit(t *testing.T) {
	runner, binding, sample := probeTestRunner(t)
	target, err := runner.resolveProbeTarget(context.Background(), binding)
	if err != nil {
		t.Fatal(err)
	}
	sample.Wall = sample.Wall.Add(time.Minute)
	sample.Uptime += time.Minute
	if !errors.Is(target.Check(), probe.ErrDenied) {
		t.Fatal("execution expiry did not revoke projection")
	}
	permit := probe.Permit{Binding: binding, Until: time.Now().Add(time.Second), Check: func() error { return nil }}
	if _, err := runner.probeDirect(context.Background(), permit, time.Second); !errors.Is(err, probe.ErrDenied) {
		t.Fatal("Probe permit bypassed expired execution authority")
	}
}

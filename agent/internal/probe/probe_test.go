package probe

import (
	"context"
	"errors"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func testRequest(t *testing.T) (Permit, Target) {
	t.Helper()
	binding := Binding{NodeID: strings.ReplaceAll(t.Name(), "/", "."), BootID: "boot-a",
		AssignmentID: "assignment-a", ForwardID: "forward-a", ConfigDigest: "sha256:" + strings.Repeat("a", 64),
		SessionEpoch: 2, SnapshotGeneration: 3, ForwardRevision: 1, DeploymentGeneration: 4, BindingFence: 5, EgressPolicyRevision: 1}
	until := time.Now().Add(1900 * time.Millisecond)
	return Permit{Binding: binding, Until: until, Check: func() error { return nil }},
		Target{Binding: binding, Host: "127.0.0.1", Port: 80, AllowedDestinationCIDRs: []string{"127.0.0.0/8"},
			ExecutionUntil: until, Check: func() error { return nil }}
}

func TestProbeConnectOnlyAndProvenance(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	received := make(chan error, 1)
	go func() {
		connection, err := listener.Accept()
		if err != nil {
			received <- err
			return
		}
		defer connection.Close()
		_ = connection.SetReadDeadline(time.Now().Add(3 * time.Second))
		buffer := make([]byte, 1)
		count, err := connection.Read(buffer)
		if count != 0 || err != io.EOF {
			received <- errors.New("probe sent application data or did not close")
			return
		}
		received <- nil
	}()
	permit, target := testRequest(t)
	target.Port = listener.Addr().(*net.TCPAddr).Port
	executor, _ := New(func(_ context.Context, binding Binding) (Target, error) {
		if binding != target.Binding {
			t.Error("resolver lost binding")
		}
		return target, nil
	})
	result, err := executor.Run(context.Background(), permit, time.Second)
	if err != nil || result.Status != "connected" || result.Code != "tcp-connected" ||
		result.ApplicationHealth != "unknown" || !result.IndependentProbe || result.Binding != permit.Binding ||
		result.Point != "agent-direct-egress" || result.ValidUntil.After(permit.Until) || result.Elapsed <= 0 {
		t.Fatalf("incorrect result: %+v %v", result, err)
	}
	select {
	case err := <-received:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(4 * time.Second):
		t.Fatal("probe failed to close its connection")
	}
	another, _ := New(executor.resolve)
	if _, err := another.Run(context.Background(), permit, time.Second); !errors.Is(err, ErrBusy) {
		t.Fatalf("new Executor reset process cooldown: %v", err)
	}
}

func TestProbeRejectsInvalidRequestsBeforeResolution(t *testing.T) {
	permit, _ := testRequest(t)
	resolves := 0
	executor, _ := New(func(context.Context, Binding) (Target, error) { resolves++; return Target{}, nil })
	for _, mutate := range []func(*Permit){
		func(p *Permit) { p.Binding.NodeID = "../node" },
		func(p *Permit) { p.Binding.ConfigDigest = strings.Repeat("a", 64) },
		func(p *Permit) { p.Binding.BindingFence = 0 },
		func(p *Permit) { p.Binding.SessionEpoch = 9007199254740992 },
		func(p *Permit) { p.Check = nil },
		func(p *Permit) { p.Check = func() error { return errors.New("secret") } },
		func(p *Permit) { p.Until = time.Now() },
		func(p *Permit) { p.Until = time.Now().Add(3 * time.Second) },
	} {
		p := permit
		mutate(&p)
		if _, err := executor.Run(context.Background(), p, time.Second); err == nil {
			t.Fatal("invalid permit accepted")
		}
	}
	for _, timeout := range []time.Duration{99 * time.Millisecond, 2001 * time.Millisecond} {
		if _, err := executor.Run(context.Background(), permit, timeout); !errors.Is(err, ErrInvalid) {
			t.Fatal("unbounded timeout accepted")
		}
	}
	if resolves != 0 {
		t.Fatal("rejected requests reached host resolver")
	}
	if _, err := New(nil); !errors.Is(err, ErrInvalid) {
		t.Fatal("missing host accepted")
	}
}

func TestProbeRejectsDNSMetadataAndForeignBindingsWithoutDial(t *testing.T) {
	permit, base := testRequest(t)
	target := base
	executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
	calls := 0
	executor.dial = func(context.Context, string, string) (net.Conn, error) { calls++; return nil, nil }
	for _, host := range []string{"example.org", "127.0.0.1%zone", "169.254.169.254", "100.100.100.200",
		"fe80::1", "fd00:ec2::254", "::ffff:169.254.169.254", "0.0.0.0", "::", "224.0.0.1",
		"240.0.0.1", "255.255.255.255", "ff02::1"} {
		target = base
		target.Host = host
		target.AllowedDestinationCIDRs = []string{"0.0.0.0/0", "::/0"}
		if _, err := executor.Run(context.Background(), permit, time.Second); !errors.Is(err, ErrDenied) {
			t.Fatalf("target %s accepted: %v", host, err)
		}
	}
	for _, mutate := range []func(*Target){
		func(t *Target) { t.Binding.BootID = "other-boot" },
		func(t *Target) { t.Binding.SnapshotGeneration++ },
		func(t *Target) { t.Binding.BindingFence++ },
		func(t *Target) { t.Port = 0 },
		func(t *Target) { t.Port = 65536 },
		func(t *Target) { t.Check = nil },
		func(t *Target) { t.Check = func() error { return ErrDenied } },
		func(t *Target) { t.ExecutionUntil = time.Now() },
		func(t *Target) { t.AllowedDestinationCIDRs = []string{"10.0.0.0/8"} },
	} {
		target = base
		mutate(&target)
		if _, err := executor.Run(context.Background(), permit, time.Second); !errors.Is(err, ErrDenied) {
			t.Fatalf("foreign target accepted: %v", err)
		}
	}
	if calls != 0 {
		t.Fatal("unsafe target reached dial")
	}
}

func TestProbeSingleAttemptAndSanitizedFailure(t *testing.T) {
	permit, target := testRequest(t)
	executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
	calls := 0
	executor.dial = func(_ context.Context, network, address string) (net.Conn, error) {
		calls++
		if network != "tcp" || address != "127.0.0.1:80" {
			t.Error("non-literal or incorrect destination")
		}
		return nil, errors.New("sensitive network detail")
	}
	result, err := executor.Run(context.Background(), permit, time.Second)
	if err != nil || calls != 1 || result.Code != "tcp-connect-failed" || result.Status != "unreachable" ||
		result.ApplicationHealth != "unknown" {
		t.Fatalf("failure retried or escaped sanitization: %+v %v", result, err)
	}
}

func TestProbeCancellationDeadlineAndRevocation(t *testing.T) {
	for _, reason := range []string{"parent", "deadline", "permit", "binding"} {
		t.Run(reason, func(t *testing.T) {
			permit, target := testRequest(t)
			var denied atomic.Bool
			check := func() error {
				if denied.Load() {
					return ErrDenied
				}
				return nil
			}
			if reason == "permit" {
				permit.Check = check
			}
			if reason == "binding" {
				target.Check = check
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			entered := make(chan struct{})
			executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
			executor.dial = func(ctx context.Context, _, _ string) (net.Conn, error) {
				close(entered)
				<-ctx.Done()
				return nil, ctx.Err()
			}
			finished := make(chan error, 1)
			go func() { _, err := executor.Run(ctx, permit, 100*time.Millisecond); finished <- err }()
			select {
			case <-entered:
			case err := <-finished:
				t.Fatalf("measurement stopped before dialing: %v", err)
			case <-time.After(3 * time.Second):
				t.Fatal("measurement did not reach dial")
			}
			switch reason {
			case "parent":
				cancel()
			case "permit", "binding":
				denied.Store(true)
			}
			select {
			case err := <-finished:
				if err == nil {
					t.Fatal("canceled measurement returned evidence")
				}
			case <-time.After(3 * time.Second):
				t.Fatal("network work outlived cancellation")
			}
		})
	}
}

func TestProbePostConnectRevocationClosesConnection(t *testing.T) {
	permit, target := testRequest(t)
	var denied atomic.Bool
	target.Check = func() error {
		if denied.Load() {
			return ErrDenied
		}
		return nil
	}
	left, right := net.Pipe()
	defer right.Close()
	executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
	executor.dial = func(context.Context, string, string) (net.Conn, error) {
		denied.Store(true)
		return left, nil
	}
	if _, err := executor.Run(context.Background(), permit, time.Second); !errors.Is(err, ErrDenied) {
		t.Fatalf("post-dial revocation ignored: %v", err)
	}
	_ = right.SetReadDeadline(time.Now().Add(time.Second))
	if _, err := right.Read(make([]byte, 1)); err != io.EOF {
		t.Fatalf("returned connection leaked: %v", err)
	}
}

func TestProbeBoundedAdmissionAndCooldown(t *testing.T) {
	b := budget{nodes: make(map[string]admission)}
	now := time.Now()
	releases := []func(){}
	for _, node := range []string{"a", "b", "c", "d"} {
		release, err := b.acquire(node, now)
		if err != nil {
			t.Fatal(err)
		}
		releases = append(releases, release)
	}
	if _, err := b.acquire("e", now); !errors.Is(err, ErrBusy) {
		t.Fatal("global budget exceeded")
	}
	for _, release := range releases {
		release()
	}
	if _, err := b.acquire("a", now); !errors.Is(err, ErrBusy) {
		t.Fatal("node cooldown bypassed")
	}
	release, err := b.acquire("a", time.Now().Add(2*time.Second))
	if err != nil {
		t.Fatal("expired cooldown did not free bounded entry")
	}
	release()
	b.nodes = make(map[string]admission)
	for i := 0; i < 128; i++ {
		b.nodes[string(rune(i))] = admission{until: now.Add(time.Minute)}
	}
	if _, err := b.acquire("new", now); !errors.Is(err, ErrBusy) {
		t.Fatal("bounded cooldown table exceeded")
	}
	t.Run("admission survives cancellation until the underlying dial ends", func(t *testing.T) {
		permit, target := testRequest(t)
		executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
		entered, unblock := make(chan struct{}), make(chan struct{})
		defer close(unblock)
		executor.dial = func(ctx context.Context, _, _ string) (net.Conn, error) {
			close(entered)
			<-unblock
			return nil, ctx.Err()
		}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		finished := make(chan error, 1)
		go func() { _, err := executor.Run(ctx, permit, time.Second); finished <- err }()
		select {
		case <-entered:
		case err := <-finished:
			t.Fatalf("measurement stopped before dialing: %v", err)
		case <-time.After(3 * time.Second):
			t.Fatal("measurement did not reach dial")
		}
		cancel()
		another, _ := New(executor.resolve)
		if _, err := another.Run(context.Background(), permit, time.Second); !errors.Is(err, ErrBusy) {
			t.Fatalf("cancellation released admission before underlying work: %v", err)
		}
		// Unblock after the assertion, then wait for cleanup without releasing twice.
		unblock <- struct{}{}
		select {
		case err := <-finished:
			if err == nil {
				t.Fatal("late canceled dial returned evidence")
			}
		case <-time.After(3 * time.Second):
			t.Fatal("measurement did not finish after its network work stopped")
		}
	})
}

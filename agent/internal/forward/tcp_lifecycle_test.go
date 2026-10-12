package forward

import (
	"bufio"
	"io"
	"net"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

func tcpLifecycleTarget(t *testing.T, label string) contracts.Target {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	var mutex sync.Mutex
	connections := make(map[net.Conn]bool)
	var workers sync.WaitGroup
	accepted := make(chan struct{})
	go func() {
		defer close(accepted)
		for {
			client, err := listener.Accept()
			if err != nil {
				return
			}
			mutex.Lock()
			connections[client] = true
			workers.Add(1)
			mutex.Unlock()
			go func() {
				defer workers.Done()
				defer client.Close()
				defer func() { mutex.Lock(); delete(connections, client); mutex.Unlock() }()
				reader := bufio.NewReader(client)
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						return
					}
					if _, err := io.WriteString(client, label+":"+line); err != nil {
						return
					}
				}
			}()
		}
	}()
	t.Cleanup(func() {
		listener.Close()
		<-accepted
		mutex.Lock()
		for client := range connections {
			client.Close()
		}
		mutex.Unlock()
		workers.Wait()
	})
	return contracts.Target{Host: "127.0.0.1", Port: uint64(listener.Addr().(*net.TCPAddr).Port)}
}

func tcpLifecycleAssignment(t *testing.T, target contracts.Target) contracts.Assignment {
	t.Helper()
	reserved, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := reserved.Addr().(*net.TCPAddr).Port
	reserved.Close()
	return contracts.Assignment{Protocol: "tcp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: uint64(port)}, Driver: contracts.Driver{Id: "native.direct.v1", Config: contracts.DirectConfig{Target: target, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}}}
}

func tcpLifecycleStart(t *testing.T, assignment contracts.Assignment, limit uint64) *TCP {
	t.Helper()
	stream, err := Start(assignment, contracts.Policy{ConnectTimeoutSeconds: 1, MaxTcpConnectionsPerAssignment: limit})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(stream.Close)
	return stream
}

func tcpLifecycleDial(t *testing.T, assignment contracts.Assignment) net.Conn {
	t.Helper()
	client, err := net.DialTimeout("tcp", net.JoinHostPort(assignment.Listener.Address, strconv.FormatUint(assignment.Listener.Port, 10)), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Close() })
	return client
}

func tcpLifecycleExchange(t *testing.T, client net.Conn, want string) {
	t.Helper()
	client.SetDeadline(time.Now().Add(2 * time.Second))
	if _, err := io.WriteString(client, "payload\n"); err != nil {
		t.Fatal(err)
	}
	raw := make([]byte, len(want))
	if _, err := io.ReadFull(client, raw); err != nil {
		t.Fatal(err)
	}
	if string(raw) != want {
		t.Fatalf("payload %q, want %q", raw, want)
	}
	client.SetDeadline(time.Time{})
}

func tcpLifecycleRemaining(t *testing.T, stream *TCP, want uint64) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		got := stream.Remaining()
		if got == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("remaining streams %d, want %d", got, want)
		}
		time.Sleep(time.Millisecond)
	}
}

func tcpLifecycleRebind(t *testing.T, assignment contracts.Assignment) {
	t.Helper()
	listener, err := net.Listen("tcp", net.JoinHostPort(assignment.Listener.Address, strconv.FormatUint(assignment.Listener.Port, 10)))
	if err != nil {
		t.Fatal("listener was not reclaimed", err)
	}
	listener.Close()
}

func TestTCPSamePortReplacePreservesStreamsAndOwnership(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "old"))
	old := tcpLifecycleStart(t, assignment, 4)
	first := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, first, "old:payload\n")
	tcpLifecycleRemaining(t, old, 1)
	assignment.Driver.Config.Target = tcpLifecycleTarget(t, "new")
	next, err := old.Replace(assignment)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(next.Close)
	if next.slot != old.slot {
		t.Fatal("replacement must reuse the listening socket")
	}
	second := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, second, "new:payload\n")
	tcpLifecycleExchange(t, first, "old:payload\n")
	tcpLifecycleRemaining(t, old, 1)
	tcpLifecycleRemaining(t, next, 1)
	old.Drain()
	tcpLifecycleExchange(t, second, "new:payload\n")
	old.Close()
	tcpLifecycleRemaining(t, old, 0)
	tcpLifecycleExchange(t, second, "new:payload\n")
	third := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, third, "new:payload\n")
	next.Close()
	tcpLifecycleRemaining(t, next, 0)
	tcpLifecycleRebind(t, assignment)
}

func TestTCPDrainStopsAcceptingAndPreservesExistingStreams(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "kept"))
	stream := tcpLifecycleStart(t, assignment, 2)
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "kept:payload\n")
	stream.Drain()
	tcpLifecycleRemaining(t, stream, 1)
	tcpLifecycleExchange(t, client, "kept:payload\n")
	if next, err := net.DialTimeout("tcp", net.JoinHostPort(assignment.Listener.Address, strconv.FormatUint(assignment.Listener.Port, 10)), 250*time.Millisecond); err == nil {
		next.Close()
		t.Fatal("draining listener accepted a new client")
	}
	tcpLifecycleRebind(t, assignment)
	if next, err := stream.Replace(assignment); err == nil {
		next.Close()
		t.Fatal("drained listener resurrected")
	}
	stream.Close()
	tcpLifecycleRemaining(t, stream, 0)
	client.SetReadDeadline(time.Now().Add(time.Second))
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("Close did not reclaim draining stream")
	}
}

func TestTCPReplacementKeepsConnectionBudgetAcrossInstances(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "old"))
	old := tcpLifecycleStart(t, assignment, 1)
	first := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, first, "old:payload\n")
	assignment.Driver.Config.Target = tcpLifecycleTarget(t, "next")
	next, err := old.Replace(assignment)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(next.Close)
	rejected := tcpLifecycleDial(t, assignment)
	rejected.SetDeadline(time.Now().Add(time.Second))
	io.WriteString(rejected, "payload\n")
	if _, err := rejected.Read(make([]byte, 1)); err == nil {
		t.Fatal("replacement bypassed the shared connection limit")
	}
	tcpLifecycleRemaining(t, old, 1)
	tcpLifecycleRemaining(t, next, 0)
	old.Close()
	accepted := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, accepted, "next:payload\n")
}

func TestTCPReplaceValidationKeepsCurrentListener(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "same"))
	stream := tcpLifecycleStart(t, assignment, 2)
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "same:payload\n")
	changed := assignment
	changed.Listener.Port++
	if next, err := stream.Replace(changed); err == nil {
		next.Close()
		t.Fatal("changed binding accepted by Replace")
	}
	changed = assignment
	changed.Protocol = "udp"
	if next, err := stream.Replace(changed); err == nil {
		next.Close()
		t.Fatal("UDP configuration accepted by TCP")
	}
	tcpLifecycleExchange(t, client, "same:payload\n")
	newClient := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, newClient, "same:payload\n")
}

func TestTCPConnectionConfigIsImmutable(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "stable"))
	stream := tcpLifecycleStart(t, assignment, 2)
	assignment.Driver.Config.AllowedDestinationCidrs[0] = "10.0.0.0/8"
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "stable:payload\n")
	tcpLifecycleRemaining(t, stream, 1)
}

func TestTCPFailedDialReclaimsStreamBudget(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, contracts.Target{Host: "127.0.0.1", Port: 1})
	assignment.Driver.Config.AllowedDestinationCidrs = []string{"10.0.0.0/8"}
	old := tcpLifecycleStart(t, assignment, 1)
	client := tcpLifecycleDial(t, assignment)
	client.SetReadDeadline(time.Now().Add(time.Second))
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("disallowed target retained an open client")
	}
	tcpLifecycleRemaining(t, old, 0)
	assignment.Driver.Config.Target = tcpLifecycleTarget(t, "allowed")
	assignment.Driver.Config.AllowedDestinationCidrs = []string{"127.0.0.0/8"}
	next, err := old.Replace(assignment)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(next.Close)
	accepted := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, accepted, "allowed:payload\n")
}

func TestTCPConcurrentAcceptReplaceDrainAndClose(t *testing.T) {
	target := tcpLifecycleTarget(t, "race")
	for iteration := range 12 {
		assignment := tcpLifecycleAssignment(t, target)
		old := tcpLifecycleStart(t, assignment, 16)
		address := net.JoinHostPort(assignment.Listener.Address, strconv.FormatUint(assignment.Listener.Port, 10))
		var clients sync.WaitGroup
		firstDial := make(chan struct{}, 6)
		stop := make(chan struct{})
		for range 6 {
			clients.Add(1)
			go func() {
				defer clients.Done()
				first := true
				for {
					select {
					case <-stop:
						return
					default:
					}
					client, err := net.DialTimeout("tcp", address, 100*time.Millisecond)
					if first {
						firstDial <- struct{}{}
						first = false
					}
					if err != nil {
						continue
					}
					client.SetDeadline(time.Now().Add(100 * time.Millisecond))
					io.WriteString(client, "payload\n")
					bufio.NewReader(client).ReadString('\n')
					client.Close()
				}
			}()
		}
		for range 6 {
			<-firstDial
		}
		next, err := old.Replace(assignment)
		if err != nil {
			t.Fatal(err)
		}
		finished := make(chan struct{})
		go func() { old.Close(); next.Drain(); next.Close(); close(finished) }()
		select {
		case <-finished:
		case <-time.After(3 * time.Second):
			close(stop)
			clients.Wait()
			t.Fatalf("iteration %d: lifecycle cleanup stalled", iteration)
		}
		close(stop)
		clients.Wait()
		tcpLifecycleRemaining(t, old, 0)
		tcpLifecycleRemaining(t, next, 0)
		tcpLifecycleRebind(t, assignment)
	}
}

func TestTCPConcurrentReplacementsHaveOneListenerOwner(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "single"))
	old := tcpLifecycleStart(t, assignment, 4)
	var replacements sync.WaitGroup
	results := make(chan *TCP, 8)
	for range 8 {
		replacements.Add(1)
		go func() {
			defer replacements.Done()
			if next, err := old.Replace(assignment); err == nil {
				results <- next
			}
		}()
	}
	replacements.Wait()
	close(results)
	if len(results) != 1 {
		t.Fatalf("%d successor instances own a single listener", len(results))
	}
	next := <-results
	t.Cleanup(next.Close)
	old.Close()
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "single:payload\n")
}

func TestTCPFullCloseReleasesEveryGeneration(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "many"))
	stream := tcpLifecycleStart(t, assignment, 8)
	var generations []*TCP
	for generation := range 4 {
		generations = append(generations, stream)
		client := tcpLifecycleDial(t, assignment)
		tcpLifecycleExchange(t, client, "many:payload\n")
		tcpLifecycleRemaining(t, stream, 1)
		if generation == 3 {
			break
		}
		next, err := stream.Replace(assignment)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(next.Close)
		stream = next
	}
	stream.Drain()
	for _, generation := range generations {
		generation.Close()
		tcpLifecycleRemaining(t, generation, 0)
	}
	tcpLifecycleRebind(t, assignment)
}

func TestTCPDrainCompletesAfterPeerClosure(t *testing.T) {
	assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "drain"))
	stream := tcpLifecycleStart(t, assignment, 2)
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "drain:payload\n")
	stream.Drain()
	tcpLifecycleRemaining(t, stream, 1)
	client.Close()
	tcpLifecycleRemaining(t, stream, 0)
	stream.Close()
	tcpLifecycleRebind(t, assignment)
}

func tcpLifecycleNodeLimit(t *testing.T, capacity int) chan struct{} {
	t.Helper()
	previous := tcpNodePermits
	tcpNodePermits = make(chan struct{}, capacity)
	t.Cleanup(func() { tcpNodePermits = previous })
	return tcpNodePermits
}

func tcpLifecycleRejected(t *testing.T, assignment contracts.Assignment) {
	t.Helper()
	client := tcpLifecycleDial(t, assignment)
	client.SetDeadline(time.Now().Add(time.Second))
	io.WriteString(client, "payload\n")
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("node connection limit accepted another client")
	} else if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
		t.Fatal("node connection limit did not promptly reject the client")
	}
	client.Close()
}

func TestTCPNodeConnectionLimitIsSharedAcrossIndependentListeners(t *testing.T) {
	permits := tcpLifecycleNodeLimit(t, 1)
	target := tcpLifecycleTarget(t, "global")
	firstAssignment := tcpLifecycleAssignment(t, target)
	first := tcpLifecycleStart(t, firstAssignment, 4)
	secondAssignment := tcpLifecycleAssignment(t, target)
	second := tcpLifecycleStart(t, secondAssignment, 1)
	client := tcpLifecycleDial(t, firstAssignment)
	tcpLifecycleExchange(t, client, "global:payload\n")
	if len(permits) != 1 {
		t.Fatalf("node connections %d, want 1", len(permits))
	}
	// Each node-level rejection must also return its per-listener permit.
	for range 3 {
		tcpLifecycleRejected(t, secondAssignment)
	}
	tcpLifecycleRemaining(t, first, 1)
	tcpLifecycleRemaining(t, second, 0)
	first.Close()
	if len(permits) != 0 {
		t.Fatal("Close leaked a node connection permit")
	}
	successor := tcpLifecycleDial(t, secondAssignment)
	tcpLifecycleExchange(t, successor, "global:payload\n")
	second.Close()
	if len(permits) != 0 {
		t.Fatal("second listener leaked a node connection permit")
	}
}

func TestTCPNodeConnectionLimitIncludesOldDrainingGenerations(t *testing.T) {
	permits := tcpLifecycleNodeLimit(t, 1)
	target := tcpLifecycleTarget(t, "draining")
	assignment := tcpLifecycleAssignment(t, target)
	old := tcpLifecycleStart(t, assignment, 4)
	client := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, client, "draining:payload\n")
	next, err := old.Replace(assignment)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(next.Close)
	independentAssignment := tcpLifecycleAssignment(t, target)
	independent := tcpLifecycleStart(t, independentAssignment, 4)
	tcpLifecycleRejected(t, assignment)
	tcpLifecycleRejected(t, independentAssignment)
	old.Drain()
	if len(permits) != 1 {
		t.Fatal("retiring listener ownership released a still-live stream permit")
	}
	tcpLifecycleExchange(t, client, "draining:payload\n")
	old.Close()
	// This would hang if old.Close waited for the successor's accept loop.
	successor := tcpLifecycleDial(t, assignment)
	tcpLifecycleExchange(t, successor, "draining:payload\n")
	tcpLifecycleRejected(t, independentAssignment)
	next.Close()
	last := tcpLifecycleDial(t, independentAssignment)
	tcpLifecycleExchange(t, last, "draining:payload\n")
	independent.Close()
	if len(permits) != 0 {
		t.Fatal("draining generations leaked process connection permits")
	}
}

func TestTCPNodePermitReleasedAfterFailedDial(t *testing.T) {
	permits := tcpLifecycleNodeLimit(t, 1)
	unavailable, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { unavailable.Close() })
	assignment := tcpLifecycleAssignment(t, contracts.Target{Host: "127.0.0.1", Port: uint64(unavailable.Addr().(*net.TCPAddr).Port)})
	failed := tcpLifecycleStart(t, assignment, 1)
	unavailable.Close()
	client := tcpLifecycleDial(t, assignment)
	client.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, err := client.Read(make([]byte, 1)); err == nil {
		t.Fatal("failed dial retained the client")
	}
	tcpLifecycleRemaining(t, failed, 0)
	if len(permits) != 0 {
		t.Fatal("failed dial leaked its node connection permit")
	}
	liveAssignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "released"))
	live := tcpLifecycleStart(t, liveAssignment, 1)
	accepted := tcpLifecycleDial(t, liveAssignment)
	tcpLifecycleExchange(t, accepted, "released:payload\n")
	accepted.Close()
	tcpLifecycleRemaining(t, live, 0)
	if len(permits) != 0 {
		t.Fatal("peer closure leaked its node connection permit")
	}
}

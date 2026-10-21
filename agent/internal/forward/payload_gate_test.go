package forward

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

type payloadGateFunc func(context.Context, int, bool) (int, error)

func (gate payloadGateFunc) Acquire(ctx context.Context, size int, atomic bool) (int, error) {
	return gate(ctx, size, atomic)
}

type payloadWriteFunc func([]byte) (int, error)

func (write payloadWriteFunc) Write(data []byte) (int, error) { return write(data) }

func TestDirectEmptyDatagramStillChecksDurablePayloadPolicy(t *testing.T) {
	denied := errors.New("expired period, zero rate or exhausted quota")
	for _, failure := range []error{nil, denied} {
		calls := 0
		gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
			calls++
			if size != 0 || !atomic {
				t.Fatal("empty UDP lost atomic policy check", size, atomic)
			}
			return 0, failure
		})
		if n, err := reservePayload(context.Background(), gate, func() error { return nil }, 0, true); n != 0 || !errors.Is(err, failure) || calls != 1 {
			t.Fatal(n, err, calls)
		}
	}
}

func TestDirectPayloadDebitPrecedesEveryPartialStreamWrite(t *testing.T) {
	var trace []string
	gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
		if atomic {
			t.Fatal("TCP requested atomic datagram credit")
		}
		amount := min(size, 3)
		trace = append(trace, fmt.Sprintf("debit:%d", amount))
		return amount, nil
	})
	writer := quotaWriter{ctx: context.Background(), gate: gate, allow: func() error { return nil }, target: payloadWriteFunc(func(data []byte) (int, error) {
		trace = append(trace, "write:"+string(data))
		return len(data), nil
	})}
	if n, err := writer.Write([]byte("payload")); err != nil || n != 7 {
		t.Fatal(n, err)
	}
	want := []string{"debit:3", "write:pay", "debit:3", "write:loa", "debit:1", "write:d"}
	if !reflect.DeepEqual(trace, want) {
		t.Fatal(trace, want)
	}
}

func TestDirectPayloadFailedPersistenceRevocationAndInvalidAtomicCreditNeverWrite(t *testing.T) {
	failure := errors.New("durable debit failed")
	for _, scenario := range []string{"save", "revoked", "cancelled", "invalid"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			denied := false
			gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
				if !atomic {
					t.Fatal("UDP reservation is not atomic")
				}
				switch scenario {
				case "save":
					return 0, failure
				case "revoked":
					denied = true
				case "cancelled":
					cancel()
				case "invalid":
					return size - 1, nil
				}
				return size, nil
			})
			check := func() error {
				if denied {
					return failure
				}
				return nil
			}
			if _, err := reservePayload(ctx, gate, check, 4, true); err == nil {
				t.Fatal("uncommitted, revoked or partial datagram accepted")
			}
		})
	}
	var socket bytes.Buffer
	writer := quotaWriter{ctx: context.Background(), gate: payloadGateFunc(func(context.Context, int, bool) (int, error) { return 0, failure }), allow: func() error { return nil }, target: &socket}
	if n, err := writer.Write([]byte("secret")); n != 0 || !errors.Is(err, failure) || socket.Len() != 0 {
		t.Fatal("save failure reached socket", n, err, socket.String())
	}
}

func TestDirectPayloadSocketFailureKeepsItsConservativeDebit(t *testing.T) {
	debit := 0
	gate := payloadGateFunc(func(_ context.Context, size int, _ bool) (int, error) { debit += size; return size, nil })
	writer := quotaWriter{ctx: context.Background(), gate: gate, allow: func() error { return nil }, target: payloadWriteFunc(func([]byte) (int, error) { return 1, io.ErrClosedPipe })}
	if n, err := writer.Write([]byte("data")); n != 1 || !errors.Is(err, io.ErrClosedPipe) || debit != 4 {
		t.Fatal(n, err, debit)
	}
}

type countedPayloadGate struct {
	mutex  sync.Mutex
	bytes  int
	atomic []bool
}

func (gate *countedPayloadGate) Acquire(_ context.Context, size int, atomic bool) (int, error) {
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	amount := size
	if !atomic {
		amount = min(size, 3)
	}
	gate.bytes += amount
	gate.atomic = append(gate.atomic, atomic)
	return amount, nil
}

func TestDirectTCPAndUDPChargeBothDirectionsOnceOnTheirSharedInstanceGate(t *testing.T) {
	t.Run("tcp", func(t *testing.T) {
		assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "q"))
		gate := &countedPayloadGate{}
		stream, err := StartAuthorizedMetered(assignment, contracts.Policy{ConnectTimeoutSeconds: 1, MaxTcpConnectionsPerAssignment: 4}, func() error { return nil }, gate)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(stream.Close)
		client := tcpLifecycleDial(t, assignment)
		tcpLifecycleExchange(t, client, "q:payload\n")
		gate.mutex.Lock()
		defer gate.mutex.Unlock()
		if gate.bytes != 18 {
			t.Fatal("TCP payload counted twice or carrier bytes included", gate.bytes)
		}
		for _, atomic := range gate.atomic {
			if atomic {
				t.Fatal("TCP debit became atomic")
			}
		}
		if next, err := stream.Replace(assignment); err == nil {
			next.Close()
			t.Fatal("hostless replacement discarded immutable gate")
		}
	})
	t.Run("udp", func(t *testing.T) {
		assignment := udpTestAssignment(t, udpEchoTarget(t, "r:"))
		gate := &countedPayloadGate{}
		stream, err := StartUDPAuthorizedMetered(assignment, udpTestPolicy(), func() error { return nil }, gate)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(stream.Close)
		client := udpTestClient(t, stream)
		udpWrite(t, client, []byte("ping"))
		if reply := udpRead(t, client); string(reply) != "r:ping" {
			t.Fatal(string(reply))
		}
		gate.mutex.Lock()
		defer gate.mutex.Unlock()
		if gate.bytes != 10 || !reflect.DeepEqual(gate.atomic, []bool{true, true}) {
			t.Fatal("datagram payload reservation differs", gate.bytes, gate.atomic)
		}
		if next, err := stream.Replace(assignment); err == nil {
			next.Close()
			t.Fatal("UDP replacement discarded immutable gate")
		}
	})
}

func TestDirectUDPCloseCancelsWaitingDebitWithoutHoldingSessionOrListenerLocks(t *testing.T) {
	for _, direction := range []string{"request", "reply"} {
		t.Run(direction, func(t *testing.T) {
			entered := make(chan struct{})
			var calls atomic.Int32
			gate := payloadGateFunc(func(ctx context.Context, size int, atomic bool) (int, error) {
				call := calls.Add(1)
				if direction == "reply" && call == 1 {
					return size, nil
				}
				if !atomic {
					t.Fatal("non-atomic UDP wait")
				}
				close(entered)
				<-ctx.Done()
				return 0, ctx.Err()
			})
			assignment := udpTestAssignment(t, udpEchoTarget(t, ""))
			stream, err := StartUDPAuthorizedMetered(assignment, udpTestPolicy(), func() error { return nil }, gate)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(stream.Close)
			client := udpTestClient(t, stream)
			udpWrite(t, client, []byte("wait"))
			select {
			case <-entered:
			case <-time.After(2 * time.Second):
				t.Fatal("payload did not wait")
			}
			closed := make(chan struct{})
			go func() { stream.Close(); close(closed) }()
			select {
			case <-closed:
			case <-time.After(2 * time.Second):
				t.Fatal("Close deadlocked behind payload wait")
			}
		})
	}
}

func TestDirectTCPCloseCancelsWaitingDebitInEitherDirection(t *testing.T) {
	for _, direction := range []string{"request", "reply"} {
		t.Run(direction, func(t *testing.T) {
			entered := make(chan struct{})
			var calls atomic.Int32
			gate := payloadGateFunc(func(ctx context.Context, size int, atomic bool) (int, error) {
				if atomic {
					t.Fatal("TCP wait became atomic")
				}
				if calls.Add(1) == 1 && direction == "reply" {
					return size, nil
				}
				close(entered)
				<-ctx.Done()
				return 0, ctx.Err()
			})
			assignment := tcpLifecycleAssignment(t, tcpLifecycleTarget(t, "r"))
			stream, err := StartAuthorizedMetered(assignment, contracts.Policy{ConnectTimeoutSeconds: 1, MaxTcpConnectionsPerAssignment: 4}, func() error { return nil }, gate)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(stream.Close)
			client := tcpLifecycleDial(t, assignment)
			if _, err := io.WriteString(client, "payload\n"); err != nil {
				t.Fatal(err)
			}
			select {
			case <-entered:
			case <-time.After(2 * time.Second):
				t.Fatal("TCP gate did not wait")
			}
			closed := make(chan struct{})
			go func() { stream.Close(); close(closed) }()
			select {
			case <-closed:
			case <-time.After(2 * time.Second):
				t.Fatal("TCP Close did not cancel payload wait")
			}
		})
	}
}

func TestDirectUDPInsufficientAtomicCreditNeverSendsAnyDatagram(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	defer target.Close()
	entered := make(chan struct{})
	gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
		if size != 4 || !atomic {
			t.Error("invalid datagram request", size, atomic)
		}
		close(entered)
		return size - 1, nil
	})
	stream, err := StartUDPAuthorizedMetered(udpTestAssignment(t, target), udpTestPolicy(), func() error { return nil }, gate)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	udpWrite(t, udpTestClient(t, stream), []byte("data"))
	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("UDP debit not attempted")
	}
	target.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	if n, _, err := target.ReadFromUDP(make([]byte, 64)); n != 0 || err == nil {
		t.Fatal("insufficient credit forwarded datagram", n, err)
	}
}

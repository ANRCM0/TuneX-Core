package relay

import (
	"context"
	"errors"
	"io"
	"net"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionhost"
)

type payloadGateFunc func(context.Context, int, bool) (int, error)

func (gate payloadGateFunc) Acquire(ctx context.Context, size int, atomic bool) (int, error) {
	return gate(ctx, size, atomic)
}

func TestRelayAndTransitEmptyDatagramStillChecksDurablePayloadPolicy(t *testing.T) {
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

type machinePayloadGate struct {
	mutex  sync.Mutex
	bytes  int
	atomic []bool
}

func (gate *machinePayloadGate) Acquire(_ context.Context, size int, atomic bool) (int, error) {
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	amount := size
	if !atomic {
		amount = min(size, 2)
	}
	gate.bytes += amount
	gate.atomic = append(gate.atomic, atomic)
	return amount, nil
}

func (gate *machinePayloadGate) require(t *testing.T, bytes int, atomic bool) {
	t.Helper()
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	if gate.bytes != bytes {
		t.Fatalf("payload includes carrier, omits a direction or charges twice: got %d want %d", gate.bytes, bytes)
	}
	for _, actual := range gate.atomic {
		if actual != atomic {
			t.Fatal("wrong stream/datagram reservation mode", gate.atomic)
		}
	}
}

func payloadUDPTarget(t *testing.T) uint64 {
	t.Helper()
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		buffer := make([]byte, 16384)
		for {
			n, client, err := target.ReadFromUDP(buffer)
			if err != nil {
				return
			}
			target.WriteToUDP(append([]byte("reply:"), buffer[:n]...), client)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	return uint64(target.LocalAddr().(*net.UDPAddr).Port)
}

func exchangeMeteredPayload(t *testing.T, ingress *Engine, protocol string) {
	t.Helper()
	if protocol == "tcp" {
		client, err := net.Dial("tcp", ingress.listener.Addr().String())
		if err != nil {
			t.Fatal(err)
		}
		defer client.Close()
		client.SetDeadline(time.Now().Add(5 * time.Second))
		if _, err := client.Write([]byte("hello")); err != nil {
			t.Fatal(err)
		}
		if err := client.(*net.TCPConn).CloseWrite(); err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(client)
		if err != nil || string(data) != "reply:hello" {
			t.Fatal(string(data), err)
		}
		return
	}
	client, err := net.DialUDP("udp", nil, ingress.udp.LocalAddr().(*net.UDPAddr))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err := client.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	buffer := make([]byte, 64)
	n, err := client.Read(buffer)
	if err != nil || string(buffer[:n]) != "reply:hello" {
		t.Fatal(string(buffer[:n]), err)
	}
}

func TestRelayPayloadChargesIngressAndEgressOncePerDirectionExcludingHandshakeFramesAndFIN(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run(protocol, func(t *testing.T) {
			target := uint64(0)
			if protocol == "tcp" {
				target = tcpTarget(t, "reply:", true)
			} else {
				target = payloadUDPTarget(t)
			}
			ingressGate, egressGate := &machinePayloadGate{}, &machinePayloadGate{}
			ingress, egress := makeMeteredPair(t, protocol, target, 4, func() error { return nil }, ingressGate, egressGate)
			if ingress.payloadGate != ingressGate || egress.payloadGate != egressGate {
				t.Fatal("prepare omitted immutable machine gate")
			}
			if err := egress.Activate(); err != nil {
				t.Fatal(err)
			}
			if err := ingress.Activate(); err != nil {
				t.Fatal(err)
			}
			ingressGate.require(t, 0, protocol == "udp")
			egressGate.require(t, 0, protocol == "udp")
			exchangeMeteredPayload(t, ingress, protocol)
			ingressGate.require(t, 16, protocol == "udp")
			egressGate.require(t, 16, protocol == "udp")
			// Renewal changes authorization without replacing the shared bucket.
			ingress.SetAuthorization(func() error { return nil })
			egress.SetAuthorization(func() error { return nil })
			exchangeMeteredPayload(t, ingress, protocol)
			ingressGate.require(t, 32, protocol == "udp")
			egressGate.require(t, 32, protocol == "udp")
		})
	}
}

func TestMultihopPayloadEveryTransitChargesDecodedPayloadOnceRatherThanBothCarrierCopies(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run(protocol, func(t *testing.T) {
			gates := []*machinePayloadGate{{}, {}, {}, {}}
			ports := make([]executionhost.PayloadGate, len(gates))
			for index := range gates {
				ports[index] = gates[index]
			}
			target := uint64(0)
			if protocol == "tcp" {
				target = tcpTarget(t, "reply:", true)
			} else {
				target = payloadUDPTarget(t)
			}
			chain := meteredMultihopChain(t, len(gates), protocol, target, func() error { return nil }, ports)
			activateChain(t, chain)
			for _, gate := range gates {
				gate.require(t, 0, protocol == "udp")
			}
			exchangeMeteredPayload(t, chain[0], protocol)
			for _, gate := range gates {
				gate.require(t, 16, protocol == "udp")
			}
		})
	}
}

func TestRelayFailedDebitEmitsNoPayloadFrameAndRechecksAuthorityAfterWait(t *testing.T) {
	failure := errors.New("payload debit unavailable")
	for _, scenario := range []string{"save", "revoked", "cancelled", "invalid"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			denied := false
			gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
				if atomic {
					t.Fatal("TCP frame requested atomic credit")
				}
				switch scenario {
				case "save":
					return 0, failure
				case "revoked":
					denied = true
				case "cancelled":
					cancel()
				case "invalid":
					return size + 1, nil
				}
				return size, nil
			})
			// A nil transport makes any frame/header write before a successful
			// debit fail immediately; refusal must return before touching it.
			stream := &framedTCP{maximum: 8, payloadContext: ctx, payloadGate: gate, allow: func() error {
				if denied {
					return failure
				}
				return nil
			}}
			if n, err := stream.Write([]byte("secret")); n != 0 || err == nil {
				t.Fatal("uncommitted/revoked bytes reached carrier", n, err)
			}
		})
	}
	for _, amount := range []int{0, 3, 5} {
		gate := payloadGateFunc(func(_ context.Context, size int, atomic bool) (int, error) {
			if !atomic || size != 4 {
				t.Fatal("UDP split before reservation", size, atomic)
			}
			return amount, nil
		})
		if _, err := reservePayload(context.Background(), gate, func() error { return nil }, 4, true); err == nil {
			t.Fatal("partial datagram reservation accepted", amount)
		}
	}
}

func TestRelayUDPShutdownCancelsPayloadWaitAtIngressAndEgressBothDirections(t *testing.T) {
	for _, role := range []string{"ingress", "egress"} {
		for _, direction := range []string{"request", "reply"} {
			t.Run(role+"/"+direction, func(t *testing.T) {
				entered := make(chan struct{})
				var calls atomic.Int32
				gate := payloadGateFunc(func(ctx context.Context, size int, atomic bool) (int, error) {
					if !atomic {
						t.Fatal("UDP wait is not atomic")
					}
					if calls.Add(1) == 1 && direction == "reply" {
						return size, nil
					}
					close(entered)
					<-ctx.Done()
					return 0, ctx.Err()
				})
				var in, out executionhost.PayloadGate
				if role == "ingress" {
					in = gate
				} else {
					out = gate
				}
				ingress, egress := makeMeteredPair(t, "udp", payloadUDPTarget(t), 4, func() error { return nil }, in, out)
				if err := egress.Activate(); err != nil {
					t.Fatal(err)
				}
				if err := ingress.Activate(); err != nil {
					t.Fatal(err)
				}
				client, err := net.DialUDP("udp", nil, ingress.udp.LocalAddr().(*net.UDPAddr))
				if err != nil {
					t.Fatal(err)
				}
				defer client.Close()
				if _, err := client.Write([]byte("wait")); err != nil {
					t.Fatal(err)
				}
				select {
				case <-entered:
				case <-time.After(3 * time.Second):
					t.Fatal("payload gate did not wait")
				}
				engine := ingress
				if role == "egress" {
					engine = egress
				}
				closed := make(chan struct{})
				go func() { engine.Close(); close(closed) }()
				select {
				case <-closed:
				case <-time.After(3 * time.Second):
					t.Fatal("shutdown blocked behind payload reservation")
				}
			})
		}
	}
}

func TestRelayEmptyDatagramsAndControlDoNotMintPayloadDebits(t *testing.T) {
	gate := &machinePayloadGate{}
	if n, err := reservePayload(context.Background(), gate, func() error { return nil }, 0, true); n != 0 || err != nil {
		t.Fatal(n, err)
	}
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	if gate.bytes != 0 || !reflect.DeepEqual(gate.atomic, []bool(nil)) {
		t.Fatal("empty datagram requested a debit", gate.bytes, gate.atomic)
	}
}

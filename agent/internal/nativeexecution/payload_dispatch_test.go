package nativeexecution

import (
	"context"
	"errors"
	"fmt"
	"net"
	"slices"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
)

type nativePayloadGate func(context.Context, int, bool) (int, error)

func (gate nativePayloadGate) Acquire(ctx context.Context, size int, atomic bool) (int, error) {
	return gate(ctx, size, atomic)
}

func TestNativePayloadDriversExplicitlyAdvertiseEnforcement(t *testing.T) {
	for _, driver := range []executiondriver.Driver{Direct(), Relay(), Multihop()} {
		if !slices.Contains(driver.Descriptor.Capabilities, "shared-resource-limits.v1") {
			t.Fatal("driver can be selected without declared payload enforcement", driver.Descriptor.ID)
		}
	}
}

func TestNativeDirectHostPayloadRefusesBeforeAnyTCPOrUDPApplicationWrite(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run(protocol, func(t *testing.T) {
			var targetPort uint64
			var tcp net.Listener
			var udp *net.UDPConn
			var err error
			if protocol == "tcp" {
				tcp, err = net.Listen("tcp", "127.0.0.1:0")
				if err != nil {
					t.Fatal(err)
				}
				defer tcp.Close()
				targetPort = uint64(tcp.Addr().(*net.TCPAddr).Port)
			} else {
				udp, err = net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
				if err != nil {
					t.Fatal(err)
				}
				defer udp.Close()
				targetPort = uint64(udp.LocalAddr().(*net.UDPAddr).Port)
			}
			cidrs, revision, metadata := []string{"127.0.0.0/8"}, uint64(1), false
			assignment := adp3.Assignment{AssignmentId: "assignment", ForwardId: "forward", ForwardRevision: 1, DeploymentGeneration: 1, BindingFence: 1, Role: "direct", Protocol: protocol, Phase: "active", Resource: adp3.Resource{Address: "127.0.0.1", Port: nativePayloadFreePort(t, protocol), Protocol: protocol}, Driver: adp3.Driver{Id: "native.direct.v1", SchemaVersion: 1, Config: adp3.RuntimeConfig{Target: &adp3.Target{Host: "127.0.0.1", Port: targetPort}, EgressPolicyRevision: &revision, AllowMetadataTargets: &metadata, AllowedDestinationCidrs: &cidrs}}}
			entered := make(chan struct{})
			failure := errors.New("durable debit failed")
			host := executiondriver.Host{Policy: adp3.Policy{ConnectTimeoutSeconds: 1, UdpIdleTimeoutSeconds: 60, MaxTcpConnectionsPerAssignment: 4, MaxUdpSessionsPerAssignment: 4}, Payload: nativePayloadGate(func(ctx context.Context, size int, atomic bool) (int, error) {
				if ctx == nil || size < 1 || size > 6 || protocol == "udp" && size != 6 || atomic != (protocol == "udp") {
					t.Error("wrong native payload dispatch", size, atomic)
				}
				close(entered)
				return 0, failure
			})}
			instance, err := Direct().Start(host, assignment, func() error { return nil })
			if err != nil {
				t.Fatal(err)
			}
			defer instance.Close()
			client, err := net.Dial(protocol, net.JoinHostPort("127.0.0.1", fmt.Sprint(assignment.Resource.Port)))
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()
			if _, err := client.Write([]byte("secret")); err != nil {
				t.Fatal(err)
			}
			select {
			case <-entered:
			case <-time.After(2 * time.Second):
				t.Fatal("host payload gate was omitted")
			}
			if protocol == "tcp" {
				tcp.(*net.TCPListener).SetDeadline(time.Now().Add(time.Second))
				connection, err := tcp.Accept()
				if err != nil {
					t.Fatal(err)
				}
				defer connection.Close()
				connection.SetReadDeadline(time.Now().Add(time.Second))
				if n, err := connection.Read(make([]byte, 64)); n != 0 || err == nil {
					t.Fatal("TCP bypassed durable debit", n, err)
				}
			} else {
				udp.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				if n, _, err := udp.ReadFromUDP(make([]byte, 64)); n != 0 || err == nil {
					t.Fatal("UDP bypassed atomic durable debit", n, err)
				}
			}
		})
	}
}

func nativePayloadFreePort(t *testing.T, protocol string) uint64 {
	t.Helper()
	if protocol == "udp" {
		listener, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
		if err != nil {
			t.Fatal(err)
		}
		defer listener.Close()
		return uint64(listener.LocalAddr().(*net.UDPAddr).Port)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return uint64(listener.Addr().(*net.TCPAddr).Port)
}

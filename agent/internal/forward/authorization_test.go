package forward

import (
	"fmt"
	"github.com/tunex/vnext/agent/internal/contracts"
	"net"
	"sync/atomic"
	"testing"
	"time"
)

func TestTCPAuthorizationChecksBlockedReadBeforeForward(t *testing.T) {
	target, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer target.Close()
	received := make(chan string, 4)
	go func() {
		socket, err := target.Accept()
		if err != nil {
			return
		}
		defer socket.Close()
		buffer := make([]byte, 128)
		for {
			n, err := socket.Read(buffer)
			if n > 0 {
				received <- string(buffer[:n])
				socket.Write(buffer[:n])
			}
			if err != nil {
				return
			}
		}
	}()
	reservation, _ := net.Listen("tcp", "127.0.0.1:0")
	port := reservation.Addr().(*net.TCPAddr).Port
	reservation.Close()
	var expired atomic.Bool
	check := func() error {
		if expired.Load() {
			return fmt.Errorf("LEASE_EXPIRED")
		}
		return nil
	}
	assignment := contracts.Assignment{Protocol: "tcp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: uint64(port)}, Driver: contracts.Driver{Id: "native.direct.v1", Config: contracts.DirectConfig{Target: contracts.Target{Host: "127.0.0.1", Port: uint64(target.Addr().(*net.TCPAddr).Port)}, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}}}
	stream, err := StartAuthorized(assignment, contracts.Policy{ConnectTimeoutSeconds: 2, MaxTcpConnectionsPerAssignment: 2}, check)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	client, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(2 * time.Second))
	client.Write([]byte("before"))
	reply := make([]byte, 64)
	if n, err := client.Read(reply); err != nil || string(reply[:n]) != "before" {
		t.Fatal("authorized stream failed", err)
	}
	<-received
	expired.Store(true)
	client.Write([]byte("after"))
	client.Read(reply)
	select {
	case payload := <-received:
		t.Fatal("unauthorized payload reached target", payload)
	case <-time.After(50 * time.Millisecond):
	}
	if next, err := stream.ReplaceAuthorized(assignment, check); err == nil {
		next.Close()
		t.Fatal("replacement without authority bound listener")
	}
}
func TestUDPAuthorizationBlocksExistingAssociation(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1")})
	if err != nil {
		t.Fatal(err)
	}
	defer target.Close()
	received := make(chan string, 4)
	go func() {
		buffer := make([]byte, 128)
		for {
			n, addr, err := target.ReadFromUDP(buffer)
			if err != nil {
				return
			}
			received <- string(buffer[:n])
			target.WriteToUDP(buffer[:n], addr)
		}
	}()
	reservation, _ := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1")})
	port := reservation.LocalAddr().(*net.UDPAddr).Port
	reservation.Close()
	var expired atomic.Bool
	check := func() error {
		if expired.Load() {
			return fmt.Errorf("LEASE_EXPIRED")
		}
		return nil
	}
	assignment := contracts.Assignment{Protocol: "udp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: uint64(port)}, Driver: contracts.Driver{Id: "native.direct.v1", Config: contracts.DirectConfig{Target: contracts.Target{Host: "127.0.0.1", Port: uint64(target.LocalAddr().(*net.UDPAddr).Port)}, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}}}
	stream, err := StartUDPAuthorized(assignment, contracts.Policy{ConnectTimeoutSeconds: 2, MaxUdpSessionsPerAssignment: 2, UdpIdleTimeoutSeconds: 10}, check)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	client, err := net.Dial("udp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(time.Second))
	client.Write([]byte("before"))
	buffer := make([]byte, 64)
	if n, err := client.Read(buffer); err != nil || string(buffer[:n]) != "before" {
		t.Fatal("authorized UDP failed", err)
	}
	<-received
	expired.Store(true)
	client.Write([]byte("after"))
	select {
	case payload := <-received:
		t.Fatal("unauthorized UDP reached target", payload)
	case <-time.After(80 * time.Millisecond):
	}
}

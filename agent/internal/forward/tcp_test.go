package forward

import (
	"github.com/tunex/vnext/agent/internal/contracts"
	"io"
	"net"
	"net/netip"
	"strconv"
	"testing"
	"time"
)

func TestTargetPolicy(t *testing.T) {
	config := contracts.DirectConfig{AllowedDestinationCidrs: []string{"0.0.0.0/0", "::/0"}}
	for _, text := range []string{"169.254.169.254", "100.100.100.200", "fd00:ec2::254", "0.0.0.0", "::", "224.0.0.1", "::ffff:169.254.169.254"} {
		if Allowed(netip.MustParseAddr(text), config) {
			t.Fatal("sensitive target accepted", text)
		}
	}
	config.AllowedDestinationCidrs = []string{"127.0.0.0/8"}
	if !Allowed(netip.MustParseAddr("::ffff:127.0.0.1"), config) {
		t.Fatal("mapped IPv4 not normalized")
	}
	if Allowed(netip.MustParseAddr("10.0.0.1"), config) {
		t.Fatal("out-of-policy target accepted")
	}
}
func TestTCPHalfCloseAndCleanup(t *testing.T) {
	target, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer target.Close()
	go func() {
		for {
			socket, err := target.Accept()
			if err != nil {
				return
			}
			go func() {
				defer socket.Close()
				raw, _ := io.ReadAll(socket)
				socket.Write(append([]byte("reply:"), raw...))
			}()
		}
	}()
	portListener, _ := net.Listen("tcp", "127.0.0.1:0")
	port := portListener.Addr().(*net.TCPAddr).Port
	portListener.Close()
	targetPort := target.Addr().(*net.TCPAddr).Port
	assignment := contracts.Assignment{Protocol: "tcp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: uint64(port)}, Driver: contracts.Driver{Id: "native.direct.v1", Config: contracts.DirectConfig{Target: contracts.Target{Host: "127.0.0.1", Port: uint64(targetPort)}, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}}}
	stream, err := Start(assignment, contracts.Policy{ConnectTimeoutSeconds: 2, MaxTcpConnectionsPerAssignment: 2})
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	socket, err := net.DialTCP("tcp", nil, &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: port})
	if err != nil {
		t.Fatal(err)
	}
	defer socket.Close()
	socket.SetDeadline(time.Now().Add(3 * time.Second))
	socket.Write([]byte("payload"))
	socket.CloseWrite()
	raw, err := io.ReadAll(socket)
	if err != nil || string(raw) != "reply:payload" {
		t.Fatalf("half close %q %v", raw, err)
	}
	stream.Close()
	if next, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port))); err != nil {
		t.Fatal("listener not removed", err)
	} else {
		next.Close()
	}
}

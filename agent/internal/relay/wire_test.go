package relay

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"testing"
)

func testBinding() relaycontracts.Binding {
	return relaycontracts.Binding{ScopeId: "scope-a", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, IngressNodeId: "node-a", EgressNodeId: "node-b", IngressAssignmentId: "assignment-a", EgressAssignmentId: "assignment-b", IngressSessionEpoch: 2, EgressSessionEpoch: 3, IngressFence: 4, EgressFence: 5, ProfileId: "profile-a", ProfileRevision: 1, ProfileDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111"}
}
func TestOpenAndFrameBoundsAndPreparedGate(t *testing.T) {
	binding := testBinding()
	open := relaycontracts.Open{WireVersion: 1, Type: "open", Action: "probe", RequestId: "request-a", Binding: binding}
	var wire bytes.Buffer
	if err := WriteControl(&wire, "Open", open); err != nil {
		t.Fatal(err)
	}
	var decoded relaycontracts.Open
	if err := ReadControl(&wire, "Open", &decoded); err != nil {
		t.Fatal(err)
	}
	allow := func() error { return nil }
	if err := ValidateOpen(decoded, binding, true, allow); err != nil {
		t.Fatal(err)
	}
	if err := ValidateOpen(decoded, binding, false, allow); err == nil {
		t.Fatal("prepared downstream accepted")
	}
	stale := binding
	stale.EgressSessionEpoch++
	if err := ValidateOpen(decoded, stale, true, allow); err == nil {
		t.Fatal("stale session accepted")
	}
	if err := ValidateOpen(decoded, binding, true, func() error { return fmt.Errorf("LEASE_EXPIRED") }); err == nil {
		t.Fatal("expired authority accepted")
	}
	var large [4]byte
	binary.BigEndian.PutUint32(large[:], MaxControlBytes+1)
	if err := ReadControl(bytes.NewReader(large[:]), "Open", nil); err == nil {
		t.Fatal("large control allocated")
	}
	for _, p := range []struct {
		kind     byte
		protocol string
		data     []byte
	}{{FrameTCP, "tcp", []byte("payload")}, {FrameFIN, "tcp", nil}, {FrameUDP, "udp", nil}, {FrameClose, "udp", nil}} {
		wire.Reset()
		if err := WriteFrame(&wire, p.kind, p.data, p.protocol, 16384); err != nil {
			t.Fatal(err)
		}
		kind, data, err := ReadFrame(&wire, p.protocol, 16384)
		if err != nil || kind != p.kind || !bytes.Equal(data, p.data) {
			t.Fatal("frame mismatch", err)
		}
	}
	for _, p := range []struct {
		kind     byte
		protocol string
		data     []byte
	}{{FrameTCP, "udp", []byte("payload")}, {FrameFIN, "udp", nil}, {FrameFIN, "tcp", []byte("bad")}, {99, "tcp", nil}, {FrameUDP, "udp", make([]byte, 16385)}} {
		if err := WriteFrame(&wire, p.kind, p.data, p.protocol, 16384); err == nil {
			t.Fatal("invalid frame accepted")
		}
	}
}

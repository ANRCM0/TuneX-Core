package relay

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
)

const MultihopALPN = "tunex-multihop/1"

// PrepareMultihop reuses the bounded stream/UDP implementation, with a distinct
// validated execution contract and wire handshake. No legacy Relay peer accepts it.
func PrepareMultihop(a adp3.Assignment, identity Identity, maximum int, allow func() error) (*Engine, error) {
	version := uint64(1)
	h := a.Driver.Config.Hop
	if h == nil || len(h.Path) < 3 || h.HopIndex >= uint64(len(h.Path)) {
		return nil, fmt.Errorf("INVALID_CONFIG: Multi-hop configuration required")
	}
	if err := adp3.ValidateMultihopAssignment(a, h.Path[h.HopIndex].NodeId, h.Path[h.HopIndex].SessionEpoch, &version); err != nil {
		return nil, err
	}
	leaf := identity.Certificate.Leaf
	if leaf == nil && len(identity.Certificate.Certificate) > 0 {
		var err error
		leaf, err = x509.ParseCertificate(identity.Certificate.Certificate[0])
		if err != nil {
			return nil, err
		}
	}
	if leaf == nil || Fingerprint(leaf) != h.Path[h.HopIndex].PeerFingerprint {
		return nil, fmt.Errorf("AUTHENTICATION_FAILED: Local multi-hop credential differs")
	}
	synthetic, owned, err := projectMultihop(a, h)
	if err != nil {
		return nil, err
	}
	return prepare(synthetic, identity, maximum, allow, owned)
}

func hopBinding(h adp3.HopConfig, edge int) adp3relay.Binding {
	up, down := h.Path[edge], h.Path[edge+1]
	return adp3relay.Binding{ScopeId: h.ScopeId, ForwardId: h.ForwardId, ForwardRevision: h.ForwardRevision, DeploymentGeneration: h.DeploymentGeneration,
		ProfileId: h.ProfileId, ProfileRevision: h.ProfileRevision, ProfileDigest: h.ProfileDigest,
		IngressNodeId: up.NodeId, EgressNodeId: down.NodeId, IngressAssignmentId: up.AssignmentId, EgressAssignmentId: down.AssignmentId,
		IngressSessionEpoch: up.SessionEpoch, EgressSessionEpoch: down.SessionEpoch, IngressFence: up.BindingFence, EgressFence: down.BindingFence}
}
func (e *Engine) hasDownstream() bool {
	return e.assignment.Role == "relay-ingress" || e.multihop != nil && e.multihop.HopIndex < uint64(len(e.multihop.Path)-1)
}
func (e *Engine) peerTLS(outbound bool) (*tls.Config, error) {
	if e.multihop == nil {
		c := e.assignment.Driver.Config
		node := c.Binding.IngressNodeId
		if outbound {
			node = c.Binding.EgressNodeId
		}
		return TLSConfig(e.identity.Certificate, e.identity.Roots, node, c.PeerFingerprints, !outbound)
	}
	h := e.multihop
	index := int(h.HopIndex) - 1
	if outbound {
		index = int(h.HopIndex) + 1
	}
	if index < 0 || index >= len(h.Path) {
		return nil, fmt.Errorf("INVALID_CONFIG: Multi-hop neighbor missing")
	}
	peer := h.Path[index]
	return tlsConfigProtocol(e.identity.Certificate, e.identity.Roots, peer.NodeId, []string{peer.PeerFingerprint}, !outbound, MultihopALPN)
}
func (e *Engine) wireBinding(outbound bool) (relaycontracts.Binding, error) {
	if e.multihop == nil {
		return relayBinding(e.assignment.Driver.Config.Binding)
	}
	edge := int(e.multihop.HopIndex) - 1
	if outbound {
		edge = int(e.multihop.HopIndex)
	}
	return relayBinding(hopBinding(*e.multihop, edge))
}
func (e *Engine) wireDigest(binding relaycontracts.Binding) (string, error) {
	if e.multihop == nil {
		return contracts.ComputeDigest(binding)
	}
	return contracts.ComputeDigest(map[string]any{"binding": binding, "pathDigest": e.multihop.PathDigest})
}

type multihopOpen struct {
	WireVersion uint64                 `json:"wireVersion"`
	Type        string                 `json:"type"`
	Action      string                 `json:"action"`
	RequestId   string                 `json:"requestId"`
	Binding     relaycontracts.Binding `json:"binding"`
	PathDigest  string                 `json:"pathDigest"`
}

func (e *Engine) readOpen(r io.Reader) (relaycontracts.Open, error) {
	if e.multihop == nil {
		var open relaycontracts.Open
		err := ReadControl(r, "Open", &open)
		return open, err
	}
	raw, err := readControlPayload(r)
	if err != nil {
		return relaycontracts.Open{}, err
	}
	if _, err = contracts.ParseJSON(raw, 4096); err != nil {
		return relaycontracts.Open{}, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var v multihopOpen
	if err = decoder.Decode(&v); err != nil {
		return relaycontracts.Open{}, err
	}
	if v.PathDigest != e.multihop.PathDigest {
		return relaycontracts.Open{}, fmt.Errorf("AUTHORIZATION_DENIED: Multi-hop path differs")
	}
	open := relaycontracts.Open{WireVersion: v.WireVersion, Type: v.Type, Action: v.Action, RequestId: v.RequestId, Binding: v.Binding}
	raw, err = json.Marshal(open)
	if err != nil {
		return open, err
	}
	return open, relaycontracts.Parse("Open", raw, nil)
}
func (e *Engine) writeOpen(w io.Writer, open relaycontracts.Open) error {
	if e.multihop == nil {
		return WriteControl(w, "Open", open)
	}
	raw, err := json.Marshal(multihopOpen{open.WireVersion, open.Type, open.Action, open.RequestId, open.Binding, e.multihop.PathDigest})
	if err != nil {
		return err
	}
	return writeControlBytes(w, raw)
}
func (e *Engine) bridgeFrames(up, down *tls.Conn) {
	done := make(chan error, 2)
	idle := time.Duration(e.assignment.Driver.Config.Profile.IdleTimeoutSeconds) * time.Second
	var activity sync.Mutex
	touch := func() {
		activity.Lock()
		defer activity.Unlock()
		deadline := time.Now().Add(idle)
		up.SetReadDeadline(deadline)
		down.SetReadDeadline(deadline)
	}
	touch()
	maximum := int(e.assignment.Driver.Config.Profile.MaxFrameBytes)
	if e.assignment.Protocol == "udp" {
		maximum = int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes)
	}
	pump := func(from, to *tls.Conn) {
		for {
			if err := e.peerCheck(from); err != nil {
				done <- err
				return
			}
			kind, payload, err := ReadFrame(from, e.assignment.Protocol, maximum)
			if err != nil {
				done <- err
				return
			}
			if err = e.peerCheck(to); err != nil {
				done <- err
				return
			}
			to.SetWriteDeadline(time.Now().Add(time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds) * time.Second))
			if err = WriteFrame(to, kind, payload, e.assignment.Protocol, maximum); err != nil {
				done <- err
				return
			}
			// Refresh blocked reads without restarting a partially received frame.
			// Traffic in either direction keeps this association alive.
			touch()
			if kind == FrameClose {
				closeSocket(up)
				closeSocket(down)
			}
			if kind == FrameFIN || kind == FrameClose {
				done <- nil
				return
			}
		}
	}
	go pump(up, down)
	go pump(down, up)
	if err := <-done; err != nil {
		closeSocket(up)
		closeSocket(down)
	}
	<-done
}
func (e *Engine) serveTransit(client net.Conn, up *tls.Conn, open relaycontracts.Open, hash string) {
	down, err := e.dialPeer(open.Action)
	if err != nil {
		return
	}
	defer down.Close()
	defer e.untrackPeer(down)
	e.mutex.Lock()
	if e.check() != nil {
		e.mutex.Unlock()
		return
	}
	e.connections[client] = down
	e.mutex.Unlock()
	if err = WriteControl(up, "Accept", relaycontracts.Accept{WireVersion: 1, Type: "accepted", RequestId: open.RequestId, BindingDigest: hash}); err != nil {
		return
	}
	up.SetDeadline(time.Time{})
	e.bridgeFrames(up, down)
}

func writeControlBytes(w io.Writer, raw []byte) error {
	if len(raw) < 2 || len(raw) > MaxControlBytes {
		return fmt.Errorf("RESOURCE_LIMIT: Multi-hop control size")
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(raw)))
	if err := writeAll(w, header[:]); err != nil {
		return err
	}
	return writeAll(w, raw)
}

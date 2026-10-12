package forwarder

import (
	"bytes"
	"crypto/tls"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"reflect"
	"strconv"
	"time"

	"github.com/tunex/agent/internal/securelink"
)

var ErrRouteIdentity = errors.New("forwarder: routing hop identity or TTL rejected")

// RouteAuth is a private control-plane grant, never a client-supplied target.
// Every hop uses TLS 1.3 mTLS before consuming this revision-bound route header.
type RouteAuth struct {
	Version     int                  `json:"version"`
	WorkspaceID int                  `json:"workspace_id"`
	ForwardID   int                  `json:"forward_id"`
	Revision    int64                `json:"revision"`
	NodeIDs     []int                `json:"node_ids"`
	HopIndex    int                  `json:"hop_index"`
	Incoming    *securelink.Identity `json:"incoming,omitempty"`
	Outgoing    *securelink.Identity `json:"outgoing,omitempty"`
}

func routeURI(workspace, forward, node int, role string) string {
	return "urn:tunex:tst:w:" + strconv.Itoa(workspace) + ":l:" + strconv.Itoa(forward) + ":n:" + strconv.Itoa(node) + ":r:" + role
}

func (a *RouteAuth) validate(c TunnelConfig) error {
	if a == nil {
		return nil
	}
	if a.Version != 1 || a.WorkspaceID < 1 || a.WorkspaceID > 2147483647 || a.ForwardID < 1 || a.ForwardID > 2147483647 ||
		a.Revision != c.Revision || a.Revision < 1 || len(a.NodeIDs) < 2 || len(a.NodeIDs) > 3 || a.HopIndex < 0 || a.HopIndex >= len(a.NodeIDs) || c.Protocol != ProtocolTCP {
		return ErrRouteIdentity
	}
	seen := map[int]bool{}
	for _, node := range a.NodeIDs {
		if node < 1 || node > 2147483647 || seen[node] {
			return ErrRouteIdentity
		}
		seen[node] = true
	}
	if (a.HopIndex == 0 && (c.Mode != ModeRelay || a.Incoming != nil || a.Outgoing == nil)) ||
		(a.HopIndex > 0 && (c.Mode != ModeEgress || a.Incoming == nil)) ||
		(a.HopIndex == len(a.NodeIDs)-1) != (a.Outgoing == nil) {
		return ErrRouteIdentity
	}
	if a.Incoming != nil {
		if a.Incoming.OwnURI != routeURI(a.WorkspaceID, a.ForwardID, a.NodeIDs[a.HopIndex], "egress") ||
			a.Incoming.PeerURI != routeURI(a.WorkspaceID, a.ForwardID, a.NodeIDs[a.HopIndex-1], "ingress") {
			return ErrRouteIdentity
		}
		if _, err := securelink.RoutingTLSConfig(*a.Incoming); err != nil {
			return ErrRouteIdentity
		}
	}
	if a.Outgoing != nil {
		if a.Outgoing.OwnURI != routeURI(a.WorkspaceID, a.ForwardID, a.NodeIDs[a.HopIndex], "ingress") ||
			a.Outgoing.PeerURI != routeURI(a.WorkspaceID, a.ForwardID, a.NodeIDs[a.HopIndex+1], "egress") {
			return ErrRouteIdentity
		}
		if _, err := securelink.RoutingTLSConfig(*a.Outgoing); err != nil {
			return ErrRouteIdentity
		}
	}
	return nil
}

// The exact header has no address or port. Targets remain the EGRESS pool's grant.
func routeHeader(a *RouteAuth, recipient int) []byte {
	b := make([]byte, 40)
	copy(b, "TXR1")
	binary.BigEndian.PutUint32(b[4:8], uint32(a.WorkspaceID))
	binary.BigEndian.PutUint32(b[8:12], uint32(a.ForwardID))
	binary.BigEndian.PutUint64(b[12:20], uint64(a.Revision))
	b[20] = byte(len(a.NodeIDs))
	b[21] = byte(recipient)
	b[22] = byte(len(a.NodeIDs) - recipient)
	for i, n := range a.NodeIDs {
		binary.BigEndian.PutUint32(b[24+i*4:28+i*4], uint32(n))
	}
	return b
}

func routeIncoming(a *RouteAuth, raw net.Conn) (net.Conn, error) {
	cfg, err := securelink.RoutingTLSConfig(*a.Incoming)
	if err != nil {
		return nil, ErrRouteIdentity
	}
	conn := tls.Server(raw, cfg)
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	if err = conn.Handshake(); err != nil {
		return nil, ErrRouteIdentity
	}
	header := make([]byte, 40)
	if _, err = io.ReadFull(conn, header); err != nil || !bytes.Equal(header, routeHeader(a, a.HopIndex)) {
		return nil, ErrRouteIdentity
	}
	if _, err = conn.Write([]byte{1}); err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(time.Time{})
	return conn, nil
}

func routeOutgoing(a *RouteAuth, raw net.Conn) (net.Conn, error) {
	if a == nil || a.Outgoing == nil {
		return raw, nil
	}
	cfg, err := securelink.RoutingTLSConfig(*a.Outgoing)
	if err != nil {
		_ = raw.Close()
		return nil, ErrRouteIdentity
	}
	conn := tls.Client(raw, cfg)
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	if err = conn.Handshake(); err == nil {
		_, err = conn.Write(routeHeader(a, a.HopIndex+1))
	}
	if err == nil {
		var ack [1]byte
		_, err = io.ReadFull(conn, ack[:])
		if err == nil && ack[0] != 1 {
			err = ErrRouteIdentity
		}
	}
	if err != nil {
		_ = conn.Close()
		return nil, ErrRouteIdentity
	}
	_ = conn.SetDeadline(time.Time{})
	return conn, nil
}

func configureRouteAuth(t *pipeTracker) {
	if t.cfg.RouteAuth != nil && t.cfg.RouteAuth.Incoming != nil {
		t.wrapConn = func(raw net.Conn) (net.Conn, error) { return routeIncoming(t.cfg.RouteAuth, raw) }
	}
}

func sameRouteAuth(a, b *RouteAuth) bool { return reflect.DeepEqual(a, b) }

// PublicConfig removes private grants from heartbeat and unauthenticated health.
func (c TunnelConfig) PublicConfig() TunnelConfig { out := c.Clone(); out.RouteAuth = nil; return out }

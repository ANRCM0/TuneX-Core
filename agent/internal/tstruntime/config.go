// Package tstruntime owns leased, in-process TST placements. Transport secrets
// are retained only in the authenticated private cache, never observations.
package tstruntime

import (
	"bytes"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/tunex/agent/internal/portlease"
	"github.com/tunex/agent/internal/securelink"
)

type Config struct {
	ID              string          `json:"id"`
	LinkID          int64           `json:"link_id"`
	WorkspaceID     int64           `json:"workspace_id"`
	NodeID          int64           `json:"node_id"`
	Role            string          `json:"role"`
	Generation      int64           `json:"generation"`
	LeaseExpiresAt  string          `json:"lease_expires_at"`
	ConfigDigest    string          `json:"config_digest"`
	TransportConfig json.RawMessage `json:"transport_config"`
	RuntimeIDs      []string        `json:"runtime_ids"`
	Ports           []Port          `json:"ports"`
}
type Port struct {
	Protocol string `json:"protocol"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
}
type TransportConfig struct {
	Protocol    string              `json:"protocol"`
	Role        string              `json:"role"`
	WorkspaceID int64               `json:"workspace_id"`
	LinkID      int64               `json:"link_id"`
	NodeID      int64               `json:"node_id"`
	PeerNodeID  int64               `json:"peer_node_id"`
	CarrierHost string              `json:"carrier_host"`
	CarrierPort int                 `json:"carrier_port"`
	Identity    securelink.Identity `json:"identity"`
	Bindings    []Binding           `json:"bindings"`
}
type Binding struct {
	ForwardID           int64  `json:"forward_id"`
	Revision            int64  `json:"revision"`
	Protocol            string `json:"protocol"`
	ListenHost          string `json:"listen_host"`
	ListenPort          int    `json:"listen_port"`
	TargetHost          string `json:"target_host"`
	TargetPort          int    `json:"target_port"`
	BytesPerSecondIn    int64  `json:"bytes_per_second_in"`
	BytesPerSecondOut   int64  `json:"bytes_per_second_out"`
	MaxConnections      int    `json:"max_connections"`
	MaxConnectionsPerIP int    `json:"max_connections_per_ip"`
}
type Observation struct {
	UpdateMode          string         `json:"update_mode"`
	ID                  string         `json:"id"`
	LinkID              int64          `json:"link_id"`
	WorkspaceID         int64          `json:"workspace_id"`
	NodeID              int64          `json:"node_id"`
	Role                string         `json:"role"`
	Generation          int64          `json:"generation"`
	ObservedGeneration  int64          `json:"observed_generation"`
	ConfigDigest        string         `json:"config_digest"`
	DesiredConfigDigest string         `json:"desired_config_digest"`
	LeaseExpiresAt      string         `json:"lease_expires_at"`
	RuntimeIDs          []string       `json:"runtime_ids"`
	Ports               []Port         `json:"ports"`
	State               string         `json:"state"`
	Ready               bool           `json:"ready"`
	LastError           string         `json:"last_error,omitempty"`
	Logs                []string       `json:"logs,omitempty"`
	TrafficStatus       *TrafficStatus `json:"traffic_status,omitempty"`
	TargetStatus        []TargetStatus `json:"target_status,omitempty"`
}
type TrafficStatus struct {
	RotationSupported bool    `json:"rotation_supported"`
	ProducerCount     int     `json:"producer_count"`
	SampleCount       int     `json:"sample_count"`
	RuleCount         int     `json:"rule_count"`
	SpoolBytes        int64   `json:"spool_bytes"`
	LastAckAt         *string `json:"last_ack_at"`
	State             string  `json:"state"`
}
type TargetStatus struct {
	ForwardID     int64    `json:"forward_id"`
	States        []string `json:"states"`
	SelectedTCP   *int     `json:"selected_tcp,omitempty"`
	SelectedUDP   *int     `json:"selected_udp,omitempty"`
	LastCheckedAt *string  `json:"last_checked_at,omitempty"`
	Reason        string   `json:"reason"`
}

var (
	ErrInvalidConfig      = errors.New("tst: invalid config")
	ErrDigestMismatch     = errors.New("tst: config digest mismatch")
	ErrStaleGeneration    = errors.New("tst: stale generation")
	ErrGenerationConflict = errors.New("tst: generation content conflict")
	ErrIdentityMismatch   = errors.New("tst: placement identity mismatch")
	ErrIdentityExpired    = errors.New("tst: certificate expired")
	ErrAgentMismatch      = errors.New("tst: cache belongs to another agent")
	ErrLeaseExpired       = errors.New("tst: lease expired")
	ErrLeaseRegression    = errors.New("tst: lease regressed")
	ErrPortConflict       = errors.New("tst: listener conflict")
	ErrCache              = errors.New("tst: private cache unavailable or corrupt")
	ErrClosed             = errors.New("tst: manager closed")
	ErrStartFailed        = errors.New("tst: runtime start failed")
	ErrTraffic            = errors.New("tst: private accounting unavailable or full")
	ErrTrafficAck         = errors.New("tst: invalid traffic acknowledgement")
)

const maxRecords = 4096
const maxCacheBytes = 32 << 20

// CanonicalTransportConfig uses sorted object keys and exact integer numbers,
// matching the control plane without accepting ambiguous numeric encodings.
func CanonicalTransportConfig(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 || len(raw) > 1<<20 {
		return nil, ErrInvalidConfig
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	var v any
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF {
		return nil, ErrInvalidConfig
	}
	var out bytes.Buffer
	var enc func(any) error
	quoted := func(s string) {
		var b bytes.Buffer
		e := json.NewEncoder(&b)
		e.SetEscapeHTML(false)
		_ = e.Encode(s)
		out.WriteString(strings.TrimSuffix(b.String(), "\n"))
	}
	enc = func(v any) error {
		switch x := v.(type) {
		case nil:
			out.WriteString("null")
		case bool:
			out.WriteString(strconv.FormatBool(x))
		case string:
			quoted(x)
		case json.Number:
			n, e := x.Int64()
			if e != nil || n < -9007199254740991 || n > 9007199254740991 {
				return ErrInvalidConfig
			}
			out.WriteString(strconv.FormatInt(n, 10))
		case []any:
			out.WriteByte('[')
			for i, a := range x {
				if i > 0 {
					out.WriteByte(',')
				}
				if e := enc(a); e != nil {
					return e
				}
			}
			out.WriteByte(']')
		case map[string]any:
			ks := make([]string, 0, len(x))
			for k := range x {
				ks = append(ks, k)
			}
			sort.Strings(ks)
			out.WriteByte('{')
			for i, k := range ks {
				if i > 0 {
					out.WriteByte(',')
				}
				quoted(k)
				out.WriteByte(':')
				if e := enc(x[k]); e != nil {
					return e
				}
			}
			out.WriteByte('}')
		default:
			return ErrInvalidConfig
		}
		return nil
	}
	if e := enc(v); e != nil {
		return nil, e
	}
	return out.Bytes(), nil
}
func Digest(raw json.RawMessage) (string, error) {
	b, e := CanonicalTransportConfig(raw)
	if e != nil {
		return "", e
	}
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), nil
}
func identityURI(ws, link, node int64, role string) string {
	return fmt.Sprintf("urn:tunex:tst:w:%d:l:%d:n:%d:r:%s", ws, link, node, role)
}
func validateConfig(c *Config) (TransportConfig, time.Time, error) {
	var t TransportConfig
	if c.ID == "" || len(c.ID) > 256 || c.LinkID <= 0 || c.WorkspaceID <= 0 || c.NodeID <= 0 || c.Generation <= 0 || (c.Role != "ingress" && c.Role != "egress") || len(c.Ports) > 1000 || len(c.RuntimeIDs) > 1000 {
		return t, time.Time{}, ErrInvalidConfig
	}
	deadline, e := time.Parse(time.RFC3339Nano, c.LeaseExpiresAt)
	if e != nil {
		return t, deadline, ErrInvalidConfig
	}
	raw, e := CanonicalTransportConfig(c.TransportConfig)
	if e != nil {
		return t, deadline, e
	}
	digest, _ := Digest(raw)
	if c.ConfigDigest != digest {
		return t, deadline, ErrDigestMismatch
	}
	c.TransportConfig = raw
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(&t) != nil || t.Protocol != "tst/1" || t.PeerNodeID <= 0 || t.PeerNodeID == t.NodeID || t.CarrierPort < 1 || t.CarrierPort > 65535 || strings.TrimSpace(t.CarrierHost) == "" || len(t.Bindings) > 500 {
		return t, deadline, ErrInvalidConfig
	}
	if t.Role != c.Role || t.LinkID != c.LinkID || t.WorkspaceID != c.WorkspaceID || t.NodeID != c.NodeID {
		return t, deadline, ErrIdentityMismatch
	}
	peerRole := "egress"
	if c.Role == "egress" {
		peerRole = "ingress"
	}
	if t.Identity.PeerURI != identityURI(c.WorkspaceID, c.LinkID, t.PeerNodeID, peerRole) {
		return t, deadline, ErrIdentityMismatch
	}
	pair, e := tls.X509KeyPair([]byte(t.Identity.CertificatePEM), []byte(t.Identity.PrivateKeyPEM))
	if e != nil {
		return t, deadline, ErrInvalidConfig
	}
	cert, e := x509.ParseCertificate(pair.Certificate[0])
	if e != nil || len(cert.URIs) != 1 || cert.URIs[0].String() != identityURI(c.WorkspaceID, c.LinkID, c.NodeID, c.Role) {
		return t, deadline, ErrIdentityMismatch
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM([]byte(t.Identity.CAPEM)) {
		return t, deadline, ErrIdentityMismatch
	}
	intermediates := x509.NewCertPool()
	for _, der := range pair.Certificate[1:] {
		chain, e := x509.ParseCertificate(der)
		if e != nil {
			return t, deadline, ErrIdentityMismatch
		}
		intermediates.AddCert(chain)
	}
	// Authenticate cached certificate contents independent of the wall clock.
	// Expired credentials must remain readable so fresh Panel state can replace
	// them; current validity is enforced before starting a runtime.
	for _, usage := range []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth} {
		if _, e = cert.Verify(x509.VerifyOptions{Roots: roots, Intermediates: intermediates, CurrentTime: cert.NotBefore.Add(time.Nanosecond), DNSName: fmt.Sprintf("tst-node-%d.tunex.invalid", c.NodeID), KeyUsages: []x509.ExtKeyUsage{usage}}); e != nil {
			return t, deadline, ErrIdentityMismatch
		}
	}
	if _, e = securelink.TLSConfig(t.Identity); e != nil {
		return t, deadline, ErrInvalidConfig
	}
	ports := []Port{}
	ids := map[int64]bool{}
	if c.Role == "egress" {
		ports = append(ports, Port{"tcp", t.CarrierHost, t.CarrierPort})
	}
	for _, b := range t.Bindings {
		if b.ForwardID <= 0 || b.Revision <= 0 || ids[b.ForwardID] || (b.Protocol != "tcp" && b.Protocol != "udp" && b.Protocol != "both") || b.BytesPerSecondIn < 0 || b.BytesPerSecondOut < 0 || b.BytesPerSecondIn > 1<<40 || b.BytesPerSecondOut > 1<<40 || b.MaxConnections < 0 || b.MaxConnections > 4096 || b.MaxConnectionsPerIP < 0 || b.MaxConnectionsPerIP > 4096 {
			return t, deadline, ErrInvalidConfig
		}
		ids[b.ForwardID] = true
		if c.Role == "ingress" {
			if b.ListenPort < 1 || b.ListenPort > 65535 || b.TargetHost != "" || b.TargetPort != 0 {
				return t, deadline, ErrInvalidConfig
			}
			for _, p := range []string{"tcp", "udp"} {
				if b.Protocol == p || b.Protocol == "both" {
					ports = append(ports, Port{p, b.ListenHost, b.ListenPort})
				}
			}
		} else {
			if strings.TrimSpace(b.TargetHost) == "" || b.TargetPort < 1 || b.TargetPort > 65535 {
				return t, deadline, ErrInvalidConfig
			}
		}
	}
	if len(ports) != len(c.Ports) {
		return t, deadline, ErrInvalidConfig
	}
	seen := map[Port]bool{}
	for _, p := range ports {
		for prev := range seen {
			if portsConflict(prev, p) {
				return t, deadline, ErrPortConflict
			}
		}
		seen[p] = true
	}
	for _, p := range c.Ports {
		if !seen[p] {
			return t, deadline, ErrInvalidConfig
		}
		delete(seen, p)
	}
	rids := map[string]bool{}
	for _, id := range c.RuntimeIDs {
		if id == "" || len(id) > 256 || rids[id] {
			return t, deadline, ErrInvalidConfig
		}
		rids[id] = true
	}
	return t, deadline, nil
}
func portsConflict(a, b Port) bool {
	return portlease.New(a.Protocol, a.Port, a.Host).Conflicts(portlease.New(b.Protocol, b.Port, b.Host))
}
func cloneConfig(c Config) Config {
	c.TransportConfig = append(json.RawMessage(nil), c.TransportConfig...)
	c.Ports = append([]Port(nil), c.Ports...)
	c.RuntimeIDs = append([]string(nil), c.RuntimeIDs...)
	return c
}
func fingerprint(c Config) string {
	c.Generation = 0
	c.LeaseExpiresAt = ""
	c.TransportConfig = nil
	b, _ := json.Marshal(c)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

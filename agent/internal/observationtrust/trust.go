// Package observationtrust verifies public, pinned observation identities without loading keys or Agent state.
package observationtrust

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const InterfaceVersion uint64 = 1
const ALPN = "tunex-observation/1"
const MaximumContextBytes = 16384
const MaximumCertificateBytes = 8192
const MaximumTLSWireBytes = 32768
const maximumCounter = 9007199254740991
const maximumTime = 253402300799999
const maximumValidity = 7 * 24 * time.Hour

var scopePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var servicePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
var labelPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
var hashPattern = regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
var deniedPrefixes = []netip.Prefix{netip.MustParsePrefix("0.0.0.0/8"), netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("100.100.100.200/32"), netip.MustParsePrefix("fd00:ec2::254/128"), netip.MustParsePrefix("fe80::/10")}

type Endpoint struct {
	Address string `json:"address"`
	Port    uint64 `json:"port"`
}

type LeafPin struct {
	Mode           string `json:"mode"`
	ServerName     string `json:"serverName"`
	CertificateDer string `json:"certificateDer"`
}

type Config struct {
	Version    uint64   `json:"version"`
	Purpose    string   `json:"purpose"`
	Endpoint   Endpoint `json:"endpoint"`
	Trust      LeafPin  `json:"trust"`
	ValidFrom  uint64   `json:"validFrom"`
	ValidUntil uint64   `json:"validUntil"`
}

// All fields are values, so copying this context detaches every execution-relevant field.
type Context struct {
	ScopeID        string `json:"scopeId"`
	ServiceID      string `json:"serviceId"`
	Revision       uint64 `json:"revision"`
	ConfigRevision uint64 `json:"configRevision"`
	ConfigDigest   string `json:"configDigest"`
	ContextDigest  string `json:"contextDigest"`
	Config         Config `json:"config"`
}

type Verification struct {
	Version         string
	ALPN            string
	LeafFingerprint string
	Verified        bool
}

type Trust struct {
	context Context
	leaf    *x509.Certificate
	pin     [32]byte
}

func invalid() error {
	return fmt.Errorf("OBSERVATION_TRUST_DENIED: fixed public service identity unavailable")
}

func AddressAllowed(text string) bool {
	address, err := netip.ParseAddr(text)
	if err != nil || address.String() != text || address.Zone() != "" || address.Is4In6() || address.IsUnspecified() ||
		address.IsMulticast() || address.IsLinkLocalUnicast() || address.IsLinkLocalMulticast() ||
		!(address.IsGlobalUnicast() || address.IsLoopback()) || address.Is4() && address.As4()[0] >= 224 {
		return false
	}
	for _, prefix := range deniedPrefixes {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}

func serverName(text string) bool {
	if len(text) < 1 || len(text) > 253 || !strings.Contains(text, ".") {
		return false
	}
	if _, err := netip.ParseAddr(text); err == nil {
		return false
	}
	for _, label := range strings.Split(text, ".") {
		if !labelPattern.MatchString(label) {
			return false
		}
	}
	return true
}

func configValue(config Config) map[string]any {
	return map[string]any{"version": config.Version, "purpose": config.Purpose,
		"endpoint":  map[string]any{"address": config.Endpoint.Address, "port": config.Endpoint.Port},
		"trust":     map[string]any{"mode": config.Trust.Mode, "serverName": config.Trust.ServerName, "certificateDer": config.Trust.CertificateDer},
		"validFrom": config.ValidFrom, "validUntil": config.ValidUntil}
}

func publicDigest(value map[string]any) (string, error) {
	// This closed shape contains only ASCII-restricted strings and safe unsigned integers; sorted JSON maps match JCS here.
	raw, err := json.Marshal(value)
	if err != nil {
		return "", invalid()
	}
	hash := sha256.Sum256(raw)
	return "sha256:" + hex.EncodeToString(hash[:]), nil
}

func New(context Context, now time.Time) (*Trust, error) {
	config := context.Config
	if !scopePattern.MatchString(context.ScopeID) || !servicePattern.MatchString(context.ServiceID) ||
		context.Revision < 1 || context.Revision > maximumCounter || context.ConfigRevision < 1 || context.ConfigRevision > 64 || context.Revision < context.ConfigRevision ||
		!hashPattern.MatchString(context.ConfigDigest) || !hashPattern.MatchString(context.ContextDigest) || config.Version != 1 ||
		config.Purpose != "direct-ingress-tls-handshake" || !AddressAllowed(config.Endpoint.Address) || config.Endpoint.Port < 1 || config.Endpoint.Port > 65535 ||
		config.Trust.Mode != "pinned-leaf-v1" || !serverName(config.Trust.ServerName) || config.ValidFrom > maximumTime || config.ValidUntil > maximumTime ||
		config.ValidUntil <= config.ValidFrom || config.ValidUntil-config.ValidFrom > uint64(maximumValidity/time.Millisecond) {
		return nil, invalid()
	}
	raw, err := json.Marshal(context)
	if err != nil || len(raw) > MaximumContextBytes {
		return nil, invalid()
	}
	encoded := config.Trust.CertificateDer
	if len(encoded) < 4 || len(encoded) > base64.StdEncoding.EncodedLen(MaximumCertificateBytes) {
		return nil, invalid()
	}
	der, err := base64.StdEncoding.Strict().DecodeString(encoded)
	if err != nil || len(der) < 1 || len(der) > MaximumCertificateBytes || base64.StdEncoding.EncodeToString(der) != encoded {
		return nil, invalid()
	}
	configDigest, err := publicDigest(configValue(config))
	if err != nil || configDigest != context.ConfigDigest {
		return nil, invalid()
	}
	contextDigest, err := publicDigest(map[string]any{"scopeId": context.ScopeID, "serviceId": context.ServiceID,
		"revision": context.Revision, "configRevision": context.ConfigRevision, "configDigest": context.ConfigDigest, "config": configValue(config)})
	if err != nil || contextDigest != context.ContextDigest {
		return nil, invalid()
	}
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, invalid()
	}
	value := &Trust{context: context, leaf: leaf, pin: sha256.Sum256(der)}
	if err := value.Current(now); err != nil {
		return nil, err
	}
	return value, nil
}

func (trust *Trust) Context() Context { return trust.context }
func (trust *Trust) ValidUntil() time.Time {
	return time.UnixMilli(int64(trust.context.Config.ValidUntil))
}
func (trust *Trust) Fingerprint() string { return "sha256:" + hex.EncodeToString(trust.pin[:]) }

func exactSAN(leaf *x509.Certificate, name, uri string) bool {
	count := 0
	for _, extension := range leaf.Extensions {
		if !extension.Id.Equal(asn1.ObjectIdentifier{2, 5, 29, 17}) {
			continue
		}
		count++
		var sequence asn1.RawValue
		rest, err := asn1.Unmarshal(extension.Value, &sequence)
		if err != nil || len(rest) != 0 || sequence.Class != 0 || sequence.Tag != 16 || !sequence.IsCompound {
			return false
		}
		remaining, dns, service := sequence.Bytes, 0, 0
		for len(remaining) > 0 {
			var value asn1.RawValue
			remaining, err = asn1.Unmarshal(remaining, &value)
			if err != nil || value.Class != 2 || value.IsCompound {
				return false
			}
			switch value.Tag {
			case 2:
				if string(value.Bytes) != name {
					return false
				}
				dns++
			case 6:
				if string(value.Bytes) != uri {
					return false
				}
				service++
			default:
				return false
			}
		}
		if dns != 1 || service != 1 {
			return false
		}
	}
	return count == 1
}

func (trust *Trust) validLeaf(leaf *x509.Certificate, now time.Time) error {
	config := trust.context.Config
	uri := "urn:tunex:observation-service:" + url.QueryEscape(trust.context.ScopeID) + ":" + trust.context.ServiceID
	if leaf == nil || len(leaf.Raw) < 1 || len(leaf.Raw) > MaximumCertificateBytes || leaf.IsCA ||
		len(leaf.ExtKeyUsage) != 1 || leaf.ExtKeyUsage[0] != x509.ExtKeyUsageServerAuth || len(leaf.UnknownExtKeyUsage) != 0 || len(leaf.UnhandledCriticalExtensions) != 0 ||
		len(leaf.DNSNames) != 1 || leaf.DNSNames[0] != config.Trust.ServerName || len(leaf.URIs) != 1 || leaf.URIs[0] == nil || leaf.URIs[0].String() != uri ||
		len(leaf.IPAddresses) != 0 || len(leaf.EmailAddresses) != 0 || !exactSAN(leaf, config.Trust.ServerName, uri) ||
		now.Before(leaf.NotBefore) || !now.Before(leaf.NotAfter) || time.UnixMilli(int64(config.ValidFrom)).Before(leaf.NotBefore) || trust.ValidUntil().After(leaf.NotAfter) {
		return invalid()
	}
	switch key := leaf.PublicKey.(type) {
	case *rsa.PublicKey:
		if key.N == nil || key.N.BitLen() < 2048 || key.N.BitLen() > 8192 || key.E < 3 {
			return invalid()
		}
	case *ecdsa.PublicKey:
		if key.Curve != elliptic.P256() && key.Curve != elliptic.P384() && key.Curve != elliptic.P521() {
			return invalid()
		}
	case ed25519.PublicKey:
		if len(key) != ed25519.PublicKeySize {
			return invalid()
		}
	default:
		return invalid()
	}
	return nil
}

func (trust *Trust) Current(now time.Time) error {
	if trust == nil || now.Before(time.UnixMilli(int64(trust.context.Config.ValidFrom))) || !now.Before(trust.ValidUntil()) {
		return invalid()
	}
	return trust.validLeaf(trust.leaf, now)
}

func (trust *Trust) VerifyConnection(state tls.ConnectionState, now time.Time) (*Verification, error) {
	if err := trust.Current(now); err != nil {
		return nil, err
	}
	if state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != ALPN || state.ServerName != trust.context.Config.Trust.ServerName ||
		state.DidResume || len(state.PeerCertificates) != 1 {
		return nil, invalid()
	}
	leaf := state.PeerCertificates[0]
	if leaf == nil {
		return nil, invalid()
	}
	pin := sha256.Sum256(leaf.Raw)
	if subtle.ConstantTimeCompare(pin[:], trust.pin[:]) != 1 {
		return nil, invalid()
	}
	if err := trust.validLeaf(leaf, now); err != nil {
		return nil, err
	}
	return &Verification{Version: "TLSv1.3", ALPN: ALPN, LeafFingerprint: trust.Fingerprint(), Verified: true}, nil
}

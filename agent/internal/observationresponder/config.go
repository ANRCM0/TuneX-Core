// Package observationresponder serves dedicated operator TLS observations, not Agent execution or forwarding.
package observationresponder

import (
	"fmt"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const ALPN = "tunex-observation/1"
const DefaultMaxConnections = 16
const MaximumConnections = 64
const DefaultHandshakesPerSecond = 16
const MaximumHandshakesPerSecond = 64
const HandshakeTimeout = 2 * time.Second
const ConnectionTimeout = 3 * time.Second
const MaximumLifetime = 7 * 24 * time.Hour
const MaximumAllowedCIDRs = 32
const MaximumPEMBytes = 16384
const MaximumLeafDERBytes = 8192

var scopePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var servicePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
var dnsLabelPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
var metadataPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("100.100.100.200/32"),
	netip.MustParsePrefix("fd00:ec2::254/128"),
	netip.MustParsePrefix("fe80::/10"),
}

// Config accepts only explicit operator inputs. It cannot select an upstream or a business identity.
type Config struct {
	ScopeID             string
	ServiceID           string
	ServerName          string
	Listen              string
	CertificatePath     string
	PrivateKeyPath      string
	AllowCIDRs          []string
	ValidUntil          string
	MaxConnections      int
	HandshakesPerSecond int
}

type configuration struct {
	scopeID, serviceID, serverName, certificatePath, privateKeyPath string
	listen                                                          netip.AddrPort
	allowed                                                         []netip.Prefix
	validUntil                                                      time.Time
	maxConnections, handshakesPerSecond                             int
	uri                                                             string
}

func canonicalServerName(value string) bool {
	if len(value) < 1 || len(value) > 253 || strings.ToLower(value) != value || strings.HasSuffix(value, ".") {
		return false
	}
	if !strings.Contains(value, ".") {
		return false
	}
	if _, err := netip.ParseAddr(value); err == nil {
		return false
	}
	for _, label := range strings.Split(value, ".") {
		if !dnsLabelPattern.MatchString(label) {
			return false
		}
	}
	return true
}

func permittedAddress(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" || address.Is4In6() || address.IsUnspecified() ||
		address.IsMulticast() || address.IsLinkLocalUnicast() || address.IsLinkLocalMulticast() ||
		!(address.IsGlobalUnicast() || address.IsLoopback()) || address.Is4() && address.As4()[0] >= 224 {
		return false
	}
	for _, prefix := range metadataPrefixes {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}

func parseConfig(input Config, now time.Time) (configuration, error) {
	if !scopePattern.MatchString(input.ScopeID) || !servicePattern.MatchString(input.ServiceID) || !canonicalServerName(input.ServerName) {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: explicit Scope, service and canonical DNS identity required")
	}
	if len(input.Listen) < 1 || len(input.Listen) > 64 || len(input.ValidUntil) != 24 {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: bounded numeric endpoint and canonical expiry required")
	}
	listen, err := netip.ParseAddrPort(input.Listen)
	if err != nil || listen.Port() == 0 || listen.String() != input.Listen || !permittedAddress(listen.Addr()) {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: exact numeric unicast listen address and nonzero port required")
	}
	until, err := time.Parse("2006-01-02T15:04:05.000Z", input.ValidUntil)
	if err != nil || until.Format("2006-01-02T15:04:05.000Z") != input.ValidUntil || until.UnixMilli() < 0 ||
		!until.After(now) || until.Sub(now) > MaximumLifetime {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: canonical UTC millisecond expiry within seven days required")
	}
	if input.MaxConnections == 0 {
		input.MaxConnections = DefaultMaxConnections
	}
	if input.HandshakesPerSecond == 0 {
		input.HandshakesPerSecond = DefaultHandshakesPerSecond
	}
	if input.MaxConnections < 1 || input.MaxConnections > MaximumConnections || input.HandshakesPerSecond < 1 || input.HandshakesPerSecond > MaximumHandshakesPerSecond ||
		len(input.AllowCIDRs) < 1 || len(input.AllowCIDRs) > MaximumAllowedCIDRs {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: bounded connection, handshake and source CIDR limits required")
	}
	allowed := make([]netip.Prefix, 0, len(input.AllowCIDRs))
	seen := make(map[netip.Prefix]bool, len(input.AllowCIDRs))
	for _, value := range input.AllowCIDRs {
		if len(value) < 1 || len(value) > 64 {
			return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: bounded source CIDR required")
		}
		prefix, err := netip.ParsePrefix(value)
		if err != nil || prefix.Addr().Is4In6() || prefix.Masked().String() != value || seen[prefix] {
			return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: distinct canonical source CIDRs required")
		}
		seen[prefix] = true
		allowed = append(allowed, prefix)
	}
	if input.CertificatePath == "" || input.PrivateKeyPath == "" || len(input.CertificatePath) > 4096 || len(input.PrivateKeyPath) > 4096 ||
		strings.ContainsAny(input.CertificatePath+input.PrivateKeyPath, "\x00\r\n") {
		return configuration{}, fmt.Errorf("OBSERVATION_CONFIG_INVALID: explicit operator certificate and key paths required")
	}
	return configuration{scopeID: input.ScopeID, serviceID: input.ServiceID, serverName: input.ServerName,
		certificatePath: input.CertificatePath, privateKeyPath: input.PrivateKeyPath, listen: listen, allowed: allowed,
		validUntil: until, maxConnections: input.MaxConnections, handshakesPerSecond: input.HandshakesPerSecond,
		uri: "urn:tunex:observation-service:" + url.QueryEscape(input.ScopeID) + ":" + input.ServiceID}, nil
}

func (config configuration) allows(source netip.Addr) bool {
	source = source.Unmap()
	if !permittedAddress(source) {
		return false
	}
	for _, prefix := range config.allowed {
		if prefix.Addr().BitLen() == source.BitLen() && prefix.Contains(source) {
			return true
		}
	}
	return false
}

// Package transitcontracts verifies proposed ADP/3-external Transit intent
// descriptions. Validation does NOT grant authority or enable Transit in Agent.
package transitcontracts

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/netip"
	"strings"
	"sync"
	"time"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var contractSchema *jsonschema.Schema
var schemaError error

type Neighbor struct {
	NodeId          string `json:"nodeId"`
	AssignmentId    string `json:"assignmentId"`
	SessionEpoch    uint64 `json:"sessionEpoch"`
	BindingFence    uint64 `json:"bindingFence"`
	PeerFingerprint string `json:"peerFingerprint"`
}
type Endpoint struct {
	Host string `json:"host"`
	Port uint64 `json:"port"`
}
type Downstream struct {
	NodeId          string   `json:"nodeId"`
	AssignmentId    string   `json:"assignmentId"`
	SessionEpoch    uint64   `json:"sessionEpoch"`
	BindingFence    uint64   `json:"bindingFence"`
	PeerFingerprint string   `json:"peerFingerprint"`
	Endpoint        Endpoint `json:"endpoint"`
}
type Listener struct {
	Address  string `json:"address"`
	Port     uint64 `json:"port"`
	Protocol string `json:"protocol"`
}
type TransitIntent struct {
	ContractVersion         uint64     `json:"contractVersion"`
	Role                    string     `json:"role"`
	Driver                  string     `json:"driver"`
	Security                string     `json:"security"`
	ScopeId                 string     `json:"scopeId"`
	ForwardId               string     `json:"forwardId"`
	ForwardRevision         uint64     `json:"forwardRevision"`
	DeploymentGeneration    uint64     `json:"deploymentGeneration"`
	ProfileId               string     `json:"profileId"`
	ProfileRevision         uint64     `json:"profileRevision"`
	ProfileDigest           string     `json:"profileDigest"`
	PathDigest              string     `json:"pathDigest"`
	NodeId                  string     `json:"nodeId"`
	AssignmentId            string     `json:"assignmentId"`
	SessionEpoch            uint64     `json:"sessionEpoch"`
	BindingFence            uint64     `json:"bindingFence"`
	Protocol                string     `json:"protocol"`
	HopIndex                uint64     `json:"hopIndex"`
	HopCount                uint64     `json:"hopCount"`
	Listener                Listener   `json:"listener"`
	Upstream                Neighbor   `json:"upstream"`
	Downstream              Downstream `json:"downstream"`
	IssuedAt                string     `json:"issuedAt"`
	AuthorizationUntil      string     `json:"authorizationUntil"`
	EgressPolicyRevision    uint64     `json:"egressPolicyRevision"`
	AllowedDestinationCidrs []string   `json:"allowedDestinationCidrs"`
	AllowMetadataTargets    bool       `json:"allowMetadataTargets"`
	MaxConnections          uint64     `json:"maxConnections"`
}

func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var source any
	if err := json.Unmarshal(schemaBytes, &source); err != nil {
		schemaError = err
		return
	}
	if err := compiler.AddResource("urn:tunex:multihop:transit:1", source); err != nil {
		schemaError = err
		return
	}
	contractSchema, schemaError = compiler.Compile("urn:tunex:multihop:transit:1#/$defs/TransitIntent")
}

// Parse strictly validates a proposed Transit description but never starts a listener
// and must not be wired into the existing native.relay.v1 ADP/3 executor.
func Parse(raw []byte) (*TransitIntent, error) {
	once.Do(initialize)
	if schemaError != nil {
		return nil, schemaError
	}
	value, err := contracts.ParseJSON(raw, 16384)
	if err != nil {
		return nil, err
	}
	if err = contractSchema.Validate(value); err != nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Transit contract rejected: %w", err)
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return nil, err
	}
	var v TransitIntent
	decoder := json.NewDecoder(bytes.NewReader(canonical))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(&v); err != nil {
		return nil, err
	}
	if v.HopIndex >= v.HopCount-1 {
		return nil, fmt.Errorf("INVALID_CONFIG: Transit cannot be an endpoint")
	}
	if v.NodeId == v.Upstream.NodeId || v.NodeId == v.Downstream.NodeId || v.Upstream.NodeId == v.Downstream.NodeId ||
		v.AssignmentId == v.Upstream.AssignmentId || v.AssignmentId == v.Downstream.AssignmentId || v.Upstream.AssignmentId == v.Downstream.AssignmentId ||
		v.Upstream.PeerFingerprint == v.Downstream.PeerFingerprint {
		return nil, fmt.Errorf("AUTHORIZATION_DENIED: Transit requires distinct neighboring identities")
	}
	issued, err := time.Parse(time.RFC3339Nano, v.IssuedAt)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse(time.RFC3339Nano, v.AuthorizationUntil)
	if err != nil || !issued.Before(end) {
		return nil, fmt.Errorf("INVALID_CONFIG: Transit authorization time range")
	}
	listener, err := netip.ParseAddr(v.Listener.Address)
	if err != nil || listener.Zone() != "" || listener.String() != v.Listener.Address {
		return nil, fmt.Errorf("INVALID_CONFIG: Canonical Transit listener required")
	}
	if !canonicalHost(v.Downstream.Endpoint.Host) {
		return nil, fmt.Errorf("INVALID_CONFIG: Canonical downstream endpoint required")
	}
	for i, cidr := range v.AllowedDestinationCidrs {
		if !contracts.ValidCIDR(cidr) || (i > 0 && v.AllowedDestinationCidrs[i-1] >= cidr) {
			return nil, fmt.Errorf("INVALID_CONFIG: Canonical sorted destination CIDRs required")
		}
	}
	return &v, nil
}

func canonicalHost(host string) bool {
	if address, err := netip.ParseAddr(host); err == nil {
		return address.Zone() == "" && !address.Unmap().IsUnspecified() && address.String() == host
	}
	if host != strings.ToLower(host) || strings.HasSuffix(host, ".") || len(host) > 253 {
		return false
	}
	numeric := true
	for _, c := range host {
		if !((c >= '0' && c <= '9') || c == '.') {
			numeric = false
		}
	}
	if numeric {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) < 1 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
				return false
			}
		}
	}
	return true
}

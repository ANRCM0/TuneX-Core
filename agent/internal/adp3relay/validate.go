// Package adp3relay validates ADP/3 Relay resource messages without executing them.
package adp3relay

import (
	_ "embed"
	"encoding/json"
	"fmt"
	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"net/netip"
	"slices"
	"strings"
	"sync"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var schemas map[string]*jsonschema.Schema
var compileErr error

func initSchemas() {
	c := jsonschema.NewCompiler()
	c.AssertFormat()
	var source any
	if err := json.Unmarshal(schemaBytes, &source); err != nil {
		compileErr = err
		return
	}
	if err := c.AddResource("urn:tunex:adp:3:relay", source); err != nil {
		compileErr = err
		return
	}
	schemas = map[string]*jsonschema.Schema{}
	for _, name := range []string{"Assignment", "Tombstone"} {
		schema, err := c.Compile("urn:tunex:adp:3:relay#/$defs/" + name)
		if err != nil {
			compileErr = err
			return
		}
		schemas[name] = schema
	}
}
func Parse(name string, raw []byte, destination any) error {
	once.Do(initSchemas)
	if compileErr != nil {
		return compileErr
	}
	schema, ok := schemas[name]
	if !ok {
		return fmt.Errorf("INVALID_CONFIG: Unknown ADP/3 message")
	}
	value, err := contracts.ParseJSON(raw, 16384)
	if err != nil {
		return err
	}
	if err := schema.Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: ADP/3 contract rejected: %w", err)
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	if err := validateSemantic(name, canonical); err != nil {
		return err
	}
	if destination != nil {
		return json.Unmarshal(canonical, destination)
	}
	return nil
}

func validateSemantic(name string, raw []byte) error {
	if name == "Tombstone" {
		var t Tombstone
		if err := json.Unmarshal(raw, &t); err != nil {
			return err
		}
		physical := t.Protocol
		if t.Role == "relay-egress" {
			physical = "tcp"
		}
		if t.PhysicalProtocol != physical {
			return fmt.Errorf("RESOURCE_CONFLICT: Relay retirement resource differs")
		}
		return nil
	}
	var a Assignment
	if err := json.Unmarshal(raw, &a); err != nil {
		return err
	}
	c := a.Driver.Config
	b := c.Binding
	ingress := a.Role == "relay-ingress"
	profileRaw, err := json.Marshal(c.Profile)
	if err != nil {
		return err
	}
	if err := relaycontracts.Parse("ProfileConfig", profileRaw, nil); err != nil {
		return err
	}
	openRaw, err := json.Marshal(Open{WireVersion: 1, Type: "open", Action: "probe", RequestId: "contract-validation", Binding: b})
	if err != nil {
		return err
	}
	if err := relaycontracts.Parse("Open", openRaw, nil); err != nil {
		return err
	}
	node, assignment, epoch, fence := b.EgressNodeId, b.EgressAssignmentId, b.EgressSessionEpoch, b.EgressFence
	physical := "tcp"
	target := c.Target
	if ingress {
		node, assignment, epoch, fence = b.IngressNodeId, b.IngressAssignmentId, b.IngressSessionEpoch, b.IngressFence
		physical = a.Protocol
		target = c.PeerEndpoint
	}
	if a.Role != c.Role || a.NodeId != node || a.AssignmentId != assignment || a.SessionEpoch != epoch || a.BindingFence != fence || a.ForwardId != b.ForwardId || a.ForwardRevision != b.ForwardRevision || a.DeploymentGeneration != b.DeploymentGeneration {
		return fmt.Errorf("AUTHORIZATION_DENIED: Relay deployment binding differs")
	}
	address, err := netip.ParseAddr(a.Resource.Address)
	if err != nil || address.String() != a.Resource.Address || a.Resource.Protocol != physical {
		return fmt.Errorf("RESOURCE_CONFLICT: Relay physical resource differs")
	}
	if ingress && (c.Target != nil || c.PeerEndpoint == nil) || !ingress && (c.Target == nil || c.PeerEndpoint != nil) {
		return fmt.Errorf("INVALID_CONFIG: Exactly one role endpoint required")
	}
	profileDigest, err := contracts.ComputeDigest(c.Profile)
	if err != nil {
		return err
	}
	configDigest, err := contracts.ComputeDigest(c)
	if err != nil {
		return err
	}
	if profileDigest != b.ProfileDigest || configDigest != a.Driver.ConfigDigest || !slices.Contains(c.Profile.Protocols, a.Protocol) {
		return fmt.Errorf("INTEGRITY_FAILURE: Relay Profile/config differs")
	}
	if !canonicalHost(target.Host) {
		return fmt.Errorf("INVALID_CONFIG: Canonical endpoint required")
	}
	for i, cidr := range c.AllowedDestinationCidrs {
		if !contracts.ValidCIDR(cidr) || i > 0 && c.AllowedDestinationCidrs[i-1] >= cidr {
			return fmt.Errorf("INVALID_CONFIG: Canonical CIDR policy required")
		}
	}
	for i, fingerprint := range c.PeerFingerprints {
		if i > 0 && c.PeerFingerprints[i-1] >= fingerprint {
			return fmt.Errorf("INVALID_CONFIG: Canonical peer fingerprints required")
		}
	}
	return nil
}
func canonicalHost(host string) bool {
	if address, err := netip.ParseAddr(host); err == nil {
		return address.Zone() == "" && !address.Unmap().IsUnspecified() && address.String() == host
	}
	if host != strings.ToLower(host) || strings.HasSuffix(host, ".") {
		return false
	}
	numeric := true
	for _, ch := range host {
		if !(ch >= '0' && ch <= '9' || ch == '.') {
			numeric = false
		}
	}
	if numeric || len(host) > 253 {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) < 1 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, ch := range label {
			if !(ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' || ch == '-') {
				return false
			}
		}
	}
	return true
}

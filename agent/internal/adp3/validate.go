// Package adp3 validates complete runtime messages; current Control/Agent cutover is separate.
package adp3

import (
	_ "embed"
	"encoding/json"
	"fmt"
	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"net/netip"
	"sort"
	"strings"
	"sync"
)

//go:embed schema.json
var rawSchema []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error

func compile() {
	c := jsonschema.NewCompiler()
	c.AssertFormat()
	var source any
	if err := json.Unmarshal(rawSchema, &source); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:adp:3:runtime"
	if err := c.AddResource(id, source); err != nil {
		compileError = err
		return
	}
	validators = map[string]*jsonschema.Schema{}
	for _, name := range []string{"HelloRequest", "HelloResponse", "Snapshot", "ReportRequest", "ReportAck", "ErrorResponse"} {
		v, err := c.Compile(id + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		validators[name] = v
	}
}
func Parse(name string, raw []byte) (any, error) {
	once.Do(compile)
	if compileError != nil {
		return nil, compileError
	}
	schema, ok := validators[name]
	if !ok {
		return nil, fmt.Errorf("INVALID_CONFIG: Unknown ADP/3 message")
	}
	maximum := 4194304
	if name == "ReportRequest" {
		maximum = 1048576
	}
	value, err := contracts.ParseJSON(raw, maximum)
	if err != nil {
		return nil, err
	}
	if err := schema.Validate(value); err != nil {
		return nil, fmt.Errorf("INVALID_CONFIG: ADP/3 structure rejected: %w", err)
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return nil, err
	}
	if name == "Snapshot" {
		var s Snapshot
		if err := json.Unmarshal(canonical, &s); err != nil {
			return nil, err
		}
		return s, validateSnapshot(s, canonical)
	}
	if name != "ErrorResponse" {
		value.(map[string]any)["protocolVersion"] = 2
	}
	compatible, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	if _, err := contracts.ParseMessage(name, compatible); err != nil {
		return nil, err
	}
	switch name {
	case "HelloRequest":
		var message HelloRequest
		err = json.Unmarshal(canonical, &message)
		return message, err
	case "HelloResponse":
		var message HelloResponse
		err = json.Unmarshal(canonical, &message)
		return message, err
	case "ReportRequest":
		var message ReportRequest
		err = json.Unmarshal(canonical, &message)
		return message, err
	case "ReportAck":
		var message ReportAck
		err = json.Unmarshal(canonical, &message)
		return message, err
	case "ErrorResponse":
		var message ErrorResponse
		err = json.Unmarshal(canonical, &message)
		return message, err
	}
	return nil, fmt.Errorf("INVALID_CONFIG")
}
func validateSnapshot(s Snapshot, raw []byte) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil {
		return err
	}
	delete(object, "snapshotDigest")
	hash, err := contracts.ComputeDigest(object)
	if err != nil {
		return err
	}
	if hash != s.SnapshotDigest {
		return fmt.Errorf("INTEGRITY_FAILURE: Snapshot digest differs")
	}
	logical := map[string]bool{}
	physical := map[string]bool{}
	previous := ""
	for _, a := range s.Assignments {
		l := a.ForwardId + "/" + a.Protocol + "/" + a.Role
		p := fmt.Sprintf("%s/%d", a.Resource.Protocol, a.Resource.Port)
		if a.AssignmentId <= previous || logical[l] || physical[p] {
			return fmt.Errorf("RESOURCE_CONFLICT: Duplicate assignment/resource")
		}
		previous = a.AssignmentId
		logical[l] = true
		physical[p] = true
		if a.Role == "direct" {
			if a.Driver.Id != "native.direct.v1" || a.Resource.Protocol != a.Protocol {
				return fmt.Errorf("RESOURCE_CONFLICT: Direct resource differs")
			}
			address, err := netip.ParseAddr(a.Resource.Address)
			if err != nil || address.Zone() != "" || address.String() != a.Resource.Address {
				return fmt.Errorf("INVALID_CONFIG: Canonical resource address required")
			}
			direct := map[string]any{"assignmentId": a.AssignmentId, "forwardId": a.ForwardId, "forwardRevision": a.ForwardRevision, "deploymentGeneration": a.DeploymentGeneration, "bindingFence": a.BindingFence, "role": "direct", "protocol": a.Protocol, "phase": a.Phase, "listener": Listen{a.Resource.Address, a.Resource.Port}, "driver": a.Driver, "drainTimeoutSeconds": a.DrainTimeoutSeconds}
			message := map[string]any{"protocolVersion": 2, "nodeId": s.NodeId, "sessionEpoch": s.SessionEpoch, "snapshotGeneration": s.SnapshotGeneration, "complete": true, "issuedAt": s.IssuedAt, "validUntil": s.ValidUntil, "assignments": []any{direct}, "tombstones": []any{}}
			hash, err := contracts.ComputeDigest(message)
			if err != nil {
				return err
			}
			message["snapshotDigest"] = hash
			raw, err := json.Marshal(message)
			if err != nil {
				return err
			}
			if _, err := contracts.ParseMessage("Snapshot", raw); err != nil {
				return err
			}
		} else {
			if a.Driver.Id != "native.relay.v1" {
				return fmt.Errorf("UNSUPPORTED_CAPABILITY")
			}
			bytes, err := json.Marshal(a)
			if err != nil {
				return err
			}
			var body map[string]any
			if err := json.Unmarshal(bytes, &body); err != nil {
				return err
			}
			body["protocolVersion"] = 3
			body["nodeId"] = s.NodeId
			body["sessionEpoch"] = s.SessionEpoch
			bytes, err = json.Marshal(body)
			if err != nil {
				return err
			}
			if err := adp3relay.Parse("Assignment", bytes, nil); err != nil {
				return err
			}
		}
	}
	// Reuse ADP/2 time/lease validation on an empty snapshot; no V3 resource is converted to an old listener.
	empty := map[string]any{"protocolVersion": 2, "nodeId": s.NodeId, "sessionEpoch": s.SessionEpoch, "snapshotGeneration": s.SnapshotGeneration, "complete": true, "issuedAt": s.IssuedAt, "validUntil": s.ValidUntil, "assignments": []any{}, "tombstones": []any{}}
	hash, err = contracts.ComputeDigest(empty)
	if err != nil {
		return err
	}
	empty["snapshotDigest"] = hash
	clockRaw, err := json.Marshal(empty)
	if err != nil {
		return err
	}
	if _, err := contracts.ParseMessage("Snapshot", clockRaw); err != nil {
		return err
	}
	retired := map[string]bool{}
	var prior *Tombstone
	for i, t := range s.Tombstones {
		protocol := t.Protocol
		if t.Role == "relay-egress" {
			protocol = "tcp"
		}
		if t.PhysicalProtocol != protocol {
			return fmt.Errorf("RESOURCE_CONFLICT: Retirement protocol differs")
		}
		key := fmt.Sprintf("%s/%d/%d", t.PhysicalProtocol, t.Port, t.BindingFence)
		if retired[key] || t.RetirementGeneration > s.SnapshotGeneration {
			return fmt.Errorf("INVALID_CONFIG: Retirement high-water differs")
		}
		retired[key] = true
		if prior != nil && tombstoneOrder(*prior, t) >= 0 {
			return fmt.Errorf("INVALID_CONFIG: Retirements must be sorted")
		}
		prior = &s.Tombstones[i]
		for _, a := range s.Assignments {
			if a.Resource.Protocol == t.PhysicalProtocol && a.Resource.Port == t.Port && a.BindingFence <= t.BindingFence {
				return fmt.Errorf("FENCING_REJECTED: Retired resource resurrected")
			}
		}
	}
	return nil
}
func tombstoneOrder(a, b Tombstone) int {
	if a.PhysicalProtocol != b.PhysicalProtocol {
		return strings.Compare(a.PhysicalProtocol, b.PhysicalProtocol)
	}
	if a.Port < b.Port {
		return -1
	}
	if a.Port > b.Port {
		return 1
	}
	if a.RetirementGeneration < b.RetirementGeneration {
		return -1
	}
	if a.RetirementGeneration > b.RetirementGeneration {
		return 1
	}
	return strings.Compare(a.AssignmentId, b.AssignmentId)
}
func Names() []string {
	names := []string{"HelloRequest", "HelloResponse", "Snapshot", "ReportRequest", "ReportAck", "ErrorResponse"}
	sort.Strings(names)
	return names
}

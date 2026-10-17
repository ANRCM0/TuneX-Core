// Package probeclaim validates a consumed receipt, never an executable Probe grant.
package probeclaim

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"sync"
	"time"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error
var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)

func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var resource any
	if err := json.Unmarshal(schemaBytes, &resource); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:probe:claim:1"
	if err := compiler.AddResource(id, resource); err != nil {
		compileError = err
		return
	}
	validators = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"Request", "Response"} {
		value, err := compiler.Compile(id + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		validators[name] = value
	}
}
func parse(name string, raw []byte, out any) error {
	once.Do(initialize)
	if compileError != nil {
		return compileError
	}
	value, err := contracts.ParseJSON(raw, 4096)
	if err != nil {
		return err
	}
	if err := validators[name].Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Probe claim structure rejected")
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}
func validIdentity(node, boot, permit string) bool {
	return idPattern.MatchString(node) && idPattern.MatchString(boot) && idPattern.MatchString(permit)
}
func ParseRequest(raw []byte) (*Request, error) {
	var value Request
	if err := parse("Request", raw, &value); err != nil {
		return nil, err
	}
	if !validIdentity(value.NodeId, value.BootId, value.PermitId) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe claim identity rejected")
	}
	return &value, nil
}
func ParseResponse(raw []byte) (*Response, error) {
	var value Response
	if err := parse("Response", raw, &value); err != nil {
		return nil, err
	}
	b := value.Binding
	issued, e1 := time.Parse(time.RFC3339Nano, value.IssuedAt)
	expires, e2 := time.Parse(time.RFC3339Nano, value.ExpiresAt)
	consumed, e3 := time.Parse(time.RFC3339Nano, value.ConsumedAt)
	server, e4 := time.Parse(time.RFC3339Nano, value.ServerTime)
	if !validIdentity(value.NodeId, value.BootId, value.PermitId) ||
		!idPattern.MatchString(b.AssignmentId) || !idPattern.MatchString(b.ForwardId) ||
		b.NodeId != value.NodeId || b.BootId != value.BootId || b.SessionEpoch != value.SessionEpoch ||
		e1 != nil || e2 != nil || e3 != nil || e4 != nil || issued.UnixMilli() < 0 ||
		!expires.After(issued) || expires.Sub(issued) > 2*time.Second ||
		consumed.Before(issued) || consumed.After(server) || !server.Before(expires) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe claim binding/time rejected")
	}
	return &value, nil
}
func NewRequest(node, boot string, epoch uint64, instance string, generation uint64, permit string) (*Request, error) {
	raw, err := json.Marshal(Request{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-claim", NodeId: node,
		BootId: boot, SessionEpoch: epoch, InstanceId: instance, InstanceGeneration: generation, PermitId: permit})
	if err != nil {
		return nil, err
	}
	return ParseRequest(raw)
}
func CheckResponse(request Request, response Response) error {
	raw, err := json.Marshal(request)
	if err != nil {
		return err
	}
	req, err := ParseRequest(raw)
	if err != nil {
		return err
	}
	raw, err = json.Marshal(response)
	if err != nil {
		return err
	}
	ack, err := ParseResponse(raw)
	if err != nil {
		return err
	}
	if req.NodeId != ack.NodeId || req.BootId != ack.BootId || req.SessionEpoch != ack.SessionEpoch ||
		req.InstanceId != ack.InstanceId || req.InstanceGeneration != ack.InstanceGeneration || req.PermitId != ack.PermitId {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe claim response differs")
	}
	return nil
}

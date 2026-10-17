// Package probenegotiation recognizes a read-only contract, never a network grant.
package probenegotiation

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"sync"

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
	const id = "urn:tunex:probe:negotiation:1"
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
		return fmt.Errorf("INVALID_CONFIG: Probe negotiation structure rejected")
	}
	object := value.(map[string]any)
	if !idPattern.MatchString(object["nodeId"].(string)) || !idPattern.MatchString(object["bootId"].(string)) {
		return fmt.Errorf("INVALID_CONFIG: Probe negotiation identity rejected")
	}
	// Canonicalize exact integer spellings (1e0, 1.0) before uint64 decoding.
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}

func ParseRequest(raw []byte) (*Request, error) {
	var value Request
	if err := parse("Request", raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func ParseResponse(raw []byte) (*Response, error) {
	var value Response
	if err := parse("Response", raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func NewRequest(node, boot string, epoch uint64, instance string) (*Request, error) {
	raw, err := json.Marshal(Request{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-hello",
		NodeId: node, BootId: boot, SessionEpoch: epoch, InstanceId: instance, Capability: "probe.tcp-connect.v1",
		Point: "agent-direct-egress", MaxTimeoutMs: 2000, MaxAttempts: 1, ApplicationPayloadBytes: 0})
	if err != nil {
		return nil, err
	}
	return ParseRequest(raw)
}

func CheckResponse(request Request, response Response) error {
	rawRequest, err := json.Marshal(request)
	if err != nil {
		return err
	}
	req, err := ParseRequest(rawRequest)
	if err != nil {
		return err
	}
	rawResponse, err := json.Marshal(response)
	if err != nil {
		return err
	}
	ack, err := ParseResponse(rawResponse)
	if err != nil {
		return err
	}
	if req.NodeId != ack.NodeId || req.BootId != ack.BootId || req.SessionEpoch != ack.SessionEpoch ||
		req.InstanceId != ack.InstanceId {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe negotiation identity differs")
	}
	return nil
}

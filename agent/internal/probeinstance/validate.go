// Package probeinstance validates non-executable machine instance ownership.
package probeinstance

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
	const id = "urn:tunex:probe:instance:1"
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
		return fmt.Errorf("INVALID_CONFIG: Probe instance structure rejected")
	}
	object := value.(map[string]any)
	if !idPattern.MatchString(object["nodeId"].(string)) || !idPattern.MatchString(object["bootId"].(string)) {
		return fmt.Errorf("INVALID_CONFIG: Probe instance identity rejected")
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}
func validRequest(action string, expected uint64) bool { return action != "inspect" || expected == 0 }
func ParseRequest(raw []byte) (*Request, error) {
	var value Request
	if err := parse("Request", raw, &value); err != nil {
		return nil, err
	}
	if !validRequest(value.Action, value.ExpectedGeneration) {
		return nil, fmt.Errorf("INVALID_CONFIG: inspect generation must be zero")
	}
	return &value, nil
}
func ParseResponse(raw []byte) (*Response, error) {
	var value Response
	if err := parse("Response", raw, &value); err != nil {
		return nil, err
	}
	absent := value.State == "absent"
	valid := validRequest(value.Action, value.ExpectedGeneration) && absent == (value.Generation == 0) &&
		absent == (value.CurrentInstanceId == nil) && absent == (value.RegisteredAt == nil) && absent == (value.ExpiresAt == nil)
	if valid && !absent {
		start, err1 := time.Parse(time.RFC3339Nano, *value.RegisteredAt)
		end, err2 := time.Parse(time.RFC3339Nano, *value.ExpiresAt)
		valid = err1 == nil && err2 == nil && end.After(start) && end.Sub(start) <= 30*time.Second
	}
	if value.Action == "register" {
		valid = valid && value.State == "registered" && value.Generation == value.ExpectedGeneration+1 &&
			value.CurrentInstanceId != nil && *value.CurrentInstanceId == value.InstanceId
	}
	if value.Action == "revoke" {
		valid = valid && (value.State == "revoked" || value.State == "quarantined") && value.Generation == value.ExpectedGeneration &&
			value.CurrentInstanceId != nil && *value.CurrentInstanceId == value.InstanceId
	}
	if !valid {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe instance state rejected")
	}
	return &value, nil
}
func NewRequest(node, boot string, epoch uint64, instance, action string, expected uint64) (*Request, error) {
	raw, err := json.Marshal(Request{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-instance", Action: action,
		NodeId: node, BootId: boot, SessionEpoch: epoch, InstanceId: instance, ExpectedGeneration: expected})
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
		req.InstanceId != ack.InstanceId || req.Action != ack.Action || req.ExpectedGeneration != ack.ExpectedGeneration {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe instance response differs")
	}
	return nil
}

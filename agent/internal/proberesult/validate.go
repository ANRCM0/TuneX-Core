// Package proberesult validates reported observations, not executable grants or health.
package proberesult

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
	const id = "urn:tunex:probe:result:1"
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
		return fmt.Errorf("INVALID_CONFIG: Probe result structure rejected")
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}
func identity(node, boot, permit string) bool {
	return idPattern.MatchString(node) && idPattern.MatchString(boot) && idPattern.MatchString(permit)
}
func timestamp(value string) time.Time {
	result, _ := time.Parse(time.RFC3339Nano, value)
	return result
}
func ParseRequest(raw []byte) (*Request, error) {
	var value Request
	if err := parse("Request", raw, &value); err != nil {
		return nil, err
	}
	b := value.Binding
	issued, expires, consumed := timestamp(value.IssuedAt), timestamp(value.ExpiresAt), timestamp(value.ConsumedAt)
	measured, until := timestamp(value.MeasuredAt), timestamp(value.ValidUntil)
	if !identity(value.NodeId, value.BootId, value.PermitId) || !identity(b.NodeId, b.BootId, b.ForwardId) ||
		!idPattern.MatchString(b.AssignmentId) || b.NodeId != value.NodeId || b.BootId != value.BootId || b.SessionEpoch != value.SessionEpoch ||
		issued.UnixMilli() < 0 || consumed.Before(issued) || measured.Before(consumed) || !until.After(measured) ||
		until.After(expires) || expires.Sub(issued) > 2*time.Second || value.ElapsedMs > value.TimeoutMs ||
		(value.Status == "connected") != (value.Code == "tcp-connected") {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe result binding, time or status differs")
	}
	return &value, nil
}
func ParseResponse(raw []byte) (*Response, error) {
	var value Response
	if err := parse("Response", raw, &value); err != nil {
		return nil, err
	}
	if !identity(value.NodeId, value.BootId, value.PermitId) || timestamp(value.AcceptedAt).UnixMilli() < 0 ||
		timestamp(value.ServerTime).Before(timestamp(value.AcceptedAt)) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe result acknowledgement differs")
	}
	return &value, nil
}
func ResultDigest(request Request) (string, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return "", err
	}
	if _, err := ParseRequest(raw); err != nil {
		return "", err
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return "", err
	}
	delete(body, "requestId")
	return contracts.ComputeDigest(body)
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
	digest, err := ResultDigest(*req)
	if err != nil {
		return err
	}
	if req.NodeId != ack.NodeId || req.BootId != ack.BootId || req.SessionEpoch != ack.SessionEpoch || req.PermitId != ack.PermitId ||
		req.InstanceId != ack.InstanceId || req.InstanceGeneration != ack.InstanceGeneration || req.RequestId != ack.RequestId ||
		digest != ack.ResultDigest || timestamp(ack.AcceptedAt).Before(timestamp(req.MeasuredAt)) ||
		!timestamp(ack.AcceptedAt).Before(timestamp(req.ValidUntil)) || !timestamp(ack.ServerTime).Before(timestamp(req.ValidUntil)) {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe result acknowledgement differs")
	}
	return nil
}

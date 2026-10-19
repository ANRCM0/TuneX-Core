// Package transitdelivery parses non-executable Control command previews
// and authenticated delivery receipts. It NEVER invokes the Transit Engine.
package transitdelivery

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error

type Command struct {
	ProtocolVersion      uint64 `json:"protocolVersion"`
	ExtensionVersion     uint64 `json:"extensionVersion"`
	Kind                 string `json:"kind"`
	ExecutionEnabled     bool   `json:"executionEnabled"`
	NodeId               string `json:"nodeId"`
	BootId               string `json:"bootId"`
	SessionEpoch         uint64 `json:"sessionEpoch"`
	ForwardId            string `json:"forwardId"`
	DeploymentGeneration uint64 `json:"deploymentGeneration"`
	CoordinationRevision uint64 `json:"coordinationRevision"`
	PreviewAction        string `json:"previewAction"`
	CommandDigest        string `json:"commandDigest"`
	IssuedAt             string `json:"issuedAt"`
	ValidUntil           string `json:"validUntil"`
	EnvelopeDigest       string `json:"envelopeDigest"`
}
type Report struct {
	ProtocolVersion  uint64 `json:"protocolVersion"`
	ExtensionVersion uint64 `json:"extensionVersion"`
	Kind             string `json:"kind"`
	NodeId           string `json:"nodeId"`
	BootId           string `json:"bootId"`
	SessionEpoch     uint64 `json:"sessionEpoch"`
	CommandDigest    string `json:"commandDigest"`
	EnvelopeDigest   string `json:"envelopeDigest"`
	ReportSequence   uint64 `json:"reportSequence"`
	ObservedAt       string `json:"observedAt"`
	Condition        string `json:"condition"`
}
type Ack struct {
	ProtocolVersion  uint64 `json:"protocolVersion"`
	ExtensionVersion uint64 `json:"extensionVersion"`
	Kind             string `json:"kind"`
	ExecutionEnabled bool   `json:"executionEnabled"`
	NodeId           string `json:"nodeId"`
	BootId           string `json:"bootId"`
	SessionEpoch     uint64 `json:"sessionEpoch"`
	CommandDigest    string `json:"commandDigest"`
	EnvelopeDigest   string `json:"envelopeDigest"`
	ReportSequence   uint64 `json:"reportSequence"`
	Status           string `json:"status"`
}

func compile() {
	c := jsonschema.NewCompiler()
	c.AssertFormat()
	var doc any
	if err := json.Unmarshal(schemaBytes, &doc); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:adp:3:transit:delivery:1"
	if err := c.AddResource(id, doc); err != nil {
		compileError = err
		return
	}
	validators = map[string]*jsonschema.Schema{}
	for _, name := range []string{"Command", "Report", "Ack"} {
		s, err := c.Compile(id + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		validators[name] = s
	}
}
func validate(name string, raw []byte, out any) error {
	once.Do(compile)
	if compileError != nil {
		return compileError
	}
	value, err := contracts.ParseJSON(raw, 8192)
	if err != nil {
		return err
	}
	if err := validators[name].Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Transit delivery %s rejected: %w", name, err)
	}
	return json.Unmarshal(raw, out)
}
func ParseCommand(raw []byte) (*Command, error) {
	var command Command
	if err := validate("Command", raw, &command); err != nil {
		return nil, err
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	delete(body, "envelopeDigest")
	sum, err := contracts.ComputeDigest(body)
	if err != nil {
		return nil, err
	}
	if sum != command.EnvelopeDigest {
		return nil, fmt.Errorf("INTEGRITY_FAILURE: Transit preview digest differs")
	}
	start, err := time.Parse(time.RFC3339Nano, command.IssuedAt)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse(time.RFC3339Nano, command.ValidUntil)
	if err != nil {
		return nil, err
	}
	if !start.Before(end) {
		return nil, fmt.Errorf("INVALID_CONFIG: Transit preview time range")
	}
	return &command, nil
}
func ParseReport(raw []byte) (*Report, error) {
	var report Report
	if err := validate("Report", raw, &report); err != nil {
		return nil, err
	}
	return &report, nil
}
func ParseAck(raw []byte) (*Ack, error) {
	var ack Ack
	if err := validate("Ack", raw, &ack); err != nil {
		return nil, err
	}
	return &ack, nil
}
func ValidateSession(command Command, report Report) error {
	if command.NodeId != report.NodeId || command.BootId != report.BootId ||
		command.SessionEpoch != report.SessionEpoch || command.CommandDigest != report.CommandDigest ||
		command.EnvelopeDigest != report.EnvelopeDigest || report.Condition != "received" {
		return fmt.Errorf("FENCING_REJECTED: Transit delivery receipt not bound to preview")
	}
	return nil
}

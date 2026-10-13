// Package relaycontracts validates the Relay v1 preparation contract; it does not advertise an Agent driver.
package relaycontracts

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var schemas map[string]*jsonschema.Schema
var compileError error

func initialize() {
	compiler := jsonschema.NewCompiler()
	var source any
	if err := json.Unmarshal(schemaBytes, &source); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:relay:1"
	if err := compiler.AddResource(id, source); err != nil {
		compileError = err
		return
	}
	schemas = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"ProfileConfig", "Open", "Accept", "Reject"} {
		schema, err := compiler.Compile(id + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		schemas[name] = schema
	}
}
func Parse(name string, raw []byte, destination any) error {
	once.Do(initialize)
	if compileError != nil {
		return compileError
	}
	schema, ok := schemas[name]
	if !ok {
		return fmt.Errorf("INVALID_CONFIG: Unknown Relay message")
	}
	value, err := contracts.ParseJSON(raw, 4096)
	if err != nil {
		return err
	}
	if err := schema.Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Relay contract rejected: %w", err)
	}
	// JCS normalizes exact exponent integers before typed decoding, matching TS.
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	if name == "ProfileConfig" {
		var profile ProfileConfig
		if err := json.Unmarshal(canonical, &profile); err != nil {
			return err
		}
		if profile.MaxUdpDatagramBytes > profile.MaxFrameBytes {
			return fmt.Errorf("INVALID_CONFIG: UDP bound exceeds frame")
		}
		for i, protocol := range profile.Protocols {
			if i > 0 && profile.Protocols[i-1] >= protocol {
				return fmt.Errorf("INVALID_CONFIG: Canonical protocols required")
			}
		}
	}
	if name == "Open" {
		var open Open
		if err := json.Unmarshal(canonical, &open); err != nil {
			return err
		}
		if open.Binding.IngressNodeId == open.Binding.EgressNodeId || open.Binding.IngressAssignmentId == open.Binding.EgressAssignmentId {
			return fmt.Errorf("INVALID_CONFIG: Distinct Relay Nodes and Assignments required")
		}
	}
	if destination == nil {
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(canonical))
	decoder.DisallowUnknownFields()
	return decoder.Decode(destination)
}

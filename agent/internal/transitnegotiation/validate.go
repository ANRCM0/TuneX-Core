// Package transitnegotiation validates the authenticated, read-only ADP/3
// Transit contract handshake. Parsing a Response NEVER creates an execution grant.
package transitnegotiation

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error

var RequiredCapabilities = []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"}

type Request struct {
	ProtocolVersion             uint64   `json:"protocolVersion"`
	ExtensionVersion            uint64   `json:"extensionVersion"`
	NodeId                      string   `json:"nodeId"`
	BootId                      string   `json:"bootId"`
	SessionEpoch                uint64   `json:"sessionEpoch"`
	RequiredCapabilities        []string `json:"requiredCapabilities"`
	LastStoredTransitGeneration uint64   `json:"lastStoredTransitGeneration"`
}
type Response struct {
	ProtocolVersion      uint64   `json:"protocolVersion"`
	ExtensionVersion     uint64   `json:"extensionVersion"`
	NodeId               string   `json:"nodeId"`
	BootId               string   `json:"bootId"`
	SessionEpoch         uint64   `json:"sessionEpoch"`
	RequiredCapabilities []string `json:"requiredCapabilities"`
	ServerTime           string   `json:"serverTime"`
	State                string   `json:"state"`
	ExecutionEnabled     bool     `json:"executionEnabled"`
}

func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var doc any
	if err := json.Unmarshal(schemaBytes, &doc); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:adp:3:transit:negotiation:1"
	if err := compiler.AddResource(id, doc); err != nil {
		compileError = err
		return
	}
	validators = map[string]*jsonschema.Schema{}
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
	value, err := contracts.ParseJSON(raw, 8192)
	if err != nil {
		return err
	}
	if err = validators[name].Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Transit negotiation %s rejected: %w", name, err)
	}
	return json.Unmarshal(raw, out)
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
func NewRequest(node, boot string, epoch, generation uint64, advertised []string) (*Request, error) {
	for _, cap := range RequiredCapabilities {
		if !slices.Contains(advertised, cap) {
			return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Transit %s not advertised", cap)
		}
	}
	req := &Request{ProtocolVersion: 3, ExtensionVersion: 1, NodeId: node, BootId: boot,
		SessionEpoch: epoch, RequiredCapabilities: slices.Clone(RequiredCapabilities),
		LastStoredTransitGeneration: generation}
	raw, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	return ParseRequest(raw)
}

// CheckResponse only proves session-bound recognition of the contract.
// It does NOT authorize a Snapshot, engine, lease, port or neighbor.
func CheckResponse(request Request, response Response) error {
	if request.NodeId != response.NodeId || request.BootId != response.BootId ||
		request.SessionEpoch != response.SessionEpoch || response.State != "contract-only" ||
		response.ExecutionEnabled || !slices.Equal(response.RequiredCapabilities, RequiredCapabilities) {
		return fmt.Errorf("AUTHORIZATION_DENIED: Transit session/feature grant differs")
	}
	return nil
}

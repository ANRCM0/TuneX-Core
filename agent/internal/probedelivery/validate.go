// Package probedelivery validates bounded discovery and observations, never executable grants.
package probedelivery

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
	const id = "urn:tunex:probe:delivery:1"
	if err := compiler.AddResource(id, resource); err != nil {
		compileError = err
		return
	}
	validators = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"PollRequest", "PollResponse", "StatusRequest", "StatusResponse"} {
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
		return fmt.Errorf("INVALID_CONFIG: Probe delivery structure rejected")
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}
func identity(node, boot string) bool {
	return idPattern.MatchString(node) && idPattern.MatchString(boot)
}
func observation(observed, server string) (time.Time, time.Time, bool) {
	o, e1 := time.Parse(time.RFC3339Nano, observed)
	s, e2 := time.Parse(time.RFC3339Nano, server)
	return o, s, e1 == nil && e2 == nil && o.UnixMilli() >= 0 && !s.Before(o) && s.Sub(o) <= 250*time.Millisecond
}
func offerValid(node, boot string, epoch uint64, offer Offer, observed, server time.Time) bool {
	b := offer.Binding
	issued, e1 := time.Parse(time.RFC3339Nano, offer.IssuedAt)
	expires, e2 := time.Parse(time.RFC3339Nano, offer.ExpiresAt)
	return idPattern.MatchString(offer.PermitId) && identity(b.NodeId, b.BootId) &&
		idPattern.MatchString(b.AssignmentId) && idPattern.MatchString(b.ForwardId) &&
		b.NodeId == node && b.BootId == boot && b.SessionEpoch == epoch &&
		e1 == nil && e2 == nil && issued.UnixMilli() >= 0 && !issued.After(observed) &&
		expires.After(issued) && expires.Sub(issued) <= 2*time.Second && observed.Before(expires) && server.Before(expires)
}
func ParsePollRequest(raw []byte) (*PollRequest, error) {
	var value PollRequest
	if err := parse("PollRequest", raw, &value); err != nil {
		return nil, err
	}
	if !identity(value.NodeId, value.BootId) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe poll identity rejected")
	}
	return &value, nil
}
func ParsePollResponse(raw []byte) (*PollResponse, error) {
	var value PollResponse
	if err := parse("PollResponse", raw, &value); err != nil {
		return nil, err
	}
	observed, server, valid := observation(value.ObservedAt, value.ServerTime)
	if !identity(value.NodeId, value.BootId) || !valid || value.Offer != nil &&
		!offerValid(value.NodeId, value.BootId, value.SessionEpoch, *value.Offer, observed, server) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe poll binding/time rejected")
	}
	return &value, nil
}
func ParseStatusRequest(raw []byte) (*StatusRequest, error) {
	var value StatusRequest
	if err := parse("StatusRequest", raw, &value); err != nil {
		return nil, err
	}
	if !identity(value.NodeId, value.BootId) || !idPattern.MatchString(value.PermitId) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe status identity rejected")
	}
	return &value, nil
}
func ParseStatusResponse(raw []byte) (*StatusResponse, error) {
	var value StatusResponse
	if err := parse("StatusResponse", raw, &value); err != nil {
		return nil, err
	}
	observed, server, valid := observation(value.CheckedAt, value.ServerTime)
	consumed, e1 := time.Parse(time.RFC3339Nano, value.ConsumedAt)
	issued, e2 := time.Parse(time.RFC3339Nano, value.IssuedAt)
	offer := Offer{PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt}
	if !identity(value.NodeId, value.BootId) || !valid || !offerValid(value.NodeId, value.BootId, value.SessionEpoch, offer, observed, server) ||
		e1 != nil || e2 != nil || consumed.Before(issued) || consumed.After(observed) {
		return nil, fmt.Errorf("INVALID_CONFIG: Probe status binding/time rejected")
	}
	return &value, nil
}
func CheckPollResponse(request PollRequest, response PollResponse) error {
	raw, err := json.Marshal(request)
	if err != nil {
		return err
	}
	req, err := ParsePollRequest(raw)
	if err != nil {
		return err
	}
	raw, err = json.Marshal(response)
	if err != nil {
		return err
	}
	ack, err := ParsePollResponse(raw)
	if err != nil {
		return err
	}
	if req.NodeId != ack.NodeId || req.BootId != ack.BootId || req.SessionEpoch != ack.SessionEpoch ||
		req.InstanceId != ack.InstanceId || req.InstanceGeneration != ack.InstanceGeneration || req.RequestId != ack.RequestId {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe poll response differs")
	}
	return nil
}
func CheckStatusResponse(request StatusRequest, response StatusResponse) error {
	raw, err := json.Marshal(request)
	if err != nil {
		return err
	}
	req, err := ParseStatusRequest(raw)
	if err != nil {
		return err
	}
	raw, err = json.Marshal(response)
	if err != nil {
		return err
	}
	ack, err := ParseStatusResponse(raw)
	if err != nil {
		return err
	}
	if req.NodeId != ack.NodeId || req.BootId != ack.BootId || req.SessionEpoch != ack.SessionEpoch || req.PermitId != ack.PermitId ||
		req.InstanceId != ack.InstanceId || req.InstanceGeneration != ack.InstanceGeneration || req.RequestId != ack.RequestId {
		return fmt.Errorf("AUTHORIZATION_DENIED: Probe status response differs")
	}
	return nil
}

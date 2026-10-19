package probetypes

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

func invalid() error { return fmt.Errorf("INVALID_CONFIG: Typed Probe v2 contract rejected") }
func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var resource any
	if err := json.Unmarshal(schemaBytes, &resource); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:probe:types:2"
	if err := compiler.AddResource(id, resource); err != nil {
		compileError = err
		return
	}
	validators = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"QualificationRequest", "QualificationResponse", "PollRequest", "PollResponse", "ClaimRequest", "ClaimResponse", "StatusRequest", "StatusResponse", "ResultRequest", "ResultResponse"} {
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
	validator := validators[name]
	if validator == nil {
		return invalid()
	}
	if err := validator.Validate(value); err != nil {
		return invalid()
	}
	object, ok := value.(map[string]any)
	if !ok {
		return invalid()
	}
	node, nodeOK := object["nodeId"].(string)
	boot, bootOK := object["bootId"].(string)
	if !nodeOK || !bootOK || !idPattern.MatchString(node) || !idPattern.MatchString(boot) {
		return invalid()
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, out)
}
func timestamp(value string) time.Time {
	result, _ := time.Parse(time.RFC3339Nano, value)
	return result
}
func validOffer(machine Machine, offer Offer) bool {
	b := offer.Binding
	issued, expires := timestamp(offer.IssuedAt), timestamp(offer.ExpiresAt)
	return idPattern.MatchString(offer.PermitId) && idPattern.MatchString(b.NodeId) && idPattern.MatchString(b.BootId) &&
		idPattern.MatchString(b.AssignmentId) && idPattern.MatchString(b.ForwardId) && b.NodeId == machine.NodeId && b.BootId == machine.BootId &&
		b.SessionEpoch == machine.SessionEpoch && issued.UnixMilli() >= 0 && expires.After(issued) && expires.Sub(issued) <= 2*time.Second
}
func consumed(value ClaimResponse) bool {
	offer := Offer{Descriptor: value.Descriptor, PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt}
	closed, server := timestamp(value.ConsumedAt), timestamp(value.ServerTime)
	return validOffer(value.Machine, offer) && !closed.Before(timestamp(value.IssuedAt)) && !closed.After(server) && server.Before(timestamp(value.ExpiresAt))
}
func ParseQualificationRequest(raw []byte) (*QualificationRequest, error) {
	var value QualificationRequest
	if err := parse("QualificationRequest", raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseQualificationResponse(raw []byte) (*QualificationResponse, error) {
	var value QualificationResponse
	if err := parse("QualificationResponse", raw, &value); err != nil {
		return nil, err
	}
	if value.Qualified != (value.QualifiedAt != nil) || value.Qualified != (value.ExpiresAt != nil) {
		return nil, invalid()
	}
	if value.Qualified {
		start, end, server := timestamp(*value.QualifiedAt), timestamp(*value.ExpiresAt), timestamp(value.ServerTime)
		if start.UnixMilli() < 0 || !end.After(start) || end.Sub(start) > 30*time.Second || server.Before(start) || !server.Before(end) {
			return nil, invalid()
		}
	}
	return &value, nil
}
func ParsePollRequest(raw []byte) (*PollRequest, error) {
	var value PollRequest
	if err := parse("PollRequest", raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParsePollResponse(raw []byte) (*PollResponse, error) {
	var value PollResponse
	if err := parse("PollResponse", raw, &value); err != nil {
		return nil, err
	}
	observed, server := timestamp(value.ObservedAt), timestamp(value.ServerTime)
	if observed.UnixMilli() < 0 || server.Before(observed) || server.Sub(observed) > 250*time.Millisecond {
		return nil, invalid()
	}
	if value.Offer != nil && (!validOffer(value.Machine, *value.Offer) || timestamp(value.Offer.IssuedAt).After(observed) || !server.Before(timestamp(value.Offer.ExpiresAt))) {
		return nil, invalid()
	}
	return &value, nil
}
func ParseClaimRequest(raw []byte) (*ClaimRequest, error) {
	var value ClaimRequest
	if err := parse("ClaimRequest", raw, &value); err != nil {
		return nil, err
	}
	if !idPattern.MatchString(value.PermitId) {
		return nil, invalid()
	}
	return &value, nil
}
func ParseClaimResponse(raw []byte) (*ClaimResponse, error) {
	var value ClaimResponse
	if err := parse("ClaimResponse", raw, &value); err != nil {
		return nil, err
	}
	if !consumed(value) {
		return nil, invalid()
	}
	return &value, nil
}
func ParseStatusRequest(raw []byte) (*StatusRequest, error) {
	var value StatusRequest
	if err := parse("StatusRequest", raw, &value); err != nil {
		return nil, err
	}
	if !idPattern.MatchString(value.PermitId) {
		return nil, invalid()
	}
	return &value, nil
}
func ParseStatusResponse(raw []byte) (*StatusResponse, error) {
	var value StatusResponse
	if err := parse("StatusResponse", raw, &value); err != nil {
		return nil, err
	}
	checked, server := timestamp(value.CheckedAt), timestamp(value.ServerTime)
	if !consumed(value.ClaimResponse) || checked.Before(timestamp(value.ConsumedAt)) || server.Before(checked) || server.Sub(checked) > 250*time.Millisecond {
		return nil, invalid()
	}
	return &value, nil
}
func ParseResultRequest(raw []byte) (*ResultRequest, error) {
	var value ResultRequest
	if err := parse("ResultRequest", raw, &value); err != nil {
		return nil, err
	}
	offer := Offer{Descriptor: value.Descriptor, PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt}
	consumed, measured, until := timestamp(value.ConsumedAt), timestamp(value.MeasuredAt), timestamp(value.ValidUntil)
	if !validOffer(value.Machine, offer) || consumed.Before(timestamp(value.IssuedAt)) || measured.Before(consumed) || !until.After(measured) || until.After(timestamp(value.ExpiresAt)) ||
		value.ElapsedMs > value.TimeoutMs || (value.Status == "connected") != (value.Code == "tcp-connected") {
		return nil, invalid()
	}
	return &value, nil
}
func ParseResultResponse(raw []byte) (*ResultResponse, error) {
	var value ResultResponse
	if err := parse("ResultResponse", raw, &value); err != nil {
		return nil, err
	}
	if !idPattern.MatchString(value.PermitId) || timestamp(value.AcceptedAt).UnixMilli() < 0 || timestamp(value.ServerTime).Before(timestamp(value.AcceptedAt)) {
		return nil, invalid()
	}
	return &value, nil
}
func echo(request, response Machine) bool { return request == response }
func validated[T any](input T, parser func([]byte) (*T, error)) (*T, error) {
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	return parser(raw)
}
func CheckQualificationResponse(request QualificationRequest, response QualificationResponse) error {
	req, err := validated(request, ParseQualificationRequest)
	if err != nil {
		return err
	}
	ack, err := validated(response, ParseQualificationResponse)
	if err != nil {
		return err
	}
	if !echo(req.Machine, ack.Machine) || req.Action != ack.Action || len(req.Measurements) != len(ack.Measurements) {
		return invalid()
	}
	for i := range req.Measurements {
		if req.Measurements[i] != ack.Measurements[i] {
			return invalid()
		}
	}
	return nil
}
func CheckPollResponse(request PollRequest, response PollResponse) error {
	req, err := validated(request, ParsePollRequest)
	if err != nil {
		return err
	}
	ack, err := validated(response, ParsePollResponse)
	if err != nil {
		return err
	}
	if !echo(req.Machine, ack.Machine) || len(req.Measurements) != len(ack.Measurements) {
		return invalid()
	}
	for i := range req.Measurements {
		if req.Measurements[i] != ack.Measurements[i] {
			return invalid()
		}
	}
	return nil
}
func CheckClaimResponse(request ClaimRequest, response ClaimResponse) error {
	req, err := validated(request, ParseClaimRequest)
	if err != nil {
		return err
	}
	ack, err := validated(response, ParseClaimResponse)
	if err != nil {
		return err
	}
	if !echo(req.Machine, ack.Machine) || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId {
		return invalid()
	}
	return nil
}
func CheckStatusResponse(request StatusRequest, response StatusResponse) error {
	req, err := validated(request, ParseStatusRequest)
	if err != nil {
		return err
	}
	ack, err := validated(response, ParseStatusResponse)
	if err != nil {
		return err
	}
	if !echo(req.Machine, ack.Machine) || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId {
		return invalid()
	}
	return nil
}
func ResultBody(input ResultRequest) (map[string]json.RawMessage, error) {
	req, err := validated(input, ParseResultRequest)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	delete(body, "requestId")
	return body, nil
}
func ResultDigest(input ResultRequest) (string, error) {
	body, err := ResultBody(input)
	if err != nil {
		return "", err
	}
	return contracts.ComputeDigest(body)
}
func CheckResultResponse(request ResultRequest, response ResultResponse) error {
	req, err := validated(request, ParseResultRequest)
	if err != nil {
		return err
	}
	ack, err := validated(response, ParseResultResponse)
	if err != nil {
		return err
	}
	hash, err := ResultDigest(*req)
	if err != nil {
		return err
	}
	if !echo(req.Machine, ack.Machine) || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || hash != ack.ResultDigest || timestamp(ack.AcceptedAt).Before(timestamp(req.MeasuredAt)) ||
		!timestamp(ack.AcceptedAt).Before(timestamp(req.ValidUntil)) || !timestamp(ack.ServerTime).Before(timestamp(req.ValidUntil)) {
		return invalid()
	}
	return nil
}

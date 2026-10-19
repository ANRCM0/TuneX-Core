package probeservices

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/netip"
	"regexp"
	"strings"
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
var servicePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
var labelPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

const tlsMeasurement = "tcp-ingress-tls-v1"

func invalid() error { return fmt.Errorf("INVALID_CONFIG: Service-bound Probe v3 contract rejected") }
func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var resource any
	if err := json.Unmarshal(schemaBytes, &resource); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:probe:services:3"
	if err := compiler.AddResource(id, resource); err != nil {
		compileError = err
		return
	}
	validators = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"ServiceSelection", "ServiceContext", "QualificationRequest", "QualificationResponse", "PollRequest", "PollResponse", "ClaimRequest", "ClaimResponse", "StatusRequest", "StatusResponse", "ResultRequest", "ResultResponse"} {
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
	maximum := 4096
	if name == "PollResponse" {
		maximum = 32768
	} else if name == "ServiceContext" {
		maximum = 16384
	}
	value, err := contracts.ParseJSON(raw, maximum)
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
	if name != "ServiceContext" && name != "ServiceSelection" {
		object, ok := value.(map[string]any)
		if !ok {
			return invalid()
		}
		node, nok := object["nodeId"].(string)
		boot, bok := object["bootId"].(string)
		if !nok || !bok || !idPattern.MatchString(node) || !idPattern.MatchString(boot) {
			return invalid()
		}
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
func checkedSelection(value Selection) bool {
	return idPattern.MatchString(value.ScopeId) && servicePattern.MatchString(value.ServiceId) && value.Revision >= value.ConfigRevision
}
func ParseServiceSelection(raw []byte) (*Selection, error) {
	var value Selection
	if err := parse("ServiceSelection", raw, &value); err != nil {
		return nil, err
	}
	if !checkedSelection(value) {
		return nil, invalid()
	}
	return &value, nil
}
func ParseSelection(raw []byte) (*Selection, error) { return ParseServiceSelection(raw) }
func validAddress(value string) bool {
	addr, err := netip.ParseAddr(value)
	if err != nil || addr.Zone() != "" || addr.Is4In6() || addr.IsUnspecified() || addr.IsMulticast() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() {
		return false
	}
	if addr.Is4() {
		v := addr.As4()
		return v[0] != 0 && v[0] < 224 && !(v[0] == 169 && v[1] == 254) && value != "100.100.100.200"
	}
	return addr.String() == value && value != "fd00:ec2::254"
}

// ParseServiceContext checks public structure and digests, not X.509, current registry authority or a remote peer.
func ParseServiceContext(raw []byte) (*ServiceContext, error) {
	var value ServiceContext
	if err := parse("ServiceContext", raw, &value); err != nil {
		return nil, err
	}
	if !checkedSelection(value.Selection) {
		return nil, invalid()
	}
	config := value.Config
	name := config.Trust.ServerName
	if !validAddress(config.Endpoint.Address) || !strings.Contains(name, ".") || config.ValidUntil <= config.ValidFrom || config.ValidUntil-config.ValidFrom > 604800000 {
		return nil, invalid()
	}
	if _, err := netip.ParseAddr(name); err == nil {
		return nil, invalid()
	}
	for _, label := range strings.Split(name, ".") {
		if !labelPattern.MatchString(label) {
			return nil, invalid()
		}
	}
	decoded, err := base64.StdEncoding.Strict().DecodeString(config.Trust.CertificateDer)
	if err != nil || len(decoded) == 0 || len(decoded) > 8192 || base64.StdEncoding.EncodeToString(decoded) != config.Trust.CertificateDer {
		return nil, invalid()
	}
	configDigest, err := contracts.ComputeDigest(config)
	if err != nil {
		return nil, err
	}
	if configDigest != value.ConfigDigest {
		return nil, invalid()
	}
	contextDigest, err := contracts.ComputeDigest(map[string]any{"scopeId": value.ScopeId, "serviceId": value.ServiceId, "revision": value.Revision,
		"configRevision": value.ConfigRevision, "configDigest": value.ConfigDigest, "config": config})
	if err != nil {
		return nil, err
	}
	if contextDigest != value.ContextDigest {
		return nil, invalid()
	}
	return &value, nil
}

// SelectionFromContext copies a selection from a context already accepted by ParseServiceContext.
func SelectionFromContext(value ServiceContext) Selection { return value.Selection }
func validateService(measurement string, selection *Selection) error {
	if (measurement == tlsMeasurement) != (selection != nil) {
		return invalid()
	}
	if selection != nil {
		if _, err := validated(*selection, ParseServiceSelection); err != nil {
			return err
		}
	}
	return nil
}
func validOffer(machine Machine, value Offer) bool {
	b := value.Binding
	issued, expires := timestamp(value.IssuedAt), timestamp(value.ExpiresAt)
	return idPattern.MatchString(value.PermitId) && idPattern.MatchString(b.NodeId) && idPattern.MatchString(b.BootId) && idPattern.MatchString(b.AssignmentId) && idPattern.MatchString(b.ForwardId) &&
		b.NodeId == machine.NodeId && b.BootId == machine.BootId && b.SessionEpoch == machine.SessionEpoch && issued.UnixMilli() >= 0 && expires.After(issued) && expires.Sub(issued) <= 2*time.Second
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
	if value.Offer != nil {
		offer := value.Offer
		if !validOffer(value.Machine, *offer) || timestamp(offer.IssuedAt).After(observed) || !server.Before(timestamp(offer.ExpiresAt)) || (offer.Measurement == tlsMeasurement) != (offer.ServiceContext != nil) {
			return nil, invalid()
		}
		if offer.ServiceContext != nil {
			context, err := validated(*offer.ServiceContext, ParseServiceContext)
			if err != nil {
				return nil, err
			}
			if timestamp(offer.IssuedAt).UnixMilli() < int64(context.Config.ValidFrom) || timestamp(offer.ExpiresAt).UnixMilli() > int64(context.Config.ValidUntil) {
				return nil, invalid()
			}
		}
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
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
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
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
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
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
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
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseResultRequest(raw []byte) (*ResultRequest, error) {
	var value ResultRequest
	if err := parse("ResultRequest", raw, &value); err != nil {
		return nil, err
	}
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
	}
	offer := Offer{Descriptor: value.Descriptor, PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt}
	closed, measured, until := timestamp(value.ConsumedAt), timestamp(value.MeasuredAt), timestamp(value.ValidUntil)
	if !validOffer(value.Machine, offer) || closed.Before(timestamp(value.IssuedAt)) || measured.Before(closed) || !until.After(measured) || until.After(timestamp(value.ExpiresAt)) || value.ElapsedMs > value.TimeoutMs {
		return nil, invalid()
	}
	if value.Measurement == tlsMeasurement {
		if !(value.Status == "verified" && value.Code == "tls-handshake-verified" && value.TLS != nil || value.Status == "unreachable" && value.Code == "tcp-connect-failed" && value.TLS == nil ||
			value.Status == "unverified" && value.Code == "tls-handshake-failed" && value.TLS == nil) {
			return nil, invalid()
		}
	} else if value.TLS != nil || !(value.Status == "connected" && value.Code == "tcp-connected" || value.Status == "unreachable" && value.Code == "tcp-connect-failed") {
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
	if err := validateService(value.Measurement, value.Service); err != nil {
		return nil, err
	}
	return &value, nil
}
func validated[T any](input T, parser func([]byte) (*T, error)) (*T, error) {
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	return parser(raw)
}
func sameService(a, b *Selection) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
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
	if req.Machine != ack.Machine || req.Action != ack.Action || len(req.Measurements) != len(ack.Measurements) {
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
	if req.Machine != ack.Machine || len(req.Measurements) != len(ack.Measurements) {
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameService(req.Service, ack.Service) {
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameService(req.Service, ack.Service) {
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameService(req.Service, ack.Service) || hash != ack.ResultDigest ||
		timestamp(ack.AcceptedAt).Before(timestamp(req.MeasuredAt)) || !timestamp(ack.AcceptedAt).Before(timestamp(req.ValidUntil)) || !timestamp(ack.ServerTime).Before(timestamp(req.ValidUntil)) {
		return invalid()
	}
	return nil
}

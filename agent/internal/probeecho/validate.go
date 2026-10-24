package probeecho

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/netip"
	"sync"
	"time"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probeservices"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error

func invalid() error { return fmt.Errorf("INVALID_CONFIG: Controlled echo Probe v4 contract rejected") }
func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var resource any
	if err := json.Unmarshal(schemaBytes, &resource); err != nil {
		compileError = err
		return
	}
	const id = "urn:tunex:probe:echo:4"
	if err := compiler.AddResource(id, resource); err != nil {
		compileError = err
		return
	}
	validators = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"ServiceConfig", "ServiceContext", "Challenge", "EchoProof", "Invocation", "QualificationRequest", "QualificationResponse", "PollRequest", "PollResponse", "ClaimRequest", "ClaimResponse", "StatusRequest", "StatusResponse", "ResultRequest", "ResultResponse"} {
		validator, err := compiler.Compile(id + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		validators[name] = validator
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
	} else if name == "ServiceConfig" || name == "ServiceContext" {
		maximum = 16384
	} else if name == "Challenge" || name == "EchoProof" {
		maximum = 512
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
func validated[T any](input T, parser func([]byte) (*T, error)) (*T, error) {
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	return parser(raw)
}
func IsPath(value string) bool { return value == MeasurementPathTCP || value == MeasurementPathUDP }
func IsUDP(value string) bool { return value == MeasurementUDP || value == MeasurementPathUDP }
func IsEcho(value string) bool { return value == MeasurementTCP || value == MeasurementUDP || IsPath(value) }
func PathMeasurements() []string { return append(Measurements(), MeasurementPathTCP, MeasurementPathUDP) }
func Measurements() []string {
	return []string{"tcp-connect-v1", "tcp-ingress-connect-v1", "tcp-ingress-tls-v1", MeasurementTCP, MeasurementUDP}
}
func DescriptorFor(measurement string) (Descriptor, error) {
	descriptor := Descriptor{Measurement: measurement, Point: "agent-local-direct-ingress", BusinessProtocol: "tcp"}
	switch measurement {
	case "tcp-connect-v1":
		descriptor.TaskKind = "tcp-connect"
		descriptor.Capability = "probe.tcp-connect.v1"
		descriptor.Point = "agent-direct-egress"
	case "tcp-ingress-connect-v1":
		descriptor.TaskKind = "tcp-ingress-connect"
		descriptor.Capability = "probe.tcp-ingress-connect.v1"
	case "tcp-ingress-tls-v1":
		descriptor.TaskKind = "tcp-ingress-tls"
		descriptor.Capability = "probe.tcp-ingress-tls.v1"
	case MeasurementPathTCP:
        descriptor.TaskKind = "tcp-path-echo"
        descriptor.Point = "agent-local-forward-ingress"
        descriptor.Capability = "probe.tcp-path-echo.v1"
    case MeasurementPathUDP:
        descriptor.TaskKind = "udp-path-echo"
        descriptor.Point = "agent-local-forward-ingress"
        descriptor.Capability = "probe.udp-path-echo.v1"
        descriptor.BusinessProtocol = "udp"
    case MeasurementTCP:
		descriptor.TaskKind = "tcp-ingress-echo"
		descriptor.Capability = "probe.tcp-ingress-echo.v1"
	case MeasurementUDP:
		descriptor.TaskKind = "udp-ingress-echo"
		descriptor.Capability = "probe.udp-ingress-echo.v1"
		descriptor.BusinessProtocol = "udp"
	default:
		return Descriptor{}, invalid()
	}
	return descriptor, nil
}
func supports(config ServiceConfig, protocol string) bool {
	for _, value := range config.Endpoint.Protocols {
		if value == protocol {
			return true
		}
	}
	return false
}
func validAddress(value string) bool {
	address, err := netip.ParseAddr(value)
	if err != nil || address.String() != value || address.Zone() != "" || address.Is4In6() || address.IsUnspecified() || address.IsMulticast() || address.IsLinkLocalUnicast() || address.IsLinkLocalMulticast() {
		return false
	}
	if address.Is4() {
		p := address.As4()
		return p[0] != 0 && p[0] < 224 && !(p[0] == 169 && p[1] == 254) && value != "100.100.100.200"
	}
	return value != "fd00:ec2::254"
}
func ParseServiceConfig(raw []byte) (*ServiceConfig, error) {
	var value ServiceConfig
	if err := parse("ServiceConfig", raw, &value); err != nil {
		return nil, err
	}
	if !validAddress(value.Endpoint.Address) || value.ValidUntil <= value.ValidFrom || value.ValidUntil-value.ValidFrom > 604800000 {
		return nil, invalid()
	}
	if _, err := rawBase64(value.Trust.PublicKey, 32); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseServiceContext(raw []byte) (*ServiceContext, error) {
	var value ServiceContext
	if err := parse("ServiceContext", raw, &value); err != nil {
		return nil, err
	}
	if value.Config.Version == 1 {
		if _, err := probeservices.ParseServiceContext(raw); err != nil {
			return nil, err
		}
		return &value, nil
	}
	if _, err := validated(value.Config, ParseServiceConfig); err != nil {
		return nil, err
	}
	if _, err := validated(value.Selection, probeservices.ParseServiceSelection); err != nil {
		return nil, err
	}
	hash, err := contracts.ComputeDigest(value.Config)
	if err != nil || hash != value.ConfigDigest {
		return nil, invalid()
	}
	contextHash, err := contracts.ComputeDigest(map[string]any{"scopeId": value.ScopeId, "serviceId": value.ServiceId, "revision": value.Revision,
		"configRevision": value.ConfigRevision, "configDigest": value.ConfigDigest, "config": value.Config})
	if err != nil || contextHash != value.ContextDigest {
		return nil, invalid()
	}
	return &value, nil
}
func SelectionFromContext(value ServiceContext) Selection { return value.Selection }
func ParseServiceSelection(raw []byte) (*Selection, error) {
	return probeservices.ParseServiceSelection(raw)
}
func ParseSelection(raw []byte) (*Selection, error) { return ParseServiceSelection(raw) }
func ParseChallenge(raw []byte) (*Challenge, error) {
	var value Challenge
	if err := parse("Challenge", raw, &value); err != nil {
		return nil, err
	}
	if _, err := rawBase64(value.Nonce, 32); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseProof(raw []byte) (*Proof, error) {
	var value Proof
	if err := parse("EchoProof", raw, &value); err != nil {
		return nil, err
	}
	if _, err := rawBase64(value.Signature, 64); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseInvocation(raw []byte) (*Invocation, error) {
	var value Invocation
	if err := parse("Invocation", raw, &value); err != nil {
		return nil, err
	}
	if _, err := rawBase64(value.Nonce, 32); err != nil {
		return nil, err
	}
	if _, err := validated(value.Service, ParseServiceSelection); err != nil {
		return nil, err
	}
	issued, expires := timestamp(value.IssuedAt), timestamp(value.ExpiresAt)
	if issued.UnixMilli() < 0 || issued.Format("2006-01-02T15:04:05.000Z") != value.IssuedAt || expires.Format("2006-01-02T15:04:05.000Z") != value.ExpiresAt || !expires.After(issued) || expires.Sub(issued) > 2*time.Second {
		return nil, invalid()
	}
	return &value, nil
}
func selectionChallenge(measurement string, selection *Selection, challenge *Challenge) error {
	if (measurement == "tcp-ingress-tls-v1" || IsEcho(measurement)) != (selection != nil) || IsEcho(measurement) != (challenge != nil) {
		return invalid()
	}
	if selection != nil {
		if _, err := validated(*selection, ParseServiceSelection); err != nil {
			return err
		}
	}
	if challenge != nil {
		if _, err := validated(*challenge, ParseChallenge); err != nil {
			return err
		}
	}
	return nil
}
func validPermit(machine Machine, permit Offer) bool {
	issued, expires := timestamp(permit.IssuedAt), timestamp(permit.ExpiresAt)
	return permit.Binding.NodeId == machine.NodeId && permit.Binding.BootId == machine.BootId && permit.Binding.SessionEpoch == machine.SessionEpoch &&
		issued.UnixMilli() >= 0 && expires.After(issued) && expires.Sub(issued) <= 2*time.Second
}
func makeInvocation(machine Machine, offer Offer, selection Selection, challenge Challenge) Invocation {
	return Invocation{Domain: InvocationDomain, ProbeVersion: 4, Measurement: offer.Measurement, PermitId: offer.PermitId, Binding: offer.Binding,
		InstanceId: machine.InstanceId, InstanceGeneration: machine.InstanceGeneration, TimeoutMs: offer.TimeoutMs, IssuedAt: offer.IssuedAt,
		ExpiresAt: offer.ExpiresAt, Service: selection, Nonce: challenge.Nonce}
}
func matches(machine Machine, offer Offer, selection *Selection, challenge *Challenge) bool {
	if challenge == nil {
		return true
	}
	if selection == nil {
		return false
	}
	hash, err := InvocationDigest(makeInvocation(machine, offer, *selection, *challenge))
	return err == nil && hash == challenge.InvocationDigest
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
		supported := false
		for _, measurement := range value.Measurements { if measurement == offer.Measurement { supported = true } }
		if !supported { return nil, invalid() }
		var selection *Selection
		if offer.ServiceContext != nil {
			context, err := validated(*offer.ServiceContext, ParseServiceContext)
			if err != nil {
				return nil, err
			}
			selection = &context.Selection
			config := context.Config
			if (offer.Measurement == "tcp-ingress-tls-v1") != (config.Version == 1) || timestamp(offer.IssuedAt).UnixMilli() < int64(config.ValidFrom) || timestamp(offer.ExpiresAt).UnixMilli() > int64(config.ValidUntil) ||
				config.Version == 2 && !supports(config, offer.BusinessProtocol) {
				return nil, invalid()
			}
		}
		if err := selectionChallenge(offer.Measurement, selection, offer.Challenge); err != nil {
			return nil, err
		}
		if !validPermit(value.Machine, *offer) || timestamp(offer.IssuedAt).After(observed) || !server.Before(timestamp(offer.ExpiresAt)) || !matches(value.Machine, *offer, selection, offer.Challenge) {
			return nil, invalid()
		}
	}
	return &value, nil
}
func ParseClaimRequest(raw []byte) (*ClaimRequest, error) {
	var value ClaimRequest
	if err := parse("ClaimRequest", raw, &value); err != nil {
		return nil, err
	}
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
		return nil, err
	}
	return &value, nil
}
func offerFromConsumed(value ClaimResponse) Offer {
	return Offer{Descriptor: value.Descriptor, PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt, Challenge: value.Challenge}
}
func consumed(value ClaimResponse) bool {
	offer := offerFromConsumed(value)
	closed, server := timestamp(value.ConsumedAt), timestamp(value.ServerTime)
	return validPermit(value.Machine, offer) && matches(value.Machine, offer, value.Service, value.Challenge) && !closed.Before(timestamp(value.IssuedAt)) && !closed.After(server) && server.Before(timestamp(value.ExpiresAt))
}
func ParseClaimResponse(raw []byte) (*ClaimResponse, error) {
	var value ClaimResponse
	if err := parse("ClaimResponse", raw, &value); err != nil {
		return nil, err
	}
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
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
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
		return nil, err
	}
	return &value, nil
}
func ParseStatusResponse(raw []byte) (*StatusResponse, error) {
	var value StatusResponse
	if err := parse("StatusResponse", raw, &value); err != nil {
		return nil, err
	}
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
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
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
		return nil, err
	}
	offer := Offer{Descriptor: value.Descriptor, PermitId: value.PermitId, Binding: value.Binding, TimeoutMs: value.TimeoutMs, IssuedAt: value.IssuedAt, ExpiresAt: value.ExpiresAt}
	closed, measured, until := timestamp(value.ConsumedAt), timestamp(value.MeasuredAt), timestamp(value.ValidUntil)
	if !validPermit(value.Machine, offer) || !matches(value.Machine, offer, value.Service, value.Challenge) || closed.Before(timestamp(value.IssuedAt)) || measured.Before(closed) || !until.After(measured) || until.After(timestamp(value.ExpiresAt)) ||
		value.ElapsedMs > value.TimeoutMs || value.ApplicationPayloadBytes != value.RequestBytes+value.ResponseBytes {
		return nil, invalid()
	}
	if IsEcho(value.Measurement) {
		if value.TLS != nil || !(value.Status == "echoed" && value.Code == "nonce-echo-verified" && value.Echo != nil && value.RequestBytes == 256 && value.ResponseBytes == 256 ||
			value.Status == "unverified" && value.Code == "nonce-echo-rejected" && value.Echo == nil && value.RequestBytes == 256 ||
			(value.Measurement == MeasurementTCP || value.Measurement == MeasurementPathTCP) && value.Status == "unreachable" && value.Code == "tcp-connect-failed" && value.Echo == nil && value.RequestBytes == 0 && value.ResponseBytes == 0) {
			return nil, invalid()
		}
		if value.Echo != nil {
			if _, err := validated(*value.Echo, ParseProof); err != nil {
				return nil, err
			}
			request, err := RequestFrame(makeInvocation(value.Machine, offer, *value.Service, *value.Challenge), *value.Challenge)
			if err != nil {
				return nil, err
			}
			hash := requestDigest(request)
			if value.Echo.RequestDigest != hash {
				return nil, invalid()
			}
		}
	} else {
		if value.Echo != nil || value.RequestBytes != 0 || value.ResponseBytes != 0 {
			return nil, invalid()
		}
		if value.Measurement == "tcp-ingress-tls-v1" {
			if !(value.Status == "verified" && value.Code == "tls-handshake-verified" && value.TLS != nil || value.Status == "unreachable" && value.Code == "tcp-connect-failed" && value.TLS == nil ||
				value.Status == "unverified" && value.Code == "tls-handshake-failed" && value.TLS == nil) {
				return nil, invalid()
			}
		} else if value.TLS != nil || !(value.Status == "connected" && value.Code == "tcp-connected" || value.Status == "unreachable" && value.Code == "tcp-connect-failed") {
			return nil, invalid()
		}
	}
	return &value, nil
}
func ParseResultResponse(raw []byte) (*ResultResponse, error) {
	var value ResultResponse
	if err := parse("ResultResponse", raw, &value); err != nil {
		return nil, err
	}
	if err := selectionChallenge(value.Measurement, value.Service, value.Challenge); err != nil {
		return nil, err
	}
	if timestamp(value.AcceptedAt).UnixMilli() < 0 || timestamp(value.ServerTime).Before(timestamp(value.AcceptedAt)) {
		return nil, invalid()
	}
	return &value, nil
}
func sameSelection(a, b *Selection) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
func sameChallenge(a, b *Challenge) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
func sameMeasurements(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for index := range a {
		if a[index] != b[index] {
			return false
		}
	}
	return true
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
	if req.Machine != ack.Machine || req.Action != ack.Action || !sameMeasurements(req.Measurements, ack.Measurements) {
		return invalid()
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
	if req.Machine != ack.Machine || !sameMeasurements(req.Measurements, ack.Measurements) {
		return invalid()
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameSelection(req.Service, ack.Service) || !sameChallenge(req.Challenge, ack.Challenge) {
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameSelection(req.Service, ack.Service) || !sameChallenge(req.Challenge, ack.Challenge) {
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
	if req.Machine != ack.Machine || req.Descriptor != ack.Descriptor || req.PermitId != ack.PermitId || !sameSelection(req.Service, ack.Service) || !sameChallenge(req.Challenge, ack.Challenge) || hash != ack.ResultDigest ||
		timestamp(ack.AcceptedAt).Before(timestamp(req.MeasuredAt)) || !timestamp(ack.AcceptedAt).Before(timestamp(req.ValidUntil)) || !timestamp(ack.ServerTime).Before(timestamp(req.ValidUntil)) {
		return invalid()
	}
	return nil
}

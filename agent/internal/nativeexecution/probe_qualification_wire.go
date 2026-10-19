package nativeexecution

import (
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

func ProbeRequestID(source runtimeplatform.Entropy) (string, error) {
	var bytes [32]byte
	if _, err := source.ReadRandom(bytes[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes[:]), nil
}

func ProbeTypesMachine(node, boot string, epoch uint64, instance string, generation uint64, request string) probetypes.Machine {
	return probetypes.Machine{ProtocolVersion: 3, ProbeVersion: 2, NodeId: node, BootId: boot,
		SessionEpoch: epoch, InstanceId: instance, InstanceGeneration: generation, RequestId: request}
}

func ProbeServicesMachine(node, boot string, epoch uint64, instance string, generation uint64, request string) probeservices.Machine {
	return probeservices.Machine{ProtocolVersion: 3, ProbeVersion: 3, NodeId: node, BootId: boot,
		SessionEpoch: epoch, InstanceId: instance, InstanceGeneration: generation, RequestId: request}
}

func ProbeEchoMachine(node, boot string, epoch uint64, instance string, generation uint64, request string) probeecho.Machine {
	return probeecho.Machine{ProtocolVersion: 3, ProbeVersion: 4, NodeId: node, BootId: boot,
		SessionEpoch: epoch, InstanceId: instance, InstanceGeneration: generation, RequestId: request}
}

func EncodeProbeTypesQualification(machine probetypes.Machine, action string, measurements []string) (probetypes.QualificationRequest, []byte, error) {
	request := probetypes.QualificationRequest{Machine: machine, Kind: "probe-types-instance", Action: action, Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probetypes.ParseQualificationRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeTypesQualification(request probetypes.QualificationRequest, raw []byte) (*probetypes.QualificationResponse, error) {
	ack, err := probetypes.ParseQualificationResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probetypes.CheckQualificationResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeServicesQualification(machine probeservices.Machine, action string, measurements []string) (probeservices.QualificationRequest, []byte, error) {
	request := probeservices.QualificationRequest{Machine: machine, Kind: "probe-services-instance", Action: action, Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeservices.ParseQualificationRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeServicesQualification(request probeservices.QualificationRequest, raw []byte) (*probeservices.QualificationResponse, error) {
	ack, err := probeservices.ParseQualificationResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeservices.CheckQualificationResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeEchoQualification(machine probeecho.Machine, action string, measurements []string) (probeecho.QualificationRequest, []byte, error) {
	request := probeecho.QualificationRequest{Machine: machine, Kind: "probe-echo-instance", Action: action, Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeecho.ParseQualificationRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeEchoQualification(request probeecho.QualificationRequest, raw []byte) (*probeecho.QualificationResponse, error) {
	ack, err := probeecho.ParseQualificationResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeecho.CheckQualificationResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

// Text decoding only; currentness, clock-skew and deadline policy stay outside.
func ParseProbeWireTime(text string) (time.Time, error) { return ParseWireTime(text) }

// Both original parses run, including when the first one fails.
func ParseProbeQualificationTimes(qualifiedAt, expiresAt string) (time.Time, time.Time, bool) {
	qualified, e1 := ParseWireTime(qualifiedAt)
	expires, e2 := ParseWireTime(expiresAt)
	return qualified, expires, e1 == nil && e2 == nil
}

// The native trust clock is sampled only after all three original codec steps.
func ProbeServiceContext(value *probeservices.ServiceContext) (*observationtrust.Context, error) {
	if value == nil {
		return nil, nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	if _, err := probeservices.ParseServiceContext(raw); err != nil {
		return nil, err
	}
	var context observationtrust.Context
	if err := json.Unmarshal(raw, &context); err != nil {
		return nil, err
	}
	trust, err := observationtrust.New(context, time.Now())
	if err != nil {
		return nil, err
	}
	copy := trust.Context()
	return &copy, nil
}

func ProbeServiceSelection(value *observationtrust.Context) *probeservices.Selection {
	if value == nil {
		return nil
	}
	return &probeservices.Selection{ScopeId: value.ScopeID, ServiceId: value.ServiceID, Revision: value.Revision,
		ConfigRevision: value.ConfigRevision, ConfigDigest: value.ConfigDigest, ContextDigest: value.ContextDigest}
}

// The product checks echo kind and the required context/challenge before calling.
func ProbeEchoInvocation(instance string, generation uint64, offer probeecho.Offer) probeecho.Invocation {
	return probeecho.Invocation{Domain: "tunex.probe.echo.invocation.v1", ProbeVersion: 4, Measurement: offer.Measurement,
		PermitId: offer.PermitId, Binding: offer.Binding, InstanceId: instance, InstanceGeneration: generation,
		TimeoutMs: offer.TimeoutMs, IssuedAt: offer.IssuedAt, ExpiresAt: offer.ExpiresAt,
		Service: offer.ServiceContext.Selection, Nonce: offer.Challenge.Nonce}
}

func DecodeProbeEchoTLSContext(value *probeecho.ServiceContext) (*probeservices.ServiceContext, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return probeservices.ParseServiceContext(raw)
}

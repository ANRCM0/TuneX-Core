package nativeexecution

import (
	"encoding/json"
	"time"

	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
)

type ProbeResultProjection struct {
	NodeID, BootID, InstanceID, PermitID, RequestID string
	SessionEpoch, InstanceGeneration                uint64
	Timeout                                         time.Duration
	IssuedAt, ExpiresAt, ConsumedAt                 string
	Binding                                         proberesult.Binding
	MeasuredAt, ValidUntil                          time.Time
	Elapsed                                         time.Duration
	Point, Status, Code                             string
}

// Time and validity policy have already been decided by the original owner.
func ProjectProbeResult(fields ProbeResultProjection, validateLegacy bool) (proberesult.Request, error) {
	stamp := func(at time.Time) string { return at.Format("2006-01-02T15:04:05.000Z") }
	body := proberesult.Request{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-result", NodeId: fields.NodeID,
		BootId: fields.BootID, SessionEpoch: fields.SessionEpoch, InstanceId: fields.InstanceID, InstanceGeneration: fields.InstanceGeneration,
		PermitId: fields.PermitID, RequestId: fields.RequestID, TimeoutMs: uint64(fields.Timeout / time.Millisecond),
		IssuedAt: fields.IssuedAt, ExpiresAt: fields.ExpiresAt, ConsumedAt: fields.ConsumedAt, Binding: fields.Binding,
		MeasuredAt: stamp(fields.MeasuredAt), ValidUntil: stamp(fields.ValidUntil), ElapsedMs: uint64((fields.Elapsed + time.Millisecond - 1) / time.Millisecond),
		Point: fields.Point, Status: fields.Status, Code: fields.Code, ApplicationHealth: "unknown", Source: "agent-reported", ApplicationPayloadBytes: 0}
	raw, err := json.Marshal(body)
	if err != nil {
		return proberesult.Request{}, err
	}
	if validateLegacy {
		if _, err := proberesult.ParseRequest(raw); err != nil {
			return proberesult.Request{}, err
		}
	}
	return body, nil
}

func DecodeProbeResultResponse(request proberesult.Request, raw []byte) (*proberesult.Response, error) {
	ack, err := proberesult.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := proberesult.CheckResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func DecodeProbeTypesResultResponse(request probetypes.ResultRequest, raw []byte) (*probetypes.ResultResponse, error) {
	ack, err := probetypes.ParseResultResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probetypes.CheckResultResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func DecodeProbeServicesResultResponse(request probeservices.ResultRequest, raw []byte) (*probeservices.ResultResponse, error) {
	ack, err := probeservices.ParseResultResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeservices.CheckResultResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func DecodeProbeEchoResultResponse(request probeecho.ResultRequest, raw []byte) (*probeecho.ResultResponse, error) {
	ack, err := probeecho.ParseResultResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeecho.CheckResultResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

// Callers retain family, current-receipt and evidence checks. The legacy fields
// are an internal projection source; they are never parsed on the v1 route here.
func ProbeTypesResult(fields proberesult.Request, descriptor probetypes.Descriptor, binding probetypes.Binding) (probetypes.ResultRequest, error) {
	request := probetypes.ResultRequest{Machine: probetypes.Machine{ProtocolVersion: 3, ProbeVersion: 2,
		NodeId: fields.NodeId, BootId: fields.BootId, SessionEpoch: fields.SessionEpoch, InstanceId: fields.InstanceId,
		InstanceGeneration: fields.InstanceGeneration, RequestId: fields.RequestId}, Descriptor: descriptor,
		Kind: "probe-types-result", PermitId: fields.PermitId, Binding: binding, TimeoutMs: fields.TimeoutMs,
		IssuedAt: fields.IssuedAt, ExpiresAt: fields.ExpiresAt, ConsumedAt: fields.ConsumedAt, MeasuredAt: fields.MeasuredAt,
		ValidUntil: fields.ValidUntil, ElapsedMs: fields.ElapsedMs, Status: fields.Status, Code: fields.Code,
		ApplicationHealth: "unknown", Source: "agent-reported", ApplicationPayloadBytes: 0}
	raw, err := json.Marshal(request)
	if err != nil {
		return probetypes.ResultRequest{}, err
	}
	parsed, err := probetypes.ParseResultRequest(raw)
	if err != nil {
		return probetypes.ResultRequest{}, err
	}
	return *parsed, nil
}

func ProbeServicesResult(fields proberesult.Request, descriptor probeservices.Descriptor, binding probeservices.Binding,
	service *probeservices.Selection, evidence *probeservices.TLSResult) (probeservices.ResultRequest, error) {
	request := probeservices.ResultRequest{Machine: probeservices.Machine{ProtocolVersion: 3, ProbeVersion: 3,
		NodeId: fields.NodeId, BootId: fields.BootId, SessionEpoch: fields.SessionEpoch, InstanceId: fields.InstanceId,
		InstanceGeneration: fields.InstanceGeneration, RequestId: fields.RequestId}, Descriptor: descriptor,
		Kind: "probe-services-result", PermitId: fields.PermitId, Service: service,
		Binding: binding, TimeoutMs: fields.TimeoutMs,
		IssuedAt: fields.IssuedAt, ExpiresAt: fields.ExpiresAt, ConsumedAt: fields.ConsumedAt, MeasuredAt: fields.MeasuredAt,
		ValidUntil: fields.ValidUntil, ElapsedMs: fields.ElapsedMs, Status: fields.Status, Code: fields.Code, TLS: evidence,
		ApplicationHealth: "unknown", Source: "agent-reported", ApplicationPayloadBytes: 0}
	raw, err := json.Marshal(request)
	if err != nil {
		return probeservices.ResultRequest{}, err
	}
	parsed, err := probeservices.ParseResultRequest(raw)
	if err != nil {
		return probeservices.ResultRequest{}, err
	}
	return *parsed, nil
}

func ProbeEchoResult(fields proberesult.Request, descriptor probeecho.Descriptor, binding probeecho.Binding,
	service *probeecho.Selection, challenge *probeecho.Challenge, proof *probeecho.Proof,
	requestBytes, responseBytes uint64) (probeecho.ResultRequest, error) {
	request := probeecho.ResultRequest{Machine: probeecho.Machine{ProtocolVersion: 3, ProbeVersion: 4,
		NodeId: fields.NodeId, BootId: fields.BootId, SessionEpoch: fields.SessionEpoch, InstanceId: fields.InstanceId,
		InstanceGeneration: fields.InstanceGeneration, RequestId: fields.RequestId}, Descriptor: descriptor,
		Kind: "probe-echo-result", PermitId: fields.PermitId, Service: service,
		Challenge: challenge, Binding: binding, TimeoutMs: fields.TimeoutMs,
		IssuedAt: fields.IssuedAt, ExpiresAt: fields.ExpiresAt, ConsumedAt: fields.ConsumedAt,
		MeasuredAt: fields.MeasuredAt, ValidUntil: fields.ValidUntil, ElapsedMs: fields.ElapsedMs,
		Status: fields.Status, Code: fields.Code, Echo: proof, RequestBytes: requestBytes, ResponseBytes: responseBytes,
		ApplicationHealth: "unknown", Source: "agent-reported", ApplicationPayloadBytes: requestBytes + responseBytes}
	raw, err := json.Marshal(request)
	if err != nil {
		return probeecho.ResultRequest{}, err
	}
	parsed, err := probeecho.ParseResultRequest(raw)
	if err != nil {
		return probeecho.ResultRequest{}, err
	}
	return *parsed, nil
}

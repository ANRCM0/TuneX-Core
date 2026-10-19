package nativeexecution

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
)

func EncodeProbeTypesPoll(machine probetypes.Machine, measurements []string) (probetypes.PollRequest, []byte, error) {
	request := probetypes.PollRequest{Machine: machine, Kind: "probe-types-poll", Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probetypes.ParsePollRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeTypesPoll(request probetypes.PollRequest, raw []byte) (*probetypes.PollResponse, error) {
	ack, err := probetypes.ParsePollResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probetypes.CheckPollResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeServicesPoll(machine probeservices.Machine, measurements []string) (probeservices.PollRequest, []byte, error) {
	request := probeservices.PollRequest{Machine: machine, Kind: "probe-services-poll", Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeservices.ParsePollRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeServicesPoll(request probeservices.PollRequest, raw []byte) (*probeservices.PollResponse, error) {
	ack, err := probeservices.ParsePollResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeservices.CheckPollResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeEchoPoll(machine probeecho.Machine, measurements []string) (probeecho.PollRequest, []byte, error) {
	request := probeecho.PollRequest{Machine: machine, Kind: "probe-echo-poll", Measurements: measurements}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeecho.ParsePollRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeEchoPoll(request probeecho.PollRequest, raw []byte) (*probeecho.PollResponse, error) {
	ack, err := probeecho.ParsePollResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeecho.CheckPollResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

// Claim field projection precedes the original burn. Encoding/validation remains
// a separate call after burn and deadline creation, just as in the old owner.
func ProbeTypesClaimRequest(machine probetypes.Machine, descriptor probetypes.Descriptor, permit string) probetypes.ClaimRequest {
	return probetypes.ClaimRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-types-claim", PermitId: permit}
}

func EncodeProbeTypesClaim(request probetypes.ClaimRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probetypes.ParseClaimRequest(raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func DecodeProbeTypesClaim(request probetypes.ClaimRequest, raw []byte) (*probetypes.ClaimResponse, error) {
	ack, err := probetypes.ParseClaimResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probetypes.CheckClaimResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func ProbeServicesClaimRequest(machine probeservices.Machine, descriptor probeservices.Descriptor, permit string, service *probeservices.Selection) probeservices.ClaimRequest {
	return probeservices.ClaimRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-services-claim", PermitId: permit, Service: service}
}

func EncodeProbeServicesClaim(request probeservices.ClaimRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probeservices.ParseClaimRequest(raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func DecodeProbeServicesClaim(request probeservices.ClaimRequest, raw []byte) (*probeservices.ClaimResponse, error) {
	ack, err := probeservices.ParseClaimResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeservices.CheckClaimResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func ProbeEchoClaimRequest(machine probeecho.Machine, descriptor probeecho.Descriptor, permit string, service *probeecho.Selection, challenge *probeecho.Challenge) probeecho.ClaimRequest {
	return probeecho.ClaimRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-echo-claim", PermitId: permit, Service: service, Challenge: challenge}
}

func EncodeProbeEchoClaim(request probeecho.ClaimRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probeecho.ParseClaimRequest(raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func DecodeProbeEchoClaim(request probeecho.ClaimRequest, raw []byte) (*probeecho.ClaimResponse, error) {
	ack, err := probeecho.ParseClaimResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeecho.CheckClaimResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func ProbeStatusRequest(node, boot string, epoch uint64, instance string, generation uint64, id, permit string) probedelivery.StatusRequest {
	return probedelivery.StatusRequest{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-status", NodeId: node,
		BootId: boot, SessionEpoch: epoch, InstanceId: instance, InstanceGeneration: generation, RequestId: id, PermitId: permit}
}

func EncodeProbeStatusRequest(request probedelivery.StatusRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probedelivery.ParseStatusRequest(raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func DecodeProbeStatusResponse(request probedelivery.StatusRequest, raw []byte) (*probedelivery.StatusResponse, error) {
	ack, err := probedelivery.ParseStatusResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probedelivery.CheckStatusResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeTypesStatus(machine probetypes.Machine, descriptor probetypes.Descriptor, permit string) (probetypes.StatusRequest, []byte, error) {
	request := probetypes.StatusRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-types-status", PermitId: permit}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probetypes.ParseStatusRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeTypesStatus(request probetypes.StatusRequest, raw []byte) (*probetypes.StatusResponse, error) {
	ack, err := probetypes.ParseStatusResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probetypes.CheckStatusResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeServicesStatus(machine probeservices.Machine, descriptor probeservices.Descriptor, permit string, service *probeservices.Selection) (probeservices.StatusRequest, []byte, error) {
	request := probeservices.StatusRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-services-status", PermitId: permit, Service: service}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeservices.ParseStatusRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeServicesStatus(request probeservices.StatusRequest, raw []byte) (*probeservices.StatusResponse, error) {
	ack, err := probeservices.ParseStatusResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeservices.CheckStatusResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbeEchoStatus(machine probeecho.Machine, descriptor probeecho.Descriptor, permit string, service *probeecho.Selection, challenge *probeecho.Challenge) (probeecho.StatusRequest, []byte, error) {
	request := probeecho.StatusRequest{Machine: machine, Descriptor: descriptor, Kind: "probe-echo-status", PermitId: permit, Service: service, Challenge: challenge}
	raw, err := json.Marshal(request)
	if err != nil {
		return request, nil, err
	}
	if _, err := probeecho.ParseStatusRequest(raw); err != nil {
		return request, nil, err
	}
	return request, raw, nil
}

func DecodeProbeEchoStatus(request probeecho.StatusRequest, raw []byte) (*probeecho.StatusResponse, error) {
	ack, err := probeecho.ParseStatusResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeecho.CheckStatusResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

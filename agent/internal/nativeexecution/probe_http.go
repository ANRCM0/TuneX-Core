package nativeexecution

import (
	"encoding/json"
	"io"

	"github.com/tunex/vnext/agent/internal/probeclaim"
	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/probeinstance"
	"github.com/tunex/vnext/agent/internal/probenegotiation"
)

func EncodeProbeRequest(input any) ([]byte, error) { return json.Marshal(input) }

// The caller retains its original body Close and error/context/status ordering.
// A size result is separate from reader errors and the product's ErrInvalid.
func ReadProbeResponseBody(body io.Reader, maximum int) ([]byte, bool, error) {
	raw, err := io.ReadAll(io.LimitReader(body, int64(maximum+1)))
	if err != nil {
		return raw, false, err
	}
	return raw, len(raw) > maximum, nil
}

// Preserve best-effort error projection, including partially decoded fields.
func ProbeResponseErrorCode(raw []byte) string {
	var problem struct {
		Code string `json:"code"`
	}
	_ = json.Unmarshal(raw, &problem)
	return problem.Code
}

func DecodeProbeInstanceResponse(request probeinstance.Request, raw []byte) (*probeinstance.Response, error) {
	ack, err := probeinstance.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeinstance.CheckResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func DecodeProbeClaimResponse(request probeclaim.Request, raw []byte) (*probeclaim.Response, error) {
	ack, err := probeclaim.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeclaim.CheckResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func EncodeProbePollRequest(request probedelivery.PollRequest) ([]byte, error) {
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	if _, err := probedelivery.ParsePollRequest(raw); err != nil {
		return nil, err
	}
	return raw, nil
}

func DecodeProbePollResponse(request probedelivery.PollRequest, raw []byte) (*probedelivery.PollResponse, error) {
	ack, err := probedelivery.ParsePollResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probedelivery.CheckPollResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

func DecodeProbeNegotiationResponse(request probenegotiation.Request, raw []byte) (*probenegotiation.Response, error) {
	ack, err := probenegotiation.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probenegotiation.CheckResponse(request, *ack); err != nil {
		return nil, err
	}
	return ack, nil
}

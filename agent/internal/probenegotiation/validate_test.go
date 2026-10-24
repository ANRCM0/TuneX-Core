package probenegotiation

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestProbeNegotiationSharedVectors(t *testing.T) {
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/probe-negotiation-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name, Message, Raw string
			Valid              bool
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, entry := range fixture.Cases {
		t.Run(entry.Name, func(t *testing.T) {
			var err error
			if entry.Message == "Request" {
				_, err = ParseRequest([]byte(entry.Raw))
			} else {
				_, err = ParseResponse([]byte(entry.Raw))
			}
			if (err == nil) != entry.Valid {
				t.Fatalf("valid=%v, error=%v", entry.Valid, err)
			}
		})
	}
}

func TestProbeNegotiationEchoAndTypedBypass(t *testing.T) {
	request, err := NewRequest("node-a", "boot-a", 2, strings.Repeat("a", 64))
	if err != nil {
		t.Fatal(err)
	}
	response := Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-hello-ack", NodeId: request.NodeId,
		BootId: request.BootId, SessionEpoch: request.SessionEpoch, InstanceId: request.InstanceId,
		Capability: request.Capability, Point: request.Point, MaxTimeoutMs: 2000, MaxAttempts: 1,
		ServerTime: "2026-10-17T00:00:00.000Z", State: "contract-only", ExecutionEnabled: false}
	if err := CheckResponse(*request, response); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*Response){
		func(r *Response) { r.NodeId = "node-b" },
		func(r *Response) { r.BootId = "boot-b" },
		func(r *Response) { r.SessionEpoch++ },
		func(r *Response) { r.InstanceId = strings.Repeat("b", 64) },
		func(r *Response) { r.ExecutionEnabled = true },
		func(r *Response) { r.ProbeVersion = 2 },
		func(r *Response) { r.MaxAttempts = 2 },
	} {
		copy := response
		mutate(&copy)
		if CheckResponse(*request, copy) == nil {
			t.Fatal("typed handshake bypass accepted")
		}
	}
	request.ProbeVersion = 2
	if CheckResponse(*request, response) == nil {
		t.Fatal("typed request bypass accepted")
	}
}

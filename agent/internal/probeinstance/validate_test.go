package probeinstance

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestProbeInstanceSharedVectors(t *testing.T) {
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/probe-instance-v1.json")
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
				t.Fatalf("valid=%v error=%v", entry.Valid, err)
			}
		})
	}
}
func TestProbeInstanceEchoAndTypedBypass(t *testing.T) {
	request, err := NewRequest("node-a", "boot-a", 2, strings.Repeat("a", 64), "register", 0)
	if err != nil {
		t.Fatal(err)
	}
	start, end, instance := "2026-10-17T00:00:00.000Z", "2026-10-17T00:00:30.000Z", request.InstanceId
	response := Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-instance-ack", Action: "register", NodeId: request.NodeId,
		BootId: request.BootId, SessionEpoch: request.SessionEpoch, InstanceId: instance, Generation: 1, State: "registered",
		CurrentInstanceId: &instance, RegisteredAt: &start, ExpiresAt: &end, ServerTime: start}
	if err := CheckResponse(*request, response); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*Response){
		func(r *Response) { r.NodeId = "node-b" }, func(r *Response) { r.BootId = "boot-b" },
		func(r *Response) { r.SessionEpoch++ }, func(r *Response) { r.Action = "inspect" },
		func(r *Response) { r.ExpectedGeneration++; r.Generation++ }, func(r *Response) { r.ExecutionEnabled = true },
		func(r *Response) { r.CurrentInstanceId = nil }, func(r *Response) { r.ProbeVersion = 2 },
	} {
		copy := response
		mutate(&copy)
		if CheckResponse(*request, copy) == nil {
			t.Fatal("unsafe acknowledgement accepted")
		}
	}
	request.Action = "unknown"
	if CheckResponse(*request, response) == nil {
		t.Fatal("typed request bypass accepted")
	}
}

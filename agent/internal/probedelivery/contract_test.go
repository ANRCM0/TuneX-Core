package probedelivery

import (
	"encoding/json"
	"os"
	"testing"
)

func deliveryFixture(t *testing.T) (PollRequest, PollResponse, StatusRequest, StatusResponse) {
	t.Helper()
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/probe-delivery-v1.json")
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
			switch entry.Message {
			case "PollRequest":
				_, err = ParsePollRequest([]byte(entry.Raw))
			case "PollResponse":
				_, err = ParsePollResponse([]byte(entry.Raw))
			case "StatusRequest":
				_, err = ParseStatusRequest([]byte(entry.Raw))
			case "StatusResponse":
				_, err = ParseStatusResponse([]byte(entry.Raw))
			default:
				t.Fatal("unknown shared vector")
			}
			if (err == nil) != entry.Valid {
				t.Fatalf("valid=%v error=%v", entry.Valid, err)
			}
		})
	}
	poll, err := ParsePollRequest([]byte(fixture.Cases[0].Raw))
	if err != nil {
		t.Fatal(err)
	}
	offer, err := ParsePollResponse([]byte(fixture.Cases[1].Raw))
	if err != nil {
		t.Fatal(err)
	}
	status, err := ParseStatusRequest([]byte(fixture.Cases[2].Raw))
	if err != nil {
		t.Fatal(err)
	}
	ack, err := ParseStatusResponse([]byte(fixture.Cases[3].Raw))
	if err != nil {
		t.Fatal(err)
	}
	return *poll, *offer, *status, *ack
}
func TestProbeDeliverySharedVectors(t *testing.T) { deliveryFixture(t) }
func TestProbeDeliveryTypedEcho(t *testing.T) {
	poll, offer, status, ack := deliveryFixture(t)
	if CheckPollResponse(poll, offer) != nil || CheckStatusResponse(status, ack) != nil {
		t.Fatal("valid echo refused")
	}
	for _, mutate := range []func(*PollResponse){
		func(v *PollResponse) { v.NodeId = "foreign"; v.Offer = nil },
		func(v *PollResponse) { v.BootId = "foreign"; v.Offer = nil },
		func(v *PollResponse) { v.SessionEpoch++; v.Offer = nil },
		func(v *PollResponse) { v.InstanceId = string(make([]byte, 64)) },
		func(v *PollResponse) { v.InstanceGeneration++ },
		func(v *PollResponse) { v.RequestId = v.InstanceId },
		func(v *PollResponse) { v.ExecutionEnabled = true },
		func(v *PollResponse) { v.ProtocolVersion = 2 },
	} {
		changed := offer
		mutate(&changed)
		if CheckPollResponse(poll, changed) == nil {
			t.Fatal("unsafe poll echo accepted")
		}
	}
	for _, mutate := range []func(*StatusResponse){
		func(v *StatusResponse) { v.NodeId = "foreign"; v.Binding.NodeId = "foreign" },
		func(v *StatusResponse) { v.BootId = "foreign"; v.Binding.BootId = "foreign" },
		func(v *StatusResponse) { v.SessionEpoch++; v.Binding.SessionEpoch++ },
		func(v *StatusResponse) { v.InstanceId = v.RequestId },
		func(v *StatusResponse) { v.InstanceGeneration++ },
		func(v *StatusResponse) { v.RequestId = v.InstanceId },
		func(v *StatusResponse) { v.PermitId = "foreign" },
		func(v *StatusResponse) { v.ExecutionEnabled = true },
		func(v *StatusResponse) { v.State = "issued" },
	} {
		changed := ack
		mutate(&changed)
		if CheckStatusResponse(status, changed) == nil {
			t.Fatal("unsafe status echo accepted")
		}
	}
	poll.ProbeVersion = 2
	status.SessionEpoch = 0
	if CheckPollResponse(poll, offer) == nil || CheckStatusResponse(status, ack) == nil {
		t.Fatal("typed request bypass accepted")
	}
}

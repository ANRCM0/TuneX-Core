package probeclaim

import (
	"encoding/json"
	"os"
	"testing"
)

func claimFixture(t *testing.T) (Request, Response) {
	t.Helper()
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/probe-claim-v1.json")
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
	request, err := ParseRequest([]byte(fixture.Cases[0].Raw))
	if err != nil {
		t.Fatal(err)
	}
	response, err := ParseResponse([]byte(fixture.Cases[1].Raw))
	if err != nil {
		t.Fatal(err)
	}
	return *request, *response
}
func TestProbeClaimSharedVectorsAndTypedEcho(t *testing.T) {
	req, ack := claimFixture(t)
	if err := CheckResponse(req, ack); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*Response){
		func(r *Response) { r.PermitId = "foreign" }, func(r *Response) { r.InstanceId = "b" },
		func(r *Response) { r.InstanceGeneration++ }, func(r *Response) { r.NodeId = "foreign"; r.Binding.NodeId = "foreign" },
		func(r *Response) { r.BootId = "foreign"; r.Binding.BootId = "foreign" },
		func(r *Response) { r.SessionEpoch++; r.Binding.SessionEpoch++ }, func(r *Response) { r.ExecutionEnabled = true },
		func(r *Response) { r.State = "issued" }, func(r *Response) { r.Binding.BindingFence = 0 },
	} {
		changed := ack
		mutate(&changed)
		if CheckResponse(req, changed) == nil {
			t.Fatal("unsafe typed receipt accepted")
		}
	}
	req.ProbeVersion = 2
	if CheckResponse(req, ack) == nil {
		t.Fatal("typed request bypass accepted")
	}
}

package proberesult

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func resultFixture(t *testing.T) (Request, Response, string) {
	t.Helper()
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/probe-result-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Request      Request
		Response     Response
		ResultDigest string
		Cases        []struct {
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
			} else if entry.Message == "Response" {
				_, err = ParseResponse([]byte(entry.Raw))
			} else {
				t.Fatal("unknown vector")
			}
			if (err == nil) != entry.Valid {
				t.Fatalf("valid=%v error=%v", entry.Valid, err)
			}
		})
	}
	return fixture.Request, fixture.Response, fixture.ResultDigest
}
func TestProbeResultSharedVectors(t *testing.T) { resultFixture(t) }
func TestProbeResultDigestAndTypedEcho(t *testing.T) {
	request, response, expected := resultFixture(t)
	digest, err := ResultDigest(request)
	if err != nil || digest != expected || CheckResponse(request, response) != nil {
		t.Fatalf("digest/echo differ: %s %v", digest, err)
	}
	changed := request
	changed.RequestId = strings.Repeat("d", 64)
	if digest, err := ResultDigest(changed); err != nil || digest != expected {
		t.Fatal("correlation changed measurement identity")
	}
	changed.ElapsedMs++
	if digest, err := ResultDigest(changed); err != nil || digest == expected {
		t.Fatal("measurement not included in digest")
	}
	for _, mutate := range []func(*Response){
		func(v *Response) { v.NodeId = "foreign" }, func(v *Response) { v.BootId = "foreign" }, func(v *Response) { v.SessionEpoch++ },
		func(v *Response) { v.PermitId = "foreign" }, func(v *Response) { v.RequestId = strings.Repeat("d", 64) },
		func(v *Response) { v.InstanceId = strings.Repeat("f", 64) }, func(v *Response) { v.InstanceGeneration++ },
		func(v *Response) { v.ResultDigest = "sha256:" + strings.Repeat("f", 64) }, func(v *Response) { v.AcceptedAt = "2026-10-17T00:00:00.099Z" },
		func(v *Response) { v.ServerTime = request.ValidUntil }, func(v *Response) { v.ExecutionEnabled = true }, func(v *Response) { v.Health = "healthy" },
	} {
		changed := response
		mutate(&changed)
		if CheckResponse(request, changed) == nil {
			t.Fatal("unsafe acknowledgement accepted")
		}
	}
	request.ProbeVersion = 2
	if CheckResponse(request, response) == nil {
		t.Fatal("typed request bypass")
	}
}

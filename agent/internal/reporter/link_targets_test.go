package reporter

import (
	"encoding/json"
	"github.com/tunex/agent/internal/tstruntime"
	"testing"
)

func TestTargetReportIsClosedOwnedAndCopiesPointers(t *testing.T) {
	index := 1
	stamp := "2026-10-08T12:00:00Z"
	in := []tstruntime.TargetStatus{{ForwardID: 101, States: []string{"unhealthy", "healthy"}, SelectedTCP: &index, LastCheckedAt: &stamp, Reason: "target_failed"}}
	out := reportedTargetStatus("egress", in)
	if len(out) != 1 || out[0].States[1] != "healthy" {
		t.Fatal(out)
	}
	*out[0].SelectedTCP = 0
	*out[0].LastCheckedAt = "changed"
	out[0].States[1] = "unknown"
	if index != 1 || stamp != "2026-10-08T12:00:00Z" || in[0].States[1] != "healthy" {
		t.Fatal("mutable provider alias")
	}
	if reportedTargetStatus("ingress", in) != nil {
		t.Fatal("ingress claims target-side health")
	}
	in[0].LastCheckedAt = nil
	if reportedTargetStatus("egress", in) != nil {
		t.Fatal("known health without observation time propagated")
	}
	in[0].LastCheckedAt = &stamp
	in[0].States[1] = "secret"
	if reportedTargetStatus("egress", in) != nil {
		t.Fatal("unknown states propagated")
	}
}

func TestTargetReportEncodesClosedNullableContract(t *testing.T) {
	stamp := "2026-10-11T00:00:00Z"
	zero := 0
	for _, fact := range []tstruntime.TargetStatus{
		{ForwardID: 101, States: []string{"unknown"}, Reason: "initial"},
		{ForwardID: 101, States: []string{"healthy"}, SelectedTCP: &zero, LastCheckedAt: &stamp, Reason: "selected"},
	} {
		raw, err := json.Marshal(reportedTargetStatus("egress", []tstruntime.TargetStatus{fact}))
		if err != nil {
			t.Fatal(err)
		}
		var fields []map[string]json.RawMessage
		if err = json.Unmarshal(raw, &fields); err != nil || len(fields) != 1 || len(fields[0]) != 6 {
			t.Fatalf("target fields are not the closed contract: %s %v", raw, err)
		}
		for _, field := range []string{"selected_tcp", "selected_udp", "last_checked_at"} {
			if _, present := fields[0][field]; !present {
				t.Fatal("required nullable field omitted", field)
			}
		}
		if string(fields[0]["selected_udp"]) != "null" {
			t.Fatal("absent UDP health fabricated", string(raw))
		}
		if fact.LastCheckedAt == nil && (string(fields[0]["selected_tcp"]) != "null" || string(fields[0]["last_checked_at"]) != "null") {
			t.Fatal("initial unknown health must encode null", string(raw))
		}
	}
}

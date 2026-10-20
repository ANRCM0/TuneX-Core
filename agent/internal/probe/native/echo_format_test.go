package native

import (
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probeecho"
)

func TestEchoExecutionEqualityDistinguishesNilEmptyAndDetachedProtocols(t *testing.T) {
	a := probeecho.Execution{}
	b := a
	b.Context.Config.Endpoint.Protocols = []string{}
	if SameEchoExecution(a, b) {
		t.Fatal("nil and empty protocols became equal")
	}
	a.Context.Config.Endpoint.Protocols = []string{"tcp", "udp"}
	b = probeecho.CloneExecution(a)
	if !SameEchoExecution(a, b) {
		t.Fatal("detached equal execution refused")
	}
	b.Context.Config.Endpoint.Protocols[0] = "udp"
	if SameEchoExecution(a, b) || a.Context.Config.Endpoint.Protocols[0] != "tcp" {
		t.Fatal("changed protocol reused original execution")
	}
	b = probeecho.CloneExecution(a)
	b.Challenge.Nonce = "other"
	if SameEchoExecution(a, b) {
		t.Fatal("changed challenge reused original execution")
	}
}

func TestEchoContextRoundtripAndBothTimeParsesKeepFailureStages(t *testing.T) {
	input := probeecho.ServiceContext{}
	raw, err := EncodeEchoContext(input)
	if err != nil {
		t.Fatal("typed context failed before decode", err)
	}
	decoded, decodeErr := DecodeEchoContext(raw)
	parsed, parseErr := ParseEchoContext(input)
	if decoded != nil || parsed != nil || decodeErr == nil || parseErr == nil || decodeErr.Error() != parseErr.Error() {
		t.Fatalf("context refusal stages changed: decode=%v parse=%v", decodeErr, parseErr)
	}
	valid := "2026-10-19T01:02:03.123456789+08:00"
	issued, expires, ok := ParseEchoTimes(probeecho.Invocation{IssuedAt: "invalid", ExpiresAt: valid})
	if ok || !issued.IsZero() || expires.Format(time.RFC3339Nano) != valid {
		t.Fatal("invalid first date skipped second parse")
	}
	issued, expires, ok = ParseEchoTimes(probeecho.Invocation{IssuedAt: valid, ExpiresAt: "invalid"})
	if ok || issued.Format(time.RFC3339Nano) != valid || !expires.IsZero() {
		t.Fatal("invalid expiry lost successful issue parse")
	}
}

package native

import (
	"encoding/json"
	"reflect"
	"time"

	"github.com/tunex/vnext/agent/internal/probeecho"
)

const EchoFrameBytes = 256

// ParseEchoContext keeps the original typed-value JSON roundtrip and codec.
// It does not select a service or decide whether its validity permits execution.
func ParseEchoContext(input probeecho.ServiceContext) (*probeecho.ServiceContext, error) {
	raw, err := EncodeEchoContext(input)
	if err != nil {
		return nil, err
	}
	return DecodeEchoContext(raw)
}

// The Control owner retains its clock sample between decode and error handling.
func EncodeEchoContext(input probeecho.ServiceContext) ([]byte, error) { return json.Marshal(input) }
func DecodeEchoContext(raw []byte) (*probeecho.ServiceContext, error) {
	return probeecho.ParseServiceContext(raw)
}

func SameEchoExecution(a, b probeecho.Execution) bool { return reflect.DeepEqual(a, b) }

// Both original parses run; the caller retains all lifetime/current-time rules.
func ParseEchoTimes(invocation probeecho.Invocation) (time.Time, time.Time, bool) {
	issued, e1 := time.Parse(time.RFC3339Nano, invocation.IssuedAt)
	expires, e2 := time.Parse(time.RFC3339Nano, invocation.ExpiresAt)
	return issued, expires, e1 == nil && e2 == nil
}

func EchoFrameValid(invocation probeecho.Invocation, challenge probeecho.Challenge) bool {
	frame, err := probeecho.RequestFrame(invocation, challenge)
	return err == nil && len(frame) == EchoFrameBytes
}

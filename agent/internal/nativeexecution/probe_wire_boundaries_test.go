package nativeexecution

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionidentity"
)

type bStageErrorReader struct{ failure error }

func (r bStageErrorReader) Read(p []byte) (int, error) {
	copy(p, "partial")
	return len("partial"), r.failure
}

func TestProbeBoundedBodyAndReaderError(t *testing.T) {
	for _, limit := range []int{4096, 32768} {
		for _, size := range []int{limit - 1, limit, limit + 1, limit + 2} {
			raw, large, err := ReadProbeResponseBody(strings.NewReader(strings.Repeat("x", size)), limit)
			if err != nil || len(raw) != min(size, limit+1) || large != (size > limit) {
				t.Fatalf("limit=%d size=%d read=%d large=%v err=%v", limit, size, len(raw), large, err)
			}
		}
	}
	failure := errors.New("reader failed with bytes")
	raw, large, err := ReadProbeResponseBody(bStageErrorReader{failure}, 4096)
	if !errors.Is(err, failure) || string(raw) != "partial" || large {
		t.Fatalf("reader failure changed: %q %v %v", raw, large, err)
	}
	// A field type error still preserves the separately decoded Code.
	if code := ProbeResponseErrorCode([]byte(`{"code":"DENIED","code":17}`)); code != "DENIED" {
		t.Fatalf("partial error code lost: %q", code)
	}
	if code := ProbeResponseErrorCode([]byte(`not-json`)); code != "" {
		t.Fatalf("malformed error supplied code %q", code)
	}
}

type bStageEntropy struct {
	calls   int
	sizes   []int
	count   int
	failure error
}

func (e *bStageEntropy) ReadRandom(p []byte) (int, error) {
	e.calls++
	e.sizes = append(e.sizes, len(p))
	for i := range p {
		p[i] = 0xab
	}
	return e.count, e.failure
}

func TestProbeEntropyKeepsOne32ByteReadAndShortCount(t *testing.T) {
	for _, count := range []int{0, 1, 32} {
		source := &bStageEntropy{count: count}
		id, err := ProbeRequestID(source)
		if err != nil || id != strings.Repeat("ab", 32) || source.calls != 1 || len(source.sizes) != 1 || source.sizes[0] != 32 {
			t.Fatalf("entropy count=%d id=%s calls=%v err=%v", count, id, source.sizes, err)
		}
	}
	failure := errors.New("entropy unavailable")
	source := &bStageEntropy{failure: failure}
	id, err := ProbeRequestID(source)
	if id != "" || !errors.Is(err, failure) || source.calls != 1 {
		t.Fatalf("entropy error lost: %q %v", id, err)
	}
}

func TestNativeWireTimesAndRelayScheduleFirstError(t *testing.T) {
	for _, text := range []string{"invalid", "", "0001-01-01T00:00:00Z", "2026-10-19T01:02:03.123456789+08:00", "2026-10-19T01:02:03Z"} {
		want, wantErr := time.Parse(time.RFC3339Nano, text)
		for _, parse := range []func(string) (time.Time, error){ParseWireTime, ParseProbeWireTime} {
			got, err := parse(text)
			if !got.Equal(want) || (err == nil) != (wantErr == nil) || err != nil && err.Error() != wantErr.Error() {
				t.Fatalf("time %q: %v %v, want %v %v", text, got, err, want, wantErr)
			}
		}
	}
	valid := "2026-10-19T01:02:03Z"
	q, e, ok := ParseProbeQualificationTimes("invalid", valid)
	if ok || !q.IsZero() || e.Format(time.RFC3339Nano) != valid {
		t.Fatal("second qualification parse skipped after invalid first")
	}
	for _, vector := range []struct{ until, renew, message string }{
		{"invalid", "also-invalid", "INTEGRITY_FAILURE: Relay effective expiry differs"},
		{valid, "invalid", "INTEGRITY_FAILURE: Relay renewal schedule differs"},
		{valid, valid, "INTEGRITY_FAILURE: Relay renewal schedule differs"},
		{valid, "2026-10-19T01:02:04Z", "INTEGRITY_FAILURE: Relay renewal schedule differs"},
	} {
		_, _, err := RelayCredentialSchedule(vector.until, vector.renew)
		if err == nil || err.Error() != vector.message {
			t.Fatalf("schedule first refusal: %v, want %s", err, vector.message)
		}
	}
	until, renew, err := RelayCredentialSchedule(valid, "")
	if err != nil || !renew.IsZero() || until.Format(time.RFC3339Nano) != valid {
		t.Fatalf("omitted renewal changed %v %v %v", until, renew, err)
	}
}

func TestCredentialRotationNeverEncodesPrivateKey(t *testing.T) {
	raw, err := EncodeCredentialRotation(executionidentity.RotationRequest{RequestID: "request", CSR: "csr", PrivateKey: "secret"})
	if err != nil || !bytes.Equal(raw, []byte(`{"csr":"csr","requestId":"request"}`)) {
		t.Fatalf("rotation request bytes changed: %s %v", raw, err)
	}
}

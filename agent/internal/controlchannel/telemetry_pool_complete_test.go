package controlchannel

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type telemetryCompleteTransport func(*http.Request) (*http.Response, error)
func (f telemetryCompleteTransport) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }
type telemetryCompleteBody struct { reads, closes int }
func (b *telemetryCompleteBody) Read(p []byte) (int, error) { b.reads++; return copy(p, "ack"), io.EOF }
func (b *telemetryCompleteBody) Close() error { b.closes++; return nil }

func TestTelemetryCompleteFourNativePools(t *testing.T) {
	baseTransport := &http.Transport{MaxConnsPerHost: 9, MaxIdleConns: 10, MaxIdleConnsPerHost: 11, ResponseHeaderTimeout: time.Minute, MaxResponseHeaderBytes: 12345}
	base := &http.Client{Transport: baseTransport, Timeout: time.Minute}
	seen := map[*http.Transport]bool{baseTransport: true}
	for _, message := range []string{"Telemetry redirects are forbidden", "Host telemetry redirects are forbidden", "Forward telemetry redirects are forbidden", "Probe telemetry redirects are forbidden"} {
		client, closeClient, ok := (Native{}).CloneTelemetry(base, message)
		if !ok || client == nil || closeClient == nil { t.Fatal("clone unavailable") }
		transport, ok := client.Transport.(*http.Transport)
		if !ok || seen[transport] { t.Fatal("shared telemetry pool") }; seen[transport] = true
		if transport.MaxConnsPerHost != 1 || transport.MaxIdleConns != 1 || transport.MaxIdleConnsPerHost != 1 || transport.ResponseHeaderTimeout != 2*time.Second || transport.MaxResponseHeaderBytes != 8192 || client.Timeout != 2*time.Second { t.Fatalf("pool limits: %+v", transport) }
		if err := client.CheckRedirect(nil, nil); err == nil || err.Error() != message { t.Fatalf("redirect error: %v", err) }
		closeClient()
	}
	if baseTransport.MaxConnsPerHost != 9 || baseTransport.MaxIdleConns != 10 || baseTransport.MaxIdleConnsPerHost != 11 || baseTransport.ResponseHeaderTimeout != time.Minute || baseTransport.MaxResponseHeaderBytes != 12345 || base.Timeout != time.Minute { t.Fatal("base pool mutated") }
	if client, cleanup, ok := (Native{}).CloneTelemetry(&http.Client{Transport: telemetryCompleteTransport(nil)}, "x"); ok || client != nil || cleanup != nil { t.Fatal("non-native transport accepted") }
}

func TestTelemetryCompleteNativeRequestAndCallerBodyOwnership(t *testing.T) {
	for _, path := range []string{"/agent/v3/telemetry", "/agent/v3/host-telemetry", "/agent/v3/forward-telemetry", "/agent/v3/probe-telemetry"} {
		t.Run(path, func(t *testing.T) {
			body := &telemetryCompleteBody{}
			ctx, cancel := context.WithCancel(context.Background()); defer cancel()
			client := &http.Client{Transport: telemetryCompleteTransport(func(request *http.Request) (*http.Response, error) {
				if request.Method != "POST" || request.URL.String() != "http://example.invalid"+path || request.Header.Get("Content-Type") != "application/json" || request.Header.Get("X-TuneX-Session-Epoch") != "18446744073709551615" || request.Context() != ctx { t.Fatalf("request shape: %+v", request) }
				raw, err := io.ReadAll(request.Body); if err != nil || string(raw) != `{"sample":1}` { t.Fatalf("request body: %s %v", raw, err) }
				return &http.Response{StatusCode: 201, Body: body, Header: http.Header{}}, nil
			})}
			reply, err := (Native{}).PostTelemetry(ctx, client, "http://example.invalid///", path, []byte(`{"sample":1}`), ^uint64(0))
			if err != nil || reply.StatusCode != 201 || reply.Body != body || body.reads != 0 || body.closes != 0 { t.Fatalf("caller ownership: %+v %v", reply, err) }
			if raw, err := io.ReadAll(reply.Body); err != nil || strings.TrimSpace(string(raw)) != "ack" { t.Fatalf("reply: %s %v", raw, err) }
			if err := reply.Body.Close(); err != nil || body.reads != 1 || body.closes != 1 { t.Fatal("caller close/read changed") }
		})
	}
}

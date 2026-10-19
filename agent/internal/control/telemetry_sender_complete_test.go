package control

import (
	"context"
	"errors"
	"io"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type senderCompleteSchedule struct { runtimeplatform.Scheduler; trace *[]string; context context.Context }
func (s senderCompleteSchedule) WithTimeout(ctx context.Context, duration time.Duration) (context.Context, context.CancelFunc) {
	if duration != 2*time.Second { panic("telemetry timeout changed") }
	*s.trace = append(*s.trace, "timeout")
	child, cancel := context.WithCancel(ctx)
	return child, func() { *s.trace = append(*s.trace, "cancel"); cancel() }
}
type senderCompleteChannel struct { executionchannel.Auxiliary[*http.Client]; post func(context.Context, string, []byte, uint64) (executionchannel.Reply, error) }
func (s senderCompleteChannel) PostTelemetry(ctx context.Context, _ *http.Client, _ string, path string, raw []byte, epoch uint64) (executionchannel.Reply, error) { return s.post(ctx, path, raw, epoch) }
type senderCompleteBody struct { trace *[]string; reader io.Reader; consumed int; readError error; ctx context.Context }
func (b *senderCompleteBody) Read(p []byte) (int, error) {
	*b.trace = append(*b.trace, "read")
	if b.ctx.Err() != nil { panic("telemetry canceled before body read") }
	if b.readError != nil { return 0, b.readError }
	n, err := b.reader.Read(p); b.consumed += n; return n, err
}
func (b *senderCompleteBody) Close() error { if b.ctx.Err() != nil { panic("telemetry canceled before body close") }; *b.trace = append(*b.trace, "close"); return errors.New("ignored close") }

func TestTelemetryCompleteFourSenderResponseOrder(t *testing.T) {
	for _, family := range []string{"process", "host", "forward", "probe"} {
		for _, branch := range []string{"valid", "read-error", "status", "oversize", "ack", "post-error"} {
			t.Run(family+"/"+branch, func(t *testing.T) {
				trace := []string{}
				version, kind, path := "telemetryVersion", "telemetry-ack", "/agent/v3/telemetry"
				if family != "process" { version = family+"TelemetryVersion"; kind = family+"-telemetry-ack"; path = "/agent/v3/"+family+"-telemetry" }
				ack := `{"`+version+`":1,"kind":"`+kind+`","nodeId":"","bootId":"","sessionEpoch":0,"sampleEpoch":"","sequence":0,"stored":true,"receivedAt":"2026-01-01T00:00:00Z","source":"agent-reported","executionAuthorized":false`
				if family == "forward" || family == "probe" { ack += `,"acceptedPoints":0,"rejectedPoints":0` }; ack += "}"
				data := ack; status := 200
				if branch == "status" { status = 503; data = "invalid ACK" }
				if branch == "oversize" { data = strings.Repeat("x", 6000) }
				if branch == "ack" { data = `{}` }
				body := &senderCompleteBody{trace: &trace, reader: strings.NewReader(data)}
				if branch == "read-error" { body.readError = errors.New("original read") }
				postError := errors.New("original post")
				channel := senderCompleteChannel{post: func(ctx context.Context, gotPath string, raw []byte, epoch uint64) (executionchannel.Reply, error) {
					trace = append(trace, "post")
					if gotPath != path || len(raw) == 0 || epoch != 0 || ctx.Err() != nil { t.Fatalf("Post shape: %s %s %d", gotPath, raw, epoch) }
					body.ctx = ctx
					if branch == "post-error" { return executionchannel.Reply{}, postError }
					return executionchannel.Reply{StatusCode: status, Body: body}, nil
				}}
				schedule := senderCompleteSchedule{trace: &trace}
				var err error
				switch family {
				case "process": err = sendTelemetryWith(context.Background(), nil, "unused", telemetrySample{}, schedule, channel)
				case "host": err = sendHostTelemetryWith(context.Background(), nil, "unused", hostTelemetrySample{}, schedule, channel)
				case "forward": err = sendForwardTelemetryWith(context.Background(), nil, "unused", forwardTelemetrySample{}, schedule, channel)
				case "probe": err = sendProbeTelemetryWith(context.Background(), nil, "unused", probeTelemetrySample{}, schedule, channel)
				}
				if branch == "valid" && err != nil { t.Fatal(err) }
				if branch != "valid" && err == nil { t.Fatal("failure accepted") }
				if branch == "post-error" {
					if err != postError || !reflect.DeepEqual(trace, []string{"timeout", "post", "cancel"}) { t.Fatalf("post error identity/order: %v %v", err, trace) }; return
				}
				if len(trace) < 5 || trace[0] != "timeout" || trace[1] != "post" || trace[len(trace)-2] != "close" || trace[len(trace)-1] != "cancel" { t.Fatalf("read-close-cancel order: %v", trace) }
				for _, event := range trace[2:len(trace)-2] { if event != "read" { t.Fatalf("extra action: %v", trace) } }
				if branch == "oversize" && body.consumed != 4097 { t.Fatalf("bounded ACK read consumed %d", body.consumed) }
				if branch == "status" && body.consumed != len(data) { t.Fatal("status short-circuited original body read") }
				if branch == "read-error" || branch == "status" || branch == "oversize" { prefix := "Telemetry"; if family != "process" { prefix = strings.ToUpper(family[:1])+family[1:]+" telemetry" }; if err.Error() != prefix+" response unavailable" { t.Fatalf("transport branch reached ACK or changed error: %v", err) } }
			})
		}
	}
}

func TestTelemetryCompleteEncodeFailurePrecedesTimeoutAndPost(t *testing.T) {
	// Process samples contain only scalar/native DTO fields and have no reachable marshal failure.
	for _, send := range []func(runtimeplatform.Scheduler, executionchannel.Auxiliary[*http.Client]) error{
		func(s runtimeplatform.Scheduler, c executionchannel.Auxiliary[*http.Client]) error { return sendHostTelemetryWith(context.Background(), nil, "", hostTelemetrySample{NodeID: strings.Repeat("x", 8192)}, s, c) },
		func(s runtimeplatform.Scheduler, c executionchannel.Auxiliary[*http.Client]) error { return sendForwardTelemetryWith(context.Background(), nil, "", forwardTelemetrySample{Items: make([]observationwire.ForwardCounterPoint, forwardTelemetryLimit+1)}, s, c) },
		func(s runtimeplatform.Scheduler, c executionchannel.Auxiliary[*http.Client]) error { return sendProbeTelemetryWith(context.Background(), nil, "", probeTelemetrySample{Coverage: observationwire.ProbeCounterCoverage{Returned: 1}}, s, c) },
	} {
		trace := []string{}
		channel := senderCompleteChannel{post: func(context.Context, string, []byte, uint64) (executionchannel.Reply, error) { trace = append(trace, "post"); return executionchannel.Reply{}, nil }}
		if err := send(senderCompleteSchedule{trace: &trace}, channel); err == nil || len(trace) != 0 { t.Fatalf("encode failure made effects: %v %v", err, trace) }
	}
}

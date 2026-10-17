package control

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probenegotiation"
)

func probeTestAck(request probenegotiation.Request) probenegotiation.Response {
	return probenegotiation.Response{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-hello-ack",
		NodeId: request.NodeId, BootId: request.BootId, SessionEpoch: request.SessionEpoch, InstanceId: request.InstanceId,
		Capability: request.Capability, Point: request.Point, MaxTimeoutMs: 2000, MaxAttempts: 1,
		ServerTime: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"), State: "contract-only", ExecutionEnabled: false}
}

func TestProbeClientNegotiationDoesNotAuthorizeExecution(t *testing.T) {
	runner, binding, sample := probeTestRunner(t)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/agent/v3/probe/hello" ||
			r.Header.Get("X-TuneX-Session-Epoch") != strconv.FormatUint(binding.SessionEpoch, 10) {
			t.Error("incorrect negotiation route or session")
		}
		raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
		request, err := probenegotiation.ParseRequest(raw)
		if err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		response := probeTestAck(*request)
		response.ServerTime = sample.Wall.UTC().Format("2006-01-02T15:04:05.000Z")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()
	runner.options.URL, runner.client = server.URL, server.Client()
	session, err := runner.negotiateProbe(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer session.gate.Close()
	if len(session.gate.InstanceID()) != 64 || runner.journal.Generation != 3 || len(runner.instances) != 1 {
		t.Fatal("negotiation changed execution state or lost the random instance")
	}
	// Recognition supplies no independent authorizer, even with a valid binding.
	if _, err := session.gate.Run(context.Background(), probe.Grant{
		PermitID: "not-issued", InstanceID: session.gate.InstanceID(),
		Permit: probe.Permit{Binding: binding, Until: time.Now().Add(time.Second)}, Timeout: time.Second,
	}); err == nil {
		t.Fatal("contract-only acknowledgement became a network grant")
	}
}

func TestProbeClientRejectsUnboundActiveOversizedOrSupersededAcknowledgements(t *testing.T) {
	for _, scenario := range []string{"nonce", "enabled", "oversized", "session", "clock", "http"} {
		t.Run(scenario, func(t *testing.T) {
			runner, _, sample := probeTestRunner(t)
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
				request, err := probenegotiation.ParseRequest(raw)
				if err != nil {
					t.Error(err)
					w.WriteHeader(400)
					return
				}
				response := probeTestAck(*request)
				response.ServerTime = sample.Wall.UTC().Format("2006-01-02T15:04:05.000Z")
				switch scenario {
				case "nonce":
					response.InstanceId = strings.Repeat("b", 64)
				case "enabled":
					response.ExecutionEnabled = true
				case "oversized":
					_, _ = w.Write([]byte(strings.Repeat(" ", 4097)))
					return
				case "session":
					response.SessionEpoch++
				case "clock":
					response.ServerTime = sample.Wall.Add(time.Minute).UTC().Format("2006-01-02T15:04:05.000Z")
				case "http":
					w.WriteHeader(404)
					return
				}
				_ = json.NewEncoder(w).Encode(response)
			}))
			defer server.Close()
			runner.options.URL, runner.client = server.URL, server.Client()
			if session, err := runner.negotiateProbe(context.Background()); err == nil || session != nil {
				if session != nil {
					session.gate.Close()
				}
				t.Fatal("unsafe acknowledgement retained a Probe session")
			}
		})
	}
}

package contracts_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3execution"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probeclaim"
	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/probeinstance"
	"github.com/tunex/vnext/agent/internal/probenegotiation"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"github.com/tunex/vnext/agent/internal/transitcontracts"
	"github.com/tunex/vnext/agent/internal/transitdelivery"
	"github.com/tunex/vnext/agent/internal/transitnegotiation"
)

func TestNativeCodecCompleteEveryADP3ExecutionAliasRetainsTypeIdentity(t *testing.T) {
	for _, v := range [][2]any{
		{(*adp3.Id)(nil), (*adp3execution.Id)(nil)}, {(*adp3.Counter)(nil), (*adp3execution.Counter)(nil)}, {(*adp3.CounterOrZero)(nil), (*adp3execution.CounterOrZero)(nil)}, {(*adp3.Time)(nil), (*adp3execution.Time)(nil)}, {(*adp3.Digest)(nil), (*adp3execution.Digest)(nil)}, {(*adp3.Protocol)(nil), (*adp3execution.Protocol)(nil)}, {(*adp3.Phase)(nil), (*adp3execution.Phase)(nil)}, {(*adp3.Condition)(nil), (*adp3execution.Condition)(nil)},
		{adp3.Listen{}, adp3execution.Listen{}}, {adp3.Target{}, adp3execution.Target{}}, {adp3.DirectConfig{}, adp3execution.DirectConfig{}}, {adp3.Driver{}, adp3execution.Driver{}}, {adp3.Assignment{}, adp3execution.Assignment{}}, {adp3.Tombstone{}, adp3execution.Tombstone{}}, {adp3.Observation{}, adp3execution.Observation{}}, {adp3.Drain{}, adp3execution.Drain{}}, {adp3.Policy{}, adp3execution.Policy{}}, {adp3.HelloRequest{}, adp3execution.HelloRequest{}}, {adp3.HelloResponse{}, adp3execution.HelloResponse{}}, {adp3.Snapshot{}, adp3execution.Snapshot{}}, {adp3.ReportRequest{}, adp3execution.ReportRequest{}}, {adp3.ReportAck{}, adp3execution.ReportAck{}}, {adp3.ErrorResponse{}, adp3execution.ErrorResponse{}}, {adp3.Binding{}, adp3execution.Binding{}}, {adp3.ProfileConfig{}, adp3execution.ProfileConfig{}}, {adp3.RelayConfig{}, adp3execution.RelayConfig{}}, {adp3.RuntimeConfig{}, adp3execution.RuntimeConfig{}}, {adp3.Resource{}, adp3execution.Resource{}}, {adp3.HopNode{}, adp3execution.HopNode{}}, {adp3.HopConfig{}, adp3execution.HopConfig{}}, {adp3.MultihopConfig{}, adp3execution.MultihopConfig{}},
	} {
		if reflect.TypeOf(v[0]) != reflect.TypeOf(v[1]) {
			t.Fatal("public native generated alias became a different declaration", reflect.TypeOf(v[0]), reflect.TypeOf(v[1]))
		}
	}
	// ADP2-shaped internal validators remain reusable but live ADP3 rejects the
	// same old envelope; a stateless helper success is not online negotiation.
	raw := []byte(`{"protocolVersion":2,"nodeId":"node","bootId":"boot","agentBuild":"build","lastStoredSnapshotGeneration":0,"capabilities":["native.direct.v1","tcp","udp"]}`)
	if _, err := contracts.ParseMessage("HelloRequest", raw); err != nil {
		t.Fatal("internal ADP2 native contract reuse broke", err)
	}
	if _, err := adp3.Parse("HelloRequest", raw); err == nil {
		t.Fatal("live ADP3 acquired ADP2 fallback")
	}
}

func codecNativeParser[T any](parse func([]byte) (*T, error)) func([]byte) error {
	return func(raw []byte) error { _, err := parse(raw); return err }
}

func codecNativeJSON(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestNativeCodecCompleteProbeFamiliesClosedMeasurementsAndNativeTimeWindows(t *testing.T) {
	families := []struct {
		name                string
		version             int
		measurements        []string
		qualification, poll func([]byte) error
	}{
		{"types", 2, []string{"tcp-connect-v1", "tcp-ingress-connect-v1"}, codecNativeParser(probetypes.ParseQualificationResponse), codecNativeParser(probetypes.ParsePollResponse)},
		{"services", 3, []string{"tcp-connect-v1", "tcp-ingress-connect-v1", "tcp-ingress-tls-v1"}, codecNativeParser(probeservices.ParseQualificationResponse), codecNativeParser(probeservices.ParsePollResponse)},
		{"echo", 4, []string{"tcp-connect-v1", "tcp-ingress-connect-v1", "tcp-ingress-tls-v1", "tcp-ingress-echo-v1", "udp-ingress-echo-v1"}, codecNativeParser(probeecho.ParseQualificationResponse), codecNativeParser(probeecho.ParsePollResponse)},
	}
	start := time.Date(2026, 10, 19, 1, 2, 3, 0, time.UTC)
	stamp := func(v time.Time) string { return v.Format(time.RFC3339Nano) }
	for _, f := range families {
		t.Run(f.name, func(t *testing.T) {
			machine := func() map[string]any {
				return map[string]any{"protocolVersion": 3, "probeVersion": f.version, "nodeId": "node", "bootId": "boot", "sessionEpoch": 1, "instanceId": strings.Repeat("a", 64), "instanceGeneration": 1, "requestId": strings.Repeat("b", 64)}
			}
			qualified := func() map[string]any {
				v := machine()
				v["kind"] = "probe-" + f.name + "-instance-ack"
				v["action"] = "register"
				v["measurements"] = f.measurements
				v["qualified"] = true
				v["qualifiedAt"] = stamp(start)
				v["expiresAt"] = stamp(start.Add(30 * time.Second))
				v["serverTime"] = stamp(start)
				v["executionEnabled"] = false
				return v
			}
			if err := f.qualification(codecNativeJSON(t, qualified())); err != nil {
				t.Fatal("native inclusive30second qualification rejected", err)
			}
			for _, mutate := range []func(map[string]any){func(v map[string]any) { v["expiresAt"] = stamp(start) }, func(v map[string]any) { v["expiresAt"] = stamp(start.Add(30*time.Second + time.Nanosecond)) }, func(v map[string]any) { v["serverTime"] = stamp(start.Add(-time.Nanosecond)) }, func(v map[string]any) { v["serverTime"] = stamp(start.Add(30 * time.Second)) }, func(v map[string]any) { v["qualified"] = false }, func(v map[string]any) { v["qualifiedAt"] = nil }, func(v map[string]any) { v["expiresAt"] = nil }, func(v map[string]any) { v["executionEnabled"] = true }, func(v map[string]any) {
				v["measurements"] = append(append([]string(nil), f.measurements...), "new-measurement")
			}, func(v map[string]any) { v["measurements"] = []string{f.measurements[1], f.measurements[0]} }, func(v map[string]any) { v["probeVersion"] = 1 }, func(v map[string]any) { v["nodeId"] = "bad\n" }} {
				v := qualified()
				mutate(v)
				if err := f.qualification(codecNativeJSON(t, v)); err == nil {
					t.Fatal("native qualification/time/family refusal relaxed", v)
				}
			}
			v := qualified()
			v["qualified"] = false
			v["qualifiedAt"] = nil
			v["expiresAt"] = nil
			if err := f.qualification(codecNativeJSON(t, v)); err != nil {
				t.Fatal("unqualified explicit null fields refused", err)
			}
			poll := func() map[string]any {
				v := machine()
				v["kind"] = "probe-" + f.name + "-poll-ack"
				v["measurements"] = f.measurements
				v["observedAt"] = stamp(start)
				v["serverTime"] = stamp(start.Add(250 * time.Millisecond))
				v["executionEnabled"] = false
				v["offer"] = nil
				return v
			}
			if err := f.poll(codecNativeJSON(t, poll())); err != nil {
				t.Fatal("native inclusive250ms poll window rejected", err)
			}
			for _, when := range []time.Time{start.Add(-time.Nanosecond), start.Add(250*time.Millisecond + time.Nanosecond)} {
				v := poll()
				v["serverTime"] = stamp(when)
				if err := f.poll(codecNativeJSON(t, v)); err == nil {
					t.Fatal("native poll relative timestamp bound relaxed")
				}
			}
			for _, other := range families {
				if other.version == f.version {
					continue
				}
				v := qualified()
				v["measurements"] = other.measurements
				if err := f.qualification(codecNativeJSON(t, v)); err == nil {
					t.Fatal("native closed measurement family accepted another family", other.name)
				}
			}
		})
	}
	if !reflect.DeepEqual(probeecho.Measurements(), families[2].measurements) {
		t.Fatal("native Echo measurement order changed")
	}
	values := probeecho.Measurements()
	values[0] = "mutated"
	if probeecho.Measurements()[0] != "tcp-connect-v1" {
		t.Fatal("native measurement list leaked mutable singleton")
	}
}

func TestNativeCodecCompleteTLSAndEchoContextsRemainDistinctPublicRepresentationOnly(t *testing.T) {
	from := uint64(time.Date(2026, 10, 19, 1, 2, 3, 0, time.UTC).UnixMilli())
	selection := probeservices.Selection{ScopeId: "scope", ServiceId: "service", Revision: 2, ConfigRevision: 1}
	rehash := func(s *probeservices.Selection, config any) {
		var err error
		s.ConfigDigest, err = contracts.ComputeDigest(config)
		if err != nil {
			t.Fatal(err)
		}
		s.ContextDigest, err = contracts.ComputeDigest(map[string]any{"scopeId": s.ScopeId, "serviceId": s.ServiceId, "revision": s.Revision, "configRevision": s.ConfigRevision, "configDigest": s.ConfigDigest, "config": config})
		if err != nil {
			t.Fatal(err)
		}
	}
	tlsConfig := probeservices.ServiceConfig{Version: 1, Purpose: "direct-ingress-tls-handshake", Endpoint: probeservices.ServiceEndpoint{Address: "127.0.0.1", Port: 443}, Trust: probeservices.ServiceTrust{Mode: "pinned-leaf-v1", ServerName: "observation.test", CertificateDer: "AQ=="}, ValidFrom: from, ValidUntil: from + 604800000}
	rehash(&selection, tlsConfig)
	tlsContext := probeservices.ServiceContext{Selection: selection, Config: tlsConfig}
	raw := codecNativeJSON(t, tlsContext)
	tlsParsed, err := probeservices.ParseServiceContext(raw)
	if err != nil || *tlsParsed != tlsContext {
		t.Fatal("public TLS context parser acquired X509/current-authority validation", err)
	}
	echoTLS, err := probeecho.ParseServiceContext(raw)
	if err != nil || echoTLS.Config.Version != 1 || probeecho.SelectionFromContext(*echoTLS) != selection || probeservices.SelectionFromContext(*tlsParsed) != selection {
		t.Fatal("unified Echo family lost explicit TLS context compatibility", err)
	}
	if got, err := probeservices.ParseSelection(codecNativeJSON(t, selection)); err != nil || *got != selection {
		t.Fatal("public TLS selection alias changed", err)
	}
	if got, err := probeecho.ParseSelection(codecNativeJSON(t, selection)); err != nil || *got != selection {
		t.Fatal("public Echo selection alias changed", err)
	}
	for _, mutate := range []func(*probeservices.ServiceContext){func(c *probeservices.ServiceContext) { c.Revision = 0 }, func(c *probeservices.ServiceContext) { c.Revision = 1; c.ConfigRevision = 2 }, func(c *probeservices.ServiceContext) { c.ConfigDigest = "sha256:" + strings.Repeat("0", 64) }, func(c *probeservices.ServiceContext) { c.ContextDigest = "sha256:" + strings.Repeat("0", 64) }, func(c *probeservices.ServiceContext) { c.Config.Trust.ServerName = "LOCALHOST" }, func(c *probeservices.ServiceContext) { c.Config.Endpoint.Address = "::ffff:127.0.0.1" }, func(c *probeservices.ServiceContext) { c.Config.ValidUntil = c.Config.ValidFrom }, func(c *probeservices.ServiceContext) { c.Config.ValidUntil = c.Config.ValidFrom + 604800001 }, func(c *probeservices.ServiceContext) { c.Config.Trust.CertificateDer = "AR==" }} {
		v := tlsContext
		mutate(&v)
		if _, err := probeservices.ParseServiceContext(codecNativeJSON(t, v)); err == nil {
			t.Fatal("native TLS context semantic/digest refusal relaxed")
		}
	}
	echoConfig := probeecho.ServiceConfig{Version: 2, Purpose: "controlled-nonce-echo", Endpoint: probeecho.ServiceEndpoint{Address: "127.0.0.1", Port: 443, Protocols: []string{"tcp", "udp"}}, Trust: probeecho.ServiceTrust{Mode: "ed25519-echo-v1", PublicKey: base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{9}, 32))}, ValidFrom: from, ValidUntil: from + 604800000}
	echoSelection := selection
	rehash(&echoSelection, echoConfig)
	echoContext := probeecho.ServiceContext{Selection: echoSelection, Config: echoConfig}
	echoRaw := codecNativeJSON(t, echoContext)
	if parsed, err := probeecho.ParseServiceContext(echoRaw); err != nil || !reflect.DeepEqual(*parsed, echoContext) {
		t.Fatal("native Echo context refused exact7day/config/digest", err)
	}
	if _, err := probeservices.ParseServiceContext(echoRaw); err == nil {
		t.Fatal("TLS-only family accepted Echo public key context")
	}
	clone := probeecho.CloneContext(echoContext)
	clone.Config.Endpoint.Protocols[0] = "mutated"
	if echoContext.Config.Endpoint.Protocols[0] != "tcp" {
		t.Fatal("native context clone retained source slice")
	}
	execution := probeecho.CloneExecution(probeecho.Execution{Context: echoContext})
	execution.Context.Config.Endpoint.Protocols[0] = "mutated"
	if echoContext.Config.Endpoint.Protocols[0] != "tcp" {
		t.Fatal("native execution clone retained source slice")
	}
	for _, mutate := range []func(*probeecho.ServiceConfig){func(c *probeecho.ServiceConfig) { c.Version = 1 }, func(c *probeecho.ServiceConfig) { c.Endpoint.Address = "169.254.169.254" }, func(c *probeecho.ServiceConfig) { c.Endpoint.Protocols = []string{"udp", "tcp"} }, func(c *probeecho.ServiceConfig) {
		c.Trust.PublicKey = base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 31))
	}, func(c *probeecho.ServiceConfig) { c.ValidUntil = c.ValidFrom }, func(c *probeecho.ServiceConfig) { c.ValidUntil = c.ValidFrom + 604800001 }} {
		v := echoConfig
		mutate(&v)
		if _, err := probeecho.ParseServiceConfig(codecNativeJSON(t, v)); err == nil {
			t.Fatal("native Echo config refusal relaxed")
		}
	}
	challenge := probeecho.Challenge{Nonce: base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32)), InvocationDigest: "sha256:" + strings.Repeat("a", 64)}
	if got, err := probeecho.ParseChallenge(codecNativeJSON(t, challenge)); err != nil || *got != challenge {
		t.Fatal("native challenge shape changed", err)
	}
	challenge.Nonce = challenge.Nonce[:42] + "B="
	if _, err := probeecho.ParseChallenge(codecNativeJSON(t, challenge)); err == nil {
		t.Fatal("noncanonical base64 challenge accepted")
	}
	proof := probeecho.Proof{Algorithm: "Ed25519", RequestDigest: "sha256:" + strings.Repeat("b", 64), Signature: base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{11}, 64)), Verified: true}
	if got, err := probeecho.ParseProof(codecNativeJSON(t, proof)); err != nil || *got != proof {
		t.Fatal("public proof parser acquired signature authority", err)
	}
	proof.Verified = false
	if _, err := probeecho.ParseProof(codecNativeJSON(t, proof)); err == nil {
		t.Fatal("unverified proof shape accepted")
	}
}

func TestNativeCodecCompleteEveryPublicParserBoundIJSONBeforeSchemaAndTypedDecode(t *testing.T) {
	parsers := []struct {
		name    string
		maximum int
		parse   func([]byte) error
	}{
		{"transit/intent", 16384, codecNativeParser(transitcontracts.Parse)},
		{"transit/assignment", 16384, codecNativeParser(adp3transit.ParseAssignment)}, {"transit/snapshot", 4194304, codecNativeParser(adp3transit.ParseSnapshot)},
		{"transit/negotiation-request", 8192, codecNativeParser(transitnegotiation.ParseRequest)}, {"transit/negotiation-response", 8192, codecNativeParser(transitnegotiation.ParseResponse)},
		{"transit/command", 8192, codecNativeParser(transitdelivery.ParseCommand)}, {"transit/report", 8192, codecNativeParser(transitdelivery.ParseReport)}, {"transit/ack", 8192, codecNativeParser(transitdelivery.ParseAck)},
		{"instance/request", 4096, codecNativeParser(probeinstance.ParseRequest)}, {"instance/response", 4096, codecNativeParser(probeinstance.ParseResponse)},
		{"negotiation/request", 4096, codecNativeParser(probenegotiation.ParseRequest)}, {"negotiation/response", 4096, codecNativeParser(probenegotiation.ParseResponse)},
		{"claim/request", 4096, codecNativeParser(probeclaim.ParseRequest)}, {"claim/response", 4096, codecNativeParser(probeclaim.ParseResponse)},
		{"delivery/poll-request", 4096, codecNativeParser(probedelivery.ParsePollRequest)}, {"delivery/poll-response", 4096, codecNativeParser(probedelivery.ParsePollResponse)},
		{"delivery/status-request", 4096, codecNativeParser(probedelivery.ParseStatusRequest)}, {"delivery/status-response", 4096, codecNativeParser(probedelivery.ParseStatusResponse)},
		{"result/request", 4096, codecNativeParser(proberesult.ParseRequest)}, {"result/response", 4096, codecNativeParser(proberesult.ParseResponse)},
		{"types/qualification-request", 4096, codecNativeParser(probetypes.ParseQualificationRequest)}, {"types/qualification-response", 4096, codecNativeParser(probetypes.ParseQualificationResponse)},
		{"types/poll-request", 4096, codecNativeParser(probetypes.ParsePollRequest)}, {"types/poll-response", 4096, codecNativeParser(probetypes.ParsePollResponse)},
		{"types/claim-request", 4096, codecNativeParser(probetypes.ParseClaimRequest)}, {"types/claim-response", 4096, codecNativeParser(probetypes.ParseClaimResponse)},
		{"types/status-request", 4096, codecNativeParser(probetypes.ParseStatusRequest)}, {"types/status-response", 4096, codecNativeParser(probetypes.ParseStatusResponse)},
		{"types/result-request", 4096, codecNativeParser(probetypes.ParseResultRequest)}, {"types/result-response", 4096, codecNativeParser(probetypes.ParseResultResponse)},
		{"services/selection", 4096, codecNativeParser(probeservices.ParseServiceSelection)}, {"services/selection-alias", 4096, codecNativeParser(probeservices.ParseSelection)},
		{"services/context", 16384, codecNativeParser(probeservices.ParseServiceContext)},
		{"services/qualification-request", 4096, codecNativeParser(probeservices.ParseQualificationRequest)}, {"services/qualification-response", 4096, codecNativeParser(probeservices.ParseQualificationResponse)},
		{"services/poll-request", 4096, codecNativeParser(probeservices.ParsePollRequest)}, {"services/poll-response", 32768, codecNativeParser(probeservices.ParsePollResponse)},
		{"services/claim-request", 4096, codecNativeParser(probeservices.ParseClaimRequest)}, {"services/claim-response", 4096, codecNativeParser(probeservices.ParseClaimResponse)},
		{"services/status-request", 4096, codecNativeParser(probeservices.ParseStatusRequest)}, {"services/status-response", 4096, codecNativeParser(probeservices.ParseStatusResponse)},
		{"services/result-request", 4096, codecNativeParser(probeservices.ParseResultRequest)}, {"services/result-response", 4096, codecNativeParser(probeservices.ParseResultResponse)},
		{"echo/config", 16384, codecNativeParser(probeecho.ParseServiceConfig)}, {"echo/context", 16384, codecNativeParser(probeecho.ParseServiceContext)},
		{"echo/selection", 4096, codecNativeParser(probeecho.ParseServiceSelection)}, {"echo/selection-alias", 4096, codecNativeParser(probeecho.ParseSelection)},
		{"echo/challenge", 512, codecNativeParser(probeecho.ParseChallenge)}, {"echo/proof", 512, codecNativeParser(probeecho.ParseProof)}, {"echo/invocation", 4096, codecNativeParser(probeecho.ParseInvocation)},
		{"echo/qualification-request", 4096, codecNativeParser(probeecho.ParseQualificationRequest)}, {"echo/qualification-response", 4096, codecNativeParser(probeecho.ParseQualificationResponse)},
		{"echo/poll-request", 4096, codecNativeParser(probeecho.ParsePollRequest)}, {"echo/poll-response", 32768, codecNativeParser(probeecho.ParsePollResponse)},
		{"echo/claim-request", 4096, codecNativeParser(probeecho.ParseClaimRequest)}, {"echo/claim-response", 4096, codecNativeParser(probeecho.ParseClaimResponse)},
		{"echo/status-request", 4096, codecNativeParser(probeecho.ParseStatusRequest)}, {"echo/status-response", 4096, codecNativeParser(probeecho.ParseStatusResponse)},
		{"echo/result-request", 4096, codecNativeParser(probeecho.ParseResultRequest)}, {"echo/result-response", 4096, codecNativeParser(probeecho.ParseResultResponse)},
	}
	for _, name := range []string{"HelloRequest", "HelloResponse", "Snapshot", "ReportRequest", "ReportAck", "ErrorResponse"} {
		maximum := 4194304
		if name == "ReportRequest" {
			maximum = 1048576
		}
		parsers = append(parsers, struct {
			name    string
			maximum int
			parse   func([]byte) error
		}{"adp2/" + name, maximum, func(raw []byte) error { _, err := contracts.ParseMessage(name, raw); return err }}, struct {
			name    string
			maximum int
			parse   func([]byte) error
		}{"adp3/" + name, maximum, func(raw []byte) error { _, err := adp3.Parse(name, raw); return err }})
	}
	for _, name := range []string{"ProfileConfig", "Open", "Accept", "Reject"} {
		parsers = append(parsers, struct {
			name    string
			maximum int
			parse   func([]byte) error
		}{"relay/" + name, 4096, func(raw []byte) error { return relaycontracts.Parse(name, raw, new(int)) }})
	}
	for _, name := range []string{"Assignment", "Tombstone"} {
		parsers = append(parsers, struct {
			name    string
			maximum int
			parse   func([]byte) error
		}{"adp3relay/" + name, 16384, func(raw []byte) error { return adp3relay.Parse(name, raw, new(int)) }})
	}
	for _, p := range parsers {
		t.Run(p.name, func(t *testing.T) {
			cases := [][]byte{[]byte("{"), []byte(`{"x":1,"x":2}`), []byte(`{"x":9007199254740992}`), []byte(`{"x":0.5}`), []byte(`{"x":"\ud800"}`), []byte("{} true"), {'"', 255, '"'}, []byte(strings.Repeat("[", 66) + "0" + strings.Repeat("]", 66)), bytes.Repeat([]byte{' '}, p.maximum+1)}
			for _, raw := range cases {
				_, want := contracts.ParseJSON(raw, p.maximum)
				got := p.parse(raw)
				if want == nil || got == nil || got.Error() != want.Error() {
					t.Fatal("native IJSON/size/JCS failure did not precede schema/semantic/typed stage", got, want)
				}
			}
			exact := append([]byte("{}"), bytes.Repeat([]byte{' '}, p.maximum-2)...)
			if _, err := contracts.ParseJSON(exact, p.maximum); err != nil {
				t.Fatal(err)
			}
			if err := p.parse(exact); err == nil || strings.HasPrefix(err.Error(), "RESOURCE_LIMIT:") {
				t.Fatal("exact native byte cap did not reach structural refusal", err)
			}
		})
	}
	for _, unknown := range []func() error{func() error { return contracts.ValidateStructure("unknown", []byte("{")) }, func() error { _, err := adp3.Parse("unknown", []byte("{")); return err }, func() error { return relaycontracts.Parse("unknown", []byte("{"), new(int)) }, func() error { return adp3relay.Parse("unknown", []byte("{"), new(int)) }} {
		if err := unknown(); err == nil || !strings.Contains(err.Error(), "Unknown") {
			t.Fatal("unknown family name no longer precedes body parse", err)
		}
	}
	raw := []byte(`{"wireVersion":1,"type":"accepted","requestId":"request-a","bindingDigest":"sha256:1111111111111111111111111111111111111111111111111111111111111111"}`)
	if err := relaycontracts.Parse("Accept", raw, nil); err != nil {
		t.Fatal("native nil destination no longer skips only final decode", err)
	}
	var typed *json.UnmarshalTypeError
	if err := relaycontracts.Parse("Accept", raw, new(int)); !errors.As(err, &typed) {
		t.Fatal("native schema-valid final typed error lost", err)
	}
	exponent := bytes.Replace(raw, []byte(`"wireVersion":1`), []byte(`"wireVersion":1e0`), 1)
	var accepted relaycontracts.Accept
	if err := relaycontracts.Parse("Accept", exponent, &accepted); err != nil || accepted.WireVersion != 1 {
		t.Fatal("JCS normalization no longer precedes typed uint decode", err)
	}
}

// Each copy contains the actual owner .go/.json files with no production edits.
// Separate child processes provide a genuinely untouched sync.Once per mode;
// no reset API or mutation of the live test process validators is introduced.
func TestNativeCodecCompleteActualEverySchemaLazyStickyCompileError(t *testing.T) {
	owners := []struct{ name, source, errorField, trigger string }{
		{"contracts", "schemaBytes", "compileError", `return ValidateStructure("HelloRequest",nil)`},
		{"adp3", "rawSchema", "compileError", `_,err:=Parse("HelloRequest",nil);return err`},
		{"adp3", "executionSchema", "compileError", `_,err:=Parse("HelloRequest",nil);return err`},
		{"adp3relay", "schemaBytes", "compileErr", `return Parse("Assignment",nil,&Assignment{})`},
		{"adp3transit", "schemaBytes", "compileError", `_,err:=ParseAssignment(nil);return err`},
		{"relaycontracts", "schemaBytes", "compileError", `return Parse("ProfileConfig",nil,&ProfileConfig{})`},
		{"transitcontracts", "schemaBytes", "schemaError", `_,err:=Parse(nil);return err`},
		{"transitnegotiation", "schemaBytes", "compileError", `_,err:=ParseRequest(nil);return err`},
		{"transitdelivery", "schemaBytes", "compileError", `_,err:=ParseCommand(nil);return err`},
		{"probeinstance", "schemaBytes", "compileError", `_,err:=ParseRequest(nil);return err`},
		{"probenegotiation", "schemaBytes", "compileError", `_,err:=ParseRequest(nil);return err`},
		{"probeclaim", "schemaBytes", "compileError", `_,err:=ParseRequest(nil);return err`},
		{"probedelivery", "schemaBytes", "compileError", `_,err:=ParsePollRequest(nil);return err`},
		{"proberesult", "schemaBytes", "compileError", `_,err:=ParseRequest(nil);return err`},
		{"probetypes", "schemaBytes", "compileError", `_,err:=ParseQualificationRequest(nil);return err`},
		{"probeservices", "schemaBytes", "compileError", `_,err:=ParseServiceContext(nil);return err`},
		{"probeecho", "schemaBytes", "compileError", `_,err:=ParseServiceConfig(nil);return err`},
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/codeclazyfixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte(module), 0600); err != nil {
		t.Fatal(err)
	}
	for _, owner := range owners {
		destination := filepath.Join(root, owner.name+"-"+owner.source)
		if err := os.Mkdir(destination, 0700); err != nil {
			t.Fatal(err)
		}
		entries, err := os.ReadDir(filepath.Join("..", owner.name))
		if err != nil {
			t.Fatal(err)
		}
		copiedSchema, copiedValidator := false, false
		for _, entry := range entries {
			if entry.IsDir() || strings.HasSuffix(entry.Name(), "_test.go") || !strings.HasSuffix(entry.Name(), ".go") && !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			raw, err := os.ReadFile(filepath.Join("..", owner.name, entry.Name()))
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(destination, entry.Name()), raw, 0600); err != nil {
				t.Fatal(err)
			}
			copiedSchema = copiedSchema || entry.Name() == "schema.json"
			copiedValidator = copiedValidator || entry.Name() == "validate.go"
		}
		if !copiedSchema || !copiedValidator {
			t.Fatal("actual native schema owner missing", owner.name)
		}
		fixture := fmt.Sprintf(codecLazyCompleteFixture, owner.name, owner.trigger, owner.errorField, owner.source, owner.source, owner.source, owner.source)
		if err := os.WriteFile(filepath.Join(destination, "actual_lazy_test.go"), []byte(fixture), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for _, mode := range []string{"invalid-json", "missing-definitions"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", "-run", "TestActualNativeLazyStickyCompileError", "./...")
			command.Dir = root
			command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local", "TUNEX_CODEC_COMPILE_FAILURE="+mode)
			if out, err := command.CombinedOutput(); err != nil {
				t.Fatalf("actual per-owner native schema lazy/sticky: %v\n%s", err, out)
			}
		})
	}
}

const codecLazyCompleteFixture = `package %s
import("bytes";"os";"sync";"testing")
func codecTriggerFixture()error{%s}
func TestActualNativeLazyStickyCompileError(t *testing.T){
 if %s!=nil{t.Fatal("schema initialization no longer lazy")};original:=append([]byte(nil),%s...)
 malformed:=[]byte("{");if os.Getenv("TUNEX_CODEC_COMPILE_FAILURE")=="missing-definitions"{malformed=[]byte("{\"$defs\":{}}")};%s=malformed
 first:=codecTriggerFixture();if first==nil{t.Fatal("actual owner schema compiler accepted injected malformed source")}
 %s=original
 if next:=codecTriggerFixture();next!=first{t.Fatal("sync.Once retried or replaced sticky native compile error",first,next)}
 var workers sync.WaitGroup;errors:=make(chan error,32);for i:=0;i<32;i++{workers.Add(1);go func(){defer workers.Done();errors<-codecTriggerFixture()}()};workers.Wait();close(errors);for err:=range errors{if err!=first{t.Fatal("concurrent parse lost sticky error identity",err)}}
 if !bytes.Equal(%s,original){t.Fatal("native parse mutated schema bytes")}
}
`

func TestNativeCodecCompleteActualADPValidatorCLIBoundsAndExitCodes(t *testing.T) {
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	executable := filepath.Join(t.TempDir(), "adp-validator")
	if os.PathSeparator == '\\' {
		executable += ".exe"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	build := exec.CommandContext(ctx, "go", "build", "-o", executable, "./cmd/adp-validate")
	build.Dir = moduleRoot
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("actual validator fixture executable: %v\n%s", err, out)
	}
	fixture, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Cases []struct {
			Name, Schema, Raw string
			Valid             bool
		}
	}
	if err := json.Unmarshal(fixture, &document); err != nil {
		t.Fatal(err)
	}
	var valid []byte
	for _, v := range document.Cases {
		if v.Schema == "HelloRequest" && v.Valid {
			valid = []byte(v.Raw)
			break
		}
	}
	if valid == nil {
		t.Fatal("actual Hello fixture missing")
	}
	for _, v := range []struct {
		name string
		args []string
		body []byte
		code int
	}{{"usage", nil, nil, 2}, {"extra", []string{"HelloRequest", "ignored"}, valid, 2}, {"valid", []string{"HelloRequest"}, valid, 0}, {"unknown", []string{"Unknown"}, valid, 1}, {"duplicate", []string{"HelloRequest"}, []byte(`{"protocolVersion":3,"protocolVersion":3}`), 1}, {"oversize", []string{"HelloRequest"}, bytes.Repeat([]byte{' '}, 4194305), 1}} {
		t.Run(v.name, func(t *testing.T) {
			command := exec.CommandContext(ctx, executable, v.args...)
			command.Stdin = bytes.NewReader(v.body)
			var stdout, stderr bytes.Buffer
			command.Stdout = &stdout
			command.Stderr = &stderr
			err := command.Run()
			code := 0
			if err != nil {
				exit, ok := err.(*exec.ExitError)
				if !ok {
					t.Fatal(err)
				}
				code = exit.ExitCode()
			}
			if code != v.code {
				t.Fatal("actual validator exit", code, v.code, stderr.String())
			}
			if code == 0 {
				if stdout.String() != "{\"message\":\"HelloRequest\",\"protocolVersion\":3,\"valid\":true}\n" || stderr.Len() != 0 {
					t.Fatal("original validator JSON projection", stdout.String(), stderr.String())
				}
			} else if stdout.Len() != 0 || stderr.Len() == 0 {
				t.Fatal("validator failure output channels changed")
			}
		})
	}
}

func TestNativeCodecCompleteOriginalTimeProofCLIProviderFilesWatchAndCapture(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "../../cmd/time-proof/main.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	replacements := map[string]string{"authorization.ValidateProofBoundary": "proofBoundaryFixture", "authorization.SynchronizedClock": "proofClockFixture", "authorization.ReadSystemSynchronization": "proofStatusFixture", "authorization.WriteProof": "proofWriteFixture", "signal.NotifyContext": "proofSignalFixture", "time.After": "proofAfterFixture", "rand.Read": "proofRandomFixture", "state.AtomicWrite": "proofAtomicFixture"}
	counts := map[string]int{}
	ast.Inspect(file, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		sel, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		owner, ok := sel.X.(*ast.Ident)
		if !ok {
			return true
		}
		key := owner.Name + "." + sel.Sel.Name
		if replacement := replacements[key]; replacement != "" {
			call.Fun = ast.NewIdent(replacement)
			counts[key]++
		}
		return true
	})
	if !reflect.DeepEqual(counts, map[string]int{"authorization.ValidateProofBoundary": 2, "authorization.SynchronizedClock": 1, "authorization.ReadSystemSynchronization": 2, "authorization.WriteProof": 1, "signal.NotifyContext": 1, "time.After": 1, "rand.Read": 1, "state.AtomicWrite": 1}) {
		t.Fatal("actual proof CLI effect inventory changed", counts)
	}
	used := map[string]bool{}
	ast.Inspect(file, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if owner, ok := sel.X.(*ast.Ident); ok {
				used[owner.Name] = true
			}
		}
		return true
	})
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.IMPORT {
			continue
		}
		kept := gen.Specs[:0]
		for _, spec := range gen.Specs {
			imp := spec.(*ast.ImportSpec)
			name, err := strconv.Unquote(imp.Path.Value)
			if err != nil {
				t.Fatal(err)
			}
			parts := strings.Split(name, "/")
			name = parts[len(parts)-1]
			if imp.Name != nil {
				name = imp.Name.Name
			}
			if used[name] {
				kept = append(kept, imp)
			}
		}
		gen.Specs = kept
	}
	var source bytes.Buffer
	if err := format.Node(&source, set, file); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/proofclifixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": source.Bytes(), "effects_test.go": []byte(proofCLICompleteFixture)} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if out, err := command.CombinedOutput(); err != nil {
		t.Fatalf("actual time-proof CLI effects: %v\n%s", err, out)
	}
}

const proofCLICompleteFixture = `package main
import("bytes";"context";"errors";"flag";"io";"os";"os/exec";"path/filepath";"reflect";"strings";"testing";"time";"github.com/tunex/vnext/agent/internal/authorization")
var proofModeFixture string
var proofEventsFixture []string
var proofFailureFixture=errors.New("original native proof CLI effect")
var proofUntilFixture=time.Date(2026,10,20,1,2,3,456000000,time.UTC)
var proofWritesFixture []authorization.SyncStatus
var proofCancelFixture context.CancelFunc
var proofRandomCallsFixture int
func proofBoundaryFixture(out,key,journal string)error{proofEventsFixture=append(proofEventsFixture,"boundary:"+out+":"+key+":"+journal);if proofModeFixture=="boundary"{return proofFailureFixture};return nil}
func proofClockFixture(skew time.Duration,options authorization.ProofOptions)authorization.Clock{if skew!=5*time.Second{panic("proof CLI skew changed")};proofEventsFixture=append(proofEventsFixture,"clock:"+options.Path+":"+options.KeyPath);return func()(authorization.Sample,error){proofEventsFixture=append(proofEventsFixture,"sample");if proofModeFixture=="clock"{return authorization.Sample{},proofFailureFixture};return authorization.Sample{Wall:proofUntilFixture},nil}}
func proofStatusFixture()(authorization.SyncStatus,error){proofEventsFixture=append(proofEventsFixture,"status");if proofModeFixture=="status"||proofModeFixture=="fallback"{return authorization.SyncStatus{},proofFailureFixture};return authorization.SyncStatus{Source:"native-provider",Synchronized:true,ObservedAt:proofUntilFixture.Format(time.RFC3339Nano)},nil}
func proofRandomFixture(raw []byte)(int,error){proofEventsFixture=append(proofEventsFixture,"random");proofRandomCallsFixture++;if len(raw)!=32{panic("proof key length changed")};if proofModeFixture=="random"{return 0,proofFailureFixture};for i:=range raw{raw[i]=41};return len(raw),nil}
func proofAtomicFixture(path string,raw []byte)error{proofEventsFixture=append(proofEventsFixture,"atomic");if proofModeFixture=="atomic"{return proofFailureFixture};return os.WriteFile(path,raw,0600)}
func proofSignalFixture(parent context.Context,signals ...os.Signal)(context.Context,context.CancelFunc){proofEventsFixture=append(proofEventsFixture,"signals");if len(signals)!=2{panic("proof signal vocabulary changed")};ctx,cancel:=context.WithCancel(parent);proofCancelFixture=cancel;return ctx,func(){proofEventsFixture=append(proofEventsFixture,"cancel");cancel()}}
func proofWriteFixture(path string,key []byte,status authorization.SyncStatus)error{proofEventsFixture=append(proofEventsFixture,"write");if path==""||len(key)!=32{panic("proof path/key changed")};proofWritesFixture=append(proofWritesFixture,status);if proofModeFixture=="write"{return proofFailureFixture};return nil}
func proofAfterFixture(delay time.Duration)<-chan time.Time{proofEventsFixture=append(proofEventsFixture,"after");if delay!=5*time.Second{panic("proof watch period changed")};ch:=make(chan time.Time,1);if len(proofWritesFixture)==1{ch<-proofUntilFixture}else{proofCancelFixture()};return ch}
func proofRunFixture(t *testing.T,mode string,args ...string)(error,string){t.Helper();proofModeFixture=mode;proofEventsFixture=nil;proofWritesFixture=nil;proofRandomCallsFixture=0;oldArgs,oldFlags,oldOut:=os.Args,flag.CommandLine,os.Stdout;defer func(){os.Args=oldArgs;flag.CommandLine=oldFlags;os.Stdout=oldOut}();os.Args=append([]string{"time-proof"},args...);flag.CommandLine=flag.NewFlagSet("time-proof",flag.ContinueOnError);read,write,err:=os.Pipe();if err!=nil{t.Fatal(err)};os.Stdout=write;err=run();write.Close();raw,readErr:=io.ReadAll(read);read.Close();if readErr!=nil{t.Fatal(readErr)};return err,string(raw)}
func TestOriginalProofCLIReadAndCheckBranches(t *testing.T){
 err,out:=proofRunFixture(t,"read");if err!=nil||!strings.Contains(out,"native-provider")||!reflect.DeepEqual(proofEventsFixture,[]string{"status"}){t.Fatal("read-only native status mode",err,out,proofEventsFixture)}
 if err,_:=proofRunFixture(t,"status");err!=proofFailureFixture{t.Fatal("read-only provider error identity",err)}
 for _,mode:=range []string{"check","clock","boundary"}{err,out:=proofRunFixture(t,mode,"--check","--out=proof","--key=key");want:=[]string{"boundary:proof:key:","clock:proof:key","sample"};if mode=="boundary"{want=want[:1]};if !reflect.DeepEqual(proofEventsFixture,want){t.Fatal("check provider/argument order",proofEventsFixture,want)};if mode=="check"{if err!=nil||out!="{\"checkedAt\":\"2026-10-20T01:02:03.456Z\",\"maxSkewSeconds\":5,\"synchronized\":true}\n"{t.Fatal("check output projection",err,out)}}else if err!=proofFailureFixture||out!=""{t.Fatal("check first error identity",err)}}
 for _,args:=range [][]string{{"--out=proof"},{"--key=key"}}{err,_:=proofRunFixture(t,"paired",args...);if err==nil||err.Error()!="out and key must be provided together"||len(proofEventsFixture)!=0{t.Fatal("paired flag early refusal",err,proofEventsFixture)}}
}
func TestOriginalProofCLINativeFilesEntropyFallbackWatchAndCancel(t *testing.T){
 for _,mode:=range []string{"write","random","atomic","fallback","once","watch","short-key","existing","read-error","directory-error"}{t.Run(mode,func(t *testing.T){root:=t.TempDir();out:=filepath.Join(root,"status","proof");key:=filepath.Join(root,"secret","key");if mode=="short-key"||mode=="existing"{if err:=os.MkdirAll(filepath.Dir(key),0700);err!=nil{t.Fatal(err)};raw:=bytes.Repeat([]byte{9},32);if mode=="short-key"{raw=raw[:31]};if err:=os.WriteFile(key,raw,0600);err!=nil{t.Fatal(err)}};if mode=="read-error"{if err:=os.MkdirAll(key,0700);err!=nil{t.Fatal(err)}};if mode=="directory-error"{if err:=os.WriteFile(filepath.Dir(out),[]byte("not-directory"),0600);err!=nil{t.Fatal(err)}}
 args:=[]string{"--out="+out,"--key="+key};if mode=="watch"{args=append(args,"--watch")};before:=time.Now();err,text:=proofRunFixture(t,mode,args...);after:=time.Now();if text!=""{t.Fatal("write mode printed status")}
 switch mode{case "write","random","atomic":if err!=proofFailureFixture{t.Fatal("native write/entropy error identity",err)};case "short-key":if err==nil||err.Error()!="invalid existing proof key"||proofRandomCallsFixture!=0{t.Fatal("existing short key regenerated",err)};case "read-error","directory-error":if err==nil||proofRandomCallsFixture!=0{t.Fatal("native file error ignored",err)};default:if err!=nil{t.Fatal(err)}}
 if mode=="fallback"{if len(proofWritesFixture)!=1||proofWritesFixture[0].Source!="provider-unavailable"||proofWritesFixture[0].Synchronized{t.Fatal("provider error did not persist unavailable status")};observed,err:=time.Parse(time.RFC3339Nano,proofWritesFixture[0].ObservedAt);if err!=nil||observed.Before(before)||observed.After(after){t.Fatal("fallback lost native Now domain",err)}}
 if mode=="watch"{if len(proofWritesFixture)!=2||!reflect.DeepEqual(proofEventsFixture[len(proofEventsFixture)-2:],[]string{"after","cancel"}){t.Fatal("watch five-second/cancel sequence",proofEventsFixture)}}
 if mode=="once"||mode=="fallback"||mode=="watch"||mode=="write"||mode=="existing"{if proofEventsFixture[len(proofEventsFixture)-1]!="cancel"{t.Fatal("native signal cleanup not deferred")}}
 if mode=="existing"&&proofRandomCallsFixture!=0{t.Fatal("existing key regenerated")}
 })}
}
func TestOriginalProofCLIModePrecedenceAndSeparateDirectories(t *testing.T){
 for _,args:=range [][]string{{"--watch"},{"--watch","--check","--out=only-output"},{"--check","--key=only-key"}}{mode:="read";if len(args)>1{mode="check"};err,_:=proofRunFixture(t,mode,args...);if err!=nil{t.Fatal("original check/read mode added write-mode prerequisites",err)};if mode=="read"{if !reflect.DeepEqual(proofEventsFixture,[]string{"status"}){t.Fatal("watch-only mode started writer",proofEventsFixture)}}else if len(proofWritesFixture)!=0||proofRandomCallsFixture!=0{t.Fatal("check mode wrote/created proof key")}}
 root:=t.TempDir();err,_:=proofRunFixture(t,"same-directory","--out="+filepath.Join(root,"proof"),"--key="+filepath.Join(root,"key"));if err==nil||err.Error()!="proof key must be separate from writable status directory"||len(proofEventsFixture)!=1||!strings.HasPrefix(proofEventsFixture[0],"boundary:"){t.Fatal("native same-directory first refusal changed",err,proofEventsFixture)}
}
func TestOriginalProofCLIMainAndNativeFlagExitCodes(t *testing.T){
 for _,mode:=range []string{"help","unknown","missing-value","bad-bool","main-error"}{command:=exec.Command(os.Args[0],"-test.run=^TestOriginalProofCLIProcessHelper$");command.Env=append(os.Environ(),"TUNEX_PROOF_PROCESS_MODE="+mode);var out,diagnostic bytes.Buffer;command.Stdout=&out;command.Stderr=&diagnostic;err:=command.Run();code:=0;if err!=nil{exit,ok:=err.(*exec.ExitError);if !ok{t.Fatal(err)};code=exit.ExitCode()};want:=2;if mode=="help"{want=0};if mode=="main-error"{want=1};if code!=want||out.Len()!=0{t.Fatal("actual proof CLI flag/main exit changed",mode,code,out.String(),diagnostic.String())};if mode=="main-error"{if diagnostic.String()!=proofFailureFixture.Error()+"\n"{t.Fatal("original proof main stderr changed",diagnostic.String())}}else if diagnostic.Len()==0{t.Fatal("original global flag diagnostic missing")}}
}
func TestOriginalProofCLIProcessHelper(t *testing.T){mode:=os.Getenv("TUNEX_PROOF_PROCESS_MODE");if mode==""{return};args:=map[string][]string{"help":{"--help"},"unknown":{"--missing"},"missing-value":{"--key"},"bad-bool":{"--watch=maybe"},"main-error":{"--check","--out=proof","--key=key"}}[mode];proofModeFixture="boundary";os.Args=append([]string{"time-proof"},args...);flag.CommandLine=flag.NewFlagSet("time-proof",flag.ExitOnError);main();t.Fatal("proof main/flag error unexpectedly returned")}
`

func TestNativeCodecCompleteOriginalResponderCLIFlagsConfigSignalsAndExit(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "../../cmd/tunex-observation-responder/main.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	ast.Inspect(file, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		owner, ok := selector.X.(*ast.Ident)
		if !ok {
			return true
		}
		key := owner.Name + "." + selector.Sel.Name
		switch key {
		case "signal.NotifyContext":
			call.Fun = ast.NewIdent("responderSignalFixture")
			counts[key]++
		case "observationresponder.Run":
			call.Fun = ast.NewIdent("responderRunFixture")
			counts[key]++
		}
		return true
	})
	if !reflect.DeepEqual(counts, map[string]int{"signal.NotifyContext": 1, "observationresponder.Run": 1}) {
		t.Fatal("native responder CLI effects inventory changed", counts)
	}
	for _, declaration := range file.Decls {
		group, ok := declaration.(*ast.GenDecl)
		if !ok || group.Tok != token.IMPORT {
			continue
		}
		kept := group.Specs[:0]
		for _, entry := range group.Specs {
			if entry.(*ast.ImportSpec).Path.Value != `"os/signal"` {
				kept = append(kept, entry)
			}
		}
		group.Specs = kept
	}
	var original bytes.Buffer
	if err := format.Node(&original, set, file); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/responderclifixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": original.Bytes(), "effects_test.go": []byte(responderCLICompleteFixture)} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if out, err := command.CombinedOutput(); err != nil {
		t.Fatalf("actual native responder CLI: %v\n%s", err, out)
	}
}

const responderCLICompleteFixture = `package main
import("bytes";"context";"errors";"flag";"os";"os/exec";"reflect";"strings";"syscall";"testing";"github.com/tunex/vnext/agent/internal/observationresponder")
var responderEventsFixture []string
var responderConfigFixture observationresponder.Config
var responderContextFixture context.Context
var responderFailureFixture=errors.New("native responder Run sentinel")
var responderResultFixture error
func responderSignalFixture(parent context.Context,signals ...os.Signal)(context.Context,context.CancelFunc){if parent!=context.Background()||!reflect.DeepEqual(signals,[]os.Signal{os.Interrupt,syscall.SIGTERM}){panic("native responder signal vocabulary/order changed")};responderEventsFixture=append(responderEventsFixture,"signals");ctx,cancel:=context.WithCancel(parent);responderContextFixture=ctx;return ctx,func(){responderEventsFixture=append(responderEventsFixture,"cancel");cancel()}}
func responderRunFixture(ctx context.Context,value observationresponder.Config)error{if ctx!=responderContextFixture||ctx.Err()!=nil{panic("native responder got wrong/cancelled context")};responderEventsFixture=append(responderEventsFixture,"run");responderConfigFixture=value;return responderResultFixture}
func responderInvokeFixture(args ...string)error{responderEventsFixture=nil;responderConfigFixture=observationresponder.Config{};responderContextFixture=nil;os.Args=append([]string{"tunex-observation-responder"},args...);flag.CommandLine=flag.NewFlagSet("tunex-observation-responder",flag.ContinueOnError);return run()}
func TestOriginalResponderCLIExactFlagsDefaultsNativeConfigAndCleanup(t *testing.T){
 oldArgs,oldFlags:=os.Args,flag.CommandLine;defer func(){os.Args=oldArgs;flag.CommandLine=oldFlags}()
 args:=[]string{"--scope-id=scope:original","--service-id=independent","--server-name=RAW.example","--listen=raw-endpoint","--cert=raw-cert","--key=raw-key","--allow-cidrs=a,, b,","--valid-until=raw-expiry","--max-connections=64","--handshakes-per-second=1"};responderResultFixture=responderFailureFixture
 if err:=responderInvokeFixture(args...);err!=responderFailureFixture||!reflect.DeepEqual(responderEventsFixture,[]string{"signals","run","cancel"})||responderContextFixture.Err()!=context.Canceled{t.Fatal("native Run/error/cancel lifetime changed",err,responderEventsFixture)}
 want:=observationresponder.Config{ScopeID:"scope:original",ServiceID:"independent",ServerName:"RAW.example",Listen:"raw-endpoint",CertificatePath:"raw-cert",PrivateKeyPath:"raw-key",AllowCIDRs:[]string{"a",""," b",""},ValidUntil:"raw-expiry",MaxConnections:64,HandshakesPerSecond:1};if !reflect.DeepEqual(responderConfigFixture,want){t.Fatal("native raw flag projection normalized/reordered values",responderConfigFixture,want)}
 var names []string;flag.CommandLine.VisitAll(func(f *flag.Flag){names=append(names,f.Name)});if !reflect.DeepEqual(names,[]string{"allow-cidrs","cert","handshakes-per-second","key","listen","max-connections","scope-id","server-name","service-id","valid-until"}){t.Fatal("native global flag method set changed",names)};if flag.Lookup("max-connections").DefValue!="16"||flag.Lookup("handshakes-per-second").DefValue!="16"{t.Fatal("native numeric CLI defaults changed")}
 responderResultFixture=nil;if err:=responderInvokeFixture("--allow-cidrs=explicit");err!=nil||responderConfigFixture.MaxConnections!=16||responderConfigFixture.HandshakesPerSecond!=16||responderConfigFixture.ScopeID!=""||responderConfigFixture.Listen!=""{t.Fatal("CLI added native owner validation or changed defaults",err,responderConfigFixture)}
 if err:=responderInvokeFixture("--allow-cidrs="+strings.Repeat("a",2080),"--max-connections=1","--handshakes-per-second=64");err!=nil||len(responderConfigFixture.AllowCIDRs[0])!=2080{t.Fatal("inclusive native CLI flag bounds changed",err)}
}
func TestOriginalResponderCLIEarlyFlagRefusalBeforeSignalOrRun(t *testing.T){
 oldArgs,oldFlags:=os.Args,flag.CommandLine;defer func(){os.Args=oldArgs;flag.CommandLine=oldFlags}();responderResultFixture=nil
 cases:=[][]string{nil,{"--allow-cidrs="},{"--allow-cidrs=a","operand"},{"--allow-cidrs=a","--max-connections=0"},{"--allow-cidrs=a","--max-connections=65"},{"--allow-cidrs=a","--handshakes-per-second=0"},{"--allow-cidrs=a","--handshakes-per-second=65"},{"--allow-cidrs="+strings.Repeat("a",2081)}}
 for _,args:=range cases{err:=responderInvokeFixture(args...);if err==nil||err.Error()!="OBSERVATION_CONFIG_INVALID: explicit bounded flags and nonempty source CIDRs required"||len(responderEventsFixture)!=0{t.Fatal("native early CLI bounds/refusal order changed",args,err,responderEventsFixture)}}
}
func TestOriginalResponderCLINativeMainAndFlagExit(t *testing.T){for _,mode:=range []string{"help","unknown","missing-value","bad-int","main-error"}{command:=exec.Command(os.Args[0],"-test.run=^TestOriginalResponderCLIProcessHelper$");command.Env=append(os.Environ(),"TUNEX_RESPONDER_PROCESS_MODE="+mode);var out,diagnostic bytes.Buffer;command.Stdout=&out;command.Stderr=&diagnostic;err:=command.Run();code:=0;if err!=nil{exit,ok:=err.(*exec.ExitError);if !ok{t.Fatal(err)};code=exit.ExitCode()};want:=2;if mode=="help"{want=0};if mode=="main-error"{want=1};if code!=want||out.Len()!=0{t.Fatal("native responder main/flag exit",mode,code,out.String(),diagnostic.String())};if mode=="main-error"{if diagnostic.String()!=responderFailureFixture.Error()+"\n"{t.Fatal("native responder stderr error projection",diagnostic.String())}}else if diagnostic.Len()==0{t.Fatal("native global flag diagnostic disappeared")}}}
func TestOriginalResponderCLIProcessHelper(t *testing.T){mode:=os.Getenv("TUNEX_RESPONDER_PROCESS_MODE");if mode==""{return};args:=map[string][]string{"help":{"--help"},"unknown":{"--unknown"},"missing-value":{"--key"},"bad-int":{"--max-connections=maybe"},"main-error":{"--allow-cidrs=raw"}}[mode];responderResultFixture=responderFailureFixture;os.Args=append([]string{"tunex-observation-responder"},args...);flag.CommandLine=flag.NewFlagSet("tunex-observation-responder",flag.ExitOnError);main();t.Fatal("native responder main/flag error unexpectedly returned")}
`

package control

import (
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func TestProbeV4ProjectionKeepsAllNegotiatedMeasurementPoints(t *testing.T) {
	for _, measurement := range probeecho.PathMeasurements() {
		t.Run(measurement, func(t *testing.T) {
			f := newWireOwnerFixture(t, 4)
			now := f.schedule.now
			descriptor, err := probeecho.DescriptorFor(measurement)
			if err != nil {
				t.Fatal(err)
			}
			receipt := probeClaimReceipt{echo: true, measurement: measurement, binding: f.binding, session: f.session, permitID: "permit",
				timeout: time.Second, until: now.Add(500 * time.Millisecond), issuedAt: wireOwnerStamp(now.Add(-time.Second)),
				expiresAt: wireOwnerStamp(now.Add(time.Second)), consumedAt: wireOwnerStamp(now.Add(-50 * time.Millisecond)),
				serverAt: now.Add(-20 * time.Millisecond), requestedAt: now.Add(-12 * time.Millisecond), receivedAt: now.Add(-10 * time.Millisecond)}
			result := probe.Result{Binding: f.binding, Measurement: measurement, IndependentProbe: true, Point: descriptor.Point,
				ApplicationHealth: "unknown", Elapsed: time.Millisecond, MeasuredAt: now.Add(-2 * time.Millisecond), ValidUntil: receipt.until,
				Status: "connected", Code: "tcp-connected"}
			if probeecho.IsEcho(measurement) {
				result.Status, result.Code = "unverified", "nonce-echo-rejected"
			}
			if measurement == probe.MeasurementIngressTLS {
				result.Status, result.Code = "unverified", "tls-handshake-failed"
			}
			body, _, err := projectProbeResultWith(f.schedule, f.entropy, receipt, now.Add(-5*time.Millisecond), receipt.until, result)
			if err != nil || body.Point != descriptor.Point || body.Status != result.Status {
				t.Fatal("negotiated point lost before v4 encoding", body, err)
			}
		})
	}
}

func TestProbeV4OriginalConnectResultsRetainObservationAndRejectEchoEvidence(t *testing.T) {
	for _, measurement := range []string{probe.MeasurementEgress, probe.MeasurementIngress} {
		for _, mode := range []string{"connected", "unreachable", "missing-family", "wrong-point", "wrong-measurement", "unexpected-service", "unexpected-tls", "unexpected-proof", "unexpected-bytes"} {
			t.Run(measurement+"/"+mode, func(t *testing.T) {
				f := newWireOwnerFixture(t, 4)
				descriptor, err := probeecho.DescriptorFor(measurement)
				if err != nil {
					t.Fatal(err)
				}
				receipt := probeClaimReceipt{echo: true, measurement: measurement, binding: f.binding}
				fields := wireOwnerResultFields(f)
				fields.Point = descriptor.Point
				fields.Status = "connected"
				fields.Code = "tcp-connected"
				result := probe.Result{Measurement: measurement}
				valid := mode == "connected" || mode == "unreachable"
				switch mode {
				case "unreachable":
					fields.Status = "unreachable"
					fields.Code = "tcp-connect-failed"
				case "missing-family":
					receipt.echo = false
				case "wrong-point":
					fields.Point = "agent-local-forward-ingress"
				case "wrong-measurement":
					result.Measurement = "different"
				case "unexpected-service":
					result.Service = &observationtrust.Context{}
				case "unexpected-tls":
					result.TLS = &observationtrust.Verification{}
				case "unexpected-proof":
					result.Echo = &probeecho.Proof{}
				case "unexpected-bytes":
					result.RequestBytes = 256
				}
				before := f.schedule.nowCalls
				body, err := probeV4ResultWith(f.schedule, receipt, fields, result)
				if (err == nil) != valid || f.schedule.nowCalls != before {
					t.Fatal("v4 original connect projection", err)
				}
				if valid && (body.ProbeVersion != 4 || body.Point != descriptor.Point || body.Measurement != measurement || body.Service != nil || body.TLS != nil || body.Echo != nil || body.ApplicationPayloadBytes != 0) {
					t.Fatal("original connect evidence changed", body)
				}
				if !valid && err != probe.ErrDenied {
					t.Fatal("owner refusal changed", err)
				}
			})
		}
	}
}

func TestProbeV4OriginalTLSRetainsPinnedProofAndInjectedTrustClock(t *testing.T) {
	for _, mode := range []string{"verified", "unverified", "unreachable", "wrong-pin", "expired-context", "mismatched-context", "missing-service"} {
		t.Run(mode, func(t *testing.T) {
			f := newWireOwnerFixture(t, 4)
			service := wireOwnerServiceContext(t, f.schedule.now)
			trust, err := observationtrust.New(service, f.schedule.now)
			if err != nil {
				t.Fatal(err)
			}
			resultContext := service
			receipt := probeClaimReceipt{echo: true, measurement: probe.MeasurementIngressTLS, binding: f.binding, service: &service}
			fields := wireOwnerResultFields(f)
			result := probe.Result{Measurement: probe.MeasurementIngressTLS, Service: &resultContext,
				TLS: &observationtrust.Verification{Version: "TLSv1.3", ALPN: observationtrust.ALPN, LeafFingerprint: trust.Fingerprint(), Verified: true}}
			valid := mode == "verified" || mode == "unverified" || mode == "unreachable"
			switch mode {
			case "unverified":
				result.TLS = nil
				fields.Status = "unverified"
				fields.Code = "tls-handshake-failed"
			case "unreachable":
				result.TLS = nil
				fields.Status = "unreachable"
				fields.Code = "tcp-connect-failed"
			case "wrong-pin":
				result.TLS.LeafFingerprint = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
			case "expired-context":
				service.Config.ValidUntil = uint64(f.schedule.now.UnixMilli())
				resultContext = service
			case "mismatched-context":
				resultContext.Revision++
			case "missing-service":
				receipt.service = nil
			}
			body, err := probeV4ResultWith(f.schedule, receipt, fields, result)
			if (err == nil) != valid {
				t.Fatal("v4 pinned TLS projection", mode, err)
			}
			if valid {
				if body.ProbeVersion != 4 || body.Service == nil || body.Echo != nil || body.Challenge != nil || body.ApplicationPayloadBytes != 0 || (body.TLS != nil) != (result.TLS != nil) {
					t.Fatal("TLS evidence or family lost", body)
				}
				if body.TLS != nil && body.TLS.LeafFingerprint != trust.Fingerprint() {
					t.Fatal("pin changed")
				}
			} else if err != probe.ErrDenied {
				t.Fatal("TLS refusal changed", err)
			}
		})
	}
}

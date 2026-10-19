package control

import (
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

func (runner *Runner) probeServicesStatusExchange(watch *probeAuthorityWatch) error {
	if !watch.receipt.services || watch.receipt.typed {
		return probe.ErrDenied
	}
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	watch.mutex.Lock()
	freshUntil := watch.freshUntil
	watch.mutex.Unlock()
	work, cancel := runner.scheduler().WithDeadline(watch.ctx, freshUntil)
	defer cancel()
	session, receipt := watch.receipt.session, watch.receipt
	machine, err := runner.probeServicesMachine(session)
	if err != nil {
		return err
	}
	descriptor, err := probeServicesDescriptor(receipt.measurement)
	if err != nil {
		return err
	}
	request, raw, err := nativeexecution.EncodeProbeServicesStatus(machine, descriptor, receipt.permitID, probeServiceSelection(receipt.service))
	if err != nil {
		return err
	}
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/services/status", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeServicesStatus(request, raw)
	if err != nil {
		return err
	}
	if !sameProbeServiceSelection(request.Service, ack.Service) || probeTypesBinding(ack.Binding) != receipt.binding ||
		ack.IssuedAt != receipt.issuedAt || ack.ExpiresAt != receipt.expiresAt || ack.ConsumedAt != receipt.consumedAt ||
		time.Duration(ack.TimeoutMs)*time.Millisecond != receipt.timeout {
		return probe.ErrDenied
	}
	freshUntil, err = probeFreshUntilWith(runner.scheduler(), session, started, ack.CheckedAt, ack.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	checked, _ := nativeexecution.ParseProbeWireTime(ack.CheckedAt)
	server, _ := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if work.Err() != nil {
		return work.Err()
	}
	return watch.publish(freshUntil, checked, server)
}

// Build and validate the actual v3 body; its Service and TLS evidence are never dropped into a v2 digest.
func serviceProbeResult(receipt probeClaimReceipt, fields proberesult.Request, result probe.Result) (probeservices.ResultRequest, error) {
	return serviceProbeResultWith(platformruntime.Schedule{}, receipt, fields, result)
}

func serviceProbeResultWith(schedule runtimeplatform.Scheduler, receipt probeClaimReceipt, fields proberesult.Request, result probe.Result) (probeservices.ResultRequest, error) {
	if !receipt.services || receipt.typed {
		return probeservices.ResultRequest{}, probe.ErrDenied
	}
	descriptor, err := probeServicesDescriptor(receipt.measurement)
	if err != nil || fields.Point != descriptor.Point {
		return probeservices.ResultRequest{}, probe.ErrDenied
	}
	var evidence *probeservices.TLSResult
	if receipt.measurement == probe.MeasurementIngressTLS {
		if receipt.service == nil || result.Service == nil || *receipt.service != *result.Service {
			return probeservices.ResultRequest{}, probe.ErrDenied
		}
		trust, err := observationtrust.New(*receipt.service, schedule.Now())
		if err != nil {
			return probeservices.ResultRequest{}, probe.ErrDenied
		}
		if result.TLS != nil {
			if !result.TLS.Verified || result.TLS.Version != "TLSv1.3" || result.TLS.ALPN != observationtrust.ALPN ||
				result.TLS.LeafFingerprint != trust.Fingerprint() || fields.Status != "verified" || fields.Code != "tls-handshake-verified" {
				return probeservices.ResultRequest{}, probe.ErrDenied
			}
			evidence = &probeservices.TLSResult{Version: result.TLS.Version, ALPN: result.TLS.ALPN, LeafFingerprint: result.TLS.LeafFingerprint, Verified: true}
		} else if fields.Status != "unreachable" && fields.Status != "unverified" {
			return probeservices.ResultRequest{}, probe.ErrDenied
		}
	} else if receipt.service != nil || result.Service != nil || result.TLS != nil {
		return probeservices.ResultRequest{}, probe.ErrDenied
	}
	return nativeexecution.ProbeServicesResult(fields, descriptor, typedProbeBinding(receipt.binding), probeServiceSelection(receipt.service), evidence)
}

func (execution *probeExecution) servicesResultRequest() (probeservices.ResultRequest, error) {
	if !execution.watch.receipt.services || execution.watch.receipt.typed || execution.servicesBody == nil {
		return probeservices.ResultRequest{}, probe.ErrDenied
	}
	if err := execution.checkResultAuthority(); err != nil {
		return probeservices.ResultRequest{}, err
	}
	copy := *execution.servicesBody
	if copy.Service != nil {
		selection := *copy.Service
		copy.Service = &selection
	}
	if copy.TLS != nil {
		evidence := *copy.TLS
		copy.TLS = &evidence
	}
	return copy, nil
}

func (runner *Runner) reportProbeServices(execution *probeExecution) error {
	request, err := execution.servicesResultRequest()
	if err != nil {
		return err
	}
	work, cancel := runner.scheduler().WithDeadline(execution.watch.ctx, execution.reportUntil)
	defer cancel()
	raw, _, err := runner.probeDeliveryExchange(work, execution.watch.receipt.session, "/agent/v3/probe/services/result", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeServicesResultResponse(request, raw)
	if err != nil {
		return err
	}
	if !sameProbeServiceSelection(request.Service, ack.Service) {
		return probe.ErrDenied
	}
	server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if err != nil || execution.watch.receipt.session.guard.ValidateServerTime(server) != nil {
		return probe.ErrDenied
	}
	_, err = execution.servicesResultRequest()
	return err
}

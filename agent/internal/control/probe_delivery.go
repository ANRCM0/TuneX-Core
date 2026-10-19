package control

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

const (
	probeObservationAge = 250 * time.Millisecond
	probeExchangeLimit  = 200 * time.Millisecond
	probeStatusInterval = 50 * time.Millisecond
)

type probeDeliveryOffer struct {
	permitID            string
	measurement         string
	typed               bool
	services            bool
	echo                bool
	echoInput           *probeecho.Execution
	service             *observationtrust.Context
	instance            execution
	session             *registeredProbe
	issuedAt, expiresAt string
	binding             probe.Binding
	until               time.Time
	timeout             time.Duration
}

type probeDeliverySlot struct {
	active   bool
	nextPoll time.Time
}
type probeDeliveryBudget struct {
	mutex  sync.Mutex
	nodes  map[string]probeDeliverySlot
	active int
}

// Shared across Runner construction and instance rotation; unrelated to socket execution admission.
var probeDeliveries = probeDeliveryBudget{nodes: make(map[string]probeDeliverySlot)}

func (budget *probeDeliveryBudget) acquire(node string, poll bool, now time.Time) (func(), error) {
	budget.mutex.Lock()
	defer budget.mutex.Unlock()
	for key, slot := range budget.nodes {
		if !slot.active && !now.Before(slot.nextPoll) {
			delete(budget.nodes, key)
		}
	}
	slot, exists := budget.nodes[node]
	if slot.active || budget.active >= 4 || !exists && len(budget.nodes) >= 128 || poll && now.Before(slot.nextPoll) {
		return nil, probe.ErrBusy
	}
	slot.active = true
	if poll {
		slot.nextPoll = now.Add(time.Second)
	}
	budget.nodes[node] = slot
	budget.active++
	var once sync.Once
	return func() {
		once.Do(func() {
			budget.mutex.Lock()
			defer budget.mutex.Unlock()
			current := budget.nodes[node]
			current.active = false
			budget.nodes[node] = current
			budget.active--
		})
	}, nil
}

func probeRequestID() (string, error)                  { return probeRequestIDWith(platformruntime.Local{}) }
func (runner *Runner) probeRequestID() (string, error) { return probeRequestIDWith(runner.entropy()) }
func probeRequestIDWith(source runtimeplatform.Entropy) (string, error) {
	return nativeexecution.ProbeRequestID(source)
}
func deliveryBinding(b probedelivery.Binding) probe.Binding {
	return probe.Binding{NodeID: b.NodeId, BootID: b.BootId, SessionEpoch: b.SessionEpoch,
		SnapshotGeneration: b.SnapshotGeneration, AssignmentID: b.AssignmentId, ForwardID: b.ForwardId,
		ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
		BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision}
}

func (runner *Runner) probeDeliveryExchange(ctx context.Context, session *registeredProbe, path string, input any) ([]byte, time.Time, error) {
	return runner.probeDeliveryExchangeBounded(ctx, session, path, input, 4096)
}

func (runner *Runner) probeDeliveryExchangeBounded(ctx context.Context, session *registeredProbe, path string, input any, limit int) ([]byte, time.Time, error) {
	started := runner.scheduler().Now()
	if limit != 4096 && (limit != 32768 || path != "/agent/v3/probe/services/poll" && path != "/agent/v3/probe/echo/poll") {
		return nil, started, probe.ErrInvalid
	}
	work, cancel := runner.scheduler().WithDeadline(ctx, minProbeDeadline(session.until, started.Add(probeExchangeLimit)))
	defer cancel()
	stop := runner.scheduler().AfterFunc(session.ctx, cancel)
	defer stop()
	raw, err := nativeexecution.EncodeProbeRequest(input)
	if err != nil {
		return nil, started, err
	}
	if len(raw) > 4096 {
		return nil, started, probe.ErrInvalid
	}
	runner.mutex.Lock()
	baseURL, clientPointer := runner.options.URL, runner.client
	runner.mutex.Unlock()
	response, err := runner.auxiliary().ProbeDelivery(work, clientPointer, baseURL, path, raw, session.epoch)
	if err != nil {
		return nil, started, probeChannelError(err)
	}
	defer response.Body.Close()
	raw, oversized, err := nativeexecution.ReadProbeResponseBody(response.Body, limit)
	if err != nil {
		return nil, started, err
	}
	if oversized {
		return nil, started, probe.ErrInvalid
	}
	if work.Err() != nil {
		return nil, started, work.Err()
	}
	if response.StatusCode != http.StatusOK {
		return nil, started, httpError{response.StatusCode, nativeexecution.ProbeResponseErrorCode(raw)}
	}
	return raw, started, nil
}

func probeFreshUntil(session *registeredProbe, started time.Time, observedAt, serverTime string) (time.Time, error) {
	return probeFreshUntilWith(platformruntime.Schedule{}, session, started, observedAt, serverTime)
}
func probeFreshUntilWith(schedule runtimeplatform.Scheduler, session *registeredProbe, started time.Time, observedAt, serverTime string) (time.Time, error) {
	observed, e1 := nativeexecution.ParseProbeWireTime(observedAt)
	server, e2 := nativeexecution.ParseProbeWireTime(serverTime)
	if e1 != nil || e2 != nil || server.Before(observed) || server.Sub(observed) > probeObservationAge ||
		session.guard.ValidateServerTime(server) != nil {
		return time.Time{}, probe.ErrDenied
	}
	// Subtract remote observation age AND all local elapsed time; receipt time never starts a new window.
	until := started.Add(probeObservationAge - server.Sub(observed))
	if !schedule.Now().Before(until) {
		return time.Time{}, probe.ErrDenied
	}
	return until, nil
}

// Internal single exchange, not a background poll loop or executable grant.
func (runner *Runner) pollProbe(ctx context.Context) (*probeDeliveryOffer, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || !runner.probeCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()
	release, err := probeDeliveries.acquire(session.node, true, runner.scheduler().Now())
	if err != nil {
		return nil, err
	}
	defer release()
	id, err := runner.probeRequestID()
	if err != nil {
		return nil, err
	}
	request := probedelivery.PollRequest{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-poll", NodeId: session.node,
		BootId: session.boot, SessionEpoch: session.epoch, InstanceId: session.gate.InstanceID(), InstanceGeneration: session.generation, RequestId: id}
	raw, err := nativeexecution.EncodeProbePollRequest(request)
	if err != nil {
		return nil, err
	}
	raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/poll", request)
	if err != nil {
		return nil, err
	}
	ack, err := nativeexecution.DecodeProbePollResponse(request, raw)
	if err != nil {
		return nil, err
	}
	freshUntil, err := probeFreshUntilWith(runner.scheduler(), session, started, ack.ObservedAt, ack.ServerTime)
	if err != nil {
		return nil, err
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || runner.probeRegistration != session || !runner.probeCurrentLocked(session) || !runner.scheduler().Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	if ack.Offer == nil {
		return nil, nil
	}
	if _, used := session.claims[ack.Offer.PermitId]; used {
		return nil, probe.ErrReplay
	}
	binding := deliveryBinding(ack.Offer.Binding)
	target, err := runner.probeTargetLocked(binding)
	if err != nil {
		return nil, err
	}
	expires, _ := nativeexecution.ParseProbeWireTime(ack.Offer.ExpiresAt)
	server, _ := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		return nil, probe.ErrDenied
	}
	until := minProbeDeadline(started.Add(remaining), minProbeDeadline(session.until, target.ExecutionUntil))
	if !runner.scheduler().Now().Before(until) || !runner.scheduler().Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	return &probeDeliveryOffer{permitID: ack.Offer.PermitId, binding: binding, until: until,
		timeout: time.Duration(ack.Offer.TimeoutMs) * time.Millisecond}, nil
}

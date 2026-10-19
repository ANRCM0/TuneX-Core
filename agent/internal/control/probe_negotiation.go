package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probenegotiation"
)

// probeSession is used by opt-in registration, never by an execution receiver.
// A contract-only acknowledgement cannot be converted to an independent Permit.
type probeSession struct {
	gate *probe.Gate
}

func (runner *Runner) negotiateProbe(ctx context.Context) (*probeSession, error) {
	runner.mutex.Lock()
	node, boot, epoch, guard := runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch, runner.guard
	runner.mutex.Unlock()
	if guard == nil || guard.Check() != nil {
		return nil, probe.ErrDenied
	}
	executor, err := runner.newNativeProbeExecutor()
	if err != nil {
		return nil, err
	}
	gate, err := probe.NewGate(node, boot, epoch, executor)
	if err != nil {
		return nil, err
	}
	if runner.options.ProbeTelemetry {
		gate.EnableCounters()
	}
	accepted := false
	defer func() {
		if !accepted {
			gate.Close()
		}
	}()
	request, err := probenegotiation.NewRequest(node, boot, epoch, gate.InstanceID())
	if err != nil {
		return nil, err
	}
	raw, err := nativeexecution.EncodeProbeRequest(request)
	if err != nil {
		return nil, err
	}
	work, cancel := runner.scheduler().WithTimeout(ctx, 2*time.Second)
	defer cancel()
	raw, err = runner.request(work, "POST", "/agent/v3/probe/hello", raw, true)
	if err != nil {
		return nil, err
	}
	response, err := nativeexecution.DecodeProbeNegotiationResponse(*request, raw)
	if err != nil {
		return nil, err
	}
	serverTime, err := nativeexecution.ParseProbeWireTime(response.ServerTime)
	if err != nil || work.Err() != nil {
		return nil, probe.ErrDenied
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if runner.options.NodeID != node || runner.options.BootID != boot || runner.hello.SessionEpoch != epoch ||
		runner.guard != guard || guard.ValidateServerTime(serverTime) != nil || guard.Check() != nil {
		return nil, probe.ErrDenied
	}
	accepted = true
	return &probeSession{gate: gate}, nil
}

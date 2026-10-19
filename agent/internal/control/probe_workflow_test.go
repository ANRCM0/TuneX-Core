package control

import (
	"context"
	"errors"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probedelivery"
	"github.com/tunex/vnext/agent/internal/proberesult"
)

func TestProbeWorkflowRequiresSeparateExplicitOptIns(t *testing.T) {
	for _, options := range []Options{{}, {ProbeRegistration: true}, {ProbeExecution: true}} {
		runner := &Runner{options: options}
		if err := runner.runProbeTask(context.Background()); !errors.Is(err, probe.ErrDenied) {
			t.Fatalf("disabled workflow reached its uninitialized HTTP client: %v", err)
		}
	}
	if _, err := New(Options{ProbeExecution: true}); err == nil {
		t.Fatal("execution without registration was accepted")
	}
}

func TestProbeWorkflowPollClaimWatchConnectAndReportOnce(t *testing.T) {
	f := executionFixture(t, probeExecutionOptions{workflow: true})
	before := f.runner.journal
	if err := f.runner.runProbeTask(context.Background()); err != nil {
		t.Fatal(err)
	}
	select {
	case <-f.eof:
	case <-time.After(time.Second):
		t.Fatal("target did not observe zero-payload close")
	}
	if f.polls.Load() != 1 || f.claims.Load() != 1 || f.statuses.Load() < 1 || f.reports.Load() != 1 || f.connections.Load() != 1 {
		t.Fatal("workflow skipped or repeated a protected step")
	}
	report := f.reported.Load()
	if report == nil || report.Source != "agent-reported" || report.ApplicationHealth != "unknown" || report.Status != "connected" ||
		report.ApplicationPayloadBytes != 0 || report.Binding.ConfigDigest != f.binding.ConfigDigest {
		t.Fatalf("incorrect reported observation: %+v", report)
	}
	if err := f.runner.runProbeTask(context.Background()); !errors.Is(err, probe.ErrBusy) {
		t.Fatal("discovery cooldown lost", err)
	}
	if !reflect.DeepEqual(before, f.runner.journal) || f.connections.Load() != 1 || f.reports.Load() != 1 {
		t.Fatal("workflow repeated work or changed Journal")
	}
	probeDeliveries.mutex.Lock()
	active := probeDeliveries.nodes[f.binding.NodeID].active
	probeDeliveries.mutex.Unlock()
	if active {
		t.Fatal("task returned before its authority monitor drained")
	}
}

func TestProbeWorkflowUncertainClaimNeverExecutesOrReclaims(t *testing.T) {
	f := executionFixture(t, probeExecutionOptions{workflow: true, claim: func(w http.ResponseWriter, _ *http.Request) bool {
		w.WriteHeader(503)
		return true
	}})
	if err := f.runner.runProbeTask(context.Background()); err == nil {
		t.Fatal("uncertain claim accepted")
	}
	if _, err := f.runner.claimProbe(context.Background(), "permit-a", f.binding); !errors.Is(err, probe.ErrReplay) {
		t.Fatal("uncertain claim was retried", err)
	}
	assertProbeNoTarget(t, f)
	if f.claims.Load() != 1 || f.reports.Load() != 0 || f.statuses.Load() != 0 {
		t.Fatal("uncertain claim advanced or retried")
	}
}

func TestProbeWorkflowInitialWithdrawalPreventsAllSocketWork(t *testing.T) {
	f := executionFixture(t, probeExecutionOptions{workflow: true, status: func(_ int, _ *probedelivery.StatusResponse, w http.ResponseWriter, _ *http.Request) bool {
		w.WriteHeader(409)
		return true
	}})
	if err := f.runner.runProbeTask(context.Background()); err == nil {
		t.Fatal("withdrawn permit executed")
	}
	assertProbeNoTarget(t, f)
	if f.reports.Load() != 0 {
		t.Fatal("denied execution manufactured an observation")
	}
}

func TestProbeWorkflowReportAttemptBurnsBeforeLostOrInvalidAcknowledgement(t *testing.T) {
	for _, mode := range []string{"lost", "digest", "correlation", "future"} {
		t.Run(mode, func(t *testing.T) {
			f := executionFixture(t, probeExecutionOptions{result: func(ack *proberesult.Response, w http.ResponseWriter, _ *http.Request) bool {
				switch mode {
				case "lost":
					w.WriteHeader(503)
					return true
				case "digest":
					ack.ResultDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
				case "correlation":
					ack.RequestId = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
				case "future":
					ack.ServerTime = time.Now().Add(time.Minute).UTC().Format("2006-01-02T15:04:05.000Z")
				}
				return false
			}})
			execution, err := f.runner.executeConsumedProbe(context.Background(), f.receipt)
			if err != nil {
				t.Fatal(err)
			}
			defer execution.Close()
			if err := f.runner.reportProbe(execution); err == nil {
				t.Fatal("invalid result receipt accepted")
			}
			if err := f.runner.reportProbe(execution); !errors.Is(err, probe.ErrReplay) {
				t.Fatal("uncertain report was retried", err)
			}
			if f.reports.Load() != 1 || f.connections.Load() != 1 || f.claims.Load() != 1 {
				t.Fatal("report failure retried execution or HTTP")
			}
		})
	}
}

func TestProbeWorkflowCancellationDrainsReportAndWatchBeforeReturning(t *testing.T) {
	entered, exited := make(chan struct{}), make(chan struct{})
	f := executionFixture(t, probeExecutionOptions{workflow: true, result: func(_ *proberesult.Response, _ http.ResponseWriter, r *http.Request) bool {
		close(entered)
		<-r.Context().Done()
		close(exited)
		return true
	}})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- f.runner.runProbeTask(ctx) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("result upload did not start")
	}
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled upload succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("task did not drain")
	}
	select {
	case <-exited:
	case <-time.After(time.Second):
		t.Fatal("HTTP request did not terminate")
	}
	// Client completion does not synchronize the target's Accept goroutine.
	// Wait for its zero-payload close before inspecting the target-side count.
	select {
	case <-f.eof:
	case <-time.After(time.Second):
		t.Fatal("target did not observe zero-payload close")
	}
	probeDeliveries.mutex.Lock()
	active := probeDeliveries.nodes[f.binding.NodeID].active
	probeDeliveries.mutex.Unlock()
	if active || f.reports.Load() != 1 || f.connections.Load() != 1 {
		t.Fatalf("cancellation leaked slot or retried work: active=%v reports=%d connections=%d", active, f.reports.Load(), f.connections.Load())
	}
}

package tstruntime

import (
	"context"
	"github.com/tunex/agent/internal/diag"
	"time"
)

// ProbeRequest contains identities, never a caller-supplied network endpoint.
// The live authorized egress binding is the only diagnostic destination.
type ProbeRequest struct {
	ForwardID int64 `json:"forward_id"`
	Revision  int64 `json:"revision"`
	TimeoutMS int   `json:"timeout_ms,omitempty"`
}

func (m *Manager) Diagnose(ctx context.Context, placementID string, generation int64, request ProbeRequest) ([]diag.Result, error) {
	if request.ForwardID <= 0 || request.Revision <= 0 || generation <= 0 || request.TimeoutMS < 0 {
		return nil, ErrInvalidConfig
	}
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return nil, ErrClosed
	}
	p := m.running[placementID]
	if p == nil {
		m.mu.Unlock()
		return nil, ErrIdentityMismatch
	}
	p.mu.Lock()
	cfg := p.config
	r := p.rules[request.ForwardID]
	if cfg.Role != "egress" || r == nil {
		p.mu.Unlock()
		m.mu.Unlock()
		return nil, ErrIdentityMismatch
	}
	if cfg.Generation != generation || r.binding.Revision != request.Revision {
		p.mu.Unlock()
		m.mu.Unlock()
		return nil, ErrStaleGeneration
	}
	deadline, _ := time.Parse(time.RFC3339Nano, cfg.LeaseExpiresAt)
	if !time.Now().Before(deadline) || r.ctx.Err() != nil {
		p.mu.Unlock()
		m.mu.Unlock()
		return nil, ErrLeaseExpired
	}
	binding := r.binding
	p.mu.Unlock()
	m.mu.Unlock()
	if binding.Protocol == "udp" {
		return []diag.Result{{Host: binding.TargetHost, Port: binding.TargetPort, Status: diag.StatusUnsupported, Detail: "UDP reachability requires an application response; a TCP connect does not verify UDP"}}, nil
	}
	probeCtx, cancel := context.WithCancel(ctx)
	stop := context.AfterFunc(r.ctx, cancel)
	defer stop()
	defer cancel()
	return diag.Probe(probeCtx, diag.Request{TimeoutMS: request.TimeoutMS, Targets: []diag.Target{{Host: binding.TargetHost, Port: binding.TargetPort}}}, nil)
}

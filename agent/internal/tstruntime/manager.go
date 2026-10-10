package tstruntime

import (
	"errors"
	"github.com/tunex/agent/internal/portlease"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type PortGuard interface {
	ReserveExternal(string, []portlease.Binding) error
	ReleaseExternal(string)
}
type Manager struct {
	opMu           sync.Mutex
	mu             sync.Mutex
	cache          *privateCache
	state          diskState
	running        map[string]*placement
	guard          PortGuard
	closed         bool
	cacheErr       error
	trafficEnabled bool
	udpIdle        time.Duration
	done           chan struct{}
	unlock         func()
}

func New(stateDir, agentID string) (*Manager, error) {
	return newManager(stateDir, agentID, udpIdle)
}

func newManager(stateDir, agentID string, idle time.Duration) (*Manager, error) {
	if strings.TrimSpace(stateDir) == "" || strings.TrimSpace(agentID) == "" || len(agentID) > 256 || idle < time.Millisecond {
		return nil, ErrInvalidConfig
	}
	dir, e := filepath.Abs(stateDir)
	if e != nil {
		return nil, ErrCache
	}
	unlock, e := lockStateDirectory(dir)
	if e != nil {
		return nil, e
	}
	cache, state, e := openCache(dir, agentID)
	if e != nil {
		unlock()
		return nil, e
	}
	m := &Manager{cache: cache, state: state, running: map[string]*placement{}, done: make(chan struct{}), udpIdle: idle}
	m.unlock = unlock
	go m.sweep()
	return m, nil
}
func (m *Manager) SetPortGuard(g PortGuard) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return ErrClosed
	}
	if len(m.running) > 0 || g == nil {
		return ErrPortConflict
	}
	m.guard = g
	return nil
}
func portBindings(in []Port) []portlease.Binding {
	out := make([]portlease.Binding, 0, len(in))
	for _, p := range in {
		out = append(out, portlease.New(p.Protocol, p.Port, p.Host))
	}
	return out
}
func (m *Manager) reserveLocked(c Config) error {
	for id, p := range m.running {
		if id == c.ID {
			continue
		}
		for _, a := range p.config.Ports {
			for _, b := range c.Ports {
				if portsConflict(a, b) {
					return ErrPortConflict
				}
			}
		}
	}
	ports := append([]Port(nil), c.Ports...)
	if old := m.running[c.ID]; old != nil {
		seen := map[Port]bool{}
		for _, p := range ports {
			seen[p] = true
		}
		for _, p := range old.snapshot().Ports {
			if !seen[p] {
				ports = append(ports, p)
			}
		}
	}
	if m.guard != nil && m.guard.ReserveExternal("tst:"+c.ID, portBindings(ports)) != nil {
		return ErrPortConflict
	}
	return nil
}
func (m *Manager) persistLocked() error {
	if e := m.cache.save(m.state); e != nil {
		m.cacheErr = ErrCache
		for id, p := range m.running {
			p.close()
			delete(m.running, id)
			if m.guard != nil {
				m.guard.ReleaseExternal("tst:" + id)
			}
		}
		return ErrCache
	}
	return nil
}
func (m *Manager) Apply(c Config) (Observation, error) {
	m.opMu.Lock()
	defer m.opMu.Unlock()
	return m.apply(c)
}
func (m *Manager) apply(input Config) (Observation, error) {
	c := cloneConfig(input)
	transport, deadline, e := validateConfig(&c)
	if e != nil {
		return Observation{}, e
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return m.observeLocked(c.ID), ErrClosed
	}
	if m.cacheErr != nil {
		return m.observeLocked(c.ID), m.cacheErr
	}
	if m.state.NodeDBID != 0 && m.state.NodeDBID != c.NodeID {
		return m.observeLocked(c.ID), ErrIdentityMismatch
	}
	r, exists := m.state.Records[c.ID]
	if exists {
		if r.NodeID != 0 && (r.NodeID != c.NodeID || r.WorkspaceID != c.WorkspaceID || r.LinkID != c.LinkID || r.Role != c.Role) {
			return m.observeLocked(c.ID), ErrIdentityMismatch
		}
		if c.Generation < r.Highest || r.Removed && c.Generation <= r.Highest {
			return m.observeLocked(c.ID), ErrStaleGeneration
		}
		if c.Generation == r.Highest {
			if r.Fingerprint != fingerprint(c) {
				return m.observeLocked(c.ID), ErrGenerationConflict
			}
			old, _ := time.Parse(time.RFC3339Nano, r.DesiredLease)
			if deadline.Before(old) {
				// Snapshot refresh and queued commands can deliver lease renewals
				// out of order. A still-valid duplicate cannot shorten or replace
				// the already applied longer lease, nor acknowledge a failed or
				// older runtime as though this generation had been applied.
				if !time.Now().Before(deadline) {
					return m.observeLocked(c.ID), ErrLeaseExpired
				}
				if p := m.running[c.ID]; p != nil && p.ctx.Err() == nil {
					applied := p.snapshot()
					appliedLease, _ := time.Parse(time.RFC3339Nano, applied.LeaseExpiresAt)
					if applied.Generation == c.Generation && applied.ConfigDigest == c.ConfigDigest && !appliedLease.Before(old) {
						return m.observeLocked(c.ID), nil
					}
				}
				return m.observeLocked(c.ID), ErrLeaseRegression
			}
		}
	} else if len(m.state.Records) >= maxRecords {
		return Observation{}, ErrCache
	}
	previous := r.Config
	r.ID = c.ID
	r.LinkID = c.LinkID
	r.WorkspaceID = c.WorkspaceID
	r.NodeID = c.NodeID
	r.Role = c.Role
	r.Highest = c.Generation
	r.Fingerprint = fingerprint(c)
	r.DesiredDigest = c.ConfigDigest
	r.DesiredLease = c.LeaseExpiresAt
	r.Removed = false
	r.Config = nil
	r.State = "applying"
	r.LastError = ""
	m.state.Records[c.ID] = r
	// Persist the highest generation before opening or replacing any socket.
	// A failed candidate cannot resurrect an older config after a restart.
	if e = m.persistLocked(); e != nil {
		return m.observeLocked(c.ID), e
	}
	if !time.Now().Before(deadline) {
		m.stopLocked(c.ID)
		r.State = "expired"
		r.LastError = ErrLeaseExpired.Error()
		m.state.Records[c.ID] = r
		_ = m.persistLocked()
		return m.observeLocked(c.ID), ErrLeaseExpired
	}
	if e = m.reserveLocked(c); e != nil {
		r.State = "failed"
		r.LastError = e.Error()
		m.state.Records[c.ID] = r
		_ = m.persistLocked()
		return m.observeLocked(c.ID), e
	}
	old := m.running[c.ID]
	mode := "restart"
	var candidate *placement
	if old != nil && old.compatible(transport) {
		mode = "rules"
		e = old.update(c, transport)
		candidate = old
	} else {
		if old != nil {
			old.close()
			delete(m.running, c.ID)
		}
		candidate, e = newPlacement(m, c, transport)
	}
	if e != nil {
		r.State = "failed"
		r.LastError = ErrStartFailed.Error()
		r.UpdateMode = mode
		m.state.Records[c.ID] = r
		// Restore a still-leased runtime only in this process. Its old generation
		// is never restored from disk behind the new durable fence.
		if candidate == old && old != nil {
			m.running[c.ID] = old
		} else if previous != nil {
			d, _ := time.Parse(time.RFC3339Nano, previous.LeaseExpiresAt)
			if time.Now().Before(d) {
				pt, _, ve := validateConfig(previous)
				if ve == nil && m.reserveLocked(*previous) == nil {
					if p, se := newPlacement(m, *previous, pt); se == nil {
						m.running[c.ID] = p
					}
				}
			}
		}
		if m.running[c.ID] == nil && m.guard != nil {
			m.guard.ReleaseExternal("tst:" + c.ID)
		} else if m.guard != nil {
			restored := m.running[c.ID].snapshot()
			if m.guard.ReserveExternal("tst:"+c.ID, portBindings(restored.Ports)) != nil {
				m.stopLocked(c.ID)
			}
		}
		_ = m.persistLocked()
		return m.observeLocked(c.ID), ErrStartFailed
	}
	m.running[c.ID] = candidate
	if m.guard != nil && m.guard.ReserveExternal("tst:"+c.ID, portBindings(c.Ports)) != nil {
		m.stopLocked(c.ID)
		r.State = "failed"
		r.LastError = ErrPortConflict.Error()
		m.state.Records[c.ID] = r
		_ = m.persistLocked()
		return m.observeLocked(c.ID), ErrPortConflict
	}
	r.Config = &c
	r.UpdateMode = mode
	r.State = "running"
	if c.Role == "ingress" && len(transport.Bindings) == 0 {
		r.State = "passive"
	}
	m.state.Records[c.ID] = r
	if e = m.persistLocked(); e != nil {
		return m.observeLocked(c.ID), e
	}
	return m.observeLocked(c.ID), nil
}
func (m *Manager) Remove(id string, generation int64) (Observation, error) {
	m.opMu.Lock()
	defer m.opMu.Unlock()
	return m.remove(id, generation)
}
func (m *Manager) remove(id string, generation int64) (Observation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return Observation{}, ErrClosed
	}
	if id == "" || len(id) > 256 || generation <= 0 {
		return Observation{}, ErrInvalidConfig
	}
	if m.cacheErr != nil {
		return m.observeLocked(id), m.cacheErr
	}
	r, exists := m.state.Records[id]
	if generation < r.Highest {
		return m.observeLocked(id), ErrStaleGeneration
	}
	if !exists && len(m.state.Records) >= maxRecords {
		return Observation{}, ErrCache
	}
	r.ID = id
	r.Highest = generation
	r.Removed = true
	r.Config = nil
	r.State = "removed"
	r.LastError = ""
	r.Fingerprint = ""
	m.state.Records[id] = r
	if e := m.persistLocked(); e != nil {
		return m.observeLocked(id), e
	}
	m.stopLocked(id)
	return m.observeLocked(id), nil
}
func (m *Manager) stopLocked(id string) {
	if p := m.running[id]; p != nil {
		p.close()
		delete(m.running, id)
	}
	if m.guard != nil {
		m.guard.ReleaseExternal("tst:" + id)
	}
}
func (m *Manager) Restore() ([]Observation, error) {
	m.opMu.Lock()
	defer m.opMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return nil, ErrClosed
	}
	if m.cacheErr != nil {
		return nil, m.cacheErr
	}
	var errs []error
	for id, r := range m.state.Records {
		if r.Config == nil || r.Removed {
			continue
		}
		c := cloneConfig(*r.Config)
		t, d, e := validateConfig(&c)
		if e != nil || c.Generation != r.Highest {
			errs = append(errs, ErrCache)
			continue
		}
		if !time.Now().Before(d) {
			r.Config = nil
			r.State = "expired"
			r.LastError = ErrLeaseExpired.Error()
			m.state.Records[id] = r
			continue
		}
		if m.running[id] != nil {
			continue
		}
		if e = m.reserveLocked(c); e != nil {
			errs = append(errs, e)
			continue
		}
		p, e := newPlacement(m, c, t)
		if e != nil {
			if m.guard != nil {
				m.guard.ReleaseExternal("tst:" + id)
			}
			errs = append(errs, ErrStartFailed)
			continue
		}
		m.running[id] = p
		r.State = "running"
		if c.Role == "ingress" && len(t.Bindings) == 0 {
			r.State = "passive"
		}
		m.state.Records[id] = r
	}
	if e := m.persistLocked(); e != nil {
		errs = append(errs, e)
	}
	return m.statusLocked(), errors.Join(errs...)
}
func (m *Manager) NodeDBID() int64       { m.mu.Lock(); defer m.mu.Unlock(); return m.state.NodeDBID }
func (m *Manager) Status() []Observation { m.mu.Lock(); defer m.mu.Unlock(); return m.statusLocked() }
func (m *Manager) statusLocked() []Observation {
	ids := make([]string, 0, len(m.state.Records))
	for id := range m.state.Records {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := make([]Observation, 0, len(ids))
	for _, id := range ids {
		out = append(out, m.observeLocked(id))
	}
	return out
}
func (m *Manager) observeLocked(id string) Observation {
	r := m.state.Records[id]
	o := Observation{ID: r.ID, LinkID: r.LinkID, WorkspaceID: r.WorkspaceID, NodeID: r.NodeID, Role: r.Role, Generation: r.Highest, DesiredConfigDigest: r.DesiredDigest, LeaseExpiresAt: r.DesiredLease, State: r.State, LastError: r.LastError, UpdateMode: r.UpdateMode, RuntimeIDs: []string{}, Ports: []Port{}}
	if p := m.running[id]; p != nil {
		c := p.snapshot()
		o.ObservedGeneration = c.Generation
		o.ConfigDigest = c.ConfigDigest
		o.Ports = append([]Port(nil), c.Ports...)
		o.RuntimeIDs = append([]string(nil), c.RuntimeIDs...)
		o.LeaseExpiresAt = c.LeaseExpiresAt
		o.Ready = p.ready()
		o.TargetStatus = p.targets()
		if c.Generation < r.Highest {
			o.State = "rolled_back"
		} else if r.State == "running" {
			if o.Ready {
				o.State = "ready"
			} else {
				o.State = "updating"
			}
		}
	}
	if o.State == "applying" {
		o.State = "updating"
	}
	if m.closed && o.State != "removed" {
		o.State = "closed"
	} else if m.running[id] == nil && (o.State == "running" || o.State == "passive") {
		o.State = "cached"
	}
	o.TrafficStatus = m.trafficStatusLocked(id)
	return o
}
func (m *Manager) sweep() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-m.done:
			return
		case now := <-ticker.C:
			m.mu.Lock()
			changed := false
			for id, p := range m.running {
				c := p.snapshot()
				d, _ := time.Parse(time.RFC3339Nano, c.LeaseExpiresAt)
				if !now.Before(d) || !now.Before(p.identityExpires) {
					m.stopLocked(id)
					r := m.state.Records[id]
					r.Config = nil
					r.State = "expired"
					r.LastError = ErrLeaseExpired.Error()
					if !now.Before(p.identityExpires) {
						r.LastError = ErrIdentityExpired.Error()
					}
					m.state.Records[id] = r
					changed = true
				}
			}
			if changed {
				_ = m.persistLocked()
			}
			m.mu.Unlock()
		}
	}
}
func (m *Manager) Close() error {
	m.opMu.Lock()
	defer m.opMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return nil
	}
	m.closed = true
	defer m.unlock()
	close(m.done)
	for id := range m.running {
		m.stopLocked(id)
	}
	return m.persistLocked()
}

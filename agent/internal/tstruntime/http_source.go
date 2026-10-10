package tstruntime

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrPanelUnavailable  = errors.New("tst: panel unavailable")
	ErrPanelUnauthorized = errors.New("tst: panel authorization refused")
	ErrSnapshot          = errors.New("tst: invalid link snapshot")
)

type Snapshot struct {
	NodeDBID int64    `json:"node_db_id"`
	AgentID  string   `json:"agent_id,omitempty"`
	Links    []Config `json:"links"`
}
type HTTPSource struct {
	PanelURL, Credential, AgentID string
	Client                        *http.Client
	MaxBytes                      int64
}

func (s HTTPSource) FetchSnapshot(ctx context.Context) (*Snapshot, error) {
	base := strings.TrimRight(strings.TrimSpace(s.PanelURL), "/")
	u, e := url.Parse(base)
	if e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" || strings.TrimSpace(s.Credential) == "" {
		return nil, ErrSnapshot
	}
	c := http.Client{Timeout: 12 * time.Second}
	if s.Client != nil {
		c = *s.Client
	}
	if c.Timeout == 0 {
		c.Timeout = 12 * time.Second
	}
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	req, e := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/internal/node/desired", nil)
	if e != nil {
		return nil, ErrSnapshot
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(s.Credential))
	resp, e := c.Do(req)
	if e != nil {
		return nil, ErrPanelUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		return nil, ErrPanelUnavailable
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 404 {
		return nil, ErrPanelUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, ErrSnapshot
	}
	limit := s.MaxBytes
	if limit <= 0 || limit > maxCacheBytes {
		limit = maxCacheBytes
	}
	b, e := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if e != nil {
		return nil, ErrPanelUnavailable
	}
	if int64(len(b)) > limit {
		return nil, ErrSnapshot
	}
	var env struct {
		Data *struct {
			Snapshot *struct {
				NodeDBID int64     `json:"node_db_id"`
				AgentID  string    `json:"agent_id"`
				Links    *[]Config `json:"links"`
			} `json:"snapshot"`
		} `json:"data"`
	}
	if json.Unmarshal(b, &env) != nil || env.Data == nil || env.Data.Snapshot == nil || env.Data.Snapshot.Links == nil {
		return nil, ErrSnapshot
	}
	w := env.Data.Snapshot
	if w.AgentID != "" && w.AgentID != s.AgentID {
		return nil, ErrAgentMismatch
	}
	snapshot := &Snapshot{w.NodeDBID, w.AgentID, *w.Links}
	if e := snapshot.validate(); e != nil {
		return nil, e
	}
	return snapshot, nil
}
func (s *Snapshot) validate() error {
	if s == nil || s.NodeDBID <= 0 || len(s.Links) > maxRecords {
		return ErrSnapshot
	}
	seen := map[string]bool{}
	for i := range s.Links {
		c := &s.Links[i]
		if seen[c.ID] || c.NodeID != s.NodeDBID {
			return ErrIdentityMismatch
		}
		if _, _, e := validateConfig(c); e != nil {
			return e
		}
		seen[c.ID] = true
	}
	return nil
}
func (m *Manager) Reconcile(s *Snapshot) ([]Observation, error) {
	m.opMu.Lock()
	defer m.opMu.Unlock()
	if e := s.validate(); e != nil {
		return m.Status(), e
	}
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return nil, ErrClosed
	}
	if s.AgentID != "" && s.AgentID != m.cache.agentID || m.state.NodeDBID != 0 && s.NodeDBID != m.state.NodeDBID {
		m.mu.Unlock()
		return nil, ErrIdentityMismatch
	}
	for _, r := range m.state.Records {
		if r.NodeID != 0 && r.NodeID != s.NodeDBID {
			m.mu.Unlock()
			return nil, ErrIdentityMismatch
		}
	}
	m.state.NodeDBID = s.NodeDBID
	e := m.persistLocked()
	m.mu.Unlock()
	if e != nil {
		return m.Status(), e
	}
	seen := map[string]bool{}
	var errs []error
	for _, c := range s.Links {
		seen[c.ID] = true
		if _, e = m.apply(c); e != nil {
			errs = append(errs, e)
		}
	}
	for _, o := range m.Status() {
		if !seen[o.ID] && o.State != "removed" {
			if _, e = m.remove(o.ID, o.Generation); e != nil {
				errs = append(errs, e)
			}
		}
	}
	return m.Status(), errors.Join(errs...)
}

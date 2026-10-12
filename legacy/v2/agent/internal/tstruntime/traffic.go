package tstruntime

import (
	"crypto/rand"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

type TrafficSample struct {
	ProducerID   string `json:"producer_id"`
	LinkID       int64  `json:"link_id"`
	WorkspaceID  int64  `json:"workspace_id"`
	NodeID       int64  `json:"node_id"`
	ForwardID    int64  `json:"forward_id"`
	Generation   int64  `json:"generation"`
	ConfigDigest string `json:"config_digest"`
	Date         string `json:"date"`
	BytesIn      string `json:"bytes_in"`
	BytesOut     string `json:"bytes_out"`
	Connections  string `json:"connections"`
}

func producerID() string {
	b := make([]byte, 16)
	if _, e := rand.Read(b); e != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
func sampleKey(s TrafficSample) string {
	return s.ProducerID + ":" + strconv.FormatInt(s.ForwardID, 10) + ":" + s.Date
}
func sameSampleIdentity(a, b TrafficSample) bool {
	return a.ProducerID == b.ProducerID && a.LinkID == b.LinkID && a.WorkspaceID == b.WorkspaceID && a.NodeID == b.NodeID && a.ForwardID == b.ForwardID && a.Generation == b.Generation && a.ConfigDigest == b.ConfigDigest && a.Date == b.Date
}
func trafficNumber(s string) (int64, bool) {
	n, e := strconv.ParseInt(s, 10, 64)
	return n, e == nil && n >= 0 && strconv.FormatInt(n, 10) == s
}
func validSample(s TrafficSample) bool {
	_, e := time.Parse("2006-01-02", s.Date)
	b, he := hex.DecodeString(s.ProducerID)
	d, de := hex.DecodeString(s.ConfigDigest)
	_, i := trafficNumber(s.BytesIn)
	_, o := trafficNumber(s.BytesOut)
	_, c := trafficNumber(s.Connections)
	return e == nil && he == nil && len(b) == 16 && de == nil && len(d) == 32 && s.LinkID > 0 && s.WorkspaceID > 0 && s.NodeID > 0 && s.ForwardID > 0 && s.Generation > 0 && i && o && c
}
func countersLE(a, b TrafficSample) bool {
	for _, p := range [][2]string{{a.BytesIn, b.BytesIn}, {a.BytesOut, b.BytesOut}, {a.Connections, b.Connections}} {
		x, ok := trafficNumber(p[0])
		y, ok2 := trafficNumber(p[1])
		if !ok || !ok2 || x > y {
			return false
		}
	}
	return true
}
func (m *Manager) EnableTraffic() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return ErrClosed
	}
	m.trafficEnabled = true
	return nil
}
func (m *Manager) TrafficRotationSupported() bool { return false }
func (m *Manager) TrafficSamples() ([]TrafficSample, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return nil, ErrClosed
	}
	if m.cacheErr != nil {
		return nil, m.cacheErr
	}
	result := []TrafficSample{}
	for k, s := range m.state.Samples {
		if s != m.state.Acks[k] {
			result = append(result, s)
		}
	}
	return result, nil
}
func (m *Manager) AckTraffic(in []TrafficSample) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return ErrClosed
	}
	if m.cacheErr != nil {
		return m.cacheErr
	}
	for _, s := range in {
		current, ok := m.state.Samples[sampleKey(s)]
		if !ok || !validSample(s) || !sameSampleIdentity(s, current) || !countersLE(s, current) {
			return ErrTrafficAck
		}
	}
	for _, s := range in {
		key := sampleKey(s)
		previous, ok := m.state.Acks[key]
		if !ok || countersLE(previous, s) {
			m.state.Acks[key] = s
		}
	}
	active := map[string]bool{}
	for _, p := range m.running {
		for _, id := range p.producers() {
			active[id] = true
		}
	}
	for k, s := range m.state.Samples {
		if !active[s.ProducerID] && s == m.state.Acks[k] {
			delete(m.state.Samples, k)
			delete(m.state.Acks, k)
		}
	}
	if len(in) > 0 {
		m.state.LastAck = time.Now().UTC().Format(time.RFC3339Nano)
	}
	return m.persistLocked()
}
func (m *Manager) account(template TrafficSample, in, out, connections int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return ErrClosed
	}
	if !m.trafficEnabled {
		return nil
	}
	if m.cacheErr != nil {
		return m.cacheErr
	}
	template.Date = time.Now().UTC().Format("2006-01-02")
	k := sampleKey(template)
	s, exists := m.state.Samples[k]
	if !exists {
		if len(m.state.Samples) >= 32768 {
			return ErrTraffic
		}
		s = template
		s.BytesIn = "0"
		s.BytesOut = "0"
		s.Connections = "0"
	}
	values := []*string{&s.BytesIn, &s.BytesOut, &s.Connections}
	for i, delta := range []int64{in, out, connections} {
		n, _ := trafficNumber(*values[i])
		if delta < 0 || n > int64(^uint64(0)>>1)-delta {
			return ErrTraffic
		}
		*values[i] = strconv.FormatInt(n+delta, 10)
	}
	m.state.Samples[k] = s
	return m.persistLocked()
}
func (m *Manager) trafficStatusLocked(id string) *TrafficStatus {
	if !m.trafficEnabled {
		return nil
	}
	t := &TrafficStatus{State: "idle"}
	producers, rules := map[string]bool{}, map[int64]bool{}
	r := m.state.Records[id]
	for k, s := range m.state.Samples {
		if s.LinkID == r.LinkID && s.WorkspaceID == r.WorkspaceID {
			producers[s.ProducerID] = true
			rules[s.ForwardID] = true
			t.SampleCount++
			t.SpoolBytes += int64(len(k) + len(strings.Join([]string{s.BytesIn, s.BytesOut, s.Connections}, "")) + 200)
			if s != m.state.Acks[k] {
				t.State = "backlogged"
			}
		}
	}
	t.ProducerCount = len(producers)
	t.RuleCount = len(rules)
	if p := m.running[id]; p != nil && len(p.producers()) > 0 && t.State == "idle" {
		t.State = "collecting"
	}
	if m.cacheErr != nil {
		t.State = "blocked"
	}
	if m.state.LastAck != "" {
		stamp := m.state.LastAck
		t.LastAckAt = &stamp
	}
	return t
}

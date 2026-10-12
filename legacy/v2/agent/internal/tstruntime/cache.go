package tstruntime

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

type record struct {
	ID            string  `json:"id"`
	LinkID        int64   `json:"link_id"`
	WorkspaceID   int64   `json:"workspace_id"`
	NodeID        int64   `json:"node_id"`
	Role          string  `json:"role"`
	Highest       int64   `json:"highest"`
	Removed       bool    `json:"removed"`
	Fingerprint   string  `json:"fingerprint"`
	DesiredDigest string  `json:"desired_digest"`
	DesiredLease  string  `json:"desired_lease"`
	Config        *Config `json:"config,omitempty"`
	State         string  `json:"state"`
	LastError     string  `json:"last_error,omitempty"`
	UpdateMode    string  `json:"update_mode,omitempty"`
}
type diskState struct {
	NodeDBID int64                    `json:"node_db_id"`
	Records  map[string]record        `json:"records"`
	Samples  map[string]TrafficSample `json:"samples"`
	Acks     map[string]TrafficSample `json:"acks"`
	LastAck  string                   `json:"last_ack"`
}
type privateCache struct {
	dir, agentID string
	aead         cipher.AEAD
}
type envelope struct {
	Version int    `json:"version"`
	AgentID string `json:"agent_id"`
	Nonce   []byte `json:"nonce"`
	Sealed  []byte `json:"sealed"`
}

func privateDirectory(dir string) error {
	for p := dir; ; p = filepath.Dir(p) {
		info, e := os.Lstat(p)
		if e == nil && (!info.IsDir() || info.Mode()&os.ModeSymlink != 0) {
			return ErrCache
		}
		if e != nil && !errors.Is(e, os.ErrNotExist) {
			return ErrCache
		}
		if filepath.Dir(p) == p {
			break
		}
	}
	if os.MkdirAll(dir, 0700) != nil || os.Chmod(dir, 0700) != nil {
		return ErrCache
	}
	return tightenDirectory(dir)
}
func readPrivate(path string, limit int64) ([]byte, error) {
	i, e := os.Lstat(path)
	if e != nil {
		return nil, e
	}
	if !i.Mode().IsRegular() || i.Size() <= 0 || i.Size() > limit || runtime.GOOS != "windows" && i.Mode().Perm()&0077 != 0 {
		return nil, ErrCache
	}
	if protectPrivateFile(path) != nil {
		return nil, ErrCache
	}
	f, e := os.Open(path)
	if e != nil {
		return nil, ErrCache
	}
	defer f.Close()
	b, e := io.ReadAll(io.LimitReader(f, limit+1))
	if e != nil || int64(len(b)) > limit {
		return nil, ErrCache
	}
	return b, nil
}
func openCache(dir, id string) (*privateCache, diskState, error) {
	state := diskState{Records: map[string]record{}, Samples: map[string]TrafficSample{}, Acks: map[string]TrafficSample{}}
	if privateDirectory(dir) != nil {
		return nil, state, ErrCache
	}
	kp := filepath.Join(dir, "machine.key")
	key, e := readPrivate(kp, 32)
	if errors.Is(e, os.ErrNotExist) {
		if _, se := os.Lstat(filepath.Join(dir, "state.enc.json")); !errors.Is(se, os.ErrNotExist) {
			return nil, state, ErrCache
		}
		key = make([]byte, 32)
		if _, e = rand.Read(key); e != nil {
			return nil, state, ErrCache
		}
		f, fe := os.OpenFile(kp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if fe != nil {
			return nil, state, ErrCache
		}
		_, we := f.Write(key)
		se := f.Sync()
		ce := f.Close()
		if we != nil || se != nil || ce != nil {
			return nil, state, ErrCache
		}
	} else if e != nil {
		return nil, state, ErrCache
	}
	if len(key) != 32 {
		return nil, state, ErrCache
	}
	block, e := aes.NewCipher(key)
	if e != nil {
		return nil, state, ErrCache
	}
	a, e := cipher.NewGCM(block)
	if e != nil {
		return nil, state, ErrCache
	}
	c := &privateCache{dir: dir, agentID: id, aead: a}
	b, e := readPrivate(filepath.Join(dir, "state.enc.json"), maxCacheBytes)
	if errors.Is(e, os.ErrNotExist) {
		return c, state, nil
	}
	if e != nil {
		return nil, state, ErrCache
	}
	var env envelope
	if json.Unmarshal(b, &env) != nil || env.Version != 1 {
		return nil, state, ErrCache
	}
	if env.AgentID != id {
		return nil, state, ErrAgentMismatch
	}
	if len(env.Nonce) != a.NonceSize() {
		return nil, state, ErrCache
	}
	plain, e := a.Open(nil, env.Nonce, env.Sealed, c.aad())
	if e != nil || json.Unmarshal(plain, &state) != nil || state.Records == nil || state.Samples == nil || state.Acks == nil || len(state.Records) > maxRecords || len(state.Samples) > 32768 || state.NodeDBID < 0 {
		return nil, state, ErrCache
	}
	for id, r := range state.Records {
		if id != r.ID || r.Highest <= 0 || r.Removed && r.Config != nil {
			return nil, state, ErrCache
		}
		if r.Config != nil {
			c := cloneConfig(*r.Config)
			if _, _, e := validateConfig(&c); e != nil || c.ID != id || c.Generation != r.Highest || c.NodeID != r.NodeID || c.WorkspaceID != r.WorkspaceID || c.LinkID != r.LinkID || c.Role != r.Role || state.NodeDBID != 0 && c.NodeID != state.NodeDBID {
				return nil, state, ErrCache
			}
		}
	}
	for k, s := range state.Samples {
		if k != sampleKey(s) || !validSample(s) {
			return nil, state, ErrCache
		}
	}
	for k, s := range state.Acks {
		current, ok := state.Samples[k]
		if !ok || !sameSampleIdentity(s, current) || !countersLE(s, current) {
			return nil, state, ErrCache
		}
	}
	return c, state, nil
}
func (c *privateCache) aad() []byte { return []byte("tunex-tst-state-v1\x00" + c.agentID) }
func (c *privateCache) save(state diskState) error {
	plain, e := json.Marshal(state)
	if e != nil || len(plain) > maxCacheBytes*3/4 {
		return ErrCache
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, e = rand.Read(nonce); e != nil {
		return ErrCache
	}
	b, e := json.Marshal(envelope{1, c.agentID, nonce, c.aead.Seal(nil, nonce, plain, c.aad())})
	if e != nil || len(b) > maxCacheBytes {
		return ErrCache
	}
	target := filepath.Join(c.dir, "state.enc.json")
	if i, e := os.Lstat(target); e == nil && !i.Mode().IsRegular() {
		return ErrCache
	} else if e != nil && !errors.Is(e, os.ErrNotExist) {
		return ErrCache
	}
	f, e := os.CreateTemp(c.dir, "state-*.tmp")
	if e != nil {
		return ErrCache
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if f.Chmod(0600) != nil {
		f.Close()
		return ErrCache
	}
	_, we := f.Write(b)
	se := f.Sync()
	ce := f.Close()
	if we != nil || se != nil || ce != nil || os.Rename(tmp, target) != nil {
		return ErrCache
	}
	// Windows has no portable directory fsync. Each replacement file is synced;
	// POSIX additionally commits the rename to survive a power loss.
	if runtime.GOOS != "windows" {
		d, e := os.Open(c.dir)
		if e != nil {
			return ErrCache
		}
		e = d.Sync()
		d.Close()
		if e != nil {
			return ErrCache
		}
	}
	return nil
}

package authorization

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/state"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type proofEnvelope struct {
	Payload json.RawMessage `json:"payload"`
	MAC     string          `json:"mac"`
}

func ValidateProofBoundary(proofPath, keyPath, stateDirectory string) error {
	if (proofPath == "") != (keyPath == "") {
		return fmt.Errorf("proof and protected key required together")
	}
	if proofPath == "" {
		return nil
	}
	key, err := filepath.Abs(keyPath)
	if err != nil {
		return err
	}
	for _, directory := range []string{filepath.Dir(proofPath), stateDirectory} {
		if directory == "" {
			continue
		}
		root, err := filepath.Abs(directory)
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(root, key)
		if err == nil && (relative == "." || relative != ".." && !strings.HasPrefix(relative, ".."+string(os.PathSeparator))) {
			return fmt.Errorf("proof key must stay outside status and Agent state directories")
		}
	}
	return nil
}

func WriteProof(path string, key []byte, status SyncStatus) error {
	if len(key) != 32 {
		return fmt.Errorf("invalid time-proof key")
	}
	payload, err := json.Marshal(status)
	if err != nil {
		return err
	}
	mac := hmac.New(sha256.New, key)
	mac.Write(payload)
	raw, err := json.Marshal(proofEnvelope{Payload: payload, MAC: hex.EncodeToString(mac.Sum(nil))})
	if err != nil {
		return err
	}
	return state.AtomicWrite(path, raw)
}
func ReadProof(path, keyPath string) (SyncStatus, error) {
	key, err := os.ReadFile(keyPath)
	if err != nil || len(key) != 32 {
		return SyncStatus{}, fmt.Errorf("invalid time-proof key")
	}
	file, err := os.Open(path)
	if err != nil {
		return SyncStatus{}, err
	}
	defer file.Close()
	raw, err := io.ReadAll(io.LimitReader(file, 8193))
	if err != nil {
		return SyncStatus{}, err
	}
	if len(raw) > 8192 {
		return SyncStatus{}, fmt.Errorf("invalid time-proof size")
	}
	parsed, err := contracts.ParseJSON(raw, 8192)
	if err != nil {
		return SyncStatus{}, err
	}
	object, ok := parsed.(map[string]any)
	if !ok || len(object) != 2 || object["payload"] == nil || object["mac"] == nil {
		return SyncStatus{}, fmt.Errorf("invalid time-proof envelope")
	}
	var envelope proofEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return SyncStatus{}, err
	}
	expected, err := hex.DecodeString(envelope.MAC)
	if err != nil {
		return SyncStatus{}, err
	}
	mac := hmac.New(sha256.New, key)
	mac.Write(envelope.Payload)
	if !hmac.Equal(expected, mac.Sum(nil)) {
		return SyncStatus{}, fmt.Errorf("invalid time-proof MAC")
	}
	var status SyncStatus
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(envelope.Payload, &fields); err != nil || len(fields) != 5 {
		return SyncStatus{}, fmt.Errorf("invalid time-proof payload")
	}
	for _, name := range []string{"host", "source", "synchronized", "maxErrorNanos", "observedAt"} {
		value, ok := fields[name]
		if !ok || string(value) == "null" {
			return SyncStatus{}, fmt.Errorf("invalid time-proof field")
		}
	}
	if err := json.Unmarshal(envelope.Payload, &status); err != nil {
		return SyncStatus{}, err
	}
	return status, nil
}

package state

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
)

type envelope struct {
	Payload json.RawMessage `json:"payload"`
	MAC     string          `json:"mac"`
}

func Save(path string, key []byte, value Journal) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	hash := hmac.New(sha256.New, key)
	hash.Write(payload)
	raw, err := json.Marshal(envelope{payload, hex.EncodeToString(hash.Sum(nil))})
	if err != nil {
		return err
	}
	return AtomicWrite(path, raw)
}
func Load(path string, key []byte) (Journal, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Journal{}, fmt.Errorf("INTEGRITY_FAILURE: journal unavailable: %w", err)
	}
	var record envelope
	if err := json.Unmarshal(raw, &record); err != nil {
		return Journal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid journal")
	}
	actual, err := hex.DecodeString(record.MAC)
	if err != nil {
		return Journal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid MAC")
	}
	hash := hmac.New(sha256.New, key)
	hash.Write(record.Payload)
	if !hmac.Equal(actual, hash.Sum(nil)) {
		return Journal{}, fmt.Errorf("INTEGRITY_FAILURE: journal MAC mismatch")
	}
	var value Journal
	if err := json.Unmarshal(record.Payload, &value); err != nil || value.Fences == nil || value.Retired == nil {
		return Journal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid journal body")
	}
	return value, nil
}

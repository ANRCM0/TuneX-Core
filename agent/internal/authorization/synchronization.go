package authorization

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"time"
)

type SyncStatus struct {
	Host          string `json:"host"`
	Source        string `json:"source"`
	Synchronized  bool   `json:"synchronized"`
	MaxErrorNanos int64  `json:"maxErrorNanos"`
	ObservedAt    string `json:"observedAt"`
}
type ProofOptions struct {
	Path    string
	KeyPath string
}

func ValidateSynchronization(status SyncStatus, now time.Time, skew time.Duration) error {
	observed, err := time.Parse(time.RFC3339Nano, status.ObservedAt)
	if err != nil || !status.Synchronized || (status.Source != "linux-adjtimex" && status.Source != "windows-w32time") || status.MaxErrorNanos < 0 || status.MaxErrorNanos > int64(skew) || observed.After(now.Add(skew)) || now.Sub(observed) > 30*time.Second {
		return fmt.Errorf("CLOCK_UNCERTAIN: fresh bounded OS synchronization evidence required")
	}
	// Charge a conservative 500-ppm holdover uncertainty after the OS sample.
	age := max(now.Sub(observed), 0)
	uncertainty := time.Duration(status.MaxErrorNanos) + age/2000
	if uncertainty > skew {
		return fmt.Errorf("CLOCK_UNCERTAIN: OS error bound exceeds policy")
	}
	return nil
}

// SynchronizedClock caches only short-lived OS evidence. It resamples uptime/wall
// after a potentially blocking provider query so no stale pre-query time can grant IO.
func SynchronizedClock(skew time.Duration, proof ProofOptions) Clock {
	var mutex sync.Mutex
	var cached SyncStatus
	var checked time.Duration
	var initialized bool
	return func() (Sample, error) {
		mutex.Lock()
		defer mutex.Unlock()
		before, err := SystemClock()
		if err != nil {
			return Sample{}, err
		}
		if !initialized || before.Uptime < checked || before.Uptime-checked >= 2*time.Second {
			if proof.Path != "" {
				cached, err = ReadProof(proof.Path, proof.KeyPath)
			} else {
				cached, err = ReadSystemSynchronization()
			}
			if err != nil {
				return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization provider unavailable: %w", err)
			}
			initialized = true
			checked = before.Uptime
		}
		sample, err := SystemClock()
		if err != nil {
			return Sample{}, err
		}
		host, err := os.Hostname()
		if err != nil || cached.Host != host {
			return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization evidence belongs to another host")
		}
		expected := ""
		if runtime.GOOS == "linux" {
			expected = "linux-adjtimex"
		} else if runtime.GOOS == "windows" {
			expected = "windows-w32time"
		}
		if cached.Source != expected {
			return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization evidence belongs to another platform")
		}
		if err := ValidateSynchronization(cached, sample.Wall, skew); err != nil {
			return Sample{}, err
		}
		return sample, nil
	}
}

package executiontime

import (
	"fmt"
	"sync"
	"time"
)

func ValidateSynchronization(status SyncStatus, now time.Time, skew time.Duration) error {
	observed := status.ObservedAt
	if !status.ObservationValid || !status.Synchronized || !status.SourceAccepted || status.MaxErrorNanos < 0 || status.MaxErrorNanos > int64(skew) || observed.After(now.Add(skew)) || now.Sub(observed) > 30*time.Second {
		return fmt.Errorf("CLOCK_UNCERTAIN: fresh bounded OS synchronization evidence required")
	}
	// Charge the original conservative 500-ppm holdover uncertainty.
	age := max(now.Sub(observed), 0)
	uncertainty := time.Duration(status.MaxErrorNanos) + age/2000
	if uncertainty > skew {
		return fmt.Errorf("CLOCK_UNCERTAIN: OS error bound exceeds policy")
	}
	return nil
}

func SynchronizedClock(skew time.Duration, sources SynchronizationSources) Clock {
	var mutex sync.Mutex
	var cached SyncStatus
	var checked time.Duration
	var initialized bool
	return func() (Sample, error) {
		mutex.Lock()
		defer mutex.Unlock()
		if sources.Sample == nil || sources.Evidence == nil || sources.Host == nil || sources.Source == nil {
			return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization providers required")
		}
		before, err := sources.Sample()
		if err != nil {
			return Sample{}, err
		}
		if !initialized || before.Uptime < checked || before.Uptime-checked >= 2*time.Second {
			cached, err = sources.Evidence()
			if err != nil {
				return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization provider unavailable: %w", err)
			}
			initialized = true
			checked = before.Uptime
		}
		sample, err := sources.Sample()
		if err != nil {
			return Sample{}, err
		}
		host, err := sources.Host()
		if err != nil || cached.Host != host {
			return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization evidence belongs to another host")
		}
		if cached.Source != sources.Source() {
			return Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: synchronization evidence belongs to another platform")
		}
		if err := ValidateSynchronization(cached, sample.Wall, skew); err != nil {
			return Sample{}, err
		}
		return sample, nil
	}
}

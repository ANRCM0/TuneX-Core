package authorization

import (
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
	"github.com/tunex/vnext/agent/internal/platformclock"
)

type SyncStatus = platformclock.SyncStatus
type ProofOptions = executiontime.ProofOptions

func ValidateSynchronization(status SyncStatus, now time.Time, skew time.Duration) error {
	return executiontime.ValidateSynchronization(platformclock.SynchronizationFacts(status), now, skew)
}

// Bind the old proof-or-OS provider choice without changing the lower guard rules.
func SynchronizedClock(skew time.Duration, proof ProofOptions) Clock {
	evidence := func() (executiontime.SyncStatus, error) {
		var status SyncStatus
		var err error
		if proof.Path != "" {
			status, err = ReadProof(proof.Path, proof.KeyPath)
		} else {
			status, err = ReadSystemSynchronization()
		}
		return platformclock.SynchronizationFacts(status), err
	}
	return executiontime.SynchronizedClock(skew, executiontime.SynchronizationSources{
		Sample: SystemClock, Evidence: evidence, Host: platformclock.Hostname, Source: platformclock.Source,
	})
}

func ReadSystemSynchronization() (SyncStatus, error) {
	return platformclock.ReadSystemSynchronization()
}
func ParseWindowsTimeStatus(output string, observed time.Time) (SyncStatus, error) {
	return platformclock.ParseWindowsTimeStatus(output, observed)
}

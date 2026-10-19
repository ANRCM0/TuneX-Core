// Package executiontime owns authorization timing decisions, not platform clocks.
package executiontime

import "time"

const InterfaceVersion uint64 = 2

type Sample struct {
	Wall   time.Time
	Uptime time.Duration
}

type Clock func() (Sample, error)

// Trusted adapters supply representation validity; these facts grant no execution.
type SyncStatus struct {
	Host             string
	Source           string
	Synchronized     bool
	MaxErrorNanos    int64
	ObservedAt       time.Time
	ObservationValid bool
	SourceAccepted   bool
}

type ProofOptions struct {
	Path    string
	KeyPath string
}

// Sample is called before and after Evidence, including when a provider blocks.
type SynchronizationSources struct {
	Sample   Clock
	Evidence func() (SyncStatus, error)
	Host     func() (string, error)
	Source   func() string
}

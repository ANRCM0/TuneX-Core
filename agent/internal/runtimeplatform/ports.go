// Package runtimeplatform defines native effects consumed by Agent coordination.
package runtimeplatform

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/executionstate"
)

const InterfaceVersion uint64 = 2

type Bootstrap[Roots any] interface {
	ValidateProofBoundary(proof, key, journal string) error
	LoadRoots(path string) (Roots, error)
	LoadProtectionKey(path string) ([]byte, error)
	// Outputs are lower history facts; native records must be explicitly projected.
	LoadRuntime(path string, key []byte, node string) (executionstate.RuntimeJournal, error)
	EnableRuntime(path string, key []byte, node, transit string) (executionstate.RuntimeJournal, error)
}

type Timer interface {
	C() <-chan time.Time
	Stop() bool
}
type Ticker interface {
	C() <-chan time.Time
	Stop()
}

// Scheduling is not authorization time: Guard still requires its own bounded evidence.
type Scheduler interface {
	Now() time.Time
	Since(start time.Time) time.Duration
	Until(deadline time.Time) time.Duration
	After(delay time.Duration) <-chan time.Time
	NewTimer(delay time.Duration) Timer
	NewTicker(interval time.Duration) Ticker
	WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc)
	WithDeadline(ctx context.Context, deadline time.Time) (context.Context, context.CancelFunc)
	AfterFunc(ctx context.Context, work func()) func() bool
}

// ReadRandom has the full-buffer/error contract of the original secure source.
// A caller must reject an error rather than reuse an ID or substitute weak entropy.
type Entropy interface{ ReadRandom([]byte) (int, error) }

// These files contain local measurements only, never Journal or credentials.
type MeasurementFiles interface {
	WriteDiagnostics(path string, encoded []byte) error
	WriteForwardCounters(diagnosticsPath string, encoded []byte) error
}

type LocalLog interface{ Warn(values ...any) }

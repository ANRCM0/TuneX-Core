package platformruntime

import (
	"context"
	"crypto/x509"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

const InterfaceVersion uint64 = 2

type Bootstrap struct{}

func (Bootstrap) ValidateProofBoundary(proof, key, journal string) error {
	return authorization.ValidateProofBoundary(proof, key, filepath.Dir(journal))
}
func (Bootstrap) LoadRoots(path string) (*x509.CertPool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(raw) {
		return nil, fmt.Errorf("Invalid Control CA")
	}
	return roots, nil
}
func (Bootstrap) LoadProtectionKey(path string) ([]byte, error) {
	key, err := os.ReadFile(path)
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("INTEGRITY_FAILURE: journal protection key unavailable")
	}
	return key, nil
}
func (Bootstrap) LoadRuntime(path string, key []byte, node string) (executionstate.RuntimeJournal, error) {
	value, err := state.LoadRuntimeJournal(path, key, node)
	return state.RuntimeJournalFacts(value), err
}
func (Bootstrap) EnableRuntime(path string, key []byte, node, transit string) (executionstate.RuntimeJournal, error) {
	value, err := state.EnableRuntimeExecution(path, key, node, transit)
	return state.RuntimeJournalFacts(value), err
}

type Schedule struct{}
type timer struct{ value *time.Timer }
type ticker struct{ value *time.Ticker }

func (value timer) C() <-chan time.Time                     { return value.value.C }
func (value timer) Stop() bool                              { return value.value.Stop() }
func (value ticker) C() <-chan time.Time                    { return value.value.C }
func (value ticker) Stop()                                  { value.value.Stop() }
func (Schedule) Now() time.Time                             { return time.Now() }
func (Schedule) Since(start time.Time) time.Duration        { return time.Since(start) }
func (Schedule) Until(deadline time.Time) time.Duration     { return time.Until(deadline) }
func (Schedule) After(delay time.Duration) <-chan time.Time { return time.After(delay) }
func (Schedule) NewTimer(delay time.Duration) runtimeplatform.Timer {
	return timer{value: time.NewTimer(delay)}
}
func (Schedule) NewTicker(interval time.Duration) runtimeplatform.Ticker {
	return ticker{value: time.NewTicker(interval)}
}
func (Schedule) WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, timeout)
}
func (Schedule) WithDeadline(ctx context.Context, deadline time.Time) (context.Context, context.CancelFunc) {
	return context.WithDeadline(ctx, deadline)
}
func (Schedule) AfterFunc(ctx context.Context, work func()) func() bool {
	return context.AfterFunc(ctx, work)
}

package state

import "github.com/tunex/vnext/agent/internal/platformstate"

// Keep existing callers on the same platform primitives and persistence ordering.
func AtomicWrite(path string, raw []byte) error { return platformstate.AtomicWrite(path, raw) }
func AcquireLock(path string) (func(), error)   { return platformstate.AcquireLock(path) }

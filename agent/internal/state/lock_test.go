//go:build linux || windows

package state

import (
	"path/filepath"
	"testing"
)

func TestExclusiveInstance(t *testing.T) {
	path := filepath.Join(t.TempDir(), "instance.lock")
	release, err := AcquireLock(path)
	if err != nil {
		t.Fatal(err)
	}
	if duplicate, err := AcquireLock(path); err == nil {
		duplicate()
		release()
		t.Fatal("second instance acquired lock")
	}
	release()
	next, err := AcquireLock(path)
	if err != nil {
		t.Fatal("released lock cannot be acquired", err)
	}
	next()
}

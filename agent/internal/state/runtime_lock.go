package state

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var runtimeFileLocks sync.Map

// The existing OS lock refuses competing owners. Serialize this process's
// Snapshot and payload writes first, so ordinary concurrent traffic is not
// mistaken for a second process holding the protected journal.
func acquireRuntimeFileLock(path string) (func(), error) {
	name, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if os.PathSeparator == '\\' {
		name = strings.ToLower(name)
	}
	value, _ := runtimeFileLocks.LoadOrStore(name, new(sync.Mutex))
	mutex := value.(*sync.Mutex)
	mutex.Lock()
	release, err := AcquireLock(path + ".lock")
	if err != nil {
		mutex.Unlock()
		return nil, err
	}
	return func() { defer mutex.Unlock(); release() }, nil
}

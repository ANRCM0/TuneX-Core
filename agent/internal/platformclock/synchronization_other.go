//go:build !linux && !windows

package platformclock

import "fmt"

func ReadSystemSynchronization() (SyncStatus, error) {
	return SyncStatus{}, fmt.Errorf("OS synchronization provider unsupported")
}

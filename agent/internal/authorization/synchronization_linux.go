//go:build linux

package authorization

import (
	"fmt"
	"os"
	"syscall"
	"time"
)

func ReadSystemSynchronization() (SyncStatus, error) {
	var status syscall.Timex
	state, err := syscall.Adjtimex(&status)
	if err != nil {
		return SyncStatus{}, err
	}
	maximum := max(int64(status.Maxerror), int64(status.Esterror))
	if maximum < 0 || maximum > 9007199254740991/1000 {
		return SyncStatus{}, fmt.Errorf("invalid kernel synchronization error")
	}
	host, err := os.Hostname()
	if err != nil {
		return SyncStatus{}, err
	}
	return SyncStatus{Host: host, Source: "linux-adjtimex", Synchronized: state >= 0 && state <= 4 && status.Status&(0x0040|0x1000) == 0, MaxErrorNanos: maximum * 1000, ObservedAt: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}

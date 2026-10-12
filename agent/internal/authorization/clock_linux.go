//go:build linux

package authorization

import (
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

func uptime() (time.Duration, error) {
	var value syscall.Timespec
	_, _, code := syscall.Syscall(syscall.SYS_CLOCK_GETTIME, 7, uintptr(unsafe.Pointer(&value)), 0)
	if code != 0 {
		return 0, code
	}
	if value.Sec < 0 || value.Nsec < 0 || value.Nsec >= 1e9 || int64(value.Sec) > int64((1<<63-1)/int64(time.Second)) {
		return 0, fmt.Errorf("invalid CLOCK_BOOTTIME")
	}
	return time.Duration(value.Sec)*time.Second + time.Duration(value.Nsec), nil
}

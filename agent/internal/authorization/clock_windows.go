//go:build windows

package authorization

import (
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

var interruptTime = syscall.NewLazyDLL("kernelbase.dll").NewProc("QueryInterruptTimePrecise")

func uptime() (time.Duration, error) {
	if err := interruptTime.Find(); err != nil {
		return 0, err
	}
	var value uint64
	interruptTime.Call(uintptr(unsafe.Pointer(&value)))
	if value > uint64((1<<63-1)/100) {
		return 0, fmt.Errorf("invalid interrupt time")
	}
	return time.Duration(value * 100), nil
}

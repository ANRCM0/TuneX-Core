package platformclock

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

const InterfaceVersion uint64 = 2

// Read wall time immediately after suspend-aware uptime, never before it.
func SystemClock() (executiontime.Sample, error) {
	elapsed, err := uptime()
	if err != nil {
		return executiontime.Sample{}, fmt.Errorf("CLOCK_UNCERTAIN: %w", err)
	}
	return executiontime.Sample{Wall: time.Now().UTC(), Uptime: elapsed}, nil
}

func Hostname() (string, error) { return os.Hostname() }

func Source() string {
	if runtime.GOOS == "linux" {
		return "linux-adjtimex"
	}
	if runtime.GOOS == "windows" {
		return "windows-w32time"
	}
	return ""
}

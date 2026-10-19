// Package platformobservation isolates OS-specific, non-authoritative measurements.
package platformobservation

import "github.com/tunex/vnext/agent/internal/runtimeobservation"

const InterfaceVersion uint64 = 2

type ProcessSample = runtimeobservation.ProcessSample

// Missing/unsupported observations remain absent, never zero or execution authority.
func CaptureProcess() ProcessSample {
	cpu, rss := processUsage()
	return ProcessSample{CPUTimeNanos: cpu, MaxRSSBytes: rss, OpenFileDescriptors: openFileDescriptors()}
}

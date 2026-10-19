package platformobservation

import (
	"os"
	"runtime"

	"github.com/tunex/vnext/agent/internal/runtimeobservation"
)

type Native struct{}
type Provider = runtimeobservation.Provider[HostResources]

func (Native) Memory() runtimeobservation.MemorySample {
	var sample runtime.MemStats
	runtime.ReadMemStats(&sample)
	return runtimeobservation.MemorySample{HeapAllocBytes: sample.HeapAlloc, RuntimeBytes: sample.Sys}
}
func (Native) Process() runtimeobservation.ProcessSample { return CaptureProcess() }
func (Native) Goroutines() int                           { return runtime.NumGoroutine() }
func (Native) ProcessID() int                            { return os.Getpid() }
func (Native) Platform() string                          { return runtime.GOOS }
func (Native) Host() HostResources                       { return CaptureHost() }

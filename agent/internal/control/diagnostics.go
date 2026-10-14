package control

import (
	"encoding/json"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/state"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// Diagnostics is a protected local measurement file, not execution authority or ADP telemetry.
func (runner *Runner) writeDiagnostics(final bool) error {
	if runner.options.Diagnostics == "" {
		return nil
	}
	runtimeStats := runtime.MemStats{}
	runtime.ReadMemStats(&runtimeStats)
	runner.mutex.Lock()
	tcp, udp := uint64(0), uint64(0)
	udpCapacityDropped, udpTargetRejected, udpDatagramDropped, udpQueueDropped, udpAmplificationDropped := uint64(0), uint64(0), uint64(0), uint64(0), uint64(0)
	for _, instance := range runner.instances {
		if instance.assignment.Protocol == "tcp" {
			tcp += instance.stream.Remaining()
		} else {
			udp += instance.stream.Remaining()
			if engine, ok := instance.stream.(*forward.UDP); ok {
				stats := engine.Stats()
				udpCapacityDropped += stats.CapacityDropped
				udpTargetRejected += stats.TargetRejected
				udpDatagramDropped += stats.DatagramDropped
				udpQueueDropped += stats.QueueDropped
				udpAmplificationDropped += stats.AmplificationDropped
			}
		}
	}
	drains := len(runner.drains)
	generation := runner.journal.Generation
	active := !final && runner.ticket != nil && runner.ticket.Allow() == nil
	runner.mutex.Unlock()
	var descriptors *int
	cpu, maxRSS := processUsage()
	if runtime.GOOS == "linux" {
		entries, err := os.ReadDir("/proc/self/fd")
		if err == nil {
			count := len(entries)
			descriptors = &count
		}
	}
	bytes, err := json.Marshal(map[string]any{"version": 1, "capturedAt": time.Now().UTC().Format(time.RFC3339Nano), "pid": os.Getpid(), "platform": runtime.GOOS, "snapshotGeneration": generation, "authorizationActive": active, "tcpStreams": tcp, "udpAssociations": udp, "udpCapacityDropped": udpCapacityDropped, "udpTargetRejected": udpTargetRejected, "udpDatagramDropped": udpDatagramDropped, "udpQueueDropped": udpQueueDropped, "udpAmplificationDropped": udpAmplificationDropped, "drainingInstances": drains, "goroutines": runtime.NumGoroutine(), "heapAllocBytes": runtimeStats.HeapAlloc, "runtimeBytes": runtimeStats.Sys, "openFileDescriptors": descriptors, "cpuTimeNanos": cpu, "maxRSSBytes": maxRSS})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(runner.options.Diagnostics), 0700); err != nil {
		return err
	}
	return state.AtomicWrite(runner.options.Diagnostics, bytes)
}

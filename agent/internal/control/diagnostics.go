package control

import (
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationwire"
)

// Diagnostics is a protected local measurement file, not execution authority or ADP telemetry.
func (runner *Runner) writeDiagnostics(final bool) error {
	if runner.options.Diagnostics == "" {
		return nil
	}
	runtimeStats := runner.observer().Memory()
	runner.mutex.Lock()
	tcp, udp := uint64(0), uint64(0)
	udpCapacityDropped, udpTargetRejected, udpDatagramDropped, udpQueueDropped, udpAmplificationDropped := uint64(0), uint64(0), uint64(0), uint64(0), uint64(0)
	for _, instance := range runner.instances {
		if instance.assignment.Protocol == "tcp" {
			tcp += instance.stream.Remaining()
		} else {
			udp += instance.stream.Remaining()
			if stats, ok := nativeexecution.ReadUDPDiagnostics(instance.stream); ok {
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
	process := runner.observer().Process()
	descriptors, cpu, maxRSS := process.OpenFileDescriptors, process.CPUTimeNanos, process.MaxRSSBytes
	bytes, err := observationwire.EncodeValue(map[string]any{"version": 1, "capturedAt": observationwire.UTCTimeText(runner.scheduler().Now()), "pid": runner.observer().ProcessID(), "platform": runner.observer().Platform(), "snapshotGeneration": generation, "authorizationActive": active, "tcpStreams": tcp, "udpAssociations": udp, "udpCapacityDropped": udpCapacityDropped, "udpTargetRejected": udpTargetRejected, "udpDatagramDropped": udpDatagramDropped, "udpQueueDropped": udpQueueDropped, "udpAmplificationDropped": udpAmplificationDropped, "drainingInstances": drains, "goroutines": runner.observer().Goroutines(), "heapAllocBytes": runtimeStats.HeapAllocBytes, "runtimeBytes": runtimeStats.RuntimeBytes, "openFileDescriptors": descriptors, "cpuTimeNanos": cpu, "maxRSSBytes": maxRSS})
	if err != nil {
		return err
	}
	return runner.measurementFiles().WriteDiagnostics(runner.options.Diagnostics, bytes)
}

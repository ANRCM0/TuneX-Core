package nativeexecution

import (
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/forward"
)

type UDPDiagnosticDrops struct {
	CapacityDropped      uint64
	TargetRejected       uint64
	DatagramDropped      uint64
	QueueDropped         uint64
	AmplificationDropped uint64
}

func ReadUDPDiagnostics(instance executionhost.Instance) (UDPDiagnosticDrops, bool) {
	engine, ok := instance.(*forward.UDP)
	if !ok {
		return UDPDiagnosticDrops{}, false
	}
	stats := engine.Stats()
	return UDPDiagnosticDrops{CapacityDropped: stats.CapacityDropped, TargetRejected: stats.TargetRejected,
		DatagramDropped: stats.DatagramDropped, QueueDropped: stats.QueueDropped,
		AmplificationDropped: stats.AmplificationDropped}, true
}

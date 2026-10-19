package state

import "fmt"

// These strings are part of the existing protected physical history format.
func PhysicalSlotKey(protocol string, port uint64) string {
	return fmt.Sprintf("%s/%d", protocol, port)
}

func TransitSlotKey(port uint64) string {
	return fmt.Sprintf("tcp/%d", port)
}

func NativeRuntimeJournal(node string, journal Journal) RuntimeJournal {
	return RuntimeJournal{ProtocolVersion: 3, NodeID: node, Journal: journal}
}

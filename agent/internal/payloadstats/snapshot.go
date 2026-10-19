package payloadstats

// Snapshot is operational ingress payload, not wire traffic or billing evidence.
// Fields are individually atomic; concurrent writes need not appear in one snapshot together.
type Snapshot struct {
	Epoch                  string
	PayloadSentBytes       uint64
	PayloadReceivedBytes   uint64
	TCPAccepted            uint64
	TCPConnected           uint64
	TCPClosed              uint64
	UDPAssociationsCreated uint64
	UDPAssociationsClosed  uint64
	UDPDatagramsSent       uint64
	UDPDatagramsReceived   uint64
	Overflowed             bool
}

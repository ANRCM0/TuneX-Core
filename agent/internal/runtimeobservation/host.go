package runtimeobservation

type HostCPUResources struct {
	Availability      string
	LogicalProcessors *int
	TotalTicks        *string
	IdleTicks         *string
	IOWaitTicks       *string
}

type HostMemoryResources struct {
	Availability   string
	TotalBytes     *string
	AvailableBytes *string
}

type HostLoadResources struct {
	Availability string
	OneMilli     *string
	FiveMilli    *string
	FifteenMilli *string
}

type HostFilesystemResources struct {
	Availability   string
	Scope          string
	TotalBytes     *string
	AvailableBytes *string
}

type HostNetworkInterface struct {
	Name    string
	RXBytes string
	TXBytes string
}

type HostNetworkResources struct {
	Availability string
	Scope        string
	Limit        int
	Available    int
	Returned     int
	Omitted      int
	Truncated    bool
	Interfaces   []HostNetworkInterface
}

// These scopes describe the Agent's OS view, never physical-host or cgroup guarantees.
type HostResources struct {
	Scope      string
	CPU        HostCPUResources
	Memory     HostMemoryResources
	Load       HostLoadResources
	Filesystem HostFilesystemResources
	Network    HostNetworkResources
}

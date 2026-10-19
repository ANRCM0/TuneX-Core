package observationwire

type HostCPUResources struct {
	Availability      string  `json:"availability"`
	LogicalProcessors *int    `json:"logicalProcessors"`
	TotalTicks        *string `json:"totalTicks"`
	IdleTicks         *string `json:"idleTicks"`
	IOWaitTicks       *string `json:"ioWaitTicks"`
}

type HostMemoryResources struct {
	Availability   string  `json:"availability"`
	TotalBytes     *string `json:"totalBytes"`
	AvailableBytes *string `json:"availableBytes"`
}

type HostLoadResources struct {
	Availability string  `json:"availability"`
	OneMilli     *string `json:"oneMilli"`
	FiveMilli    *string `json:"fiveMilli"`
	FifteenMilli *string `json:"fifteenMilli"`
}

type HostFilesystemResources struct {
	Availability   string  `json:"availability"`
	Scope          string  `json:"scope"`
	TotalBytes     *string `json:"totalBytes"`
	AvailableBytes *string `json:"availableBytes"`
}

type HostNetworkInterface struct {
	Name    string `json:"name"`
	RXBytes string `json:"rxBytes"`
	TXBytes string `json:"txBytes"`
}

type HostNetworkResources struct {
	Availability string                 `json:"availability"`
	Scope        string                 `json:"scope"`
	Limit        int                    `json:"limit"`
	Available    int                    `json:"available"`
	Returned     int                    `json:"returned"`
	Omitted      int                    `json:"omitted"`
	Truncated    bool                   `json:"truncated"`
	Interfaces   []HostNetworkInterface `json:"interfaces"`
}

// These scopes describe the Agent's OS view, never physical-host or cgroup guarantees.
type HostResources struct {
	Scope      string                  `json:"scope"`
	CPU        HostCPUResources        `json:"cpu"`
	Memory     HostMemoryResources     `json:"memory"`
	Load       HostLoadResources       `json:"load"`
	Filesystem HostFilesystemResources `json:"filesystem"`
	Network    HostNetworkResources    `json:"network"`
}

package platformobservation

import "github.com/tunex/vnext/agent/internal/observationwire"

type HostCPUResources = observationwire.HostCPUResources
type HostMemoryResources = observationwire.HostMemoryResources
type HostLoadResources = observationwire.HostLoadResources
type HostFilesystemResources = observationwire.HostFilesystemResources
type HostNetworkInterface = observationwire.HostNetworkInterface
type HostNetworkResources = observationwire.HostNetworkResources
type HostResources = observationwire.HostResources

func EmptyHostResources(availability string) HostResources {
	return HostResources{
		Scope:      "agent-visible-os",
		CPU:        HostCPUResources{Availability: availability},
		Memory:     HostMemoryResources{Availability: availability},
		Load:       HostLoadResources{Availability: availability},
		Filesystem: HostFilesystemResources{Availability: availability, Scope: "agent-root-filesystem"},
		Network: HostNetworkResources{Availability: availability, Scope: "agent-network-namespace", Limit: 16,
			Interfaces: []HostNetworkInterface{}},
	}
}

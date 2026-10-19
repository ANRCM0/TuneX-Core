package control

import (
	"github.com/tunex/vnext/agent/internal/platformobservation"
)

type hostCPUResources = platformobservation.HostCPUResources
type hostMemoryResources = platformobservation.HostMemoryResources
type hostLoadResources = platformobservation.HostLoadResources
type hostFilesystemResources = platformobservation.HostFilesystemResources
type hostNetworkInterface = platformobservation.HostNetworkInterface
type hostNetworkResources = platformobservation.HostNetworkResources
type hostResources = platformobservation.HostResources

func emptyHostResources(availability string) hostResources {
	return platformobservation.EmptyHostResources(availability)
}
func sampleHostResources() hostResources { return platformobservation.CaptureHost() }

package control

import (
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
)

func publicExecutionHost(host executionHost) executiondriver.Host {
	return executiondriver.Host{NodeID: host.nodeID, SessionEpoch: host.sessionEpoch, Policy: host.policy, PeerIdentity: host.relayIdentity, Payload: host.payload}
}

func publicExecutionDescriptor(descriptor executionDescriptor) executiondriver.Descriptor {
	return executiondriver.Descriptor{ID: descriptor.id, HostVersion: descriptor.hostInterfaceVersion, SchemaVersion: descriptor.schemaVersion,
		Platforms: descriptor.platforms, Roles: descriptor.roles, Phases: descriptor.phases, Protocols: descriptor.protocols,
		Capabilities: descriptor.capabilities, ProbeCapabilities: descriptor.probeCapabilities,
		RequiresRelay: descriptor.requiresRelay, RequiresMultihop: descriptor.requiresMultihop}
}

// Keep the old private adapters usable while all live selection crosses the
// package-owned host contract. New compiled drivers can implement that contract.
func publicExecutionDriver(value executionDriver) executiondriver.Driver {
	driver := executiondriver.Driver{Descriptor: publicExecutionDescriptor(value.descriptor),
		Start: func(host executiondriver.Host, assignment adp3.Assignment, check func() error) (executiondriver.Instance, error) {
			return value.start(executionHost{nodeID: host.NodeID, sessionEpoch: host.SessionEpoch, policy: host.Policy, relayIdentity: host.PeerIdentity, payload: host.Payload}, assignment, check)
		},
		Phase: func(instance executiondriver.Instance, phase string) error { return value.phase(instance, phase) }, Classify: value.classify}
	if value.replace != nil {
		driver.Replace = func(instance executiondriver.Instance, assignment adp3.Assignment, check func() error) (executiondriver.Instance, error) {
			return value.replace(instance, assignment, check)
		}
	}
	if value.probeIngress != nil {
		driver.ProbeIngress = func(instance executiondriver.Instance) (executiondriver.ProbeTarget, error) {
			target, err := value.probeIngress(instance)
			return executiondriver.ProbeTarget{Address: target.address, Port: target.port, Check: target.check}, err
		}
	}
	if value.probeUDPIngress != nil {
		driver.ProbeUDPIngress = func(instance executiondriver.Instance) (executiondriver.ProbeTarget, error) {
			target, err := value.probeUDPIngress(instance)
			return executiondriver.ProbeTarget{Address: target.address, Port: target.port, Check: target.check}, err
		}
	}
	return driver
}

func adaptExecutionDriver(value executiondriver.Driver) executionDriver {
	descriptor := value.Descriptor.Clone()
	driver := executionDriver{descriptor: executionDescriptor{id: descriptor.ID, hostInterfaceVersion: descriptor.HostVersion, schemaVersion: descriptor.SchemaVersion,
		platforms: descriptor.Platforms, roles: descriptor.Roles, phases: descriptor.Phases, protocols: descriptor.Protocols, capabilities: descriptor.Capabilities,
		probeCapabilities: descriptor.ProbeCapabilities, requiresRelay: descriptor.RequiresRelay, requiresMultihop: descriptor.RequiresMultihop},
		classify: value.Classify}
	if value.Start != nil {
		driver.start = func(host executionHost, assignment adp3.Assignment, check func() error) (execution, error) {
			return value.Start(publicExecutionHost(host), assignment, check)
		}
	}
	if value.Phase != nil {
		driver.phase = func(instance execution, phase string) error { return value.Phase(instance, phase) }
	}
	if value.Replace != nil {
		driver.replace = func(instance execution, assignment adp3.Assignment, check func() error) (execution, error) {
			return value.Replace(instance, assignment, check)
		}
	}
	if value.ProbeIngress != nil {
		driver.probeIngress = func(instance execution) (executionProbeTarget, error) {
			target, err := value.ProbeIngress(instance)
			return executionProbeTarget{address: target.Address, port: target.Port, check: target.Check}, err
		}
	}
	if value.ProbeUDPIngress != nil {
		driver.probeUDPIngress = func(instance execution) (executionProbeTarget, error) {
			target, err := value.ProbeUDPIngress(instance)
			return executionProbeTarget{address: target.Address, port: target.Port, check: target.Check}, err
		}
	}
	return driver
}

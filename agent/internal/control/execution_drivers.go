package control

import (
	"fmt"
	"slices"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/relay"
)

type execution interface {
	Close()
	Drain()
	Remaining() uint64
	SetAuthorization(func() error)
}

type executionFeatures struct {
	relay, multihop bool
	probeIngress    bool
	probeServices   bool
	probeEcho       bool
}

type executionDescriptor struct {
	id                              string
	hostInterfaceVersion            uint64
	schemaVersion                   uint64
	roles, phases, protocols        []string
	capabilities                    []string
	platforms                       []string
	probeCapabilities               []string
	requiresRelay, requiresMultihop bool
}

func (descriptor executionDescriptor) enabled(features executionFeatures) bool {
	return executiondriver.EnabledOnCurrentPlatform(executiondriver.Descriptor{Platforms: descriptor.platforms,
		RequiresRelay: descriptor.requiresRelay, RequiresMultihop: descriptor.requiresMultihop},
		executiondriver.Features{Relay: features.relay, Multihop: features.multihop})
}

// Drivers receive execution inputs, not the Runner, journal, or authority issuer.
type executionHost struct {
	nodeID        string
	sessionEpoch  uint64
	policy        adp3.Policy
	relayIdentity func() (relay.Identity, time.Time, error)
	payload       executionhost.PayloadGate
}

func (host executionHost) peerIdentity() (relay.Identity, time.Time, error) {
	if host.relayIdentity == nil {
		return relay.Identity{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Host peer credential required")
	}
	return host.relayIdentity()
}

type executionDriver struct {
	descriptor      executionDescriptor
	start           func(executionHost, adp3.Assignment, func() error) (execution, error)
	replace         func(execution, adp3.Assignment, func() error) (execution, error)
	phase           func(execution, string) error
	classify        func(error) (string, bool)
	probeIngress    func(execution) (executionProbeTarget, error)
	probeUDPIngress func(execution) (executionProbeTarget, error)
}

type executionProbeTarget struct {
	address string
	port    uint64
	check   func() error
}

func (driver executionDriver) replaceInstance(old running, next adp3.Assignment, check func() error) (execution, error) {
	if driver.replace == nil || old.assignment.Driver.Id != next.Driver.Id || old.assignment.Driver.SchemaVersion != next.Driver.SchemaVersion || old.assignment.Protocol != next.Protocol {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: No compatible in-place replacement")
	}
	return driver.replace(old.stream, next, check)
}

type executionRegistry struct {
	ordered  []executionDriver
	byID     map[string]executionDriver
	contract *executiondriver.Registry
}

func newExecutionRegistry(drivers ...executionDriver) (*executionRegistry, error) {
	registry := &executionRegistry{byID: make(map[string]executionDriver)}
	shared := make([]executiondriver.Driver, 0, len(drivers))
	for _, driver := range drivers {
		descriptor := driver.descriptor
		declaration := publicExecutionDescriptor(descriptor)
		if err := nativeexecution.ValidateLegacyDriverHeader(declaration, driver.start != nil, driver.phase != nil, driver.classify != nil); err != nil {
			return nil, err
		}
		if _, exists := registry.byID[descriptor.id]; exists {
			return nil, fmt.Errorf("INVALID_CONFIG: Duplicate execution driver %s", descriptor.id)
		}
		if err := nativeexecution.ValidateLegacyDriverDeclaration(declaration, driver.probeIngress != nil); err != nil {
			return nil, err
		}
		descriptor.roles = slices.Clone(descriptor.roles)
		descriptor.phases = slices.Clone(descriptor.phases)
		descriptor.protocols = slices.Clone(descriptor.protocols)
		descriptor.capabilities = slices.Clone(descriptor.capabilities)
		descriptor.platforms = slices.Clone(descriptor.platforms)
		descriptor.probeCapabilities = slices.Clone(descriptor.probeCapabilities)
		driver.descriptor = descriptor
		registry.byID[descriptor.id] = driver
		registry.ordered = append(registry.ordered, driver)
		shared = append(shared, publicExecutionDriver(driver))
	}
	contract, err := executiondriver.NewRegistry(shared...)
	if err != nil {
		return nil, err
	}
	registry.contract = contract
	return registry, nil
}

// Selection supplements strict ADP parsing; it never accepts new wire shapes.
func (registry *executionRegistry) resolve(assignment adp3.Assignment, features executionFeatures) (executionDriver, error) {
	driver, err := registry.contract.Resolve(assignment, executiondriver.Features{Relay: features.relay, Multihop: features.multihop})
	if err != nil {
		return executionDriver{}, err
	}
	return adaptExecutionDriver(driver), nil
}

func (registry *executionRegistry) capabilities(features executionFeatures) []string {
	drivers := make([]executiondriver.Driver, 0, len(registry.ordered))
	for _, driver := range registry.ordered {
		drivers = append(drivers, publicExecutionDriver(driver))
	}
	return nativeexecution.Capabilities(drivers, executiondriver.Features{Relay: features.relay, Multihop: features.multihop}, features.probeIngress, features.probeServices, features.probeEcho)
}

var builtinExecutionDrivers = func() *executionRegistry {
	native := nativeexecution.BuiltinDrivers()
	drivers := make([]executionDriver, 0, len(native))
	for _, driver := range native {
		drivers = append(drivers, adaptExecutionDriver(driver))
	}
	registry, err := newExecutionRegistry(drivers...)
	if err != nil {
		panic(err)
	}
	return registry
}()

func (runner *Runner) executionFeatures() executionFeatures {
	return executionFeatures{relay: runner.options.Relay, multihop: runner.options.Multihop, probeIngress: runner.options.ProbeIngress, probeServices: runner.options.ProbeServices, probeEcho: runner.options.ProbeEcho}
}

func (runner *Runner) executionHost(driver executionDriver) executionHost {
	host := executionHost{nodeID: runner.options.NodeID, sessionEpoch: runner.hello.SessionEpoch, policy: runner.hello.Policy}
	if driver.descriptor.requiresRelay {
		host.relayIdentity = runner.relayIdentity
	}
	return host
}

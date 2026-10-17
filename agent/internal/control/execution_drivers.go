package control

import (
	"fmt"
	"slices"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
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
}

type executionDescriptor struct {
	id                              string
	schemaVersion                   uint64
	roles, phases, protocols        []string
	capabilities                    []string
	requiresRelay, requiresMultihop bool
}

func (descriptor executionDescriptor) enabled(features executionFeatures) bool {
	return (!descriptor.requiresRelay || features.relay) && (!descriptor.requiresMultihop || features.multihop)
}

// Drivers receive execution inputs, not the Runner, journal, or authority issuer.
type executionHost struct {
	nodeID        string
	sessionEpoch  uint64
	policy        adp3.Policy
	relayIdentity func() (relay.Identity, time.Time, error)
}

func (host executionHost) peerIdentity() (relay.Identity, time.Time, error) {
	if host.relayIdentity == nil {
		return relay.Identity{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Host peer credential required")
	}
	return host.relayIdentity()
}

type executionDriver struct {
	descriptor executionDescriptor
	start      func(executionHost, adp3.Assignment, func() error) (execution, error)
	replace    func(execution, adp3.Assignment, func() error) (execution, error)
	phase      func(execution, string) error
	classify   func(error) (string, bool)
}

func (driver executionDriver) replaceInstance(old running, next adp3.Assignment, check func() error) (execution, error) {
	if driver.replace == nil || old.assignment.Driver.Id != next.Driver.Id || old.assignment.Driver.SchemaVersion != next.Driver.SchemaVersion || old.assignment.Protocol != next.Protocol {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: No compatible in-place replacement")
	}
	return driver.replace(old.stream, next, check)
}

type executionRegistry struct {
	ordered []executionDriver
	byID    map[string]executionDriver
}

func newExecutionRegistry(drivers ...executionDriver) (*executionRegistry, error) {
	registry := &executionRegistry{byID: make(map[string]executionDriver)}
	for _, driver := range drivers {
		descriptor := driver.descriptor
		if descriptor.id == "" || descriptor.schemaVersion == 0 || driver.start == nil || driver.phase == nil || driver.classify == nil {
			return nil, fmt.Errorf("INVALID_CONFIG: Incomplete execution driver")
		}
		if _, exists := registry.byID[descriptor.id]; exists {
			return nil, fmt.Errorf("INVALID_CONFIG: Duplicate execution driver %s", descriptor.id)
		}
		for _, values := range [][]string{descriptor.roles, descriptor.phases, descriptor.protocols, descriptor.capabilities} {
			seen := make(map[string]bool)
			if len(values) == 0 {
				return nil, fmt.Errorf("INVALID_CONFIG: Empty execution driver declaration")
			}
			for _, value := range values {
				if value == "" || seen[value] {
					return nil, fmt.Errorf("INVALID_CONFIG: Invalid execution driver declaration")
				}
				seen[value] = true
			}
		}
		if !slices.Contains(descriptor.capabilities, descriptor.id) || descriptor.requiresMultihop && !descriptor.requiresRelay {
			return nil, fmt.Errorf("INVALID_CONFIG: Inconsistent execution driver requirements")
		}
		descriptor.roles = slices.Clone(descriptor.roles)
		descriptor.phases = slices.Clone(descriptor.phases)
		descriptor.protocols = slices.Clone(descriptor.protocols)
		descriptor.capabilities = slices.Clone(descriptor.capabilities)
		driver.descriptor = descriptor
		registry.byID[descriptor.id] = driver
		registry.ordered = append(registry.ordered, driver)
	}
	return registry, nil
}

// Selection supplements strict ADP parsing; it never accepts new wire shapes.
func (registry *executionRegistry) resolve(assignment adp3.Assignment, features executionFeatures) (executionDriver, error) {
	driver, exists := registry.byID[assignment.Driver.Id]
	descriptor := driver.descriptor
	if !exists || !descriptor.enabled(features) || assignment.Driver.SchemaVersion != descriptor.schemaVersion ||
		!slices.Contains(descriptor.roles, assignment.Role) || !slices.Contains(descriptor.phases, assignment.Phase) ||
		!slices.Contains(descriptor.protocols, assignment.Protocol) {
		return executionDriver{}, fmt.Errorf("UNSUPPORTED_CAPABILITY: Execution driver, version, role, phase or protocol unavailable")
	}
	return driver, nil
}

func (registry *executionRegistry) capabilities(features executionFeatures) []string {
	capabilities := []string{"adp.3"}
	for _, driver := range registry.ordered {
		if !driver.descriptor.enabled(features) {
			continue
		}
		for _, capability := range driver.descriptor.capabilities {
			if !slices.Contains(capabilities, capability) {
				capabilities = append(capabilities, capability)
			}
		}
	}
	return capabilities
}

var builtinExecutionDrivers = func() *executionRegistry {
	registry, err := newExecutionRegistry(nativeDirectDriver(), nativeRelayDriver(), nativeMultihopDriver())
	if err != nil {
		panic(err)
	}
	return registry
}()

func (runner *Runner) executionFeatures() executionFeatures {
	return executionFeatures{relay: runner.options.Relay, multihop: runner.options.Multihop}
}

func (runner *Runner) executionHost(driver executionDriver) executionHost {
	host := executionHost{nodeID: runner.options.NodeID, sessionEpoch: runner.hello.SessionEpoch, policy: runner.hello.Policy}
	if driver.descriptor.requiresRelay {
		host.relayIdentity = runner.relayIdentity
	}
	return host
}

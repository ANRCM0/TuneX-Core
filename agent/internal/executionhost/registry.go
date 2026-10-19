package executionhost

import (
	"fmt"
	"slices"
)

type Registry[Assignment, Policy, Identity any] struct {
	ordered []Driver[Assignment, Policy, Identity]
	byID    map[string]Driver[Assignment, Policy, Identity]
}

func validList(values []string, allowed []string) bool {
	if len(values) == 0 || len(values) > 64 {
		return false
	}
	seen := make(map[string]bool)
	for _, value := range values {
		if value == "" || len(value) > 128 || seen[value] || allowed != nil && !slices.Contains(allowed, value) {
			return false
		}
		seen[value] = true
	}
	return true
}

func NewRegistry[Assignment, Policy, Identity any](drivers ...Driver[Assignment, Policy, Identity]) (*Registry[Assignment, Policy, Identity], error) {
	if len(drivers) == 0 || len(drivers) > 64 {
		return nil, fmt.Errorf("INVALID_CONFIG: Bounded execution drivers required")
	}
	registry := &Registry[Assignment, Policy, Identity]{byID: make(map[string]Driver[Assignment, Policy, Identity])}
	for _, driver := range drivers {
		descriptor := driver.Descriptor
		if descriptor.ID == "" || len(descriptor.ID) > 128 || descriptor.HostVersion != HostVersion || descriptor.SchemaVersion == 0 ||
			driver.Start == nil || driver.Phase == nil || driver.Classify == nil ||
			!validList(descriptor.Platforms, []string{"linux", "windows"}) || !validList(descriptor.Roles, nil) ||
			!validList(descriptor.Phases, []string{"prepared", "active", "draining"}) || !validList(descriptor.Protocols, []string{"tcp", "udp"}) ||
			!validList(descriptor.Capabilities, nil) || !slices.Contains(descriptor.Capabilities, descriptor.ID) ||
			descriptor.RequiresMultihop && !descriptor.RequiresRelay {
			return nil, fmt.Errorf("INVALID_CONFIG: Incompatible execution host or descriptor")
		}
		if _, exists := registry.byID[descriptor.ID]; exists {
			return nil, fmt.Errorf("INVALID_CONFIG: Duplicate execution driver")
		}
		if (driver.ProbeIngress == nil) != (len(descriptor.ProbeCapabilities) == 0) ||
			len(descriptor.ProbeCapabilities) > 0 && !validList(descriptor.ProbeCapabilities, nil) {
			return nil, fmt.Errorf("INVALID_CONFIG: Observation ports and declarations differ")
		}
		for _, capability := range descriptor.ProbeCapabilities {
			if slices.Contains(descriptor.Capabilities, capability) {
				return nil, fmt.Errorf("INVALID_CONFIG: Duplicate observation capability")
			}
		}
		driver.Descriptor = descriptor.Clone()
		registry.ordered = append(registry.ordered, driver)
		registry.byID[descriptor.ID] = driver
	}
	return registry, nil
}

// The trusted outer binding supplies the actual platform, not a remote declaration.
func (registry *Registry[Assignment, Policy, Identity]) Resolve(selection Selection, features Features, platform string) (Driver[Assignment, Policy, Identity], error) {
	driver, exists := registry.byID[selection.DriverID]
	descriptor := driver.Descriptor
	if !exists || !descriptor.Enabled(features) || !slices.Contains(descriptor.Platforms, platform) ||
		descriptor.HostVersion != HostVersion || selection.SchemaVersion != descriptor.SchemaVersion ||
		!slices.Contains(descriptor.Roles, selection.Role) || !slices.Contains(descriptor.Phases, selection.Phase) ||
		!slices.Contains(descriptor.Protocols, selection.Protocol) {
		return Driver[Assignment, Policy, Identity]{}, fmt.Errorf("UNSUPPORTED_CAPABILITY: Execution host, platform, driver, version, role, phase or protocol unavailable")
	}
	driver.Descriptor = descriptor.Clone()
	return driver, nil
}

func (registry *Registry[Assignment, Policy, Identity]) Descriptors() []Descriptor {
	values := make([]Descriptor, 0, len(registry.ordered))
	for _, driver := range registry.ordered {
		values = append(values, driver.Descriptor.Clone())
	}
	return values
}

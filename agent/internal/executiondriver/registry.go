package executiondriver

import (
	"runtime"
	"slices"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/relay"
)

type Registry struct {
	inner executionhost.Registry[adp3.Assignment, adp3.Policy, relay.Identity]
}

// The one lower registry owns validation, cloning and lookup; this is a native binding only.
func NewRegistry(drivers ...Driver) (*Registry, error) {
	registry, err := executionhost.NewRegistry(drivers...)
	if err != nil {
		return nil, err
	}
	return &Registry{inner: *registry}, nil
}

func (registry *Registry) Resolve(assignment adp3.Assignment, features Features) (Driver, error) {
	return registry.inner.Resolve(executionhost.Selection{DriverID: assignment.Driver.Id, SchemaVersion: assignment.Driver.SchemaVersion,
		Role: assignment.Role, Phase: assignment.Phase, Protocol: assignment.Protocol}, features, runtime.GOOS)
}

func (registry *Registry) Descriptors() []Descriptor { return registry.inner.Descriptors() }

func EnabledOnCurrentPlatform(descriptor Descriptor, features Features) bool {
	return slices.Contains(descriptor.Platforms, runtime.GOOS) && descriptor.Enabled(features)
}

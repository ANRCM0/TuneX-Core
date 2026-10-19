// Package executionhost defines trusted execution ports without native wire or engine types.
// The original Runner retains Journal, authorization, fencing and retirement ownership.
package executionhost

import (
	"fmt"
	"slices"
	"time"
)

const HostVersion uint64 = 1

type Instance interface {
	Close()
	Drain()
	Remaining() uint64
	SetAuthorization(func() error)
}

type Host[Policy, Identity any] struct {
	NodeID       string
	SessionEpoch uint64
	Policy       Policy
	PeerIdentity func() (Identity, time.Time, error)
}

func (host Host[Policy, Identity]) RequirePeerIdentity() (Identity, time.Time, error) {
	if host.PeerIdentity == nil {
		var identity Identity
		return identity, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Host peer credential required")
	}
	return host.PeerIdentity()
}

type Descriptor struct {
	ID                                                string
	HostVersion                                       uint64
	SchemaVersion                                     uint64
	Platforms, Roles, Phases, Protocols, Capabilities []string
	ProbeCapabilities                                 []string
	RequiresRelay, RequiresMultihop                   bool
}

func (descriptor Descriptor) Clone() Descriptor {
	descriptor.Platforms = slices.Clone(descriptor.Platforms)
	descriptor.Roles = slices.Clone(descriptor.Roles)
	descriptor.Phases = slices.Clone(descriptor.Phases)
	descriptor.Protocols = slices.Clone(descriptor.Protocols)
	descriptor.Capabilities = slices.Clone(descriptor.Capabilities)
	descriptor.ProbeCapabilities = slices.Clone(descriptor.ProbeCapabilities)
	return descriptor
}

type ProbeTarget struct {
	Address string
	Port    uint64
	Check   func() error
}

// Drivers honor check throughout their lifetime and close partial failed starts.
// Close/Drain remain repeatable; a driver receives neither a Runner nor an issuer.
type Driver[Assignment, Policy, Identity any] struct {
	Descriptor      Descriptor
	Start           func(Host[Policy, Identity], Assignment, func() error) (Instance, error)
	Replace         func(Instance, Assignment, func() error) (Instance, error)
	Phase           func(Instance, string) error
	Classify        func(error) (string, bool)
	ProbeIngress    func(Instance) (ProbeTarget, error)
	ProbeUDPIngress func(Instance) (ProbeTarget, error)
}

type Features struct{ Relay, Multihop bool }

func (descriptor Descriptor) Enabled(features Features) bool {
	return (!descriptor.RequiresRelay || features.Relay) && (!descriptor.RequiresMultihop || features.Multihop)
}

// Selection is a header projection; it does not parse or widen any wire schema.
type Selection struct {
	DriverID              string
	SchemaVersion         uint64
	Role, Phase, Protocol string
}

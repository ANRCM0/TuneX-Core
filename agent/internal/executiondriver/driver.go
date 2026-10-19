// Package executiondriver binds the generic host to the existing native Agent contracts.
package executiondriver

import (
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/relay"
)

const HostVersion uint64 = executionhost.HostVersion

type Instance = executionhost.Instance
type Host = executionhost.Host[adp3.Policy, relay.Identity]
type Descriptor = executionhost.Descriptor
type ProbeTarget = executionhost.ProbeTarget
type Driver = executionhost.Driver[adp3.Assignment, adp3.Policy, relay.Identity]
type Features = executionhost.Features

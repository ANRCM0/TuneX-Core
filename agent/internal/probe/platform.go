package probe

import (
	"net"

	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

const InterfaceVersion uint64 = 1

// Effects are trusted compiled-in providers, not authority or a plugin sandbox.
// Scheduling must share the process/native deadline domain; it cannot replace
// Guard synchronization, independent permits or native certificate/trust checks.
type Effects struct {
	Schedule runtimeplatform.Scheduler
	Entropy  runtimeplatform.Entropy
	Dial     runtimeplatform.Dialer[net.Conn]
}

func nativeEffects() Effects {
	return Effects{Schedule: probenative.Schedule(), Entropy: probenative.Entropy(), Dial: probenative.Dialer()}
}

func NewWithEffects(resolve Resolver, effects Effects) (*Executor, error) {
	if resolve == nil || effects.Schedule == nil || effects.Entropy == nil || effects.Dial == nil {
		return nil, ErrInvalid
	}
	return &Executor{resolve: resolve, dial: effects.Dial.DialContext, schedule: effects.Schedule, entropy: effects.Entropy}, nil
}

func NewWithIngressEffects(resolve, ingress Resolver, effects Effects) (*Executor, error) {
	if ingress == nil {
		return nil, ErrInvalid
	}
	executor, err := NewWithEffects(resolve, effects)
	if err != nil {
		return nil, err
	}
	executor.resolveIngress = ingress
	return executor, nil
}

func NewWithServicesEffects(resolve, ingress Resolver, service ServiceResolver, effects Effects) (*Executor, error) {
	if service == nil {
		return nil, ErrInvalid
	}
	executor, err := NewWithIngressEffects(resolve, ingress, effects)
	if err != nil {
		return nil, err
	}
	executor.resolveService = service
	return executor, nil
}

func NewWithEchoEffects(resolve, ingress Resolver, service ServiceResolver, echo EchoResolver, effects Effects) (*Executor, error) {
	if echo == nil {
		return nil, ErrInvalid
	}
	executor, err := NewWithServicesEffects(resolve, ingress, service, effects)
	if err != nil {
		return nil, err
	}
	executor.resolveEcho = echo
	return executor, nil
}

// Package-local compatibility fixtures keep their old native defaults and dial field.
func (executor *Executor) scheduler() runtimeplatform.Scheduler {
	if executor != nil && executor.schedule != nil {
		return executor.schedule
	}
	return probenative.Schedule()
}
func (executor *Executor) randomSource() runtimeplatform.Entropy {
	if executor != nil && executor.entropy != nil {
		return executor.entropy
	}
	return probenative.Entropy()
}

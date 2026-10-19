package control

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"

	"github.com/tunex/vnext/agent/internal/agentplatform"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type Providers = agentplatform.Providers
type Effects = agentplatform.Effects
type LocalServices = agentplatform.LocalServices

func defaultLocalServices() LocalServices {
	return agentplatform.DefaultLocalServices()
}

// Older explicit constructors keep their original requirements and native local effects.
func NewWithLocalServices(options Options, providers Providers, effects Effects, local LocalServices) (*Runner, error) {
	if providers.Identity == nil || providers.Channel == nil || effects.Bootstrap == nil || effects.Schedule == nil || effects.Auxiliary == nil ||
		local.Observation == nil || local.Entropy == nil || local.Measurements == nil || local.Log == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Agent providers, platform effects and local services required")
	}
	return newRunnerWithLocalServices(options, providers, effects, local)
}

func defaultEffects() Effects { return agentplatform.DefaultEffects() }

func NewWithEffects(options Options, providers Providers, effects Effects) (*Runner, error) {
	if providers.Identity == nil || providers.Channel == nil || effects.Bootstrap == nil || effects.Schedule == nil || effects.Auxiliary == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Agent providers and platform effects required")
	}
	return newRunnerWithEffects(options, providers, effects)
}

func defaultProviders() Providers { return agentplatform.DefaultProviders() }

func NewWithProviders(options Options, providers Providers) (*Runner, error) {
	if providers.Identity == nil || providers.Channel == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Agent identity and channel providers required")
	}
	return newRunner(options, providers)
}

// Defaults retain old package-local construction paths; explicit NewWithProviders never falls back.
func (runner *Runner) identityProvider() executionidentity.Provider[tls.Certificate, *x509.CertPool] {
	if runner.providers.Identity != nil {
		return runner.providers.Identity
	}
	return agentplatform.DefaultProviders().Identity
}
func (runner *Runner) channelProvider() executionchannel.Provider[*http.Client, *x509.CertPool, tls.Certificate] {
	if runner.providers.Channel != nil {
		return runner.providers.Channel
	}
	return agentplatform.DefaultProviders().Channel
}
func (runner *Runner) credentialLocations() executionidentity.Locations {
	return runner.identityProvider().Locations(runner.options.Certificate, runner.options.PrivateKey, runner.options.CA)
}

func (runner *Runner) scheduler() runtimeplatform.Scheduler {
	if runner.effects.Schedule != nil {
		return runner.effects.Schedule
	}
	return agentplatform.DefaultEffects().Schedule
}
func (runner *Runner) auxiliary() executionchannel.Auxiliary[*http.Client] {
	if runner.effects.Auxiliary != nil {
		return runner.effects.Auxiliary
	}
	return agentplatform.DefaultEffects().Auxiliary
}
func probeChannelError(err error) error {
	if errors.Is(err, executionchannel.ErrForbiddenURL) {
		return probe.ErrDenied
	}
	return err
}

func (runner *Runner) observer() platformobservation.Provider {
	if runner.local.Observation != nil {
		return runner.local.Observation
	}
	return agentplatform.DefaultLocalServices().Observation
}
func (runner *Runner) entropy() runtimeplatform.Entropy {
	if runner.local.Entropy != nil {
		return runner.local.Entropy
	}
	return agentplatform.DefaultLocalServices().Entropy
}
func (runner *Runner) measurementFiles() runtimeplatform.MeasurementFiles {
	if runner.local.Measurements != nil {
		return runner.local.Measurements
	}
	return agentplatform.DefaultLocalServices().Measurements
}
func (runner *Runner) localLog() runtimeplatform.LocalLog {
	if runner.local.Log != nil {
		return runner.local.Log
	}
	return agentplatform.DefaultLocalServices().Log
}

// Point timestamps keep their original native domain, independent of effects.Schedule.
func nativeProbeCounterScheduler() runtimeplatform.Scheduler {
	return agentplatform.DefaultEffects().Schedule
}

func (runner *Runner) probeCounterScheduler() runtimeplatform.Scheduler {
	if runner.probeCounterClock != nil {
		return runner.probeCounterClock
	}
	return nativeProbeCounterScheduler()
}

func probeCounterPointValue(identity probeCounterIdentity, values probe.CounterSnapshot) probeCounterPoint {
	return probeCounterPointWith(identity, values, nativeProbeCounterScheduler())
}

// This existing construction seam preserves the native Probe factory hierarchy.
func (runner *Runner) newNativeProbeExecutor() (*probe.Executor, error) {
	if runner.options.ProbeEcho {
		return probe.NewWithEcho(runner.resolveProbeTarget, runner.resolveProbeIngressTarget, runner.resolveProbeServiceTarget, runner.resolveProbeEchoTarget)
	} else if runner.options.ProbeServices {
		return probe.NewWithServices(runner.resolveProbeTarget, runner.resolveProbeIngressTarget, runner.resolveProbeServiceTarget)
	} else if runner.options.ProbeIngress {
		return probe.NewWithIngress(runner.resolveProbeTarget, runner.resolveProbeIngressTarget)
	}
	return probe.New(runner.resolveProbeTarget)
}

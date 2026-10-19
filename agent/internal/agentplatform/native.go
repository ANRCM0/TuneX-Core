// Package agentplatform binds the original native Agent provider families.
package agentplatform

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/controlchannel"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

const InterfaceVersion uint64 = 1

// Providers are trusted compiled-in effects, not remote plugins or authority issuers.
type Providers struct {
	Identity executionidentity.Provider[tls.Certificate, *x509.CertPool]
	Channel  executionchannel.Provider[*http.Client, *x509.CertPool, tls.Certificate]
}

type Effects struct {
	Bootstrap runtimeplatform.Bootstrap[*x509.CertPool]
	Schedule  runtimeplatform.Scheduler
	Auxiliary executionchannel.Auxiliary[*http.Client]
}

type LocalServices struct {
	Observation  platformobservation.Provider
	Entropy      runtimeplatform.Entropy
	Measurements runtimeplatform.MeasurementFiles
	Log          runtimeplatform.LocalLog
}

func DefaultProviders() Providers {
	return Providers{Identity: agentidentity.Native{}, Channel: controlchannel.Native{}}
}

func DefaultEffects() Effects {
	return Effects{Bootstrap: platformruntime.Bootstrap{}, Schedule: platformruntime.Schedule{}, Auxiliary: controlchannel.Native{}}
}

func DefaultLocalServices() LocalServices {
	return LocalServices{Observation: platformobservation.Native{}, Entropy: platformruntime.Local{}, Measurements: platformruntime.Local{}, Log: platformruntime.Local{}}
}

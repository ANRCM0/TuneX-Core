// Package agentcommand coordinates the existing Agent command modes.
package agentcommand

import (
	"context"
	"fmt"

	"github.com/tunex/vnext/agent/internal/agentcli"
	"github.com/tunex/vnext/agent/internal/control"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
)

const InterfaceVersion uint64 = 1

type Runner interface{ Run(context.Context) error }

type Platform interface {
	TrustedControlURL(string) bool
	ResolvePaths(directory, journalKey, timeProof, timeProofKey string) (agentcli.Paths, error)
	InspectJournal(journal, keyPath, node string) error
	Enroll(executionenrollment.Options) error
	AcquireInstance(root string) (func(), error)
	BootID() (string, error)
	DiagnosticsPath(root string) string
	RunWithSignals(func(context.Context) error) error
}

type Host struct {
	Platform  Platform
	NewRunner func(control.Options) (Runner, error)
}

func (host Host) Run(options agentcli.Options) error {
	if options.ProbeEcho && (!options.ProbeServices || !options.ProbeIngress || !options.ProbeExecution || !options.ProbeRegistration) {
		return fmt.Errorf("probe-echo requires probe-services, probe-ingress, probe-execution and probe-registration")
	}
	if options.ProbeServices && (!options.ProbeIngress || !options.ProbeExecution || !options.ProbeRegistration) {
		return fmt.Errorf("probe-services requires probe-ingress, probe-execution and probe-registration")
	}
	if options.InspectJournal && (options.Enroll || options.Rotate || options.Multihop || options.ImportTransitJournal != "" || options.Diagnostics || options.Telemetry || options.ForwardTelemetry || options.HostTelemetry || options.ProbeTelemetry || options.ProbeRegistration || options.ProbeExecution || options.ProbeIngress || options.ProbeServices || options.ProbeEcho) {
		return fmt.Errorf("Journal inspection cannot be combined with state-changing flags")
	}
	if (options.TimeProof == "") != (options.TimeProofKey == "") {
		return fmt.Errorf("time-proof and time-proof-key must be provided together")
	}
	platform := host.Platform
	if options.NodeID == "" || options.Directory == "" || options.JournalKey == "" || !options.InspectJournal && (options.URL == "" || options.CA == "" || !platform.TrustedControlURL(options.URL)) {
		return fmt.Errorf("control, node, ca, state and journal-key are required")
	}
	paths, err := platform.ResolvePaths(options.Directory, options.JournalKey, options.TimeProof, options.TimeProofKey)
	if err != nil {
		return err
	}
	if options.InspectJournal {
		return platform.InspectJournal(paths.Journal, paths.KeyPath, options.NodeID)
	}
	if options.Enroll {
		return platform.Enroll(executionenrollment.Options{URL: options.URL, NodeID: options.NodeID, CA: options.CA,
			Root: paths.Root, KeyPath: paths.KeyPath, CertificatePath: paths.Certificate,
			PrivatePath: paths.PrivateKey, JournalPath: paths.Journal})
	}
	release, err := platform.AcquireInstance(paths.Root)
	if err != nil {
		return err
	}
	defer release()
	boot, err := platform.BootID()
	if err != nil {
		return err
	}
	diagnostics := ""
	if options.Diagnostics {
		diagnostics = platform.DiagnosticsPath(paths.Root)
	}
	runner, err := host.NewRunner(control.Options{URL: options.URL, NodeID: options.NodeID, BootID: boot, CA: options.CA,
		Certificate: paths.Certificate, PrivateKey: paths.PrivateKey, Journal: paths.Journal, JournalKey: paths.KeyPath,
		Rotate: options.Rotate, Relay: options.Relay, Multihop: options.Multihop,
		ProbeRegistration: options.ProbeRegistration, ProbeExecution: options.ProbeExecution,
		ProbeIngress: options.ProbeIngress, ProbeServices: options.ProbeServices, ProbeEcho: options.ProbeEcho,
		ImportTransitJournal: options.ImportTransitJournal, TimeProof: options.TimeProof, TimeProofKey: options.TimeProofKey,
		Diagnostics: diagnostics, Telemetry: options.Telemetry, ForwardTelemetry: options.ForwardTelemetry,
		HostTelemetry: options.HostTelemetry, ProbeTelemetry: options.ProbeTelemetry})
	if err != nil {
		return err
	}
	return platform.RunWithSignals(runner.Run)
}

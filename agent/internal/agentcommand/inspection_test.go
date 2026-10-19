package agentcommand

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/agentcli"
	"github.com/tunex/vnext/agent/internal/control"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
)

type inspectionPlatform struct {
	calls              []string
	inspectionError    error
	resolveError       error
	journal, key, node string
}

func (platform *inspectionPlatform) TrustedControlURL(string) bool {
	platform.calls = append(platform.calls, "control-url")
	return false
}
func (platform *inspectionPlatform) ResolvePaths(string, string, string, string) (agentcli.Paths, error) {
	platform.calls = append(platform.calls, "resolve")
	return agentcli.Paths{Journal: "journal", KeyPath: "key", Root: "root"}, platform.resolveError
}
func (platform *inspectionPlatform) InspectJournal(journal, key, node string) error {
	platform.calls = append(platform.calls, "inspect")
	platform.journal, platform.key, platform.node = journal, key, node
	return platform.inspectionError
}
func (platform *inspectionPlatform) Enroll(executionenrollment.Options) error {
	platform.calls = append(platform.calls, "enroll")
	return errors.New("unexpected enrollment")
}
func (platform *inspectionPlatform) AcquireInstance(string) (func(), error) {
	platform.calls = append(platform.calls, "lock")
	return nil, errors.New("unexpected instance lock")
}
func (platform *inspectionPlatform) BootID() (string, error) {
	platform.calls = append(platform.calls, "boot")
	return "", errors.New("unexpected boot identity")
}
func (platform *inspectionPlatform) DiagnosticsPath(string) string {
	platform.calls = append(platform.calls, "diagnostics")
	return ""
}
func (platform *inspectionPlatform) RunWithSignals(func(context.Context) error) error {
	platform.calls = append(platform.calls, "signals")
	return errors.New("unexpected run")
}

func inspectionHost(platform *inspectionPlatform) Host {
	return Host{Platform: platform, NewRunner: func(control.Options) (Runner, error) {
		platform.calls = append(platform.calls, "new-runner")
		return nil, errors.New("unexpected runner construction")
	}}
}

func inspectionOptions() agentcli.Options {
	return agentcli.Options{InspectJournal: true, NodeID: "node", Directory: "state", JournalKey: "protected-key"}
}

func TestInspectionReturnsWithoutEnrollmentLockOrRunner(t *testing.T) {
	rejected := errors.New("authenticated inspection failed")
	for _, inspectionError := range []error{nil, rejected} {
		platform := &inspectionPlatform{inspectionError: inspectionError}
		err := inspectionHost(platform).Run(inspectionOptions())
		if !errors.Is(err, inspectionError) || !reflect.DeepEqual(platform.calls, []string{"resolve", "inspect"}) {
			t.Fatalf("inspection crossed read-only branch: calls=%v err=%v", platform.calls, err)
		}
		if platform.journal != "journal" || platform.key != "key" || platform.node != "node" {
			t.Fatal("resolved authenticated inspection arguments changed")
		}
	}
	failure := errors.New("protected path refused")
	platform := &inspectionPlatform{resolveError: failure}
	if err := inspectionHost(platform).Run(inspectionOptions()); !errors.Is(err, failure) || !reflect.DeepEqual(platform.calls, []string{"resolve"}) {
		t.Fatalf("path refusal continued to inspection or mutation: calls=%v err=%v", platform.calls, err)
	}
}

func TestInspectionRejectsEveryStateChangingFlagBeforeEffects(t *testing.T) {
	for _, name := range []string{"enroll", "rotate", "multihop", "transit-import", "diagnostics", "telemetry", "forward-telemetry", "host-telemetry", "probe-telemetry", "registration", "execution", "ingress", "services", "echo"} {
		t.Run(name, func(t *testing.T) {
			options := inspectionOptions()
			switch name {
			case "enroll":
				options.Enroll = true
			case "rotate":
				options.Rotate = true
			case "multihop":
				options.Multihop = true
			case "transit-import":
				options.ImportTransitJournal = "old-journal"
			case "diagnostics":
				options.Diagnostics = true
			case "telemetry":
				options.Telemetry = true
			case "forward-telemetry":
				options.ForwardTelemetry = true
			case "host-telemetry":
				options.HostTelemetry = true
			case "probe-telemetry":
				options.ProbeTelemetry = true
			case "registration":
				options.ProbeRegistration = true
			case "execution":
				options.ProbeExecution = true
			case "ingress":
				options.ProbeIngress = true
			case "services":
				options.ProbeServices = true
				options.ProbeIngress = true
				options.ProbeExecution = true
				options.ProbeRegistration = true
			case "echo":
				options.ProbeEcho = true
				options.ProbeServices = true
				options.ProbeIngress = true
				options.ProbeExecution = true
				options.ProbeRegistration = true
			}
			platform := &inspectionPlatform{}
			err := inspectionHost(platform).Run(options)
			if err == nil || err.Error() != "Journal inspection cannot be combined with state-changing flags" || len(platform.calls) != 0 {
				t.Fatalf("mutating inspection reached effects: calls=%v err=%v", platform.calls, err)
			}
		})
	}
}

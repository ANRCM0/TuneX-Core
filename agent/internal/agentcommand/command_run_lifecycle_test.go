package agentcommand

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/agentcli"
	"github.com/tunex/vnext/agent/internal/control"
)

type bStageCommandPlatform struct {
	inspectionPlatform
	fail    string
	failure error
}

func (p *bStageCommandPlatform) TrustedControlURL(url string) bool {
	p.calls = append(p.calls, "url")
	return url == "https://control"
}
func (p *bStageCommandPlatform) ResolvePaths(directory, key, proof, proofKey string) (agentcli.Paths, error) {
	p.calls = append(p.calls, "paths")
	return agentcli.Paths{Root: "root", KeyPath: "key", Certificate: "certificate", PrivateKey: "private", Journal: "journal"}, nil
}
func (p *bStageCommandPlatform) AcquireInstance(root string) (func(), error) {
	p.calls = append(p.calls, "lock:"+root)
	if p.fail == "lock" {
		return nil, p.failure
	}
	return func() { p.calls = append(p.calls, "release") }, nil
}
func (p *bStageCommandPlatform) BootID() (string, error) {
	p.calls = append(p.calls, "boot")
	if p.fail == "boot" {
		return "", p.failure
	}
	return "boot-id", nil
}
func (p *bStageCommandPlatform) DiagnosticsPath(root string) string {
	p.calls = append(p.calls, "diagnostics:"+root)
	return "diagnostics-path"
}
func (p *bStageCommandPlatform) RunWithSignals(run func(context.Context) error) error {
	p.calls = append(p.calls, "signals")
	return run(context.Background())
}

type bStageCommandRunner struct{ p *bStageCommandPlatform }

func (r bStageCommandRunner) Run(context.Context) error {
	r.p.calls = append(r.p.calls, "run")
	return r.p.failure
}

func TestCommandRunReleaseAndConstructionBeforeSignals(t *testing.T) {
	for _, stage := range []string{"lock", "boot", "constructor", "run"} {
		t.Run(stage, func(t *testing.T) {
			failure := errors.New("original-run-failure")
			p := &bStageCommandPlatform{fail: stage, failure: failure}
			host := Host{Platform: p, NewRunner: func(options control.Options) (Runner, error) {
				p.calls = append(p.calls, "constructor")
				if options.BootID != "boot-id" || options.NodeID != "node" || options.Certificate != "certificate" || options.PrivateKey != "private" || options.Journal != "journal" || options.JournalKey != "key" || options.Diagnostics != "diagnostics-path" || !options.Relay || !options.Rotate {
					t.Fatalf("Runner options lost: %#v", options)
				}
				if stage == "constructor" {
					return nil, failure
				}
				return bStageCommandRunner{p}, nil
			}}
			err := host.Run(agentcli.Options{URL: "https://control", NodeID: "node", CA: "ca", Directory: "state", JournalKey: "outside-key", Diagnostics: true, Relay: true, Rotate: true})
			want := []string{"url", "paths", "lock:root"}
			if stage != "lock" {
				want = append(want, "boot")
				if stage != "boot" {
					want = append(want, "diagnostics:root", "constructor")
					if stage == "run" {
						want = append(want, "signals", "run")
					}
				}
				want = append(want, "release")
			}
			if !errors.Is(err, failure) || !reflect.DeepEqual(p.calls, want) {
				t.Fatalf("run order %v err=%v, want %v", p.calls, err, want)
			}
		})
	}
}

func TestInspectionAllowsRelayAndPairedTimeProof(t *testing.T) {
	p := &inspectionPlatform{}
	options := inspectionOptions()
	options.Relay = true
	options.TimeProof = "proof"
	options.TimeProofKey = "proof-key"
	if err := inspectionHost(p).Run(options); err != nil || !reflect.DeepEqual(p.calls, []string{"resolve", "inspect"}) {
		t.Fatalf("allowed readonly flags refused: %v %v", p.calls, err)
	}
}

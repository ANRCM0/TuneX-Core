package nativeexecution

import (
	"encoding/json"
	"os"
	"reflect"
	"runtime"
	"slices"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/relay"
)

func TestCatalogCompleteCompiledFieldsAndHostSelection(t *testing.T) {
	raw, err := os.ReadFile("../../../packages/contracts/data/native-drivers-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var catalog struct {
		Version uint64 `json:"version"`
		Drivers []struct {
			ID           string   `json:"id"`
			Revision     uint64   `json:"descriptorRevision"`
			Schema       uint64   `json:"assignmentSchemaVersion"`
			SchemaID     string   `json:"schemaId"`
			Platforms    []string `json:"platforms"`
			Roles        []string `json:"roles"`
			Phases       []string `json:"phases"`
			Protocols    []string `json:"businessProtocols"`
			Capabilities []string `json:"advertisedCapabilities"`
			Required     []string `json:"requiredCapabilities"`
			Flags        []string `json:"agentFlags"`
			Gate         string   `json:"controlGate"`
			Usage        string   `json:"usage"`
			Probe        string   `json:"probe"`
		} `json:"drivers"`
	}
	if err := json.Unmarshal(raw, &catalog); err != nil {
		t.Fatal(err)
	}
	drivers := BuiltinDrivers()
	if catalog.Version != 1 || len(catalog.Drivers) != 3 || len(drivers) != 3 {
		t.Fatal("catalog1 compiled driver set changed")
	}
	native, err := executiondriver.NewRegistry(drivers...)
	if err != nil {
		t.Fatal(err)
	}
	generic, err := executionhost.NewRegistry[adp3.Assignment, adp3.Policy, relay.Identity](drivers...)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(native.Descriptors(), generic.Descriptors()) {
		t.Fatal("typed native/generic wrapper descriptors differ")
	}
	ids := []string{"native.direct.v1", "native.relay.v1", "native.multihop.v1"}
	schemas := []string{"urn:tunex:adp:3:runtime", "urn:tunex:adp:3:relay", "urn:tunex:adp:3:execution:1"}
	flags := [][]string{{}, {"--relay"}, {"--relay", "--multihop"}}
	for i, item := range catalog.Drivers {
		d := drivers[i].Descriptor
		if item.ID != ids[i] || item.ID != d.ID || item.Revision != 1 || item.Schema != d.SchemaVersion || item.SchemaID != schemas[i] || d.HostVersion != executionhost.HostVersion ||
			!reflect.DeepEqual(item.Platforms, d.Platforms) || !reflect.DeepEqual(item.Roles, d.Roles) || !reflect.DeepEqual(item.Phases, d.Phases) || !reflect.DeepEqual(item.Protocols, d.Protocols) || !reflect.DeepEqual(item.Capabilities, d.Capabilities) || !reflect.DeepEqual(item.Flags, flags[i]) ||
			slices.Contains(item.Flags, "--relay") != d.RequiresRelay || slices.Contains(item.Flags, "--multihop") != d.RequiresMultihop || (item.Gate == "multihop") != d.RequiresMultihop || item.Gate != []string{"none", "none", "multihop"}[i] || item.Usage != "not-reported" {
			t.Fatalf("catalog/native declaration mismatch at %d: %#v / %#v", i, item, d)
		}
		wantRequired := []string{"adp.3"}
		for j := 0; j <= i; j++ {
			for _, capability := range drivers[j].Descriptor.Capabilities {
				// Business protocol advertisement is not a driver prerequisite.
				if capability != "tcp" && capability != "udp" && capability != "shared-resource-limits.v1" {
					wantRequired = append(wantRequired, capability)
				}
			}
		}
		if !reflect.DeepEqual(item.Required, wantRequired) {
			t.Fatalf("required capabilities mismatch: %v / %v", item.Required, wantRequired)
		}
		if (item.Probe == "direct-egress-tcp-opt-in") != (drivers[i].ProbeIngress != nil) || (i != 0 && (item.Probe != "unsupported" || drivers[i].ProbeUDPIngress != nil)) {
			t.Fatal("catalog Probe declaration differs from compiled hooks")
		}
		for _, enabled := range []executiondriver.Features{{}, {Relay: true}, {Multihop: true}, {Relay: true, Multihop: true}} {
			wantEnabled := (!d.RequiresRelay || enabled.Relay) && (!d.RequiresMultihop || enabled.Multihop)
			for _, platform := range []string{"linux", "windows", "darwin", ""} {
				for _, role := range d.Roles {
					for _, phase := range d.Phases {
						for _, protocol := range d.Protocols {
							selection := executionhost.Selection{DriverID: d.ID, SchemaVersion: d.SchemaVersion, Role: role, Phase: phase, Protocol: protocol}
							got, err := generic.Resolve(selection, enabled, platform)
							want := wantEnabled && slices.Contains(d.Platforms, platform)
							if (err == nil) != want || want && !reflect.DeepEqual(got.Descriptor, d) {
								t.Fatalf("generic selection %s/%s/%v: %v", d.ID, platform, enabled, err)
							}
							if platform == runtime.GOOS {
								a := adp3.Assignment{Driver: adp3.Driver{Id: d.ID, SchemaVersion: d.SchemaVersion}, Role: role, Phase: phase, Protocol: protocol}
								nativeGot, nativeErr := native.Resolve(a, enabled)
								if (nativeErr == nil) != want || want && !reflect.DeepEqual(nativeGot.Descriptor, got.Descriptor) {
									t.Fatal("native wrapper selection differs from generic actual platform")
								}
							}
						}
					}
				}
			}
		}
	}
	// Declarative metadata cannot install a fourth driver or execute/load its schema.
	if _, err := native.Resolve(adp3.Assignment{Driver: adp3.Driver{Id: "native.transit.v1", SchemaVersion: 1}}, executiondriver.Features{Relay: true, Multihop: true}); err == nil {
		t.Fatal("catalog enabled uncompiled Transit driver")
	}
}

func TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication(t *testing.T) {
	for _, current := range []bool{false, true} {
		for featureBits := 0; featureBits < 4; featureBits++ {
			features := executiondriver.Features{Relay: featureBits&1 != 0, Multihop: featureBits&2 != 0}
			for flagBits := 0; flagBits < 8; flagBits++ {
				for hookBits := 0; hookBits < 4; hookBits++ {
					d := Multihop()
					d.Descriptor.Platforms = []string{"definitely-not-the-current-platform"}
					if current {
						d.Descriptor.Platforms = []string{runtime.GOOS}
					}
					d.Descriptor.Capabilities = []string{"adp.3", "custom", "custom"}
					d.Descriptor.ProbeCapabilities = []string{"custom", "probe.custom", "probe.custom"}
					calls := 0
					d.Start = func(executiondriver.Host, adp3.Assignment, func() error) (executiondriver.Instance, error) {
						calls++
						return nil, nil
					}
					d.Replace = func(executiondriver.Instance, adp3.Assignment, func() error) (executiondriver.Instance, error) {
						calls++
						return nil, nil
					}
					d.Phase = func(executiondriver.Instance, string) error { calls++; return nil }
					d.Classify = func(error) (string, bool) { calls++; return "", false }
					if hookBits&1 != 0 {
						d.ProbeIngress = func(executiondriver.Instance) (executiondriver.ProbeTarget, error) {
							calls++
							return executiondriver.ProbeTarget{}, nil
						}
					}
					if hookBits&2 != 0 {
						d.ProbeUDPIngress = func(executiondriver.Instance) (executiondriver.ProbeTarget, error) {
							calls++
							return executiondriver.ProbeTarget{}, nil
						}
					}
					in, services, echo := flagBits&1 != 0, flagBits&2 != 0, flagBits&4 != 0
					want := []string{"adp.3"}
					if current && features.Relay && features.Multihop {
						want = append(want, "custom")
						if in && hookBits&1 != 0 {
							want = append(want, "probe.custom")
							if services {
								want = append(want, "probe.tcp-ingress-tls.v1")
							}
							if services && echo && hookBits&2 != 0 {
								want = append(want, "probe.tcp-ingress-echo.v1", "probe.udp-ingress-echo.v1")
							}
						}
					}
					before := d.Descriptor.Clone()
					got := Capabilities([]executiondriver.Driver{d, d}, features, in, services, echo)
					if !reflect.DeepEqual(got, want) || calls != 0 || !reflect.DeepEqual(before, d.Descriptor) {
						t.Fatalf("current=%v features=%d flags=%d hooks=%d got=%v want=%v calls=%d", current, featureBits, flagBits, hookBits, got, want, calls)
					}
					got[0] = "mutated"
					if !reflect.DeepEqual(Capabilities([]executiondriver.Driver{d, d}, features, in, services, echo), want) {
						t.Fatal("capability output shares caller mutation")
					}
				}
			}
		}
	}
	if !reflect.DeepEqual(Capabilities(nil, executiondriver.Features{}, true, true, true), []string{"adp.3"}) {
		t.Fatal("Probe flags installed a driver without a compiled provider")
	}
}

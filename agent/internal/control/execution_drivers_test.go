package control

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/relay"
)

func executionTestAssignment(id, role, phase, protocol string) adp3.Assignment {
	return adp3.Assignment{
		Role: role, Phase: phase, Protocol: protocol,
		Driver:   adp3.Driver{Id: id, SchemaVersion: 1},
		Resource: adp3.Resource{Protocol: protocol},
	}
}

func TestExecutionRegistryDeclarations(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*executionDriver)
	}{
		{"missing ID", func(d *executionDriver) { d.descriptor.id = "" }},
		{"missing version", func(d *executionDriver) { d.descriptor.schemaVersion = 0 }},
		{"missing start", func(d *executionDriver) { d.start = nil }},
		{"missing phase", func(d *executionDriver) { d.phase = nil }},
		{"missing classification", func(d *executionDriver) { d.classify = nil }},
		{"missing roles", func(d *executionDriver) { d.descriptor.roles = nil }},
		{"missing phases", func(d *executionDriver) { d.descriptor.phases = nil }},
		{"missing protocols", func(d *executionDriver) { d.descriptor.protocols = nil }},
		{"missing capabilities", func(d *executionDriver) { d.descriptor.capabilities = nil }},
		{"missing driver capability", func(d *executionDriver) { d.descriptor.capabilities = []string{"tcp"} }},
		{"empty role", func(d *executionDriver) { d.descriptor.roles = []string{""} }},
		{"duplicate role", func(d *executionDriver) { d.descriptor.roles = []string{"direct", "direct"} }},
		{"duplicate phase", func(d *executionDriver) { d.descriptor.phases = []string{"active", "active"} }},
		{"duplicate protocol", func(d *executionDriver) { d.descriptor.protocols = []string{"tcp", "tcp"} }},
		{"duplicate capability", func(d *executionDriver) { d.descriptor.capabilities = []string{d.descriptor.id, d.descriptor.id} }},
		{"multihop without relay requirement", func(d *executionDriver) { d.descriptor.requiresMultihop = true }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			driver := nativeDirectDriver()
			test.mutate(&driver)
			if _, err := newExecutionRegistry(driver); err == nil {
				t.Fatal("invalid driver registration accepted")
			}
		})
	}
	if _, err := newExecutionRegistry(nativeDirectDriver(), nativeDirectDriver()); err == nil {
		t.Fatal("duplicate driver ID accepted")
	}
	driver := nativeDirectDriver()
	registry, err := newExecutionRegistry(driver)
	if err != nil {
		t.Fatal(err)
	}
	driver.descriptor.roles[0] = "changed"
	driver.descriptor.phases[0] = "changed"
	driver.descriptor.protocols[0] = "changed"
	driver.descriptor.capabilities[0] = "changed"
	assignment := executionTestAssignment("native.direct.v1", "direct", "active", "tcp")
	if _, err := registry.resolve(assignment, executionFeatures{}); err != nil {
		t.Fatalf("registration retained caller-owned declaration slices: %v", err)
	}
	want := []string{"adp.3", "native.direct.v1", "tcp", "udp", "shared-resource-limits.v1"}
	got := registry.capabilities(executionFeatures{})
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("capabilities = %v, want %v", got, want)
	}
	got[1] = "changed"
	if !reflect.DeepEqual(registry.capabilities(executionFeatures{}), want) {
		t.Fatal("capability caller mutated the registry")
	}
}

func TestExecutionRegistrySelection(t *testing.T) {
	features := executionFeatures{relay: true, multihop: true}
	for _, expected := range []struct {
		id            string
		roles, phases []string
	}{
		{"native.direct.v1", []string{"direct"}, []string{"active"}},
		{"native.relay.v1", []string{"relay-ingress", "relay-egress"}, []string{"prepared", "active", "draining"}},
		{"native.multihop.v1", []string{"multihop-ingress", "multihop-transit", "multihop-egress"}, []string{"prepared", "active", "draining"}},
	} {
		for _, role := range expected.roles {
			for _, phase := range expected.phases {
				for _, protocol := range []string{"tcp", "udp"} {
					t.Run(expected.id+"/"+role+"/"+phase+"/"+protocol, func(t *testing.T) {
						assignment := executionTestAssignment(expected.id, role, phase, protocol)
						selected, err := builtinExecutionDrivers.resolve(assignment, features)
						if err != nil || selected.descriptor.id != expected.id {
							t.Fatalf("native assignment unavailable: %v", err)
						}
					})
				}
			}
		}
	}
	tests := []struct {
		name     string
		mutate   func(*adp3.Assignment)
		features executionFeatures
	}{
		{"unknown driver", func(a *adp3.Assignment) { a.Driver.Id = "unknown.v1" }, features},
		{"unknown schema", func(a *adp3.Assignment) { a.Driver.SchemaVersion = 2 }, features},
		{"wrong role", func(a *adp3.Assignment) { a.Role = "relay-ingress" }, features},
		{"direct prepared", func(a *adp3.Assignment) { a.Phase = "prepared" }, features},
		{"direct draining", func(a *adp3.Assignment) { a.Phase = "draining" }, features},
		{"unknown protocol", func(a *adp3.Assignment) { a.Protocol = "sctp" }, features},
		{"relay disabled", func(a *adp3.Assignment) { a.Driver.Id, a.Role = "native.relay.v1", "relay-ingress" }, executionFeatures{}},
		{"multihop disabled", func(a *adp3.Assignment) { a.Driver.Id, a.Role = "native.multihop.v1", "multihop-ingress" }, executionFeatures{relay: true}},
		{"multihop without relay", func(a *adp3.Assignment) { a.Driver.Id, a.Role = "native.multihop.v1", "multihop-ingress" }, executionFeatures{multihop: true}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assignment := executionTestAssignment("native.direct.v1", "direct", "active", "tcp")
			test.mutate(&assignment)
			if _, err := builtinExecutionDrivers.resolve(assignment, test.features); err == nil || !strings.HasPrefix(err.Error(), "UNSUPPORTED_CAPABILITY") {
				t.Fatalf("unsupported assignment accepted: %v", err)
			}
		})
	}
}

func TestExecutionRegistryCapabilities(t *testing.T) {
	direct := []string{"adp.3", "native.direct.v1", "tcp", "udp", "shared-resource-limits.v1"}
	withRelay := append(append([]string{}, direct...), "native.relay.v1", "relay.wire.1")
	withMultihop := append(append([]string{}, withRelay...), "adp.execution.1", "native.multihop.v1", "multihop.wire.1")
	for _, test := range []struct {
		name     string
		features executionFeatures
		want     []string
	}{
		{"direct", executionFeatures{}, direct},
		{"relay", executionFeatures{relay: true}, withRelay},
		{"multihop", executionFeatures{relay: true, multihop: true}, withMultihop},
		{"invalid multihop flag", executionFeatures{multihop: true}, direct},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := builtinExecutionDrivers.capabilities(test.features)
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("capabilities = %v, want %v", got, test.want)
			}
			for _, driver := range builtinExecutionDrivers.ordered {
				a := executionTestAssignment(driver.descriptor.id, driver.descriptor.roles[0], driver.descriptor.phases[0], "tcp")
				_, err := builtinExecutionDrivers.resolve(a, test.features)
				if (err == nil) != driver.descriptor.enabled(test.features) {
					t.Fatal("advertisement and execution gates disagree")
				}
			}
		})
	}
}

func TestExecutionDriverFactoryBoundaries(t *testing.T) {
	denied := errors.New("LEASE_EXPIRED: contract test")
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run("direct/"+protocol, func(t *testing.T) {
			a := executionTestAssignment("native.direct.v1", "direct", "active", protocol)
			calls := 0
			_, err := nativeDirectDriver().start(executionHost{}, a, func() error { calls++; return denied })
			if !errors.Is(err, denied) || calls != 1 {
				t.Fatalf("Direct factory bypassed authorization before bind: %v", err)
			}
		})
	}
	for _, driver := range []executionDriver{nativeRelayDriver(), nativeMultihopDriver()} {
		t.Run(driver.descriptor.id, func(t *testing.T) {
			if _, err := driver.start(executionHost{}, adp3.Assignment{}, nil); err == nil {
				t.Fatal("missing host peer credential accepted")
			}
			calls := 0
			host := executionHost{relayIdentity: func() (relay.Identity, time.Time, error) {
				calls++
				return relay.Identity{}, time.Time{}, denied
			}}
			_, err := driver.start(host, adp3.Assignment{}, func() error { return nil })
			if !errors.Is(err, denied) || calls != 1 {
				t.Fatalf("factory bypassed its required peer credential: %v", err)
			}
			if _, err := driver.replaceInstance(running{}, adp3.Assignment{}, nil); err == nil {
				t.Fatal("Relay/multihop unexpectedly enabled in-place Direct replacement")
			}
			if err := driver.phase(nil, "active"); err == nil {
				t.Fatal("wrong execution instance accepted")
			}
		})
	}
}

func TestExecutionDriverReplacementBoundary(t *testing.T) {
	driver := nativeDirectDriver()
	called := false
	denied := errors.New("LEASE_EXPIRED")
	driver.replace = func(_ execution, _ adp3.Assignment, check func() error) (execution, error) {
		called = true
		return nil, check()
	}
	next := executionTestAssignment("native.direct.v1", "direct", "active", "tcp")
	for _, test := range []struct {
		name   string
		mutate func(*adp3.Assignment)
	}{
		{"different driver", func(a *adp3.Assignment) { a.Driver.Id = "native.relay.v1" }},
		{"different schema", func(a *adp3.Assignment) { a.Driver.SchemaVersion = 2 }},
		{"different protocol", func(a *adp3.Assignment) { a.Protocol = "udp" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			old := next
			test.mutate(&old)
			if _, err := driver.replaceInstance(running{assignment: old}, next, nil); err == nil || called {
				t.Fatal("incompatible instance reached replacement hook")
			}
		})
	}
	if _, err := driver.replaceInstance(running{assignment: next}, next, func() error { return denied }); !errors.Is(err, denied) || !called {
		t.Fatalf("replacement lost authorization callback: %v", err)
	}
}

func TestExecutionDriverAuthorizationContract(t *testing.T) {
	now := time.Now().UTC()
	sample := authorization.Sample{Wall: now, Uptime: time.Hour}
	clock := func() (authorization.Sample, error) { return sample, nil }
	guard, err := authorization.New(clock, time.Second, 5*time.Minute, now.Add(10*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := guard.Accept(now, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	runner := &Runner{
		options:          Options{Relay: true},
		relayCertificate: tls.Certificate{Leaf: &x509.Certificate{}},
		relayUntil:       now.Add(10 * time.Minute),
	}
	checks := []func() error{}
	for _, driver := range builtinExecutionDrivers.ordered {
		host := runner.executionHost(driver)
		if (host.relayIdentity != nil) != driver.descriptor.requiresRelay {
			t.Fatal("host exposed a peer credential accessor to an unrelated driver")
		}
		check, err := runner.assignmentCheck(driver, ticket)
		if err != nil {
			t.Fatal(err)
		}
		if err := check(); err != nil {
			t.Fatalf("%s rejected live authorization: %v", driver.descriptor.id, err)
		}
		checks = append(checks, check)
		missing, err := runner.assignmentCheck(driver, nil)
		if err != nil || missing() == nil {
			t.Fatal("driver accepted missing host authorization")
		}
	}
	sample.Wall = sample.Wall.Add(2 * time.Minute)
	sample.Uptime += 2 * time.Minute
	for _, check := range checks {
		if err := check(); err == nil {
			t.Fatal("driver retained authority after the host ticket expired")
		}
	}
	runner.relayUntil = now.Add(-time.Second)
	for _, driver := range []executionDriver{nativeRelayDriver(), nativeMultihopDriver()} {
		if _, err := runner.assignmentCheck(driver, ticket); err == nil {
			t.Fatal("expired peer credential accepted")
		}
	}
}

func TestExecutionDriverErrorAndPolicyContract(t *testing.T) {
	for _, driver := range []executionDriver{nativeRelayDriver(), nativeMultihopDriver()} {
		for _, code := range []string{"AUTHENTICATION_FAILED", "AUTHORIZATION_DENIED", "INVALID_CONFIG", "INTEGRITY_FAILURE", "UNSUPPORTED_CAPABILITY", "TARGET_REJECTED", "LEASE_EXPIRED"} {
			got, retry := driver.classify(fmt.Errorf("%s: details", code))
			if got != code || retry {
				t.Fatalf("%s lost terminal error %s", driver.descriptor.id, code)
			}
		}
		for _, code := range []string{"RESOURCE_LIMIT", "DOWNSTREAM_NOT_ACTIVE", "DOWNSTREAM_UNAVAILABLE", "TARGET_UNAVAILABLE"} {
			got, retry := driver.classify(errors.New(code))
			if got != code || !retry {
				t.Fatalf("%s lost retryable error %s", driver.descriptor.id, code)
			}
		}
		for message, want := range map[string]string{"listen tcp: bind: address in use": "PORT_IN_USE", "peer disconnected": "DOWNSTREAM_UNAVAILABLE"} {
			if got, retry := driver.classify(errors.New(message)); got != want || !retry {
				t.Fatalf("error fallback = %s/%v, want %s/true", got, retry, want)
			}
		}
	}
	if code, retry := nativeDirectDriver().classify(errors.New("existing Direct behavior")); code != "PORT_IN_USE" || !retry {
		t.Fatal("Direct error mapping changed during extraction")
	}
	host := executionHost{policy: adp3.Policy{MaxTcpConnectionsPerAssignment: 9000, MaxUdpSessionsPerAssignment: 7}}
	if relayMaximum(host, adp3.Assignment{Protocol: "tcp"}) != 4096 || relayMaximum(host, adp3.Assignment{Protocol: "udp"}) != 7 {
		t.Fatal("Relay/multihop policy limits changed")
	}
}

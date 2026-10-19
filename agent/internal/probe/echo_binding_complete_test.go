package probe

import (
	"bytes"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func TestEchoBindingCompleteNativeNumericAddressAndPolicyProjection(t *testing.T) {
	for _, tc := range []struct {
		name, host, address, network string
		port                         int
		cidrs                        []string
		parsed, allowed              bool
	}{
		{"ipv4", "127.0.0.1", "127.0.0.1:80", "udp4", 80, []string{"127.0.0.0/8"}, true, true},
		{"mapped", "::ffff:127.0.0.1", "127.0.0.1:80", "udp4", 80, []string{"127.0.0.0/8"}, true, true},
		{"ipv6", "2001:db8::1", "[2001:db8::1]:80", "udp6", 80, []string{"2001:db8::/32"}, true, true},
		{"upper-port", "8.8.8.8", "8.8.8.8:65535", "udp4", 65535, []string{"0.0.0.0/0"}, true, true},
		{"zero-port", "8.8.8.8", "", "", 0, nil, false, false},
		{"negative-port", "8.8.8.8", "", "", -1, nil, false, false},
		{"overflow-port", "8.8.8.8", "", "", 65536, nil, false, false},
		{"hostname", "example.org", "", "", 80, nil, false, false},
		{"zone", "fe80::1%eth0", "", "", 80, nil, false, false},
		{"bracketed", "[::1]", "", "", 80, nil, false, false},
		{"unspecified4", "0.0.0.0", "0.0.0.0:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"unspecified6", "::", "[::]:80", "udp6", 80, []string{"::/0"}, true, false},
		{"metadata4", "169.254.169.254", "169.254.169.254:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"metadata-mapped", "::ffff:169.254.169.254", "169.254.169.254:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"metadata-secondary", "100.100.100.200", "100.100.100.200:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"metadata6", "fd00:ec2::254", "[fd00:ec2::254]:80", "udp6", 80, []string{"::/0"}, true, false},
		{"link-local", "fe80::1", "[fe80::1]:80", "udp6", 80, []string{"::/0"}, true, false},
		{"multicast4", "224.0.0.1", "224.0.0.1:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"reserved4", "240.0.0.1", "240.0.0.1:80", "udp4", 80, []string{"0.0.0.0/0"}, true, false},
		{"multicast6", "ff02::1", "[ff02::1]:80", "udp6", 80, []string{"::/0"}, true, false},
		{"foreign-cidr", "8.8.8.8", "8.8.8.8:80", "udp4", 80, []string{"1.1.1.0/24"}, true, false},
		{"invalid-cidr", "8.8.8.8", "8.8.8.8:80", "udp4", 80, []string{"not-cidr"}, true, false},
		{"wrong-family-cidr", "8.8.8.8", "8.8.8.8:80", "udp4", 80, []string{"::/0"}, true, false},
		{"empty-policy", "8.8.8.8", "8.8.8.8:80", "udp4", 80, nil, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			destination, ok := probenative.ParseDestination(tc.host, tc.port)
			if ok != tc.parsed {
				t.Fatal("numeric parse/refusal changed", ok)
			}
			if !ok {
				return
			}
			if destination.Address() != tc.address || destination.Network(false) != "tcp" || destination.Network(true) != tc.network || destination.Allowed(tc.cidrs) != tc.allowed {
				t.Fatal("native numeric projection/policy", destination.Address(), destination.Network(true), destination.Allowed(tc.cidrs))
			}
		})
	}
}

func echoBindingCompleteRehash(t *testing.T, input *probeecho.Execution, contextChanged bool) {
	t.Helper()
	if contextChanged {
		var err error
		input.Context.ConfigDigest, err = contracts.ComputeDigest(input.Context.Config)
		if err != nil {
			t.Fatal(err)
		}
		s := input.Context.Selection
		input.Context.ContextDigest, err = contracts.ComputeDigest(map[string]any{"scopeId": s.ScopeId, "serviceId": s.ServiceId, "revision": s.Revision, "configRevision": s.ConfigRevision, "configDigest": s.ConfigDigest, "config": input.Context.Config})
		if err != nil {
			t.Fatal(err)
		}
		input.Invocation.Service = input.Context.Selection
	}
	// Some invalid vectors are refused by the closed public invocation parser
	// itself. Preserve that earlier refusal rather than inventing a valid digest.
	if digest, err := probeecho.InvocationDigest(input.Invocation); err == nil {
		input.Challenge.InvocationDigest = digest
	}
}

func TestEchoBindingCompleteProductValidationAndTypedTimeWindow(t *testing.T) {
	for _, measurement := range []string{probeecho.MeasurementTCP, probeecho.MeasurementUDP} {
		t.Run(measurement, func(t *testing.T) {
			permit, _ := testRequest(t)
			now := time.Now().Truncate(time.Millisecond)
			original, _ := echoExchangeCompleteInput(t, permit.Binding, measurement, now)
			if err := validateEchoExecution(original, permit.Binding, measurement, now); err != nil {
				t.Fatal("valid typed execution baseline", err)
			}
			for _, mode := range []string{"measurement", "version", "domain", "binding", "context-digest", "purpose", "trust", "selection", "negative-now", "future-context", "expired-context", "protocol", "invocation-digest", "nonce", "issued-format", "expires-format", "reversed-window", "long-window", "before-issued", "at-expiry", "before-service", "after-service"} {
				t.Run(mode, func(t *testing.T) {
					input := probeecho.CloneExecution(original)
					sample := now
					contextChanged := false
					switch mode {
					case "measurement":
						input.Invocation.Measurement = MeasurementEgress
					case "version":
						input.Invocation.ProbeVersion = 3
					case "domain":
						input.Invocation.Domain = "foreign-domain"
					case "binding":
						input.Invocation.Binding.BindingFence++
					case "context-digest":
						input.Context.ContextDigest = "invalid"
					case "purpose":
						input.Context.Config.Purpose = "other"
						contextChanged = true
					case "trust":
						input.Context.Config.Trust.Mode = "other"
						contextChanged = true
					case "selection":
						input.Invocation.Service.Revision++
					case "negative-now":
						sample = time.Unix(-1, 0)
					case "future-context":
						input.Context.Config.ValidFrom = uint64(now.Add(time.Second).UnixMilli())
						contextChanged = true
					case "expired-context":
						input.Context.Config.ValidUntil = uint64(now.UnixMilli())
						contextChanged = true
					case "protocol":
						input.Context.Config.Endpoint.Protocols = []string{"tcp"}
						if measurement == probeecho.MeasurementTCP {
							input.Context.Config.Endpoint.Protocols = []string{"udp"}
						}
						contextChanged = true
					case "invocation-digest":
						input.Challenge.InvocationDigest = "invalid"
					case "nonce":
						input.Challenge.Nonce = "invalid"
					case "issued-format":
						input.Invocation.IssuedAt = "invalid"
					case "expires-format":
						input.Invocation.ExpiresAt = "invalid"
					case "reversed-window":
						input.Invocation.ExpiresAt = input.Invocation.IssuedAt
					case "long-window":
						input.Invocation.ExpiresAt = now.Add(2 * time.Second).UTC().Format("2006-01-02T15:04:05.000Z")
					case "before-issued":
						sample = now.Add(-time.Second)
					case "at-expiry":
						sample = now.Add(time.Second)
					case "before-service":
						input.Context.Config.ValidFrom = uint64(now.Add(-100 * time.Millisecond).UnixMilli())
						contextChanged = true
					case "after-service":
						input.Context.Config.ValidUntil = uint64(now.Add(500 * time.Millisecond).UnixMilli())
						contextChanged = true
					}
					if mode != "invocation-digest" && mode != "nonce" {
						echoBindingCompleteRehash(t, &input, contextChanged)
					}
					if err := validateEchoExecution(input, permit.Binding, measurement, sample); err != ErrDenied {
						t.Fatal("product validation lost original denial", mode, err)
					}
				})
			}
			issued, expires, ok := probenative.ParseEchoTimes(original.Invocation)
			if !ok || !expires.After(issued) || expires.Sub(issued) != 1500*time.Millisecond {
				t.Fatal("typed native timestamp parses", issued, expires, ok)
			}
			for _, firstInvalid := range []bool{false, true} {
				invocation := original.Invocation
				if firstInvalid {
					invocation.IssuedAt = "invalid"
				} else {
					invocation.ExpiresAt = "invalid"
				}
				a, b, valid := probenative.ParseEchoTimes(invocation)
				if valid || firstInvalid && (!a.IsZero() || !b.Equal(expires)) || !firstInvalid && (!a.Equal(issued) || !b.IsZero()) {
					t.Fatal("one invalid timestamp suppressed the other parse", firstInvalid, a, b)
				}
			}
			if !probenative.EchoFrameValid(original.Invocation, original.Challenge) {
				t.Fatal("valid request frame refused")
			}
			bad := original.Challenge
			bad.Nonce = "invalid"
			if probenative.EchoFrameValid(original.Invocation, bad) {
				t.Fatal("invalid request frame accepted")
			}
		})
	}
}

func echoBindingCompleteCalls(t *testing.T, path, name string) (*ast.FuncDecl, []string) {
	t.Helper()
	file, err := parser.ParseFile(token.NewFileSet(), path, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != name {
			continue
		}
		calls := []string{}
		ast.Inspect(fn.Body, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			switch value := call.Fun.(type) {
			case *ast.Ident:
				calls = append(calls, value.Name)
			case *ast.SelectorExpr:
				calls = append(calls, value.Sel.Name)
			}
			return true
		})
		return fn, calls
	}
	t.Fatal("source owner function missing", path, name)
	return nil, nil
}
func echoBindingCompleteOrdered(t *testing.T, calls []string, want ...string) {
	t.Helper()
	next := 0
	for _, call := range calls {
		if next < len(want) && call == want[next] {
			next++
		}
	}
	if next != len(want) {
		t.Fatal("original owner call order changed", want, calls)
	}
}

func TestEchoBindingCompleteOwnerAndNativeSafetyPointSourceOrder(t *testing.T) {
	_, validation := echoBindingCompleteCalls(t, "echo.go", "validateEchoExecution")
	echoBindingCompleteOrdered(t, validation, "IsEcho", "ParseEchoContext", "InvocationDigest", "ParseEchoTimes", "EchoFrameValid")
	_, run := echoBindingCompleteCalls(t, "probe.go", "run")
	echoBindingCompleteOrdered(t, run, "validateEchoExecution", "resolveEcho", "sameEchoExecution", "ParseDestination", "sameMeasurement", "Allowed", "acquireWith", "dial", "exchangeEcho")
	fn, calls := echoBindingCompleteCalls(t, "native/echo.go", "ExchangeEcho")
	echoBindingCompleteOrdered(t, calls, "Deadline", "SetDeadline", "AfterFunc", "RequestFrame", "Write", "ReadFull", "VerifyEchoResponse", "VerifyProof")
	counts := map[string]int{}
	for _, call := range calls {
		counts[call]++
	}
	if counts["Write"] != 1 || counts["Read"] != 2 || counts["ReadFull"] != 1 || counts["Now"] != 5 || counts["Close"] != 1 || counts["Dial"] != 0 || counts["DialContext"] != 0 {
		t.Fatal("native exchange retried IO, moved native time or changed cancellation owner", counts)
	}
	safetyConditions := 0
	ast.Inspect(fn.Body, func(node ast.Node) bool {
		condition, ok := node.(*ast.IfStmt)
		if !ok {
			return true
		}
		var rendered bytes.Buffer
		if err := format.Node(&rendered, token.NewFileSet(), condition.Cond); err != nil {
			t.Fatal(err)
		}
		text := rendered.String()
		if strings.HasPrefix(text, "check() != nil || ctx.Err() != nil") {
			if !strings.HasPrefix(text, "check() != nil || ctx.Err() != nil || !time.Now().Before(deadline)") {
				t.Fatal("native check/context/Now evaluation order changed", text)
			}
			safetyConditions++
		}
		return true
	})
	if safetyConditions != 5 {
		t.Fatal("native exchange lost write/UDP/readfull/tail/proof safety points", safetyConditions)
	}
	// The same lower native codec is a marshal/decode composition, with no
	// scheduler injected into either stage or the two-time parser.
	_, parse := echoBindingCompleteCalls(t, "native/echo_format.go", "ParseEchoContext")
	if !reflect.DeepEqual(parse, []string{"EncodeEchoContext", "DecodeEchoContext"}) {
		t.Fatal("native context stages combined/reordered", parse)
	}
	_, times := echoBindingCompleteCalls(t, "native/echo_format.go", "ParseEchoTimes")
	if !reflect.DeepEqual(times, []string{"Parse", "Parse"}) {
		t.Fatal("native time parser no longer runs both parses", times)
	}
}

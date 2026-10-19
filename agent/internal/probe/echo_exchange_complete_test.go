package probe

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func echoExchangeCompleteInput(t *testing.T, binding Binding, measurement string, now time.Time) (probeecho.Execution, []byte) {
	t.Helper()
	key := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{13}, ed25519.SeedSize))
	config := probeecho.ServiceConfig{Version: 2, Purpose: "controlled-nonce-echo", Endpoint: probeecho.ServiceEndpoint{Address: "127.0.0.1", Port: 80, Protocols: []string{"tcp", "udp"}}, Trust: probeecho.ServiceTrust{Mode: "ed25519-echo-v1", PublicKey: base64.StdEncoding.EncodeToString(key.Public().(ed25519.PublicKey))}, ValidFrom: uint64(now.Add(-time.Minute).UnixMilli()), ValidUntil: uint64(now.Add(time.Minute).UnixMilli())}
	digest, err := contracts.ComputeDigest(config)
	if err != nil {
		t.Fatal(err)
	}
	selection := probeecho.Selection{ScopeId: "scope", ServiceId: "echo-service", Revision: 2, ConfigRevision: 1, ConfigDigest: digest}
	selection.ContextDigest, err = contracts.ComputeDigest(map[string]any{"scopeId": selection.ScopeId, "serviceId": selection.ServiceId, "revision": selection.Revision, "configRevision": selection.ConfigRevision, "configDigest": digest, "config": config})
	if err != nil {
		t.Fatal(err)
	}
	nonce := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{17}, 32))
	stamp := func(at time.Time) string { return at.UTC().Format("2006-01-02T15:04:05.000Z") }
	invocation := probeecho.Invocation{Domain: probeecho.InvocationDomain, ProbeVersion: 4, Measurement: measurement, PermitId: "echo-permit", Binding: probeecho.Binding{NodeId: binding.NodeID, BootId: binding.BootID, AssignmentId: binding.AssignmentID, ForwardId: binding.ForwardID, ConfigDigest: binding.ConfigDigest, SessionEpoch: binding.SessionEpoch, SnapshotGeneration: binding.SnapshotGeneration, ForwardRevision: binding.ForwardRevision, DeploymentGeneration: binding.DeploymentGeneration, BindingFence: binding.BindingFence, EgressPolicyRevision: binding.EgressPolicyRevision}, InstanceId: strings.Repeat("a", 64), InstanceGeneration: 1, TimeoutMs: 1000, IssuedAt: stamp(now.Add(-500 * time.Millisecond)), ExpiresAt: stamp(now.Add(time.Second)), Service: selection, Nonce: nonce}
	challenge := probeecho.Challenge{Nonce: nonce}
	challenge.InvocationDigest, err = probeecho.InvocationDigest(invocation)
	if err != nil {
		t.Fatal(err)
	}
	input := probeecho.Execution{Context: probeecho.ServiceContext{Selection: selection, Config: config}, Invocation: invocation, Challenge: challenge}
	frame, err := probeecho.RequestFrame(invocation, challenge)
	if err != nil {
		t.Fatal(err)
	}
	protocol := "tcp"
	if measurement == probeecho.MeasurementUDP {
		protocol = "udp"
	}
	request, err := probeecho.DecodeEchoRequest(frame, input.Context, now, protocol)
	if err != nil {
		t.Fatal(err)
	}
	response, err := probeecho.SignEchoResponse(*request, key)
	if err != nil {
		t.Fatal(err)
	}
	proof, err := probeecho.VerifyEchoResponse(response, input.Context, invocation, challenge)
	if err != nil || proof == nil || !probeecho.VerifyProof(input.Context, invocation, challenge, *proof) {
		t.Fatal("valid signed exchange fixture", err)
	}
	return input, response
}

type echoExchangeCompleteRead struct {
	data []byte
	err  error
}
type echoExchangeCompleteConn struct {
	net.Conn
	reads                 []echoExchangeCompleteRead
	readSizes             []int
	writes                [][]byte
	deadline              time.Time
	deadlineErr, writeErr error
	writeCount            int
	onWrite               func()
	closes                atomic.Int32
	closed                chan struct{}
}

func (c *echoExchangeCompleteConn) SetDeadline(value time.Time) error {
	c.deadline = value
	return c.deadlineErr
}
func (c *echoExchangeCompleteConn) Write(raw []byte) (int, error) {
	c.writes = append(c.writes, append([]byte(nil), raw...))
	if c.onWrite != nil {
		c.onWrite()
	}
	return c.writeCount, c.writeErr
}
func (c *echoExchangeCompleteConn) Read(raw []byte) (int, error) {
	c.readSizes = append(c.readSizes, len(raw))
	if len(c.reads) == 0 {
		return 0, io.EOF
	}
	value := c.reads[0]
	c.reads = c.reads[1:]
	if len(value.data) > len(raw) {
		panic("test read chunk exceeds production buffer")
	}
	return copy(raw, value.data), value.err
}
func (c *echoExchangeCompleteConn) Close() error {
	if c.closes.Add(1) == 1 && c.closed != nil {
		close(c.closed)
	}
	return nil
}

type echoExchangeCompleteContext struct {
	context.Context
	deadline        time.Time
	hasDeadline     bool
	errAt, errCalls int
}

func (c *echoExchangeCompleteContext) Deadline() (time.Time, bool) { return c.deadline, c.hasDeadline }
func (c *echoExchangeCompleteContext) Err() error {
	c.errCalls++
	if c.errAt > 0 && c.errCalls >= c.errAt {
		return context.Canceled
	}
	return nil
}

func TestEchoExchangeCompleteBoundedFramesProofAndEveryRefusalStage(t *testing.T) {
	for _, measurement := range []string{probeecho.MeasurementTCP, probeecho.MeasurementUDP} {
		modes := []string{"valid", "no-deadline", "initial-check", "deadline-error", "invalid-frame", "write-short", "write-error", "write-check", "write-context", "write-time", "read-check", "read-context", "read-error", "short-reply", "invalid-proof", "proof-check", "proof-context"}
		if measurement == probeecho.MeasurementTCP {
			modes = append(modes, "empty-eof", "tail-byte", "tail-byte-eof", "tail-no-eof", "tail-error", "tail-check", "tail-context", "full-read-error")
		} else {
			modes = append(modes, "oversize-datagram", "empty-datagram", "datagram-eof")
		}
		for _, mode := range modes {
			t.Run(measurement+"/"+mode, func(t *testing.T) {
				permit, _ := testRequest(t)
				input, response := echoExchangeCompleteInput(t, permit.Binding, measurement, time.Now().Truncate(time.Millisecond))
				ctx := &echoExchangeCompleteContext{Context: context.Background(), deadline: time.Now().Add(5 * time.Second), hasDeadline: true}
				conn := &echoExchangeCompleteConn{writeCount: 256}
				wantReads := []int{256, 239, 1}
				wantChecks := 5
				conn.reads = []echoExchangeCompleteRead{{response[:17], nil}, {response[17:], nil}, {nil, io.EOF}}
				if measurement == probeecho.MeasurementUDP {
					conn.reads = []echoExchangeCompleteRead{{response, nil}}
					wantReads = []int{257}
					wantChecks = 4
				}
				wantRequest, wantResponse := uint64(256), uint64(256)
				wantProof := true
				denied := mode != "valid" && mode != "short-reply" && mode != "empty-eof" && mode != "invalid-proof" && mode != "empty-datagram" && mode != "full-read-error"
				failCheck := 0
				failure := errors.New("scripted native IO failure")
				switch mode {
				case "no-deadline":
					ctx.hasDeadline = false
					wantChecks = 0
					wantReads = nil
				case "initial-check":
					failCheck = 1
					wantChecks = 1
					wantReads = nil
				case "deadline-error":
					conn.deadlineErr = failure
					wantChecks = 1
					wantReads = nil
				case "invalid-frame":
					input.Challenge.Nonce = "invalid"
					wantChecks = 1
					wantReads = nil
				case "write-short":
					conn.writeCount = 255
					wantChecks = 2
					wantReads = nil
				case "write-error":
					conn.writeErr = failure
					wantChecks = 2
					wantReads = nil
				case "write-check":
					failCheck = 2
					wantChecks = 2
					wantReads = nil
				case "write-context":
					ctx.errAt = 1
					wantChecks = 2
					wantReads = nil
				case "write-time":
					ctx.deadline = time.Now().Add(-time.Second)
					wantChecks = 2
					wantReads = nil
				case "read-check":
					failCheck = 3
					wantChecks = 3
					if measurement == probeecho.MeasurementTCP {
						wantReads = []int{256, 239}
					}
				case "read-context":
					ctx.errAt = 2
					wantChecks = 3
					if measurement == probeecho.MeasurementTCP {
						wantReads = []int{256, 239}
					}
				case "read-error":
					conn.reads = []echoExchangeCompleteRead{{response[:40], failure}}
					wantChecks = 3
					if measurement == probeecho.MeasurementTCP {
						wantReads = []int{256}
					}
				case "short-reply":
					conn.reads = []echoExchangeCompleteRead{{response[:40], nil}}
					wantResponse = 40
					wantProof = false
					wantChecks = 3
					if measurement == probeecho.MeasurementTCP {
						wantReads = []int{256, 216}
					}
				case "invalid-proof":
					bad := append([]byte(nil), response...)
					bad[200] ^= 1
					wantProof = false
					if measurement == probeecho.MeasurementUDP {
						conn.reads = []echoExchangeCompleteRead{{bad, nil}}
					} else {
						conn.reads = []echoExchangeCompleteRead{{bad, nil}, {nil, io.EOF}}
						wantReads = []int{256, 1}
					}
				case "proof-check":
					failCheck = wantChecks
				case "proof-context":
					ctx.errAt = wantChecks - 1
				case "empty-eof":
					conn.reads = []echoExchangeCompleteRead{{nil, io.EOF}}
					wantReads = []int{256}
					wantChecks = 3
					wantResponse = 0
					wantProof = false
				case "tail-byte":
					conn.reads[2] = echoExchangeCompleteRead{[]byte{1}, nil}
					wantChecks = 4
				case "tail-byte-eof":
					conn.reads[2] = echoExchangeCompleteRead{[]byte{1}, io.EOF}
					wantChecks = 4
				case "tail-no-eof":
					conn.reads[2] = echoExchangeCompleteRead{nil, nil}
					wantChecks = 4
				case "tail-error":
					conn.reads[2] = echoExchangeCompleteRead{nil, failure}
					wantChecks = 4
				case "tail-check":
					failCheck = 4
					wantChecks = 4
				case "tail-context":
					ctx.errAt = 3
					wantChecks = 4
				case "full-read-error":
					conn.reads = []echoExchangeCompleteRead{{response, failure}, {nil, io.EOF}}
					wantReads = []int{256, 1}
				case "oversize-datagram":
					conn.reads = []echoExchangeCompleteRead{{append(append([]byte(nil), response...), 0), nil}}
					wantChecks = 3
				case "empty-datagram":
					conn.reads = []echoExchangeCompleteRead{{nil, nil}}
					wantChecks = 3
					wantResponse = 0
					wantProof = false
				case "datagram-eof":
					conn.reads = []echoExchangeCompleteRead{{response, io.EOF}}
					wantChecks = 3
				}
				checks := 0
				check := func() error {
					checks++
					if checks == failCheck {
						return failure
					}
					return nil
				}
				proof, requestBytes, responseBytes, err := probenative.ExchangeEcho(ctx, conn, input, check)
				if denied {
					if err != probenative.ErrEchoDenied || proof != nil || requestBytes != 0 || responseBytes != 0 {
						t.Fatal("native denied identity/zero evidence", mode, proof, requestBytes, responseBytes, err)
					}
				} else if err != nil || requestBytes != wantRequest || responseBytes != wantResponse || (proof != nil) != wantProof {
					t.Fatal("native bounded exchange evidence", mode, proof, requestBytes, responseBytes, err)
				}
				if proof != nil && !probeecho.VerifyProof(input.Context, input.Invocation, input.Challenge, *proof) {
					t.Fatal("native exchange emitted unverified proof")
				}
				if checks != wantChecks || !reflect.DeepEqual(conn.readSizes, wantReads) || conn.closes.Load() != 0 {
					t.Fatal("exchange check/read count or caller Close ownership", mode, checks, conn.readSizes, conn.closes.Load())
				}
				wantWrites := 1
				if mode == "no-deadline" || mode == "initial-check" || mode == "deadline-error" || mode == "invalid-frame" {
					wantWrites = 0
				}
				if len(conn.writes) != wantWrites {
					t.Fatal("write retry or early write", mode, len(conn.writes))
				}
				if wantWrites == 1 {
					frame, frameErr := probeecho.RequestFrame(input.Invocation, input.Challenge)
					if frameErr != nil || len(conn.writes[0]) != 256 || !bytes.Equal(conn.writes[0], frame) {
						t.Fatal("request is not exact one 256-byte frame", frameErr)
					}
				}
				if mode != "no-deadline" && mode != "initial-check" && !conn.deadline.Equal(ctx.deadline) {
					t.Fatal("socket deadline differs from original context")
				}
			})
		}
	}
}

func TestEchoExchangeCompleteCancellationCloseAndLegacyDenialIdentity(t *testing.T) {
	permit, _ := testRequest(t)
	input, response := echoExchangeCompleteInput(t, permit.Binding, probeecho.MeasurementUDP, time.Now().Truncate(time.Millisecond))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn := &echoExchangeCompleteConn{writeCount: 256, closed: make(chan struct{}), reads: []echoExchangeCompleteRead{{response, nil}}}
	conn.onWrite = func() {
		cancel()
		select {
		case <-conn.closed:
		case <-time.After(time.Second):
			t.Fatal("native cancellation did not close original socket")
		}
	}
	if proof, tx, rx, err := exchangeEcho(ctx, conn, input, func() error { return nil }); err != ErrDenied || proof != nil || tx != 0 || rx != 0 || conn.closes.Load() != 1 || len(conn.writes) != 1 || len(conn.readSizes) != 0 {
		t.Fatal("legacy wrapper denial/cancellation socket ownership", err, tx, rx, conn.closes.Load())
	}
	// The wrapper maps only lower denials. A short datagram is unverified
	// evidence with original byte counts and no automatic Close.
	ctx2, stop := context.WithTimeout(context.Background(), time.Second)
	defer stop()
	short := &echoExchangeCompleteConn{writeCount: 256, reads: []echoExchangeCompleteRead{{response[:19], nil}}}
	if proof, tx, rx, err := exchangeEcho(ctx2, short, input, func() error { return nil }); err != nil || proof != nil || tx != 256 || rx != 19 || short.closes.Load() != 0 {
		t.Fatal("legacy wrapper changed short response evidence", err, tx, rx)
	}
	if errTLSBudget != observationtrust.ErrTLSBudget || echoFrameBytes != 256 || echoFrameBytes != probenative.EchoFrameBytes {
		t.Fatal("private native error/frame aliases changed")
	}
}

type echoExchangeCompleteDial struct {
	connection       net.Conn
	calls            int
	network, address string
}

func (d *echoExchangeCompleteDial) DialContext(_ context.Context, network, address string) (net.Conn, error) {
	d.calls++
	d.network, d.address = network, address
	return d.connection, nil
}

func TestEchoExchangeCompleteExecutorSingleAdmittedDialAndCallerClose(t *testing.T) {
	for _, measurement := range []string{probeecho.MeasurementTCP, probeecho.MeasurementUDP} {
		t.Run(measurement, func(t *testing.T) {
			permit, target := testRequest(t)
			now := time.Now().Truncate(time.Millisecond)
			input, response := echoExchangeCompleteInput(t, permit.Binding, measurement, now)
			permit.Measurement, permit.Echo = measurement, &input
			target.Measurement = measurement
			copy := probeecho.CloneExecution(input)
			target.Echo = &copy
			conn := &echoExchangeCompleteConn{writeCount: 256, reads: []echoExchangeCompleteRead{{response, nil}, {nil, io.EOF}}}
			if measurement == probeecho.MeasurementUDP {
				conn.reads = conn.reads[:1]
			}
			dial := &echoExchangeCompleteDial{connection: conn}
			resolves := 0
			unexpected := func(context.Context, Binding) (Target, error) {
				t.Fatal("Echo used non-echo resolver")
				return Target{}, ErrDenied
			}
			executor, err := NewWithEchoEffects(unexpected, unexpected, func(context.Context, Binding, observationtrust.Context) (Target, error) {
				t.Fatal("Echo used TLS resolver")
				return Target{}, ErrDenied
			}, func(_ context.Context, binding Binding, actual probeecho.Execution) (Target, error) {
				resolves++
				if binding != permit.Binding || !sameEchoExecution(actual, input) {
					t.Fatal("echo resolver lost detached invocation")
				}
				return target, nil
			}, Effects{Schedule: platformruntime.Schedule{}, Entropy: platformruntime.Local{}, Dial: dial})
			if err != nil {
				t.Fatal(err)
			}
			result, err := executor.Run(context.Background(), permit, time.Second)
			wantNetwork := "tcp"
			if measurement == probeecho.MeasurementUDP {
				wantNetwork = "udp4"
			}
			if err != nil || result.Status != "echoed" || result.Code != "nonce-echo-verified" || result.Echo == nil || result.RequestBytes != 256 || result.ResponseBytes != 256 || result.Point != "agent-local-direct-ingress" || !result.IndependentProbe || result.Binding != permit.Binding || resolves != 1 || dial.calls != 1 || dial.network != wantNetwork || dial.address != "127.0.0.1:80" || conn.closes.Load() != 1 || len(conn.writes) != 1 {
				t.Fatal("complete Executor echo result/dial/close", result, err, dial.calls, conn.closes.Load())
			}
			other, err := NewWithEcho(unexpected, unexpected, func(context.Context, Binding, observationtrust.Context) (Target, error) { return Target{}, ErrDenied }, executor.resolveEcho)
			if err != nil {
				t.Fatal(err)
			}
			other.dial = dial.DialContext
			if _, err := other.Run(context.Background(), permit, time.Second); err != ErrBusy || dial.calls != 1 {
				t.Fatal("new constructor reset single process Echo cooldown", err, dial.calls)
			}
		})
	}
}

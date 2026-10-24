package probe

import (
	"context"
	"net"
	"time"

	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

const echoFrameBytes = probenative.EchoFrameBytes

func sameEchoExecution(a, b probeecho.Execution) bool { return probenative.SameEchoExecution(a, b) }

func validateEchoExecution(input probeecho.Execution, binding Binding, measurement string, now time.Time) error {
	if !probeecho.IsEcho(measurement) || input.Invocation.Measurement != measurement || input.Invocation.ProbeVersion != 4 ||
		input.Invocation.Domain != "tunex.probe.echo.invocation.v1" {
		return ErrDenied
	}
	b := input.Invocation.Binding
	if (Binding{NodeID: b.NodeId, BootID: b.BootId, AssignmentID: b.AssignmentId, ForwardID: b.ForwardId,
		ConfigDigest: b.ConfigDigest, SessionEpoch: b.SessionEpoch, SnapshotGeneration: b.SnapshotGeneration,
		ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration, BindingFence: b.BindingFence,
		EgressPolicyRevision: b.EgressPolicyRevision}) != binding {
		return ErrDenied
	}
	parsed, err := probenative.ParseEchoContext(input.Context)
	if err != nil || parsed.Config.Version != 2 || parsed.Config.Purpose != "controlled-nonce-echo" ||
		parsed.Config.Trust.Mode != "ed25519-echo-v1" || input.Invocation.Service != input.Context.Selection ||
		now.UnixMilli() < 0 || uint64(now.UnixMilli()) < parsed.Config.ValidFrom || uint64(now.UnixMilli()) >= parsed.Config.ValidUntil {
		return ErrDenied
	}
	protocol := "tcp"
	if probeecho.IsUDP(measurement) {
		protocol = "udp"
	}
	declared := false
	for _, value := range parsed.Config.Endpoint.Protocols {
		if value == protocol {
			declared = true
		}
	}
	if !declared {
		return ErrDenied
	}
	digest, err := probeecho.InvocationDigest(input.Invocation)
	if err != nil || digest != input.Challenge.InvocationDigest || input.Challenge.Nonce != input.Invocation.Nonce {
		return ErrDenied
	}
	issued, expires, parsedTimes := probenative.ParseEchoTimes(input.Invocation)
	if !parsedTimes || !expires.After(issued) || expires.Sub(issued) > 2*time.Second ||
		now.Before(issued) || !now.Before(expires) || issued.UnixMilli() < int64(parsed.Config.ValidFrom) || expires.UnixMilli() > int64(parsed.Config.ValidUntil) {
		return ErrDenied
	}
	if !probenative.EchoFrameValid(input.Invocation, input.Challenge) {
		return ErrDenied
	}
	return nil
}

// Keep the original Probe-facing signature and denial identity.
func exchangeEcho(ctx context.Context, socket net.Conn, input probeecho.Execution, check func() error) (*probeecho.Proof, uint64, uint64, error) {
	proof, requestBytes, responseBytes, err := probenative.ExchangeEcho(ctx, socket, input, check)
	if err != nil {
		return nil, 0, 0, ErrDenied
	}
	return proof, requestBytes, responseBytes, nil
}

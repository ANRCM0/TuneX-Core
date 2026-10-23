package native

import (
	"context"
	"errors"
	"io"
	"net"
	"time"

	"github.com/tunex/vnext/agent/internal/probeecho"
)

const echoFrameBytes = EchoFrameBytes

var ErrEchoDenied = errors.New("PROBE_ECHO_DENIED: authority, deadline or bounded exchange unavailable")

// Exactly one request and one bounded reply use the original ingress. No retry, second dial or raw frame escapes.
func ExchangeEcho(ctx context.Context, socket net.Conn, input probeecho.Execution, check func() error) (*probeecho.Proof, uint64, uint64, error) {
	deadline, ok := ctx.Deadline()
	if !ok || check() != nil || socket.SetDeadline(deadline) != nil {
		return nil, 0, 0, ErrEchoDenied
	}
	stop := context.AfterFunc(ctx, func() { _ = socket.Close() })
	defer stop()
	frame, err := probeecho.RequestFrame(input.Invocation, input.Challenge)
	if err != nil || len(frame) != echoFrameBytes {
		return nil, 0, 0, ErrEchoDenied
	}
	n, err := socket.Write(frame)
	if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) || err != nil || n != echoFrameBytes {
		return nil, 0, 0, ErrEchoDenied
	}
	buffer := make([]byte, echoFrameBytes+1)
	var received int
	if probeecho.IsUDP(input.Invocation.Measurement) {
		received, err = socket.Read(buffer)
		if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) || err != nil {
			return nil, 0, 0, ErrEchoDenied
		}
		if received > echoFrameBytes {
			return nil, 0, 0, ErrEchoDenied
		}
	} else {
		received, err = io.ReadFull(socket, buffer[:echoFrameBytes])
		if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) {
			return nil, 0, 0, ErrEchoDenied
		}
		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil, echoFrameBytes, uint64(received), nil
			}
			return nil, 0, 0, ErrEchoDenied
		}
		// A complete frame is not success until the peer closes with no trailing application byte.
		var tail [1]byte
		extra, ended := socket.Read(tail[:])
		if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) || extra != 0 || !errors.Is(ended, io.EOF) {
			return nil, 0, 0, ErrEchoDenied
		}
	}
	if received != echoFrameBytes {
		return nil, echoFrameBytes, uint64(received), nil
	}
	proof, err := probeecho.VerifyEchoResponse(buffer[:received], input.Context, input.Invocation, input.Challenge)
	if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) {
		return nil, 0, 0, ErrEchoDenied
	}
	if err != nil || proof == nil {
		return nil, echoFrameBytes, echoFrameBytes, nil
	}
	if !probeecho.VerifyProof(input.Context, input.Invocation, input.Challenge, *proof) {
		return nil, echoFrameBytes, echoFrameBytes, nil
	}
	return proof, echoFrameBytes, echoFrameBytes, nil
}

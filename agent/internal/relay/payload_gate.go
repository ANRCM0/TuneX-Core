package relay

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"time"

	"github.com/tunex/vnext/agent/internal/executionhost"
)

func reservePayload(ctx context.Context, gate executionhost.PayloadGate, check func() error, size int, atomic bool) (int, error) {
	if err := check(); err != nil {
		return 0, err
	}
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return 0, err
		}
	}
	if gate == nil || size == 0 && !atomic {
		return size, nil
	}
	if ctx == nil {
		return 0, fmt.Errorf("INTEGRITY_FAILURE: metered payload context required")
	}
	permitted, err := gate.Acquire(ctx, size, atomic)
	if err != nil {
		return 0, err
	}
	if permitted < 0 || size > 0 && permitted == 0 || permitted > size || atomic && permitted != size {
		return 0, fmt.Errorf("INTEGRITY_FAILURE: invalid payload reservation")
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if err := check(); err != nil {
		return 0, err
	}
	return permitted, nil
}

type quotaWriter struct {
	out   io.Writer
	ctx   context.Context
	gate  executionhost.PayloadGate
	check func() error
}

func (writer quotaWriter) Write(data []byte) (int, error) {
	written := 0
	for len(data) > 0 {
		permitted, err := reservePayload(writer.ctx, writer.gate, writer.check, len(data), false)
		if err != nil {
			return written, err
		}
		n, err := writer.out.Write(data[:permitted])
		written += n
		if err != nil {
			return written, err
		}
		if n != permitted {
			return written, io.ErrShortWrite
		}
		data = data[n:]
	}
	return written, nil
}

// Transit passes decoded payload here once per outgoing direction. Control
// frames keep their original wire form and never acquire application credit.
func (e *Engine) writePayloadFrame(ctx context.Context, to *tls.Conn, kind byte, data []byte, maximum int) error {
	if kind != FrameTCP && kind != FrameUDP {
		if err := e.peerCheck(to); err != nil {
			return err
		}
		to.SetWriteDeadline(time.Now().Add(time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds) * time.Second))
		return WriteFrame(to, kind, data, e.assignment.Protocol, maximum)
	}
	for {
		permitted, err := reservePayload(ctx, e.payloadGate, func() error { return e.peerCheck(to) }, len(data), kind == FrameUDP)
		if err != nil {
			return err
		}
		to.SetWriteDeadline(time.Now().Add(time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds) * time.Second))
		if err := WriteFrame(to, kind, data[:permitted], e.assignment.Protocol, maximum); err != nil {
			return err
		}
		data = data[permitted:]
		if len(data) == 0 {
			return nil
		}
	}
}

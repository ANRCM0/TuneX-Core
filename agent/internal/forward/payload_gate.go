package forward

import (
	"context"
	"fmt"
	"io"

	"github.com/tunex/vnext/agent/internal/executionhost"
)

func reservePayload(ctx context.Context, gate executionhost.PayloadGate, allow func() error, size int, atomic bool) (int, error) {
	if err := allow(); err != nil {
		return 0, err
	}
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if gate == nil || size == 0 && !atomic {
		return size, nil
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
	if err := allow(); err != nil {
		return 0, err
	}
	return permitted, nil
}

type quotaWriter struct {
	target io.Writer
	ctx    context.Context
	gate   executionhost.PayloadGate
	allow  func() error
}

func (writer quotaWriter) Write(data []byte) (int, error) {
	written := 0
	for len(data) > 0 {
		permitted, err := reservePayload(writer.ctx, writer.gate, writer.allow, len(data), false)
		if err != nil {
			return written, err
		}
		n, err := writer.target.Write(data[:permitted])
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

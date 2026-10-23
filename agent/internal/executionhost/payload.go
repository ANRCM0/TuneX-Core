package executionhost

import "context"

// PayloadGate reserves durable payload before a native socket write. Atomic
// datagrams receive all requested bytes or an error; streams may receive less.
// The original Runner supplies and owns the gate; drivers cannot mint credit.
type PayloadGate interface {
	Acquire(context.Context, int, bool) (int, error)
}

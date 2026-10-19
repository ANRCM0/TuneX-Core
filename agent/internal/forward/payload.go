package forward

import (
	"io"

	"github.com/tunex/vnext/agent/internal/payloadstats"
)

type payloadWriter struct {
	target   io.Writer
	counters *payloadstats.Counters
	received bool
}

func (writer payloadWriter) Write(data []byte) (int, error) {
	n, err := writer.target.Write(data)
	if writer.received {
		writer.counters.Received(n)
	} else {
		writer.counters.Sent(n)
	}
	return n, err
}

func (stream *TCP) PayloadCounters() (payloadstats.Snapshot, bool) {
	return stream.payload.Snapshot()
}

func (stream *UDP) PayloadCounters() (payloadstats.Snapshot, bool) {
	return stream.payload.Snapshot()
}

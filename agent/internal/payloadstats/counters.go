package payloadstats

import (
	"crypto/rand"
	"encoding/hex"
	"sync/atomic"
)

type Counters struct {
	epoch       string
	sent        atomic.Uint64
	received    atomic.Uint64
	accepted    atomic.Uint64
	connected   atomic.Uint64
	closed      atomic.Uint64
	udpCreated  atomic.Uint64
	udpClosed   atomic.Uint64
	udpSent     atomic.Uint64
	udpReceived atomic.Uint64
	overflowed  atomic.Bool
}

// New may return nil: unavailable measurement identity must never stop forwarding.
func New() *Counters {
	var epoch [16]byte
	if _, err := rand.Read(epoch[:]); err != nil {
		return nil
	}
	return &Counters{epoch: hex.EncodeToString(epoch[:])}
}

func (counters *Counters) add(counter *atomic.Uint64, amount uint64) {
	if counters == nil || counter == nil {
		return
	}
	for {
		previous := counter.Load()
		next := previous + amount
		if amount > ^uint64(0)-previous {
			next = ^uint64(0)
			counters.overflowed.Store(true)
		}
		if counter.CompareAndSwap(previous, next) {
			return
		}
	}
}

func (counters *Counters) Sent(n int) {
	if counters != nil && n > 0 {
		counters.add(&counters.sent, uint64(n))
	}
}

func (counters *Counters) Received(n int) {
	if counters != nil && n > 0 {
		counters.add(&counters.received, uint64(n))
	}
}

func (counters *Counters) TCPAccept() {
	if counters != nil {
		counters.add(&counters.accepted, 1)
	}
}

func (counters *Counters) TCPConnect() {
	if counters != nil {
		counters.add(&counters.connected, 1)
	}
}

func (counters *Counters) TCPClose() {
	if counters != nil {
		counters.add(&counters.closed, 1)
	}
}

func (counters *Counters) UDPCreate() {
	if counters != nil {
		counters.add(&counters.udpCreated, 1)
	}
}

func (counters *Counters) UDPClose() {
	if counters != nil {
		counters.add(&counters.udpClosed, 1)
	}
}

// Callers supply only complete successfully forwarded datagrams, including empty ones.
func (counters *Counters) UDPSent(n int) {
	if counters != nil && n >= 0 {
		counters.add(&counters.udpSent, 1)
		counters.Sent(n)
	}
}

func (counters *Counters) UDPReceived(n int) {
	if counters != nil && n >= 0 {
		counters.add(&counters.udpReceived, 1)
		counters.Received(n)
	}
}

func (counters *Counters) Snapshot() (Snapshot, bool) {
	if counters == nil || counters.epoch == "" {
		return Snapshot{}, false
	}
	return Snapshot{
		Epoch:            counters.epoch,
		PayloadSentBytes: counters.sent.Load(), PayloadReceivedBytes: counters.received.Load(),
		TCPAccepted: counters.accepted.Load(), TCPConnected: counters.connected.Load(), TCPClosed: counters.closed.Load(),
		UDPAssociationsCreated: counters.udpCreated.Load(), UDPAssociationsClosed: counters.udpClosed.Load(),
		UDPDatagramsSent: counters.udpSent.Load(), UDPDatagramsReceived: counters.udpReceived.Load(),
		Overflowed: counters.overflowed.Load(),
	}, true
}

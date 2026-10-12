package securelink

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"sync"
	"testing"
	"time"
)

func frameWire(t *testing.T, frames ...Frame) []byte {
	t.Helper()
	var wire bytes.Buffer
	for _, frame := range frames {
		if err := WriteFrame(&wire, frame); err != nil {
			t.Fatal(err)
		}
	}
	return wire.Bytes()
}

func TestReceiveReaderReusesOnlyTCPData(t *testing.T) {
	isolatePayloadPool(t)
	frames := []Frame{
		{Type: TypeData, StreamID: 1, Payload: bytes.Repeat([]byte{0x11}, MaxData)},
		{Type: TypeDatagram, StreamID: 3, Sequence: 1, Payload: []byte("queued UDP")},
		{Type: TypePing, Payload: []byte("ping1234")},
		{Type: TypeData, StreamID: 1, Payload: []byte("short")},
	}
	wire := frameWire(t, frames...)
	var reader frameReader
	t.Cleanup(reader.release)
	input := bytes.NewReader(wire)
	first, err := reader.read(input)
	if err != nil || first.pooled {
		t.Fatalf("receive ownership: %v, pooled=%v", err, first.pooled)
	}
	udp, err := reader.read(input)
	if err != nil {
		t.Fatal(err)
	}
	ping, err := reader.read(input)
	if err != nil {
		t.Fatal(err)
	}
	last, err := reader.read(input)
	if err != nil || &first.Payload[0] != &last.Payload[0] {
		t.Fatalf("DATA scratch was not reused: %v", err)
	}
	if len(dataPayloadPool) != 0 {
		t.Fatal("active reader returned its scratch buffer")
	}
	reader.release()
	reader.release() // Owner cleanup is idempotent, never enqueues twice.
	if len(dataPayloadPool) != 1 || !bytes.Equal(first.Payload, make([]byte, MaxData)) {
		t.Fatal("receive scratch was not returned once and erased in full")
	}
	if !bytes.Equal(udp.Payload, frames[1].Payload) || !bytes.Equal(ping.Payload, frames[2].Payload) {
		t.Fatal("queued datagram or PONG payload depended on receive scratch")
	}
	// Public parser callers continue to own every returned DATA payload.
	input = bytes.NewReader(wire)
	owned, err := ReadFrame(input)
	if err != nil {
		t.Fatal(err)
	}
	for range frames[1:] {
		if _, err := ReadFrame(input); err != nil {
			t.Fatal(err)
		}
	}
	if !bytes.Equal(owned.Payload, frames[0].Payload) {
		t.Fatal("public ReadFrame changed a previously returned payload")
	}
}

func TestReceiveScratchDoesNotEscapeIntoStreamQueues(t *testing.T) {
	isolatePayloadPool(t)
	s, reset := pausedSession(t)
	sibling := newStream(s, 3, reset.request)
	sibling.accepted = true
	udp := newStream(s, 5, OpenRequest{ForwardID: 2, Revision: 1, Protocol: "udp"})
	udp.accepted = true
	s.streams[3], s.streams[5], s.nextID = sibling, udp, 7
	beforeReset := bytes.Repeat([]byte{0x11}, MaxData)
	siblingPayload := bytes.Repeat([]byte{0x33}, MaxData)
	frames := []Frame{
		{Type: TypeData, StreamID: 1, Payload: beforeReset},
		{Type: TypeReset, StreamID: 1, Payload: []byte("tst_stream_closed")},
		{Type: TypeData, StreamID: 1, Payload: bytes.Repeat([]byte{0x22}, MaxData)},
		{Type: TypeDatagram, StreamID: 5, Sequence: 1, Payload: []byte("first UDP")},
		{Type: TypePing, Payload: []byte("ping1234")},
		{Type: TypeData, StreamID: 3, Payload: siblingPayload},
		{Type: TypeDatagram, StreamID: 5, Sequence: 2, Payload: []byte("last UDP")},
	}
	var reader frameReader
	t.Cleanup(reader.release)
	input := bytes.NewReader(frameWire(t, frames...))
	for range frames {
		frame, err := reader.read(input)
		if err != nil {
			t.Fatal(err)
		}
		s.mu.Lock()
		err = s.handleLocked(frame)
		s.mu.Unlock()
		if err != nil {
			t.Fatal(err)
		}
	}
	reader.release()
	if !bytes.Equal(reset.buffer.Bytes(), beforeReset) || !bytes.Equal(sibling.buffer.Bytes(), siblingPayload) {
		t.Fatal("scratch overwrite/erasure corrupted received TCP bytes or RESET semantics")
	}
	if len(udp.datagrams) != 2 || string(udp.datagrams[0]) != "first UDP" || string(udp.datagrams[1]) != "last UDP" {
		t.Fatal("UDP queue ownership or message boundaries changed")
	}
	if s.rxConn != ConnectionWindow-2*MaxData-int64(len("first UDPlast UDP")) {
		t.Fatal("discarded late DATA changed receive accounting")
	}
	if s.control.len() != 2 || s.control.at(0).frame.Type != TypeWindowUpdate ||
		binary.BigEndian.Uint32(s.control.at(0).frame.Payload) != MaxData ||
		s.control.at(1).frame.Type != TypePong || string(s.control.at(1).frame.Payload) != "ping1234" {
		t.Fatal("late DATA credit or queued PONG was corrupted")
	}
	got := make([]byte, MaxData)
	if n, err := reset.Read(got); n != MaxData || err != nil || !bytes.Equal(got, beforeReset) {
		t.Fatalf("buffered bytes before RESET: n=%d err=%v", n, err)
	}
	if _, err := reset.Read(got); !errors.Is(err, ErrClosed) {
		t.Fatalf("RESET terminal error: %v", err)
	}
}

type receiveWireConn struct {
	net.Conn
	reader *bytes.Reader
}

func (c *receiveWireConn) Read(p []byte) (int, error) { return c.reader.Read(p) }

func TestReceiveScratchReturnedOnReadAndProtocolFailures(t *testing.T) {
	valid := frameWire(t, Frame{Type: TypeData, StreamID: 1, Payload: []byte("secret")})
	oversize := append([]byte(nil), valid[:HeaderSize]...)
	binary.BigEndian.PutUint32(oversize[12:16], MaxData+1)
	invalidID := append([]byte(nil), valid...)
	binary.BigEndian.PutUint64(invalidID[4:12], 0)
	flags := append([]byte(nil), valid[:HeaderSize]...)
	flags[1] = 1
	for _, test := range []struct {
		name     string
		wire     []byte
		want     error
		retained int
		protocol string
	}{
		{"header_truncated", valid[:HeaderSize-1], io.ErrUnexpectedEOF, 0, "tcp"},
		{"oversize", oversize, ErrProtocol, 0, "tcp"},
		{"flags", flags, ErrProtocol, 0, "tcp"},
		{"payload_truncated", valid[:HeaderSize+2], io.ErrUnexpectedEOF, 1, "tcp"},
		{"invalid_identity", invalidID, ErrProtocol, 1, "tcp"},
		{"wrong_stream_protocol", valid, ErrProtocol, 1, "udp"},
		{"receive_window", valid, ErrProtocol, 1, "tcp"},
		{"ping_only", frameWire(t, Frame{Type: TypePing, Payload: []byte("ping1234")}), io.EOF, 0, "tcp"},
		{"udp_only", frameWire(t, Frame{Type: TypeDatagram, StreamID: 1, Sequence: 1, Payload: []byte("UDP")}), io.EOF, 0, "udp"},
		{"eof_after_data", valid, io.EOF, 1, "tcp"},
	} {
		t.Run(test.name, func(t *testing.T) {
			isolatePayloadPool(t)
			s, st := pausedSession(t)
			st.request.Protocol = test.protocol
			if test.name == "receive_window" {
				st.rx = 1
			}
			s.conn = &receiveWireConn{Conn: s.conn, reader: bytes.NewReader(test.wire)}
			s.readLoop()
			if !errors.Is(s.Err(), test.want) || len(dataPayloadPool) != test.retained {
				t.Fatalf("read failure: err=%v buffers=%d", s.Err(), len(dataPayloadPool))
			}
			if test.retained != 0 && !bytes.Equal(acquireDataPayload(MaxData), make([]byte, MaxData)) {
				t.Fatal("failed receive left partial plaintext in cache")
			}
		})
	}
}

type heldReceiveConn struct {
	receiveWireConn
	started chan struct{}
	resume  chan struct{}
	payload []byte
	reads   int
}

func (c *heldReceiveConn) Read(p []byte) (int, error) {
	c.reads++
	n, err := c.receiveWireConn.Read(p)
	if c.reads == 2 {
		c.payload = p
		close(c.started)
		<-c.resume // Deliberately keep I/O active even after the carrier closes.
	}
	return n, err
}

func TestReceiveScratchStaysOwnedUntilReaderExits(t *testing.T) {
	isolatePayloadPool(t)
	s, _ := pausedSession(t)
	c := &heldReceiveConn{receiveWireConn: receiveWireConn{Conn: s.conn,
		reader: bytes.NewReader(frameWire(t, Frame{Type: TypeData, StreamID: 1,
			Payload: bytes.Repeat([]byte{0x55}, MaxData)}))},
		started: make(chan struct{}), resume: make(chan struct{})}
	s.conn = c
	s.workers.Add(1)
	go func() { defer s.workers.Done(); s.readLoop() }()
	var once sync.Once
	resume := func() { once.Do(func() { close(c.resume) }) }
	t.Cleanup(func() { resume(); _ = s.Close() })
	select {
	case <-c.started:
	case <-time.After(3 * time.Second):
		t.Fatal("reader did not reach payload")
	}
	s.fail(ErrClosed)
	if len(dataPayloadPool) != 0 {
		t.Fatal("carrier failure returned scratch still referenced by I/O")
	}
	other := acquireDataPayload(MaxData)
	for i := range other {
		other[i] = 0x66
	}
	if !bytes.Equal(c.payload, bytes.Repeat([]byte{0x55}, MaxData)) {
		t.Fatal("another Link overwrote the active receive payload")
	}
	resume()
	_ = s.Close()
	if len(dataPayloadPool) != 1 || !bytes.Equal(acquireDataPayload(MaxData), make([]byte, MaxData)) {
		t.Fatal("joined reader did not return and erase its scratch once")
	}
}

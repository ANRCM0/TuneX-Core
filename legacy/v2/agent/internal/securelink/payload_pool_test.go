package securelink

import (
	"bytes"
	"context"
	"errors"
	"net"
	"sync"
	"testing"
	"time"
)

// These tests run serially, with all fixture workers joined before restoring
// the process cache. An isolated empty cache makes premature/double returns
// observable without depending on scheduling or the previous test's traffic.
func isolatePayloadPool(t *testing.T) {
	t.Helper()
	previous := dataPayloadPool
	dataPayloadPool = make(chan []byte, pooledDataPayloads)
	t.Cleanup(func() { dataPayloadPool = previous })
}

func pooledFrame(id uint64, value byte) Frame {
	payload := acquireDataPayload(MaxData)
	for i := range payload {
		payload[i] = value
	}
	return Frame{Type: TypeData, StreamID: id, Payload: payload, pooled: true}
}

func TestDataPayloadPoolBoundAndPlaintextErasure(t *testing.T) {
	isolatePayloadPool(t)
	frames := make([]Frame, pooledDataPayloads+8)
	for i := range frames {
		frames[i] = pooledFrame(1, 0x7f)
		// A short final frame must also erase the old plaintext in its tail.
		frames[i].Payload = frames[i].Payload[:1]
	}
	for _, frame := range frames {
		releaseFramePayload(frame)
	}
	if len(dataPayloadPool) != pooledDataPayloads {
		t.Fatalf("retained %d buffers, want bounded %d", len(dataPayloadPool), pooledDataPayloads)
	}
	for i := 0; i < pooledDataPayloads; i++ {
		payload := acquireDataPayload(MaxData)
		if !bytes.Equal(payload, make([]byte, MaxData)) {
			t.Fatal("reused buffer contains another stream's plaintext")
		}
	}
}

func pausedSession(t *testing.T) (*Session, *Stream) {
	t.Helper()
	a, b := net.Pipe()
	s := &Session{conn: a, streams: make(map[uint64]*Stream),
		txConn: ConnectionWindow, rxConn: ConnectionWindow, nextID: 3,
		wake: make(chan struct{}, 1), done: make(chan struct{}),
		data: make(map[uint64]outbound)}
	st := newStream(s, 1, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "tcp"})
	st.accepted = true
	s.streams[1] = st
	t.Cleanup(func() { s.fail(ErrClosed); _ = b.Close() })
	return s, st
}

func awaitQueuedPayload(t *testing.T, s *Session) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		s.mu.Lock()
		_, queued := s.data[1]
		var changed <-chan struct{}
		if !queued {
			changed = s.subscribeLocked()
		}
		s.mu.Unlock()
		if queued {
			return
		}
		if err := wait(context.Background(), changed, s.done, deadline); err != nil {
			t.Fatalf("waiting for queued frame: %v", err)
		}
	}
}

func awaitSendResult(t *testing.T, result <-chan error, want error) {
	t.Helper()
	select {
	case err := <-result:
		if !errors.Is(err, want) {
			t.Fatalf("send returned %v, want %v", err, want)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("send did not complete")
	}
}

func TestPooledPayloadReturnedBeforeEnqueueFailure(t *testing.T) {
	for _, reason := range []string{"session_closed", "stream_removed", "queue_full"} {
		t.Run(reason, func(t *testing.T) {
			isolatePayloadPool(t)
			s, _ := pausedSession(t)
			frame := pooledFrame(1, 0x33)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			want := ErrClosed
			switch reason {
			case "session_closed":
				s.fail(ErrClosed)
			case "stream_removed":
				delete(s.streams, 1)
			case "queue_full":
				s.data[1] = outbound{frame: Frame{Type: TypeData, StreamID: 1, Payload: []byte("occupied")}}
				cancel()
				want = context.Canceled
			}
			if err := s.send(ctx, frame, time.Time{}); !errors.Is(err, want) {
				t.Fatalf("send: %v, want %v", err, want)
			}
			if len(dataPayloadPool) != 1 {
				t.Fatalf("unqueued frame was not returned exactly once: %d", len(dataPayloadPool))
			}
		})
	}
}

func TestQueuedPooledPayloadReturnedOnResetCloseAndFailure(t *testing.T) {
	for _, reason := range []string{"local_close", "remote_reset", "carrier_failure"} {
		t.Run(reason, func(t *testing.T) {
			isolatePayloadPool(t)
			s, st := pausedSession(t)
			frame := pooledFrame(1, 0x44)
			result := make(chan error, 1)
			go func() { result <- s.send(context.Background(), frame, time.Time{}) }()
			awaitQueuedPayload(t, s)
			if len(dataPayloadPool) != 0 {
				t.Fatal("queued buffer became reusable before cancellation")
			}
			switch reason {
			case "local_close":
				_ = st.Close()
			case "remote_reset":
				s.mu.Lock()
				err := s.handleLocked(Frame{Type: TypeReset, StreamID: 1, Payload: []byte("tst_stream_closed")})
				s.mu.Unlock()
				if err != nil {
					t.Fatal(err)
				}
			case "carrier_failure":
				s.fail(ErrClosed)
			}
			awaitSendResult(t, result, ErrClosed)
			if len(dataPayloadPool) != 1 {
				t.Fatalf("discarded frame returned %d times, want 1", len(dataPayloadPool))
			}
			_ = st.Close()
			s.fail(ErrClosed)
			if len(dataPayloadPool) != 1 {
				t.Fatal("repeated teardown returned the same buffer twice")
			}
		})
	}
}

func TestQueuedPooledPayloadDeadlineLeavesReclamationToQueue(t *testing.T) {
	isolatePayloadPool(t)
	s, st := pausedSession(t)
	frame := pooledFrame(1, 0x77)
	if err := s.send(context.Background(), frame, time.Now().Add(-time.Second)); err == nil {
		t.Fatal("expired write deadline succeeded")
	}
	if len(dataPayloadPool) != 0 {
		t.Fatal("timed-out send returned a payload still owned by the queue")
	}
	_ = st.Close()
	if len(dataPayloadPool) != 1 {
		t.Fatal("queue cancellation failed to return the timed-out payload")
	}
}

type heldPayloadConn struct {
	net.Conn
	started chan struct{}
	resume  chan struct{}
	written chan []byte
}

func (c *heldPayloadConn) Write(p []byte) (int, error) {
	if len(p) == HeaderSize {
		return len(p), nil
	}
	close(c.started)
	<-c.resume
	c.written <- append([]byte(nil), p...)
	return len(p), nil
}

func TestPooledPayloadStaysOwnedByWriterAfterSendCancellation(t *testing.T) {
	isolatePayloadPool(t)
	s, _ := pausedSession(t)
	c := &heldPayloadConn{Conn: s.conn, started: make(chan struct{}),
		resume: make(chan struct{}), written: make(chan []byte, 1)}
	s.conn = c
	writerDone := make(chan struct{})
	go func() { defer close(writerDone); s.writeLoop() }()
	var resumeOnce sync.Once
	resume := func() { resumeOnce.Do(func() { close(c.resume) }) }
	t.Cleanup(func() {
		resume()
		s.fail(ErrClosed)
		select {
		case <-writerDone:
		case <-time.After(3 * time.Second):
			t.Error("writer did not stop")
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	frame := pooledFrame(1, 0x55)
	result := make(chan error, 1)
	go func() { result <- s.send(ctx, frame, time.Time{}) }()
	select {
	case <-c.started:
	case <-time.After(3 * time.Second):
		t.Fatal("writer did not reach payload")
	}
	cancel()
	awaitSendResult(t, result, context.Canceled)
	s.fail(ErrClosed)
	if len(dataPayloadPool) != 0 {
		t.Fatal("in-flight payload was returned while carrier I/O still referenced it")
	}
	other := acquireDataPayload(MaxData)
	for i := range other {
		other[i] = 0x66
	}
	if !bytes.Equal(frame.Payload, bytes.Repeat([]byte{0x55}, MaxData)) {
		t.Fatal("new stream overwrote the in-flight payload")
	}
	resume()
	select {
	case <-writerDone:
	case <-time.After(3 * time.Second):
		t.Fatal("writer did not finish after release")
	}
	if payload := <-c.written; !bytes.Equal(payload, bytes.Repeat([]byte{0x55}, MaxData)) {
		t.Fatal("carrier received a corrupted payload")
	}
	if len(dataPayloadPool) != 1 {
		t.Fatalf("completed writer returned %d buffers, want 1", len(dataPayloadPool))
	}
}

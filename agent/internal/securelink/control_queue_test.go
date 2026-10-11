package securelink

import (
	"context"
	"encoding/binary"
	"errors"
	"reflect"
	"sync"
	"testing"
	"time"
)

func controlRequest(sequence uint64) outbound {
	payload := make([]byte, 8)
	binary.BigEndian.PutUint64(payload, sequence)
	return outbound{frame: Frame{Type: TypePong, Payload: payload}, result: make(chan error, 1)}
}

func TestControlQueueWrappedGrowthFIFOAndLimit(t *testing.T) {
	var q controlQueue
	if q.entries != nil {
		t.Fatal("unused queue allocated storage")
	}
	for i := uint64(0); i < 8; i++ {
		if err := q.push(controlRequest(i)); err != nil {
			t.Fatal(err)
		}
	}
	for i := uint64(0); i < 5; i++ {
		request, ok := q.pop()
		if !ok || binary.BigEndian.Uint64(request.frame.Payload) != i {
			t.Fatal("initial FIFO order changed")
		}
	}
	// Fill a wrapped ring, then grow it with a nonzero head to the hard limit.
	for i := uint64(8); i < controlQueueLimit+5; i++ {
		if err := q.push(controlRequest(i)); err != nil {
			t.Fatal(err)
		}
	}
	if q.len() != controlQueueLimit || len(q.entries) > controlQueueLimit {
		t.Fatalf("queue exceeded its bound: size=%d storage=%d", q.len(), len(q.entries))
	}
	if err := q.push(controlRequest(9999)); !errors.Is(err, ErrLimit) {
		t.Fatalf("full queue admitted another request: %v", err)
	}
	for i := uint64(5); i < controlQueueLimit+5; i++ {
		request, ok := q.pop()
		if !ok || request.result == nil || binary.BigEndian.Uint64(request.frame.Payload) != i {
			t.Fatalf("wrapped/grown FIFO lost request %d", i)
		}
	}
	if _, ok := q.pop(); ok {
		t.Fatal("rejected request escaped into the drained queue")
	}
	for _, entry := range q.entries {
		if !reflect.DeepEqual(entry, outbound{}) {
			t.Fatal("drained storage retained a payload or completion reference")
		}
	}
	if err := q.push(controlRequest(10000)); err != nil {
		t.Fatal("drained queue could not be reused")
	}
	request, _ := q.pop()
	if binary.BigEndian.Uint64(request.frame.Payload) != 10000 {
		t.Fatal("reused queue returned stale data")
	}
}

func TestWarmControlQueueDoesNotAllocateOrErasePoppedPayload(t *testing.T) {
	var q controlQueue
	request := controlRequest(123)
	allocs := testing.AllocsPerRun(1000, func() {
		if err := q.push(request); err != nil {
			t.Fatal(err)
		}
		popped, ok := q.pop()
		if !ok || popped.result != request.result || binary.BigEndian.Uint64(popped.frame.Payload) != 123 {
			t.Fatal("slot reuse corrupted a writer-owned request")
		}
	})
	if allocs != 0 {
		t.Fatalf("warmed enqueue/dequeue allocated %v objects", allocs)
	}
}

func TestControlQueueCoalescesWrappedAndFullWindowUpdates(t *testing.T) {
	s, _ := pausedSession(t)
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := uint64(0); i < 8; i++ {
		if err := s.queueControlLocked(controlRequest(i).frame); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 5; i++ {
		s.control.pop()
	}
	for _, frame := range []Frame{creditFrame(1, 1), creditFrame(0, 2), creditFrame(1, 3)} {
		if err := s.queueControlLocked(frame); err != nil {
			t.Fatal(err)
		}
	}
	if s.control.len() != 5 || binary.BigEndian.Uint32(s.control.at(3).frame.Payload) != 4 ||
		binary.BigEndian.Uint32(s.control.at(4).frame.Payload) != 2 {
		t.Fatal("wrapped coalescing merged the wrong stream or lost Link credit")
	}
	if err := s.queueControlLocked(creditFrame(1, ConnectionWindow)); !errors.Is(err, ErrProtocol) {
		t.Fatalf("coalescing bypassed the existing credit ceiling: %v", err)
	}
	if binary.BigEndian.Uint32(s.control.at(3).frame.Payload) != 4 {
		t.Fatal("rejected credit changed the queued update")
	}
	for s.control.len() < controlQueueLimit {
		if err := s.queueControlLocked(controlRequest(99).frame); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.queueControlLocked(creditFrame(0, 5)); err != nil {
		t.Fatalf("full queue could not merge existing Link credit: %v", err)
	}
	if s.control.len() != controlQueueLimit || binary.BigEndian.Uint32(s.control.at(4).frame.Payload) != 7 {
		t.Fatal("coalescing consumed a slot or changed the wrong update")
	}
	if err := s.queueControlLocked(controlRequest(100).frame); !errors.Is(err, ErrLimit) {
		t.Fatalf("full control queue lost its quota: %v", err)
	}
}

func TestControlQueuePreservesPriorityAndFairDataCursor(t *testing.T) {
	s, _ := pausedSession(t)
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := uint64(0); i < 34; i++ {
		if err := s.control.push(controlRequest(i)); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []uint64{1, 3, 5} {
		s.data[id] = outbound{frame: Frame{Type: TypeData, StreamID: id, Payload: []byte("data")}}
	}
	sequence := uint64(0)
	for _, id := range []uint64{1, 3, 5, 1} {
		for i := 0; i < 8; i++ {
			request, ok := s.popLocked()
			if !ok || request.frame.Type != TypePong || binary.BigEndian.Uint64(request.frame.Payload) != sequence {
				t.Fatalf("control priority/FIFO changed at %d", sequence)
			}
			sequence++
		}
		request, ok := s.popLocked()
		if !ok || request.frame.Type != TypeData || request.frame.StreamID != id {
			t.Fatalf("data was starved or skipped cursor %d: %+v", id, request)
		}
		s.data[id] = request
	}
}

func TestFullControlQueueOpenAndSendBackpressure(t *testing.T) {
	s, _ := pausedSession(t)
	for i := 0; i < controlQueueLimit; i++ {
		if err := s.control.push(controlRequest(uint64(i))); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Open(context.Background(), OpenRequest{ForwardID: 2, Revision: 1, Protocol: "tcp"}); !errors.Is(err, ErrLimit) {
		t.Fatalf("OPEN bypassed the control quota: %v", err)
	}
	if s.nextID != 3 || len(s.streams) != 1 {
		t.Fatal("rejected OPEN consumed an ID or left a stream")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() { result <- s.send(ctx, Frame{Type: TypeFIN, StreamID: 1}, time.Time{}) }()
	awaitNotification(t, s, nil)
	cancel()
	awaitSendResult(t, result, context.Canceled)
	if s.control.len() != controlQueueLimit {
		t.Fatal("canceled sender bypassed backpressure")
	}
	// A real waiting sender must wake when the writer frees a ring slot.
	retry, stop := context.WithTimeout(context.Background(), 3*time.Second)
	defer stop()
	observed := &observedWaitContext{Context: retry, waiting: make(chan struct{})}
	go func() { result <- s.send(observed, Frame{Type: TypeFIN, StreamID: 1}, time.Time{}) }()
	select {
	case <-observed.waiting:
	case <-retry.Done():
		t.Fatal("sender did not wait for control queue space")
	}
	s.mu.Lock()
	s.popLocked()
	s.signalLocked()
	s.mu.Unlock()
	end := time.Now().Add(3 * time.Second)
	for {
		s.mu.Lock()
		queued := s.control.len() == controlQueueLimit && s.control.at(controlQueueLimit-1).frame.Type == TypeFIN
		var changed <-chan struct{}
		if !queued {
			changed = s.subscribeLocked()
		}
		s.mu.Unlock()
		if queued {
			break
		}
		if err := wait(retry, changed, s.done, end); err != nil {
			t.Fatal("freed slot did not admit the waiting sender", err)
		}
	}
	s.mu.Lock()
	var sent outbound
	for s.control.len() > 0 {
		sent, _ = s.popLocked()
	}
	s.signalLocked()
	s.mu.Unlock()
	if sent.frame.Type != TypeFIN || sent.result == nil {
		t.Fatal("pending control request was lost or reordered")
	}
	sent.result <- nil
	awaitSendResult(t, result, nil)
}

func TestControlSlotReuseAndFailureLeavePayloadOwnedByWriter(t *testing.T) {
	s, _ := pausedSession(t)
	c := &heldPayloadConn{Conn: s.conn, started: make(chan struct{}),
		resume: make(chan struct{}), written: make(chan []byte, 1)}
	s.conn = c
	writerDone := make(chan struct{})
	go func() { defer close(writerDone); s.writeLoop() }()
	var resumeOnce sync.Once
	resume := func() { resumeOnce.Do(func() { close(c.resume) }) }
	t.Cleanup(func() {
		s.fail(ErrClosed)
		resume()
		select {
		case <-writerDone:
		case <-time.After(3 * time.Second):
			t.Error("held control writer did not exit")
		}
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	frame := Frame{Type: TypePing, Payload: []byte("oldtokn!")}
	go func() { result <- s.send(ctx, frame, time.Time{}) }()
	select {
	case <-c.started:
	case <-time.After(3 * time.Second):
		t.Fatal("writer did not reach control payload")
	}
	cancel()
	awaitSendResult(t, result, context.Canceled)
	s.mu.Lock()
	// Reuse the exact slot while the first request is still in carrier I/O.
	err := s.queueControlLocked(Frame{Type: TypePing, Payload: []byte("newtokn!")})
	entries := s.control.entries
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	s.fail(ErrClosed)
	if s.control.len() != 0 || s.control.entries != nil {
		t.Fatal("failed session retained control storage")
	}
	for _, entry := range entries {
		if !reflect.DeepEqual(entry, outbound{}) {
			t.Fatal("session failure retained queued payload/completion references")
		}
	}
	if string(frame.Payload) != "oldtokn!" {
		t.Fatal("slot reuse or failure erased the active writer's payload")
	}
	resume()
	select {
	case <-writerDone:
	case <-time.After(3 * time.Second):
		t.Fatal("writer did not finish after release")
	}
	if payload := <-c.written; string(payload) != "oldtokn!" {
		t.Fatalf("carrier received a overwritten control payload: %q", payload)
	}
}

package securelink

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// Observe registration by a blocked operation, rather than assuming the
// goroutine has reached its wait after a fixed sleep.
func awaitNotification(t *testing.T, s *Session, prior <-chan struct{}) <-chan struct{} {
	t.Helper()
	end := time.Now().Add(3 * time.Second)
	for time.Now().Before(end) {
		s.mu.Lock()
		changed := s.changed
		s.mu.Unlock()
		if changed != nil && changed != prior {
			return changed
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("operation did not register for a state change")
	return nil
}

func TestSessionNotificationBroadcastBeforeWait(t *testing.T) {
	s, _ := pausedSession(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	const waiters = 32
	ready := make(chan struct{})
	results := make(chan error, waiters)
	s.mu.Lock()
	for i := 0; i < waiters; i++ {
		changed := s.subscribeLocked()
		go func() {
			<-ready
			results <- wait(ctx, changed, s.done, time.Time{})
		}()
	}
	// Deliberately signal after registration but before any waiter selects.
	s.signalLocked()
	s.mu.Unlock()
	close(ready)
	for i := 0; i < waiters; i++ {
		if err := <-results; err != nil {
			t.Fatalf("broadcast waiter %d: %v", i, err)
		}
	}
	s.mu.Lock()
	next := s.subscribeLocked()
	s.mu.Unlock()
	select {
	case <-next:
		t.Fatal("a later subscriber consumed an earlier state change")
	default:
	}
	s.mu.Lock()
	s.signalLocked()
	s.mu.Unlock()
	if err := wait(ctx, next, s.done, time.Time{}); err != nil {
		t.Fatal(err)
	}
}

func TestSessionSignalsWithoutWaitersDoNotAllocate(t *testing.T) {
	s, _ := pausedSession(t)
	allocs := testing.AllocsPerRun(1000, func() {
		s.mu.Lock()
		s.signalLocked()
		s.mu.Unlock()
	})
	if allocs != 0 {
		t.Fatalf("unobserved state changes allocated %v objects per signal", allocs)
	}
	select {
	case <-s.wake:
	default:
		t.Fatal("signals without subscribers failed to wake the carrier writer")
	}
}

func startNotificationRead(t *testing.T, s *Session, st *Stream) <-chan error {
	t.Helper()
	result := make(chan error, 1)
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		buf := make([]byte, 1)
		n, err := st.Read(buf)
		if err == nil && (n != 1 || buf[0] != 'x') {
			err = errors.New("incorrect payload after wakeup")
		}
		result <- err
	}()
	t.Cleanup(func() {
		s.fail(ErrClosed)
		select {
		case <-finished:
		case <-time.After(3 * time.Second):
			t.Error("blocked reader did not exit on session failure")
		}
	})
	return result
}

func TestBlockedReadNotificationDeadlineAndRetry(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run(protocol, func(t *testing.T) {
			s, st := pausedSession(t)
			st.request.Protocol = protocol
			result := startNotificationRead(t, s, st)
			prior := awaitNotification(t, s, nil)
			_ = st.SetReadDeadline(time.Now().Add(-time.Second))
			awaitSendResult(t, result, timeoutError{})
			_ = st.SetReadDeadline(time.Time{})
			result = startNotificationRead(t, s, st)
			awaitNotification(t, s, prior)
			frame := Frame{Type: TypeData, StreamID: st.id, Payload: []byte("x")}
			if protocol == "udp" {
				frame.Type, frame.Sequence = TypeDatagram, 1
			}
			s.mu.Lock()
			err := s.handleLocked(frame)
			s.mu.Unlock()
			if err != nil {
				t.Fatal(err)
			}
			awaitSendResult(t, result, nil)
		})
	}
}

func TestBlockedReserveNeedsStreamAndLinkCreditNotification(t *testing.T) {
	s, st := pausedSession(t)
	st.tx, s.txConn = 0, 0
	result := make(chan error, 1)
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		_, err := st.reserve(1)
		result <- err
	}()
	t.Cleanup(func() {
		s.fail(ErrClosed)
		select {
		case <-finished:
		case <-time.After(3 * time.Second):
			t.Error("blocked reservation did not exit on session failure")
		}
	})
	prior := awaitNotification(t, s, nil)
	s.mu.Lock()
	err := s.handleLocked(creditFrame(st.id, 1))
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	awaitNotification(t, s, prior)
	select {
	case err := <-result:
		t.Fatalf("reserve bypassed exhausted Link credit: %v", err)
	default:
	}
	s.mu.Lock()
	err = s.handleLocked(creditFrame(0, 1))
	s.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	awaitSendResult(t, result, nil)
	s.mu.Lock()
	tx, linkTX := st.tx, s.txConn
	s.mu.Unlock()
	if tx != 0 || linkTX != 0 {
		t.Fatalf("reserved credit not consumed once: stream=%d link=%d", tx, linkTX)
	}
}

type observedWaitContext struct {
	context.Context
	once    sync.Once
	waiting chan struct{}
}

func (ctx *observedWaitContext) Done() <-chan struct{} {
	ctx.once.Do(func() { close(ctx.waiting) })
	return ctx.Context.Done()
}

func TestBlockedSendNotificationCancellationAndQueueSpace(t *testing.T) {
	s, st := pausedSession(t)
	s.data[st.id] = outbound{frame: Frame{Type: TypeData, StreamID: st.id, Payload: []byte("old")}}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() {
		result <- s.send(ctx, Frame{Type: TypeData, StreamID: st.id, Payload: []byte("cancel")}, time.Time{})
	}()
	awaitNotification(t, s, nil)
	cancel()
	awaitSendResult(t, result, context.Canceled)
	// The canceled subscriber's channel can serve a subsequent blocked sender.
	retry, stop := context.WithTimeout(context.Background(), 3*time.Second)
	defer stop()
	observed := &observedWaitContext{Context: retry, waiting: make(chan struct{})}
	go func() {
		result <- s.send(observed, Frame{Type: TypeData, StreamID: st.id, Payload: []byte("new")}, time.Time{})
	}()
	select {
	case <-observed.waiting:
	case <-retry.Done():
		t.Fatal("replacement sender did not wait for queue space")
	}
	s.mu.Lock()
	s.popLocked()
	s.signalLocked()
	s.mu.Unlock()
	awaitQueuedPayload(t, s)
	s.mu.Lock()
	request, ok := s.popLocked()
	s.signalLocked()
	s.mu.Unlock()
	if !ok || string(request.frame.Payload) != "new" || request.result == nil {
		t.Fatalf("queue space did not admit the next sender: %+v", request)
	}
	request.result <- nil
	awaitSendResult(t, result, nil)
}

func TestBlockedReadNotificationResetAndClose(t *testing.T) {
	for _, action := range []string{"reset", "stream_close", "session_close"} {
		t.Run(action, func(t *testing.T) {
			s, st := pausedSession(t)
			result := startNotificationRead(t, s, st)
			awaitNotification(t, s, nil)
			want := ErrClosed
			switch action {
			case "reset":
				s.mu.Lock()
				err := s.handleLocked(Frame{Type: TypeReset, StreamID: st.id, Payload: []byte("tst_stream_closed")})
				s.mu.Unlock()
				if err != nil {
					t.Fatal(err)
				}
			case "stream_close":
				_ = st.Close()
				want = ErrUnauthorized // Close retains the existing Reject error contract.
			case "session_close":
				_ = s.Close()
			}
			awaitSendResult(t, result, want)
		})
	}
}

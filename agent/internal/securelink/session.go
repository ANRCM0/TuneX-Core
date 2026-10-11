package securelink

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"net"
	"sync"
	"time"
)

type OpenRequest struct {
	ForwardID int64  `json:"forward_id"`
	Revision  int64  `json:"revision"`
	Protocol  string `json:"protocol"`
}

func (r OpenRequest) valid() bool {
	return r.ForwardID > 0 && r.ForwardID <= 2147483647 && r.Revision > 0 && r.Revision <= 9007199254740991 && (r.Protocol == "tcp" || r.Protocol == "udp")
}

type outbound struct {
	frame  Frame
	result chan error
}

// Session owns exactly one authenticated carrier and a bounded collection of
// streams. One reader and one fair writer are the only users of carrier I/O.
type Session struct {
	conn         net.Conn
	server       bool
	mu           sync.Mutex
	streams      map[uint64]*Stream
	nextID       uint64
	lastRemote   uint64
	txConn       int64
	rxConn       int64
	changed      chan struct{}
	wake         chan struct{}
	done         chan struct{}
	err          error
	control      controlQueue
	data         map[uint64]outbound
	cursor       uint64
	controlBatch int
	accept       chan *Stream
	workers      sync.WaitGroup
}

// NewSession requires the caller to complete TLSConfig's authenticated
// handshake before passing the carrier. Its generic net.Conn parameter allows
// deterministic framing fault tests without weakening the TLS production path.
func NewSession(conn net.Conn, server bool) *Session {
	s := &Session{conn: conn, server: server, streams: make(map[uint64]*Stream), nextID: 1,
		txConn: ConnectionWindow, rxConn: ConnectionWindow,
		wake: make(chan struct{}, 1), done: make(chan struct{}), data: make(map[uint64]outbound), accept: make(chan *Stream, MaxStreams)}
	s.workers.Add(2)
	go func() { defer s.workers.Done(); s.readLoop() }()
	go func() { defer s.workers.Done(); s.writeLoop() }()
	return s
}

func (s *Session) Done() <-chan struct{} { return s.done }
func (s *Session) Err() error            { s.mu.Lock(); defer s.mu.Unlock(); return s.err }
func (s *Session) Close() error          { s.fail(ErrClosed); s.workers.Wait(); return nil }

// subscribeLocked registers a waiter while the state check still holds mu.
// Signals before the waiter enters select remain visible on this generation.
func (s *Session) subscribeLocked() <-chan struct{} {
	if s.changed == nil {
		s.changed = make(chan struct{})
	}
	return s.changed
}

func (s *Session) signalLocked() {
	if s.changed != nil {
		close(s.changed)
		s.changed = nil
	}
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

func (s *Session) fail(err error) {
	s.mu.Lock()
	if s.err != nil {
		s.mu.Unlock()
		return
	}
	if err == nil {
		err = ErrClosed
	}
	s.err = err
	for _, st := range s.streams {
		st.closed = true
		st.err = err
		st.buffer.Reset()
		st.datagrams = nil
	}
	s.streams = make(map[uint64]*Stream)
	for s.control.len() > 0 {
		request, _ := s.control.pop()
		releaseFramePayload(request.frame)
	}
	for _, request := range s.data {
		releaseFramePayload(request.frame)
	}
	s.control = controlQueue{}
	s.data = make(map[uint64]outbound)
	close(s.done)
	s.signalLocked()
	s.mu.Unlock()
	_ = s.conn.Close()
}

func (s *Session) Open(ctx context.Context, request OpenRequest) (*Stream, error) {
	if !request.valid() || s.server {
		return nil, ErrProtocol
	}
	s.mu.Lock()
	if s.err != nil {
		err := s.err
		s.mu.Unlock()
		return nil, err
	}
	if len(s.streams) >= MaxStreams || s.control.len() >= controlQueueLimit || s.nextID > ^uint64(0)-2 {
		s.mu.Unlock()
		return nil, ErrLimit
	}
	id := s.nextID
	s.nextID += 2
	st := newStream(s, id, request)
	s.streams[id] = st
	payload, _ := json.Marshal(request)
	queued := outbound{frame: Frame{Type: TypeOpen, StreamID: id, Payload: payload}, result: make(chan error, 1)}
	// Allocation and OPEN enqueue share the lock: concurrent callers must not
	// put stream 3 on the wire before stream 1.
	if err := s.control.push(queued); err != nil {
		delete(s.streams, id)
		s.mu.Unlock()
		return nil, err
	}
	s.signalLocked()
	s.mu.Unlock()
	var sendErr error
	select {
	case sendErr = <-queued.result:
	case <-ctx.Done():
		sendErr = ctx.Err()
	case <-s.done:
		sendErr = s.Err()
	}
	if sendErr != nil {
		_ = st.Close()
		return nil, sendErr
	}
	for {
		s.mu.Lock()
		if st.accepted {
			s.mu.Unlock()
			return st, nil
		}
		if st.err != nil || s.err != nil {
			err := st.err
			if err == nil {
				err = s.err
			}
			s.mu.Unlock()
			return nil, err
		}
		changed := s.subscribeLocked()
		s.mu.Unlock()
		select {
		case <-changed:
		case <-ctx.Done():
			_ = st.Close()
			return nil, ctx.Err()
		case <-s.done:
			return nil, s.Err()
		}
	}
}

func (s *Session) Accept(ctx context.Context) (*Stream, error) {
	if !s.server {
		return nil, ErrProtocol
	}
	for {
		select {
		case st := <-s.accept:
			s.mu.Lock()
			closed := st.closed
			s.mu.Unlock()
			if closed {
				continue
			}
			return st, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-s.done:
			return nil, s.Err()
		}
	}
}

func safeCode(code string) []byte {
	if len(code) == 0 || len(code) > 64 {
		return []byte("tst_reset")
	}
	for _, c := range code {
		if !(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && c != '_' {
			return []byte("tst_reset")
		}
	}
	return []byte(code)
}

func (s *Session) queueControlLocked(f Frame) error {
	if f.Type == TypeWindowUpdate {
		for i := 0; i < s.control.len(); i++ {
			prior := &s.control.at(i).frame
			if prior.Type == TypeWindowUpdate && prior.StreamID == f.StreamID {
				n := uint64(binary.BigEndian.Uint32(prior.Payload)) + uint64(binary.BigEndian.Uint32(f.Payload))
				if n > ConnectionWindow {
					return ErrProtocol
				}
				binary.BigEndian.PutUint32(prior.Payload, uint32(n))
				s.signalLocked()
				return nil
			}
		}
	}
	if err := s.control.push(outbound{frame: f}); err != nil {
		return err
	}
	s.signalLocked()
	return nil
}

// send transfers pooled payload ownership to the queue on successful enqueue.
// Cancellation after enqueue leaves reclamation to the queue/writer, because
// carrier I/O may still reference the frame after this method returns.
func (s *Session) send(ctx context.Context, f Frame, deadline time.Time) error {
	request := outbound{frame: f, result: make(chan error, 1)}
	queuedForRelease := false
	defer func() {
		if !queuedForRelease {
			releaseFramePayload(f)
		}
	}()
	for {
		s.mu.Lock()
		if s.err != nil {
			err := s.err
			s.mu.Unlock()
			return err
		}
		queued := false
		if f.Type == TypeData || f.Type == TypeDatagram {
			if s.streams[f.StreamID] == nil {
				s.txConn += int64(len(f.Payload))
				s.signalLocked()
				s.mu.Unlock()
				return ErrClosed
			}
			if _, ok := s.data[f.StreamID]; !ok {
				s.data[f.StreamID] = request
				queued = true
			}
		} else if s.control.push(request) == nil {
			queued = true
		}
		var changed <-chan struct{}
		if queued {
			queuedForRelease = true
			s.signalLocked()
		} else {
			changed = s.subscribeLocked()
		}
		s.mu.Unlock()
		if queued {
			break
		}
		if err := wait(ctx, changed, s.done, deadline); err != nil {
			return err
		}
	}
	var timer *time.Timer
	var expired <-chan time.Time
	if !deadline.IsZero() {
		timer = time.NewTimer(time.Until(deadline))
		expired = timer.C
		defer timer.Stop()
	}
	select {
	case err := <-request.result:
		return err
	case <-s.done:
		return s.Err()
	case <-ctx.Done():
		return ctx.Err()
	case <-expired:
		return timeoutError{}
	}
}

func wait(ctx context.Context, changed, done <-chan struct{}, deadline time.Time) error {
	var timer *time.Timer
	var expired <-chan time.Time
	if !deadline.IsZero() {
		timer = time.NewTimer(time.Until(deadline))
		expired = timer.C
		defer timer.Stop()
	}
	select {
	case <-changed:
		return nil
	case <-done:
		return ErrClosed
	case <-ctx.Done():
		return ctx.Err()
	case <-expired:
		return timeoutError{}
	}
}

// Control gets bounded priority. At most one data frame per stream is pending,
// and the cursor selects stream IDs in round-robin order.
func (s *Session) popLocked() (outbound, bool) {
	if s.control.len() > 0 && (s.controlBatch < 8 || len(s.data) == 0) {
		request, _ := s.control.pop()
		s.controlBatch++
		return request, true
	}
	var chosen, first uint64
	for id := range s.data {
		if first == 0 || id < first {
			first = id
		}
		if id > s.cursor && (chosen == 0 || id < chosen) {
			chosen = id
		}
	}
	if chosen == 0 {
		chosen = first
	}
	if chosen == 0 {
		return outbound{}, false
	}
	request := s.data[chosen]
	delete(s.data, chosen)
	s.cursor = chosen
	s.controlBatch = 0
	return request, true
}

func (s *Session) writeLoop() {
	for {
		s.mu.Lock()
		if s.err != nil {
			s.mu.Unlock()
			return
		}
		request, ok := s.popLocked()
		if ok {
			s.signalLocked()
		}
		s.mu.Unlock()
		if !ok {
			select {
			case <-s.wake:
				continue
			case <-s.done:
				return
			}
		}
		_ = s.conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
		err := WriteFrame(s.conn, request.frame)
		releaseFramePayload(request.frame)
		if request.result != nil {
			request.result <- err
		}
		if err != nil {
			s.fail(err)
			return
		}
	}
}

func (s *Session) readLoop() {
	var reader frameReader
	defer reader.release()
	for {
		f, err := reader.read(s.conn)
		if err != nil {
			s.fail(err)
			return
		}
		s.mu.Lock()
		err = s.handleLocked(f)
		s.mu.Unlock()
		if err != nil {
			s.fail(err)
			return
		}
	}
}

func decodeOpen(payload []byte) (OpenRequest, error) {
	// Decode each field explicitly to reject duplicate keys as well as unknowns.
	var request OpenRequest
	decoder := json.NewDecoder(bytes.NewReader(payload))
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return request, ErrProtocol
	}
	seen := make(map[string]bool, 3)
	for decoder.More() {
		token, err = decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return request, ErrProtocol
		}
		seen[key] = true
		switch key {
		case "forward_id":
			err = decoder.Decode(&request.ForwardID)
		case "revision":
			err = decoder.Decode(&request.Revision)
		case "protocol":
			err = decoder.Decode(&request.Protocol)
		default:
			return request, ErrProtocol
		}
		if err != nil {
			return request, ErrProtocol
		}
	}
	if _, err = decoder.Token(); err != nil {
		return request, ErrProtocol
	}
	if decoder.Decode(new(any)) != io.EOF || len(seen) != 3 || !request.valid() {
		return request, ErrProtocol
	}
	return request, nil
}

func creditFrame(id uint64, n int) Frame {
	payload := make([]byte, 4)
	binary.BigEndian.PutUint32(payload, uint32(n))
	return Frame{Type: TypeWindowUpdate, StreamID: id, Payload: payload}
}

func (s *Session) handleLocked(f Frame) error {
	if s.err != nil {
		return s.err
	}
	switch f.Type {
	case TypePing:
		return s.queueControlLocked(Frame{Type: TypePong, Payload: f.Payload})
	case TypePong:
		return nil
	case TypeGoAway, TypeError:
		return ErrClosed
	case TypeOpen:
		if !s.server || f.StreamID%2 != 1 || f.StreamID <= s.lastRemote {
			return ErrProtocol
		}
		s.lastRemote = f.StreamID
		if len(s.streams) >= MaxStreams {
			return s.queueControlLocked(Frame{Type: TypeReset, StreamID: f.StreamID, Payload: safeCode("tst_resource_limit")})
		}
		request, err := decodeOpen(f.Payload)
		if err != nil {
			return err
		}
		st := newStream(s, f.StreamID, request)
		s.streams[f.StreamID] = st
		select {
		case s.accept <- st:
			return nil
		default:
			delete(s.streams, f.StreamID)
			return ErrLimit
		}
	case TypeWindowUpdate:
		if f.StreamID == 0 {
			n := int64(binary.BigEndian.Uint32(f.Payload))
			if s.txConn+n > ConnectionWindow {
				return ErrProtocol
			}
			s.txConn += n
			s.signalLocked()
			return nil
		}
	}
	st := s.streams[f.StreamID]
	if st == nil {
		// RESET and credit may cross a local close. Historical IDs never become
		// new streams, and discarded late payload is credited only at Link level.
		highest := s.lastRemote
		if !s.server {
			highest = 0
			if s.nextID >= 3 {
				highest = s.nextID - 2
			}
		}
		if f.StreamID == 0 || f.StreamID%2 != 1 || f.StreamID > highest {
			return ErrProtocol
		}
		if f.Type == TypeReset || f.Type == TypeWindowUpdate || f.Type == TypeFIN || f.Type == TypeOpenAck {
			return nil
		}
		if f.Type == TypeData || f.Type == TypeDatagram {
			if int64(len(f.Payload)) > s.rxConn {
				return ErrProtocol
			}
			if len(f.Payload) == 0 {
				return nil
			}
			return s.queueControlLocked(creditFrame(0, len(f.Payload)))
		}
		return ErrProtocol
	}
	switch f.Type {
	case TypeOpenAck:
		if s.server || st.accepted {
			return ErrProtocol
		}
		st.accepted = true
		s.signalLocked()
		return nil
	case TypeReset:
		// Bytes already delivered before RESET remain readable, like a socket's
		// receive buffer. Their Link credit is returned when consumed or closed.
		st.closed = true
		st.err = ErrUnauthorized
		if string(f.Payload) == "tst_stream_closed" {
			st.err = ErrClosed
		} else if string(f.Payload) == "tst_resource_limit" {
			st.err = ErrLimit
		}
		delete(s.streams, st.id)
		if queued, ok := s.data[st.id]; ok {
			delete(s.data, st.id)
			s.txConn += int64(len(queued.frame.Payload))
			releaseFramePayload(queued.frame)
			if queued.result != nil {
				queued.result <- ErrClosed
			}
		}
		s.signalLocked()
		return nil
	case TypeWindowUpdate:
		n := int64(binary.BigEndian.Uint32(f.Payload))
		if st.tx+n > StreamWindow {
			return ErrProtocol
		}
		st.tx += n
		s.signalLocked()
		return nil
	case TypeFIN:
		if !st.accepted || st.remoteFIN || st.request.Protocol != "tcp" {
			return ErrProtocol
		}
		st.remoteFIN = true
		s.signalLocked()
		return nil
	case TypeData, TypeDatagram:
		if !st.accepted || st.remoteFIN {
			return ErrProtocol
		}
		n := len(f.Payload)
		if int64(n) > st.rx || int64(n) > s.rxConn {
			return ErrProtocol
		}
		if f.Type == TypeData {
			if st.request.Protocol != "tcp" {
				return ErrProtocol
			}
			st.buffer.Write(f.Payload)
		} else {
			if st.request.Protocol != "udp" || st.recvSequence == ^uint32(0) || f.Sequence != st.recvSequence+1 {
				return ErrProtocol
			}
			// Byte credit permits an empty/small-packet burst above the packet
			// quota. Exhausting one association must not terminate sibling rules.
			if len(st.datagrams) >= 64 {
				s.closeStreamLocked(st, ErrLimit)
				if n > 0 {
					if err := s.queueControlLocked(creditFrame(0, n)); err != nil {
						return err
					}
				}
				return s.queueControlLocked(Frame{Type: TypeReset, StreamID: st.id, Payload: safeCode("tst_resource_limit")})
			}
			st.recvSequence = f.Sequence
			st.datagrams = append(st.datagrams, f.Payload)
		}
		st.rx -= int64(n)
		s.rxConn -= int64(n)
		s.signalLocked()
		return nil
	default:
		return ErrProtocol
	}
}

func (s *Session) closeStreamLocked(st *Stream, err error) {
	if st.closed {
		return
	}
	st.closed = true
	st.err = err
	unread := st.buffer.Len()
	for _, d := range st.datagrams {
		unread += len(d)
	}
	st.buffer.Reset()
	st.datagrams = nil
	if unread > 0 {
		s.rxConn += int64(unread)
		if e := s.queueControlLocked(creditFrame(0, unread)); e != nil { /* reader will reject any further overflow */
		}
	}
	delete(s.streams, st.id)
	if queued, ok := s.data[st.id]; ok {
		delete(s.data, st.id)
		s.txConn += int64(len(queued.frame.Payload))
		releaseFramePayload(queued.frame)
		if queued.result != nil {
			queued.result <- ErrClosed
		}
	}
	s.signalLocked()
}

type timeoutError struct{}

func (timeoutError) Error() string   { return "tst_deadline_exceeded" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

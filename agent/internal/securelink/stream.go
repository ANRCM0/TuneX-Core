package securelink

import (
	"bytes"
	"context"
	"io"
	"net"
	"sync"
	"time"
)

type Stream struct {
	session                     *Session
	id                          uint64
	request                     OpenRequest
	readMu                      sync.Mutex
	writeMu                     sync.Mutex
	buffer                      bytes.Buffer
	datagrams                   [][]byte
	accepted                    bool
	closed                      bool
	err                         error
	remoteFIN                   bool
	localFIN                    bool
	tx, rx                      int64
	sendSequence, recvSequence  uint32
	readDeadline, writeDeadline time.Time
}

var _ net.Conn = (*Stream)(nil)

func newStream(s *Session, id uint64, request OpenRequest) *Stream {
	return &Stream{session: s, id: id, request: request, tx: StreamWindow, rx: StreamWindow}
}
func (st *Stream) Request() OpenRequest { return st.request }

func (st *Stream) Accept() error {
	s := st.session
	s.mu.Lock()
	if !s.server || st.accepted || st.closed {
		s.mu.Unlock()
		return ErrProtocol
	}
	st.accepted = true
	s.signalLocked()
	s.mu.Unlock()
	return s.send(context.Background(), Frame{Type: TypeOpenAck, StreamID: st.id}, time.Now().Add(10*time.Second))
}

func (st *Stream) Reject(code string) error {
	s := st.session
	s.mu.Lock()
	if st.closed {
		s.mu.Unlock()
		return nil
	}
	s.closeStreamLocked(st, ErrUnauthorized)
	err := s.queueControlLocked(Frame{Type: TypeReset, StreamID: st.id, Payload: safeCode(code)})
	s.mu.Unlock()
	if err != nil {
		s.fail(err)
	}
	return err
}

func (st *Stream) Close() error {
	s := st.session
	s.mu.Lock()
	if st.localFIN && st.remoteFIN && !st.closed {
		s.closeStreamLocked(st, ErrClosed)
		s.mu.Unlock()
		return nil
	}
	if st.closed {
		unread := st.buffer.Len()
		for _, d := range st.datagrams {
			unread += len(d)
		}
		st.buffer.Reset()
		st.datagrams = nil
		if unread > 0 {
			s.rxConn += int64(unread)
			_ = s.queueControlLocked(creditFrame(0, unread))
		}
		s.mu.Unlock()
		return nil
	}
	s.mu.Unlock()
	return st.Reject("tst_stream_closed")
}

func (st *Stream) CloseWrite() error {
	st.writeMu.Lock()
	defer st.writeMu.Unlock()
	s := st.session
	s.mu.Lock()
	if st.closed || st.localFIN || !st.accepted || st.request.Protocol != "tcp" {
		s.mu.Unlock()
		return ErrClosed
	}
	st.localFIN = true
	deadline := st.writeDeadline
	s.mu.Unlock()
	return s.send(context.Background(), Frame{Type: TypeFIN, StreamID: st.id}, deadline)
}

func (st *Stream) Read(p []byte) (int, error) {
	if st.request.Protocol == "udp" {
		return st.ReadDatagram(p)
	}
	if len(p) == 0 {
		return 0, nil
	}
	st.readMu.Lock()
	defer st.readMu.Unlock()
	s := st.session
	for {
		s.mu.Lock()
		if !st.readDeadline.IsZero() && !time.Now().Before(st.readDeadline) {
			s.mu.Unlock()
			return 0, timeoutError{}
		}
		if st.buffer.Len() > 0 {
			n, _ := st.buffer.Read(p)
			err := st.creditLocked(n)
			s.mu.Unlock()
			if err != nil {
				s.fail(err)
			}
			return n, err
		}
		if st.remoteFIN {
			s.mu.Unlock()
			return 0, io.EOF
		}
		if st.closed {
			err := st.err
			if err == nil {
				err = ErrClosed
			}
			s.mu.Unlock()
			return 0, err
		}
		changed, deadline := s.subscribeLocked(), st.readDeadline
		s.mu.Unlock()
		if err := wait(context.Background(), changed, s.done, deadline); err != nil {
			return 0, err
		}
	}
}

func (st *Stream) creditLocked(n int) error {
	if n == 0 {
		return nil
	}
	s := st.session
	st.rx += int64(n)
	s.rxConn += int64(n)
	if err := s.queueControlLocked(creditFrame(st.id, n)); err != nil {
		return err
	}
	return s.queueControlLocked(creditFrame(0, n))
}

func (st *Stream) ReadDatagram(p []byte) (int, error) {
	if st.request.Protocol != "udp" {
		return 0, ErrProtocol
	}
	st.readMu.Lock()
	defer st.readMu.Unlock()
	s := st.session
	for {
		s.mu.Lock()
		if !st.readDeadline.IsZero() && !time.Now().Before(st.readDeadline) {
			s.mu.Unlock()
			return 0, timeoutError{}
		}
		if len(st.datagrams) > 0 {
			d := st.datagrams[0]
			st.datagrams[0] = nil
			st.datagrams = st.datagrams[1:]
			n := copy(p, d)
			err := st.creditLocked(len(d))
			if n < len(d) && err == nil {
				err = io.ErrShortBuffer
			}
			s.mu.Unlock()
			if err != nil && err != io.ErrShortBuffer {
				s.fail(err)
			}
			return n, err
		}
		if st.closed {
			err := st.err
			if err == nil {
				err = ErrClosed
			}
			s.mu.Unlock()
			return 0, err
		}
		changed, deadline := s.subscribeLocked(), st.readDeadline
		s.mu.Unlock()
		if err := wait(context.Background(), changed, s.done, deadline); err != nil {
			return 0, err
		}
	}
}

func (st *Stream) Write(p []byte) (int, error) {
	if st.request.Protocol == "udp" {
		err := st.WriteDatagram(p)
		if err != nil {
			return 0, err
		}
		return len(p), nil
	}
	st.writeMu.Lock()
	defer st.writeMu.Unlock()
	total := 0
	for len(p) > 0 {
		n := len(p)
		if n > MaxData {
			n = MaxData
		}
		deadline, err := st.reserve(n)
		if err != nil {
			return total, err
		}
		payload := acquireDataPayload(n)
		copy(payload, p[:n])
		err = st.session.send(context.Background(), Frame{Type: TypeData, StreamID: st.id, Payload: payload, pooled: true}, deadline)
		if err != nil {
			_ = st.Close()
			return total, err
		}
		total += n
		p = p[n:]
	}
	return total, nil
}

func (st *Stream) reserve(n int) (time.Time, error) {
	s := st.session
	for {
		s.mu.Lock()
		if st.closed || st.localFIN || !st.accepted {
			s.mu.Unlock()
			return time.Time{}, ErrClosed
		}
		deadline := st.writeDeadline
		if !deadline.IsZero() && !time.Now().Before(deadline) {
			s.mu.Unlock()
			return deadline, timeoutError{}
		}
		if st.tx >= int64(n) && s.txConn >= int64(n) {
			st.tx -= int64(n)
			s.txConn -= int64(n)
			s.mu.Unlock()
			return deadline, nil
		}
		changed := s.subscribeLocked()
		s.mu.Unlock()
		if err := wait(context.Background(), changed, s.done, deadline); err != nil {
			return deadline, err
		}
	}
}

func (st *Stream) WriteDatagram(p []byte) error {
	if st.request.Protocol != "udp" || len(p) > MaxDatagram {
		return ErrProtocol
	}
	st.writeMu.Lock()
	defer st.writeMu.Unlock()
	deadline, err := st.reserve(len(p))
	if err != nil {
		return err
	}
	s := st.session
	s.mu.Lock()
	if st.sendSequence == ^uint32(0) {
		s.mu.Unlock()
		_ = st.Close()
		return ErrLimit
	}
	st.sendSequence++
	sequence := st.sendSequence
	s.mu.Unlock()
	err = s.send(context.Background(), Frame{Type: TypeDatagram, StreamID: st.id, Sequence: sequence, Payload: append([]byte(nil), p...)}, deadline)
	if err != nil {
		_ = st.Close()
	}
	return err
}

func (st *Stream) LocalAddr() net.Addr  { return st.session.conn.LocalAddr() }
func (st *Stream) RemoteAddr() net.Addr { return st.session.conn.RemoteAddr() }
func (st *Stream) SetDeadline(t time.Time) error {
	s := st.session
	s.mu.Lock()
	st.readDeadline = t
	st.writeDeadline = t
	s.signalLocked()
	s.mu.Unlock()
	return nil
}
func (st *Stream) SetReadDeadline(t time.Time) error {
	s := st.session
	s.mu.Lock()
	st.readDeadline = t
	s.signalLocked()
	s.mu.Unlock()
	return nil
}
func (st *Stream) SetWriteDeadline(t time.Time) error {
	s := st.session
	s.mu.Lock()
	st.writeDeadline = t
	s.signalLocked()
	s.mu.Unlock()
	return nil
}

package securelink

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net"
	"sync"
	"testing"
	"time"
)

func sessionPair(t *testing.T) (*Session, *Session) {
	t.Helper()
	a, b := net.Pipe()
	client, server := NewSession(a, false), NewSession(b, true)
	t.Cleanup(func() { _ = client.Close(); _ = server.Close() })
	return client, server
}

func authorize(t *testing.T, server *Session, ctx context.Context) *Stream {
	t.Helper()
	stream, err := server.Accept(ctx)
	if err != nil {
		t.Error(err)
		return nil
	}
	if err = stream.Accept(); err != nil {
		t.Error(err)
		return nil
	}
	return stream
}

func TestMultiplexedTCPHalfCloseAndFlowControl(t *testing.T) {
	client, server := sessionPair(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	for i := int64(1); i <= 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			st := authorize(t, server, ctx)
			if st == nil {
				return
			}
			defer st.Close()
			payload, err := io.ReadAll(st)
			if err != nil {
				t.Error(err)
				return
			}
			sum := sha256.Sum256(payload)
			if _, err = st.Write(sum[:]); err != nil {
				t.Error(err)
			}
			_ = st.CloseWrite()
		}()
	}
	for i := int64(1); i <= 8; i++ {
		wg.Add(1)
		go func(id int64) {
			defer wg.Done()
			st, err := client.Open(ctx, OpenRequest{ForwardID: id, Revision: 1, Protocol: "tcp"})
			if err != nil {
				t.Error(err)
				return
			}
			defer st.Close()
			_ = st.SetDeadline(time.Now().Add(8 * time.Second))
			payload := bytes.Repeat([]byte{byte(id)}, 600000)
			if _, err = st.Write(payload); err != nil {
				t.Error(err)
				return
			}
			if err = st.CloseWrite(); err != nil {
				t.Error(err)
				return
			}
			response, err := io.ReadAll(st)
			sum := sha256.Sum256(payload)
			if err != nil || !bytes.Equal(response, sum[:]) {
				t.Errorf("stream %d response: %x %v", id, response, err)
			}
		}(i)
	}
	wg.Wait()
}

func TestUDPDatagramBoundariesAndEmptyPacket(t *testing.T) {
	client, server := sessionPair(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		st := authorize(t, server, ctx)
		if st == nil {
			return
		}
		defer st.Close()
		_ = st.SetDeadline(time.Now().Add(4 * time.Second))
		buf := make([]byte, MaxDatagram)
		for i := 0; i < 4; i++ {
			n, err := st.ReadDatagram(buf)
			if err != nil {
				t.Error(err)
				return
			}
			if err = st.WriteDatagram(buf[:n]); err != nil {
				t.Error(err)
				return
			}
		}
	}()
	st, err := client.Open(ctx, OpenRequest{ForwardID: 2, Revision: 3, Protocol: "udp"})
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	_ = st.SetDeadline(time.Now().Add(4 * time.Second))
	for _, payload := range [][]byte{nil, []byte("first"), bytes.Repeat([]byte{7}, MaxDatagram), []byte("last")} {
		if err = st.WriteDatagram(payload); err != nil {
			t.Fatal(err)
		}
		buf := make([]byte, MaxDatagram)
		n, err := st.ReadDatagram(buf)
		if err != nil || !bytes.Equal(buf[:n], payload) {
			t.Fatalf("datagram %d: %v", n, err)
		}
	}
	<-finished
}

func TestBlockedStreamDeadlineDoesNotBlockSibling(t *testing.T) {
	client, server := sessionPair(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	finished := make(chan struct{})
	go func() {
		for i := 0; i < 2; i++ {
			st := authorize(t, server, ctx)
			if st == nil {
				return
			}
			if st.Request().ForwardID == 2 {
				go func() {
					defer close(finished)
					defer st.Close()
					buf := make([]byte, 2)
					_, err := io.ReadFull(st, buf)
					if err == nil {
						_, err = st.Write(buf)
					}
					if err != nil {
						t.Error(err)
					}
					_ = st.CloseWrite()
				}()
			}
		}
	}()
	blocked, err := client.Open(ctx, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "tcp"})
	if err != nil {
		t.Fatal(err)
	}
	defer blocked.Close()
	_ = blocked.SetWriteDeadline(time.Now().Add(100 * time.Millisecond))
	if _, err = blocked.Write(make([]byte, StreamWindow+MaxData)); err == nil {
		t.Fatal("unbounded sending bypassed stream credit")
	}
	sibling, err := client.Open(ctx, OpenRequest{ForwardID: 2, Revision: 1, Protocol: "tcp"})
	if err != nil {
		t.Fatal(err)
	}
	defer sibling.Close()
	_ = sibling.SetDeadline(time.Now().Add(time.Second))
	if _, err = sibling.Write([]byte("ok")); err != nil {
		t.Fatal(err)
	}
	response := make([]byte, 2)
	if _, err = io.ReadFull(sibling, response); err != nil || string(response) != "ok" {
		t.Fatalf("sibling: %q %v", response, err)
	}
	<-finished
}

func TestUnauthorizedOpenAndReplayFailClosed(t *testing.T) {
	client, server := sessionPair(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	go func() {
		st, err := server.Accept(ctx)
		if err == nil {
			_ = st.Reject("tst_rule_unauthorized")
		}
	}()
	if _, err := client.Open(ctx, OpenRequest{ForwardID: 99, Revision: 1, Protocol: "tcp"}); err == nil {
		t.Fatal("unauthorized rule opened")
	}
	a, b := net.Pipe()
	s := NewSession(a, true)
	defer s.Close()
	defer b.Close()
	f := Frame{Type: TypeOpen, StreamID: 1, Payload: []byte(`{"forward_id":1,"revision":1,"protocol":"tcp"}`)}
	if err := WriteFrame(b, f); err != nil {
		t.Fatal(err)
	}
	if err := WriteFrame(b, f); err != nil {
		t.Fatal(err)
	}
	select {
	case <-s.Done():
		if s.Err() != ErrProtocol {
			t.Fatal(s.Err())
		}
	case <-ctx.Done():
		t.Fatal("replay not rejected")
	}
}

func TestCanceledPendingOpenDoesNotTearDownSibling(t *testing.T) {
	client, server := sessionPair(t)
	short, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	if _, err := client.Open(short, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "tcp"}); err == nil {
		t.Fatal("unacknowledged OPEN succeeded")
	}
	cancel()
	// Wait until the RESET is consumed rather than sleeping or assuming order
	// across the reader/writer goroutines.
	end := time.Now().Add(time.Second)
	for {
		server.mu.Lock()
		_, pending := server.streams[1]
		var changed <-chan struct{}
		if pending {
			changed = server.subscribeLocked()
		}
		server.mu.Unlock()
		if !pending {
			break
		}
		if time.Now().After(end) {
			t.Fatal("RESET not consumed")
		}
		if err := wait(context.Background(), changed, server.done, end); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		st := authorize(t, server, ctx)
		if st == nil {
			return
		}
		defer st.Close()
		if st.Request().ForwardID != 2 {
			t.Error("canceled request admitted")
			return
		}
		buf := make([]byte, 1)
		if _, err := io.ReadFull(st, buf); err != nil {
			t.Error(err)
			return
		}
		if _, err := st.Write(buf); err != nil {
			t.Error(err)
		}
	}()
	st, err := client.Open(ctx, OpenRequest{ForwardID: 2, Revision: 1, Protocol: "tcp"})
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	_ = st.SetDeadline(end)
	if _, err = st.Write([]byte("B")); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 1)
	if _, err = io.ReadFull(st, buf); err != nil || string(buf) != "B" {
		t.Fatalf("sibling: %s %v", buf, err)
	}
	<-finished
}

// An empty UDP response can cross a local RESET. It consumes no byte credit;
// emitting a zero WINDOW_UPDATE would make the healthy peer reject the carrier.
func TestLateEmptyDatagramPreservesSiblingCarrier(t *testing.T) {
	a, peer := net.Pipe()
	s := NewSession(a, true)
	defer s.Close()
	defer peer.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := WriteFrame(peer, Frame{Type: TypeOpen, StreamID: 1,
		Payload: []byte(`{"forward_id":1,"revision":1,"protocol":"udp"}`)}); err != nil {
		t.Fatal(err)
	}
	st, err := s.Accept(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = st.Reject("tst_stream_closed"); err != nil {
		t.Fatal(err)
	}
	if frame, err := ReadFrame(peer); err != nil || frame.Type != TypeReset {
		t.Fatalf("reset: %+v %v", frame, err)
	}
	if err = WriteFrame(peer, Frame{Type: TypeDatagram, StreamID: 1, Sequence: 1}); err != nil {
		t.Fatal(err)
	}
	if err = WriteFrame(peer, Frame{Type: TypePing, Payload: []byte("12345678")}); err != nil {
		t.Fatal(err)
	}
	_ = peer.SetReadDeadline(time.Now().Add(time.Second))
	frame, err := ReadFrame(peer)
	if err != nil || frame.Type != TypePong || string(frame.Payload) != "12345678" {
		t.Fatalf("late datagram disrupted carrier: %+v %v", frame, err)
	}
}

func TestDatagramPacketQuotaPreservesSiblingTCP(t *testing.T) {
	client, server := sessionPair(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	remote := make(chan *Stream, 2)
	go func() {
		for i := 0; i < 2; i++ {
			st := authorize(t, server, ctx)
			if st == nil {
				return
			}
			remote <- st
		}
	}()
	udp, err := client.Open(ctx, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "udp"})
	if err != nil {
		t.Fatal(err)
	}
	defer udp.Close()
	remoteUDP := <-remote
	tcp, err := client.Open(ctx, OpenRequest{ForwardID: 2, Revision: 1, Protocol: "tcp"})
	if err != nil {
		t.Fatal(err)
	}
	defer tcp.Close()
	remoteTCP := <-remote
	defer remoteTCP.Close()
	for i := 0; i < 65; i++ {
		if err = udp.WriteDatagram(nil); err != nil && err != ErrLimit && err != ErrClosed {
			t.Fatal(err)
		}
	}
	for {
		server.mu.Lock()
		closed, streamErr := remoteUDP.closed, remoteUDP.err
		var changed <-chan struct{}
		if !closed {
			changed = server.subscribeLocked()
		}
		server.mu.Unlock()
		if closed {
			if streamErr != ErrLimit {
				t.Fatalf("association quota: %v", streamErr)
			}
			break
		}
		if err = wait(ctx, changed, server.done, time.Time{}); err != nil {
			t.Fatal(err)
		}
	}
	_ = tcp.SetDeadline(time.Now().Add(time.Second))
	_ = remoteTCP.SetDeadline(time.Now().Add(time.Second))
	if _, err = tcp.Write([]byte("B")); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 1)
	if _, err = io.ReadFull(remoteTCP, buf); err != nil || string(buf) != "B" {
		t.Fatalf("sibling after quota: %q %v", buf, err)
	}
	if _, err = remoteTCP.Write(buf); err != nil {
		t.Fatal(err)
	}
	if _, err = io.ReadFull(tcp, buf); err != nil || string(buf) != "B" {
		t.Fatalf("sibling response: %q %v", buf, err)
	}
}

func BenchmarkTSTStream(b *testing.B) {
	a, c := net.Pipe()
	client, server := NewSession(a, false), NewSession(c, true)
	defer client.Close()
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	result := make(chan error, 1)
	go func() {
		st, err := server.Accept(ctx)
		if err != nil {
			result <- err
			return
		}
		if err = st.Accept(); err != nil {
			result <- err
			return
		}
		_, err = io.Copy(io.Discard, st)
		result <- err
	}()
	st, err := client.Open(ctx, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "tcp"})
	if err != nil {
		b.Fatal(err)
	}
	defer st.Close()
	payload := bytes.Repeat([]byte("x"), MaxData)
	b.SetBytes(int64(len(payload)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err = st.Write(payload); err != nil {
			b.Fatal(err)
		}
	}
	b.StopTimer()
	_ = st.CloseWrite()
	if err = <-result; err != nil {
		b.Fatal(fmt.Errorf("receive: %w", err))
	}
}

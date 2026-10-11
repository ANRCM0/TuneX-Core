// Package securelink implements TuneX's independent TST/1 framing over an
// already authenticated TLS 1.3 connection. It contains no third-party wire code.
package securelink

import (
	"encoding/binary"
	"errors"
	"io"
)

const (
	ALPN                  = "tst/1"
	HeaderSize            = 20
	MaxData               = 16 * 1024
	MaxDatagram           = 65507
	StreamWindow          = 256 * 1024
	ConnectionWindow      = 4 * 1024 * 1024
	MaxStreams            = 256
	TypeOpen         byte = 1
	TypeOpenAck      byte = 2
	TypeData         byte = 3
	TypeFIN          byte = 4
	TypeReset        byte = 5
	TypeDatagram     byte = 6
	TypeWindowUpdate byte = 7
	TypePing         byte = 8
	TypePong         byte = 9
	TypeGoAway       byte = 10
	TypeError        byte = 11
)

var (
	ErrProtocol     = errors.New("tst_protocol_error")
	ErrClosed       = errors.New("tst_connection_closed")
	ErrLimit        = errors.New("tst_resource_limit")
	ErrUnauthorized = errors.New("tst_rule_unauthorized")
	ErrIdentity     = errors.New("tst_identity_invalid")
)

type Frame struct {
	Type     byte
	StreamID uint64
	Sequence uint32
	Payload  []byte
	// pooled payloads are owned by send until enqueue, then by the queue or
	// writer. A caller timing out cannot release a frame still being written.
	pooled bool
}

const pooledDataPayloads = 256

// Retain at most 4 MiB of fixed-size frame buffers per process. Unlike
// sync.Pool, this channel has a deterministic capacity; excess returned buffers
// are left for the garbage collector.
var dataPayloadPool = make(chan []byte, pooledDataPayloads)

func acquireDataPayload(n int) []byte {
	select {
	case payload := <-dataPayloadPool:
		return payload[:n]
	default:
		return make([]byte, n, MaxData)
	}
}

func releaseFramePayload(f Frame) {
	if !f.pooled {
		return
	}
	releaseDataPayload(f.Payload)
}

func releaseDataPayload(payload []byte) {
	if cap(payload) != MaxData {
		return
	}
	// The cache is shared between Links and Workspaces. Erase plaintext,
	// including the unused tail of a smaller frame, before making it reusable.
	clear(payload[:MaxData])
	select {
	case dataPayloadPool <- payload[:MaxData]:
	default:
	}
}

func payloadLimit(t byte) int {
	switch t {
	case TypeOpen:
		return 1024
	case TypeOpenAck, TypeFIN:
		return 0
	case TypeData:
		return MaxData
	case TypeDatagram:
		return MaxDatagram
	case TypeWindowUpdate:
		return 4
	case TypePing, TypePong:
		return 8
	case TypeReset, TypeGoAway, TypeError:
		return 64
	default:
		return -1
	}
}

func validFrame(f Frame) bool {
	limit := payloadLimit(f.Type)
	if limit < 0 || len(f.Payload) > limit {
		return false
	}
	switch f.Type {
	case TypePing, TypePong:
		return f.StreamID == 0 && f.Sequence == 0 && len(f.Payload) == 8
	case TypeGoAway, TypeError:
		return f.StreamID == 0 && f.Sequence == 0
	case TypeWindowUpdate:
		return f.Sequence == 0 && len(f.Payload) == 4 && binary.BigEndian.Uint32(f.Payload) != 0
	case TypeDatagram:
		return f.StreamID != 0 && f.Sequence != 0
	case TypeData:
		return f.StreamID != 0 && f.Sequence == 0 && len(f.Payload) != 0
	default:
		return f.StreamID != 0 && f.Sequence == 0
	}
}

// ReadFrame checks the header before allocating any payload memory. The returned
// payload belongs to the caller and is unaffected by subsequent frame reads.
func ReadFrame(r io.Reader) (Frame, error) {
	var header [HeaderSize]byte
	return readFrame(r, header[:], nil)
}

// frameReader is owned exclusively by Session.readLoop. Only DATA payloads
// borrow its scratch buffer: handleLocked copies them before the next read.
// Control frames and queued datagrams must retain independent payload storage.
type frameReader struct {
	header [HeaderSize]byte
	data   []byte
}

func (r *frameReader) read(conn io.Reader) (Frame, error) {
	return readFrame(conn, r.header[:], &r.data)
}

// release runs after the read loop exits, never while carrier I/O may still
// reference the scratch buffer. Each active TCP Link holds at most 16 KiB.
func (r *frameReader) release() {
	releaseDataPayload(r.data)
	r.data = nil
	clear(r.header[:])
}

func readFrame(r io.Reader, header []byte, data *[]byte) (Frame, error) {
	if _, err := io.ReadFull(r, header); err != nil {
		return Frame{}, err
	}
	length := binary.BigEndian.Uint32(header[12:16])
	limit := payloadLimit(header[0])
	if header[1] != 0 || binary.BigEndian.Uint16(header[2:4]) != 0 || limit < 0 || uint64(length) > uint64(limit) {
		return Frame{}, ErrProtocol
	}
	f := Frame{Type: header[0], StreamID: binary.BigEndian.Uint64(header[4:12]), Sequence: binary.BigEndian.Uint32(header[16:20])}
	if data != nil && f.Type == TypeData && length != 0 {
		if *data == nil {
			*data = acquireDataPayload(MaxData)
		}
		f.Payload = (*data)[:int(length)]
	} else {
		f.Payload = make([]byte, int(length))
	}
	if _, err := io.ReadFull(r, f.Payload); err != nil {
		return Frame{}, err
	}
	if !validFrame(f) {
		return Frame{}, ErrProtocol
	}
	return f, nil
}

func WriteFrame(w io.Writer, f Frame) error {
	if !validFrame(f) {
		return ErrProtocol
	}
	var h [HeaderSize]byte
	h[0] = f.Type
	binary.BigEndian.PutUint64(h[4:12], f.StreamID)
	binary.BigEndian.PutUint32(h[12:16], uint32(len(f.Payload)))
	binary.BigEndian.PutUint32(h[16:20], f.Sequence)
	if err := writeAll(w, h[:]); err != nil {
		return err
	}
	return writeAll(w, f.Payload)
}

func writeAll(w io.Writer, p []byte) error {
	for len(p) != 0 {
		n, err := w.Write(p)
		if n < 0 || n > len(p) {
			return io.ErrShortWrite
		}
		p = p[n:]
		if err != nil {
			return err
		}
		if n == 0 {
			return io.ErrShortWrite
		}
	}
	return nil
}

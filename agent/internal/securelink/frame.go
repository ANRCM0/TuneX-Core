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

// ReadFrame checks the header before allocating any payload memory.
func ReadFrame(r io.Reader) (Frame, error) {
	var header [HeaderSize]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return Frame{}, err
	}
	length := binary.BigEndian.Uint32(header[12:16])
	limit := payloadLimit(header[0])
	if header[1] != 0 || binary.BigEndian.Uint16(header[2:4]) != 0 || limit < 0 || uint64(length) > uint64(limit) {
		return Frame{}, ErrProtocol
	}
	f := Frame{Type: header[0], StreamID: binary.BigEndian.Uint64(header[4:12]), Sequence: binary.BigEndian.Uint32(header[16:20])}
	f.Payload = make([]byte, int(length))
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

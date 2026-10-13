package relay

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"io"
)

const MaxControlBytes = 4096
const (
	FrameTCP   byte = 1
	FrameFIN   byte = 2
	FrameClose byte = 3
	FrameUDP   byte = 4
)

func writeAll(out io.Writer, raw []byte) error {
	for len(raw) > 0 {
		n, err := out.Write(raw)
		if err != nil {
			return err
		}
		if n <= 0 {
			return io.ErrShortWrite
		}
		raw = raw[n:]
	}
	return nil
}
func WriteControl(out io.Writer, name string, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if err := relaycontracts.Parse(name, raw, nil); err != nil {
		return err
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(raw)))
	if err := writeAll(out, header[:]); err != nil {
		return err
	}
	return writeAll(out, raw)
}
func ReadControl(in io.Reader, name string, destination any) error {
	var header [4]byte
	if _, err := io.ReadFull(in, header[:]); err != nil {
		return err
	}
	size := binary.BigEndian.Uint32(header[:])
	if size < 2 || size > MaxControlBytes {
		return fmt.Errorf("RESOURCE_LIMIT: Relay control message size")
	}
	raw := make([]byte, size)
	if _, err := io.ReadFull(in, raw); err != nil {
		return err
	}
	return relaycontracts.Parse(name, raw, destination)
}
func frameValid(kind byte, size int, protocol string, maximum int) bool {
	if maximum < 64 || maximum > 65536 || size < 0 || size > maximum {
		return false
	}
	switch kind {
	case FrameTCP:
		return protocol == "tcp" && size > 0
	case FrameUDP:
		return protocol == "udp"
	case FrameFIN:
		return protocol == "tcp" && size == 0
	case FrameClose:
		return size == 0
	}
	return false
}
func WriteFrame(out io.Writer, kind byte, payload []byte, protocol string, maximum int) error {
	if !frameValid(kind, len(payload), protocol, maximum) {
		return fmt.Errorf("INVALID_CONFIG: Relay frame refused")
	}
	var header [5]byte
	header[0] = kind
	binary.BigEndian.PutUint32(header[1:], uint32(len(payload)))
	if err := writeAll(out, header[:]); err != nil {
		return err
	}
	return writeAll(out, payload)
}
func ReadFrame(in io.Reader, protocol string, maximum int) (byte, []byte, error) {
	var header [5]byte
	if _, err := io.ReadFull(in, header[:]); err != nil {
		return 0, nil, err
	}
	size := binary.BigEndian.Uint32(header[1:])
	if !frameValid(header[0], int(size), protocol, maximum) {
		return 0, nil, fmt.Errorf("INVALID_CONFIG: Relay frame refused")
	}
	payload := make([]byte, int(size))
	_, err := io.ReadFull(in, payload)
	return header[0], payload, err
}
func ValidateOpen(open relaycontracts.Open, expected relaycontracts.Binding, active bool, allow func() error) error {
	raw, err := json.Marshal(open)
	if err != nil {
		return err
	}
	if err := relaycontracts.Parse("Open", raw, nil); err != nil {
		return err
	}
	if !active {
		return fmt.Errorf("DOWNSTREAM_NOT_ACTIVE")
	}
	if allow == nil {
		return fmt.Errorf("AUTHORIZATION_DENIED")
	}
	if err := allow(); err != nil {
		return err
	}
	actualDigest, err := contracts.ComputeDigest(open.Binding)
	if err != nil {
		return err
	}
	expectedDigest, err := contracts.ComputeDigest(expected)
	if err != nil {
		return err
	}
	if actualDigest != expectedDigest {
		return fmt.Errorf("STALE_DEPLOYMENT")
	}
	return nil
}

package securelink

import (
	"bytes"
	"encoding/hex"
	"errors"
	"io"
	"testing"
)

func TestIndependentFrameVectors(t *testing.T) {
	for _, vector := range []struct {
		wire  string
		frame Frame
	}{
		{"08000000000000000000000000000008000000000000000000000000", Frame{Type: TypePing, Payload: make([]byte, 8)}},
		{"0400000000000000000000010000000000000000", Frame{Type: TypeFIN, StreamID: 1}},
	} {
		wire, err := hex.DecodeString(vector.wire)
		if err != nil {
			t.Fatal(err)
		}
		var out bytes.Buffer
		if err = WriteFrame(&out, vector.frame); err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(out.Bytes(), wire) {
			t.Fatalf("vector mismatch: %x", out.Bytes())
		}
		parsed, err := ReadFrame(bytes.NewReader(wire))
		if err != nil || parsed.Type != vector.frame.Type || parsed.StreamID != vector.frame.StreamID {
			t.Fatalf("decode: %+v %v", parsed, err)
		}
	}
}

func TestFrameRejectsBeforePayloadAllocation(t *testing.T) {
	for _, wire := range []string{
		"030000000000000000000001ffffffff00000000", // advertised 4 GiB
		"6300000000000000000000010000000000000000", // unknown type
		"0401000000000000000000010000000000000000", // unknown flags
		"0400000100000000000000010000000000000000", // reserved bit
		"0700000000000000000000000000000000000000", // missing credit
	} {
		data, _ := hex.DecodeString(wire)
		if _, err := ReadFrame(bytes.NewReader(data)); err != ErrProtocol {
			t.Fatalf("accepted %s: %v", wire, err)
		}
	}
	data, _ := hex.DecodeString("03000000000000000000000100000004000000000102")
	if _, err := ReadFrame(bytes.NewReader(data)); err != io.ErrUnexpectedEOF {
		t.Fatalf("truncated: %v", err)
	}
}

func TestOpenHasNoTargetOrDuplicateFields(t *testing.T) {
	for _, raw := range []string{
		`{"forward_id":1,"revision":1,"protocol":"tcp","target_host":"127.0.0.1"}`,
		`{"forward_id":1,"forward_id":2,"revision":1,"protocol":"tcp"}`,
		`{"forward_id":1,"revision":0,"protocol":"tcp"}`,
		`{"forward_id":1,"revision":1,"protocol":"both"}`,
		`{"forward_id":1,"revision":1,"protocol":"tcp"} {}`,
	} {
		if _, err := decodeOpen([]byte(raw)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func FuzzReadFrame(f *testing.F) {
	for _, seed := range []string{"08000000000000000000000000000008000000000000000000000000", "030000000000000000000001ffffffff00000000", "0400000000000000000000010000000000000000", "030000000000000000000001000000040000000001020304", "0600000000000000000000010000000200000001abcd"} {
		data, _ := hex.DecodeString(seed)
		f.Add(data)
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		frame, err := ReadFrame(bytes.NewReader(data))
		var reader frameReader
		defer reader.release()
		borrowed, readErr := reader.read(bytes.NewReader(data))
		if !errors.Is(readErr, err) || frame.Type != borrowed.Type ||
			frame.StreamID != borrowed.StreamID || frame.Sequence != borrowed.Sequence ||
			!bytes.Equal(frame.Payload, borrowed.Payload) {
			t.Fatal("session parser differs from public frame parser")
		}
		if err == nil {
			if len(frame.Payload) > MaxDatagram {
				t.Fatal("unbounded payload")
			}
			var out bytes.Buffer
			if WriteFrame(&out, frame) != nil {
				t.Fatal("decoded invalid frame")
			}
		}
	})
}

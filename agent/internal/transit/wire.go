package transit

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"regexp"

	"github.com/tunex/vnext/agent/internal/contracts"
)

const maxControlBytes = 4096

var requestIDPattern = regexp.MustCompile("^[0-9a-f]{32}$")

// Binding is an immutable *adjacent-hop* authorization descriptor. This is not
// a global network authorization: it has to be checked against a trusted plan.
type Binding struct {
	WireVersion          uint64 `json:"wireVersion"`
	ScopeID              string `json:"scopeId"`
	ForwardID            string `json:"forwardId"`
	DeploymentGeneration uint64 `json:"deploymentGeneration"`
	ProfileDigest        string `json:"profileDigest"`
	PathDigest           string `json:"pathDigest"`
	Protocol             string `json:"protocol"`
	FromNodeID           string `json:"fromNodeId"`
	FromAssignmentID     string `json:"fromAssignmentId"`
	FromSessionEpoch     uint64 `json:"fromSessionEpoch"`
	FromFence            uint64 `json:"fromFence"`
	ToNodeID             string `json:"toNodeId"`
	ToAssignmentID       string `json:"toAssignmentId"`
	ToSessionEpoch       uint64 `json:"toSessionEpoch"`
	ToFence              uint64 `json:"toFence"`
}
type Open struct {
	Type      string  `json:"type"`
	Action    string  `json:"action"`
	RequestID string  `json:"requestId"`
	Binding   Binding `json:"binding"`
}
type Reply struct {
	Type          string `json:"type"`
	RequestID     string `json:"requestId"`
	BindingDigest string `json:"bindingDigest"`
}

func bindingDigest(binding Binding) (string, error) {
	raw, err := json.Marshal(binding)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(raw)
	return "sha256:" + hex.EncodeToString(hash[:]), nil
}
func readMessage(in io.Reader, dest any) error {
	var header [4]byte
	if _, err := io.ReadFull(in, header[:]); err != nil {
		return err
	}
	length := binary.BigEndian.Uint32(header[:])
	if length < 2 || length > maxControlBytes {
		return fmt.Errorf("RESOURCE_LIMIT: Transit control frame")
	}
	raw := make([]byte, length)
	if _, err := io.ReadFull(in, raw); err != nil {
		return err
	}
	if _, err := contracts.ParseJSON(raw, maxControlBytes); err != nil {
		return err
	}
	dec := json.NewDecoder(bytesReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Transit wire message: %w", err)
	}
	if dec.Decode(new(any)) != io.EOF {
		return fmt.Errorf("INVALID_CONFIG: Trailing Transit wire data")
	}
	return nil
}
func bytesReader(raw []byte) io.Reader { return &sliceReader{data: raw} }

type sliceReader struct{ data []byte }

func (r *sliceReader) Read(buf []byte) (int, error) {
	if len(r.data) == 0 {
		return 0, io.EOF
	}
	n := copy(buf, r.data)
	r.data = r.data[n:]
	return n, nil
}
func writeMessage(out io.Writer, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(raw) > maxControlBytes {
		return fmt.Errorf("RESOURCE_LIMIT: Transit control frame")
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(raw)))
	for _, part := range [][]byte{header[:], raw} {
		for len(part) > 0 {
			n, err := out.Write(part)
			if err != nil {
				return err
			}
			if n == 0 {
				return io.ErrShortWrite
			}
			part = part[n:]
		}
	}
	return nil
}
func expectedInbound(vBinding Binding, got Open) error {
	if got.Type != "open" || !requestIDPattern.MatchString(got.RequestID) ||
		(got.Action != "tcp" && got.Action != "udp" && got.Action != "probe") ||
		got.Binding != vBinding {
		return fmt.Errorf("STALE_DEPLOYMENT: Transit Open binding mismatch")
	}
	if got.Action != "probe" && got.Action != vBinding.Protocol {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY: Transit protocol differs")
	}
	return nil
}
func validateReply(got Reply, requestID, digest string) error {
	if got.Type != "accepted" || got.RequestID != requestID || got.BindingDigest != digest {
		return fmt.Errorf("STALE_DEPLOYMENT: Transit acceptance not bound to request")
	}
	return nil
}

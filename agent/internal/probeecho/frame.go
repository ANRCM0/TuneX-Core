package probeecho

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

const FrameBytes = 256
const InvocationDomain = "tunex.probe.echo.invocation.v1"
const responseDomain = "tunex.echo.response.v1\x00"
const MeasurementTCP = "tcp-ingress-echo-v1"
const MeasurementUDP = "udp-ingress-echo-v1"
const MeasurementPathTCP = "tcp-path-echo-v1"
const MeasurementPathUDP = "udp-path-echo-v1"

func rawBase64(value string, size int) ([]byte, error) {
	raw, err := base64.StdEncoding.Strict().DecodeString(value)
	if err != nil || len(raw) != size || base64.StdEncoding.EncodeToString(raw) != value {
		return nil, invalid()
	}
	return raw, nil
}
func hashBytes(value string) ([]byte, error) {
	if len(value) != 71 || value[:7] != "sha256:" {
		return nil, invalid()
	}
	raw, err := hex.DecodeString(value[7:])
	if err != nil || len(raw) != 32 || hex.EncodeToString(raw) != value[7:] {
		return nil, invalid()
	}
	return raw, nil
}
func requestDigest(request []byte) string {
	hash := sha256.Sum256(request)
	return "sha256:" + hex.EncodeToString(hash[:])
}
func InvocationDigest(input Invocation) (string, error) {
	value, err := validated(input, ParseInvocation)
	if err != nil {
		return "", err
	}
	return contracts.ComputeDigest(value)
}
func RequestFrame(input Invocation, challenge Challenge) ([]byte, error) {
	hash, err := InvocationDigest(input)
	if err != nil {
		return nil, err
	}
	accepted, err := validated(challenge, ParseChallenge)
	if err != nil || input.Nonce != challenge.Nonce || hash != challenge.InvocationDigest {
		return nil, invalid()
	}
	nonce, err := rawBase64(accepted.Nonce, 32)
	if err != nil {
		return nil, err
	}
	contextHash, err := hashBytes(input.Service.ContextDigest)
	if err != nil {
		return nil, err
	}
	invocationHash, err := hashBytes(accepted.InvocationDigest)
	if err != nil {
		return nil, err
	}
	frame := make([]byte, FrameBytes)
	copy(frame, []byte("TNXECHOQ"))
	frame[8] = 1
	frame[9] = 1
	if IsUDP(input.Measurement) {
		frame[9] = 2
	}
	binary.BigEndian.PutUint64(frame[16:24], uint64(timestamp(input.ExpiresAt).UnixMilli()))
	copy(frame[24:56], nonce)
	copy(frame[56:88], contextHash)
	copy(frame[88:120], invocationHash)
	return frame, nil
}
func expectedResponse(request []byte) []byte {
	response := make([]byte, FrameBytes)
	copy(response[:120], request[:120])
	copy(response[:8], []byte("TNXECHOR"))
	hash := sha256.Sum256(request)
	copy(response[120:152], hash[:])
	return response
}
func VerifyProof(context ServiceContext, input Invocation, challenge Challenge, proof Proof) bool {
	raw, err := validated(context, ParseServiceContext)
	if err != nil || raw.Config.Version != 2 || raw.Selection != input.Service {
		return false
	}
	protocol := "tcp"
	if IsUDP(input.Measurement) {
		protocol = "udp"
	}
	if !supports(raw.Config, protocol) || timestamp(input.IssuedAt).UnixMilli() < int64(raw.Config.ValidFrom) || timestamp(input.ExpiresAt).UnixMilli() > int64(raw.Config.ValidUntil) {
		return false
	}
	value, err := validated(proof, ParseProof)
	if err != nil {
		return false
	}
	request, err := RequestFrame(input, challenge)
	if err != nil {
		return false
	}
	hash := sha256.Sum256(request)
	if value.RequestDigest != "sha256:"+hex.EncodeToString(hash[:]) {
		return false
	}
	key, err := rawBase64(raw.Config.Trust.PublicKey, ed25519.PublicKeySize)
	if err != nil {
		return false
	}
	signature, err := rawBase64(value.Signature, ed25519.SignatureSize)
	if err != nil {
		return false
	}
	response := expectedResponse(request)
	message := append([]byte(responseDomain), response[:192]...)
	return ed25519.Verify(ed25519.PublicKey(key), message, signature)
}
func VerifyEchoResponse(raw []byte, context ServiceContext, input Invocation, challenge Challenge) (*Proof, error) {
	request, err := RequestFrame(input, challenge)
	if err != nil || len(raw) != FrameBytes {
		return nil, invalid()
	}
	expected := expectedResponse(request)
	if !bytes.Equal(raw[:192], expected[:192]) {
		return nil, invalid()
	}
	hash := sha256.Sum256(request)
	proof := Proof{Algorithm: "Ed25519", RequestDigest: "sha256:" + hex.EncodeToString(hash[:]),
		Signature: base64.StdEncoding.EncodeToString(raw[192:]), Verified: true}
	if !VerifyProof(context, input, challenge, proof) {
		return nil, invalid()
	}
	return &proof, nil
}

// A decoded request owns fixed copies. Only DecodeEchoRequest can create a signable frame.
type EchoRequest struct {
	Nonce            string
	ContextDigest    string
	InvocationDigest string
	ExpiresAt        time.Time
	Transport        string
	frame            [FrameBytes]byte
	publicKey        [ed25519.PublicKeySize]byte
	decoded          bool
}

func DecodeEchoRequest(raw []byte, context ServiceContext, now time.Time, transport string) (*EchoRequest, error) {
	value, err := validated(context, ParseServiceContext)
	if err != nil || value.Config.Version != 2 || !supports(value.Config, transport) || now.UnixMilli() < 0 ||
		now.UnixMilli() < int64(value.Config.ValidFrom) || now.UnixMilli() >= int64(value.Config.ValidUntil) || len(raw) != FrameBytes {
		return nil, invalid()
	}
	wireTransport := byte(1)
	if transport == "udp" {
		wireTransport = 2
	} else if transport != "tcp" {
		return nil, invalid()
	}
	if string(raw[:8]) != "TNXECHOQ" || raw[8] != 1 || raw[9] != wireTransport || !bytes.Equal(raw[10:16], make([]byte, 6)) || !bytes.Equal(raw[120:], make([]byte, 136)) {
		return nil, invalid()
	}
	expiry := binary.BigEndian.Uint64(raw[16:24])
	if expiry > 253402300799999 {
		return nil, invalid()
	}
	until := time.UnixMilli(int64(expiry))
	if !until.After(now) || until.Sub(now) > 2*time.Second || expiry > value.Config.ValidUntil {
		return nil, invalid()
	}
	contextHash, err := hashBytes(value.ContextDigest)
	if err != nil || !bytes.Equal(contextHash, raw[56:88]) {
		return nil, invalid()
	}
	key, err := rawBase64(value.Config.Trust.PublicKey, ed25519.PublicKeySize)
	if err != nil {
		return nil, err
	}
	request := &EchoRequest{Nonce: base64.StdEncoding.EncodeToString(raw[24:56]), ContextDigest: value.ContextDigest,
		InvocationDigest: "sha256:" + hex.EncodeToString(raw[88:120]), ExpiresAt: until, Transport: transport, decoded: true}
	copy(request.frame[:], raw)
	copy(request.publicKey[:], key)
	return request, nil
}
func SignEchoResponse(request EchoRequest, key ed25519.PrivateKey) ([]byte, error) {
	if !request.decoded || len(key) != ed25519.PrivateKeySize {
		return nil, invalid()
	}
	derived := ed25519.NewKeyFromSeed(key.Seed())
	if !bytes.Equal(derived, key) || !bytes.Equal(derived[ed25519.SeedSize:], request.publicKey[:]) {
		return nil, invalid()
	}
	response := expectedResponse(request.frame[:])
	signature := ed25519.Sign(key, append([]byte(responseDomain), response[:192]...))
	copy(response[192:], signature)
	return response, nil
}

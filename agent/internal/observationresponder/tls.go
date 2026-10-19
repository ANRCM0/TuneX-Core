package observationresponder

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"fmt"
	"io"
	"os"
	"runtime"
	"time"
)

func readOperatorFile(path string, private bool) ([]byte, error) {
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Size() < 1 || before.Size() > MaximumPEMBytes {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: bounded regular operator file required")
	}
	if private {
		if runtime.GOOS != "linux" {
			return nil, fmt.Errorf("OBSERVATION_KEY_PERMISSION_UNVERIFIED: Linux ownership checks required; Windows ACLs and other platforms unsupported")
		}
		if !privateFileAllowed(before) {
			return nil, fmt.Errorf("OBSERVATION_KEY_PERMISSION_DENIED: effective-UID-owned private key with mode 0400 or 0600 required")
		}
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: operator file unavailable")
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !opened.Mode().IsRegular() || !os.SameFile(before, opened) || opened.Mode() != before.Mode() || opened.Size() != before.Size() {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: operator file changed while opening")
	}
	if private && !privateFileAllowed(opened) {
		return nil, fmt.Errorf("OBSERVATION_KEY_PERMISSION_DENIED: private-key ownership or mode changed while opening")
	}
	raw, err := io.ReadAll(io.LimitReader(file, MaximumPEMBytes+1))
	if err != nil || len(raw) < 1 || len(raw) > MaximumPEMBytes {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: bounded operator file read required")
	}
	after, err := file.Stat()
	if err != nil || after.Mode() != opened.Mode() || after.Size() != opened.Size() || !after.ModTime().Equal(opened.ModTime()) {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: operator file changed while reading")
	}
	if private && (!os.SameFile(opened, after) || !privateFileAllowed(after)) {
		return nil, fmt.Errorf("OBSERVATION_KEY_PERMISSION_DENIED: private-key ownership or mode changed while reading")
	}
	return raw, nil
}

func onePEM(raw []byte, certificate bool) (*pem.Block, error) {
	trimmed := bytes.TrimSpace(raw)
	block, rest := pem.Decode(trimmed)
	if block == nil || len(block.Headers) != 0 || len(bytes.TrimSpace(rest)) != 0 ||
		!bytes.HasPrefix(trimmed, []byte("-----BEGIN "+block.Type+"-----")) {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: exactly one unencrypted PEM block required")
	}
	if certificate {
		if block.Type != "CERTIFICATE" || len(block.Bytes) < 1 || len(block.Bytes) > MaximumLeafDERBytes {
			return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: exactly one bounded leaf certificate required")
		}
	} else if block.Type != "PRIVATE KEY" && block.Type != "EC PRIVATE KEY" && block.Type != "RSA PRIVATE KEY" {
		return nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: unencrypted operator private key required")
	}
	return block, nil
}

func exactServiceSAN(leaf *x509.Certificate, config configuration) bool {
	count := 0
	for _, extension := range leaf.Extensions {
		if !extension.Id.Equal(asn1.ObjectIdentifier{2, 5, 29, 17}) {
			continue
		}
		count++
		var sequence asn1.RawValue
		rest, err := asn1.Unmarshal(extension.Value, &sequence)
		if err != nil || len(rest) != 0 || sequence.Class != 0 || sequence.Tag != 16 || !sequence.IsCompound {
			return false
		}
		remaining := sequence.Bytes
		dns, uri := 0, 0
		for len(remaining) > 0 {
			var name asn1.RawValue
			remaining, err = asn1.Unmarshal(remaining, &name)
			if err != nil || name.Class != 2 || name.IsCompound {
				return false
			}
			switch name.Tag {
			case 2:
				if string(name.Bytes) != config.serverName {
					return false
				}
				dns++
			case 6:
				if string(name.Bytes) != config.uri {
					return false
				}
				uri++
			default:
				return false
			}
		}
		if dns != 1 || uri != 1 {
			return false
		}
	}
	return count == 1
}

func verifyLeaf(leaf *x509.Certificate, config configuration, now time.Time) error {
	if leaf == nil || len(leaf.Raw) < 1 || len(leaf.Raw) > MaximumLeafDERBytes || leaf.IsCA || len(leaf.ExtKeyUsage) != 1 ||
		leaf.ExtKeyUsage[0] != x509.ExtKeyUsageServerAuth || len(leaf.UnknownExtKeyUsage) != 0 || len(leaf.UnhandledCriticalExtensions) != 0 ||
		len(leaf.DNSNames) != 1 || leaf.DNSNames[0] != config.serverName || len(leaf.URIs) != 1 || leaf.URIs[0] == nil || leaf.URIs[0].String() != config.uri ||
		len(leaf.IPAddresses) != 0 || len(leaf.EmailAddresses) != 0 || now.Before(leaf.NotBefore) || !now.Before(leaf.NotAfter) ||
		!now.Before(config.validUntil) || config.validUntil.After(leaf.NotAfter) || !exactServiceSAN(leaf, config) {
		return fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: dedicated unexpired service server identity required")
	}
	switch key := leaf.PublicKey.(type) {
	case *rsa.PublicKey:
		if key.N == nil || key.N.BitLen() < 2048 || key.N.BitLen() > 8192 || key.E < 3 {
			return fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: bounded strong RSA server key required")
		}
	case *ecdsa.PublicKey:
		if key.Curve != elliptic.P256() && key.Curve != elliptic.P384() && key.Curve != elliptic.P521() {
			return fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: supported ECDSA server key required")
		}
	case ed25519.PublicKey:
		if len(key) != ed25519.PublicKeySize {
			return fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: Ed25519 server key required")
		}
	default:
		return fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: supported dedicated server key required")
	}
	return nil
}

func loadTLS(config configuration) (*tls.Config, *x509.Certificate, error) {
	certificatePEM, err := readOperatorFile(config.certificatePath, false)
	if err != nil {
		return nil, nil, err
	}
	keyPEM, err := readOperatorFile(config.privateKeyPath, true)
	if err != nil {
		return nil, nil, err
	}
	certificateBlock, err := onePEM(certificatePEM, true)
	if err != nil {
		return nil, nil, err
	}
	if _, err := onePEM(keyPEM, false); err != nil {
		return nil, nil, err
	}
	leaf, err := x509.ParseCertificate(certificateBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: valid leaf DER required")
	}
	if err := verifyLeaf(leaf, config, time.Now()); err != nil {
		return nil, nil, err
	}
	certificate, err := tls.X509KeyPair(certificatePEM, keyPEM)
	if err != nil || len(certificate.Certificate) != 1 {
		return nil, nil, fmt.Errorf("OBSERVATION_CREDENTIAL_INVALID: dedicated matching leaf and private key required")
	}
	certificate.Leaf = leaf
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13,
		NextProtos: []string{ALPN}, SessionTicketsDisabled: true, ClientAuth: tls.NoClientCert}
	tlsConfig.GetConfigForClient = func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
		if hello.ServerName != config.serverName || len(hello.SupportedProtos) != 1 || hello.SupportedProtos[0] != ALPN {
			return nil, fmt.Errorf("OBSERVATION_TLS_REFUSED: exact service SNI and dedicated ALPN required")
		}
		if err := verifyLeaf(leaf, config, time.Now()); err != nil {
			return nil, err
		}
		return nil, nil
	}
	tlsConfig.GetCertificate = func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
		if err := verifyLeaf(leaf, config, time.Now()); err != nil {
			return nil, err
		}
		return &certificate, nil
	}
	tlsConfig.VerifyConnection = func(state tls.ConnectionState) error {
		if state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != ALPN || state.ServerName != config.serverName || state.DidResume {
			return fmt.Errorf("OBSERVATION_TLS_REFUSED: dedicated fresh TLS 1.3 handshake required")
		}
		return verifyLeaf(leaf, config, time.Now())
	}
	return tlsConfig, leaf, nil
}

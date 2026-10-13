package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"github.com/tunex/vnext/agent/internal/state"
)

// The request has the real current binding. Failure cannot be credited to malformed Open data.
func relayNegative(host string, port int, caPath, certificatePath, keyPath, node, pin, openPath, bundlePath, protectionKey string, oldTLS bool) error {
	ca, err := os.ReadFile(caPath)
	if err != nil {
		return err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		return fmt.Errorf("Trusted CA required")
	}
	var certificate tls.Certificate
	if bundlePath != "" {
		key, loadErr := os.ReadFile(protectionKey)
		if loadErr != nil || len(key) != 32 {
			return fmt.Errorf("Protected old Relay key required")
		}
		bundle, loadErr := state.Load(bundlePath, key)
		if loadErr != nil {
			return loadErr
		}
		var identity struct {
			Certificate string `json:"certificate"`
			PrivateKey  string `json:"privateKey"`
		}
		if _, err := contracts.ParseJSON(bundle.Snapshot, 32768); err != nil {
			return err
		}
		if err := json.Unmarshal(bundle.Snapshot, &identity); err != nil {
			return err
		}
		certificate, err = tls.X509KeyPair([]byte(identity.Certificate), []byte(identity.PrivateKey))
	} else {
		certificate, err = tls.LoadX509KeyPair(certificatePath, keyPath)
	}
	if err != nil {
		return fmt.Errorf("Fixture keypair unavailable")
	}
	raw, err := os.ReadFile(openPath)
	if err != nil {
		return err
	}
	var open relaycontracts.Open
	if err := relaycontracts.Parse("Open", raw, &open); err != nil {
		return err
	}
	hash, err := contracts.ComputeDigest(open.Binding)
	if err != nil {
		return err
	}
	config, err := relay.TLSConfig(certificate, roots, node, []string{pin}, false)
	if err != nil {
		return err
	}
	if oldTLS {
		config.MinVersion = tls.VersionTLS12
		config.MaxVersion = tls.VersionTLS12
	}
	socket, err := net.DialTimeout("tcp", net.JoinHostPort(host, fmt.Sprint(port)), 2*time.Second)
	if err != nil {
		return fmt.Errorf("Live internal Relay listener required")
	}
	defer socket.Close()
	socket.SetDeadline(time.Now().Add(3 * time.Second))
	client := tls.Client(socket, config)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	rejected := false
	if err := client.HandshakeContext(ctx); err != nil {
		rejected = true
	} else if err := relay.WriteControl(client, "Open", open); err != nil {
		rejected = true
	} else if err := relay.ReadReply(client, open.RequestId, hash); err != nil {
		rejected = true
	}
	if !rejected {
		return fmt.Errorf("Invalid identity/protocol accepted a real deployment probe")
	}
	return json.NewEncoder(os.Stdout).Encode(map[string]any{"rejected": true, "oldTLS": oldTLS, "currentBinding": true})
}

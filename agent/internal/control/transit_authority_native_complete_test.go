package control

import (
	"bytes"
	"crypto/x509"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/state"
)

func transitAuthorityNativeDownstream(t *testing.T, raw []byte, port uint64) []byte {
	t.Helper()
	var snapshot map[string]any
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	assignment := snapshot["assignments"].([]any)[0].(map[string]any)
	driver := assignment["driver"].(map[string]any)
	config := driver["config"].(map[string]any)
	intent := config["intent"].(map[string]any)
	intent["downstream"].(map[string]any)["endpoint"] = map[string]any{"host": "127.0.0.1", "port": port}
	driver["configDigest"] = transitRunnerHash(t, config)
	delete(snapshot, "snapshotDigest")
	snapshot["snapshotDigest"] = transitRunnerHash(t, snapshot)
	result, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adp3transit.ParseSnapshot(result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestTransitAuthorityNativeCompleteFailedPreparationAndActivationRetainFence(t *testing.T) {
	for _, mode := range []string{"prepare", "activate"} {
		t.Run(mode, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "transit.journal")
			key := bytes.Repeat([]byte{62}, 32)
			if err := state.InitializeTransitJournal(path, key, "node-b"); err != nil {
				t.Fatal(err)
			}
			certificate, roots := transitRunnerIdentity(t)
			if mode == "prepare" {
				roots = x509.NewCertPool()
			}
			phase := "prepared"
			if mode == "activate" {
				phase = "active"
			}
			raw := transitRunnerSnapshot(t, 8, 10, 32210, phase)
			var downstream net.Listener
			var done chan struct{}
			if mode == "activate" {
				var err error
				downstream, err = net.Listen("tcp", "127.0.0.1:0")
				if err != nil {
					t.Fatal(err)
				}
				defer downstream.Close()
				done = make(chan struct{})
				go func() {
					defer close(done)
					connection, err := downstream.Accept()
					if err == nil {
						connection.Close()
					}
				}()
				raw = transitAuthorityNativeDownstream(t, raw, uint64(downstream.Addr().(*net.TCPAddr).Port))
			}
			advertised := []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"}
			controller, err := NewTransitController(path, key, "node-b", 8, advertised, certificate, roots, func() error { return nil }, func(adp3transit.Assignment) error { return nil })
			if err != nil {
				t.Fatal(err)
			}
			defer controller.Close()
			observations, err := controller.ApplyTransitSnapshot(raw)
			if err != nil || len(observations) != 1 || observations[0].Condition != "error" || observations[0].ErrorCode == "" || len(controller.engines) != 0 {
				t.Fatal("native failed engine incorrectly published", err, observations)
			}
			if mode == "prepare" && observations[0].ErrorCode != "AUTHENTICATION_FAILED" {
				t.Fatal("native preparation did not reject untrusted local identity", observations)
			}
			if done != nil {
				select {
				case <-done:
				case <-time.After(5 * time.Second):
					t.Fatal("native activation never contacted downstream")
				}
			}
			stored, err := state.LoadTransitJournal(path, key, "node-b")
			if err != nil || stored.Generation != 10 || stored.Fences["tcp/32210"] != 9 || stored.Digest == "" {
				t.Fatal("native engine failure lost high-water", err, stored)
			}
			controller.Close()
			before, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			restart, err := NewTransitController(path, key, "node-b", 8, advertised, certificate, roots, func() error { return nil }, func(adp3transit.Assignment) error { t.Fatal("cached snapshot attempted port reservation"); return nil })
			if err != nil {
				t.Fatal(err)
			}
			defer restart.Close()
			if len(restart.engines) != 0 {
				t.Fatal("restart resumed cached engine")
			}
			if generation, digest := restart.CurrentJournal(); generation != 10 || digest != stored.Digest {
				t.Fatal("restart lost committed generation/digest", generation, digest)
			}
			if result, err := restart.ApplyTransitSnapshot(raw); err == nil || result != nil || !strings.HasPrefix(err.Error(), "FENCING_REJECTED:") {
				t.Fatal("native failure replay accepted", err, result)
			}
			after, err := os.ReadFile(path)
			if err != nil || !bytes.Equal(before, after) {
				t.Fatal("restart/replay rewrote retained history", err)
			}
		})
	}
}

func TestTransitAuthorityNativeCompleteActiveAndDrainingLegacyPortRefusal(t *testing.T) {
	const port = uint64(32210)
	assignment := adp3transit.Assignment{Resource: adp3transit.Resource{Port: port, Protocol: "tcp"}}
	for _, mode := range []string{"historical", "retired", "active", "draining-tcp", "draining-udp", "different-port"} {
		t.Run(mode, func(t *testing.T) {
			runner := &Runner{journal: state.Journal{Fences: map[string]uint64{}, Retired: map[string]uint64{}}, instances: map[string]running{}, drains: map[string]draining{}}
			switch mode {
			case "historical":
				runner.journal.Fences["tcp/32210"] = 9
			case "retired":
				runner.journal.Retired["tcp/32210"] = 9
			case "active":
				runner.instances["tcp/32210"] = running{}
			case "draining-tcp", "draining-udp", "different-port":
				protocol := "tcp"
				drainPort := port
				if mode == "draining-udp" {
					protocol = "udp"
				}
				if mode == "different-port" {
					drainPort++
				}
				runner.drains["old"] = draining{instance: running{assignment: adp3.Assignment{Resource: adp3.Resource{Port: drainPort, Protocol: protocol}}}}
			}
			err := runner.transitPhysicalGuard(assignment)
			denied := mode == "historical" || mode == "retired" || mode == "active" || mode == "draining-tcp"
			if (err != nil) != denied {
				t.Fatal("original physical guard classification", mode, err)
			}
			if mode == "historical" || mode == "retired" {
				if !strings.HasPrefix(err.Error(), "FENCING_REJECTED:") {
					t.Fatal(err)
				}
			} else if denied && !strings.HasPrefix(err.Error(), "PORT_RESERVED:") {
				t.Fatal(err)
			}
		})
	}
}

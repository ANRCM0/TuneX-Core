// Package agentcli owns native effects and external arguments of the Agent CLI.
package agentcli

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/tunex/vnext/agent/internal/agentenrollment"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
	"github.com/tunex/vnext/agent/internal/state"
)

const InterfaceVersion uint64 = 2

type Paths struct{ Root, KeyPath, Certificate, PrivateKey, Journal string }

type Native struct{}

func (Native) TrustedControlURL(url string) bool { return strings.HasPrefix(url, "https://") }

func (Native) ResolvePaths(directory, journalKey, timeProof, timeProofKey string) (Paths, error) {
	root, err := filepath.Abs(directory)
	if err != nil {
		return Paths{}, err
	}
	if err := authorization.ValidateProofBoundary(timeProof, timeProofKey, root); err != nil {
		return Paths{}, err
	}
	keyPath, err := filepath.Abs(journalKey)
	if err != nil {
		return Paths{}, err
	}
	if rel, err := filepath.Rel(root, keyPath); err == nil && (rel == "." || !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
		return Paths{}, fmt.Errorf("Journal MAC key must be outside the state directory")
	}
	return Paths{Root: root, KeyPath: keyPath, Certificate: filepath.Join(root, "node.pem"),
		PrivateKey: filepath.Join(root, "private.pem"), Journal: filepath.Join(root, "journal.json")}, nil
}

func (Native) InspectJournal(journal, keyPath, node string) error {
	key, err := os.ReadFile(keyPath)
	if err != nil || len(key) != 32 {
		return fmt.Errorf("JOURNAL_INSPECTION_FAILED")
	}
	summary, err := state.InspectRuntimeJournal(journal, key, node)
	if err != nil {
		return fmt.Errorf("JOURNAL_INSPECTION_FAILED")
	}
	return json.NewEncoder(os.Stdout).Encode(summary)
}

func (Native) Enroll(options executionenrollment.Options) error {
	token := os.Getenv("TUNEX_ENROLLMENT_TOKEN")
	host := agentenrollment.Native()
	host.Completed = func() { fmt.Println("Node enrolled; journal initialized without execution authorization") }
	return host.Enroll(options, token)
}

func (Native) AcquireInstance(root string) (func(), error) {
	return state.AcquireLock(filepath.Join(root, "instance.lock"))
}

func (Native) BootID() (string, error) {
	boot := make([]byte, 16)
	if _, err := rand.Read(boot); err != nil {
		return "", err
	}
	return hex.EncodeToString(boot), nil
}

func (Native) DiagnosticsPath(root string) string {
	return filepath.Join(root, "diagnostics", "status.json")
}

func (Native) RunWithSignals(run func(context.Context) error) error {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	return run(ctx)
}

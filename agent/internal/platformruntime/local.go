package platformruntime

import (
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"

	"github.com/tunex/vnext/agent/internal/state"
)

type Local struct{}

func (Local) ReadRandom(destination []byte) (int, error) { return rand.Read(destination) }

func (Local) WriteDiagnostics(path string, encoded []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return state.AtomicWrite(path, encoded)
}

func (Local) WriteForwardCounters(diagnosticsPath string, encoded []byte) error {
	directory := filepath.Dir(diagnosticsPath)
	if err := os.MkdirAll(directory, 0700); err != nil {
		return err
	}
	return state.AtomicWrite(filepath.Join(directory, "forward-counters.json"), encoded)
}

func (Local) Warn(values ...any) { fmt.Fprintln(os.Stderr, values...) }

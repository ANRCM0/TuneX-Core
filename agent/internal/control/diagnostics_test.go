package control

import (
	"encoding/json"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/state"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDiagnosticsIsAggregateLocalDataAndDoesNotReplaceAuthority(t *testing.T) {
	sample := authorization.Sample{Wall: time.Now().UTC(), Uptime: time.Hour}
	guard, err := authorization.New(func() (authorization.Sample, error) { return sample, nil }, 5*time.Second, 300*time.Second, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := guard.Accept(sample.Wall, sample.Wall.Add(300*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "diagnostics", "status.json")
	runner := &Runner{options: Options{Diagnostics: path}, instances: make(map[string]running), journal: state.Journal{Generation: 7}, ticket: ticket}
	if err := runner.writeDiagnostics(false); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var actual map[string]any
	if err := json.Unmarshal(raw, &actual); err != nil {
		t.Fatal(err)
	}
	if actual["authorizationActive"] != true || actual["snapshotGeneration"] != float64(7) || actual["tcpStreams"] != float64(0) {
		t.Fatal("incorrect aggregate", actual)
	}
	if _, exists := actual["privateKey"]; exists {
		t.Fatal("private key leaked")
	}
	if err := runner.writeDiagnostics(true); err != nil {
		t.Fatal(err)
	}
	raw, _ = os.ReadFile(path)
	json.Unmarshal(raw, &actual)
	if actual["authorizationActive"] != false {
		t.Fatal("final sample looked live")
	}
}

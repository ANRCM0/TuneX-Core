package platformruntime

import (
	"bytes"
	"crypto/x509"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

var _ runtimeplatform.Bootstrap[*x509.CertPool] = Bootstrap{}
var _ func(string, []byte, string) (executionstate.RuntimeJournal, error) = Bootstrap{}.LoadRuntime
var _ func(string, []byte, string, string) (executionstate.RuntimeJournal, error) = Bootstrap{}.EnableRuntime

func TestJournalProviderCompleteBootstrapInterfaceTwoExactConsumerMethodSets(t *testing.T) {
	if InterfaceVersion != 2 || runtimeplatform.InterfaceVersion != 2 || executionstate.InterfaceVersion != 4 {
		t.Fatal("native/lower provider contract versions changed")
	}
	provider := reflect.TypeOf((*runtimeplatform.Bootstrap[*x509.CertPool])(nil)).Elem()
	expected := map[string]reflect.Type{
		"ValidateProofBoundary": reflect.TypeOf((func(string, string, string) error)(nil)),
		"LoadRoots":             reflect.TypeOf((func(string) (*x509.CertPool, error))(nil)),
		"LoadProtectionKey":     reflect.TypeOf((func(string) ([]byte, error))(nil)),
		"LoadRuntime":           reflect.TypeOf((func(string, []byte, string) (executionstate.RuntimeJournal, error))(nil)),
		"EnableRuntime":         reflect.TypeOf((func(string, []byte, string, string) (executionstate.RuntimeJournal, error))(nil)),
	}
	if provider.NumMethod() != len(expected) || reflect.TypeOf(Bootstrap{}).NumMethod() != len(expected) {
		t.Fatal("Bootstrap method set changed")
	}
	for name, kind := range expected {
		method, ok := provider.MethodByName(name)
		if !ok || method.Type != kind {
			t.Fatalf("Bootstrap consumer method %s: %v", name, method.Type)
		}
	}
}

func TestJournalProviderCompleteBootstrapNativeLoadEnableAndOriginalErrorValues(t *testing.T) {
	path, key := filepath.Join(t.TempDir(), "runtime"), bytes.Repeat([]byte{5}, 32)
	if err := state.InitializeRuntimeJournal(path, key, "node"); err != nil {
		t.Fatal(err)
	}
	native, err := state.LoadRuntimeJournal(path, key, "node")
	if err != nil {
		t.Fatal(err)
	}
	var provider runtimeplatform.Bootstrap[*x509.CertPool] = Bootstrap{}
	facts, err := provider.LoadRuntime(path, key, "node")
	if err != nil || !reflect.DeepEqual(facts, state.RuntimeJournalFacts(native)) {
		t.Fatalf("Bootstrap did not expose lower history facts: %#v %v", facts, err)
	}
	enabled, err := provider.EnableRuntime(path, key, "node", "")
	if err != nil || enabled.ExecutionExtension == nil || *enabled.ExecutionExtension != 1 || enabled.FormatVersion != 3 || enabled.ImportedHistoryDigest != "" {
		t.Fatalf("explicit native enable projection %#v %v", enabled, err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	returned, err := provider.EnableRuntime(path, key, "node", filepath.Join(t.TempDir(), "missing-transit"))
	if err == nil || !reflect.DeepEqual(returned, enabled) {
		t.Fatalf("native enable error discarded authenticated current facts %#v %v", returned, err)
	}
	after, readErr := os.ReadFile(path)
	if readErr != nil || !bytes.Equal(before, after) {
		t.Fatal("failed old-history load reset current Runtime", readErr)
	}
	for _, bad := range []struct {
		key  []byte
		node string
	}{{key[:31], "node"}, {key, "foreign"}} {
		native, nativeErr := state.LoadRuntimeJournal(path, bad.key, bad.node)
		actual, actualErr := provider.LoadRuntime(path, bad.key, bad.node)
		if nativeErr == nil || actualErr == nil || nativeErr.Error() != actualErr.Error() || !reflect.DeepEqual(actual, state.RuntimeJournalFacts(native)) {
			t.Fatalf("Bootstrap native error/value projection changed: %#v %v / %v", actual, actualErr, nativeErr)
		}
	}
}

package nativeexecution

import (
	"testing"

	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/forward"
)

type udpDiagnosticsCompleteLookalike struct { executionhost.Instance }
func (udpDiagnosticsCompleteLookalike) Stats() forward.UDPStats { panic("lookalike Stats must not run") }
type udpDiagnosticsCompleteEmbedded struct { *forward.UDP }

func TestUDPDiagnosticsCompleteExactNativeTypeAndNilBehavior(t *testing.T) {
	for _, instance := range []executionhost.Instance{nil, udpDiagnosticsCompleteLookalike{}, udpDiagnosticsCompleteEmbedded{&forward.UDP{}}} {
		if got, ok := ReadUDPDiagnostics(instance); ok || got != (UDPDiagnosticDrops{}) { t.Fatalf("non-exact native UDP accepted: %T %+v %v", instance, got, ok) }
	}
	if got, ok := ReadUDPDiagnostics(&forward.UDP{}); !ok || got != (UDPDiagnosticDrops{}) { t.Fatalf("zero native UDP: %+v %v", got, ok) }
	// The original exact assertion succeeds for typed nil, then Stats dereferences it.
	defer func() { if recover() == nil { t.Fatal("typed nil native behavior silently changed") } }()
	var typedNil *forward.UDP
	ReadUDPDiagnostics(typedNil)
}

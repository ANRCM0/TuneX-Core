package platformclock

import (
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

type SyncStatus struct {
	Host          string `json:"host"`
	Source        string `json:"source"`
	Synchronized  bool   `json:"synchronized"`
	MaxErrorNanos int64  `json:"maxErrorNanos"`
	ObservedAt    string `json:"observedAt"`
}

// Invalid native fields remain facts so rejection keeps its original decision stage.
func SynchronizationFacts(status SyncStatus) executiontime.SyncStatus {
	observed, err := time.Parse(time.RFC3339Nano, status.ObservedAt)
	return executiontime.SyncStatus{Host: status.Host, Source: status.Source,
		Synchronized: status.Synchronized, MaxErrorNanos: status.MaxErrorNanos,
		ObservedAt: observed, ObservationValid: err == nil,
		SourceAccepted: status.Source == "linux-adjtimex" || status.Source == "windows-w32time"}
}

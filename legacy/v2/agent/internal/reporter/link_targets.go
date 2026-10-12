package reporter

import (
	"github.com/tunex/agent/internal/tstruntime"
	"time"
)

// Nullable fields are mandatory in the closed Panel contract. Unknown values
// must serialize as null, rather than disappear through runtime omitempty tags.
type LinkTargetStatus struct {
	ForwardID     int64    `json:"forward_id"`
	States        []string `json:"states"`
	SelectedTCP   *int     `json:"selected_tcp"`
	SelectedUDP   *int     `json:"selected_udp"`
	LastCheckedAt *string  `json:"last_checked_at"`
	Reason        string   `json:"reason"`
}

func reportedTargetStatus(role string, in []tstruntime.TargetStatus) []LinkTargetStatus {
	if role != "egress" || len(in) > 500 {
		return nil
	}
	out := make([]LinkTargetStatus, 0, len(in))
	seen := map[int64]bool{}
	for _, fact := range in {
		if fact.ForwardID < 1 || fact.ForwardID > 2147483647 || seen[fact.ForwardID] || len(fact.States) < 1 || len(fact.States) > 10 {
			return nil
		}
		seen[fact.ForwardID] = true
		for _, state := range fact.States {
			if fact.LastCheckedAt == nil && state != "unknown" {
				return nil
			}
			switch state {
			case "unknown", "healthy", "suspect", "recovering", "unhealthy":
			default:
				return nil
			}
		}
		for _, index := range []*int{fact.SelectedTCP, fact.SelectedUDP} {
			if index != nil && (*index < 0 || *index >= len(fact.States)) {
				return nil
			}
		}
		switch fact.Reason {
		case "initial", "selected", "target_failed", "target_recovered", "all_unavailable":
		default:
			return nil
		}
		if fact.LastCheckedAt != nil {
			if !trafficAckPattern.MatchString(*fact.LastCheckedAt) {
				return nil
			}
			if _, err := time.Parse(time.RFC3339Nano, *fact.LastCheckedAt); err != nil {
				return nil
			}
		}
		fact.States = append([]string(nil), fact.States...)
		if fact.SelectedTCP != nil {
			n := *fact.SelectedTCP
			fact.SelectedTCP = &n
		}
		if fact.SelectedUDP != nil {
			n := *fact.SelectedUDP
			fact.SelectedUDP = &n
		}
		if fact.LastCheckedAt != nil {
			stamp := *fact.LastCheckedAt
			fact.LastCheckedAt = &stamp
		}
		out = append(out, LinkTargetStatus{ForwardID: fact.ForwardID, States: fact.States,
			SelectedTCP: fact.SelectedTCP, SelectedUDP: fact.SelectedUDP,
			LastCheckedAt: fact.LastCheckedAt, Reason: fact.Reason})
	}
	return out
}

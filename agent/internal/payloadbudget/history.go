// Package payloadbudget owns shared payload admission decisions through injected
// clocks and the original Runtime Journal. It opens no files and grants no leases.
package payloadbudget

import (
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
)

const InterfaceVersion uint64 = 1
const HistoryVersion uint64 = 1
const MaxBuckets = 1024
const MaxCounter uint64 = 9007199254740991
const MaxWallMillis int64 = 253402300799999
const MinWallMillis int64 = -62167219200000

var ErrPolicyChanged = errors.New("RESOURCE_LIMIT: Payload policy revision changed")
var ErrExhausted = errors.New("RESOURCE_LIMIT: Shared payload budget exhausted")
var ErrPeriod = errors.New("RESOURCE_LIMIT: Shared payload period is not active")

type Binding struct {
	BucketID, ScopeID, ActorID, NodeID string
	StartsAt, EndsAt                   int64
}

type Policy struct {
	Binding
	Revision       uint64
	BytesPerSecond *uint64
	BurstBytes     uint64
	ByteLimit      *uint64
}

type Record struct {
	Policy
	Consumed uint64
}

// History is a pure projection; its native encoding and MAC remain state-owned.
type History struct {
	Version uint64
	Buckets map[string]Record
}

func validIdentifier(id string) bool {
	if len(id) == 0 || len(id) > 128 {
		return false
	}
	for index := 0; index < len(id); index++ {
		value := id[index]
		if value >= 'A' && value <= 'Z' || value >= 'a' && value <= 'z' || value >= '0' && value <= '9' {
			continue
		}
		if index > 0 && (value == '.' || value == '_' || value == ':' || value == '-') {
			continue
		}
		return false
	}
	return true
}

func ValidatePolicy(policy Policy) error {
	for _, id := range []string{policy.BucketID, policy.ScopeID, policy.ActorID, policy.NodeID} {
		if !validIdentifier(id) {
			return fmt.Errorf("INTEGRITY_FAILURE: Invalid payload bucket identity")
		}
	}
	if policy.StartsAt < MinWallMillis || policy.EndsAt <= policy.StartsAt || policy.EndsAt > MaxWallMillis ||
		policy.Revision < 1 || policy.Revision > MaxCounter || policy.BurstBytes < 1 || policy.BurstBytes > 65536 ||
		policy.BytesPerSecond == nil && policy.ByteLimit == nil ||
		policy.BytesPerSecond != nil && *policy.BytesPerSecond > MaxCounter || policy.ByteLimit != nil && *policy.ByteLimit > MaxCounter {
		return fmt.Errorf("INTEGRITY_FAILURE: Invalid payload bucket policy")
	}
	return nil
}

func SamePolicy(a, b Policy) bool {
	return a.Binding == b.Binding && a.Revision == b.Revision && a.BurstBytes == b.BurstBytes && sameLimit(a.BytesPerSecond, b.BytesPerSecond) && sameLimit(a.ByteLimit, b.ByteLimit)
}

func sameLimit(a, b *uint64) bool { return a == nil && b == nil || a != nil && b != nil && *a == *b }

func ClonePolicy(policy Policy) Policy {
	if policy.BytesPerSecond != nil {
		value := *policy.BytesPerSecond
		policy.BytesPerSecond = &value
	}
	if policy.ByteLimit != nil {
		value := *policy.ByteLimit
		policy.ByteLimit = &value
	}
	return policy
}

func overlap(a, b Binding) bool {
	return a.ScopeID == b.ScopeID && a.ActorID == b.ActorID && a.NodeID == b.NodeID && a.StartsAt < b.EndsAt && b.StartsAt < a.EndsAt
}

func ValidateHistory(history *History, node string) error {
	if history == nil {
		return nil
	}
	if history.Version != HistoryVersion || history.Buckets == nil || len(history.Buckets) < 1 || len(history.Buckets) > MaxBuckets {
		return fmt.Errorf("INTEGRITY_FAILURE: Invalid protected payload history")
	}
	bindings := make([]Binding, 0, len(history.Buckets))
	for id, record := range history.Buckets {
		if err := ValidatePolicy(record.Policy); err != nil {
			return err
		}
		if id != record.BucketID || record.NodeID != node || record.Consumed > MaxCounter {
			return fmt.Errorf("INTEGRITY_FAILURE: Payload history binding differs")
		}
		// A consumed value above a lowered limit is intentional and remains exhausted.
		bindings = append(bindings, record.Binding)
	}
	slices.SortFunc(bindings, func(a, b Binding) int {
		for _, pair := range [][2]string{{a.ScopeID, b.ScopeID}, {a.ActorID, b.ActorID}, {a.NodeID, b.NodeID}} {
			if order := strings.Compare(pair[0], pair[1]); order != 0 {
				return order
			}
		}
		if a.StartsAt < b.StartsAt {
			return -1
		}
		if a.StartsAt > b.StartsAt {
			return 1
		}
		return strings.Compare(a.BucketID, b.BucketID)
	})
	for index := 1; index < len(bindings); index++ {
		if overlap(bindings[index-1], bindings[index]) {
			return fmt.Errorf("INTEGRITY_FAILURE: Overlapping protected payload periods")
		}
	}
	return nil
}

func ValidateRetainedPolicies(history *History, policies []Policy, node string) error {
	if err := ValidateHistory(history, node); err != nil {
		return err
	}
	for _, policy := range policies {
		if history == nil {
			return fmt.Errorf("INTEGRITY_FAILURE: Retained Snapshot lacks protected payload history")
		}
		record, exists := history.Buckets[policy.BucketID]
		if !exists || !SamePolicy(record.Policy, policy) {
			return fmt.Errorf("INTEGRITY_FAILURE: Retained payload policy differs")
		}
	}
	return nil
}

// AcceptHistory retains every old bucket, including removed and expired policies.
func AcceptHistory(history *History, policies []Policy, node string) (*History, error) {
	if err := ValidateHistory(history, node); err != nil {
		return history, err
	}
	if history == nil && len(policies) == 0 {
		return nil, nil
	}
	next := &History{Version: HistoryVersion, Buckets: map[string]Record{}}
	if history != nil {
		next.Buckets = maps.Clone(history.Buckets)
	}
	seen := map[string]bool{}
	for _, policy := range policies {
		if err := ValidatePolicy(policy); err != nil {
			return history, err
		}
		if policy.NodeID != node || seen[policy.BucketID] {
			return history, fmt.Errorf("INTEGRITY_FAILURE: Duplicate or foreign payload bucket")
		}
		seen[policy.BucketID] = true
		old, exists := next.Buckets[policy.BucketID]
		if exists && (old.Binding != policy.Binding || policy.Revision < old.Revision || policy.Revision == old.Revision && !SamePolicy(old.Policy, policy)) {
			return history, fmt.Errorf("INTEGRITY_FAILURE: Payload binding or policy revision regressed")
		}
		if !exists && len(next.Buckets) >= MaxBuckets {
			return history, fmt.Errorf("RESOURCE_LIMIT: Protected payload history capacity exhausted")
		}
		next.Buckets[policy.BucketID] = Record{Policy: ClonePolicy(policy), Consumed: old.Consumed}
	}
	if err := ValidateHistory(next, node); err != nil {
		return history, err
	}
	return next, nil
}

// Debit is used only under the original Journal file lock after authenticated load.
func Debit(history *History, policy Policy, count uint64, at int64) (Record, error) {
	if history == nil {
		return Record{}, fmt.Errorf("INTEGRITY_FAILURE: Missing protected payload history")
	}
	record, exists := history.Buckets[policy.BucketID]
	if !exists || record.Binding != policy.Binding {
		return Record{}, fmt.Errorf("INTEGRITY_FAILURE: Payload debit binding differs")
	}
	if !SamePolicy(record.Policy, policy) {
		return record, ErrPolicyChanged
	}
	if at < record.StartsAt || at >= record.EndsAt {
		return record, ErrPeriod
	}
	if record.Consumed >= MaxCounter || record.BytesPerSecond != nil && *record.BytesPerSecond == 0 || count > MaxCounter-record.Consumed || record.ByteLimit != nil && (record.Consumed >= *record.ByteLimit || count > *record.ByteLimit-record.Consumed) {
		return record, ErrExhausted
	}
	record.Consumed += count
	return record, nil
}

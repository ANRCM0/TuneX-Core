package executionstate

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

// A persistence error does not tell the caller whether the replacement reached
// durable storage. Both outcomes must return the original authority to the caller.
type completeUncertainStore struct {
	*bStageStore
	committed bool
}

func (s *completeUncertainStore) Save(value RuntimeJournal) error {
	*s.events = append(*s.events, "save")
	s.saved = value
	if s.committed {
		s.durable = value
	}
	return s.saveErr
}

func TestRuntimeCompleteUnknownPersistenceOutcomeCannotReturnNewAuthorityOrTrustStaleCaller(t *testing.T) {
	for _, committed := range []bool{false, true} {
		t.Run(map[bool]string{false: "not-durable", true: "durable-before-error"}[committed], func(t *testing.T) {
			current, incoming := bStageFixture()
			prior := incoming
			prior.SnapshotGeneration = current.Journal.Generation
			events := []string{}
			failure := errors.New("persistence outcome uncertain")
			store := &completeUncertainStore{bStageStore: &bStageStore{events: &events, durable: current, saveErr: failure}, committed: committed}
			codec := &bStageCodec{events: &events, support: true, prior: prior}
			host := RuntimeHost{Store: store, Codec: codec}
			input := bStageInput{events: &events, history: incoming, raw: []byte("authenticated-original-input")}
			result, err := host.Accept(current, input)
			if !errors.Is(err, failure) || !strings.HasPrefix(err.Error(), "PERSISTENCE_FAILURE: ") || !reflect.DeepEqual(result, current) {
				t.Fatalf("unknown persistence returned authority: %#v %v", result, err)
			}
			if !reflect.DeepEqual(events, []string{"lock", "load:node", "input", "supports:99", "decode", "slot:custom[opaque-transport;17]", "save", "unlock"}) {
				t.Fatalf("first acceptance order: %v", events)
			}
			events = nil
			store.saveErr = nil
			result, err = host.Accept(current, input)
			if committed {
				if err == nil || !strings.Contains(err.Error(), "Caller Runtime state is stale") || !reflect.DeepEqual(result, current) {
					t.Fatalf("committed replacement trusted old caller: %#v %v", result, err)
				}
				if !reflect.DeepEqual(events, []string{"lock", "load:node", "unlock"}) {
					t.Fatalf("stale caller encoded or saved before reload refusal: %v", events)
				}
				// A separately authenticated reload can acknowledge the same durable
				// generation without writing or decoding an invented replacement.
				events = nil
				reloaded := store.durable
				result, err = host.Accept(reloaded, input)
				if err != nil || !reflect.DeepEqual(result, reloaded) || !reflect.DeepEqual(events, []string{"lock", "load:node", "input", "supports:99", "unlock"}) {
					t.Fatalf("authenticated reload did not retain original equal-generation path: %v %v", events, err)
				}
			} else if err != nil || result.Journal.Generation != incoming.SnapshotGeneration || result.Journal.Digest != incoming.SnapshotDigest {
				t.Fatalf("non-durable outcome could not retry under the original lock: %#v %v", result, err)
			}
		})
	}
}

func TestRuntimeCompleteHistoryRefusalShortCircuitsAndInitialDecodeIsLazy(t *testing.T) {
	for _, name := range []string{"node", "generation-rollback", "same-generation-different-digest", "false-protocol", "active-to-prepared", "initial-no-prior"} {
		t.Run(name, func(t *testing.T) {
			current, incoming := bStageFixture()
			events := []string{}
			store := &bStageStore{events: &events, durable: current}
			prior := incoming
			prior.Assignments = append([]ExecutionIdentity(nil), incoming.Assignments...)
			codec := &bStageCodec{events: &events, support: true, prior: prior}
			want := []string{"lock", "load:node", "input", "supports:99", "unlock"}
			switch name {
			case "node": incoming.NodeId = "foreign"
			case "generation-rollback": incoming.SnapshotGeneration = 1
			case "same-generation-different-digest": incoming.SnapshotGeneration = current.Journal.Generation
			case "false-protocol": codec.support = false
			case "active-to-prepared":
				incoming.Assignments[0].Phase = "prepared"
				want = []string{"lock", "load:node", "input", "supports:99", "decode", "slot:custom[opaque-transport;17]", "unlock"}
			case "initial-no-prior":
				current.Journal.Generation = 0
				store.durable = current
				codec.decodeErr = errors.New("prior decode must not run")
				want = []string{"lock", "load:node", "input", "supports:99", "slot:custom[opaque-transport;17]", "save", "unlock"}
			}
			next, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, bStageInput{events: &events, history: incoming, raw: []byte("original")})
			if !reflect.DeepEqual(events, want) { t.Fatalf("history short circuit %v want %v", events, want) }
			if name == "initial-no-prior" {
				if err != nil || next.Journal.Generation != 3 { t.Fatalf("initial history decoded prior: %#v %v", next, err) }
			} else if err == nil || !reflect.DeepEqual(next, current) { t.Fatalf("history refusal returned authority: %#v %v", next, err) }
		})
	}
}

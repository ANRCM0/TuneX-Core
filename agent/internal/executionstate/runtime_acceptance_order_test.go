package executionstate

import (
	"bytes"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
)

// These ports deliberately use a non-ADP format, so the host cannot depend on
// native JSON, protocol numbers, or a reconstructed history serialization.
type bStageStore struct {
	events                    *[]string
	durable                   RuntimeJournal
	saved                     RuntimeJournal
	lockErr, loadErr, saveErr error
}

func (s *bStageStore) AcquireLock() (func(), error) {
	*s.events = append(*s.events, "lock")
	return func() { *s.events = append(*s.events, "unlock") }, s.lockErr
}
func (s *bStageStore) Load(node string) (RuntimeJournal, error) {
	*s.events = append(*s.events, "load:"+node)
	return s.durable, s.loadErr
}
func (s *bStageStore) Save(value RuntimeJournal) error {
	*s.events = append(*s.events, "save")
	s.saved = value
	return s.saveErr
}

type bStageCodec struct {
	events    *[]string
	prior     SnapshotHistory
	decodeErr error
	support   bool
	decoded   []byte
}

func (c *bStageCodec) SupportsProtocol(version uint64) bool {
	*c.events = append(*c.events, fmt.Sprintf("supports:%d", version))
	return c.support
}
func (c *bStageCodec) DecodePrevious(raw []byte) (SnapshotHistory, error) {
	*c.events = append(*c.events, "decode")
	c.decoded = raw
	return c.prior, c.decodeErr
}
func (c *bStageCodec) PhysicalSlotKey(protocol string, port uint64) string {
	key := fmt.Sprintf("custom[%s;%d]", protocol, port)
	*c.events = append(*c.events, "slot:"+key)
	return key
}

type bStageInput struct {
	events  *[]string
	history SnapshotHistory
	raw     []byte
	err     error
}

func (i bStageInput) EncodeValidated() (SnapshotHistory, []byte, error) {
	*i.events = append(*i.events, "input")
	return i.history, i.raw, i.err
}
func bStageFixture() (RuntimeJournal, SnapshotHistory) {
	a := ExecutionIdentity{AssignmentId: "a", ForwardId: "f", DeploymentGeneration: 7, BindingFence: 11,
		Role: "arbitrary-role", Protocol: "custom-logical", Phase: "active", Driver: DriverIdentity{Id: "custom-driver", ConfigDigest: "config"},
		Resource: PhysicalResource{Address: "opaque-address", Port: 17, Protocol: "opaque-transport"}}
	current := RuntimeJournal{FormatVersion: 99, NodeID: "node", ImportedHistoryDigest: "imported",
		Journal: Journal{Snapshot: []byte{0xff, 0, 0x83}, Generation: 2, Digest: "old", Fences: map[string]uint64{"custom[opaque-transport;17]": 11}, Retired: map[string]uint64{}}}
	return current, SnapshotHistory{NodeId: "node", SessionEpoch: 5, SnapshotGeneration: 3, SnapshotDigest: "new", Assignments: []ExecutionIdentity{a}}
}

func TestRuntimeProviderOrderingAndRawAuthority(t *testing.T) {
	current, incoming := bStageFixture()
	prior := incoming
	prior.SnapshotGeneration = current.Journal.Generation
	raw := []byte{0, 0xff, 0x88, 0x01}
	events := []string{}
	store := &bStageStore{events: &events, durable: current}
	codec := &bStageCodec{events: &events, support: true, prior: prior}
	next, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, bStageInput{events: &events, history: incoming, raw: raw})
	want := []string{"lock", "load:node", "input", "supports:99", "decode", "slot:custom[opaque-transport;17]", "save", "unlock"}
	if err != nil || !reflect.DeepEqual(events, want) {
		t.Fatalf("accept order %v, error %v, want %v", events, err, want)
	}
	if !bytes.Equal(codec.decoded, current.Journal.Snapshot) || &codec.decoded[0] != &current.Journal.Snapshot[0] {
		t.Fatal("previous raw bytes were reconstructed or cloned")
	}
	if next.Journal.Generation != 3 || next.Journal.Digest != "new" || next.ImportedHistoryDigest != "imported" ||
		!bytes.Equal(store.saved.Journal.Snapshot, raw) || &next.Journal.Snapshot[0] != &raw[0] {
		t.Fatalf("raw durable authority changed: %#v", next)
	}
	next.Journal.Fences["custom[opaque-transport;17]"] = 12
	if current.Journal.Fences["custom[opaque-transport;17]"] != 11 {
		t.Fatal("accept mutated caller high-water map")
	}
}

func TestRuntimeRefusalStagesAndNoNewAuthority(t *testing.T) {
	for _, name := range []string{"lock", "load", "stale-format", "stale-extension", "stale-import", "stale-generation", "stale-digest", "stale-fence", "stale-retired", "input", "extension", "protocol", "equal", "prior", "session", "fence", "retired", "owner", "immutable", "phase", "save"} {
		t.Run(name, func(t *testing.T) {
			current, incoming := bStageFixture()
			events := []string{}
			store := &bStageStore{events: &events, durable: current}
			codec := &bStageCodec{events: &events, support: true, prior: incoming}
			input := bStageInput{events: &events, history: incoming, raw: []byte("opaque-new")}
			failure := errors.New("original-port-error")
			want := []string{"lock", "load:node"}
			prefix := ""
			switch name {
			case "lock":
				store.lockErr = failure
				want = []string{"lock"}
			case "load":
				store.loadErr = failure
			case "stale-format":
				store.durable.FormatVersion++
			case "stale-extension":
				n := uint64(1)
				store.durable.ExecutionExtension = &n
			case "stale-import":
				store.durable.ImportedHistoryDigest = "different"
			case "stale-generation":
				store.durable.Journal.Generation++
			case "stale-digest":
				store.durable.Journal.Digest = "different"
			case "stale-fence":
				store.durable.Journal.Fences = map[string]uint64{"other": 1}
			case "stale-retired":
				store.durable.Journal.Retired = map[string]uint64{"other": 1}
			default:
				want = append(want, "input")
				if name == "input" {
					input.err = failure
					break
				}
				if name == "extension" {
					n := uint64(1)
					input.history.ExecutionExtension = &n
					prefix = "UNSUPPORTED_CAPABILITY:"
					break
				}
				want = append(want, "supports:99")
				if name == "protocol" {
					codec.support = false
					prefix = "INTEGRITY_FAILURE:"
					break
				}
				if name == "equal" {
					input.history.SnapshotGeneration = current.Journal.Generation
					input.history.SnapshotDigest = current.Journal.Digest
					break
				}
				want = append(want, "decode")
				if name == "prior" {
					codec.decodeErr = failure
					prefix = "INTEGRITY_FAILURE: Prior"
					break
				}
				if name == "session" {
					codec.prior.SessionEpoch++
					prefix = "SESSION_SUPERSEDED:"
					break
				}
				want = append(want, "slot:custom[opaque-transport;17]")
				// Detach the assignment slice before mutating prior history.
				codec.prior.Assignments = append([]ExecutionIdentity(nil), incoming.Assignments...)
				switch name {
				case "fence":
					input.history.Assignments[0].BindingFence--
					prefix = "FENCING_REJECTED"
				case "retired":
					current.Journal.Retired["custom[opaque-transport;17]"] = 11
					prefix = "FENCING_REJECTED"
				case "owner":
					codec.prior.Assignments[0].AssignmentId = "other"
					prefix = "FENCING_REJECTED: New physical owner"
				case "immutable":
					codec.prior.Assignments[0].Driver.ConfigDigest = "other"
					prefix = "INTEGRITY_FAILURE: Immutable"
				case "phase":
					codec.prior.Assignments[0].Phase = "draining"
					prefix = "FENCING_REJECTED: Execution phase"
				case "save":
					store.saveErr = failure
					want = append(want, "save")
					prefix = "PERSISTENCE_FAILURE:"
				}
			}
			if name != "lock" {
				want = append(want, "unlock")
			}
			next, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, input)
			if !reflect.DeepEqual(events, want) {
				t.Fatalf("order %v, want %v", events, want)
			}
			if name == "equal" {
				if err != nil {
					t.Fatal(err)
				}
			} else if err == nil {
				t.Fatal("refusal returned success")
			}
			if prefix != "" && (err == nil || !strings.HasPrefix(err.Error(), prefix)) {
				t.Fatalf("error %v, want prefix %q", err, prefix)
			}
			if (name == "lock" || name == "load" || name == "input" || name == "save") && !errors.Is(err, failure) {
				t.Fatalf("lost provider error: %v", err)
			}
			if !reflect.DeepEqual(next, current) {
				t.Fatalf("refusal/equal returned new authority: %#v", next)
			}
		})
	}
}

func TestRuntimeWithdrawalTombstoneMaximumAndNilProviders(t *testing.T) {
	current, incoming := bStageFixture()
	events := []string{}
	store := &bStageStore{events: &events, durable: current}
	codec := &bStageCodec{events: &events, support: true, prior: incoming}
	input := bStageInput{events: &events, history: incoming, raw: []byte("withdrawn")}
	for _, host := range []RuntimeHost{{Codec: codec}, {Store: store}} {
		if _, err := host.Accept(current, input); err == nil || len(events) != 0 {
			t.Fatalf("nil provider had effects: %v %v", events, err)
		}
	}
	if _, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, nil); err == nil || len(events) != 0 {
		t.Fatal("nil input had effects")
	}
	input.history.Assignments = nil
	input.history.Tombstones = []PhysicalRetirement{{PhysicalProtocol: "opaque-transport", Port: 17, BindingFence: 9}, {PhysicalProtocol: "opaque-transport", Port: 17, BindingFence: 15}}
	next, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, input)
	if err != nil || next.Journal.Retired["custom[opaque-transport;17]"] != 15 || current.Journal.Retired["custom[opaque-transport;17]"] != 0 {
		t.Fatalf("withdrawal/tombstone high-water changed: %#v, %v", next, err)
	}
}

func TestRuntimeEveryImmutableFieldRefusesWithoutSaving(t *testing.T) {
	for _, vector := range []struct {
		name   string
		mutate func(*ExecutionIdentity)
		prefix string
	}{
		{"assignment", func(a *ExecutionIdentity) { a.AssignmentId = "other" }, "FENCING_REJECTED:"},
		{"forward", func(a *ExecutionIdentity) { a.ForwardId = "other" }, "FENCING_REJECTED:"},
		{"generation", func(a *ExecutionIdentity) { a.DeploymentGeneration++ }, "FENCING_REJECTED:"},
		{"role", func(a *ExecutionIdentity) { a.Role = "other" }, "FENCING_REJECTED:"},
		{"driver", func(a *ExecutionIdentity) { a.Driver.Id = "other" }, "FENCING_REJECTED:"},
		{"config", func(a *ExecutionIdentity) { a.Driver.ConfigDigest = "other" }, "INTEGRITY_FAILURE:"},
		{"address", func(a *ExecutionIdentity) { a.Resource.Address = "other" }, "INTEGRITY_FAILURE:"},
		{"protocol", func(a *ExecutionIdentity) { a.Protocol = "other" }, "INTEGRITY_FAILURE:"},
	} {
		t.Run(vector.name, func(t *testing.T) {
			current, incoming := bStageFixture()
			events := []string{}
			prior := incoming
			prior.Assignments = append([]ExecutionIdentity(nil), incoming.Assignments...)
			vector.mutate(&incoming.Assignments[0])
			store := &bStageStore{events: &events, durable: current}
			codec := &bStageCodec{events: &events, support: true, prior: prior}
			next, err := (RuntimeHost{Store: store, Codec: codec}).Accept(current, bStageInput{events: &events, history: incoming})
			want := []string{"lock", "load:node", "input", "supports:99", "decode", "slot:custom[opaque-transport;17]", "unlock"}
			if err == nil || !strings.HasPrefix(err.Error(), vector.prefix) || !reflect.DeepEqual(events, want) || !reflect.DeepEqual(next, current) {
				t.Fatalf("immutable %s changed durable authority: events=%v next=%#v err=%v", vector.name, events, next, err)
			}
		})
	}
}

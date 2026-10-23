package executionstate

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"sync"
	"testing"

	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

func runtimePayloadPolicy() payloadbudget.Policy {
	limit := uint64(100)
	return payloadbudget.Policy{Binding: payloadbudget.Binding{BucketID: "bucket", ScopeID: "scope", ActorID: "actor", NodeID: "node", StartsAt: 0, EndsAt: 100000}, Revision: 1, BurstBytes: 64, ByteLimit: &limit}
}

func runtimePayloadHistory(t *testing.T, consumed uint64) *payloadbudget.History {
	t.Helper()
	policy := runtimePayloadPolicy()
	history, err := payloadbudget.AcceptHistory(nil, []payloadbudget.Policy{policy}, "node")
	if err != nil {
		t.Fatal(err)
	}
	record := history.Buckets[policy.BucketID]
	record.Consumed = consumed
	history.Buckets[policy.BucketID] = record
	return history
}

func TestRuntimePayloadPrechargeUsesOriginalLockAndPreservesAllAuthority(t *testing.T) {
	current, _ := bStageFixture()
	current.ResourceBudgets = runtimePayloadHistory(t, 7)
	events := []string{}
	store := &bStageStore{events: &events, durable: current}
	policy := runtimePayloadPolicy()
	record, err := (RuntimeHost{Store: store}).Precharge(context.Background(), "node", policy, 3, 1000)
	if err != nil || record.Consumed != 10 || !reflect.DeepEqual(events, []string{"lock", "load:node", "save", "unlock"}) {
		t.Fatal(record, err, events)
	}
	if store.saved.Journal.Generation != current.Journal.Generation || store.saved.Journal.Digest != current.Journal.Digest || store.saved.ImportedHistoryDigest != current.ImportedHistoryDigest || !reflect.DeepEqual(store.saved.Journal.Fences, current.Journal.Fences) || !reflect.DeepEqual(store.saved.Journal.Retired, current.Journal.Retired) {
		t.Fatal("payload debit rewrote original authority")
	}
	if current.ResourceBudgets.Buckets[policy.BucketID].Consumed != 7 {
		t.Fatal("payload debit mutated caller's cached history")
	}
}

func TestRuntimeAcceptRetainsConcurrentDebitsForNewAndEqualGeneration(t *testing.T) {
	for _, equal := range []bool{false, true} {
		t.Run(map[bool]string{false: "new", true: "equal"}[equal], func(t *testing.T) {
			current, incoming := bStageFixture()
			current.ResourceBudgets = runtimePayloadHistory(t, 2)
			durable := current
			durable.ResourceBudgets = runtimePayloadHistory(t, 19)
			if equal {
				incoming.SnapshotGeneration = current.Journal.Generation
				incoming.SnapshotDigest = current.Journal.Digest
			}
			incoming.ResourceLimits = []payloadbudget.Policy{runtimePayloadPolicy()}
			events := []string{}
			store := &bStageStore{events: &events, durable: durable}
			next, err := (RuntimeHost{Store: store, Codec: &bStageCodec{events: &events, support: true, prior: incoming}}).Accept(current, bStageInput{events: &events, history: incoming, raw: []byte("accepted-snapshot")})
			if err != nil || next.ResourceBudgets.Buckets["bucket"].Consumed != 19 || current.ResourceBudgets.Buckets["bucket"].Consumed != 2 {
				t.Fatal("cached Runner history lost concurrent debit", next, err)
			}
			if slices.Contains(events, "save") == equal {
				t.Fatal("equal/new generation changed original write behavior", events)
			}
		})
	}
}

func TestRuntimePayloadPersistenceFailureAndStalePolicyDoNotMintCredit(t *testing.T) {
	current, _ := bStageFixture()
	current.ResourceBudgets = runtimePayloadHistory(t, 7)
	policy := runtimePayloadPolicy()
	events := []string{}
	failure := errors.New("original save failed")
	store := &bStageStore{events: &events, durable: current, saveErr: failure}
	if _, err := (RuntimeHost{Store: store}).Precharge(context.Background(), "node", policy, 3, 1000); !errors.Is(err, failure) {
		t.Fatal(err)
	}
	if current.ResourceBudgets.Buckets["bucket"].Consumed != 7 || store.saved.ResourceBudgets.Buckets["bucket"].Consumed != 10 {
		t.Fatal("failed save authorized or mutated durable state")
	}
	changed := policy
	changed.Revision = 2
	lower := uint64(5)
	changed.ByteLimit = &lower
	history, err := payloadbudget.AcceptHistory(current.ResourceBudgets, []payloadbudget.Policy{changed}, "node")
	if err != nil {
		t.Fatal(err)
	}
	store.durable.ResourceBudgets = history
	store.saveErr = nil
	events = nil
	record, err := (RuntimeHost{Store: store}).Precharge(context.Background(), "node", policy, 1, 1000)
	if !errors.Is(err, payloadbudget.ErrPolicyChanged) || record.Consumed != 7 || record.Revision != 2 || slices.Contains(events, "save") {
		t.Fatal("stale rate revision charged before gate refresh", record, err, events)
	}
	if _, err := (RuntimeHost{Store: store}).Precharge(context.Background(), "node", changed, 1, 1000); !errors.Is(err, payloadbudget.ErrExhausted) {
		t.Fatal("lower limit discarded consumed bytes", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	events = nil
	if _, err := (RuntimeHost{Store: store}).Precharge(ctx, "node", changed, 1, 1000); !errors.Is(err, context.Canceled) || len(events) != 0 {
		t.Fatal("cancelled debit acquired history", err, events)
	}
}

type runtimePayloadConcurrentStore struct {
	mutex   sync.Mutex
	durable RuntimeJournal
}

func (s *runtimePayloadConcurrentStore) AcquireLock() (func(), error) {
	s.mutex.Lock()
	return s.mutex.Unlock, nil
}
func (s *runtimePayloadConcurrentStore) Load(string) (RuntimeJournal, error) { return s.durable, nil }
func (s *runtimePayloadConcurrentStore) Save(value RuntimeJournal) error {
	s.durable = value
	return nil
}

func TestRuntimeSnapshotAndParallelPayloadWritersCannotLoseDebits(t *testing.T) {
	current, incoming := bStageFixture()
	current.ResourceBudgets = runtimePayloadHistory(t, 0)
	incoming.ResourceLimits = []payloadbudget.Policy{runtimePayloadPolicy()}
	store := &runtimePayloadConcurrentStore{durable: current}
	events := []string{}
	host := RuntimeHost{Store: store, Codec: &bStageCodec{events: &events, support: true, prior: incoming}}
	var workers sync.WaitGroup
	for index := 0; index < 20; index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			if _, err := host.Precharge(context.Background(), "node", runtimePayloadPolicy(), 1, 1000); err != nil {
				t.Error(err)
			}
		}()
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		if _, err := host.Accept(current, bStageInput{events: &events, history: incoming, raw: []byte("new-snapshot")}); err != nil {
			t.Error(err)
		}
	}()
	workers.Wait()
	if store.durable.Journal.Generation != incoming.SnapshotGeneration || store.durable.ResourceBudgets.Buckets["bucket"].Consumed != 20 {
		t.Fatal("Snapshot/debit race lost protected state", store.durable)
	}
}

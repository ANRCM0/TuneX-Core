package probe

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type completeCounterClock struct { runtimeplatform.Scheduler; now time.Time; calls int }
func(c *completeCounterClock) Now()time.Time{c.calls++;return c.now}
type completeCounterEntropy struct{calls,size,count int;failure error}
func(e *completeCounterEntropy)ReadRandom(p []byte)(int,error){e.calls++;e.size=len(p);for i:=range p{p[i]=0xab};return e.count,e.failure}

func TestCounterCompleteEpochBoundsDetachedAndConcurrentCounts(t *testing.T){
	clock:=&completeCounterClock{now:time.Date(2026,10,19,0,0,0,0,time.FixedZone("offset",8*3600))}
	for _,failed:=range []bool{false,true}{
		random:=&completeCounterEntropy{count:1};if failed{random.failure=errors.New("entropy failed")}
		set:=newCounterRegistryWith(clock,random)
		if random.calls!=1 || random.size!=16 || set.Available()==failed || clock.calls!=0{t.Fatal("epoch changed clock/entropy semantics")}
		if !failed && set.epoch!="abababababababababababababababab"{t.Fatal("short successful entropy count changed legacy epoch")}
		for i:=0;i<256;i++{inv:=set.enter(Binding{AssignmentID:fmt.Sprint(i)});if inv==nil{t.Fatal("binding refused before limit")};inv.leave()}
		if set.enter(Binding{AssignmentID:"overflow"})!=nil{t.Fatal("binding limit exceeded")}
		values,frozen:=set.Snapshots();if len(values)!=256 || frozen{t.Fatal("live snapshots wrong")}
		values[0].Binding.AssignmentID="mutated";again,_:=set.Snapshots();for _,v:=range again{if v.Binding.AssignmentID=="mutated"{t.Fatal("snapshot retained caller mutation")}}
	}
	set:=newCounterRegistryWith(clock,&completeCounterEntropy{})
	var workers sync.WaitGroup
	for i:=0;i<64;i++{workers.Add(1);go func(){defer workers.Done();inv:=set.enter(Binding{AssignmentID:"same"});a:=inv.begin();a.finish("succeeded");a.finish("failed");inv.leave();inv.leave()}()}
	workers.Wait()
	values,frozen:=set.Snapshots()
	if frozen || len(values)!=1 || values[0].Attempted!=64 || values[0].Succeeded!=64 || values[0].Failed!=0 || values[0].InFlight!=0 || set.calls!=0{t.Fatalf("mutex/idempotence changed: %#v",values)}
}

func TestCounterCompleteSealRaceLossSaturationAndExecutorClock(t *testing.T){
	clock:=&completeCounterClock{now:time.Date(2026,10,19,0,0,0,0,time.FixedZone("offset",8*3600))}
	set:=newCounterRegistryWith(clock,&completeCounterEntropy{})
	first:=set.enter(Binding{AssignmentID:"active"});attempt:=first.begin()
	second:=set.enter(Binding{AssignmentID:"race"})
	set.seal();set.seal()
	if clock.calls!=0 || set.enter(Binding{})!=nil{t.Fatal("seal waited/sampled too soon or permitted new entry")}
	if second.begin()==nil{t.Fatal("admitted invocation race lost measurement")}
	attempt.finish("succeeded") // Sealed in-flight work remains unknown, not revived success.
	first.leave();if clock.calls!=0{t.Fatal("nonfinal leave sampled terminal time")}
	second.leave();if clock.calls!=1{t.Fatal("final leave did not use original executor clock exactly once")}
	values,frozen:=set.Snapshots();if !frozen || len(values)!=2{t.Fatal("seal did not freeze")}
	for _,v:=range values{if !v.EndedAt.Equal(clock.now) || v.EndedAt.Location()!=time.UTC || v.Unknown!=1 || v.Attempted!=1 || v.Succeeded!=0 || v.InFlight!=0{t.Fatalf("sealed counter changed: %#v",v)}}
	if first.begin()!=nil{t.Fatal("invocation began twice")}
	entry:=&counterEntry{};value:=^uint64(0)-1;entry.add(&value,2)
	if value!=^uint64(0)||!entry.overflowed{t.Fatal("counter did not saturate")}
	value=7;entry=&counterEntry{};entry.add(&value,0);if value!=7||entry.overflowed{t.Fatal("zero add overflowed")}
	empty:=newCounterRegistryWith(clock,&completeCounterEntropy{});empty.seal();empty.seal()
	if clock.calls!=2{t.Fatal("empty close sampled more than once")}
	var absent *CounterSet
	if v,f:=absent.Snapshots();v!=nil||!f||absent.Available()||absent.enter(Binding{})!=nil{t.Fatal("nil counter fallback changed")}
	absent.seal()
}

func TestCounterCompleteOutcomeBranchesAndCountCorruption(t *testing.T){
	clock:=&completeCounterClock{now:time.Now()}
	set:=newCounterRegistryWith(clock,&completeCounterEntropy{})
	for _,outcome:=range []string{"succeeded","failed","unclassified"}{
		inv:=set.enter(Binding{AssignmentID:outcome});attempt:=inv.begin();attempt.finish(outcome);inv.leave()
	}
	values,_:=set.Snapshots()
	for _,v:=range values{
		if v.Attempted!=1 || v.InFlight!=0{t.Fatal("outcome did not settle one attempt")}
		if v.Binding.AssignmentID=="succeeded" && v.Succeeded!=1 || v.Binding.AssignmentID=="failed" && v.Failed!=1 || v.Binding.AssignmentID=="unclassified" && v.Unknown!=1{t.Fatalf("wrong outcome: %#v",v)}
	}
	inv:=set.enter(Binding{AssignmentID:"corrupt"});attempt:=inv.begin();attempt.entry.inFlight=0;attempt.finish("succeeded");inv.leave()
	if !attempt.entry.overflowed || attempt.entry.succeeded!=0{t.Fatal("invalid count was silently repaired")}
	set.seal()
	var a *counterAttempt;a.finish("succeeded")
	var i *counterInvocation;if i.begin()!=nil{t.Fatal("nil invocation produced attempt")};i.leave()
}

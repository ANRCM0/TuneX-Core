package control

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type completeCounterBootstrap struct{runtimeplatform.Bootstrap[*x509.CertPool]}
func(completeCounterBootstrap)ValidateProofBoundary(string,string,string)error{return nil}
func(completeCounterBootstrap)LoadRoots(string)(*x509.CertPool,error){return x509.NewCertPool(),nil}
func(completeCounterBootstrap)LoadProtectionKey(string)([]byte,error){return make([]byte,32),nil}
func(completeCounterBootstrap)LoadRuntime(string,[]byte,string)(executionstate.RuntimeJournal,error){return executionstate.RuntimeJournal{},nil}
type completeCounterIdentity struct{executionidentity.Provider[tls.Certificate,*x509.CertPool]}
func(completeCounterIdentity)Locations(string,string,string)executionidentity.Locations{return executionidentity.Locations{}}
func(completeCounterIdentity)LoadMachine(executionidentity.Locations,string,*x509.CertPool)(executionidentity.MachineIdentity[tls.Certificate],error){return executionidentity.MachineIdentity[tls.Certificate]{},nil}
type completeCounterChannel struct{executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate]}
func(completeCounterChannel)NewClient(*x509.CertPool,func()tls.Certificate)*http.Client{return &http.Client{}}

func TestProbeCounterCompleteRunnerAssemblyAndFallbackClocks(t *testing.T){
	operational:=&pointClock{now:time.Unix(1,0)}
	effects:=defaultEffects();effects.Schedule=operational;effects.Bootstrap=completeCounterBootstrap{}
	runner,err:=NewWithLocalServices(Options{URL:"https://control.example",NodeID:"node",BootID:"boot"},Providers{Identity:completeCounterIdentity{},Channel:completeCounterChannel{}},effects,defaultLocalServices())
	if err!=nil{t.Fatal(err)}
	if operational.calls!=0 || runner.probeCounterClock==nil || runner.probeCounterClock==operational{t.Fatal("assembly sampled/inherited operational counter time")}
	if reflect.TypeOf(runner.probeCounterClock)!=reflect.TypeOf(nativeProbeCounterScheduler()){t.Fatal("assembly lost explicit native counter binding")}
	partial:=&Runner{effects:Effects{Schedule:operational}}
	before:=time.Now().UTC()
	p:=probeCounterPointValue(probeCounterIdentity{},probe.CounterSnapshot{})
	stamp,err:=time.Parse(time.RFC3339Nano,p.CapturedAt)
	if err!=nil || stamp.Before(before) || stamp.After(time.Now().UTC()) || reflect.TypeOf(partial.probeCounterScheduler())!=reflect.TypeOf(nativeProbeCounterScheduler()) || operational.calls!=0{t.Fatal("free helper/partial fixture fallback used operational time")}
}

func completeCounterBinding(id string,generation uint64)proberesult.Binding{return proberesult.Binding{NodeId:"node",BootId:"boot",SessionEpoch:1,AssignmentId:id,SnapshotGeneration:generation}}
func completeCounterTail(id string,generation uint64,ended time.Time)probeCounterTail{return probeCounterTail{identity:probeCounterIdentity{Binding:completeCounterBinding(id,generation),InstanceID:"instance",InstanceGeneration:1},values:probe.CounterSnapshot{Epoch:id,Available:true,EndedAt:ended}}}
func completeCounterRunner(now time.Time)(*Runner,*pointClock,*pointClock){
	page:=&pointClock{now:now};point:=&pointClock{now:now.Add(-time.Hour)}
	return &Runner{options:Options{NodeID:"node",BootID:"boot",ProbeTelemetry:true},hello:adp3.HelloResponse{SessionEpoch:1},effects:Effects{Schedule:page},probeCounterClock:point},page,point
}

func TestProbeCounterCompletePageSortCursorSnapshotLimitsAndRetention(t *testing.T){
	now:=time.Date(2026,10,19,0,0,0,0,time.UTC)
	runner,pageClock,pointClock:=completeCounterRunner(now)
	for i:=34;i>=0;i--{runner.probeCounterTails=append(runner.probeCounterTails,completeCounterTail(fmt.Sprintf("a%03d",i),1,now.Add(-time.Second)))}
	first:=runner.captureProbeCounterPage()
	if len(first.items)!=32 || first.items[0].Identity.Binding.AssignmentId!="a000" || first.items[31].Identity.Binding.AssignmentId!="a031" || first.coverage.Available!=35 || first.coverage.Omitted!=3 || !first.coverage.Truncated || first.coverage.NextOffset!=32 || first.coverage.HistoryComplete || pointClock.calls!=35 || pageClock.calls!=2 || first.capturedAt!=now.Format(time.RFC3339Nano){t.Fatalf("first page/callsite clocks: %#v",first.coverage)}
	second:=runner.captureProbeCounterPage()
	if second.items[0].Identity.Binding.AssignmentId!="a032" || second.items[3].Identity.Binding.AssignmentId!="a000" || second.coverage.Offset!=32 || second.coverage.NextOffset!=29 || pointClock.calls!=70 || pageClock.calls!=4{t.Fatalf("cursor did not rotate sorted page: %#v",second.coverage)}
	runner.probeCounterTails=[]probeCounterTail{completeCounterTail("g1",1,now),completeCounterTail("g2",2,now),completeCounterTail("g3",3,now)}
	runner.probeCounterCursor=0
	limited:=runner.captureProbeCounterPage()
	if len(limited.items)!=2 || limited.coverage.SnapshotLimit!=2 || limited.coverage.Omitted!=1{t.Fatal("page exceeded two Snapshot generations")}
	runner.probeCounterTails=[]probeCounterTail{completeCounterTail("fresh",1,now.Add(-probeCounterRetention+time.Nanosecond)),completeCounterTail("expired",1,now.Add(-probeCounterRetention)),completeCounterTail("foreign",1,now)}
	runner.probeCounterTails[2].identity.Binding.SessionEpoch=2
	runner.refreshProbeCounterTailsLocked(now,"node","boot",1)
	if len(runner.probeCounterTails)!=1 || runner.probeCounterTails[0].identity.Binding.AssignmentId!="fresh" || runner.probeCounterTailsExpired!=2{t.Fatal("retention/session cutoff changed")}
	runner.probeCounterTails=nil
	for i:=0;i<probeCounterTailLimit+1;i++{tail:=completeCounterTail(fmt.Sprint(i),1,now);runner.appendProbeCounterTailLocked(probeCounterSource{instance:"instance",generation:1},probe.CounterSnapshot{Binding:probe.Binding{AssignmentID:tail.identity.Binding.AssignmentId},Epoch:tail.values.Epoch})}
	if len(runner.probeCounterTails)!=128 || runner.probeCounterTailsEvicted!=1 || runner.probeCounterTails[0].values.Epoch!="1"{t.Fatal("tail bound/oldest eviction changed")}
	same:=runner.probeCounterTails[0]
	runner.appendProbeCounterTailLocked(probeCounterSource{instance:"instance",generation:1},same.values)
	if len(runner.probeCounterTails)!=128 || runner.probeCounterTailsEvicted!=1{t.Fatal("same tail was duplicated")}
	loss:=^uint64(0)-1;addProbeCounterLoss(&loss,2);if loss!=^uint64(0){t.Fatal("loss did not saturate")}
}

func TestProbeCounterCompleteLiveReaderCloseAndFrozenTailCallsites(t *testing.T){
	now:=time.Now()
	runner,pageClock,pointClock:=completeCounterRunner(now)
	pageClock.now=now.Add(-time.Minute)
	// This resolver refuses before dial; a real Gate/CounterSet still records the live Binding.
	executor,err:=probe.New(func(context.Context,probe.Binding)(probe.Target,error){return probe.Target{},probe.ErrDenied})
	if err!=nil{t.Fatal(err)}
	gate,err:=probe.NewGate("node","boot",1,executor);if err!=nil{t.Fatal(err)}
	runner.probeRegistration=&registeredProbe{gate:gate,node:"node",boot:"boot",epoch:1,generation:1}
	unavailable:=runner.captureProbeCounterPage()
	if unavailable.coverage.UnavailableSources!=1 || len(unavailable.items)!=0{t.Fatal("unavailable CounterSet source invented points")}
	pageClock.calls,pointClock.calls=0,0
	gate.EnableCounters()
	b:=probe.Binding{NodeID:"node",BootID:"boot",AssignmentID:"assignment",ForwardID:"forward",ConfigDigest:"sha256:"+strings.Repeat("a",64),SessionEpoch:1,SnapshotGeneration:1,ForwardRevision:1,DeploymentGeneration:1,BindingFence:1,EgressPolicyRevision:1}
	_,_ = gate.Run(context.Background(),probe.Grant{PermitID:"permit",InstanceID:gate.InstanceID(),Timeout:time.Second,Permit:probe.Permit{Binding:b,Until:time.Now().Add(time.Second),Check:func()error{return nil}}})
	session:=&registeredProbe{gate:gate,node:"node",boot:"boot",epoch:1,generation:1}
	runner.probeRegistration=session
	page:=runner.captureProbeCounterPage()
	if len(page.items)!=1 || page.items[0].State!="current" || page.items[0].CapturedAt!=pointClock.now.UTC().Format(time.RFC3339Nano) || pointClock.calls!=1 || pageClock.calls!=2{t.Fatal("live CounterSet callsite lost dedicated point clock")}
	gate.Close()
	values,frozen:=gate.CounterReader().Snapshots()
	if !frozen || len(values)!=1 || values[0].EndedAt.IsZero(){t.Fatal("Gate close did not freeze CounterSet")}
	runner.retainProbeCountersLocked(session);runner.probeRegistration=nil
	if len(runner.probeCounterTails)!=1 || len(runner.probeCounterRetiring)!=0{t.Fatal("frozen reader retained instead of values-only tail")}
	page=runner.captureProbeCounterPage()
	if len(page.items)!=1 || page.items[0].State!="terminal" || page.items[0].CapturedAt!=values[0].EndedAt.Format(time.RFC3339Nano) || pointClock.calls!=2{t.Fatal("frozen tail callsite lost terminal time/native Now sample")}
	// Counter executor time is original/native; injected Runner retention time did not stamp EndedAt.
	if values[0].EndedAt.Equal(pointClock.now) || values[0].EndedAt.Equal(pageClock.now){t.Fatal("counter executor inherited Runner clock")}
}

func TestProbeCounterCompleteRetiringReadersBoundDedupFreezeAndSession(t *testing.T){
	now:=time.Now()
	runner,_,_:=completeCounterRunner(now)
	releases:=[]chan struct{}{}
	dones:=[]chan struct{}{}
	for i:=0;i<probeCounterRetiringLimit+1;i++{
		entered,release,done:=make(chan struct{}),make(chan struct{}),make(chan struct{})
		executor,err:=probe.New(func(context.Context,probe.Binding)(probe.Target,error){close(entered);<-release;return probe.Target{},probe.ErrDenied});if err!=nil{t.Fatal(err)}
		gate,err:=probe.NewGate("node","boot",1,executor);if err!=nil{t.Fatal(err)}
		gate.EnableCounters()
		b:=probe.Binding{NodeID:"node",BootID:"boot",AssignmentID:fmt.Sprintf("retiring-%d",i),ForwardID:"forward",ConfigDigest:"sha256:"+strings.Repeat("a",64),SessionEpoch:1,SnapshotGeneration:1,ForwardRevision:1,DeploymentGeneration:1,BindingFence:1,EgressPolicyRevision:1}
		go func(){defer close(done);_,_=gate.Run(context.Background(),probe.Grant{PermitID:"permit",InstanceID:gate.InstanceID(),Timeout:2*time.Second,Permit:probe.Permit{Binding:b,Until:time.Now().Add(2*time.Second),Check:func()error{return nil}}})}()
		releases=append(releases,release);dones=append(dones,done)
		// Cleanup remains safe even if a later assertion refuses the test.
		t.Cleanup(func(){select{case <-release:default:close(release)};<-done})
		select{case <-entered:case <-time.After(5*time.Second):t.Fatal("counter invocation did not enter resolver")}
		gate.Close()
		session:=&registeredProbe{gate:gate,node:"node",boot:"boot",epoch:1,generation:uint64(i+1)}
		runner.retainProbeCountersLocked(session)
		runner.retainProbeCountersLocked(session)
	}
	if len(runner.probeCounterRetiring)!=8 || runner.probeCounterTailsEvicted!=1 || len(runner.probeCounterTails)!=0{t.Fatal("retiring bound/dedup/oldest loss changed")}
	for _,release:=range releases{close(release)}
	for _,done:=range dones{select{case <-done:case <-time.After(5*time.Second):t.Fatal("closed counter did not finish")}}
	runner.refreshProbeCounterTailsLocked(time.Now(),"node","boot",1)
	if len(runner.probeCounterRetiring)!=0 || len(runner.probeCounterTails)!=8{t.Fatal("frozen retiring readers did not transfer to values-only tails")}
	runner.refreshProbeCounterTailsLocked(time.Now(),"node","boot",2)
	if len(runner.probeCounterTails)!=0 || runner.probeCounterTailsExpired!=8{t.Fatal("session change retained old counter history")}
}

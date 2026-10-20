package control

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/runtimeobservation"
	"github.com/tunex/vnext/agent/internal/state"
)

// These providers exercise the real Runner owner without sockets, certificate
// generation, or a second authority. Unimplemented effects panic if reached.
type timeOwnerTrace struct { mutex sync.Mutex; events []string }
func (v *timeOwnerTrace) add(s string) { v.mutex.Lock(); defer v.mutex.Unlock(); v.events=append(v.events,s) }
func (v *timeOwnerTrace) values() []string { v.mutex.Lock(); defer v.mutex.Unlock(); return append([]string(nil),v.events...) }
type timeOwnerSchedule struct { runtimeplatform.Scheduler; trace *timeOwnerTrace; now time.Time; calls int }
func (s *timeOwnerSchedule) Now() time.Time { s.trace.add("now"); s.calls++; return s.now }
func (s *timeOwnerSchedule) Until(t time.Time) time.Duration { s.trace.add("until"); return t.Sub(s.now) }
type timeOwnerTicker struct { ch chan time.Time }
func (v timeOwnerTicker) C() <-chan time.Time { return v.ch }
func (v timeOwnerTicker) Stop() {}
func (s *timeOwnerSchedule) NewTicker(d time.Duration) runtimeplatform.Ticker { s.trace.add("ticker:"+d.String()); return timeOwnerTicker{make(chan time.Time)} }
type timeOwnerChannel struct { executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate]; trace *timeOwnerTrace; request func(string,string,[]byte,bool,uint64)([]byte,error) }
func (p *timeOwnerChannel) Request(_ context.Context,_ *http.Client,_ string,m,path string,body []byte,epoch bool,session uint64)([]byte,error) { p.trace.add("request:"+path); return p.request(m,path,body,epoch,session) }
func (p *timeOwnerChannel) CloseIdleConnections(*http.Client) { p.trace.add("close-idle") }
type timeOwnerValidation struct { until time.Time; err error }
type timeOwnerIdentity struct {
	executionidentity.Provider[tls.Certificate,*x509.CertPool]
	trace *timeOwnerTrace
	bundle executionidentity.RelayBundle
	loadErr error
	missing bool
	validations []timeOwnerValidation
	validated []executionidentity.RelayBundle
	historyErr error
	history []time.Time
	historyBundles []executionidentity.RelayBundle
	responses []executionidentity.RelayResponse
	decodeErr,prepareErr,saveErr,removeErr,pendingErr error
	pending []byte
	prepared int
	saved []executionidentity.RelayBundle
	machine executionidentity.MachineIdentity[tls.Certificate]
	machineLoadErr,machineValidateErr,machineSaveErr error
}
func (p *timeOwnerIdentity) Locations(string,string,string) executionidentity.Locations { p.trace.add("locations"); return executionidentity.Locations{RelayBundle:"relay-bundle",RelayRequest:"relay-request",MachineBundle:"machine-bundle",MachineRequest:"machine-request"} }
func (p *timeOwnerIdentity) LoadMachine(executionidentity.Locations,string,*x509.CertPool)(executionidentity.MachineIdentity[tls.Certificate],error){p.trace.add("load-machine");return p.machine,p.machineLoadErr}
func (p *timeOwnerIdentity) ValidateMachineRotation(executionidentity.Locations,string,executionidentity.RotationRequest,[]byte)(executionidentity.CredentialBundle,error){p.trace.add("validate-machine");return executionidentity.CredentialBundle{Certificate:"certificate",PrivateKey:"private"},p.machineValidateErr}
func (p *timeOwnerIdentity) SaveMachine(path string,b executionidentity.CredentialBundle)error{p.trace.add("save:"+path);if b.Certificate!="certificate"||b.PrivateKey!="private"{panic("machine bundle changed")};return p.machineSaveErr}
func (p *timeOwnerIdentity) LoadRelay(path string,_ []byte)(executionidentity.RelayBundle,bool,error) { p.trace.add("load:"+path); return p.bundle,p.missing,p.loadErr }
func (p *timeOwnerIdentity) ValidateRelay(b executionidentity.RelayBundle,_ string,_ *x509.CertPool)(tls.Certificate,time.Time,error) { p.trace.add("validate"); p.validated=append(p.validated,b); v:=p.validations[0]; p.validations=p.validations[1:]; return tls.Certificate{Leaf:&x509.Certificate{SerialNumber:nil}},v.until,v.err }
func (p *timeOwnerIdentity) ValidateRelayAt(b executionidentity.RelayBundle,_ string,_ *x509.CertPool,at time.Time)(tls.Certificate,time.Time,error) { p.trace.add("history"); p.history=append(p.history,at);p.historyBundles=append(p.historyBundles,b); return tls.Certificate{},time.Time{},p.historyErr }
func (p *timeOwnerIdentity) PrepareRotation(path,node string)(executionidentity.RotationRequest,error) { p.trace.add("prepare:"+path); p.prepared++; return executionidentity.RotationRequest{RequestID:fmt.Sprint("request-",p.prepared),CSR:"csr",PrivateKey:"private"},p.prepareErr }
func (p *timeOwnerIdentity) DecodeProtected(_ []byte,destination any) error {
	p.trace.add("decode"); if p.decodeErr!=nil{return p.decodeErr}
	switch out:=destination.(type) { case *relayCredentialResponse: *out=relayCredentialResponse(p.responses[0]);p.responses=p.responses[1:]; case *rotationRequest: out.RequestID=p.bundle.RequestID; default: panic("unexpected protected destination") }; return nil
}
func (p *timeOwnerIdentity) SaveRelay(path string,_ []byte,b executionidentity.RelayBundle) error { p.trace.add("save:"+path);p.saved=append(p.saved,b);return p.saveErr }
func (p *timeOwnerIdentity) Remove(path string,ignore bool) error { p.trace.add(fmt.Sprintf("remove:%s:%v",path,ignore));return p.removeErr }
func (p *timeOwnerIdentity) ReadPending(path string)([]byte,error) { p.trace.add("pending:"+path);return p.pending,p.pendingErr }
func (p *timeOwnerIdentity) Missing(err error) bool { p.trace.add("missing");return err==errTimeOwnerMissing }
var errTimeOwnerMissing=errors.New("missing pending")

func newTimeOwnerRunner()(*Runner,*timeOwnerIdentity,*timeOwnerSchedule,*timeOwnerTrace) {
	trace:=&timeOwnerTrace{};now:=time.Date(2026,10,19,1,2,3,123456789,time.UTC)
	provider:=&timeOwnerIdentity{trace:trace,pendingErr:errTimeOwnerMissing}
	clock:=&timeOwnerSchedule{trace:trace,now:now}
	channel:=&timeOwnerChannel{trace:trace,request:func(method,path string,body []byte,epoch bool,session uint64)([]byte,error){
		if method!="POST"||path!="/agent/v3/relay-credential"||!epoch||session!=2{panic("credential request stage changed")}
		if string(body)!=fmt.Sprintf(`{"csr":"csr","requestId":"request-%d"}`,provider.prepared){panic("rotation bytes changed")}
		return []byte("protected-response"),nil
	}}
	runner:=&Runner{options:Options{NodeID:"node",BootID:"boot",Relay:true},hello:adp3.HelloResponse{SessionEpoch:2},providers:Providers{Identity:provider,Channel:channel},effects:Effects{Schedule:clock}}
	return runner,provider,clock,trace
}

func TestRelayTimeOwnerCompleteLoadScheduleAndExpiredHistory(t *testing.T) {
	failure:=errors.New("provider validation");historical:=errors.New("historical validation");loadFailure:=errors.New("load failure")
	for _,tc:=range []struct{name,until,renew,want string;load,validate,history error;now,historyCalls int}{
		{"load-error","","","load failure",loadFailure,nil,nil,0,0},
		{"expiry-first","bad-expiry","bad-renewal","INTEGRITY_FAILURE: Relay effective expiry differs",nil,nil,nil,0,0},
		{"renewal-first","2026-10-19T01:03:03Z","bad-renewal","INTEGRITY_FAILURE: Relay renewal schedule differs",nil,nil,nil,0,0},
		{"future-validation","2026-10-19T01:03:03Z","","provider validation",nil,failure,nil,1,0},
		{"expired-history","2026-10-19T01:02:03Z","","historical validation",nil,failure,historical,1,1},
	}{ t.Run(tc.name,func(t *testing.T){
		r,p,c,tr:=newTimeOwnerRunner();p.bundle=executionidentity.RelayBundle{ValidUntil:tc.until,RenewAfter:tc.renew};p.loadErr=tc.load;p.validations=[]timeOwnerValidation{{err:tc.validate}};p.historyErr=tc.history
		err:=r.ensureRelayCredential(context.Background());if err==nil||err.Error()!=tc.want||c.calls!=tc.now||len(p.history)!=tc.historyCalls||p.prepared!=0||r.relayCertificate.Leaf!=nil{t.Fatal("load/schedule/history order",err,tr.values())}
		if len(p.history)>0{expiry,_:=time.Parse(time.RFC3339Nano,tc.until);if !p.history[0].Equal(expiry.Add(-time.Nanosecond))||!reflect.DeepEqual(p.historyBundles[0],p.validated[0]){t.Fatal("historical validation instant/identity",p.history)}}
	}) }
	// A successfully authenticated expired identity may only reach online renewal;
	// stopping at its prepare error leaves no published historical certificate.
	r,p,c,tr:=newTimeOwnerRunner();p.bundle.ValidUntil=c.now.Add(-time.Second).Format(time.RFC3339Nano);p.validations=[]timeOwnerValidation{{err:failure}};p.prepareErr=failure
	if err:=r.ensureRelayCredential(context.Background());err!=failure||c.calls!=1||len(p.history)!=1||p.prepared!=1||r.relayCertificate.Leaf!=nil{t.Fatal("expired identity online recovery",err,tr.values())}
	r,p,c,tr=newTimeOwnerRunner();p.missing=true;p.loadErr=loadFailure;p.prepareErr=failure
	if err:=r.ensureRelayCredential(context.Background());err!=failure||c.calls!=0||p.prepared!=1{t.Fatal("missing precedes load error",err,tr.values())}
}

func TestRelayTimeOwnerCompleteRetainedPublicationAndPendingCleanup(t *testing.T) {
	for _,mode:=range []string{"missing","matching","decode-error","remove-error","read-error"}{t.Run(mode,func(t *testing.T){
		r,p,c,tr:=newTimeOwnerRunner();until:=c.now.Add(time.Hour);renew:=c.now.Add(time.Minute);failure:=errors.New("pending failure")
		p.bundle=executionidentity.RelayBundle{ValidUntil:until.Format(time.RFC3339Nano),RenewAfter:renew.Format(time.RFC3339Nano),RequestID:"committed"};p.validations=[]timeOwnerValidation{{until:until}}
		switch mode {case "matching":p.pendingErr=nil;case "decode-error":p.pendingErr=nil;p.decodeErr=failure;case "remove-error":p.pendingErr=nil;p.removeErr=failure;case "read-error":p.pendingErr=failure}
		err:=r.ensureRelayCredential(context.Background());wantError:=strings.HasSuffix(mode,"error")
		if (err!=nil)!=wantError||err!=nil&&err!=failure||c.calls!=0||r.relayCertificate.Leaf==nil||!r.relayUntil.Equal(until)||!r.relayRenewAfter.Equal(renew){t.Fatal("retained publication/cleanup",err,tr.values())}
		if mode=="matching"&&!reflect.DeepEqual(tr.values(),[]string{"locations","load:relay-bundle","validate","pending:relay-request","decode","remove:relay-request:false"}){t.Fatal("pending replay cleanup sequence",tr.values())}
	})}
}

func TestRelayTimeOwnerCompleteRetryFlagAndHistoricalFailureStages(t *testing.T) {
	failure:=errors.New("expired provider response");historyFailure:=errors.New("untrusted expired history");removeFailure:=errors.New("remove pending failed")
	for _,tc:=range []struct{name string;retry bool;expiry string;history,remove error;now,attempts,histories int;want error}{
		{"malformed",true,"bad",nil,nil,0,1,0,failure},
		{"future",true,"2026-10-19T01:03:03Z",nil,nil,1,1,0,failure},
		{"retry-disabled",false,"2026-10-19T01:02:02Z",nil,nil,0,1,0,failure},
		{"historical-denied",true,"2026-10-19T01:02:02Z",historyFailure,nil,1,1,1,historyFailure},
		{"remove-denied",true,"2026-10-19T01:02:02Z",nil,removeFailure,1,1,1,removeFailure},
		{"exactly-one-retry",true,"2026-10-19T01:02:02Z",nil,nil,1,2,1,failure},
	}{t.Run(tc.name,func(t *testing.T){
		r,p,c,tr:=newTimeOwnerRunner();p.responses=[]executionidentity.RelayResponse{{ValidUntil:tc.expiry},{ValidUntil:tc.expiry}};p.validations=[]timeOwnerValidation{{err:failure},{err:failure}};p.historyErr=tc.history;p.removeErr=tc.remove
		err:=r.renewRelayCredentialAttempt(context.Background(),tc.retry)
		if err!=tc.want||c.calls!=tc.now||p.prepared!=tc.attempts||len(p.history)!=tc.histories||len(p.saved)!=0||r.relayCertificate.Leaf!=nil{t.Fatal("retry/history short circuits",err,tr.values())}
		for index,b:=range p.validated{if b.RequestID!=fmt.Sprint("request-",index+1)||b.PrivateKey!="private"||b.Fingerprint!="sha256:"||b.RenewAfter!=""{t.Fatal("request/bundle projection",b)}}
		if len(p.history)>0{expiry,_:=time.Parse(time.RFC3339Nano,tc.expiry);if !p.history[0].Equal(expiry.Add(-time.Nanosecond))||!reflect.DeepEqual(p.historyBundles[0],p.validated[0]){t.Fatal("retry history check instant/identity")}}
	})}
}

func TestRelayTimeOwnerCompleteOverlapBoundsAndDurablePublication(t *testing.T) {
	for _,tc:=range []struct{name string;overlap *string;untilOffset time.Duration;want string;now int;saveFail,removeFail bool}{
		{name:"omitted",untilOffset:time.Hour},
		{name:"invalid",overlap:timeOwnerText("bad"),untilOffset:time.Hour,want:"INTEGRITY_FAILURE: Relay overlap is not bounded"},
		{name:"clock-bound",overlap:timeOwnerText("2026-10-19T01:07:04Z"),untilOffset:time.Hour,want:"INTEGRITY_FAILURE: Relay overlap is not bounded",now:1},
		{name:"credential-bound",overlap:timeOwnerText("2026-10-19T01:02:20Z"),untilOffset:10*time.Second,want:"INTEGRITY_FAILURE: Relay overlap is not bounded",now:1},
		{name:"renewal-equal-expiry",overlap:timeOwnerText("2026-10-19T01:02:12.123456789Z"),untilOffset:10*time.Second,want:"AUTHORIZATION_DENIED: Relay credential cannot outlive its overlap",now:1},
		{name:"inclusive-300s",overlap:timeOwnerText("2026-10-19T01:07:03.123456789Z"),untilOffset:time.Hour,now:1},
		{name:"offset-renewal",overlap:timeOwnerText("2026-10-19T09:03:03.123456789+08:00"),untilOffset:time.Hour,now:1},
		{name:"save-failure",untilOffset:time.Hour,saveFail:true,want:"durable failure"},
		{name:"remove-failure",untilOffset:time.Hour,removeFail:true,want:"durable failure"},
	}{t.Run(tc.name,func(t *testing.T){
		r,p,c,tr:=newTimeOwnerRunner();until:=c.now.Add(tc.untilOffset);p.responses=[]executionidentity.RelayResponse{{ValidUntil:until.Format(time.RFC3339Nano),OverlapUntil:tc.overlap,Fingerprint:"fingerprint"}};p.validations=[]timeOwnerValidation{{until:until}}
		failure:=errors.New("durable failure");if tc.saveFail{p.saveErr=failure};if tc.removeFail{p.removeErr=failure}
		err:=r.renewRelayCredential(context.Background());if tc.want==""&&err!=nil||tc.want!=""&&(err==nil||err.Error()!=tc.want)||c.calls!=tc.now{t.Fatal("overlap stage",err,tr.values())}
		success:=tc.want=="";if (r.relayCertificate.Leaf!=nil)!=success{t.Fatal("published before durable save/remove",tr.values())}
		if success{if !r.relayUntil.Equal(until)||len(p.saved)!=1{t.Fatal("published credential differs")};wantRenew:=time.Time{};if tc.overlap!=nil{v,_:=time.Parse(time.RFC3339Nano,*tc.overlap);wantRenew=v.Add(time.Second);if p.saved[0].RenewAfter!=wantRenew.UTC().Format(time.RFC3339Nano){t.Fatal("renewal UTC encoding")}};if !r.relayRenewAfter.Equal(wantRenew){t.Fatal("renewal publication")}}
		if tc.saveFail&&strings.Contains(strings.Join(tr.values(),","),"remove:"){t.Fatal("removed before successful save")}
		if success||tc.removeFail{events:=tr.values();if !reflect.DeepEqual(events[len(events)-2:],[]string{"save:relay-bundle","remove:relay-request:true"}){t.Fatal("durable stage order",events)}}
	})}
}
func timeOwnerText(s string)*string{return &s}

func timeOwnerPolicy() adp3.Policy { return adp3.Policy{PollIntervalSeconds:10,LeaseSeconds:300,RenewalLeadSeconds:120,MaxClockSkewSeconds:5,ObservationFreshnessSeconds:30,DrainTimeoutSeconds:30,ConnectTimeoutSeconds:10,UdpIdleTimeoutSeconds:60,MaxTcpConnectionsPerAssignment:1024,MaxUdpSessionsPerAssignment:4096,MaxSnapshotBytes:4194304,MaxReportBytes:1048576,MaxAssignmentsPerNode:1000} }

type timeOwnerObservation struct{}
func(timeOwnerObservation)Memory()runtimeobservation.MemorySample{return runtimeobservation.MemorySample{}}
func(timeOwnerObservation)Process()runtimeobservation.ProcessSample{return runtimeobservation.ProcessSample{}}
func(timeOwnerObservation)Goroutines()int{return 0}
func(timeOwnerObservation)ProcessID()int{return 1}
func(timeOwnerObservation)Platform()string{return "test"}
func(timeOwnerObservation)Host()platformobservation.HostResources{return platformobservation.HostResources{}}
type timeOwnerFiles struct{trace *timeOwnerTrace}
func(v timeOwnerFiles)WriteDiagnostics(string,[]byte)error{v.trace.add("diagnostics");return nil}
func(v timeOwnerFiles)WriteForwardCounters(string,[]byte)error{v.trace.add("counters");return nil}

func TestRunnerTimeOwnerCompleteHelloIdentityGuardDiagnosticsAndParse(t *testing.T){
	for _,mode:=range []string{"identity","guard-init","raw-parse","server-validation"}{t.Run(mode,func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();r.options.Relay=false;r.options.Diagnostics="measurements";r.local.Observation=timeOwnerObservation{};r.local.Measurements=timeOwnerFiles{tr}
		hello:=adp3.HelloResponse{ProtocolVersion:3,NodeId:"node",BootId:"boot",SessionEpoch:2,ServerTime:c.now.Format(time.RFC3339Nano),Policy:timeOwnerPolicy()}
		if mode=="identity"{hello.NodeId="other"};if mode=="raw-parse"{hello.ServerTime=strings.Replace(hello.ServerTime,"T","t",1)};if mode=="server-validation"{hello.ServerTime=c.now.Add(-time.Hour).Format(time.RFC3339Nano)}
		raw,_:=json.Marshal(hello);if _,err:=nativeexecution.DecodeRunnerHello(raw);err!=nil{t.Fatal("fixture rejected before owner",err)}
		failure:=errors.New("guard initial read");samples:=0;r.clock=func()(authorization.Sample,error){tr.add("guard-sample");samples++;if mode=="guard-init"{return authorization.Sample{},failure};return authorization.Sample{Wall:c.now,Uptime:time.Second},nil}
		r.providers.Channel=&timeOwnerChannel{trace:tr,request:func(method,path string,body []byte,epoch bool,session uint64)([]byte,error){if method!="POST"||path!="/agent/v3/hello"||epoch{t.Fatal("hello call changed")};return raw,nil}}
		err:=r.Run(context.Background());if err==nil{t.Fatal("expected bounded owner refusal")}
		wantSamples:=1;if mode=="identity"{wantSamples=0};if mode=="server-validation"{wantSamples=2};if samples!=wantSamples{t.Fatal("hello Guard/parse order",samples,tr.values())}
		switch mode{case "identity":if err.Error()!="AUTHORIZATION_DENIED: Hello identity mismatch"||r.guard!=nil{t.Fatal(err)};case "guard-init":if err!=failure||r.guard!=nil{t.Fatal(err)};case "raw-parse":_,want:=time.Parse(time.RFC3339Nano,hello.ServerTime);if !reflect.DeepEqual(err,want){t.Fatal("raw Hello error changed",err,want)};case "server-validation":if err.Error()!="CLOCK_UNCERTAIN: server clock skew exceeds policy"{t.Fatal(err)}}
		events:=tr.values();diagnostics:=strings.Contains(strings.Join(events,","),"diagnostics");if diagnostics!=(mode=="raw-parse"||mode=="server-validation"){t.Fatal("diagnostics setup/refusal stage",events)}
	})}
}

type timeOwnerStream struct{trace *timeOwnerTrace;remaining uint64;closes int;check func()error}
func(v *timeOwnerStream)Close(){v.trace.add("stream-close");v.closes++}
func(v *timeOwnerStream)Drain(){v.trace.add("stream-drain")}
func(v *timeOwnerStream)Remaining()uint64{v.trace.add("remaining");return v.remaining}
func(v *timeOwnerStream)SetAuthorization(check func()error){v.trace.add("authorization");v.check=check}

func timeOwnerSnapshot(t *testing.T,r *Runner,c *timeOwnerSchedule)[]byte{
	t.Helper();body:=map[string]any{"protocolVersion":3,"nodeId":"node","sessionEpoch":2,"snapshotGeneration":1,"complete":true,"issuedAt":c.now.Add(-time.Second).Format(time.RFC3339Nano),"validUntil":c.now.Add(time.Minute).Format(time.RFC3339Nano),"assignments":[]any{},"tombstones":[]any{}}
	digest,err:=contracts.ComputeDigest(body);if err!=nil{t.Fatal(err)};body["snapshotDigest"]=digest;raw,err:=json.Marshal(body);if err!=nil{t.Fatal(err)};if _,err=nativeexecution.DecodeRunnerSnapshot(raw);err!=nil{t.Fatal(err)}
	r.journal=state.Journal{Generation:1,Digest:digest,Fences:map[string]uint64{},Retired:map[string]uint64{}};return raw
}

func TestRunnerTimeOwnerCompletePollObservedAtDrainRemainingAndAck(t *testing.T){
	for _,remaining:=range []uint64{0,3}{for _,expired:=range []bool{false,true}{t.Run(fmt.Sprint(remaining,"/",expired),func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();r.options.Relay=false;r.hello.Policy=timeOwnerPolicy();wall:=c.now;guardCalls:=0
		r.clock=func()(authorization.Sample,error){guardCalls++;return authorization.Sample{Wall:wall,Uptime:time.Second+wall.Sub(c.now)},nil};if err:=r.initializeGuard();err!=nil{t.Fatal(err)}
		ticket,err:=r.guard.Accept(c.now.Add(-time.Second),c.now.Add(time.Minute));if err!=nil{t.Fatal(err)};r.ticket=ticket
		drainCalls:=0;drainGuard,err:=authorization.New(func()(authorization.Sample,error){drainCalls++;return authorization.Sample{Wall:wall,Uptime:time.Second+wall.Sub(c.now)},nil},time.Second,300*time.Second,time.Time{});if err!=nil{t.Fatal(err)}
		drainTicket,err:=drainGuard.Accept(c.now.Add(-time.Second),c.now.Add(10*time.Second));if err!=nil{t.Fatal(err)}
		stream:=&timeOwnerStream{trace:tr,remaining:remaining};start:=c.now.Add(-time.Second);deadline:=c.now.Add(9*time.Second)
		assignment:=adp3.Assignment{AssignmentId:"old",DeploymentGeneration:4,BindingFence:5};key:=nativeexecution.RunnerDrainKey("old",4,5)
		r.drains=map[string]draining{key:{instance:running{assignment:assignment,stream:stream,ticket:drainTicket},started:start,deadline:deadline}};raw:=timeOwnerSnapshot(t,r,c)
		if expired{wall=c.now.Add(10*time.Second)}
		r.providers.Channel=&timeOwnerChannel{trace:tr,request:func(method,path string,_ []byte,_ bool,_ uint64)([]byte,error){if method=="GET"{return raw,nil};return json.Marshal(adp3.ReportAck{ProtocolVersion:3,NodeId:"node",BootId:"boot",SessionEpoch:2,ReportSequence:r.sequence,Status:"accepted"})}}
		if err:=r.poll(context.Background());err!=nil{t.Fatal(err,tr.values())};report:=nativeexecution.DecodePendingRunnerReport(r.pending)
		removed:=remaining==0||expired;if report.ObservedAt!=c.now.UTC().Format(time.RFC3339Nano)||c.calls!=1||len(report.Observations)!=0||len(report.Drains)!=1{t.Fatal("poll sample/report shape",string(r.pending),tr.values())}
		d:=report.Drains[0];if d.StartedAt!=start.UTC().Format(time.RFC3339Nano)||d.Deadline!=deadline.UTC().Format(time.RFC3339Nano)||d.AssignmentId!="old"||d.DeploymentGeneration!=4||d.BindingFence!=5||(d.Condition=="removed")!=removed||(stream.closes==1)!=removed{t.Fatal("drain decision projection",d,tr.values())}
		if removed&&d.RemainingConnections!=0||!removed&&d.RemainingConnections!=remaining{t.Fatal("remaining changed",d)}
		if err:=r.report(context.Background());err!=nil{t.Fatal(err)};_,retained:=r.drains[key];if retained==removed||len(r.pending)!=0{t.Fatal("ACK drain cleanup",retained,removed)}
		wantDrainCalls:=2;if remaining>0{wantDrainCalls++};if drainCalls!=wantDrainCalls||guardCalls!=5{t.Fatal("Remaining/ticket short circuit or poll authority checks changed",drainCalls,guardCalls,tr.values())}
	})}}
}

func TestRunnerTimeOwnerCompleteMachineRotationReloadAndPublication(t *testing.T){
	for _,mode:=range []string{"prepare","io","validate","save","reload","guard","remove","success","same-fingerprint"}{t.Run(mode,func(t *testing.T){
		r,p,c,tr:=newTimeOwnerRunner();failure:=errors.New("machine stage failure");r.client=&http.Client{};r.hello.Policy=timeOwnerPolicy()
		p.machine=executionidentity.MachineIdentity[tls.Certificate]{Certificate:tls.Certificate{Leaf:&x509.Certificate{}},Until:c.now.Add(time.Hour),Fingerprint:[32]byte{9}}
		if mode=="same-fingerprint"{r.credentialFingerprint=p.machine.Fingerprint}
		if mode=="prepare"{p.prepareErr=failure};if mode=="validate"{p.machineValidateErr=failure};if mode=="save"{p.machineSaveErr=failure};if mode=="reload"{p.machineLoadErr=failure};if mode=="remove"{p.removeErr=failure}
		r.providers.Channel=&timeOwnerChannel{trace:tr,request:func(method,path string,raw []byte,epoch bool,session uint64)([]byte,error){
			if method!="POST"||path!="/agent/v3/credentials/rotate"||!epoch||session!=2||string(raw)!=`{"csr":"csr","requestId":"request-1"}`{t.Fatal("Machine two-field request bytes/args",string(raw))}
			if mode=="io"{return nil,failure};return []byte("protected-machine-response"),nil
		}}
		if mode=="guard"{calls:=0;r.clock=func()(authorization.Sample,error){calls++;if calls>1{return authorization.Sample{},failure};return authorization.Sample{Wall:c.now,Uptime:time.Second},nil};if err:=r.initializeGuard();err!=nil{t.Fatal(err)}}
		err:=r.rotate(context.Background());success:=mode=="success"||mode=="same-fingerprint"
		if success&&err!=nil||!success&&err==nil{t.Fatal("rotation stage",err,tr.values())}
		if !success&&mode!="guard"&&err!=failure{t.Fatal("original rotation error lost",err)}
		published:=mode=="guard"||mode=="remove"||success
		if (r.certificate.Leaf!=nil)!=published||c.calls!=0{t.Fatal("Machine publication/sample point",tr.values())}
		if published&&(r.credentialFingerprint!=p.machine.Fingerprint||!r.credentialUntil.Equal(p.machine.Until)){t.Fatal("Machine current fields changed")}
		events:=tr.values();joined:=strings.Join(events,",")
		if strings.Contains(joined,"close-idle")!=(mode=="remove"||mode=="success"){t.Fatal("credential fingerprint/Guard idle-close order",events)}
		if strings.Contains(joined,"remove:machine-request:true")!=(mode=="remove"||success){t.Fatal("pending cleanup before durable reload",events)}
		if success{expected:=[]string{"locations","prepare:machine-request","request:/agent/v3/credentials/rotate","validate-machine","save:machine-bundle","locations","load-machine"};if mode=="success"{expected=append(expected,"close-idle")};expected=append(expected,"remove:machine-request:true");if !reflect.DeepEqual(events,expected){t.Fatal("complete Machine rotation stages",events)}}
	})}
}

func TestRunnerTimeOwnerCompleteSnapshotIdentityHistoryBeforeSamplingAndRawValidity(t *testing.T){
	for _,mode:=range []string{"identity","history","validity-first","issuance-second"}{t.Run(mode,func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();r.options.Relay=false;r.hello.Policy=timeOwnerPolicy();calls:=0
		r.clock=func()(authorization.Sample,error){calls++;return authorization.Sample{Wall:c.now,Uptime:time.Second},nil};if err:=r.initializeGuard();err!=nil{t.Fatal(err)}
		raw:=timeOwnerSnapshot(t,r,c);var body map[string]any;if err:=json.Unmarshal(raw,&body);err!=nil{t.Fatal(err)}
		if mode=="identity"{body["nodeId"]="other"};if mode=="history"{r.journal.Generation=2}
		if mode=="validity-first"{body["validUntil"]=strings.Replace(body["validUntil"].(string),"T","t",1);body["issuedAt"]=strings.Replace(body["issuedAt"].(string),"T","t",1)}
		if mode=="issuance-second"{body["issuedAt"]=strings.Replace(body["issuedAt"].(string),"T","t",1)}
		delete(body,"snapshotDigest");digest,err:=contracts.ComputeDigest(body);if err!=nil{t.Fatal(err)};body["snapshotDigest"]=digest;if mode!="history"{r.journal.Digest=digest};raw,err=json.Marshal(body);if err!=nil{t.Fatal(err)}
		if _,err=nativeexecution.DecodeRunnerSnapshot(raw);err!=nil{t.Fatal("fixture rejected before owner",err)}
		r.providers.Channel=&timeOwnerChannel{trace:tr,request:func(string,string,[]byte,bool,uint64)([]byte,error){return raw,nil}}
		err=r.poll(context.Background());if err==nil{t.Fatal("expected snapshot refusal")}
		wantNow:=0;switch mode{case "identity":if err.Error()!="SESSION_SUPERSEDED"{t.Fatal(err)};case "history":if err.Error()!="INTEGRITY_FAILURE: Snapshot history changed"{t.Fatal(err)};default:wantNow=1;field:="validUntil";if mode=="issuance-second"{field="issuedAt"};_,want:=time.Parse(time.RFC3339Nano,body[field].(string));if !reflect.DeepEqual(err,want){t.Fatal("snapshot raw parse error/order",err,want)}}
		if c.calls!=wantNow||calls!=1||len(r.pending)!=0{t.Fatal("snapshot sampling before checks/after parse/Guard",c.calls,calls,tr.values())}
	})}
}

func TestRunnerTimeOwnerCompleteBeginDrainCutoffAndDuplicate(t *testing.T){
	for _,cutoffOffset:=range []time.Duration{-time.Second,0,5*time.Second,30*time.Second}{t.Run(cutoffOffset.String(),func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();r.clock=func()(authorization.Sample,error){return authorization.Sample{Wall:c.now,Uptime:time.Second},nil};r.hello.Policy=timeOwnerPolicy();if err:=r.initializeGuard();err!=nil{t.Fatal(err)}
		ticket,err:=r.guard.Accept(c.now.Add(-time.Second),c.now.Add(time.Minute));if err!=nil{t.Fatal(err)};stream:=&timeOwnerStream{trace:tr}
		instance:=running{assignment:adp3.Assignment{AssignmentId:"old",DeploymentGeneration:4,BindingFence:5,DrainTimeoutSeconds:20},stream:stream,ticket:ticket};cutoff:=time.Time{};wantDeadline:=c.now.Add(20*time.Second)
		if cutoffOffset!=0{cutoff=c.now.Add(cutoffOffset);if cutoff.Before(wantDeadline){wantDeadline=cutoff};if wantDeadline.Before(c.now){wantDeadline=c.now}}
		r.beginDrain(instance,c.now,cutoff);key:=nativeexecution.RunnerDrainKey("old",4,5);d,ok:=r.drains[key]
		if !ok||!d.started.Equal(c.now)||!d.deadline.Equal(wantDeadline)||stream.check==nil||c.calls!=0{t.Fatal("drain ticket/cutoff",d,tr.values())}
		before:=tr.values();r.beginDrain(instance,c.now.Add(time.Hour),time.Time{});if !reflect.DeepEqual(before,tr.values())||!reflect.DeepEqual(d,r.drains[key]){t.Fatal("duplicate drain reset ticket/deadline")}
	})}
}

func TestRelayTimeOwnerCompleteIdentityRenewalShortCircuits(t *testing.T){
	for _,mode:=range []string{"disabled","no-leaf","expired","valid"}{t.Run(mode,func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();r.relayUntil=c.now.Add(time.Minute)
		if mode=="disabled"{r.options.Relay=false};if mode!="no-leaf"{r.relayCertificate.Leaf=&x509.Certificate{}};if mode=="expired"{r.relayUntil=c.now}
		identity,until,err:=r.relayIdentity();wantCalls:=0;if mode=="expired"||mode=="valid"{wantCalls=1}
		if c.calls!=wantCalls||(err==nil)!=(mode=="valid"){t.Fatal("identity short-circuit sample",err,tr.values())}
		if mode=="valid"&&(identity.Certificate.Leaf!=r.relayCertificate.Leaf||!until.Equal(r.relayUntil)){t.Fatal("identity result changed")}
	})}
	for _,offset:=range []time.Duration{-time.Second,0,time.Second}{
		r,_,c,tr:=newTimeOwnerRunner();r.hello.Policy=timeOwnerPolicy();r.relayRenewAfter=c.now.Add(offset);r.relayUntil=c.now.Add(r.credentialRenewalLead())
		if due:=r.relayRenewalDue();due!=(offset<=0)||c.calls!=1{t.Fatal("renewal boundary",offset,due,tr.values())}
		expected:=[]string{"now"};if offset<=0{expected=append(expected,"until")};if !reflect.DeepEqual(tr.values(),expected){t.Fatal("renewal no hoisted Until",tr.values())}
	}
}

func TestRunnerTimeOwnerCompleteAckRefusalRetainsPendingAndDrains(t *testing.T){
	for _,mode:=range []string{"io","decode","node","boot","epoch","sequence","accepted"}{t.Run(mode,func(t *testing.T){
		r,_,c,tr:=newTimeOwnerRunner();failure:=errors.New("ACK channel failure");r.sequence=7
		removed:=adp3.Drain{AssignmentId:"removed",DeploymentGeneration:4,BindingFence:5,Condition:"removed"};active:=adp3.Drain{AssignmentId:"active",DeploymentGeneration:4,BindingFence:5,Condition:"draining"}
		removedKey:=nativeexecution.RunnerDrainKey("removed",4,5);activeKey:=nativeexecution.RunnerDrainKey("active",4,5)
		r.drains=map[string]draining{removedKey:{},activeKey:{}}
		raw,err:=nativeexecution.EncodeRunnerReportAt("node","boot",2,7,c.now,1,nil,[]adp3.Drain{removed,active});if err!=nil{t.Fatal(err)};r.pending=raw
		ack:=adp3.ReportAck{ProtocolVersion:3,NodeId:"node",BootId:"boot",SessionEpoch:2,ReportSequence:7,Status:"accepted"};switch mode{case "node":ack.NodeId="other";case "boot":ack.BootId="other";case "epoch":ack.SessionEpoch=3;case "sequence":ack.ReportSequence=8}
		r.providers.Channel=&timeOwnerChannel{trace:tr,request:func(method,path string,body []byte,epoch bool,session uint64)([]byte,error){if method!="POST"||path!="/agent/v3/report"||string(body)!=string(raw)||!epoch||session!=2{t.Fatal("report request changed")};if mode=="io"{return nil,failure};if mode=="decode"{return []byte(`{`),nil};return json.Marshal(ack)}}
		err=r.report(context.Background());success:=mode=="accepted"
		if (err==nil)!=success||c.calls!=0{t.Fatal("ACK sample/refusal",err,tr.values())};if mode=="io"&&err!=failure{t.Fatal("ACK I/O identity changed")}
		if success{if len(r.pending)!=0||len(r.drains)!=1{t.Fatal("ACK removed wrong drains")};if _,exists:=r.drains[activeKey];!exists{t.Fatal("draining entry deleted")}}else if string(r.pending)!=string(raw)||len(r.drains)!=2{t.Fatal("ACK refusal changed retry state")}
	})}
}

func TestRelayTimeOwnerCompleteExpiryReparseBeforeRetryShortCircuit(t *testing.T){
	// ParseWireTime is deliberately pure and has no observer hook. Supplement
	// the behavioral clock/error traces with the source-order requirement that
	// expiry is parsed after provider refusal even when retryExpired is false.
	file,err:=parser.ParseFile(token.NewFileSet(),"relay_credentials.go",nil,0);if err!=nil{t.Fatal(err)}
	callName:=func(expression ast.Expr)string{call,ok:=expression.(*ast.CallExpr);if !ok{return ""};selector,ok:=call.Fun.(*ast.SelectorExpr);if !ok{return ""};owner,ok:=selector.X.(*ast.Ident);if !ok{return ""};return owner.Name+"."+selector.Sel.Name}
	found:=map[string]bool{}
	for _,declaration:=range file.Decls{fn,ok:=declaration.(*ast.FuncDecl);if !ok||fn.Body==nil||(fn.Name.Name!="ensureRelayCredential"&&fn.Name.Name!="renewRelayCredentialAttempt"){continue}
		for index,statement:=range fn.Body.List{
			assign,ok:=statement.(*ast.AssignStmt);if !ok||len(assign.Rhs)!=1||callName(assign.Rhs[0])!="provider.ValidateRelay"{continue}
			if index+1>=len(fn.Body.List){t.Fatal("provider refusal branch disappeared")};refusal,ok:=fn.Body.List[index+1].(*ast.IfStmt);if !ok||len(refusal.Body.List)<2{t.Fatal("provider refusal no longer immediately reparses expiry")}
			reparse,ok:=refusal.Body.List[0].(*ast.AssignStmt);if !ok||len(reparse.Rhs)!=1||callName(reparse.Rhs[0])!="nativeexecution.ParseWireTime"{t.Fatal("expiry reused or moved under conditional retry",fn.Name.Name)}
			call:=reparse.Rhs[0].(*ast.CallExpr);if len(call.Args)!=1{t.Fatal("wire parser gained another provider")};field,ok:=call.Args[0].(*ast.SelectorExpr);if !ok||field.Sel.Name!="ValidUntil"{t.Fatal("reparse no longer reads returned bundle expiry")};owner,ok:=field.X.(*ast.Ident);if !ok||owner.Name!="bundle"{t.Fatal("stale expiry input reused")}
			if _,ok:=refusal.Body.List[1].(*ast.IfStmt);!ok{t.Fatal("expiry parse no longer precedes clock/retry condition")};found[fn.Name.Name]=true
		}
	}
	if len(found)!=2{t.Fatal("both provider-refusal owner paths must retain fresh parsing",found)}
}

package control

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeclaim"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/probeinstance"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type wireOwnerSchedule struct{
	runtimeplatform.Scheduler
	trace *timeOwnerTrace
	now time.Time
	workCancel context.CancelFunc
	nowCalls int
}
func(s *wireOwnerSchedule)Now()time.Time{s.trace.add("now");s.nowCalls++;return s.now}
func(s *wireOwnerSchedule)Since(start time.Time)time.Duration{s.trace.add("since");return s.now.Sub(start)}
func(s *wireOwnerSchedule)WithDeadline(ctx context.Context,deadline time.Time)(context.Context,context.CancelFunc){s.trace.add("deadline");work,cancel:=context.WithCancel(ctx);s.workCancel=cancel;return work,func(){s.trace.add("cancel");cancel()}}
func(s *wireOwnerSchedule)WithTimeout(ctx context.Context,timeout time.Duration)(context.Context,context.CancelFunc){s.trace.add("timeout");work,cancel:=context.WithCancel(ctx);s.workCancel=cancel;return work,func(){s.trace.add("cancel");cancel()}}
func(s *wireOwnerSchedule)AfterFunc(ctx context.Context,work func())func()bool{s.trace.add("after-func");if ctx.Err()!=nil{work()};return func()bool{s.trace.add("stop");return true}}
type wireOwnerEntropy struct{trace *timeOwnerTrace;calls int;failure error}
func(s *wireOwnerEntropy)ReadRandom(raw []byte)(int,error){s.trace.add("entropy");s.calls++;for i:=range raw{raw[i]=0xab};return 0,s.failure}
type wireOwnerDial struct{}
func(wireOwnerDial)DialContext(context.Context,string,string)(net.Conn,error){return nil,errors.New("unexpected test dial")}
type wireOwnerAuxiliary struct{
	executionchannel.Auxiliary[*http.Client]
	trace *timeOwnerTrace
	delivery func(context.Context,string,[]byte,uint64)(executionchannel.Reply,error)
	instance func(context.Context,[]byte,uint64)(executionchannel.Reply,error)
	claim func(context.Context,[]byte,uint64)(executionchannel.Reply,error)
	calls int
}
func(p *wireOwnerAuxiliary)ProbeDelivery(ctx context.Context,_ *http.Client,_ string,path string,raw []byte,epoch uint64)(executionchannel.Reply,error){p.trace.add("delivery:"+path);p.calls++;return p.delivery(ctx,path,raw,epoch)}
func(p *wireOwnerAuxiliary)ProbeInstance(ctx context.Context,_ *http.Client,_ string,raw []byte,epoch uint64)(executionchannel.Reply,error){p.trace.add("instance");p.calls++;return p.instance(ctx,raw,epoch)}
func(p *wireOwnerAuxiliary)ProbeClaim(ctx context.Context,_ *http.Client,_ string,raw []byte,epoch uint64)(executionchannel.Reply,error){p.trace.add("claim");p.calls++;return p.claim(ctx,raw,epoch)}
type wireOwnerBody struct{reader io.Reader;trace *timeOwnerTrace;onRead,onClose func();closes int;readErr error}
func(b *wireOwnerBody)Read(raw []byte)(int,error){b.trace.add("read");if b.onRead!=nil{work:=b.onRead;b.onRead=nil;work()};n,err:=b.reader.Read(raw);if b.readErr!=nil&&n>0{return n,b.readErr};return n,err}
func(b *wireOwnerBody)Close()error{b.trace.add("body-close");b.closes++;if b.onClose!=nil{b.onClose()};return nil}
func wireOwnerResponse(trace *timeOwnerTrace,status int,raw []byte)*wireOwnerBody{return &wireOwnerBody{reader:bytes.NewReader(raw),trace:trace}}
func wireOwnerStamp(at time.Time)string{return at.UTC().Format("2006-01-02T15:04:05.000Z")}

func TestProbeWireOwnerCompleteDeliveryBoundsErrorsAndDeferredClose(t *testing.T){
	for _,limit:=range []int{4096,32768}{for _,size:=range []int{limit,limit+1}{t.Run(fmt.Sprint(limit,"/",size),func(t *testing.T){
		trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace,now:time.Unix(1800000000,0)};body:=wireOwnerResponse(trace,200,bytes.Repeat([]byte("x"),size));provider:=&wireOwnerAuxiliary{trace:trace}
		path:="/agent/v3/probe/poll";if limit==32768{path="/agent/v3/probe/services/poll"}
		provider.delivery=func(ctx context.Context,gotPath string,raw []byte,epoch uint64)(executionchannel.Reply,error){if gotPath!=path||string(raw)!=`{"kind":"literal-request"}`||epoch!=2{t.Fatal("delivery request bytes/arguments",string(raw))};return executionchannel.Reply{StatusCode:200,Body:body},nil}
		runner:=&Runner{effects:Effects{Schedule:schedule,Auxiliary:provider}};session:=&registeredProbe{until:schedule.now.Add(time.Second),ctx:context.Background(),epoch:2}
		raw,started,err:=runner.probeDeliveryExchangeBounded(context.Background(),session,path,map[string]string{"kind":"literal-request"},limit)
		if !started.Equal(schedule.now)||schedule.nowCalls!=1||body.closes!=1||provider.calls!=1{t.Fatal("exchange sample/provider/close count",trace.values())};if size==limit{if err!=nil||len(raw)!=size{t.Fatal("exact response bound rejected",err,len(raw))}}else if err!=probe.ErrInvalid||raw!=nil{t.Fatal("bound+1 accepted",err,len(raw))}
		events:=trace.values();if !reflect.DeepEqual(events[len(events)-3:],[]string{"body-close","stop","cancel"}){t.Fatal("deferred body/stop/cancel order",events)}
	})}}
	for _,mode:=range []string{"reader","reader-and-oversize","status","cancel-before-status","oversize-before-cancel","io","forbidden"}{t.Run(mode,func(t *testing.T){
		trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace,now:time.Unix(1800000000,0)};failure:=errors.New("original body failure");raw:=[]byte(`{"code":"DENIED","code":17}`);status:=503
		if mode=="reader-and-oversize"||mode=="oversize-before-cancel"{raw=bytes.Repeat([]byte("x"),4097)}
		body:=wireOwnerResponse(trace,status,raw);if strings.HasPrefix(mode,"reader"){body.readErr=failure};if strings.Contains(mode,"cancel"){body.onRead=func(){schedule.workCancel()}}
		provider:=&wireOwnerAuxiliary{trace:trace,delivery:func(context.Context,string,[]byte,uint64)(executionchannel.Reply,error){if mode=="io"{return executionchannel.Reply{},failure};if mode=="forbidden"{return executionchannel.Reply{},executionchannel.ErrForbiddenURL};return executionchannel.Reply{StatusCode:status,Body:body},nil}}
		runner:=&Runner{effects:Effects{Schedule:schedule,Auxiliary:provider}};_,_,err:=runner.probeDeliveryExchange(context.Background(),&registeredProbe{ctx:context.Background(),epoch:2,until:schedule.now.Add(time.Second)},"/agent/v3/probe/poll",map[string]string{"kind":"request"})
		switch mode{case "reader","reader-and-oversize","io":if err!=failure{t.Fatal("reader/I/O error identity lost",err)};case "status":var problem httpError;if !errors.As(err,&problem)||problem.status!=503||problem.code!="DENIED"{t.Fatal("partial Code/status",err)};case "cancel-before-status":if !errors.Is(err,context.Canceled){t.Fatal("status preceded delivery work.Err",err)};case "oversize-before-cancel":if err!=probe.ErrInvalid{t.Fatal("cancel preceded oversize",err)};case "forbidden":if err!=probe.ErrDenied{t.Fatal("native URL refusal mapping",err)}}
		wantCloses:=1;if mode=="io"||mode=="forbidden"{wantCloses=0};if body.closes!=wantCloses{t.Fatal("response body lifetime",body.closes,trace.values())}
	})}
}

func TestProbeWireOwnerCompleteInvalidLargePathAndRequestBeforeProvider(t *testing.T){
	for _,tc:=range []struct{path string;limit int;input any;contexts bool}{
		{"/agent/v3/probe/types/poll",32768,map[string]any{},false},{"/agent/v3/probe/services/status",32768,map[string]any{},false},{"/agent/v3/probe/echo/poll",32769,map[string]any{},false},{"/agent/v3/probe/poll",0,map[string]any{},false},
		{"/agent/v3/probe/poll",4096,func(){},true},{"/agent/v3/probe/poll",4096,strings.Repeat("x",4095),true},
	}{t.Run(fmt.Sprint(tc.path,"/",tc.limit,"/",tc.contexts),func(t *testing.T){
		trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace,now:time.Unix(1800000000,0)};provider:=&wireOwnerAuxiliary{trace:trace};runner:=&Runner{effects:Effects{Schedule:schedule,Auxiliary:provider}}
		_,_,err:=runner.probeDeliveryExchangeBounded(context.Background(),&registeredProbe{ctx:context.Background(),until:schedule.now.Add(time.Second)},tc.path,tc.input,tc.limit)
		if err==nil||provider.calls!=0||schedule.nowCalls!=1{t.Fatal("invalid path/encoding/size reached provider",err,trace.values())};events:=trace.values();if tc.contexts{if !reflect.DeepEqual(events,[]string{"now","deadline","after-func","stop","cancel"}){t.Fatal("request refusal cancellation stage",events)}}else if !reflect.DeepEqual(events,[]string{"now"}){t.Fatal("invalid large-limit/path created context/provider work",events)}
	})}
	// JSON quotes consume two request bytes: 4094 characters is exactly4096.
	trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace,now:time.Unix(1800000000,0)};body:=wireOwnerResponse(trace,200,nil);provider:=&wireOwnerAuxiliary{trace:trace,delivery:func(_ context.Context,_ string,raw []byte,_ uint64)(executionchannel.Reply,error){if len(raw)!=4096{t.Fatal("request boundary fixture",len(raw))};return executionchannel.Reply{StatusCode:200,Body:body},nil}}
	runner:=&Runner{effects:Effects{Schedule:schedule,Auxiliary:provider}};if _,_,err:=runner.probeDeliveryExchange(context.Background(),&registeredProbe{ctx:context.Background(),until:schedule.now.Add(time.Second)},"/agent/v3/probe/poll",strings.Repeat("x",4094));err!=nil||provider.calls!=1{t.Fatal("4096 request rejected",err)}
}

func TestProbeWireOwnerCompleteInstanceParseCheckBeforeCancellation(t *testing.T){
	for _,mode:=range []string{"valid","parse","correlation","status","reader"}{t.Run(mode,func(t *testing.T){
		trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace};request:=probeinstance.Request{ProtocolVersion:3,ProbeVersion:1,Kind:"probe-instance",Action:"inspect",NodeId:"node",BootId:"boot",SessionEpoch:2,InstanceId:strings.Repeat("a",64)}
		ack:=probeinstance.Response{ProtocolVersion:3,ProbeVersion:1,Kind:"probe-instance-ack",Action:"inspect",NodeId:"node",BootId:"boot",SessionEpoch:2,InstanceId:request.InstanceId,State:"absent",ServerTime:"2026-10-19T01:02:03Z"}
		if mode=="correlation"{ack.BootId="other"};raw,_:=json.Marshal(ack);if mode=="parse"{raw=[]byte("{")};status:=200;if mode=="status"{status=403;raw=[]byte(`{"code":"DENIED"}`)};failure:=errors.New("instance body reader");body:=wireOwnerResponse(trace,status,raw);body.onRead=func(){schedule.workCancel()};if mode=="reader"{body.readErr=failure}
		provider:=&wireOwnerAuxiliary{trace:trace,instance:func(_ context.Context,raw []byte,epoch uint64)(executionchannel.Reply,error){want,_:=json.Marshal(request);if string(raw)!=string(want)||epoch!=2{t.Fatal("instance native request projection")};return executionchannel.Reply{StatusCode:status,Body:body},nil}}
		runner:=&Runner{effects:Effects{Schedule:schedule,Auxiliary:provider}};got,err:=runner.probeInstanceExchange(context.Background(),request)
		if err==nil||got!=nil||body.closes!=1{t.Fatal("instance refused result/lifetime",got,err)}
		switch mode{case "valid":if !errors.Is(err,context.Canceled){t.Fatal("instance work.Err missing after Parse+Check",err)};case "parse":_,want:=nativeexecution.DecodeProbeInstanceResponse(request,raw);if err.Error()!=want.Error(){t.Fatal("cancel preceded strict parse",err,want)};case "correlation":_,want:=nativeexecution.DecodeProbeInstanceResponse(request,raw);if err.Error()!=want.Error(){t.Fatal("cancel preceded response Check",err,want)};case "reader":if err!=failure{t.Fatal("reader error lost",err)};case "status":var problem httpError;if !errors.As(err,&problem)||problem.status!=403||problem.code!="DENIED"{t.Fatal("instance status before cancellation",err)}}
		events:=trace.values();if !reflect.DeepEqual(events[len(events)-2:],[]string{"body-close","cancel"}){t.Fatal("instance deferred close/cancel changed",events)}
	})}
}

func TestProbeWireOwnerCompleteLegacyClaimLateCancellationAndCloseAfterUnlock(t *testing.T){
	for _,mode:=range []string{"valid","parse","correlation","status","reader"}{t.Run(mode,func(t *testing.T){
		f:=newWireOwnerFixture(t,1);failure:=errors.New("original claim reader");var body *wireOwnerBody
		f.provider.claim=func(_ context.Context,raw []byte,epoch uint64)(executionchannel.Reply,error){
			if _,used:=f.session.claims["permit"];!used{t.Fatal("claim channel before tombstone")};var request probeclaim.Request;if err:=json.Unmarshal(raw,&request);err!=nil{t.Fatal(err)};req:=wireOwnerRequest(t,raw);ack:=wireOwnerMachineReply(req);ack["kind"]="probe-claim-ack";ack["binding"]=typedProbeBinding(f.binding);ack["timeoutMs"]=1000;ack["issuedAt"]=wireOwnerStamp(f.schedule.now.Add(-500*time.Millisecond));ack["expiresAt"]=wireOwnerStamp(f.schedule.now.Add(1500*time.Millisecond));ack["consumedAt"]=wireOwnerStamp(f.schedule.now.Add(-100*time.Millisecond));ack["serverTime"]=wireOwnerStamp(f.schedule.now);ack["state"]="consumed";ack["executionEnabled"]=false
			if mode=="correlation"{ack["bootId"]="other"};response:=wireOwnerJSON(t,ack);status:=200;if mode=="parse"{response=[]byte("{")};if mode=="status"{response=[]byte(`{"code":"DENIED"}`);status=503};body=wireOwnerResponse(f.trace,status,response);body.onRead=func(){f.schedule.workCancel()};body.onClose=func(){if !f.runner.mutex.TryLock(){t.Fatal("late claim returned without deferred unlock before body close")};f.runner.mutex.Unlock()};if mode=="reader"{body.readErr=failure};return executionchannel.Reply{StatusCode:status,Body:body},nil
		}
		got,err:=f.runner.claimProbe(context.Background(),"permit",f.binding);if err==nil||got!=nil||body==nil||body.closes!=1||f.provider.calls!=1||len(f.session.receipts)!=0{t.Fatal("late claim result/lifetime",got,err,f.trace.values())};if _,used:=f.session.claims["permit"];!used{t.Fatal("failed/cancelled claim refunded")}
		switch mode{case "valid":if !errors.Is(err,context.Canceled){t.Fatal("claim lost late locked work.Err",err)};case "parse","correlation":if errors.Is(err,context.Canceled){t.Fatal("claim cancellation preceded native Parse/Check",err)};case "status":var problem httpError;if !errors.As(err,&problem)||problem.status!=503||problem.code!="DENIED"{t.Fatal("claim status before late cancellation",err)};case "reader":if err!=failure{t.Fatal("claim reader identity",err)}}
		if got,err:=f.runner.claimProbe(context.Background(),"permit",f.binding);got!=nil||err!=probe.ErrReplay||f.provider.calls!=1{t.Fatal("claim retry reached provider",got,err)}
	})}
}

var wireOwnerNodeSequence atomic.Uint64
type wireOwnerFixture struct{runner *Runner;binding probe.Binding;session *registeredProbe;schedule *wireOwnerSchedule;entropy *wireOwnerEntropy;trace *timeOwnerTrace;provider *wireOwnerAuxiliary}
func newWireOwnerFixture(t *testing.T,family int)*wireOwnerFixture{
	t.Helper();runner,binding,sample:=probeTestRunner(t);sample.Wall=sample.Wall.Truncate(time.Millisecond);trace:=&timeOwnerTrace{};schedule:=&wireOwnerSchedule{trace:trace,now:sample.Wall};entropy:=&wireOwnerEntropy{trace:trace};provider:=&wireOwnerAuxiliary{trace:trace}
	node:=fmt.Sprint("wire-owner-",wireOwnerNodeSequence.Add(1));runner.options.NodeID=node;binding.NodeID=node;runner.options.ProbeRegistration=true;runner.options.ProbeExecution=true;runner.options.ProbeIngress=family>=2;runner.options.ProbeServices=family>=3;runner.options.ProbeEcho=family==4;runner.hello.Policy.MaxClockSkewSeconds=1
	runner.effects.Schedule=schedule;runner.effects.Auxiliary=provider;runner.local.Entropy=entropy
	// Bind the existing authority to a recorder; there is still one Guard and
	// one current instance ticket, with no background monitor or socket fixture.
	clock:=func()(authorization.Sample,error){trace.add("guard");return *sample,nil};guard,err:=authorization.New(clock,time.Second,5*time.Minute,sample.Wall.Add(10*time.Minute));if err!=nil{t.Fatal(err)};ticket,err:=guard.Accept(sample.Wall,sample.Wall.Add(time.Minute));if err!=nil{t.Fatal(err)};runner.guard=guard;runner.ticket=ticket;for key,instance:=range runner.instances{instance.ticket=ticket;runner.instances[key]=instance}
	executor,err:=probe.NewWithEffects(runner.resolveProbeTarget,probe.Effects{Schedule:schedule,Entropy:entropy,Dial:wireOwnerDial{}});if err!=nil{t.Fatal(err)};gate,err:=probe.NewGate(node,runner.options.BootID,runner.hello.SessionEpoch,executor);if err!=nil{t.Fatal(err)}
	ctx,cancel:=context.WithCancel(context.Background());session:=&registeredProbe{gate:gate,node:node,boot:runner.options.BootID,epoch:runner.hello.SessionEpoch,generation:1,guard:runner.guard,until:sample.Wall.Add(30*time.Second),ctx:ctx,cancel:cancel,claims:map[string]struct{}{},receipts:map[string]*probeClaimReceipt{},originalServerAt:sample.Wall.Add(-time.Second),originalExpiresAt:sample.Wall.Add(30*time.Second)}
	switch family{case 2:session.types=&qualifiedProbeTypes{until:sample.Wall.Add(20*time.Second)};case 3:session.services=&qualifiedProbeServices{until:sample.Wall.Add(20*time.Second)};case 4:session.echo=&qualifiedProbeEcho{until:sample.Wall.Add(20*time.Second)}};runner.probeRegistration=session
	t.Cleanup(func(){gate.Close();cancel()});return &wireOwnerFixture{runner,binding,session,schedule,entropy,trace,provider}
}

func wireOwnerJSON(t *testing.T,value any)[]byte{t.Helper();raw,err:=json.Marshal(value);if err!=nil{t.Fatal(err)};return raw}
func wireOwnerRequest(t *testing.T,raw []byte)map[string]any{t.Helper();var value map[string]any;if err:=json.Unmarshal(raw,&value);err!=nil{t.Fatal(err)};return value}
func wireOwnerFamily(family int)string{return map[int]string{1:"",2:"types/",3:"services/",4:"echo/"}[family]}
func wireOwnerMachineReply(request map[string]any)map[string]any{
	ack:=map[string]any{};for _,field:=range []string{"protocolVersion","probeVersion","nodeId","bootId","sessionEpoch","instanceId","instanceGeneration","requestId","measurement","taskKind","point","capability","businessProtocol","permitId","service","challenge"}{if value,ok:=request[field];ok{ack[field]=value}};return ack
}

func TestProbeWireOwnerCompleteThreeQualificationAndPollCallsites(t *testing.T){
	for family:=2;family<=4;family++{t.Run(fmt.Sprint(family),func(t *testing.T){
		f:=newWireOwnerFixture(t,family);f.session.typesPending=true;f.session.types=nil;f.session.services=nil;f.session.echo=nil;var actions []string
		f.provider.delivery=func(_ context.Context,path string,raw []byte,epoch uint64)(executionchannel.Reply,error){
			req:=wireOwnerRequest(t,raw);if req["probeVersion"]!=float64(family)||epoch!=2||req["nodeId"]!=f.session.node||req["instanceId"]!=f.session.gate.InstanceID(){t.Fatal("qualification Machine fields",req)};ack:=wireOwnerMachineReply(req);kind:=req["kind"].(string);ack["kind"]=kind+"-ack";ack["measurements"]=req["measurements"];ack["serverTime"]=f.schedule.now.UTC().Format(time.RFC3339Nano);ack["executionEnabled"]=false
			if strings.HasSuffix(path,"/instance"){action:=req["action"].(string);actions=append(actions,action);ack["action"]=action;ack["qualified"]=action=="register";ack["qualifiedAt"]=nil;ack["expiresAt"]=nil;if action=="register"{ack["qualifiedAt"]=f.schedule.now.UTC().Format(time.RFC3339Nano);ack["expiresAt"]=f.schedule.now.Add(20*time.Second).UTC().Format(time.RFC3339Nano)}}else if strings.HasSuffix(path,"/poll"){ack["observedAt"]=f.schedule.now.UTC().Format(time.RFC3339Nano);ack["offer"]=nil}else{t.Fatal("unexpected family route",path)}
			body:=wireOwnerResponse(f.trace,200,wireOwnerJSON(t,ack));return executionchannel.Reply{StatusCode:200,Body:body},nil
		}
		var err error;switch family{case 2:err=f.runner.qualifyProbeTypes(context.Background(),f.session);case 3:err=f.runner.qualifyProbeServices(context.Background(),f.session);case 4:err=f.runner.qualifyProbeEcho(context.Background(),f.session)}
		if err!=nil||!reflect.DeepEqual(actions,[]string{"inspect","register"})||f.session.typesPending||f.provider.calls!=2{t.Fatal("qualification sequence/family",err,actions,f.trace.values())}
		var offer *probeDeliveryOffer;switch family{case 2:offer,err=f.runner.pollProbeTypes(context.Background(),f.session);case 3:offer,err=f.runner.pollProbeServices(context.Background(),f.session);case 4:offer,err=f.runner.pollProbeEcho(context.Background(),f.session)}
		if err!=nil||offer!=nil||f.provider.calls!=3||len(f.session.claims)!=0{t.Fatal("family poll nil-offer/current result",offer,err,f.trace.values())}
		// Gate creation and each of inspect/register/poll still consume exactly
		// one32-byte entropy read (the source's short count remains ignored).
		if f.entropy.calls!=4{t.Fatal("native Machine request entropy stages",f.entropy.calls)}
	})}
}

func wireOwnerClaim(t *testing.T,f *wireOwnerFixture,family int)*probeClaimReceipt{
	t.Helper();now:=f.schedule.now
	offer:=probeDeliveryOffer{permitID:"permit",measurement:probe.MeasurementEgress,typed:family==2,services:family==3,echo:family==4,binding:f.binding,session:f.session,until:now.Add(time.Second),timeout:time.Second,issuedAt:wireOwnerStamp(now.Add(-500*time.Millisecond)),expiresAt:wireOwnerStamp(now.Add(1500*time.Millisecond))}
	f.provider.delivery=func(_ context.Context,path string,raw []byte,epoch uint64)(executionchannel.Reply,error){
		if path!="/agent/v3/probe/"+wireOwnerFamily(family)+"claim"||epoch!=f.session.epoch{t.Fatal("claim path/epoch",path,epoch)}
		if _,burned:=f.session.claims[offer.permitID];!burned{t.Fatal("claim provider reached before original tombstone")}
		req:=wireOwnerRequest(t,raw);ack:=wireOwnerMachineReply(req);ack["kind"]=req["kind"].(string)+"-ack";ack["binding"]=typedProbeBinding(f.binding);ack["timeoutMs"]=1000;ack["issuedAt"]=offer.issuedAt;ack["expiresAt"]=offer.expiresAt;ack["consumedAt"]=wireOwnerStamp(now.Add(-100*time.Millisecond));ack["serverTime"]=wireOwnerStamp(now);ack["state"]="consumed";ack["executionEnabled"]=false
		return executionchannel.Reply{StatusCode:200,Body:wireOwnerResponse(f.trace,200,wireOwnerJSON(t,ack))},nil
	}
	var receipt *probeClaimReceipt;var err error;switch family{case 2:receipt,err=f.runner.claimProbeTypes(context.Background(),offer);case 3:receipt,err=f.runner.claimProbeServices(context.Background(),offer);case 4:receipt,err=f.runner.claimProbeEcho(context.Background(),offer)}
	if err!=nil||receipt==nil||f.session.receipts["permit"]!=receipt||receipt.binding!=f.binding||receipt.typed!=(family==2)||receipt.services!=(family==3)||receipt.echo!=(family==4){t.Fatal("claim owner retained projection",family,receipt,err,f.trace.values())}
	return receipt
}

func wireOwnerWatch(t *testing.T,f *wireOwnerFixture,receipt *probeClaimReceipt)*probeAuthorityWatch{
	t.Helper();ctx,cancel:=context.WithCancel(context.Background());t.Cleanup(cancel)
	return &probeAuthorityWatch{runner:f.runner,receipt:*receipt,ctx:ctx,cancel:cancel,changed:make(chan struct{},1),ready:true,until:receipt.until,freshUntil:f.schedule.now.Add(200*time.Millisecond),lastChecked:f.schedule.now.Add(-time.Millisecond),lastServer:f.schedule.now}
}

func TestProbeWireOwnerCompleteClaimStatusAndAllResultDispatch(t *testing.T){
	for family:=1;family<=4;family++{for _,mode:=range []string{"valid","local","io","status","parse","correlation","expired-after-ack"}{t.Run(fmt.Sprint(family,"/",mode),func(t *testing.T){
		f:=newWireOwnerFixture(t,family);var receipt *probeClaimReceipt
		if family==1{receipt=&probeClaimReceipt{permitID:"permit",binding:f.binding,session:f.session,until:f.schedule.now.Add(time.Second),timeout:time.Second,issuedAt:wireOwnerStamp(f.schedule.now.Add(-500*time.Millisecond)),expiresAt:wireOwnerStamp(f.schedule.now.Add(1500*time.Millisecond)),consumedAt:wireOwnerStamp(f.schedule.now.Add(-100*time.Millisecond)),serverAt:f.schedule.now}}else{receipt=wireOwnerClaim(t,f,family)}
		watch:=wireOwnerWatch(t,f,receipt);var bodies []*wireOwnerBody
		f.provider.delivery=func(_ context.Context,path string,raw []byte,epoch uint64)(executionchannel.Reply,error){
			req:=wireOwnerRequest(t,raw);ack:=wireOwnerMachineReply(req);ack["kind"]=req["kind"].(string)+"-ack";ack["binding"]=typedProbeBinding(f.binding);ack["timeoutMs"]=1000;ack["issuedAt"]=receipt.issuedAt;ack["expiresAt"]=receipt.expiresAt;ack["consumedAt"]=receipt.consumedAt;ack["checkedAt"]=wireOwnerStamp(f.schedule.now);ack["serverTime"]=wireOwnerStamp(f.schedule.now);ack["state"]="consumed";ack["executionEnabled"]=false
			if path!="/agent/v3/probe/"+wireOwnerFamily(family)+"status"{t.Fatal("status family fell back",path)};body:=wireOwnerResponse(f.trace,200,wireOwnerJSON(t,ack));bodies=append(bodies,body);return executionchannel.Reply{StatusCode:200,Body:body},nil
		}
		var err error;switch family{case 1:err=f.runner.probeStatusExchange(watch);case 2:err=f.runner.probeTypesStatusExchange(watch);case 3:err=f.runner.probeServicesStatusExchange(watch);case 4:err=f.runner.probeEchoStatusExchange(watch)}
		if err!=nil||!watch.lastChecked.Equal(f.schedule.now)||!watch.lastServer.Equal(f.schedule.now)||len(bodies)!=1||bodies[0].closes!=1{t.Fatal("status owner publish/body lifetime",err,f.trace.values())}
		fields:=proberesult.Request{ProtocolVersion:3,ProbeVersion:1,Kind:"probe-result",NodeId:f.session.node,BootId:f.session.boot,SessionEpoch:f.session.epoch,InstanceId:f.session.gate.InstanceID(),InstanceGeneration:1,RequestId:strings.Repeat("b",64),PermitId:receipt.permitID,Binding:probeCounterBinding(f.binding),TimeoutMs:1000,IssuedAt:receipt.issuedAt,ExpiresAt:receipt.expiresAt,ConsumedAt:receipt.consumedAt,MeasuredAt:wireOwnerStamp(f.schedule.now),ValidUntil:wireOwnerStamp(f.schedule.now.Add(100*time.Millisecond)),ElapsedMs:0,Point:"agent-direct-egress",Status:"connected",Code:"tcp-connected",ApplicationHealth:"unknown",Source:"agent-reported"}
		execution:=&probeExecution{watch:watch,body:fields,reportUntil:f.schedule.now.Add(100*time.Millisecond),validityUntil:f.schedule.now.Add(100*time.Millisecond)}
		switch family{case 2:d,_:=probeTypesDescriptor(probe.MeasurementEgress);body,e:=nativeexecution.ProbeTypesResult(fields,d,typedProbeBinding(f.binding));err=e;execution.typedBody=&body;case 3:d,_:=probeServicesDescriptor(probe.MeasurementEgress);body,e:=nativeexecution.ProbeServicesResult(fields,d,typedProbeBinding(f.binding),nil,nil);err=e;execution.servicesBody=&body;case 4:d,_:=probeecho.DescriptorFor(probe.MeasurementEgress);body,e:=nativeexecution.ProbeEchoResult(fields,d,typedProbeBinding(f.binding),nil,nil,nil,0,0);err=e;execution.echoBody=&body}
		if err!=nil{t.Fatal("result fixture projection",err)}
		failure:=errors.New("original report stage")
		f.provider.delivery=func(_ context.Context,path string,raw []byte,epoch uint64)(executionchannel.Reply,error){
			if path!="/agent/v3/probe/"+wireOwnerFamily(family)+"result"||!execution.reported.Load(){t.Fatal("result dispatch/burn before I/O",path)}
			if mode=="io"{return executionchannel.Reply{},failure}
			req:=wireOwnerRequest(t,raw);ack:=wireOwnerMachineReply(req);if family==1{delete(ack,"point")};ack["kind"]=req["kind"].(string)+"-ack";ack["acceptedAt"]=wireOwnerStamp(f.schedule.now);ack["serverTime"]=wireOwnerStamp(f.schedule.now);ack["duplicate"]=false;ack["health"]="unknown";ack["executionEnabled"]=false
			var digest string;var e error;switch family{case 1:digest,e=proberesult.ResultDigest(execution.body);case 2:digest,e=probetypes.ResultDigest(*execution.typedBody);case 3:digest,e=probeservices.ResultDigest(*execution.servicesBody);case 4:digest,e=probeecho.ResultDigest(*execution.echoBody)};if e!=nil{t.Fatal(e)};ack["resultDigest"]=digest
			if mode=="correlation"{ack["requestId"]=strings.Repeat("d",64)};response:=wireOwnerJSON(t,ack);status:=200;if mode=="parse"{response=[]byte("{")};if mode=="status"{response=[]byte(`{"code":"DENIED"}`);status=503};body:=wireOwnerResponse(f.trace,status,response);if mode=="expired-after-ack"{body.onRead=func(){f.schedule.now=execution.reportUntil}};bodies=append(bodies,body);return executionchannel.Reply{StatusCode:status,Body:body},nil
		}
		if mode=="local"{watch.err=failure};before:=f.provider.calls;err=f.runner.reportProbe(execution);wantCalls:=1;wantBodies:=2;if mode=="local"{wantCalls=0;wantBodies=1};if mode=="io"{wantBodies=1};if (err==nil)!=(mode=="valid")||f.provider.calls!=before+wantCalls||len(bodies)!=wantBodies{t.Fatal("result ACK/final authority/lifetime",mode,err,f.trace.values())};for _,body:=range bodies{if body.closes!=1{t.Fatal("result body not closed",mode,body.closes)}};if (mode=="local"||mode=="io")&&err!=failure{t.Fatal("original report stage error",mode,err)};if again:=f.runner.reportProbe(execution);again!=probe.ErrReplay||f.provider.calls!=before+wantCalls{t.Fatal("result retry after first attempt",again)}
	})}}
}

func wireOwnerCalls(t *testing.T,file,name string)[]string{
	t.Helper();source,err:=parser.ParseFile(token.NewFileSet(),file,nil,0);if err!=nil{t.Fatal(err)}
	for _,declaration:=range source.Decls{fn,ok:=declaration.(*ast.FuncDecl);if !ok||fn.Name.Name!=name{continue};var calls []string;ast.Inspect(fn.Body,func(node ast.Node)bool{call,ok:=node.(*ast.CallExpr);if !ok{return true};switch target:=call.Fun.(type){case *ast.Ident:calls=append(calls,target.Name);case *ast.SelectorExpr:calls=append(calls,target.Sel.Name)};return true});return calls};t.Fatal("original owner function missing",file,name);return nil
}
func wireOwnerOrdered(t *testing.T,calls []string,want ...string){t.Helper();index:=0;for _,call:=range calls{if index<len(want)&&call==want[index]{index++}};if index!=len(want){t.Fatal("original owner stage order changed",calls,want,index)}}

func TestProbeWireOwnerCompleteNativeCallsiteEncodingParsingAndDispatchOrder(t *testing.T){
	// These source assertions complement executable port traces. They pin the
	// original prevalidation and the exchange's second Encode, which must not
	// disappear even though the encoded byte local is replaced at the callsite.
	for _,family:=range []string{"Types","Services","Echo"}{
		stem:=strings.ToLower(family);delivery:="probe_"+stem+"_delivery.go";execution:="probe_"+stem+"_execution.go";instance:="probe_"+stem+"_instance.go"
		wireOwnerOrdered(t,wireOwnerCalls(t,instance,"qualifyProbe"+family),"EncodeProbe"+family+"Qualification","probeDeliveryExchange","DecodeProbe"+family+"Qualification")
		if family!="Types"{wireOwnerOrdered(t,wireOwnerCalls(t,delivery,"pollProbe"+family),"EncodeProbe"+family+"Poll","probeDeliveryExchangeBounded","DecodeProbe"+family+"Poll")}
		// v2 has the4096 wrapper; v3/v4 poll use32768 directly.
		if family=="Types"{wireOwnerOrdered(t,wireOwnerCalls(t,delivery,"pollProbe"+family),"EncodeProbeTypesPoll","probeDeliveryExchange","DecodeProbeTypesPoll")}
		wireOwnerOrdered(t,wireOwnerCalls(t,delivery,"claimProbe"+family),"Probe"+family+"ClaimRequest","EncodeProbe"+family+"Claim","probeDeliveryExchange","DecodeProbe"+family+"Claim","ParseProbeWireTime")
		wireOwnerOrdered(t,wireOwnerCalls(t,execution,"probe"+family+"StatusExchange"),"EncodeProbe"+family+"Status","probeDeliveryExchange","DecodeProbe"+family+"Status","probeFreshUntilWith","probeWatchLocal","ParseProbeWireTime","ParseProbeWireTime","publish")
		wireOwnerOrdered(t,wireOwnerCalls(t,execution,"reportProbe"+family),"WithDeadline","probeDeliveryExchange","DecodeProbe"+family+"ResultResponse","ParseProbeWireTime","ValidateServerTime")
	}
	wireOwnerOrdered(t,wireOwnerCalls(t,"probe_delivery.go","probeDeliveryExchangeBounded"),"Now","WithDeadline","AfterFunc","EncodeProbeRequest","ProbeDelivery","Close","ReadProbeResponseBody","Err","ProbeResponseErrorCode")
	wireOwnerOrdered(t,wireOwnerCalls(t,"probe_workflow.go","reportProbe"),"CompareAndSwap","reportProbeEcho","reportProbeServices","reportProbeTypes","resultRequest","DecodeProbeResultResponse","ValidateServerTime","resultRequest")
	wireOwnerOrdered(t,wireOwnerCalls(t,"probe_execution.go","executeConsumedProbe"),"Run","Check","projectProbeResultWith","probeEchoResult","serviceProbeResultWith","typedProbeResult","checkResultAuthority")
	for _,name:=range []string{"ProbeTypesResult","ProbeServicesResult","ProbeEchoResult","ProjectProbeResult"}{for _,call:=range wireOwnerCalls(t,"../nativeexecution/probe_result_wire.go",name){if call=="Now"||call=="ReadRandom"||call=="Check"||call=="SaveJournal"||call=="Allow"{t.Fatal("pure native result leaf acquired live clock/authority",name,call)}}}
}

func wireOwnerServiceContext(t *testing.T,now time.Time)observationtrust.Context{
	t.Helper();key:=ed25519.NewKeyFromSeed(bytes.Repeat([]byte{7},ed25519.SeedSize));uri,err:=url.Parse("urn:tunex:observation-service:scope:service");if err!=nil{t.Fatal(err)}
	leaf:=&x509.Certificate{SerialNumber:big.NewInt(1),NotBefore:now.Add(-time.Minute).Truncate(time.Second),NotAfter:now.Add(2*time.Minute).Truncate(time.Second),DNSNames:[]string{"probe.example"},URIs:[]*url.URL{uri},ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},KeyUsage:x509.KeyUsageDigitalSignature}
	der,err:=x509.CreateCertificate(bytes.NewReader(bytes.Repeat([]byte{3},4096)),leaf,leaf,key.Public(),key);if err!=nil{t.Fatal(err)}
	config:=observationtrust.Config{Version:1,Purpose:"direct-ingress-tls-handshake",Endpoint:observationtrust.Endpoint{Address:"127.0.0.1",Port:22001},Trust:observationtrust.LeafPin{Mode:"pinned-leaf-v1",ServerName:"probe.example",CertificateDer:base64.StdEncoding.EncodeToString(der)},ValidFrom:uint64(now.Add(-time.Second).UnixMilli()),ValidUntil:uint64(now.Add(time.Minute).UnixMilli())}
	digest,err:=contracts.ComputeDigest(config);if err!=nil{t.Fatal(err)};contextDigest,err:=contracts.ComputeDigest(map[string]any{"scopeId":"scope","serviceId":"service","revision":uint64(2),"configRevision":uint64(1),"configDigest":digest,"config":config});if err!=nil{t.Fatal(err)}
	value:=observationtrust.Context{ScopeID:"scope",ServiceID:"service",Revision:2,ConfigRevision:1,ConfigDigest:digest,ContextDigest:contextDigest,Config:config};if _,err:=observationtrust.New(value,now);err!=nil{t.Fatal("native trust fixture",err)};return value
}

func wireOwnerResultFields(f *wireOwnerFixture)proberesult.Request{
	now:=f.schedule.now;return proberesult.Request{ProtocolVersion:3,ProbeVersion:1,Kind:"probe-result",NodeId:f.session.node,BootId:f.session.boot,SessionEpoch:f.session.epoch,InstanceId:f.session.gate.InstanceID(),InstanceGeneration:1,RequestId:strings.Repeat("b",64),PermitId:"permit",Binding:probeCounterBinding(f.binding),TimeoutMs:1000,IssuedAt:wireOwnerStamp(now.Add(-time.Second)),ExpiresAt:wireOwnerStamp(now.Add(time.Second)),ConsumedAt:wireOwnerStamp(now.Add(-10*time.Millisecond)),MeasuredAt:wireOwnerStamp(now),ValidUntil:wireOwnerStamp(now.Add(100*time.Millisecond)),ElapsedMs:5,Point:"agent-local-direct-ingress",Status:"verified",Code:"tls-handshake-verified",ApplicationHealth:"unknown",Source:"agent-reported"}
}

func TestProbeWireOwnerCompleteServiceContextTLSValidationAndNowStage(t *testing.T){
	f:=newWireOwnerFixture(t,3);service:=wireOwnerServiceContext(t,f.schedule.now);trust,err:=observationtrust.New(service,f.schedule.now);if err!=nil{t.Fatal(err)}
	var native probeservices.ServiceContext;if err:=json.Unmarshal(wireOwnerJSON(t,service),&native);err!=nil{t.Fatal(err)}
	projected,err:=probeServiceContext(&native);if err!=nil||projected==nil||*projected!=service{t.Fatal("native service Marshal/Parse/Unmarshal/Trust projection",err)};projected.Config.Endpoint.Port++;if native.Config.Endpoint.Port!=22001{t.Fatal("native service projection retained caller alias")};if value,err:=probeServiceContext(nil);value!=nil||err!=nil{t.Fatal("nil context projection",value,err)}
	machine:=nativeexecution.ProbeServicesMachine(f.session.node,f.session.boot,f.session.epoch,f.session.gate.InstanceID(),1,strings.Repeat("b",64));descriptor,err:=probeServicesDescriptor(probe.MeasurementIngressTLS);if err!=nil{t.Fatal(err)};claim:=nativeexecution.ProbeServicesClaimRequest(machine,descriptor,"permit",probeServiceSelection(&service));claimRaw,err:=nativeexecution.EncodeProbeServicesClaim(claim);if err!=nil{t.Fatal(err)};status,statusRaw,err:=nativeexecution.EncodeProbeServicesStatus(machine,descriptor,"permit",probeServiceSelection(&service));if err!=nil{t.Fatal(err)};for _,raw:=range [][]byte{claimRaw,statusRaw}{if !strings.Contains(string(raw),fmt.Sprintf(`"service":{"scopeId":"scope","serviceId":"service","revision":2,"configRevision":1,"configDigest":%q,"contextDigest":%q}`,service.ConfigDigest,service.ContextDigest))||!strings.Contains(string(raw),`"measurement":"tcp-ingress-tls-v1","taskKind":"tcp-ingress-tls","point":"agent-local-direct-ingress","capability":"probe.tcp-ingress-tls.v1"`){t.Fatal("nonnull service claim/status literal fields",string(raw))}};second,err:=nativeexecution.EncodeProbeRequest(status);if err!=nil||string(second)!=string(statusRaw){t.Fatal("nonnull service status second encoding",err)}
	for _,mode:=range []string{"valid","family","descriptor","point","missing-context","different-context","invalid-trust","expired-trust","unverified","version","alpn","fingerprint","status","code","no-tls-failure","no-tls-success","egress-extra-evidence"}{t.Run(mode,func(t *testing.T){
		contextCopy:=service;resultContext:=service;receipt:=probeClaimReceipt{services:true,measurement:probe.MeasurementIngressTLS,binding:f.binding,service:&contextCopy};fields:=wireOwnerResultFields(f);result:=probe.Result{Service:&resultContext,TLS:&observationtrust.Verification{Version:"TLSv1.3",ALPN:observationtrust.ALPN,LeafFingerprint:trust.Fingerprint(),Verified:true}}
		wantNow,wantOK:=1,false
		switch mode{case "valid":wantOK=true;case "family":receipt.services=false;wantNow=0;case "descriptor":receipt.measurement="invalid";wantNow=0;case "point":fields.Point="agent-direct-egress";wantNow=0;case "missing-context":receipt.service=nil;wantNow=0;case "different-context":resultContext.Revision++;wantNow=0;case "invalid-trust":contextCopy.ConfigDigest="sha256:"+strings.Repeat("0",64);resultContext=contextCopy;case "expired-trust":contextCopy.Config.ValidUntil=uint64(f.schedule.now.UnixMilli());resultContext=contextCopy;case "unverified":result.TLS.Verified=false;case "version":result.TLS.Version="TLSv1.2";case "alpn":result.TLS.ALPN="other";case "fingerprint":result.TLS.LeafFingerprint="sha256:"+strings.Repeat("0",64);case "status":fields.Status="connected";case "code":fields.Code="tcp-connected";case "no-tls-failure":result.TLS=nil;fields.Status="unverified";fields.Code="tls-handshake-failed";wantOK=true;case "no-tls-success":result.TLS=nil;case "egress-extra-evidence":receipt.measurement=probe.MeasurementEgress;fields.Point="agent-direct-egress";wantNow=0}
		before:=f.schedule.nowCalls;body,err:=serviceProbeResultWith(f.schedule,receipt,fields,result);if f.schedule.nowCalls-before!=wantNow||(err==nil)!=wantOK{t.Fatal("service/TLS first refusal versus native Now",mode,err,f.schedule.nowCalls-before,wantNow)}
		if wantOK{if body.Service==nil||*body.Service!=*probeServiceSelection(&service)||(body.TLS!=nil)!=(result.TLS!=nil){t.Fatal("service/TLS projection lost native fields",body)};raw:=string(wireOwnerJSON(t,body));selection:=fmt.Sprintf(`"service":{"scopeId":"scope","serviceId":"service","revision":2,"configRevision":1,"configDigest":%q,"contextDigest":%q}`,service.ConfigDigest,service.ContextDigest);if !strings.Contains(raw,selection)||!strings.Contains(raw,`"probeVersion":3`)||!strings.Contains(raw,`"applicationPayloadBytes":0`){t.Fatal("service literal native fields",raw)};if result.TLS!=nil&&!strings.Contains(raw,fmt.Sprintf(`"tls":{"version":"TLSv1.3","alpn":"tunex-observation/1","leafFingerprint":%q,"verified":true}`,trust.Fingerprint())){t.Fatal("TLS literal native fields",raw)}}else if err!=probe.ErrDenied{t.Fatal("native owner refusal changed",err)}
	})}
	wireOwnerOrdered(t,wireOwnerCalls(t,"../nativeexecution/probe_qualification_wire.go","ProbeServiceContext"),"Marshal","ParseServiceContext","Unmarshal","New","Now","Context")
	wireOwnerOrdered(t,wireOwnerCalls(t,"probe_services_execution.go","serviceProbeResultWith"),"probeServicesDescriptor","New","Now","Fingerprint","ProbeServicesResult")
	// A context valid only under the injected future sample distinguishes this
	// private extension point from the unchanged native wrapper's real clock.
	future:=newWireOwnerFixture(t,3);future.schedule.now=future.schedule.now.Add(10*time.Minute);futureContext:=wireOwnerServiceContext(t,future.schedule.now);futureTrust,err:=observationtrust.New(futureContext,future.schedule.now);if err!=nil{t.Fatal(err)};receipt:=probeClaimReceipt{services:true,measurement:probe.MeasurementIngressTLS,binding:future.binding,service:&futureContext};fields:=wireOwnerResultFields(future);result:=probe.Result{Service:&futureContext,TLS:&observationtrust.Verification{Version:"TLSv1.3",ALPN:observationtrust.ALPN,LeafFingerprint:futureTrust.Fingerprint(),Verified:true}}
	if _,err:=serviceProbeResultWith(future.schedule,receipt,fields,result);err!=nil{t.Fatal("injected trust sample not used",err)};before:=future.schedule.nowCalls;if _,err:=serviceProbeResult(receipt,fields,result);err!=probe.ErrDenied||future.schedule.nowCalls!=before{t.Fatal("native wrapper acquired injected future schedule",err)}
}

func wireOwnerEchoExecution(t *testing.T,f *wireOwnerFixture,measurement string)(probeecho.Execution,*probeecho.Proof){
	t.Helper();now:=f.schedule.now;key:=ed25519.NewKeyFromSeed(bytes.Repeat([]byte{9},ed25519.SeedSize));config:=probeecho.ServiceConfig{Version:2,Purpose:"controlled-nonce-echo",Endpoint:probeecho.ServiceEndpoint{Address:"127.0.0.1",Port:22001,Protocols:[]string{"tcp","udp"}},Trust:probeecho.ServiceTrust{Mode:"ed25519-echo-v1",PublicKey:base64.StdEncoding.EncodeToString(key.Public().(ed25519.PublicKey))},ValidFrom:uint64(now.Add(-time.Minute).UnixMilli()),ValidUntil:uint64(now.Add(time.Minute).UnixMilli())}
	digest,err:=contracts.ComputeDigest(config);if err!=nil{t.Fatal(err)};selection:=probeecho.Selection{ScopeId:"scope",ServiceId:"echo-service",Revision:2,ConfigRevision:1,ConfigDigest:digest};selection.ContextDigest,err=contracts.ComputeDigest(map[string]any{"scopeId":selection.ScopeId,"serviceId":selection.ServiceId,"revision":selection.Revision,"configRevision":selection.ConfigRevision,"configDigest":digest,"config":config});if err!=nil{t.Fatal(err)}
	service:=probeecho.ServiceContext{Selection:selection,Config:config};nonce:=base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{11},32));invocation:=probeecho.Invocation{Domain:probeecho.InvocationDomain,ProbeVersion:4,Measurement:measurement,PermitId:"permit",Binding:typedProbeBinding(f.binding),InstanceId:f.session.gate.InstanceID(),InstanceGeneration:1,TimeoutMs:1000,IssuedAt:wireOwnerStamp(now.Add(-time.Second)),ExpiresAt:wireOwnerStamp(now.Add(time.Second)),Service:selection,Nonce:nonce}
	invocationDigest,err:=probeecho.InvocationDigest(invocation);if err!=nil{t.Fatal(err)};challenge:=probeecho.Challenge{Nonce:nonce,InvocationDigest:invocationDigest};frame,err:=probeecho.RequestFrame(invocation,challenge);if err!=nil{t.Fatal(err)};transport:="tcp";if measurement==probeecho.MeasurementUDP{transport="udp"};request,err:=probeecho.DecodeEchoRequest(frame,service,now,transport);if err!=nil{t.Fatal(err)};response,err:=probeecho.SignEchoResponse(*request,key);if err!=nil{t.Fatal(err)};proof,err:=probeecho.VerifyEchoResponse(response,service,invocation,challenge);if err!=nil{t.Fatal(err)}
	return probeecho.Execution{Context:service,Challenge:challenge,Invocation:invocation},proof
}

func TestProbeWireOwnerCompleteEchoProofNativeFieldsAndRefusals(t *testing.T){
	for _,measurement:=range []string{probeecho.MeasurementTCP,probeecho.MeasurementUDP}{t.Run(measurement,func(t *testing.T){
		f:=newWireOwnerFixture(t,4);input,proof:=wireOwnerEchoExecution(t,f,measurement)
		machine:=nativeexecution.ProbeEchoMachine(f.session.node,f.session.boot,f.session.epoch,f.session.gate.InstanceID(),1,strings.Repeat("b",64));descriptor,err:=probeecho.DescriptorFor(measurement);if err!=nil{t.Fatal(err)}
		claim:=nativeexecution.ProbeEchoClaimRequest(machine,descriptor,"permit",probeEchoSelection(nil,&input),probeEchoChallenge(&input));claimRaw,err:=nativeexecution.EncodeProbeEchoClaim(claim);if err!=nil{t.Fatal("echo claim selection/challenge",err)};status,statusRaw,err:=nativeexecution.EncodeProbeEchoStatus(machine,descriptor,"permit",probeEchoSelection(nil,&input),probeEchoChallenge(&input));if err!=nil{t.Fatal("echo status selection/challenge",err)}
		for _,raw:=range [][]byte{claimRaw,statusRaw}{literal:=string(raw);if !strings.Contains(literal,fmt.Sprintf(`"service":{"scopeId":"scope","serviceId":"echo-service","revision":2,"configRevision":1,"configDigest":%q,"contextDigest":%q}`,input.Context.ConfigDigest,input.Context.ContextDigest))||!strings.Contains(literal,fmt.Sprintf(`"challenge":{"nonce":%q,"invocationDigest":%q}`,input.Challenge.Nonce,input.Challenge.InvocationDigest)){t.Fatal("nonnull echo claim/status literal selection/challenge",literal)}};second,err:=nativeexecution.EncodeProbeRequest(status);if err!=nil||string(second)!=string(statusRaw){t.Fatal("nonnull echo status second encoding",err)}
		for _,mode:=range []string{"valid","family","missing-input","service","result-service","tls","descriptor","point","measurement","verified","status","code","signature","request-bytes","response-bytes","missing-proof","rejected"}{t.Run(mode,func(t *testing.T){
			owned:=probeecho.CloneExecution(input);proofCopy:=*proof;receipt:=probeClaimReceipt{echo:true,measurement:measurement,binding:f.binding,echoInput:&owned};fields:=wireOwnerResultFields(f);fields.Status="echoed";fields.Code="nonce-echo-verified";result:=probe.Result{Measurement:measurement,Echo:&proofCopy,RequestBytes:256,ResponseBytes:256};wantOK:=false
			switch mode{case "valid":wantOK=true;case "family":receipt.echo=false;case "missing-input":receipt.echoInput=nil;case "service":receipt.service=&observationtrust.Context{};case "result-service":result.Service=&observationtrust.Context{};case "tls":result.TLS=&observationtrust.Verification{};case "descriptor":receipt.measurement="invalid";case "point":fields.Point="agent-direct-egress";case "measurement":result.Measurement=probe.MeasurementEgress;case "verified":proofCopy.Verified=false;case "status":fields.Status="connected";case "code":fields.Code="tcp-connected";case "signature":proofCopy.Signature=base64.StdEncoding.EncodeToString(make([]byte,64));case "request-bytes":result.RequestBytes=255;case "response-bytes":result.ResponseBytes=255;case "missing-proof":result.Echo=nil;case "rejected":result.Echo=nil;result.ResponseBytes=0;fields.Status="unverified";fields.Code="nonce-echo-rejected";wantOK=true}
			before:=f.schedule.nowCalls;body,err:=probeEchoResult(receipt,fields,result);if (err==nil)!=wantOK||f.schedule.nowCalls!=before{t.Fatal("echo owner validation/error/sample stage",mode,err,f.trace.values())};if !wantOK{if err!=probe.ErrDenied{t.Fatal("native echo refusal identity",err)};return}
			if body.Service==nil||*body.Service!=input.Context.Selection||body.Challenge==nil||*body.Challenge!=input.Challenge||body.RequestBytes!=256||body.ResponseBytes!=result.ResponseBytes||body.ApplicationPayloadBytes!=256+result.ResponseBytes||body.BusinessProtocol!=map[bool]string{false:"tcp",true:"udp"}[measurement==probeecho.MeasurementUDP]{t.Fatal("echo selection/challenge/bytes/protocol lost",body)}
			raw:=string(wireOwnerJSON(t,body));if !strings.Contains(raw,`"probeVersion":4`)||!strings.Contains(raw,`"tls":null`)||!strings.Contains(raw,fmt.Sprintf(`"challenge":{"nonce":%q,"invocationDigest":%q}`,input.Challenge.Nonce,input.Challenge.InvocationDigest)){t.Fatal("native echo literal fields",raw)}
			if mode=="valid"{if body.Echo==nil||*body.Echo!=*proof||!strings.Contains(raw,fmt.Sprintf(`"echo":{"algorithm":"Ed25519","requestDigest":%q,"signature":%q,"verified":true}`,proof.RequestDigest,proof.Signature)){t.Fatal("native proof literal fields",raw)};proofCopy.Signature="mutated";owned.Challenge.Nonce="mutated";if body.Echo.Signature!=proof.Signature||body.Challenge.Nonce!=input.Challenge.Nonce{t.Fatal("native result retained proof/challenge aliases")}}
		})}
	})}
}

func TestProbeWireOwnerCompleteTypedFirstRefusalsAndEchoTargetSampleBoundary(t *testing.T){
	f:=newWireOwnerFixture(t,2);fields:=wireOwnerResultFields(f);fields.Point="agent-direct-egress";fields.Status="connected";fields.Code="tcp-connected"
	for _,mode:=range []string{"valid","family","services","descriptor","point"}{receipt:=probeClaimReceipt{typed:true,measurement:probe.MeasurementEgress,binding:f.binding};input:=fields;switch mode{case "family":receipt.typed=false;case "services":receipt.services=true;case "descriptor":receipt.measurement="invalid";case "point":input.Point="agent-local-direct-ingress"};before:=f.schedule.nowCalls;body,err:=typedProbeResult(receipt,input);if (err==nil)!=(mode=="valid")||f.schedule.nowCalls!=before{t.Fatal("v2 parent refusal/sample",mode,err)};if mode=="valid"{if body.ProbeVersion!=2||body.Descriptor!=(probetypes.Descriptor{Measurement:"tcp-connect-v1",TaskKind:"tcp-connect",Point:"agent-direct-egress",Capability:"probe.tcp-connect.v1"}){t.Fatal("v2 native descriptor",body)}}else if err!=probe.ErrDenied{t.Fatal("v2 parent original refusal",err)}}
	e:=newWireOwnerFixture(t,4);input,_:=wireOwnerEchoExecution(t,e,probeecho.MeasurementTCP)
	for _,mode:=range []string{"missing","binding","parse"}{value:=probeecho.CloneExecution(input);var candidate *probeecho.Execution=&value;wantNow:=0;switch mode{case "missing":candidate=nil;case "binding":value.Invocation.Binding.BindingFence++;case "parse":value.Context.ConfigDigest="sha256:"+strings.Repeat("0",64);wantNow=1};before:=e.schedule.nowCalls;if _,err:=e.runner.probeEchoTargetLocked(e.binding,probeecho.MeasurementTCP,nil,candidate);err!=probe.ErrDenied||e.schedule.nowCalls-before!=wantNow{t.Fatal("echo native JSON/parse sample boundary",mode,err,e.schedule.nowCalls-before)}}
	wireOwnerOrdered(t,wireOwnerCalls(t,"probe_echo_target.go","probeEchoTargetLocked"),"EncodeEchoContext","DecodeEchoContext","Now")
}

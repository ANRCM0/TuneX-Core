package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type identityChannelOwnerComplete struct { executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate]; request func(context.Context,*http.Client,string,string,string,[]byte,bool,uint64)([]byte,error); idle func(*http.Client) }
func (p identityChannelOwnerComplete) Request(ctx context.Context,client *http.Client,base,method,path string,body []byte,epoch bool,session uint64)([]byte,error){return p.request(ctx,client,base,method,path,body,epoch,session)}
func (p identityChannelOwnerComplete) CloseIdleConnections(client *http.Client){p.idle(client)}

func TestIdentityChannelOwnerCompleteRunnerRequestSingleProjectionAndErrorIdentity(t *testing.T){
	plain:=errors.New("original channel failure");pointer:=&executionchannel.HTTPError{Status:409,Code:"POINTER"}
	for _,failure:=range []error{nil,plain,executionchannel.HTTPError{Status:403,Code:"DENIED"},fmt.Errorf("outer wrapper: %w",executionchannel.HTTPError{Status:503,Code:"UNAVAILABLE"}),pointer}{
		ctx,cancel:=context.WithCancel(context.Background());defer cancel();client:=&http.Client{};raw:=[]byte{255,0,128,7};request:=[]byte{1,0,255};calls:=0
		runner:=&Runner{options:Options{URL:"https://control.invalid/base"},client:client};runner.hello.SessionEpoch=9007199254740991
		runner.providers.Channel=identityChannelOwnerComplete{request:func(gotContext context.Context,gotClient *http.Client,base,method,path string,body []byte,epoch bool,session uint64)([]byte,error){calls++;if gotContext!=ctx||gotClient!=client||base!=runner.options.URL||method!="DELETE"||path!="/agent/v3/snapshot?sinceGeneration=7"||&body[0]!=&request[0]||!epoch||session!=runner.hello.SessionEpoch{t.Fatal("Runner channel arguments changed")};return raw,failure}}
		got,err:=runner.request(ctx,"DELETE","/agent/v3/snapshot?sinceGeneration=7",request,true)
		var native executionchannel.HTTPError
		if errors.As(failure,&native){var projected httpError;if got!=nil||!errors.As(err,&projected)||projected.status!=native.Status||projected.code!=native.Code{t.Fatalf("native HTTP error projection: %x %v",got,err)}}else if err!=failure||!bytes.Equal(got,raw)||&got[0]!=&raw[0]{t.Fatalf("native raw/error identity: %x %v",got,err)}
		if calls!=1{t.Fatal("Runner added channel retry/projection")}
	}
	runner:=&Runner{}
	if reflect.TypeOf(runner.identityProvider())!=reflect.TypeOf(defaultProviders().Identity)||reflect.TypeOf(runner.channelProvider())!=reflect.TypeOf(defaultProviders().Channel){t.Fatal("retained default provider wrappers changed family")}
}

type identityRotationOwnerComplete struct {
	executionidentity.Provider[tls.Certificate,*x509.CertPool]
	runner *Runner
	trace *[]string
	identity executionidentity.MachineIdentity[tls.Certificate]
	failure error
	stage string
	configuredRoots *x509.CertPool
	guardSamples *int
}
func(p *identityRotationOwnerComplete)hit(stage string)error{*p.trace=append(*p.trace,stage);if p.stage==stage{return p.failure};return nil}
func(p *identityRotationOwnerComplete)Locations(certificate,key,ca string)executionidentity.Locations{if certificate!="configured.pem"||key!="configured.key"||ca!="configured-ca.pem"{panic("configured identity paths")};p.hit("locations");return executionidentity.Locations{Certificate:certificate,PrivateKey:key,CA:ca,MachineBundle:"bundle",MachineRequest:"pending"}}
func(p *identityRotationOwnerComplete)PrepareRotation(path,node string)(executionidentity.RotationRequest,error){if path!="pending"||node!="node"{panic("rotation pending path/node")};err:=p.hit("prepare");return executionidentity.RotationRequest{RequestID:"stable-request",CSR:"stable-csr",PrivateKey:"never-on-wire"},err}
func(p *identityRotationOwnerComplete)ValidateMachineRotation(locations executionidentity.Locations,node string,request executionidentity.RotationRequest,raw []byte)(executionidentity.CredentialBundle,error){if locations.CA!="configured-ca.pem"||node!="node"||request.PrivateKey!="never-on-wire"||string(raw)!="response with informational untrusted CA"{panic("machine native response validation arguments")};err:=p.hit("validate");return executionidentity.CredentialBundle{Certificate:"successor",PrivateKey:request.PrivateKey},err}
func(p *identityRotationOwnerComplete)SaveMachine(path string,value executionidentity.CredentialBundle)error{if path!="bundle"||value.Certificate!="successor"||value.PrivateKey!="never-on-wire"{panic("machine durable bundle")};return p.hit("save")}
func(p *identityRotationOwnerComplete)LoadMachine(locations executionidentity.Locations,node string,roots *x509.CertPool)(executionidentity.MachineIdentity[tls.Certificate],error){if locations.CA!="configured-ca.pem"||node!="node"||roots!=p.configuredRoots{panic("reload trust came from returned CA")};err:=p.hit("reload");return p.identity,err}
func(p *identityRotationOwnerComplete)Remove(path string,ignore bool)error{if path!="pending"||!ignore||*p.guardSamples!=1{panic("cleanup before successful Guard credential update")};return p.hit("remove")}

func TestIdentityChannelOwnerCompleteSaveReloadProbeInvalidationGuardIdleCleanup(t *testing.T){
	for _,stage:=range []string{"save","reload","guard","remove","success","same-fingerprint"}{t.Run(stage,func(t *testing.T){
		trace:=[]string{};now:=time.Date(2026,1,2,3,4,5,0,time.UTC);oldLeaf:=&x509.Certificate{SerialNumber:nil};nextLeaf:=&x509.Certificate{Raw:[]byte("next")};guardSamples:=0;failure:=errors.New("original rotation stage failure")
		runner:=&Runner{options:Options{NodeID:"node",Certificate:"configured.pem",PrivateKey:"configured.key",CA:"configured-ca.pem"},certificate:tls.Certificate{Leaf:oldLeaf},credentialFingerprint:[32]byte{1},credentialUntil:now.Add(time.Minute),roots:x509.NewCertPool(),client:&http.Client{}}
		provider:=&identityRotationOwnerComplete{runner:runner,trace:&trace,identity:executionidentity.MachineIdentity[tls.Certificate]{Certificate:tls.Certificate{Certificate:[][]byte{{9}},Leaf:nextLeaf},Until:now.Add(time.Hour),Fingerprint:[32]byte{2}},failure:failure,stage:stage,configuredRoots:runner.roots,guardSamples:&guardSamples}
		if stage=="same-fingerprint"{provider.identity.Fingerprint=runner.credentialFingerprint}
		session:=&registeredProbe{gate:&probe.Gate{},cancel:func(){if runner.probeRegistration!=nil||runner.certificate.Leaf!=oldLeaf{panic("Probe invalidation after credential publication")};trace=append(trace,"probe-cancel")}}
		runner.probeRegistration=session
		guard,err:=authorization.New(func()(authorization.Sample,error){if runner.guard!=nil{guardSamples++;trace=append(trace,"guard");if runner.certificate.Leaf!=nextLeaf||runner.credentialFingerprint!=provider.identity.Fingerprint||runner.credentialUntil!=provider.identity.Until{panic("Guard update before machine publication")};if stage!="same-fingerprint"&&runner.probeRegistration!=nil{panic("Guard update before Probe invalidation")};if stage=="guard"{return authorization.Sample{},failure}};return authorization.Sample{Wall:now,Uptime:time.Hour},nil},time.Second,300*time.Second,runner.credentialUntil);if err!=nil{t.Fatal(err)};runner.guard=guard
		runner.providers.Identity=provider
		runner.providers.Channel=identityChannelOwnerComplete{request:func(_ context.Context,_ *http.Client,_,method,path string,raw []byte,epoch bool,_ uint64)([]byte,error){trace=append(trace,"request");if method!="POST"||path!="/agent/v3/credentials/rotate"||!epoch||string(raw)!=`{"csr":"stable-csr","requestId":"stable-request"}`{t.Fatal("rotation request native bytes")};return []byte("response with informational untrusted CA"),nil},idle:func(client *http.Client){if client!=runner.client||guardSamples!=1||runner.probeRegistration!=nil{panic("idle close before Guard/Probe effects")};trace=append(trace,"idle")}}
		err=runner.rotate(context.Background())
		if stage=="success"||stage=="same-fingerprint"{if err!=nil{t.Fatal(err)}}else if stage=="guard"{if err==nil{t.Fatal("Guard failure accepted")}}else if err!=failure{t.Fatalf("original fallible stage identity: %v",err)}
		want:=[]string{"locations","prepare","request","validate","save"}
		if stage!="save"{want=append(want,"locations","reload")}
		if stage!="save"&&stage!="reload"{if stage!="same-fingerprint"{want=append(want,"probe-cancel")};want=append(want,"guard");if stage!="guard"{if stage!="same-fingerprint"{want=append(want,"idle")};want=append(want,"remove")}}
		if !reflect.DeepEqual(trace,want){t.Fatalf("full machine lifecycle order: %v want%v",trace,want)}
		published:=stage!="save"&&stage!="reload"
		if (runner.certificate.Leaf==nextLeaf)!=published||guardSamples!=map[bool]int{false:0,true:1}[published]{t.Fatal("machine projection or Guard update count")}
		if stage=="same-fingerprint" {if runner.probeRegistration!=session{t.Fatal("unchanged fingerprint invalidated Probe")}}else if published&&runner.probeRegistration!=nil{t.Fatal("new machine fingerprint kept old Probe")}
	})}
}

type identityChannelBackoffComplete struct{runtimeplatform.Scheduler;now time.Time;delays []time.Duration;cancel context.CancelFunc}
func(s *identityChannelBackoffComplete)Now()time.Time{return s.now}
func(s *identityChannelBackoffComplete)After(delay time.Duration)<-chan time.Time{s.delays=append(s.delays,delay);tick:=make(chan time.Time,1);if len(s.delays)==7{s.cancel()}else{tick<-s.now};return tick}

func TestIdentityChannelOwnerCompleteHelloBackoffCapAndOriginalFatalRefusal(t *testing.T){
	for _,mode:=range []string{"backoff","unauthorized","forbidden","superseded","integrity"}{t.Run(mode,func(t *testing.T){
		ctx,cancel:=context.WithCancel(context.Background());defer cancel();schedule:=&identityChannelBackoffComplete{now:time.Unix(2000000000,0),cancel:cancel};calls,idle:=0,0;var first []byte
		failure:=error(errors.New("original temporary hello error"));switch mode{case "unauthorized":failure=executionchannel.HTTPError{Status:401,Code:"DENIED"};case "forbidden":failure=executionchannel.HTTPError{Status:403,Code:"DENIED"};case "superseded":failure=executionchannel.HTTPError{Status:409,Code:"SESSION_SUPERSEDED"};case "integrity":failure=executionchannel.HTTPError{Status:500,Code:"INTEGRITY_FAILURE"}}
		runner:=&Runner{options:Options{NodeID:"node",BootID:"boot"},effects:Effects{Schedule:schedule}}
		runner.providers.Channel=identityChannelOwnerComplete{request:func(_ context.Context,_ *http.Client,_,method,path string,body []byte,epoch bool,_ uint64)([]byte,error){calls++;if method!="POST"||path!="/agent/v3/hello"||epoch{t.Fatal("hello retry changed native request")};if first==nil{first=append([]byte(nil),body...)}else if !bytes.Equal(first,body){t.Fatal("hello retry reencoded/changed request body")};return nil,failure},idle:func(*http.Client){idle++}}
		err:=runner.Run(ctx)
		if mode=="backoff"{if !errors.Is(err,context.Canceled)||calls!=7||!reflect.DeepEqual(schedule.delays,[]time.Duration{time.Second,2*time.Second,4*time.Second,8*time.Second,16*time.Second,30*time.Second,30*time.Second}){t.Fatalf("original capped hello retry: calls%d delays%v %v",calls,schedule.delays,err)}}else{var problem httpError;var native executionchannel.HTTPError;errors.As(failure,&native);if !errors.As(err,&problem)||problem.status!=native.Status||problem.code!=native.Code||calls!=1||len(schedule.delays)!=0{t.Fatalf("fatal hello refusal retried: %v calls%d delays%v",err,calls,schedule.delays)}}
		if idle!=1{t.Fatal("hello failure did not close idle exactly once")}
	})}
}

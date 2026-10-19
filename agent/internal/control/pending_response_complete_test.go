package control

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/state"
)

// The port wrapper records original Control call order and injects one port
// failure. All successful encoding, pending files, certificate validation,
// atomic saves and protected MACs still execute their original native owners.
type pendingResponseIdentity struct {
	agentidentity.Native
	trace *timeOwnerTrace
	failStage string
	failure error
	loadOverride bool
	loadMissing bool
	loadFailure error
	requests []executionidentity.RotationRequest
}
func(p *pendingResponseIdentity)hit(stage string)error{p.trace.add(stage);if stage==p.failStage{return p.failure};return nil}
func(p *pendingResponseIdentity)Locations(certificate,key,ca string)executionidentity.Locations{p.trace.add("locations");return p.Native.Locations(certificate,key,ca)}
func(p *pendingResponseIdentity)PrepareRotation(path,node string)(executionidentity.RotationRequest,error){if err:=p.hit("prepare");err!=nil{return executionidentity.RotationRequest{},err};value,err:=p.Native.PrepareRotation(path,node);p.requests=append(p.requests,value);return value,err}
func(p *pendingResponseIdentity)ValidateMachineRotation(locations executionidentity.Locations,node string,request executionidentity.RotationRequest,raw []byte)(executionidentity.CredentialBundle,error){if err:=p.hit("validate-machine");err!=nil{return executionidentity.CredentialBundle{},err};return p.Native.ValidateMachineRotation(locations,node,request,raw)}
func(p *pendingResponseIdentity)SaveMachine(path string,bundle executionidentity.CredentialBundle)error{if err:=p.hit("save-machine");err!=nil{return err};return p.Native.SaveMachine(path,bundle)}
func(p *pendingResponseIdentity)LoadMachine(locations executionidentity.Locations,node string,roots *x509.CertPool)(executionidentity.MachineIdentity[tls.Certificate],error){if err:=p.hit("reload-machine");err!=nil{return executionidentity.MachineIdentity[tls.Certificate]{},err};return p.Native.LoadMachine(locations,node,roots)}
func(p *pendingResponseIdentity)ReadPending(path string)([]byte,error){if err:=p.hit("read-pending");err!=nil{return nil,err};return p.Native.ReadPending(path)}
func(p *pendingResponseIdentity)Remove(path string,ignore bool)error{if err:=p.hit(fmt.Sprint("remove:",ignore));err!=nil{return err};return p.Native.Remove(path,ignore)}
func(p *pendingResponseIdentity)DecodeProtected(raw []byte,destination any)error{if err:=p.hit("decode");err!=nil{return err};return p.Native.DecodeProtected(raw,destination)}
func(p *pendingResponseIdentity)LoadRelay(path string,key []byte)(executionidentity.RelayBundle,bool,error){p.trace.add("load-relay");if p.loadOverride{return executionidentity.RelayBundle{},p.loadMissing,p.loadFailure};return p.Native.LoadRelay(path,key)}
func(p *pendingResponseIdentity)ValidateRelay(bundle executionidentity.RelayBundle,node string,roots *x509.CertPool)(tls.Certificate,time.Time,error){if err:=p.hit("validate-relay");err!=nil{return tls.Certificate{},time.Time{},err};return p.Native.ValidateRelay(bundle,node,roots)}
func(p *pendingResponseIdentity)SaveRelay(path string,key []byte,bundle executionidentity.RelayBundle)error{if err:=p.hit("save-relay");err!=nil{return err};return p.Native.SaveRelay(path,key,bundle)}

type pendingResponseFixture struct{runner *Runner;provider *pendingResponseIdentity;locations executionidentity.Locations;request executionidentity.RotationRequest;response []byte;trace *timeOwnerTrace;clock *timeOwnerSchedule;wire [][]byte}
func newPendingResponseFixture(t *testing.T,relayCredential bool)*pendingResponseFixture{
	t.Helper();ca,key,roots:=relayTestCA(t);directory:=t.TempDir();trace:=&timeOwnerTrace{};provider:=&pendingResponseIdentity{trace:trace};locations:=provider.Native.Locations(filepath.Join(directory,"node.pem"),filepath.Join(directory,"private.pem"),filepath.Join(directory,"ca.pem"));if err:=os.WriteFile(locations.CA,pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:ca.Raw}),0600);err!=nil{t.Fatal(err)}
	pending:=locations.MachineRequest;if relayCredential{pending=locations.RelayRequest};request,err:=provider.Native.PrepareRotation(pending,"node-a");if err!=nil{t.Fatal(err)};signed:=signRelayTest(t,ca,key,agentidentity.RotationRequestFromFacts(request),"node-a",[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth});now:=time.Now().UTC().Truncate(time.Millisecond);clock:=&timeOwnerSchedule{trace:trace,now:now}
	var response []byte;if relayCredential{response,err=json.Marshal(agentidentity.RelayResponse{NodeID:signed.NodeID,Certificate:signed.Certificate,Fingerprint:strings.TrimPrefix(signed.Fingerprint,"sha256:"),ValidUntil:signed.ValidUntil,CertificateNotAfter:signed.CertificateNotAfter})}else{response,err=json.Marshal(map[string]string{"certificate":signed.Certificate,"ca":"response CA stays informational","fingerprint":strings.TrimPrefix(signed.Fingerprint,"sha256:"),"validUntil":signed.CertificateNotAfter,"oldCredentialUntil":now.Add(30*time.Second).Format(time.RFC3339Nano)})};if err!=nil{t.Fatal(err)}
	runner:=&Runner{options:Options{NodeID:"node-a",BootID:"boot-a",Relay:relayCredential,Certificate:locations.Certificate,PrivateKey:locations.PrivateKey,CA:locations.CA},hello:adp3.HelloResponse{SessionEpoch:2,Policy:timeOwnerPolicy()},roots:roots,key:bytes.Repeat([]byte{17},32),providers:Providers{Identity:provider},effects:Effects{Schedule:clock},journal:state.Journal{Generation:99,Digest:"protected-history",Fences:map[string]uint64{"forward":7},Retired:map[string]uint64{"assignment":9}}}
	fixture:=&pendingResponseFixture{runner:runner,provider:provider,locations:locations,request:request,response:response,trace:trace,clock:clock};runner.providers.Channel=&timeOwnerChannel{trace:trace,request:func(method,path string,body []byte,epoch bool,session uint64)([]byte,error){wantPath:="/agent/v3/credentials/rotate";if relayCredential{wantPath="/agent/v3/relay-credential"};if method!="POST"||path!=wantPath||!epoch||session!=2{t.Fatal("credential native channel arguments",method,path,epoch,session)};fixture.wire=append(fixture.wire,append([]byte(nil),body...));if provider.failStage=="io"{return nil,provider.failure};return append([]byte(nil),fixture.response...),nil}}
	return fixture
}

func TestPendingResponseCompleteMachineDurableRetryAndPublication(t *testing.T){
	for _,stage:=range []string{"prepare","io","validate-machine","save-machine","reload-machine","remove:true"}{t.Run(stage,func(t *testing.T){
		f:=newPendingResponseFixture(t,false);failure:=errors.New("original machine port failure");f.provider.failStage=stage;f.provider.failure=failure;oldLeaf:=&x509.Certificate{Raw:[]byte("old-machine")};f.runner.certificate=tls.Certificate{Leaf:oldLeaf};f.runner.credentialFingerprint=[32]byte{7};f.runner.credentialUntil=f.clock.now.Add(time.Minute);journal:=f.runner.journal
		if err:=f.runner.rotate(context.Background());err!=failure{t.Fatal("machine original failure",stage,err,f.trace.values())};published:=stage=="remove:true";if (f.runner.certificate.Leaf!=oldLeaf)!=published||!reflect.DeepEqual(f.runner.journal,journal){t.Fatal("machine publication or protected history stage",stage)}
		pendingBefore,err:=os.ReadFile(f.locations.MachineRequest);if err!=nil{t.Fatal("failed rotation removed original replay request",err)};durableBefore,readErr:=os.ReadFile(f.locations.MachineBundle);saved:=stage=="reload-machine"||stage=="remove:true";if (readErr==nil)!=saved{t.Fatal("machine durable stage",stage,readErr)}
		f.provider.failStage="";if err:=f.runner.rotate(context.Background());err!=nil{t.Fatal("machine replay recovery",stage,err,f.trace.values())};if _,err:=os.Stat(f.locations.MachineRequest);!os.IsNotExist(err){t.Fatal("successful reload did not clean pending",err)};if !reflect.DeepEqual(f.runner.journal,journal)||f.runner.certificate.Leaf==oldLeaf{t.Fatal("machine recovery changed history or failed publication")}
		for _,request:=range f.provider.requests{if request!=f.request{t.Fatal("failure changed original CSR/key/request",stage)}};if len(f.wire)==2&&!bytes.Equal(f.wire[0],f.wire[1]){t.Fatal("machine replay changed online bytes")};if strings.Contains(string(f.wire[len(f.wire)-1]),"privateKey"){t.Fatal("machine key escaped native request")};var retained agentidentity.RotationRequest;if err:=json.Unmarshal(pendingBefore,&retained);err!=nil||agentidentity.RotationRequestFacts(retained)!=f.request{t.Fatal("pending native record changed",err)};after,err:=os.ReadFile(f.locations.MachineBundle);if err!=nil||saved&&!bytes.Equal(after,durableBefore){t.Fatal("idempotent machine replay changed durable bundle",err)}
	})}
}

func TestPendingResponseCompleteRelaySaveRemoveAndCrashRecovery(t *testing.T){
	for _,stage:=range []string{"save-relay","remove:true"}{t.Run(stage,func(t *testing.T){
		f:=newPendingResponseFixture(t,true);failure:=errors.New("original relay durability failure");f.provider.failStage=stage;f.provider.failure=failure;oldLeaf:=&x509.Certificate{Raw:[]byte("old-relay")};oldUntil:=f.clock.now.Add(time.Minute);f.runner.relayCertificate=tls.Certificate{Leaf:oldLeaf};f.runner.relayUntil=oldUntil;f.runner.relayRenewAfter=f.clock.now;journal:=f.runner.journal
		if err:=f.runner.renewRelayCredential(context.Background());err!=failure||f.runner.relayCertificate.Leaf!=oldLeaf||!f.runner.relayUntil.Equal(oldUntil)||!reflect.DeepEqual(f.runner.journal,journal){t.Fatal("renewal published before save/remove",stage,err,f.trace.values())};if _,err:=os.Stat(f.locations.RelayRequest);err!=nil{t.Fatal("failed renewal lost replay request",err)};_,missing,loadErr:=f.provider.Native.LoadRelay(f.locations.RelayBundle,f.runner.key);if stage=="save-relay"{if !missing||loadErr==nil{t.Fatal("failed save invented durable credential")}}else if missing||loadErr!=nil{t.Fatal("successful save lost protected bundle",loadErr)}
		f.provider.failStage="";if stage=="remove:true"{before:=len(f.wire);if err:=f.runner.ensureRelayCredential(context.Background());err!=nil||len(f.wire)!=before{t.Fatal("durable crash cleanup issued predecessor/new request",err,f.trace.values())}}else if err:=f.runner.renewRelayCredential(context.Background());err!=nil{t.Fatal("relay replay retry",err)}
		if f.runner.relayCertificate.Leaf==oldLeaf||!reflect.DeepEqual(f.runner.journal,journal){t.Fatal("relay recovery failed publication or changed protected history")};if _,err:=os.Stat(f.locations.RelayRequest);!os.IsNotExist(err){t.Fatal("relay success kept matching replay request",err)};for _,request:=range f.provider.requests{if request!=f.request{t.Fatal("relay retry replaced key/CSR/id")}};if len(f.wire)==2&&!bytes.Equal(f.wire[0],f.wire[1]){t.Fatal("relay retry online bytes changed")}
	})}
}

func TestPendingResponseCompleteInitialMissingAndLaterStoreError(t *testing.T){
	for _,initial:=range []bool{false,true}{t.Run(fmt.Sprint(initial),func(t *testing.T){f:=newPendingResponseFixture(t,true);later:=fmt.Errorf("protected second read: %w",os.ErrNotExist);failure:=errors.New("online prepare stop");f.provider.loadOverride=true;f.provider.loadMissing=initial;f.provider.loadFailure=later;f.provider.failStage="prepare";f.provider.failure=failure;err:=f.runner.ensureRelayCredential(context.Background());if initial{if err!=failure||!reflect.DeepEqual(f.trace.values(),[]string{"locations","load-relay","locations","prepare"}){t.Fatal("initial missing did not select online renewal",err,f.trace.values())}}else if err!=later||!reflect.DeepEqual(f.trace.values(),[]string{"locations","load-relay"}){t.Fatal("later missing-shaped store failure retried online",err,f.trace.values())};if len(f.wire)!=0{t.Fatal("store failure unexpectedly issued credential")}})}
}

func pendingResponseEnvelope(t *testing.T,key []byte,value state.Journal)[]byte{t.Helper();payload,err:=json.Marshal(value);if err!=nil{t.Fatal(err)};mac:=hmac.New(sha256.New,key);mac.Write(payload);raw,err:=json.Marshal(map[string]any{"payload":json.RawMessage(payload),"mac":hex.EncodeToString(mac.Sum(nil))});if err!=nil{t.Fatal(err)};return raw}

func TestPendingResponseCompleteProtectedOuterInnerAndMACErrors(t *testing.T){
	native:=agentidentity.Native{};key:=bytes.Repeat([]byte{23},32);path:=filepath.Join(t.TempDir(),"relay.json");bundle:=agentidentity.RelayBundle{NodeID:"node",Certificate:"certificate",PrivateKey:"private",Fingerprint:"fingerprint",ValidUntil:"until",CertificateNotAfter:"notAfter"};snapshot,_:=json.Marshal(bundle);journal:=state.Journal{Snapshot:snapshot,Fences:map[string]uint64{},Retired:map[string]uint64{}}
	for _,mode:=range []string{"valid","unknown-outer","duplicate-outer","bad-json","wrong-key-length","mac","unknown-inner","duplicate-inner","generation","digest","fences","retired"}{t.Run(mode,func(t *testing.T){
		value:=journal;inputKey:=key;switch mode{case "unknown-inner":value.Snapshot=append(append([]byte(nil),snapshot[:len(snapshot)-1]...),[]byte(`,"future":true}`)...);case "duplicate-inner":value.Snapshot=append(append([]byte(nil),snapshot[:len(snapshot)-1]...),[]byte(`,"nodeId":"other"}`)...);case "generation":value.Generation=1;case "digest":value.Digest="unexpected";case "fences":value.Fences=map[string]uint64{"other":1};case "retired":value.Retired=map[string]uint64{"other":1}}
		raw:=pendingResponseEnvelope(t,key,value);switch mode{case "unknown-outer":raw=append(append([]byte(nil),raw[:len(raw)-1]...),[]byte(`,"future":true}`)...);case "duplicate-outer":raw=append(append([]byte(nil),raw[:len(raw)-1]...),[]byte(`,"mac":"duplicate"}`)...);case "bad-json":raw=[]byte("{");case "wrong-key-length":inputKey=key[:31];case "mac":inputKey=bytes.Repeat([]byte{24},32)};if err:=os.WriteFile(path,raw,0600);err!=nil{t.Fatal(err)};got,missing,err:=native.LoadRelay(path,inputKey);wantOK:=mode=="valid"||mode=="unknown-outer";if missing||(err==nil)!=wantOK{t.Fatal("protected envelope/inner/MAC not missing",mode,missing,err)};if wantOK&&agentidentity.RelayBundleFromFacts(got)!=bundle{t.Fatal("native protected fields changed")};after,readErr:=os.ReadFile(path);if readErr!=nil||!bytes.Equal(after,raw){t.Fatal("failed protected read repaired or cleared history",readErr)}
	})}
	if err:=os.Remove(path);err!=nil{t.Fatal(err)};if _,missing,err:=native.LoadRelay(path,key[:1]);!missing||!errors.Is(err,os.ErrNotExist){t.Fatal("initial absence lost precedence over key validation",missing,err)}
}

func TestPendingResponseCompletePermissiveMachineVersusStrictNativeRecords(t *testing.T){
	f:=newPendingResponseFixture(t,false);native:=agentidentity.Native{};unknown:=append(append([]byte(nil),f.response[:len(f.response)-1]...),[]byte(`,"future":{"retained":true}}`)...);bundle,err:=native.ValidateMachineRotation(f.locations,"node-a",f.request,unknown);if err!=nil||bundle.PrivateKey!=f.request.PrivateKey{t.Fatal("machine response lost permissive unknown fields",err)};var strict map[string]any;if err:=decodeProtectedJSON(unknown,&strict);err!=nil{t.Fatal("map destinations retain native arbitrary keys",err)}
	pendingRaw:=[]byte(`{"requestId":"stable","csr":"csr","privateKey":"private","future":true}`);if err:=os.WriteFile(f.locations.MachineRequest,pendingRaw,0600);err!=nil{t.Fatal(err)};request,err:=native.PrepareRotation(f.locations.MachineRequest,"node-a");if err!=nil||request!=(executionidentity.RotationRequest{RequestID:"stable",CSR:"csr",PrivateKey:"private"}){t.Fatal("machine pending permissive decoding",request,err)};var protected rotationRequest;if err:=native.DecodeProtected(pendingRaw,&protected);err==nil{t.Fatal("protected typed pending accepted unknown field")};after,err:=native.ReadPending(f.locations.MachineRequest);if err!=nil||!bytes.Equal(after,pendingRaw){t.Fatal("read/prepare rewrote unknown pending",err)}
	for _,raw:=range [][]byte{[]byte(`{"requestId":"one","requestId":"two","csr":"csr","privateKey":"key"}`),[]byte(`{"requestId":1,"csr":"csr","privateKey":"key"}`),[]byte(`{"requestId":"id","csr":"","privateKey":"key"}`)}{if err:=os.WriteFile(f.locations.MachineRequest,raw,0600);err!=nil{t.Fatal(err)};if _,err:=native.PrepareRotation(f.locations.MachineRequest,"node-a");err==nil{t.Fatal("malformed/incomplete persisted pending regenerated instead of refusing")};after,_:=os.ReadFile(f.locations.MachineRequest);if !bytes.Equal(after,raw){t.Fatal("invalid replay request cleared")}}
	machineRaw,_:=json.Marshal(agentidentity.CredentialBundleFromFacts(bundle));machineRaw=append(append([]byte(nil),machineRaw[:len(machineRaw)-1]...),[]byte(`,"future":true}`)...);if err:=os.WriteFile(f.locations.MachineBundle,machineRaw,0600);err!=nil{t.Fatal(err)};identity,err:=native.LoadMachine(f.locations,"node-a",f.runner.roots);if err!=nil||len(identity.Certificate.Certificate)==0{t.Fatal("machine bundle no longer permits unknown fields",err)};var typed agentidentity.CredentialBundle;if err:=native.DecodeProtected(machineRaw,&typed);err==nil{t.Fatal("protected typed machine record accepted unknown")}
	duplicate:=append(append([]byte(nil),f.response[:len(f.response)-1]...),[]byte(`,"fingerprint":"duplicate"}`)...);if _,err:=native.ValidateMachineRotation(f.locations,"node-a",f.request,duplicate);err==nil{t.Fatal("machine permissiveness accepted duplicate response")};if _,err:=contracts.ParseJSON(duplicate,32768);err==nil{t.Fatal("duplicate response fixture no longer strict")}
}

func TestPendingResponseCompleteRetainedPendingCleanupAndPublicationFailures(t *testing.T){
	for _,mode:=range []string{"matching","different-request","no-request-id","unknown-pending","duplicate-pending","missing-pending","read-error","remove-error"}{t.Run(mode,func(t *testing.T){
		f:=newPendingResponseFixture(t,true);var response agentidentity.RelayResponse;if err:=json.Unmarshal(f.response,&response);err!=nil{t.Fatal(err)};bundle:=executionidentity.RelayBundle{NodeID:response.NodeID,Certificate:response.Certificate,PrivateKey:f.request.PrivateKey,Fingerprint:"sha256:"+response.Fingerprint,ValidUntil:response.ValidUntil,CertificateNotAfter:response.CertificateNotAfter,RequestID:f.request.RequestID};if mode=="different-request"{bundle.RequestID="other"};if mode=="no-request-id"{bundle.RequestID=""};if err:=f.provider.Native.SaveRelay(f.locations.RelayBundle,f.runner.key,bundle);err!=nil{t.Fatal(err)}
		pending,err:=os.ReadFile(f.locations.RelayRequest);if err!=nil{t.Fatal(err)};if mode=="unknown-pending"{pending=append(append([]byte(nil),pending[:len(pending)-1]...),[]byte(`,"future":true}`)...)};if mode=="duplicate-pending"{pending=append(append([]byte(nil),pending[:len(pending)-1]...),[]byte(`,"requestId":"duplicate"}`)...)};if err:=os.WriteFile(f.locations.RelayRequest,pending,0600);err!=nil{t.Fatal(err)};failure:=errors.New("original retained pending failure");if mode=="read-error"{f.provider.failStage="read-pending";f.provider.failure=failure};if mode=="remove-error"{f.provider.failStage="remove:false";f.provider.failure=failure};if mode=="missing-pending"{if err:=os.Remove(f.locations.RelayRequest);err!=nil{t.Fatal(err)}}
		journal:=f.runner.journal;err=f.runner.ensureRelayCredential(context.Background());wantError:=mode=="unknown-pending"||mode=="duplicate-pending"||mode=="read-error"||mode=="remove-error";if (err!=nil)!=wantError||len(f.wire)!=0||len(f.provider.requests)!=0||f.runner.relayCertificate.Leaf==nil||!reflect.DeepEqual(f.runner.journal,journal){t.Fatal("retained publication/read cleanup/online isolation",mode,err,f.trace.values())};if (mode=="read-error"||mode=="remove-error")&&err!=failure{t.Fatal("retained port error identity",err)}
		after,readErr:=os.ReadFile(f.locations.RelayRequest);removed:=mode=="matching"||mode=="missing-pending";if removed{if !os.IsNotExist(readErr){t.Fatal("committed matching pending was not removed",readErr)}}else if readErr!=nil||!bytes.Equal(after,pending){t.Fatal("failed/nonmatching cleanup changed replay request",mode,readErr)}
		events:=strings.Join(f.trace.values(),",");if strings.Contains(events,"decode")!=(mode!="no-request-id"&&mode!="missing-pending"&&mode!="read-error"){t.Fatal("pending decode condition changed",mode,events)};if strings.Contains(events,"remove:false")!=(mode=="matching"||mode=="remove-error"){t.Fatal("nonmatching/corrupt pending was removed",mode,events)}
	})}
}

func TestPendingResponseCompleteProtectedDecoderErrorMutationAndNativeMissingClassification(t *testing.T){
	native:=agentidentity.Native{};initial:=rotationRequest{RequestID:"old",CSR:"old-csr",PrivateKey:"old-key"}
	for _,tc:=range []struct{name,raw string;want rotationRequest}{
		{"unknown",`{"requestId":"new","csr":"new-csr","privateKey":"new-key","future":true}`,rotationRequest{RequestID:"new",CSR:"new-csr",PrivateKey:"new-key"}},
		{"duplicate",`{"requestId":"new","requestId":"other","csr":"new-csr","privateKey":"new-key"}`,initial},
		{"syntax",`{"requestId":"new"`,initial},
		{"typed",`{"requestId":17,"csr":"new-csr","privateKey":"new-key"}`,rotationRequest{RequestID:"old",CSR:"new-csr",PrivateKey:"new-key"}},
	}{t.Run(tc.name,func(t *testing.T){value:=initial;raw:=[]byte(tc.raw);copyRaw:=append([]byte(nil),raw...);if err:=native.DecodeProtected(raw,&value);err==nil||value!=tc.want||!bytes.Equal(raw,copyRaw){t.Fatal("original Parse-before-decoder/error partial mutation",tc.name,value,tc.want,err)}})}
	path:=filepath.Join(t.TempDir(),"pending.json");if _,err:=native.ReadPending(path);!native.Missing(err){t.Fatal("native initial pending read is not classified missing",err)};if err:=native.Remove(path,true);err!=nil{t.Fatal("ignore-missing remove",err)};if err:=native.Remove(path,false);!errors.Is(err,os.ErrNotExist){t.Fatal("strict missing remove changed",err)};if err:=os.Mkdir(path,0700);err!=nil{t.Fatal(err)};if _,err:=native.ReadPending(path);err==nil||native.Missing(err){t.Fatal("nonmissing pending store error classified missing",err)}
	// LoadRelay's public bool reports only the first read. Assert the actual
	// second protected-store error branch, without introducing a production
	// read hook or a nondeterministic filesystem race into acceptance.
	source,err:=parser.ParseFile(token.NewFileSet(),"../agentidentity/native.go",nil,0);if err!=nil{t.Fatal(err)};found:=false
	for _,declaration:=range source.Decls{fn,ok:=declaration.(*ast.FuncDecl);if !ok||fn.Name.Name!="loadRelay"{continue};for index,statement:=range fn.Body.List{assign,ok:=statement.(*ast.AssignStmt);if !ok||len(assign.Rhs)!=1{continue};call,ok:=assign.Rhs[0].(*ast.CallExpr);if !ok{continue};selector,ok:=call.Fun.(*ast.SelectorExpr);if !ok||selector.Sel.Name!="Load"{continue};owner,ok:=selector.X.(*ast.Ident);if !ok||owner.Name!="state"{continue};if index+1>=len(fn.Body.List){t.Fatal("protected second read error handling removed")};branch,ok:=fn.Body.List[index+1].(*ast.IfStmt);if !ok||len(branch.Body.List)!=1{t.Fatal("protected second read error branch changed")};returned,ok:=branch.Body.List[0].(*ast.ReturnStmt);if !ok||len(returned.Results)!=3{t.Fatal("protected second read public result changed")};missing,ok:=returned.Results[1].(*ast.Ident);if !ok||missing.Name!="false"{t.Fatal("later store failure claims initial absence")};original,ok:=returned.Results[2].(*ast.Ident);if !ok||original.Name!="err"{t.Fatal("later native store error identity replaced")};found=true}}
	if !found{t.Fatal("native second protected read/classification owner missing")}
}

package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

type bootstrapOwnerComplete struct {
	trace []string
	fail string
	failure error
	options Options
	roots *x509.CertPool
	key []byte
	loaded, enabled executionstate.RuntimeJournal
	identity executionidentity.MachineIdentity[tls.Certificate]
	client *http.Client
	certificate func() tls.Certificate
}
func (b *bootstrapOwnerComplete) hit(stage string) error { b.trace = append(b.trace, stage); if b.fail == stage { return b.failure }; return nil }
func (b *bootstrapOwnerComplete) ValidateProofBoundary(proof, key, journal string) error { if proof != b.options.TimeProof || key != b.options.TimeProofKey || journal != b.options.Journal { panic("bootstrap proof paths changed") }; return b.hit("proof") }
func (b *bootstrapOwnerComplete) LoadRoots(path string) (*x509.CertPool, error) { if path != b.options.CA { panic("bootstrap CA path changed") }; err := b.hit("roots"); return b.roots, err }
func (b *bootstrapOwnerComplete) LoadProtectionKey(path string) ([]byte, error) { if path != b.options.JournalKey { panic("bootstrap key path changed") }; err := b.hit("key"); return b.key, err }
func (b *bootstrapOwnerComplete) checkRuntime(path string, key []byte, node string) { if path != b.options.Journal || node != b.options.NodeID || len(key) == 0 || &key[0] != &b.key[0] { panic("bootstrap runtime identity/key projection changed") } }
func (b *bootstrapOwnerComplete) LoadRuntime(path string, key []byte, node string) (executionstate.RuntimeJournal, error) { b.checkRuntime(path,key,node); err := b.hit("load"); return b.loaded,err }
func (b *bootstrapOwnerComplete) EnableRuntime(path string, key []byte, node, transit string) (executionstate.RuntimeJournal, error) { b.checkRuntime(path,key,node); if transit != b.options.ImportTransitJournal { panic("bootstrap import path changed") }; err := b.hit("enable"); return b.enabled,err }
type bootstrapOwnerCompleteIdentity struct { executionidentity.Provider[tls.Certificate,*x509.CertPool]; owner *bootstrapOwnerComplete }
func (p bootstrapOwnerCompleteIdentity) Locations(certificate, privateKey, ca string) executionidentity.Locations { b:=p.owner; if certificate!=b.options.Certificate || privateKey!=b.options.PrivateKey || ca!=b.options.CA { panic("configured identity paths changed") }; b.hit("locations"); return executionidentity.Locations{Certificate:certificate,PrivateKey:privateKey,CA:ca,MachineBundle:"bundle",MachineRequest:"request"} }
func (p bootstrapOwnerCompleteIdentity) LoadMachine(locations executionidentity.Locations,node string,roots *x509.CertPool) (executionidentity.MachineIdentity[tls.Certificate],error) { b:=p.owner; if locations.Certificate!=b.options.Certificate || locations.CA!=b.options.CA || node!=b.options.NodeID || roots!=b.roots { panic("credential provider lost configured trust") }; err:=b.hit("credential"); return b.identity,err }
type bootstrapOwnerCompleteChannel struct { executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate]; owner *bootstrapOwnerComplete }
func (p bootstrapOwnerCompleteChannel) NewClient(roots *x509.CertPool,certificate func()tls.Certificate)*http.Client { b:=p.owner; if roots!=b.roots { panic("channel trust changed") }; b.hit("client"); b.certificate=certificate; return b.client }

func bootstrapOwnerCompleteFixture()(*bootstrapOwnerComplete,Providers,Effects,LocalServices) {
	extension:=uint64(1)
	loaded:=executionstate.RuntimeJournal{FormatVersion:3,NodeID:"node",Journal:executionstate.Journal{Snapshot:[]byte("original protected opaque bytes"),Generation:17,Digest:"digest17",Fences:map[string]uint64{"tcp/80":9},Retired:map[string]uint64{"tcp/80":7}},ImportedHistoryDigest:"original-import"}
	enabled:=loaded;enabled.ExecutionExtension=&extension;enabled.ImportedHistoryDigest="retained-import";enabled.Journal=executionstate.Journal{Snapshot:[]byte("enabled protected opaque bytes"),Generation:18,Digest:"digest18",Fences:map[string]uint64{"tcp/80":10},Retired:map[string]uint64{"tcp/80":8}}
	b:=&bootstrapOwnerComplete{failure:errors.New("original bootstrap failure"),options:Options{URL:"https://control.invalid/base/",NodeID:"node",BootID:"boot",Certificate:"node.pem",PrivateKey:"node.key",CA:"trusted-ca.pem",Journal:"protected/runtime.json",JournalKey:"outside/runtime.key",TimeProof:"outside/time.proof",TimeProofKey:"outside/time.key",Relay:true,Multihop:true,ImportTransitJournal:"legacy/transit.json"},roots:x509.NewCertPool(),key:bytes.Repeat([]byte{41},32),loaded:loaded,enabled:enabled,identity:executionidentity.MachineIdentity[tls.Certificate]{Certificate:tls.Certificate{Certificate:[][]byte{{1,2,3}},Leaf:&x509.Certificate{}},Until:time.Unix(2000000000,123),Fingerprint:[32]byte{3,5,7}},client:&http.Client{}}
	providers:=Providers{Identity:bootstrapOwnerCompleteIdentity{owner:b},Channel:bootstrapOwnerCompleteChannel{owner:b}}
	effects:=defaultEffects();effects.Bootstrap=b;effects.Schedule=struct{runtimeplatform.Scheduler}{}
	return b,providers,effects,defaultLocalServices()
}

func TestBootstrapOwnerCompleteOrderedSuccessAndEveryFailure(t *testing.T) {
	for _,stage:=range []string{"proof","roots","key","load","extension","credential","enable","success","plain-success"} { t.Run(stage,func(t *testing.T){
		b,providers,effects,local:=bootstrapOwnerCompleteFixture();b.fail=stage
		if stage=="extension" { version:=uint64(1);b.loaded.ExecutionExtension=&version;b.options.Multihop=false;b.options.ImportTransitJournal="" }
		if stage=="plain-success" { b.options.Multihop=false;b.options.ImportTransitJournal="" }
		original:=state.RuntimeJournalFromFacts(b.loaded)
		runner,err:=NewWithLocalServices(b.options,providers,effects,local)
		ordered:=[]string{"proof","roots","key","load","locations","credential","enable","client"}
		stop:=map[string]int{"proof":1,"roots":2,"key":3,"load":4,"extension":4,"credential":6,"enable":7}
		if stage=="success"||stage=="plain-success" {
			if err!=nil||runner==nil { t.Fatalf("bootstrap success: %v %v",runner,err) }
			expected:=b.enabled;if stage=="plain-success" { expected=b.loaded;ordered=[]string{"proof","roots","key","load","locations","credential","client"} }
			if !reflect.DeepEqual(runner.runtimeState,state.RuntimeJournalFromFacts(expected))||!reflect.DeepEqual(runner.journal,state.RuntimeJournalFromFacts(expected).Journal)||runner.roots!=b.roots||runner.client!=b.client||&runner.key[0]!=&b.key[0]||runner.certificate.Leaf!=b.identity.Certificate.Leaf||runner.credentialFingerprint!=b.identity.Fingerprint||runner.credentialUntil!=b.identity.Until { t.Fatal("bootstrap values projected incorrectly") }
			if &runner.runtimeState.Journal.Snapshot[0]!=&expected.Journal.Snapshot[0]||runner.runtimeState.ExecutionExtension!=expected.ExecutionExtension { t.Fatal("bootstrap raw or extension copied") }
			runner.journal.Fences["reference-probe"]=99;if expected.Journal.Fences["reference-probe"]!=99 { t.Fatal("bootstrap map reference copied") };delete(expected.Journal.Fences,"reference-probe")
			first:=b.certificate();if first.Leaf!=b.identity.Certificate.Leaf { t.Fatal("TLS callback certificate lost") }
			replacement:=&x509.Certificate{};runner.mutex.Lock();runner.certificate=tls.Certificate{Leaf:replacement};runner.mutex.Unlock();if b.certificate().Leaf!=replacement { t.Fatal("TLS callback captured stale certificate") }
		} else {
			if runner!=nil||err==nil { t.Fatalf("bootstrap %s accepted",stage) }
			if stage=="extension" { if err.Error()!="UNSUPPORTED_CAPABILITY: Migrated journal requires multi-hop-aware Runner" { t.Fatal(err) } } else if err!=b.failure { t.Fatalf("bootstrap original error identity %s: %v",stage,err) }
			ordered=ordered[:stop[stage]]
		}
		if !reflect.DeepEqual(b.trace,ordered) { t.Fatalf("bootstrap %s order: %v want%v",stage,b.trace,ordered) }
		if !reflect.DeepEqual(state.RuntimeJournalFromFacts(b.loaded),original) { t.Fatal("refusal or enable changed original protected history") }
	}) }
}

func TestBootstrapOwnerCompleteFlagsAndURLRefuseBeforeAnyEffect(t *testing.T) {
	for _,mutate:=range []func(*Options){func(o *Options){o.ProbeEcho=true},func(o *Options){o.ProbeServices=true},func(o *Options){o.ProbeIngress=true},func(o *Options){o.ProbeExecution=true},func(o *Options){o.Relay=false},func(o *Options){o.Multihop=false},func(o *Options){o.URL="http://control.invalid"},func(o *Options){o.URL="HTTPS://control.invalid"}} {
		b,providers,effects,local:=bootstrapOwnerCompleteFixture();mutate(&b.options);runner,err:=NewWithLocalServices(b.options,providers,effects,local)
		if runner!=nil||err==nil||len(b.trace)!=0 { t.Fatalf("invalid configuration reached bootstrap: %v %v %v",runner,err,b.trace) }
	}
}

func TestBootstrapOwnerCompleteNativeKeyAndRootRefusal(t *testing.T) {
	bootstrap:=platformruntime.Bootstrap{};root:=t.TempDir();path:=filepath.Join(root,"key")
	for _,size:=range []int{0,31,32,33} { raw:=bytes.Repeat([]byte{byte(size)},size);if err:=os.WriteFile(path,raw,0600);err!=nil{t.Fatal(err)};key,err:=bootstrap.LoadProtectionKey(path);if size==32 {if err!=nil||!bytes.Equal(key,raw){t.Fatal("exact32 key changed",err)}} else if key!=nil||err==nil||err.Error()!="INTEGRITY_FAILURE: journal protection key unavailable"{t.Fatalf("key length%d: %x %v",size,key,err)} }
	if key,err:=bootstrap.LoadProtectionKey(path+"-missing");key!=nil||err==nil||err.Error()!="INTEGRITY_FAILURE: journal protection key unavailable"{t.Fatalf("missing key: %x %v",key,err)}
	if err:=os.WriteFile(path,[]byte("invalid PEM"),0600);err!=nil{t.Fatal(err)};if roots,err:=bootstrap.LoadRoots(path);roots!=nil||err==nil||err.Error()!="Invalid Control CA"{t.Fatalf("invalid trusted CA: %v %v",roots,err)}
	if roots,err:=bootstrap.LoadRoots(path+"-missing");roots!=nil||!errors.Is(err,os.ErrNotExist){t.Fatalf("trusted CA native open error: %v %v",roots,err)}
	ca,_,_:=relayTestCA(t);if err:=os.WriteFile(path,pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:ca.Raw}),0600);err!=nil{t.Fatal(err)};roots,err:=bootstrap.LoadRoots(path);if err!=nil||roots==nil||!roots.Equal(func()*x509.CertPool{value:=x509.NewCertPool();value.AddCert(ca);return value}()){t.Fatalf("configured native root CA projection: %v",err)}
}

func TestBootstrapOwnerCompleteActualDefaultConstructorsAndMissingCorruptHistory(t *testing.T){
	f:=newPendingResponseFixture(t,false);bundle,err:=f.provider.Native.ValidateMachineRotation(f.locations,"node-a",f.request,f.response);if err!=nil{t.Fatal(err)};if err:=f.provider.Native.SaveMachine(f.locations.MachineBundle,bundle);err!=nil{t.Fatal(err)}
	root:=t.TempDir();journal,keyPath:=filepath.Join(root,"runtime.json"),filepath.Join(root,"runtime.key");key:=bytes.Repeat([]byte{53},32)
	if err:=os.WriteFile(keyPath,key,0600);err!=nil{t.Fatal(err)};if err:=state.InitializeRuntimeJournal(journal,key,"node-a");err!=nil{t.Fatal(err)}
	options:=Options{URL:"https://control.invalid",NodeID:"node-a",BootID:"boot",Certificate:f.locations.Certificate,PrivateKey:f.locations.PrivateKey,CA:f.locations.CA,Journal:journal,JournalKey:keyPath}
	before,err:=os.ReadFile(journal);if err!=nil{t.Fatal(err)};entriesBefore,err:=os.ReadDir(root);if err!=nil{t.Fatal(err)}
	for _,construct:=range []func(Options)(*Runner,error){New,func(o Options)(*Runner,error){return NewWithProviders(o,defaultProviders())},func(o Options)(*Runner,error){return NewWithEffects(o,defaultProviders(),defaultEffects())},func(o Options)(*Runner,error){return NewWithLocalServices(o,defaultProviders(),defaultEffects(),defaultLocalServices())}}{
		runner,err:=construct(options);if err!=nil||runner==nil||runner.certificate.Leaf==nil||runner.certificate.Leaf.Subject.CommonName!="node-a"||runner.runtimeState.NodeID!="node-a"||runner.runtimeState.ProtocolVersion!=3||runner.journal.Generation!=0||!bytes.Equal(runner.key,key){t.Fatalf("default/explicit construction projection: %v %v",runner,err)};runner.channelProvider().CloseIdleConnections(runner.client)
		after,readErr:=os.ReadFile(journal);entries,dirErr:=os.ReadDir(root);if readErr!=nil||dirErr!=nil||!bytes.Equal(after,before)||len(entries)!=len(entriesBefore){t.Fatal("constructor wrote/reset history or acquired another instance lock")};for index,entry:=range entries{if entry.Name()!=entriesBefore[index].Name(){t.Fatal("constructor introduced extra state/lock file")}}
	}
	bootstrap:=platformruntime.Bootstrap{}
	missing:=filepath.Join(root,"missing.json");if _,err:=bootstrap.LoadRuntime(missing,key,"node-a");err==nil{t.Fatal("missing runtime implicitly initialized")};if _,err:=os.Stat(missing);!os.IsNotExist(err){t.Fatal("failed native load created history")}
	corrupt:=[]byte(`{"protected":"do not clear malformed history"}`);if err:=os.WriteFile(journal,corrupt,0600);err!=nil{t.Fatal(err)}
	for _,load:=range []func()error{func()error{_,err:=bootstrap.LoadRuntime(journal,key,"node-a");return err},func()error{_,err:=bootstrap.EnableRuntime(journal,key,"node-a","");return err}}{if err:=load();err==nil{t.Fatal("corrupt authenticated native history accepted")};after,err:=os.ReadFile(journal);if err!=nil||!bytes.Equal(after,corrupt){t.Fatal("native load/enable repaired corrupt history")}}
}

func TestBootstrapOwnerCompleteOriginalNativeProjectionOnceOnSuccessAndError(t *testing.T) {
	set:=token.NewFileSet();original,err:=parser.ParseFile(set,"../platformruntime/native.go",nil,0);if err!=nil{t.Fatal(err)}
	fixture:=&ast.File{Name:ast.NewIdent("control")};count:=0
	for _,declaration:=range original.Decls {function,ok:=declaration.(*ast.FuncDecl);if !ok||(function.Name.Name!="LoadRuntime"&&function.Name.Name!="EnableRuntime"){continue};count++
		ast.Inspect(function,func(node ast.Node)bool{switch value:=node.(type){case *ast.Ident:if value.Name=="Bootstrap"{value.Name="BootstrapFixture"};case *ast.Field:if selector,ok:=value.Type.(*ast.SelectorExpr);ok{if owner,ok:=selector.X.(*ast.Ident);ok&&owner.Name=="executionstate"&&selector.Sel.Name=="RuntimeJournal"{value.Type=ast.NewIdent("RuntimeFactsFixture")}};case *ast.CallExpr:if selector,ok:=value.Fun.(*ast.SelectorExpr);ok{if owner,ok:=selector.X.(*ast.Ident);ok&&owner.Name=="state"{value.Fun=ast.NewIdent(selector.Sel.Name+"Fixture")}}};return true});fixture.Decls=append(fixture.Decls,function)
	}
	if count!=2{t.Fatal("native Bootstrap projection owners changed")};var source bytes.Buffer;if err:=format.Node(&source,set,fixture);err!=nil{t.Fatal(err)}
	root:=t.TempDir();for name,raw:=range map[string][]byte{"go.mod":[]byte("module bootstrap-projection-effects\n\ngo 1.26.3\n"),"original.go":source.Bytes(),"effects_test.go":[]byte(bootstrapOwnerCompleteProjectionFixture)}{if err:=os.WriteFile(filepath.Join(root,name),raw,0600);err!=nil{t.Fatal(err)}}
	ctx,cancel:=context.WithTimeout(context.Background(),60*time.Second);defer cancel();command:=exec.CommandContext(ctx,"go","test","-count=1",".");command.Dir=root;command.Env=append(os.Environ(),"GOWORK=off","GO111MODULE=on","GOTOOLCHAIN=local");if output,err:=command.CombinedOutput();err!=nil{t.Fatalf("native Bootstrap exact projection: %v\n%s",err,output)}
}

const bootstrapOwnerCompleteProjectionFixture=`package control
import("errors";"reflect";"testing")
type BootstrapFixture struct{}
type RuntimeFactsFixture struct {pointer *int;bytes []byte}
type nativeFixture struct {pointer *int;bytes []byte}
var trace []string
var nativeValue nativeFixture
var nativeFailure error
var originalKey=[]byte{1,2,3}
func LoadRuntimeJournalFixture(path string,key []byte,node string)(nativeFixture,error){trace=append(trace,"load");if path!="journal"||node!="node"||&key[0]!=&originalKey[0]{panic("load arguments")};return nativeValue,nativeFailure}
func EnableRuntimeExecutionFixture(path string,key []byte,node,transit string)(nativeFixture,error){trace=append(trace,"enable");if path!="journal"||node!="node"||transit!="transit"||&key[0]!=&originalKey[0]{panic("enable arguments")};return nativeValue,nativeFailure}
func RuntimeJournalFactsFixture(value nativeFixture)RuntimeFactsFixture{trace=append(trace,"project");if value.pointer!=nativeValue.pointer||&value.bytes[0]!=&nativeValue.bytes[0]{panic("preprojection changed returned value")};return RuntimeFactsFixture{value.pointer,value.bytes}}
func TestActualNativeProjection(t *testing.T){pointer:=7;nativeValue=nativeFixture{&pointer,[]byte{255,0,128}};for _,failure:=range []error{nil,errors.New("native original error")}{for _,method:=range []string{"load","enable"}{trace=nil;nativeFailure=failure;var value RuntimeFactsFixture;var err error;if method=="load"{value,err=(BootstrapFixture{}).LoadRuntime("journal",originalKey,"node")}else{value,err=(BootstrapFixture{}).EnableRuntime("journal",originalKey,"node","transit")};if err!=failure||value.pointer!=nativeValue.pointer||&value.bytes[0]!=&nativeValue.bytes[0]||!reflect.DeepEqual(trace,[]string{method,"project"}){t.Fatalf("single native projection/error: %+v %v %v",value,err,trace)}}}}
`

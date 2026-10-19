package control

import (
	"bytes"
	"context"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

// Compile the current controller declarations, not a parallel controller. Only
// external effects are rebound; strict parsing and the durable Journal stay real.
func TestTransitAuthorityLifecycleCompleteOriginalControllerEffects(t *testing.T) {
	set := token.NewFileSet()
	source, err := parser.ParseFile(set, "transit_runner.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	source.Name = ast.NewIdent("control")
	counts := map[string]int{}
	ast.Inspect(source, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		owner, ok := selector.X.(*ast.Ident)
		if !ok {
			return true
		}
		key := owner.Name + "." + selector.Sel.Name
		replacement := map[string]string{"nativeexecution.ParseWireTime": "parseTimeLifecycleFixture", "state.AcceptTransitSnapshot": "acceptLifecycleFixture", "nativeexecution.EncodeOfflineTransitIntent": "encodeLifecycleFixture", "nativeexecution.PrepareOfflineTransit": "prepareLifecycleFixture"}[key]
		if replacement != "" {
			call.Fun = ast.NewIdent(replacement)
			counts[key]++
		}
		return true
	})
	if !reflect.DeepEqual(counts, map[string]int{"nativeexecution.ParseWireTime": 2, "state.AcceptTransitSnapshot": 1, "nativeexecution.EncodeOfflineTransitIntent": 1, "nativeexecution.PrepareOfflineTransit": 1}) {
		t.Fatal("original effect inventory changed", counts)
	}
	var original bytes.Buffer
	if err := format.Node(&original, set, source); err != nil {
		t.Fatal(err)
	}
	helpers, err := parser.ParseFile(set, "transit_runner_test.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	selected := &ast.File{Name: ast.NewIdent("control")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"encoding/json", "os", "testing", "time", "github.com/tunex/vnext/agent/internal/contracts", "github.com/tunex/vnext/agent/internal/adp3transit"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("%q", path)}})
	}
	selected.Decls = append(selected.Decls, imports)
	found := 0
	for _, decl := range helpers.Decls {
		function, ok := decl.(*ast.FuncDecl)
		if ok && (function.Name.Name == "transitRunnerHash" || function.Name.Name == "transitRunnerIntent" || function.Name.Name == "transitRunnerSnapshot") {
			selected.Decls = append(selected.Decls, function)
			found++
		}
	}
	if found != 3 {
		t.Fatal("current strict snapshot helpers changed", found)
	}
	var fixtureHelpers bytes.Buffer
	if err := format.Node(&fixtureHelpers, set, selected); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	// Keep the original helper's fixture path valid without editing its body.
	fixtureRoot := filepath.Join(root, "docs", "protocol", "fixtures")
	if err := os.MkdirAll(fixtureRoot, 0700); err != nil {
		t.Fatal(err)
	}
	vector, err := os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(fixtureRoot, "transit-v1.json"), vector, 0600); err != nil {
		t.Fatal(err)
	}
	packageRoot := filepath.Join(root, "a", "b", "c")
	if err := os.MkdirAll(packageRoot, 0700); err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/transitlifecyclefixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": original.Bytes(), "helpers_test.go": fixtureHelpers.Bytes(), "effects_test.go": []byte(transitAuthorityLifecycleCompleteFixture)} {
		if err := os.WriteFile(filepath.Join(packageRoot, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = packageRoot
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("original Transit controller effects: %v\n%s", err, output)
	}
}

const transitAuthorityLifecycleCompleteFixture = `package control
import("bytes";"encoding/json";"errors";"fmt";"path/filepath";"reflect";"strings";"testing";"time";"github.com/tunex/vnext/agent/internal/adp3transit";"github.com/tunex/vnext/agent/internal/executionhost";"github.com/tunex/vnext/agent/internal/nativeexecution";"github.com/tunex/vnext/agent/internal/state")
var lifecycleController *TransitController
var lifecycleEvents []string
var lifecycleFailure=errors.New("AUTHORIZATION_DENIED: original boundary failure")
var lifecycleMode string
var lifecycleAuthCalls int
var lifecycleEncodeCalls int
var lifecycleEngine *lifecyclePrepared
var lifecycleAllow func()error
func lifecycleEvent(event string){if lifecycleController.mu.TryLock(){lifecycleController.mu.Unlock();panic("controller effect outside original mutex")};lifecycleEvents=append(lifecycleEvents,event)}
func parseTimeLifecycleFixture(raw string)(time.Time,error){lifecycleEvent("parse:"+raw);if lifecycleMode=="issued-parse"&&len(lifecycleEvents)==2{return time.Time{},lifecycleFailure};if lifecycleMode=="valid-parse"&&len(lifecycleEvents)==3{return time.Time{},lifecycleFailure};return nativeexecution.ParseWireTime(raw)}
func acceptLifecycleFixture(path string,key []byte,current state.TransitJournal,snapshot adp3transit.Snapshot)(state.TransitJournal,error){lifecycleEvent("save");if lifecycleMode=="save"{return state.TransitJournal{},lifecycleFailure};return state.AcceptTransitSnapshot(path,key,current,snapshot)}
func encodeLifecycleFixture(a adp3transit.Assignment)([]byte,error){lifecycleEvent("encode");lifecycleEncodeCalls++;if lifecycleMode=="encode"||lifecycleMode=="encode-second"&&lifecycleEncodeCalls==2{return nil,lifecycleFailure};return nativeexecution.EncodeOfflineTransitIntent(a)}
func prepareLifecycleFixture(raw []byte,id nativeexecution.OfflineTransitIdentity,allow func()error)(executionhost.PreparedInstance,error){lifecycleEvent("prepare");lifecycleAllow=allow;if !reflect.DeepEqual(id,lifecycleController.identity){panic("controller changed original identity")};var intent any;if err:=json.Unmarshal(raw,&intent);err!=nil{panic(err)};if err:=allow();err!=nil{return nil,err};switch lifecycleMode{case "prepare-nil":return nil,lifecycleFailure;case "prepare-partial":return lifecycleEngine,lifecycleFailure};return lifecycleEngine,nil}
type lifecyclePrepared struct{name string;closed int;activated int;generation uint64}
func(e *lifecyclePrepared)Close(){lifecycleEvent(e.name+":close");e.closed++;stored,err:=state.LoadTransitJournal(lifecycleController.path,lifecycleController.key,"node-b");if err!=nil||stored.Generation!=e.generation{panic(fmt.Sprint("close before durable save ",err,stored.Generation))}}
func(e *lifecyclePrepared)Activate()error{lifecycleEvent(e.name+":activate");e.activated++;if lifecycleMode=="activate"{return lifecycleFailure};return nil}
func lifecycleNew(t *testing.T)(*TransitController,[]byte,adp3transit.Snapshot){t.Helper();path:=filepath.Join(t.TempDir(),"journal");key:=bytes.Repeat([]byte{61},32);if err:=state.InitializeTransitJournal(path,key,"node-b");err!=nil{t.Fatal(err)};journal,err:=state.LoadTransitJournal(path,key,"node-b");if err!=nil{t.Fatal(err)};raw:=transitRunnerSnapshot(t,8,10,32101,"prepared");snapshot,err:=adp3transit.ParseSnapshot(raw);if err!=nil{t.Fatal(err)};issued,err:=nativeexecution.ParseWireTime(snapshot.IssuedAt);if err!=nil{t.Fatal(err)};c:=&TransitController{path:path,key:key,node:"node-b",epoch:8,journal:journal,capabilities:[]string{"adp.multihop.1","transit.wire.1","native.transit.v1"},engines:map[string]executionhost.PreparedInstance{}}
 lifecycleController=c;lifecycleEvents=nil;lifecycleMode="";lifecycleAuthCalls=0;lifecycleEncodeCalls=0;lifecycleAllow=nil;lifecycleEngine=&lifecyclePrepared{name:"new",generation:10}
 c.now=func()time.Time{lifecycleEvent("now");return issued.Add(time.Second)}
 c.authorize=func()error{lifecycleEvent("auth");lifecycleAuthCalls++;if lifecycleMode=="auth"||lifecycleMode=="item-auth"&&lifecycleAuthCalls==2||lifecycleMode=="final-auth"&&lifecycleAuthCalls==3||lifecycleMode=="check-auth"&&lifecycleAuthCalls==4{return lifecycleFailure};return nil}
 c.reserveLocalPort=func(a adp3transit.Assignment)error{lifecycleEvent("reserve:"+a.AssignmentId);if lifecycleMode=="reserve"{return lifecycleFailure};return nil};return c,raw,*snapshot}
func lifecycleRehash(t *testing.T,raw []byte,change func(map[string]any))[]byte{t.Helper();var body map[string]any;if err:=json.Unmarshal(raw,&body);err!=nil{t.Fatal(err)};change(body);delete(body,"snapshotDigest");body["snapshotDigest"]=transitRunnerHash(t,body);out,err:=json.Marshal(body);if err!=nil{t.Fatal(err)};return out}
func TestOriginalPrechecksAndTimeOrder(t *testing.T){for _,mode:=range []string{"closed","capability","auth","strict","node","epoch","generation","issued-parse","valid-parse","future","expired","item-auth","reserve","final-auth","save"}{t.Run(mode,func(t *testing.T){c,raw,s:=lifecycleNew(t);old:=&lifecyclePrepared{name:"old",generation:0};c.engines["old"]=old;lifecycleMode=mode
 switch mode{case "closed":c.closed=true;case "capability":c.capabilities=nil;case "strict":raw=append([]byte("{\"future\":true,"),raw[1:]...);case "node":c.node="other";case "epoch":c.epoch=9;case "generation":c.journal.Generation=10;case "future":issued,_:=nativeexecution.ParseWireTime(s.IssuedAt);c.now=func()time.Time{lifecycleEvent("now");return issued.Add(-time.Second-time.Nanosecond)};case "expired":deadline,_:=nativeexecution.ParseWireTime(s.ValidUntil);c.now=func()time.Time{lifecycleEvent("now");return deadline}}
 observations,err:=c.ApplyTransitSnapshot(raw);if err==nil||observations!=nil||old.closed!=0||len(c.engines)!=1||c.engines["old"]!=old{t.Fatal("precheck changed publication",err,observations,lifecycleEvents)}
 stored,readErr:=state.LoadTransitJournal(c.path,c.key,"node-b");if readErr!=nil||stored.Generation!=0{t.Fatal("failed precheck wrote Journal",readErr,stored.Generation)}
 prefix:=[]string{"auth","parse:"+s.IssuedAt,"parse:"+s.ValidUntil,"now","auth","reserve:assign-b","auth","save"};count:=map[string]int{"closed":0,"capability":0,"auth":1,"strict":1,"node":1,"epoch":1,"generation":1,"issued-parse":2,"valid-parse":3,"future":4,"expired":4,"item-auth":5,"reserve":6,"final-auth":7,"save":8}[mode];if !reflect.DeepEqual(lifecycleEvents,prefix[:count])&&!(count==0&&len(lifecycleEvents)==0){t.Fatal("original precheck effect order",mode,lifecycleEvents,prefix[:count])};if mode=="issued-parse"||mode=="valid-parse"||mode=="auth"||mode=="item-auth"||mode=="reserve"||mode=="final-auth"||mode=="save"{if err!=lifecycleFailure{t.Fatal("boundary error identity normalized",err)}}})}}
func TestOriginalPhasesPartialCleanupAndReturnShape(t *testing.T){for _,phase:=range []string{"prepared","active","draining"}{for _,mode:=range []string{"success","check-auth","encode","prepare-nil","prepare-partial","activate"}{if mode=="activate"&&phase!="active"{continue};t.Run(phase+"/"+mode,func(t *testing.T){c,_,_:=lifecycleNew(t);raw:=transitRunnerSnapshot(t,8,10,32101,phase);snapshot,parseErr:=adp3transit.ParseSnapshot(raw);if parseErr!=nil{t.Fatal(parseErr)};issued,_:=nativeexecution.ParseWireTime(snapshot.IssuedAt);c.now=func()time.Time{lifecycleEvent("now");return issued.Add(time.Second)};old:=&lifecyclePrepared{name:"old",generation:10};c.engines["old"]=old;alias:=c.engines;lifecycleMode=mode;observations,err:=c.ApplyTransitSnapshot(raw)
 expected:=[]string{"auth","parse:"+snapshot.IssuedAt,"parse:"+snapshot.ValidUntil,"now","auth","reserve:assign-b","auth","save","old:close","auth"};if mode!="check-auth"{expected=append(expected,"now","encode");if mode!="encode"{expected=append(expected,"prepare","auth","now");if mode!="prepare-nil"&&mode!="prepare-partial"&&phase=="active"{expected=append(expected,"new:activate")};if mode=="prepare-partial"||mode=="activate"||mode=="success"&&phase=="draining"{expected=append(expected,"new:close")}}}
 if !reflect.DeepEqual(lifecycleEvents,expected){t.Fatal("original phase ordering",lifecycleEvents,expected)};if old.closed!=1||c.journal.Generation!=10{t.Fatal("save before replacement",old.closed,c.journal.Generation)}
 if mode=="encode"{if err!=lifecycleFailure||len(observations)!=0||observations==nil{t.Fatal("JSON error must return already accumulated nonnil slice",err,observations)}}else{if err!=nil||len(observations)!=1{t.Fatal("engine failure must be observation",err,observations)};want:="prepared";code:="";if mode!="success"{want="error";code="AUTHORIZATION_DENIED"}else if phase=="active"{want="ready"}else if phase=="draining"{want="removed"};if observations[0]!=(TransitObservation{AssignmentID:"assign-b",Generation:4,Fence:9,Phase:phase,Condition:want,ErrorCode:code}){t.Fatal("complete observation fields",observations)}}
 kept:=mode=="success"&&phase!="draining";if kept{if len(alias)!=1||alias["assign-b"]!=lifecycleEngine{t.Fatal("same engine map publication")}}else if len(alias)!=0{t.Fatal("failed or draining engine published",alias)}
 if lifecycleAllow!=nil{lifecycleEvents=nil;lifecycleMode="auth";c.mu.Lock();checkErr:=lifecycleAllow();c.mu.Unlock();if checkErr!=lifecycleFailure||!reflect.DeepEqual(lifecycleEvents,[]string{"auth"}){t.Fatal("Allow called Now before authorizer",checkErr,lifecycleEvents)};lifecycleEvents=nil;lifecycleMode="";deadline,_:=nativeexecution.ParseWireTime(snapshot.ValidUntil);c.now=func()time.Time{lifecycleEvent("now");return deadline};c.mu.Lock();checkErr=lifecycleAllow();c.mu.Unlock();if checkErr==nil||!strings.HasPrefix(checkErr.Error(),"LEASE_EXPIRED:")||!reflect.DeepEqual(lifecycleEvents,[]string{"auth","now"}){t.Fatal("Allow deadline boundary",checkErr,lifecycleEvents)}}
 lifecycleEvents=nil;c.Close();c.Close();wantClosed:=0;if kept||mode=="prepare-partial"||mode=="activate"||mode=="success"&&phase=="draining"{wantClosed=1};if len(c.engines)!=0||!c.closed||lifecycleEngine.closed!=wantClosed{t.Fatal("Close cleanup",lifecycleEvents,lifecycleEngine.closed,wantClosed)};if generation,digest:=c.CurrentJournal();generation!=10||digest==""{t.Fatal("CurrentJournal lost committed history",generation,digest)};lifecycleEvents=nil;if result,err:=c.ApplyTransitSnapshot(raw);err==nil||result!=nil||len(lifecycleEvents)!=0{t.Fatal("closed controller effect",err,result,lifecycleEvents)}
 })}}}
func TestOriginalDurableFailureRestartRejectsReplay(t *testing.T){for _,mode:=range []string{"prepare-nil","prepare-partial","activate"}{t.Run(mode,func(t *testing.T){c,raw,_:=lifecycleNew(t);if mode=="activate"{raw=transitRunnerSnapshot(t,8,10,32101,"active")};lifecycleMode=mode;results,err:=c.ApplyTransitSnapshot(raw);if err!=nil||len(results)!=1||results[0].Condition!="error"||len(c.engines)!=0{t.Fatal("failure did not stay offline",err,results)};stored,err:=state.LoadTransitJournal(c.path,c.key,"node-b");if err!=nil||stored.Generation!=10||stored.Digest==""||stored.Fences["tcp/32101"]!=9{t.Fatal("failure lost durable highwater",err,stored)};replay:=&TransitController{path:c.path,key:c.key,node:c.node,epoch:c.epoch,journal:stored,capabilities:c.capabilities,authorize:func()error{return nil},reserveLocalPort:func(adp3transit.Assignment)error{panic("replay reserved resource")},engines:map[string]executionhost.PreparedInstance{},now:func()time.Time{panic("replay sampled time")}};if got,err:=replay.ApplyTransitSnapshot(raw);err==nil||got!=nil||len(replay.engines)!=0||!strings.HasPrefix(err.Error(),"FENCING_REJECTED:"){t.Fatal("failed preparation or activation replayed",err,got)};if _,err:=state.AcceptTransitSnapshot(c.path,c.key,stored,*mustLifecycleSnapshot(t,transitRunnerSnapshot(t,8,11,32101,"prepared")));err!=nil{t.Fatal("higher original generation/fence cannot advance",err)}})}}
func mustLifecycleSnapshot(t *testing.T,raw []byte)*adp3transit.Snapshot{t.Helper();snapshot,err:=adp3transit.ParseSnapshot(raw);if err!=nil{t.Fatal(err)};return snapshot}
func TestOriginalPerItemReservationAndAccumulatedJSONReturn(t *testing.T){c,raw,_:=lifecycleNew(t);raw=lifecycleRehash(t,raw,func(body map[string]any){assignments:=body["assignments"].([]any);encoded,err:=json.Marshal(assignments[0]);if err!=nil{t.Fatal(err)};var next map[string]any;if err:=json.Unmarshal(encoded,&next);err!=nil{t.Fatal(err)};next["assignmentId"]="assign-z";next["forwardId"]="forward-2";next["resource"].(map[string]any)["port"]=32102;driver:=next["driver"].(map[string]any);config:=driver["config"].(map[string]any);intent:=config["intent"].(map[string]any);intent["assignmentId"]="assign-z";intent["forwardId"]="forward-2";intent["listener"].(map[string]any)["port"]=32102;driver["configDigest"]=transitRunnerHash(t,config);body["assignments"]=append(assignments,next)});snapshot:=mustLifecycleSnapshot(t,raw);lifecycleMode="encode-second";results,err:=c.ApplyTransitSnapshot(raw);if err!=lifecycleFailure||len(results)!=1||results[0].AssignmentID!="assign-b"||results[0].Condition!="prepared"||len(c.engines)!=1||c.engines["assign-b"]!=lifecycleEngine{t.Fatal("second JSON error discarded original accumulated observation/engine",err,results,c.engines)};expected:=[]string{"auth","parse:"+snapshot.IssuedAt,"parse:"+snapshot.ValidUntil,"now","auth","reserve:assign-b","auth","reserve:assign-z","auth","save","auth","now","encode","prepare","auth","now","auth","now","encode"};if !reflect.DeepEqual(lifecycleEvents,expected){t.Fatal("per-item auth/reserve then final authorization and accumulated return order",lifecycleEvents,expected)};stored,err:=state.LoadTransitJournal(c.path,c.key,"node-b");if err!=nil||stored.Generation!=10||stored.Fences["tcp/32101"]!=9||stored.Fences["tcp/32102"]!=9{t.Fatal("JSON failure lost complete durable snapshot high-water",err,stored)};c.Close();if lifecycleEngine.closed!=1{t.Fatal("accumulated engine not closed")}}
`

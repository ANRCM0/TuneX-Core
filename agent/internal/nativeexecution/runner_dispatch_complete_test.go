package nativeexecution

import (
	"bytes"
	"context"
	"encoding/json"
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

	"github.com/tunex/vnext/agent/internal/adp3"
)

func TestRunnerWireCompleteHelloReportLiteralBytesAndRecoveryDecodeKinds(t *testing.T) {
	hello := adp3.HelloRequest{ProtocolVersion: 3, NodeId: "node", BootId: "boot", AgentBuild: "vnext-adp3-direct", Capabilities: []string{"adp.3", "native.direct.v1", "tcp", "udp"}, LastStoredSnapshotGeneration: ^uint64(0)}
	raw, err := EncodeRunnerHello(hello)
	if err != nil || string(raw) != `{"protocolVersion":3,"nodeId":"node","bootId":"boot","agentBuild":"vnext-adp3-direct","capabilities":["adp.3","native.direct.v1","tcp","udp"],"lastStoredSnapshotGeneration":18446744073709551615}` {
		t.Fatal("Hello raw native integer/order", string(raw), err)
	}
	hello.Capabilities = nil
	raw, err = EncodeRunnerHello(hello)
	if err != nil || !bytes.Contains(raw, []byte(`"capabilities":null`)) {
		t.Fatal("local Hello nil slice normalization", string(raw), err)
	}
	report := adp3.ReportRequest{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ReportSequence: 7, ObservedAt: "2026-10-20T00:00:00Z", AcceptedSnapshotGeneration: 4}
	raw, err = EncodeRunnerReport(report)
	if err != nil || string(raw) != `{"protocolVersion":3,"nodeId":"node","bootId":"boot","sessionEpoch":2,"reportSequence":7,"observedAt":"2026-10-20T00:00:00Z","acceptedSnapshotGeneration":4,"observations":[],"drains":null}` || report.Observations != nil || report.Drains != nil {
		t.Fatal("report nil projection/order mutated input", string(raw), err)
	}
	for _, test := range []struct {
		raw  string
		want adp3.ReportRequest
	}{
		{`{"nodeId":"first","nodeId":"last","future":true,"reportSequence":7}`, adp3.ReportRequest{NodeId: "last", ReportSequence: 7}},
		{`{"nodeId":"node","reportSequence":"bad","bootId":"boot","drains":[{"assignmentId":"old","deploymentGeneration":4,"bindingFence":5,"condition":"removed"}]}`, adp3.ReportRequest{NodeId: "node", BootId: "boot", Drains: []adp3.Drain{{AssignmentId: "old", DeploymentGeneration: 4, BindingFence: 5, Condition: "removed"}}}},
		{`{"nodeId":"node"`, adp3.ReportRequest{}},
	} {
		before := []byte(test.raw)
		copyRaw := append([]byte(nil), before...)
		if got := DecodePendingRunnerReport(before); !reflect.DeepEqual(got, test.want) || !bytes.Equal(before, copyRaw) {
			t.Fatal("best-effort local partial JSON/error mutation", test.raw, got, test.want)
		}
	}
	retained := []byte(`{"nodeId":"old","nodeId":"new","future":true,"snapshotGeneration":3,"assignments":[]}`)
	snapshot, err := DecodeRetainedRunnerSnapshot(retained)
	if err != nil || snapshot.NodeId != "new" || snapshot.SnapshotGeneration != 3 || snapshot.Assignments == nil {
		t.Fatal("retained Journal JSON-only recovery became strict", snapshot, err)
	}
	if _, err := DecodeRunnerSnapshot(retained); err == nil {
		t.Fatal("retained JSON accepted as live snapshot")
	}
	partial, err := DecodeRetainedRunnerSnapshot([]byte(`{"nodeId":"node","snapshotGeneration":"bad","sessionEpoch":2}`))
	if err == nil || partial.NodeId != "node" || partial.SessionEpoch != 2 {
		t.Fatal("retained JSON typed error lost original partial projection", partial, err)
	}
}

func TestRunnerWireCompleteActualStrictHelloSnapshotAndAckParsers(t *testing.T) {
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/adp-v3-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name, Schema, Raw string
			Valid             bool
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, sample := range fixture.Cases {
		if sample.Schema != "HelloResponse" && sample.Schema != "Snapshot" && sample.Schema != "ReportAck" {
			continue
		}
		if !sample.Valid || seen[sample.Schema] {
			continue
		}
		want, wantErr := adp3.Parse(sample.Schema, []byte(sample.Raw))
		var got any
		var err error
		switch sample.Schema {
		case "HelloResponse":
			got, err = DecodeRunnerHello([]byte(sample.Raw))
		case "Snapshot":
			got, err = DecodeRunnerSnapshot([]byte(sample.Raw))
		case "ReportAck":
			got, err = DecodeRunnerReportAck([]byte(sample.Raw))
		}
		if (err == nil) != (wantErr == nil) || err != nil && err.Error() != wantErr.Error() || err == nil && !reflect.DeepEqual(got, want) {
			t.Fatal("original native parser result/error", sample.Name, got, err, want, wantErr)
		}
		if !sample.Valid {
			continue
		}
		seen[sample.Schema] = true
		var object map[string]any
		if err := json.Unmarshal([]byte(sample.Raw), &object); err != nil {
			t.Fatal(err)
		}
		object["future"] = true
		unknown, err := json.Marshal(object)
		if err != nil {
			t.Fatal(err)
		}
		duplicate := append([]byte(`{"nodeId":"duplicate",`), []byte(sample.Raw)[1:]...)
		for _, bad := range [][]byte{unknown, duplicate, []byte(`{`), []byte(`{} {}`)} {
			var err error
			switch sample.Schema {
			case "HelloResponse":
				_, err = DecodeRunnerHello(bad)
			case "Snapshot":
				_, err = DecodeRunnerSnapshot(bad)
			case "ReportAck":
				_, err = DecodeRunnerReportAck(bad)
			}
			if err == nil {
				t.Fatal("strict live native parser accepted malformed/unknown/duplicate", sample.Schema, string(bad))
			}
		}
	}
	if !seen["HelloResponse"] || !seen["Snapshot"] || !seen["ReportAck"] {
		t.Fatal("three strict live native parser baselines required", seen)
	}
}

// Execute the native adapter orchestration as written. Pure assignment/policy
// conversions remain original declarations; only engine entrypoints and the
// finish call are rebound so order and partial returns need no test sockets.
func TestRunnerDispatchCompleteOriginalDirectRelayAndMultihopEffectOrder(t *testing.T) {
	set := token.NewFileSet()
	fixture := &ast.File{Name: ast.NewIdent("nativeexecution")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"encoding/json", "fmt", "github.com/tunex/vnext/agent/internal/adp3", "github.com/tunex/vnext/agent/internal/adp3relay", "github.com/tunex/vnext/agent/internal/contracts", "github.com/tunex/vnext/agent/internal/executiondriver", "github.com/tunex/vnext/agent/internal/executionhost"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("%q", path)}})
	}
	fixture.Decls = append(fixture.Decls, imports)
	counts := map[string]int{}
	for _, entry := range [][2]string{{"direct.go", "StartDirect"}, {"direct.go", "StartDirectMetered"}, {"relay.go", "StartRelay"}, {"relay.go", "StartMultihop"}, {"relay.go", "Maximum"}, {"assignment_wire.go", "DirectAssignment"}, {"assignment_wire.go", "directPolicy"}, {"assignment_wire.go", "relayAssignment"}} {
		file, err := parser.ParseFile(set, entry[0], nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		found := 0
		for _, declaration := range file.Decls {
			function, ok := declaration.(*ast.FuncDecl)
			if !ok || function.Name.Name != entry[1] {
				continue
			}
			found++
			ast.Inspect(function, func(node ast.Node) bool {
				call, ok := node.(*ast.CallExpr)
				if !ok {
					return true
				}
				if identifier, ok := call.Fun.(*ast.Ident); ok {
					replacement := map[string]string{"DirectAssignment": "directAssignmentFixture", "directPolicy": "directPolicyFixture", "relayAssignment": "relayAssignmentFixture", "FinishRelayStart": "finishRelayFixture"}[identifier.Name]
					if replacement != "" {
						counts[identifier.Name]++
						call.Fun = ast.NewIdent(replacement)
					}
				} else if selector, ok := call.Fun.(*ast.SelectorExpr); ok {
					if owner, ok := selector.X.(*ast.Ident); ok {
						key := owner.Name + "." + selector.Sel.Name
						replacement := map[string]string{"forward.StartAuthorizedMetered": "startTCPFixture", "forward.StartUDPAuthorizedMetered": "startUDPFixture", "relay.PrepareMetered": "prepareRelayFixture", "relay.PrepareMultihopMetered": "prepareMultihopFixture"}[key]
						if replacement != "" {
							counts[key]++
							call.Fun = ast.NewIdent(replacement)
						}
					}
				}
				return true
			})
			fixture.Decls = append(fixture.Decls, function)
		}
		if found != 1 {
			t.Fatal("native dispatch owner missing", entry)
		}
	}
	if !reflect.DeepEqual(counts, map[string]int{"DirectAssignment": 1, "directPolicy": 1, "relayAssignment": 1, "FinishRelayStart": 2, "forward.StartAuthorizedMetered": 1, "forward.StartUDPAuthorizedMetered": 1, "relay.PrepareMetered": 1, "relay.PrepareMultihopMetered": 1}) {
		t.Fatal("native dispatch effect inventory changed", counts)
	}
	var source bytes.Buffer
	if err := format.Node(&source, set, fixture); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	relayFixture, err := os.ReadFile("../../../packages/contracts/fixtures/adp-v3-relay.json")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/runnerdispatchfixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": source.Bytes(), "effects_test.go": []byte(runnerDispatchCompleteFixture), "relay-fixtures.json": relayFixture} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("original native dispatch stages: %v\n%s", err, output)
	}
}

const runnerDispatchCompleteFixture = `package nativeexecution
import("context";"encoding/json";"errors";"os";"reflect";"testing";"time";"github.com/tunex/vnext/agent/internal/adp3";"github.com/tunex/vnext/agent/internal/adp3relay";"github.com/tunex/vnext/agent/internal/contracts";"github.com/tunex/vnext/agent/internal/executiondriver";"github.com/tunex/vnext/agent/internal/relay";"github.com/tunex/vnext/agent/internal/executionhost")
var traceFixture []string
var failureFixture=errors.New("original native dispatch effect")
var failureStageFixture string
var directFixture contracts.Assignment
var policyFixture contracts.Policy
var inputAssignmentFixture adp3.Assignment
var inputIdentityFixture relay.Identity
var preparedFixture adp3relay.Assignment
var engineFixture *relay.Engine
var checkFixture func()error
var gateFixture executionhost.PayloadGate
type payloadFixture struct{marker byte}
func(*payloadFixture)Acquire(context.Context,int,bool)(int,error){panic("adapter acquired payload instead of passing gate")}
type streamFixture struct{}
func(*streamFixture)Close(){panic("adapter claimed native engine cleanup")}
func(*streamFixture)Drain(){panic("adapter drained before returning")}
func(*streamFixture)Remaining()uint64{return 0}
func(*streamFixture)SetAuthorization(func()error){panic("adapter replaced supplied check")}
var directStreamFixture=&streamFixture{}
func directAssignmentFixture(a adp3.Assignment)(contracts.Assignment,error){traceFixture=append(traceFixture,"assignment");value,err:=DirectAssignment(a);directFixture=value;return value,err}
func directPolicyFixture(p adp3.Policy)(contracts.Policy,error){traceFixture=append(traceFixture,"policy");if failureStageFixture=="policy"{return contracts.Policy{},failureFixture};value,err:=directPolicy(p);policyFixture=value;return value,err}
func startTCPFixture(a contracts.Assignment,p contracts.Policy,check func()error,gate executionhost.PayloadGate)(executiondriver.Instance,error){if gate!=gateFixture{panic("TCP payload gate identity changed")};return startFixture("tcp",a,p,check)}
func startUDPFixture(a contracts.Assignment,p contracts.Policy,check func()error,gate executionhost.PayloadGate)(executiondriver.Instance,error){if gate!=gateFixture{panic("UDP payload gate identity changed")};return startFixture("udp",a,p,check)}
func startFixture(protocol string,a contracts.Assignment,p contracts.Policy,check func()error)(executiondriver.Instance,error){traceFixture=append(traceFixture,protocol);if !reflect.DeepEqual(a,directFixture)||!reflect.DeepEqual(p,policyFixture)||check()!=failureFixture{panic("native direct arguments/check identity changed")};return directStreamFixture,failureFixture}
func relayAssignmentFixture(host executiondriver.Host,a adp3.Assignment)(adp3relay.Assignment,error){traceFixture=append(traceFixture,"assignment");value,err:=relayAssignment(host,a);preparedFixture=value;return value,err}
func prepareRelayFixture(a adp3relay.Assignment,identity relay.Identity,maximum int,check func()error,gate executionhost.PayloadGate)(*relay.Engine,error){if gate!=gateFixture{panic("Relay payload gate identity changed")};traceFixture=append(traceFixture,"prepare");if !reflect.DeepEqual(a,preparedFixture)||a.Phase!="prepared"||!reflect.DeepEqual(identity,inputIdentityFixture)||maximum!=4096||check()!=failureFixture{panic("relay original prepared conversion/identity/maximum/check changed")};if failureStageFixture=="prepare"{return engineFixture,failureFixture};return engineFixture,nil}
func prepareMultihopFixture(a adp3.Assignment,identity relay.Identity,maximum int,check func()error,gate executionhost.PayloadGate)(*relay.Engine,error){if gate!=gateFixture{panic("Relay payload gate identity changed")};traceFixture=append(traceFixture,"prepare-multihop");if !reflect.DeepEqual(a,inputAssignmentFixture)||!reflect.DeepEqual(identity,inputIdentityFixture)||maximum!=4096||check()!=failureFixture{panic("multihop native input/maximum/check changed")};if failureStageFixture=="prepare"{return engineFixture,failureFixture};return engineFixture,nil}
func finishRelayFixture(engine *relay.Engine,phase string)(executiondriver.Instance,error){traceFixture=append(traceFixture,"finish:"+phase);if engine!=engineFixture||phase!=inputAssignmentFixture.Phase{panic("native finish engine or original phase changed")};if failureStageFixture=="finish"{return nil,failureFixture};return engine,nil}
func TestOriginalDirectAssignmentPolicyAndEngineOrder(t *testing.T){for _,metered:=range []bool{false,true}{for _,mode:=range []string{"assignment-first","policy","tcp","udp","unsupported"}{traceFixture=nil;failureStageFixture=mode;target:=adp3.Target{Host:"127.0.0.1",Port:99};revision:=uint64(3);metadata:=false;cidrs:=[]string{"127.0.0.0/8"};a:=adp3.Assignment{AssignmentId:"assignment",ForwardId:"forward",ForwardRevision:2,DeploymentGeneration:3,BindingFence:4,Role:"direct",Protocol:"tcp",Phase:"active",Resource:adp3.Resource{Address:"127.0.0.1",Port:1234,Protocol:"tcp"},Driver:adp3.Driver{Id:"native.direct.v1",SchemaVersion:1,ConfigDigest:"digest",Config:adp3.RuntimeConfig{Target:&target,EgressPolicyRevision:&revision,AllowMetadataTargets:&metadata,AllowedDestinationCidrs:&cidrs}},DrainTimeoutSeconds:7};if mode=="assignment-first"{a.Role="invalid";failureStageFixture="policy"};if mode=="udp"{a.Protocol="udp";a.Resource.Protocol="udp"};if mode=="unsupported"{a.Protocol="sctp";a.Resource.Protocol="sctp"};p:=adp3.Policy{ConnectTimeoutSeconds:7,UdpIdleTimeoutSeconds:11,MaxTcpConnectionsPerAssignment:13,MaxUdpSessionsPerAssignment:17};checks:=0;check:=func()error{checks++;return failureFixture};gateFixture=nil;var instance executiondriver.Instance;var err error;if metered{gateFixture=&payloadFixture{};instance,err=StartDirectMetered(a,p,check,gateFixture)}else{instance,err=StartDirect(a,p,check)};want:=[]string{"assignment","policy"};switch mode{case "assignment-first":want=[]string{"assignment"};if err==nil||err.Error()!="UNSUPPORTED_CAPABILITY"||instance!=nil{t.Fatal("direct assignment refused after policy",err)};case "policy":if err!=failureFixture||instance!=nil{t.Fatal("policy failure identity",err)};case "tcp","udp":want=append(want,a.Protocol);if instance!=directStreamFixture||err!=failureFixture||checks!=1{t.Fatal("native engine partial result/check changed",mode,instance,err,checks)};default:if err==nil||err.Error()!="UNSUPPORTED_CAPABILITY"||instance!=nil{t.Fatal("unsupported dispatch error",err)}};if !reflect.DeepEqual(traceFixture,want){t.Fatal(mode,"direct stage order",traceFixture,want)};if mode=="tcp"||mode=="udp"{if directFixture.AssignmentId!=a.AssignmentId||directFixture.DeploymentGeneration!=a.DeploymentGeneration||directFixture.BindingFence!=a.BindingFence||directFixture.Driver.Config.Target.Host!=target.Host||directFixture.Driver.Config.Target.Port!=target.Port||directFixture.Listener.Address!=a.Resource.Address||directFixture.DrainTimeoutSeconds!=a.DrainTimeoutSeconds||policyFixture.ConnectTimeoutSeconds!=7||policyFixture.MaxTcpConnectionsPerAssignment!=13||policyFixture.MaxUdpSessionsPerAssignment!=17{t.Fatal("native direct conversion lost original values")}}}}}
func relayBaselineFixture(t *testing.T)(executiondriver.Host,adp3.Assignment){t.Helper();raw,err:=os.ReadFile("relay-fixtures.json");if err!=nil{t.Fatal(err)};var fixture struct{Cases []struct{Name,Schema,Raw string;Valid bool}};if err:=json.Unmarshal(raw,&fixture);err!=nil{t.Fatal(err)};for _,sample:=range fixture.Cases{if sample.Name!="assignment-structure"||!sample.Valid{continue};var strict adp3relay.Assignment;if err:=adp3relay.Parse("Assignment",[]byte(sample.Raw),&strict);err!=nil{t.Fatal("actual strict Relay baseline",err)};var assignment adp3.Assignment;if err:=json.Unmarshal([]byte(sample.Raw),&assignment);err!=nil{t.Fatal(err)};host:=executiondriver.Host{NodeID:strict.NodeId,SessionEpoch:strict.SessionEpoch,Policy:adp3.Policy{MaxTcpConnectionsPerAssignment:5000,MaxUdpSessionsPerAssignment:6000}};return host,assignment};t.Fatal("native Relay baseline absent");return executiondriver.Host{},adp3.Assignment{}}
func TestOriginalRelayPeerBeforeStrictPreparedAssignmentAndPrepare(t *testing.T){for _,mode:=range []string{"peer-first","strict","prepare","finish","active","draining","prepared"}{host,a:=relayBaselineFixture(t);gateFixture=&payloadFixture{};host.Payload=gateFixture;traceFixture=nil;failureStageFixture=mode;engineFixture=&relay.Engine{};inputIdentityFixture=relay.Identity{};host.PeerIdentity=func()(relay.Identity,time.Time,error){traceFixture=append(traceFixture,"peer");if mode=="peer-first"{return inputIdentityFixture,time.Time{},failureFixture};return inputIdentityFixture,time.Unix(123,0),nil};if mode=="peer-first"||mode=="strict"{a.Role="invalid"}else if mode=="active"||mode=="draining"||mode=="prepared"{a.Phase=mode};inputAssignmentFixture=a;instance,err:=StartRelay(host,a,func()error{return failureFixture});want:=[]string{"peer","assignment","prepare"};switch mode{case "peer-first":want=[]string{"peer"};if err!=failureFixture||instance!=nil{t.Fatal("peer failure lost precedence",err)};case "strict":want=[]string{"peer","assignment"};if err==nil||instance!=nil{t.Fatal("strict assignment failure reached Prepare")};case "prepare":if err!=failureFixture||instance!=nil{t.Fatal("Prepare partial result/error changed",err)};case "finish":want=append(want,"finish:"+a.Phase);if err!=failureFixture||instance!=nil{t.Fatal("finish failure identity",err)};default:want=append(want,"finish:"+a.Phase);if err!=nil||instance!=engineFixture{t.Fatal("successful native engine pointer changed",err)}};if !reflect.DeepEqual(traceFixture,want){t.Fatal("Relay stage order",mode,traceFixture,want)}}}
func TestOriginalMultihopPeerThenOriginalAssignmentMaximumAndPhase(t *testing.T){for _,mode:=range []string{"peer","prepare","finish","success"}{traceFixture=nil;failureStageFixture=mode;engineFixture=&relay.Engine{};inputIdentityFixture=relay.Identity{};a:=adp3.Assignment{AssignmentId:"native-multihop",Role:"multihop-transit",Protocol:"udp",Phase:"active"};inputAssignmentFixture=a;gateFixture=&payloadFixture{};host:=executiondriver.Host{Payload:gateFixture,Policy:adp3.Policy{MaxTcpConnectionsPerAssignment:1,MaxUdpSessionsPerAssignment:6000},PeerIdentity:func()(relay.Identity,time.Time,error){traceFixture=append(traceFixture,"peer");if mode=="peer"{return inputIdentityFixture,time.Time{},failureFixture};return inputIdentityFixture,time.Time{},nil}};instance,err:=StartMultihop(host,a,func()error{return failureFixture});want:=[]string{"peer"};if mode!="peer"{want=append(want,"prepare-multihop")};if mode=="finish"||mode=="success"{want=append(want,"finish:active")};if !reflect.DeepEqual(traceFixture,want)||(mode=="success"&&(err!=nil||instance!=engineFixture))||(mode!="success"&&(err!=failureFixture||instance!=nil)){t.Fatal("multihop native peer/Prepare/finish order",mode,traceFixture,instance,err)}}}
`

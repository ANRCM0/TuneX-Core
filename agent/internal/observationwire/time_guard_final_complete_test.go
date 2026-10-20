package observationwire

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
	"strconv"
	"testing"
	"time"
)

func TestNativeAckFinalProcessSuffixAndOtherRegexTimeBoundaries(t *testing.T) {
	fixtures := nativeWireFixtures(t)
	var process TelemetrySample
	var host HostTelemetrySample
	var forward ForwardTelemetrySample
	var probe ProbeTelemetrySample
	decodeNativeFixture(t, fixtures["process"], &process)
	decodeNativeFixture(t, fixtures["host"], &host)
	decodeNativeFixture(t, fixtures["forward"], &forward)
	decodeNativeFixture(t, fixtures["probe"], &probe)
	for _, family := range []struct {
		name, version string
		points        bool
		check         func([]byte) error
	}{
		{"telemetry", "telemetryVersion", false, func(raw []byte) error { return CheckTelemetryAck(process, raw) }},
		{"host-telemetry", "hostTelemetryVersion", false, func(raw []byte) error { return CheckHostTelemetryAck(host, raw) }},
		{"forward-telemetry", "forwardTelemetryVersion", true, func(raw []byte) error { return CheckForwardTelemetryAck(forward, raw) }},
		{"probe-telemetry", "probeTelemetryVersion", true, func(raw []byte) error { return CheckProbeTelemetryAck(probe, raw, ProbeTelemetryLimits{32, 2, 8}) }},
	} {
		for _, stamp := range []struct {
			text           string
			process, other bool
		}{
			{"1970-01-01T00:00:00Z", true, true}, {"1970-01-01T00:00:00.0Z", true, true},
			{"1970-01-01T00:00:00.000000001Z", true, true}, {"1969-12-31T23:59:59.999999999Z", false, false},
			{"2026-10-20T00:00:00,1Z", true, false}, {"2026-10-20T00:00:00.1234567890Z", true, false},
			{"2026-10-20T00:00:00.Z", false, false}, {"2026-10-20T00:00:00+00:00", false, false},
			{"2026-10-20T00:00:00z", false, false}, {"2026-02-30T00:00:00Z", false, false},
		} {
			ack := map[string]any{family.version: 1, "kind": family.name + "-ack", "nodeId": "node-1", "bootId": "boot-1", "sessionEpoch": 1,
				"sampleEpoch": process.SampleEpoch, "sequence": 1, "stored": true, "receivedAt": stamp.text, "source": "agent-reported", "executionAuthorized": false}
			if family.points {
				ack["acceptedPoints"], ack["rejectedPoints"] = 1, 0
			}
			raw, err := json.Marshal(ack)
			if err != nil {
				t.Fatal(err)
			}
			want := stamp.other
			if family.name == "telemetry" {
				want = stamp.process
			}
			if err := family.check(raw); (err == nil) != want {
				t.Fatalf("%s %q accepted=%v want=%v error=%v", family.name, stamp.text, err == nil, want, err)
			}
		}
	}
}

func TestNativeObservationFinalScalarAndTimeProjectionBoundaries(t *testing.T) {
	if Uint64Text(^uint64(0)) != "18446744073709551615" || EpochText([]byte{0, 1, 15, 16, 127, 128, 255}) != "00010f107f80ff" || EpochText(nil) != "" {
		t.Fatal("native unsigned or lowercase hex projection")
	}
	negative, zero, maximum := int64(-1), int64(0), int64(9223372036854775807)
	if OptionalCounter(nil) != nil || OptionalCounter(&negative) != nil {
		t.Fatal("unknown or negative counter became measured")
	}
	for _, value := range []*int64{&zero, &maximum} {
		encoded := OptionalCounter(value)
		if encoded == nil || *encoded != strconv.FormatInt(*value, 10) {
			t.Fatal("optional signed counter", encoded)
		}
		before := *encoded
		*value = -1
		if *encoded != before {
			t.Fatal("optional counter retained source pointer")
		}
	}
	for _, value := range []time.Time{time.Time{}, time.Unix(0, 0), time.Unix(-1, 999999999), time.Date(2026, 10, 20, 1, 2, 3, 123456789, time.FixedZone("native", -5*3600-30*60))} {
		if TimeText(value) != value.Format(time.RFC3339Nano) || UTCTimeText(value) != value.UTC().Format(time.RFC3339Nano) {
			t.Fatal("plain versus UTC timestamp changed", value)
		}
	}
}

// The old literal ACK suite already covers the four value inventories. This
// supplement executes the original four bodies with only their three effects
// rebound, so simultaneous failures pin the refusal order and retained errors.
func TestNativeAckFinalOriginalFourBodiesKeepFirstFailureAndEffectOrder(t *testing.T) {
	set := token.NewFileSet()
	var body bytes.Buffer
	total := 0
	families := []struct {
		file, name, version string
		points              bool
	}{
		{"telemetry.go", "CheckTelemetryAck", "telemetryVersion", false}, {"host_telemetry.go", "CheckHostTelemetryAck", "hostTelemetryVersion", false},
		{"forward_telemetry.go", "CheckForwardTelemetryAck", "forwardTelemetryVersion", true}, {"probe_telemetry.go", "CheckProbeTelemetryAck", "probeTelemetryVersion", true},
	}
	for _, family := range families {
		file, err := parser.ParseFile(set, family.file, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, declaration := range file.Decls {
			function, ok := declaration.(*ast.FuncDecl)
			if !ok || function.Name.Name != family.name {
				continue
			}
			found = true
			missing := []string{}
			effects := map[string]int{}
			ast.Inspect(function, func(node ast.Node) bool {
				if loop, ok := node.(*ast.RangeStmt); ok {
					if values, ok := loop.X.(*ast.CompositeLit); ok {
						for _, element := range values.Elts {
							literal, ok := element.(*ast.BasicLit)
							if !ok {
								t.Fatal("ACK missing-key inventory is no longer literal")
							}
							value, err := strconv.Unquote(literal.Value)
							if err != nil {
								t.Fatal(err)
							}
							missing = append(missing, value)
						}
					}
				}
				call, ok := node.(*ast.CallExpr)
				if !ok {
					return true
				}
				selector, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				namespace, ok := selector.X.(*ast.Ident)
				if !ok {
					return true
				}
				key := namespace.Name + "." + selector.Sel.Name
				replacement := map[string]string{"contracts.ParseJSON": "parseJSONFixture", "json.Unmarshal": "unmarshalFixture", "time.Parse": "parseTimeFixture"}[key]
				if replacement != "" {
					call.Fun = ast.NewIdent(replacement)
					effects[key]++
				}
				return true
			})
			want := []string{family.version, "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "stored", "receivedAt", "source", "executionAuthorized"}
			if family.points {
				want = []string{family.version, "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "receivedAt", "stored", "acceptedPoints", "rejectedPoints", "source", "executionAuthorized"}
			}
			if !reflect.DeepEqual(missing, want) || !reflect.DeepEqual(effects, map[string]int{"contracts.ParseJSON": 1, "json.Unmarshal": 2, "time.Parse": 1}) {
				t.Fatal("ACK ordered required fields/effect inventory changed", family.name, missing, effects)
			}
			if err := format.Node(&body, set, function); err != nil {
				t.Fatal(err)
			}
			body.WriteByte('\n')
			total++
		}
		if !found {
			t.Fatal("original ACK owner missing", family.name)
		}
	}
	if total != 4 {
		t.Fatal("four original ACK bodies required", total)
	}
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/ackfinalfixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": append([]byte(ackFinalOriginalHeader), body.Bytes()...), "effects_test.go": []byte(ackFinalEffectsFixture)} {
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
		t.Fatalf("original four ACK stage order: %v\n%s", err, output)
	}
}

const ackFinalOriginalHeader = `package observationwire
import("bytes";"encoding/json";"fmt";"regexp";"strings";"time";ow "github.com/tunex/vnext/agent/internal/observationwire")
type TelemetrySample=ow.TelemetrySample
type HostTelemetrySample=ow.HostTelemetrySample
type ForwardTelemetrySample=ow.ForwardTelemetrySample
type ProbeTelemetrySample=ow.ProbeTelemetrySample
type ProbeTelemetryLimits=ow.ProbeTelemetryLimits
const ForwardTelemetryLimit=ow.ForwardTelemetryLimit
var hostTelemetryTimestamp=regexp.MustCompile("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,9})?Z$")
var forwardTelemetryTimestamp=hostTelemetryTimestamp
var probeTelemetryTimestamp=hostTelemetryTimestamp
`

const ackFinalEffectsFixture = `package observationwire
import("encoding/json";"errors";"reflect";"testing";"time";"github.com/tunex/vnext/agent/internal/contracts";ow "github.com/tunex/vnext/agent/internal/observationwire")
var traceFixture []string
var failFixture string
var sentinelFixture=errors.New("native ACK injected effect identity")
func parseJSONFixture(body []byte,limit int)(any,error){traceFixture=append(traceFixture,"json");if limit!=4096{panic("original ACK byte limit changed")};if failFixture=="json"{return nil,sentinelFixture};return contracts.ParseJSON(body,limit)}
func unmarshalFixture(body []byte,target any)error{stage:="decode";if reflect.TypeOf(target).Elem().Kind()==reflect.Map{stage="fields"};traceFixture=append(traceFixture,stage);if failFixture==stage{return sentinelFixture};return json.Unmarshal(body,target)}
func parseTimeFixture(layout,value string)(time.Time,error){traceFixture=append(traceFixture,"time");if layout!=time.RFC3339Nano{panic("ACK native parse format changed")};if failFixture=="time"{return time.Time{},sentinelFixture};return time.Parse(layout,value)}
func TestOriginalFourAckStageOrder(t *testing.T){
 process:=TelemetrySample{NodeID:"node",BootID:"boot",SessionEpoch:1,SampleEpoch:"epoch",Sequence:1};host:=HostTelemetrySample{NodeID:"node",BootID:"boot",SessionEpoch:1,SampleEpoch:"epoch",Sequence:1};forward:=ForwardTelemetrySample{NodeID:"node",BootID:"boot",SessionEpoch:1,SampleEpoch:"epoch",Sequence:1,Items:make([]ow.ForwardCounterPoint,1)};probe:=ProbeTelemetrySample{NodeID:"node",BootID:"boot",SessionEpoch:1,SampleEpoch:"epoch",Sequence:1,Items:make([]ow.ProbeCounterPoint,1)}
 for _,family:=range []struct{version,kind,label string;points bool;check func([]byte)error}{
 {"telemetryVersion","telemetry-ack","Telemetry",false,func(b []byte)error{return CheckTelemetryAck(process,b)}},
 {"hostTelemetryVersion","host-telemetry-ack","Host telemetry",false,func(b []byte)error{return CheckHostTelemetryAck(host,b)}},
 {"forwardTelemetryVersion","forward-telemetry-ack","Forward telemetry",true,func(b []byte)error{return CheckForwardTelemetryAck(forward,b)}},
 {"probeTelemetryVersion","probe-telemetry-ack","Probe telemetry",true,func(b []byte)error{return CheckProbeTelemetryAck(probe,b,ProbeTelemetryLimits{32,2,8})}},
 }{t.Run(family.kind,func(t *testing.T){
  base:=func()map[string]any{ack:=map[string]any{family.version:1,"kind":family.kind,"nodeId":"node","bootId":"boot","sessionEpoch":1,"sampleEpoch":"epoch","sequence":1,"stored":true,"receivedAt":"1970-01-01T00:00:00Z","source":"agent-reported","executionAuthorized":false};if family.points{ack["acceptedPoints"],ack["rejectedPoints"]=1,0};return ack}
  exercise:=func(name,fail string,mutate func(map[string]any),stages []string,text string,identity bool){t.Helper();ack:=base();if mutate!=nil{mutate(ack)};raw,err:=json.Marshal(ack);if err!=nil{t.Fatal(err)};traceFixture=nil;failFixture=fail;err=family.check(raw);failFixture="";if !reflect.DeepEqual(traceFixture,stages){t.Fatal(name,"effect order",traceFixture,stages)};if identity{if err!=sentinelFixture{t.Fatal(name,"effect error identity",err)}}else if text==""{if err!=nil{t.Fatal(name,err)}}else if err==nil||err.Error()!=family.label+" "+text{t.Fatal(name,"first refusal",err)}}
  all:=[]string{"json","fields","decode","time"};fields:=[]string{"json","fields"}
  exercise("parse identity","json",func(a map[string]any){a["extra"]=nil},[]string{"json"},"",true)
  exercise("field decoder refusal","fields",nil,fields,"ACK fields rejected",false)
  exercise("count before missing and decode","",func(a map[string]any){a["extra"]=true;a["kind"]=nil;a["sequence"]=[]int{}},fields,"ACK fields rejected",false)
  exercise("missing before decode","",func(a map[string]any){a["kind"]=nil;a["sequence"]=[]int{}},fields,"ACK field missing",false)
  exercise("decode identity","decode",nil,[]string{"json","fields","decode"},"",true)
  exercise("time parsed before bad correlation","",func(a map[string]any){a["nodeId"]="wrong"},all,"ACK identity or provenance rejected",false)
  exercise("parse failure folded to provenance","time",nil,all,"ACK identity or provenance rejected",false)
  exercise("valid","",nil,all,"",false)
  traceFixture=nil;raw:=[]byte("{invalid");_,expected:=contracts.ParseJSON(raw,4096);err:=family.check(raw);if expected==nil||err==nil||err.Error()!=expected.Error()||!reflect.DeepEqual(traceFixture,[]string{"json"}){t.Fatal("native I-JSON refusal did not short circuit",err,traceFixture)}
  ack:=base();ack["sequence"]=[]int{};raw,_=json.Marshal(ack);traceFixture=nil;err=family.check(raw);var typeError *json.UnmarshalTypeError;if !errors.As(err,&typeError)||!reflect.DeepEqual(traceFixture,[]string{"json","fields","decode"}){t.Fatal("native decode error erased or parsed time",err,traceFixture)}
  if family.points{exercise("balanced rejected points","",func(a map[string]any){a["acceptedPoints"]=0;a["rejectedPoints"]=1},all,"points rejected",false);exercise("sum before rejected points","",func(a map[string]any){a["rejectedPoints"]=1},all,"ACK identity or provenance rejected",false)}
 })}
}
`

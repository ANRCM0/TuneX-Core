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
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

// Exercise the unreachable-in-test-time counter boundary by changing only the
// original local state entry. The four current loop decisions are compiled from
// source, with their measurement/HTTP collaborators represented by counting ports.
func TestTelemetryCompleteOriginalExporterSequenceExhaustion(t *testing.T) {
	set := token.NewFileSet()
	file := &ast.File{Name: ast.NewIdent("control"), Decls: []ast.Decl{&ast.GenDecl{Tok: token.IMPORT, Specs: []ast.Spec{&ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: `"context"`}}, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: `"time"`}}}}}}
	seeds, guards := 0, 0
	for path, owner := range map[string]string{"telemetry.go": "maintainTelemetry", "host_telemetry.go": "maintainHostTelemetry", "forward_telemetry.go": "maintainForwardTelemetry", "probe_telemetry.go": "maintainProbeTelemetry"} {
		original, err := parser.ParseFile(set, path, nil, 0); if err != nil { t.Fatal(err) }
		found := 0
		for _, declaration := range original.Decls {
			function, ok := declaration.(*ast.FuncDecl); if !ok || function.Name.Name != owner { continue }; found++
			ast.Inspect(function, func(node ast.Node) bool {
				if assignment, ok := node.(*ast.AssignStmt); ok && assignment.Tok == token.DEFINE && len(assignment.Lhs) == 2 && len(assignment.Rhs) == 2 {
					left, leftOK := assignment.Lhs[0].(*ast.Ident); right, rightOK := assignment.Lhs[1].(*ast.Ident)
					if leftOK && rightOK && left.Name == "sequence" && right.Name == "dropped" { assignment.Rhs[0] = ast.NewIdent("initialSequenceFixture"); seeds++ }
				}
				if binary, ok := node.(*ast.BinaryExpr); ok { if selector, ok := binary.Y.(*ast.SelectorExpr); ok { if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "contracts" && selector.Sel.Name == "MaxCounter" { binary.Y = ast.NewIdent("maxCounterFixture"); guards++ } } }
				if call, ok := node.(*ast.CallExpr); ok { if selector, ok := call.Fun.(*ast.SelectorExpr); ok { if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "observationwire" { switch selector.Sel.Name { case "EpochText": call.Fun = ast.NewIdent("epochTextFixture"); case "Uint64Text": call.Fun = ast.NewIdent("uint64TextFixture") } } } }
				return true
			}); file.Decls = append(file.Decls, function)
		}
		if found != 1 { t.Fatalf("exporter owner %s not found exactly once", owner) }
	}
	if seeds != 4 || guards != 4 { t.Fatalf("exporter state/guard source changed: %d %d", seeds, guards) }
	var source bytes.Buffer; if err := format.Node(&source, set, file); err != nil { t.Fatal(err) }
	root := t.TempDir()
	// Imports must precede declarations in the separate fixture file.
	harness := "package control\n"+telemetrySequenceCompleteImports+fmt.Sprintf("const maxCounterFixture uint64 = %d\n", contracts.MaxCounter)+telemetrySequenceCompleteFixture
	for name, raw := range map[string][]byte{"go.mod": []byte("module telemetry-sequence-effects\n\ngo 1.26.3\n"), "original.go": source.Bytes(), "effects_test.go": []byte(harness)} { if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil { t.Fatal(err) } }
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second); defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", "."); command.Dir = root; command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil { t.Fatalf("original exporter sequence boundary: %v\n%s", err, output) }
}

const telemetrySequenceCompleteImports = `import("context";"encoding/hex";"net/http";"strconv";"testing";"time")
`
const telemetrySequenceCompleteFixture = `
var initialSequenceFixture uint64
const forwardTelemetryLimit=32
type hostResources struct{}
type sampleFixture struct {
 ForwardTelemetryVersion,ProbeTelemetryVersion int
 Kind,NodeID,BootID,SampleEpoch,CapturedAt,DroppedSamples string
 SessionEpoch,Sequence,SnapshotGeneration uint64
 UptimeMs int64
 Coverage struct{}
 Items []int
}
type forwardTelemetrySample=sampleFixture
type probeTelemetrySample=sampleFixture
type pageFixture struct {nodeID,bootID,node,boot,capturedAt,CapturedAt string;sessionEpoch,SnapshotGeneration uint64;Coverage,coverage struct{};Items,items []int}
type Runner struct {client *http.Client;options struct{URL string};schedule *scheduleFixture;entropyCalls,clones,closes,captures int;sent []uint64}
type tickerFixture struct{ticks chan time.Time;stops int}
func(t *tickerFixture)C()<-chan time.Time{return t.ticks}
func(t *tickerFixture)Stop(){t.stops++}
type timerFixture struct{ticks chan time.Time}
func(t timerFixture)C()<-chan time.Time{return t.ticks}
func(t timerFixture)Stop()bool{return true}
type scheduleFixture struct{ticker *tickerFixture}
func(s *scheduleFixture)NewTicker(d time.Duration)*tickerFixture{if d!=10*time.Second{panic("tick interval changed")};return s.ticker}
func(s *scheduleFixture)Now()time.Time{return time.Unix(1,0)}
func(s *scheduleFixture)Since(time.Time)time.Duration{return time.Second}
func(s *scheduleFixture)Until(time.Time)time.Duration{return 500*time.Millisecond}
func(s *scheduleFixture)NewTimer(time.Duration)timerFixture{return timerFixture{make(chan time.Time)}}
type auxiliaryFixture struct{runner *Runner}
func(a auxiliaryFixture)CloneTelemetry(*http.Client,string)(*http.Client,func(),bool){a.runner.clones++;return &http.Client{},func(){a.runner.closes++},true}
type entropyFixture struct{runner *Runner}
func(e entropyFixture)ReadRandom(raw []byte)(int,error){if len(raw)!=16{panic("epoch size")};e.runner.entropyCalls++;return len(raw),nil}
type observationFixture struct{}
func(observationFixture)Host()hostResources{return hostResources{}}
func(r *Runner)scheduler()*scheduleFixture{return r.schedule}
func(r *Runner)auxiliary()auxiliaryFixture{return auxiliaryFixture{r}}
func(r *Runner)entropy()entropyFixture{return entropyFixture{r}}
func(r *Runner)observer()observationFixture{return observationFixture{}}
func(r *Runner)captureTelemetry(_ time.Time,_ string,sequence,dropped uint64)sampleFixture{r.captures++;return sampleFixture{Sequence:sequence}}
func(r *Runner)captureHostTelemetry(_ time.Time,_ string,sequence,dropped uint64,_ hostResources)sampleFixture{r.captures++;return sampleFixture{Sequence:sequence}}
func(r *Runner)captureForwardCounterPage(bool,int)pageFixture{r.captures++;return pageFixture{}}
func(r *Runner)captureProbeCounterPage()pageFixture{r.captures++;return pageFixture{}}
func sendTelemetryWith(_ context.Context,_ *http.Client,_ string,s sampleFixture,_ *scheduleFixture,a auxiliaryFixture)error{a.runner.sent=append(a.runner.sent,s.Sequence);return nil}
func sendHostTelemetryWith(ctx context.Context,c *http.Client,url string,s sampleFixture,e *scheduleFixture,a auxiliaryFixture)error{return sendTelemetryWith(ctx,c,url,s,e,a)}
func sendForwardTelemetryWith(ctx context.Context,c *http.Client,url string,s sampleFixture,e *scheduleFixture,a auxiliaryFixture)error{return sendTelemetryWith(ctx,c,url,s,e,a)}
func sendProbeTelemetryWith(ctx context.Context,c *http.Client,url string,s sampleFixture,e *scheduleFixture,a auxiliaryFixture)error{return sendTelemetryWith(ctx,c,url,s,e,a)}
func dropHostTelemetrySample(*uint64){panic("unexpected host drop")}
func incrementForwardCounter(*uint64){panic("unexpected forward drop")}
func addProbeCounterLoss(*uint64,uint64){panic("unexpected probe drop")}
func epochTextFixture(raw []byte)string{return hex.EncodeToString(raw)}
func uint64TextFixture(value uint64)string{return strconv.FormatUint(value,10)}
func TestOriginalFourSequenceBounds(t *testing.T){
 for _,owner:=range []string{"process","host","forward","probe"}{for _,seed:=range []uint64{maxCounterFixture-1,maxCounterFixture}{
  initialSequenceFixture=seed;ticker:=&tickerFixture{ticks:make(chan time.Time,2)};ticker.ticks<-time.Unix(2,0);ticker.ticks<-time.Unix(3,0)
  runner:=&Runner{schedule:&scheduleFixture{ticker:ticker}}
  switch owner{case "process":runner.maintainTelemetry(context.Background(),time.Time{});case "host":runner.maintainHostTelemetry(context.Background(),time.Time{});case "forward":runner.maintainForwardTelemetry(context.Background(),time.Time{});case "probe":runner.maintainProbeTelemetry(context.Background(),time.Time{})}
  want:=0;if seed<maxCounterFixture{want=1}
  if runner.captures!=want||len(runner.sent)!=want||want==1&&runner.sent[0]!=maxCounterFixture||runner.entropyCalls!=1||runner.clones!=1||runner.closes!=1||ticker.stops!=1{t.Fatalf("%s seed%d captures%d sent%v entropy%d pool%d/%d stops%d",owner,seed,runner.captures,runner.sent,runner.entropyCalls,runner.clones,runner.closes,ticker.stops)}
 }}
}
`

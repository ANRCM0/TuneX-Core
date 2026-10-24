package agentcommand

import (
	"bytes"
	"context"
	"errors"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"syscall"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/agentcli"
	"github.com/tunex/vnext/agent/internal/control"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
)

type cliCompletePlatform struct {
	agentcli.Native
	events             []string
	paths              agentcli.Paths
	pathErr, enrollErr error
	trusted            bool
	trustedURLs        []string
	supplied           enrollmentOptionsComplete
	runContext         context.Context
	released           bool
}
type enrollmentOptionsComplete = executionenrollment.Options

func (p *cliCompletePlatform) TrustedControlURL(url string) bool {
	p.events = append(p.events, "url")
	p.trustedURLs = append(p.trustedURLs, url)
	return p.trusted
}
func (p *cliCompletePlatform) ResolvePaths(directory, key, proof, proofKey string) (agentcli.Paths, error) {
	p.events = append(p.events, "paths:"+directory+":"+key+":"+proof+":"+proofKey)
	return p.paths, p.pathErr
}
func (p *cliCompletePlatform) InspectJournal(journal, key, node string) error {
	p.events = append(p.events, "inspect:"+journal+":"+key+":"+node)
	return nil
}
func (p *cliCompletePlatform) Enroll(options executionenrollment.Options) error {
	p.events = append(p.events, "enroll")
	p.supplied = options
	return p.enrollErr
}
func (p *cliCompletePlatform) AcquireInstance(root string) (func(), error) {
	p.events = append(p.events, "lock:"+root)
	return func() {
		if p.runContext != nil && p.runContext.Err() != context.Canceled {
			panic("lock released before native signal context cancellation")
		}
		p.released = true
		p.events = append(p.events, "release")
	}, nil
}
func (p *cliCompletePlatform) BootID() (string, error) {
	p.events = append(p.events, "boot")
	return "one-boot", nil
}
func (p *cliCompletePlatform) DiagnosticsPath(root string) string {
	p.events = append(p.events, "diagnostics:"+root)
	return "native-diagnostics"
}
func (p *cliCompletePlatform) RunWithSignals(run func(context.Context) error) error {
	p.events = append(p.events, "signals")
	return p.Native.RunWithSignals(func(ctx context.Context) error {
		p.runContext = ctx
		p.events = append(p.events, "run")
		return run(ctx)
	})
}

type cliCompleteRunner func(context.Context) error

func (r cliCompleteRunner) Run(ctx context.Context) error { return r(ctx) }

type cliCompleteNilRunner struct{}

func (*cliCompleteNilRunner) Run(context.Context) error {
	panic("typed nil Runner method used after construction error")
}
func cliCompleteOptions() agentcli.Options {
	return agentcli.Options{URL: "https://control/path", NodeID: "node", CA: "configured-ca", Directory: "relative-state", JournalKey: "relative-key"}
}
func cliCompleteHost(p *cliCompletePlatform, construct func(control.Options) (Runner, error)) Host {
	return Host{Platform: p, NewRunner: construct}
}

func TestAgentCLICompleteEveryRunnerOptionAndNativeCancelBeforeLockRelease(t *testing.T) {
	if InterfaceVersion != 2 || agentcli.InterfaceVersion != 2 {
		t.Fatal("existing command/native public interface versions changed")
	}
	for _, enabled := range []bool{false, true} {
		options := cliCompleteOptions()
		options.Rotate = enabled
		options.Relay = enabled
		options.Multihop = enabled
		options.ProbeRegistration = enabled
		options.ProbeExecution = enabled
		options.ProbeIngress = enabled
		options.ProbeServices = enabled
		options.ProbeEcho = enabled
        options.ProbePathEcho = enabled
		options.Diagnostics = enabled
		options.Telemetry = enabled
		options.ForwardTelemetry = enabled
		options.HostTelemetry = enabled
		options.ProbeTelemetry = enabled
		if enabled {
			options.ImportTransitJournal = "raw/../transit"
			options.TimeProof = "raw-proof"
			options.TimeProofKey = "raw-proof-key"
		}
		p := &cliCompletePlatform{trusted: true, paths: agentcli.Paths{Root: "resolved-root", KeyPath: "resolved-key", Certificate: "resolved-cert", PrivateKey: "resolved-private", Journal: "resolved-journal"}}
		failure := errors.New("original runner failure")
		var captured control.Options
		host := cliCompleteHost(p, func(value control.Options) (Runner, error) {
			p.events = append(p.events, "construct")
			captured = value
			return cliCompleteRunner(func(ctx context.Context) error {
				if ctx != p.runContext || ctx.Err() != nil {
					t.Fatal("wrong/already cancelled native context")
				}
				return failure
			}), nil
		})
		if err := host.Run(options); err != failure || !p.released || p.runContext.Err() != context.Canceled {
			t.Fatalf("original Run error/cancellation %v %v", err, p.events)
		}
		diagnostics := ""
		if enabled {
			diagnostics = "native-diagnostics"
		}
		want := control.Options{URL: options.URL, NodeID: options.NodeID, BootID: "one-boot", CA: options.CA, Certificate: "resolved-cert", PrivateKey: "resolved-private", Journal: "resolved-journal", JournalKey: "resolved-key", Rotate: enabled, Relay: enabled, Multihop: enabled, ProbeRegistration: enabled, ProbeExecution: enabled, ProbeIngress: enabled, ProbeServices: enabled, ProbeEcho: enabled, ProbePathEcho: enabled, ImportTransitJournal: options.ImportTransitJournal, TimeProof: options.TimeProof, TimeProofKey: options.TimeProofKey, Diagnostics: diagnostics, Telemetry: enabled, ForwardTelemetry: enabled, HostTelemetry: enabled, ProbeTelemetry: enabled}
		if !reflect.DeepEqual(captured, want) {
			t.Fatalf("complete original Runner projection got %#v want %#v", captured, want)
		}
		wantEvents := []string{"url", "paths:" + options.Directory + ":" + options.JournalKey + ":" + options.TimeProof + ":" + options.TimeProofKey, "lock:resolved-root", "boot"}
		if enabled {
			wantEvents = append(wantEvents, "diagnostics:resolved-root")
		}
		wantEvents = append(wantEvents, "construct", "signals", "run", "release")
		if !reflect.DeepEqual(p.events, wantEvents) {
			t.Fatal(p.events, wantEvents)
		}
	}
}

func TestAgentCLICompleteModeAndCompetingFirstRefusalOrder(t *testing.T) {
	for _, stage := range []string{"echo", "services", "inspection", "proof", "node", "directory", "key", "url", "ca", "prefix"} {
		p := &cliCompletePlatform{}
		options := agentcli.Options{InspectJournal: true, Enroll: true, Rotate: true, ProbeEcho: true, ProbeServices: true}
		switch stage {
		case "services":
			options.ProbeEcho = false
		case "inspection":
			options.ProbeEcho = false
			options.ProbeServices = false
		case "proof":
			options.ProbeEcho = false
			options.ProbeServices = false
			options.Enroll = false
			options.Rotate = false
			options.TimeProof = "unpaired"
		default:
			if stage != "echo" {
				options = cliCompleteOptions()
				switch stage {
				case "node":
					options.NodeID = ""
				case "directory":
					options.Directory = ""
				case "key":
					options.JournalKey = ""
				case "url":
					options.URL = ""
				case "ca":
					options.CA = ""
				}
			}
		}
		host := cliCompleteHost(p, func(control.Options) (Runner, error) { panic("invalid options constructed Runner") })
		err := host.Run(options)
		want := "control, node, ca, state and journal-key are required"
		switch stage {
		case "echo":
			want = "probe-echo requires probe-services, probe-ingress, probe-execution and probe-registration"
		case "services":
			want = "probe-services requires probe-ingress, probe-execution and probe-registration"
		case "inspection":
			want = "Journal inspection cannot be combined with state-changing flags"
		case "proof":
			want = "time-proof and time-proof-key must be provided together"
		}
		if err == nil || err.Error() != want {
			t.Fatal(stage, err)
		}
		wantEffects := 0
		if stage == "prefix" {
			wantEffects = 1
		}
		if len(p.events) != wantEffects || wantEffects == 1 && p.events[0] != "url" {
			t.Fatal("first refusal native effects", stage, p.events)
		}
	}
	for _, options := range []agentcli.Options{{ProbeExecution: true}, {ProbeIngress: true}, {Multihop: true}, {ImportTransitJournal: "without-multihop"}} {
		base := cliCompleteOptions()
		base.ProbeExecution = options.ProbeExecution
		base.ProbeIngress = options.ProbeIngress
		base.Multihop = options.Multihop
		base.ImportTransitJournal = options.ImportTransitJournal
		p := &cliCompletePlatform{trusted: true}
		failure := errors.New("later Runner feature refusal")
		if err := cliCompleteHost(p, func(control.Options) (Runner, error) { p.events = append(p.events, "construct"); return nil, failure }).Run(base); err != failure || !reflect.DeepEqual(p.events, []string{"url", "paths:relative-state:relative-key::", "lock:", "boot", "construct", "release"}) {
			t.Fatal("later feature gate moved before original constructor", err, p.events)
		}
	}
	options := cliCompleteOptions()
	options.Enroll = true
	options.Rotate = true
	options.Multihop = true
	options.Diagnostics = true
	options.ImportTransitJournal = "legacy"
	p := &cliCompletePlatform{trusted: true, paths: agentcli.Paths{Root: "root", KeyPath: "key", Certificate: "cert", PrivateKey: "private", Journal: "journal"}}
	failure := errors.New("native enrollment failure")
	p.enrollErr = failure
	if err := cliCompleteHost(p, nil).Run(options); err != failure || !reflect.DeepEqual(p.events, []string{"url", "paths:relative-state:relative-key::", "enroll"}) || p.supplied != (executionenrollment.Options{URL: options.URL, NodeID: options.NodeID, CA: options.CA, Root: "root", KeyPath: "key", CertificatePath: "cert", PrivatePath: "private", JournalPath: "journal"}) {
		t.Fatal("enrollment priority/projection", err, p.events, p.supplied)
	}
}

func TestAgentCLICompleteEachEchoAndServicesDependencyRefusesBeforeEffects(t *testing.T) {
	for _, family := range []string{"echo", "services"} {
		count := 3
		if family == "echo" {
			count = 4
		}
		for missing := 0; missing < count; missing++ {
			options := cliCompleteOptions()
			options.ProbeEcho = family == "echo"
			options.ProbeServices = family == "echo"
			options.ProbeIngress = true
			options.ProbeExecution = true
			options.ProbeRegistration = true
			if family == "echo" {
				switch missing {
				case 0:
					options.ProbeServices = false
				case 1:
					options.ProbeIngress = false
				case 2:
					options.ProbeExecution = false
				case 3:
					options.ProbeRegistration = false
				}
			} else {
				options.ProbeServices = true
				switch missing {
				case 0:
					options.ProbeIngress = false
				case 1:
					options.ProbeExecution = false
				case 2:
					options.ProbeRegistration = false
				}
			}
			p := &cliCompletePlatform{trusted: true}
			err := cliCompleteHost(p, nil).Run(options)
			want := "probe-services requires probe-ingress, probe-execution and probe-registration"
			if family == "echo" {
				want = "probe-echo requires probe-services, probe-ingress, probe-execution and probe-registration"
			}
			if err == nil || err.Error() != want || len(p.events) != 0 {
				t.Fatal("dependency first error/effects", family, missing, err, p.events)
			}
		}
	}
}

func TestAgentCLICompleteMissingExplicitProvidersNeverSelectNativeFallback(t *testing.T) {
	for _, mode := range []string{"platform", "constructor"} {
		p := &cliCompletePlatform{trusted: true}
		host := Host{}
		if mode == "constructor" {
			host.Platform = p
		}
		var recovered any
		func() { defer func() { recovered = recover() }(); _ = host.Run(cliCompleteOptions()) }()
		if recovered == nil {
			t.Fatal("missing explicit trusted provider acquired fallback", mode)
		}
		if mode == "platform" && len(p.events) != 0 {
			t.Fatal("missing platform used native effects")
		}
		if mode == "constructor" && (!p.released || !reflect.DeepEqual(p.events, []string{"url", "paths:relative-state:relative-key::", "lock:", "boot", "release"})) {
			t.Fatal("missing constructor changed original lock/boot/defer stage", p.events)
		}
	}
	p := &cliCompletePlatform{trusted: true}
	failure := errors.New("typed nil construction failure")
	var runner *cliCompleteNilRunner
	if err := cliCompleteHost(p, func(control.Options) (Runner, error) {
		p.events = append(p.events, "construct")
		return runner, failure
	}).Run(cliCompleteOptions()); err != failure || !p.released || !reflect.DeepEqual(p.events, []string{"url", "paths:relative-state:relative-key::", "lock:", "boot", "construct", "release"}) {
		t.Fatal("typed nil construction error reached signals or method", err, p.events)
	}
}

func TestAgentCLICompleteActualNativeInterruptAndTermination(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("native os.Process.Signal interrupt/SIGTERM delivery unavailable on Windows; POSIX Actions owns this evidence")
	}
	for _, kind := range []string{"interrupt", "term"} {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		command := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestAgentCLICompleteSignalHelper$")
		command.Env = append(os.Environ(), "TUNEX_B_AGENT_SIGNAL_HELPER="+kind)
		output, err := command.CombinedOutput()
		cancel()
		if err != nil {
			t.Fatalf("native signal %s: %v\n%s", kind, err, output)
		}
	}
}

func TestAgentCLICompleteSignalHelper(t *testing.T) {
	kind := os.Getenv("TUNEX_B_AGENT_SIGNAL_HELPER")
	if kind == "" {
		return
	}
	p := &cliCompletePlatform{trusted: true}
	failure := errors.New("same cancelled Runner error")
	host := cliCompleteHost(p, func(control.Options) (Runner, error) {
		return cliCompleteRunner(func(ctx context.Context) error {
			process, err := os.FindProcess(os.Getpid())
			if err != nil {
				return err
			}
			var signal os.Signal = os.Interrupt
			if kind == "term" {
				signal = syscall.SIGTERM
			}
			if err := process.Signal(signal); err != nil {
				return err
			}
			select {
			case <-ctx.Done():
				if ctx.Err() != context.Canceled {
					t.Fatal(ctx.Err())
				}
				return failure
			case <-time.After(5 * time.Second):
				return errors.New("native signal context not cancelled")
			}
		}), nil
	})
	if err := host.Run(cliCompleteOptions()); err != failure || !p.released || p.runContext.Err() != context.Canceled {
		t.Fatal("signal cancellation/run identity/release", err, p.events)
	}
}

// Stage the actual argument/native/main source. Calls to OS and lower owners are
// replaced only at their effect boundary; native predicates, defers, parser and
// encoding remain real. The exported Host is exercised directly above.
func TestAgentCLICompleteOriginalNativeArgumentsAndMainEffects(t *testing.T) {
	set := token.NewFileSet()
	fixture := &ast.File{Name: ast.NewIdent("agentcommand")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"context", "encoding/hex", "encoding/json", "fmt", "os", "strings", "syscall"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: `"` + path + `"`}})
	}
	fixture.Decls = append(fixture.Decls, imports)
	counts := map[string]int{}
	for _, path := range []string{"../agentcli/arguments.go", "../agentcli/native.go", "../../cmd/tunex-agent/main.go"} {
		file, err := parser.ParseFile(set, path, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		if path == "../agentcli/native.go" {
			var imports []string
			for _, item := range file.Imports {
				imports = append(imports, item.Path.Value)
			}
			want := []string{`"context"`, `"crypto/rand"`, `"encoding/hex"`, `"encoding/json"`, `"fmt"`, `"os"`, `"os/signal"`, `"path/filepath"`, `"strings"`, `"syscall"`, `"github.com/tunex/vnext/agent/internal/agentenrollment"`, `"github.com/tunex/vnext/agent/internal/authorization"`, `"github.com/tunex/vnext/agent/internal/executionenrollment"`, `"github.com/tunex/vnext/agent/internal/state"`}
			if !reflect.DeepEqual(imports, want) {
				t.Fatal("native CLI public imports changed; no product command/control implementation is allowed", imports)
			}
		}
		for _, declaration := range file.Decls {
			function, ok := declaration.(*ast.FuncDecl)
			if !ok {
				continue
			}
			counts[function.Name.Name]++
			ast.Inspect(function, func(node ast.Node) bool {
				switch value := node.(type) {
				case *ast.Field:
					if selector, ok := value.Type.(*ast.SelectorExpr); ok {
						if namespace, ok := selector.X.(*ast.Ident); ok {
							switch namespace.Name + "." + selector.Sel.Name {
							case "executionenrollment.Options":
								value.Type = ast.NewIdent("enrollmentOptionsFixture")
							case "control.Options":
								value.Type = ast.NewIdent("controlOptionsFixture")
							case "agentcommand.Runner":
								value.Type = ast.NewIdent("commandRunnerFixture")
							}
						}
					}
				case *ast.CompositeLit:
					if selector, ok := value.Type.(*ast.SelectorExpr); ok {
						if namespace, ok := selector.X.(*ast.Ident); ok {
							switch namespace.Name + "." + selector.Sel.Name {
							case "agentcli.Native":
								value.Type = ast.NewIdent("Native")
							case "agentcommand.Host":
								value.Type = ast.NewIdent("commandHostFixture")
							case "executionenrollment.Options":
								value.Type = ast.NewIdent("enrollmentOptionsFixture")
							}
						}
					}
				case *ast.CallExpr:
					if selector, ok := value.Fun.(*ast.SelectorExpr); ok {
						if namespace, ok := selector.X.(*ast.Ident); ok {
							key := namespace.Name + "." + selector.Sel.Name
							bindings := map[string]string{"flag.String": "stringFlagFixture", "flag.Bool": "boolFlagFixture", "flag.Parse": "parseFlagsFixture", "filepath.Abs": "absFixture", "filepath.Rel": "relFixture", "filepath.Join": "joinFixture", "authorization.ValidateProofBoundary": "proofFixture", "os.ReadFile": "readFileFixture", "state.InspectRuntimeJournal": "inspectFixture", "os.Getenv": "getenvFixture", "agentenrollment.Native": "enrollmentHostFixture", "fmt.Println": "printlnFixture", "state.AcquireLock": "lockFixture", "rand.Read": "entropyFixture", "signal.NotifyContext": "notifyFixture", "os.Exit": "exitFixture", "agentcli.ParseOptions": "ParseOptions", "control.New": "newRunnerFixture"}
							if replacement, ok := bindings[key]; ok {
								value.Fun = ast.NewIdent(replacement)
							}
						}
					}
					for index, arg := range value.Args {
						if selector, ok := arg.(*ast.SelectorExpr); ok {
							if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "os" {
								switch selector.Sel.Name {
								case "Stdout":
									value.Args[index] = ast.NewIdent("stdoutFixture")
								case "Stderr":
									value.Args[index] = ast.NewIdent("stderrFixture")
								}
							}
						}
					}
				}
				return true
			})
			fixture.Decls = append(fixture.Decls, function)
		}
	}
	for _, owner := range []string{"ParseOptions", "TrustedControlURL", "ResolvePaths", "InspectJournal", "Enroll", "AcquireInstance", "BootID", "DiagnosticsPath", "RunWithSignals", "main", "run", "enrollment"} {
		if counts[owner] != 1 {
			t.Fatalf("native CLI declaration %s changed count %d", owner, counts[owner])
		}
	}
	var source bytes.Buffer
	if err := format.Node(&source, set, fixture); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	for name, raw := range map[string][]byte{"go.mod": []byte("module native-agent-cli-effects\n\ngo 1.26.3\n"), "original.go": source.Bytes(), "effects_test.go": []byte(cliCompleteNativeFixture)} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("original native Agent CLI effects: %v\n%s", err, output)
	}
}

const cliCompleteNativeFixture = `package agentcommand
import("bytes";"context";"errors";"flag";"fmt";"io";"os";"os/exec";"path/filepath";"reflect";"strings";"syscall";"testing")
type Native struct{}
type Paths struct{Root,KeyPath,Certificate,PrivateKey,Journal string}
type Options struct{URL,NodeID,CA,Directory,JournalKey string;Enroll,Rotate,Relay,Multihop bool;ProbeRegistration,ProbeExecution,ProbeIngress,ProbeServices,ProbeEcho,ProbePathEcho bool;ImportTransitJournal,TimeProof,TimeProofKey string;Diagnostics,Telemetry,ForwardTelemetry,HostTelemetry,ProbeTelemetry,InspectJournal bool}
type enrollmentOptionsFixture struct{URL,NodeID,CA,Root,KeyPath,CertificatePath,PrivatePath,JournalPath string}
type controlOptionsFixture struct{marker string}
type commandRunnerFixture interface{Run(context.Context)error}
type nativeRunnerFixture struct{}
func(nativeRunnerFixture)Run(context.Context)error{return nil}
type commandHostFixture struct{Platform Native;NewRunner func(controlOptionsFixture)(commandRunnerFixture,error)}
var traceFixture []string
var failureFixture=errors.New("original native effect error")
var failFixture string
var capturedOptionsFixture Options
var commandErrorFixture error
func(h commandHostFixture)Run(options Options)error{traceFixture=append(traceFixture,"host-run");capturedOptionsFixture=options;if _,err:=h.NewRunner(controlOptionsFixture{"original-control-options"});err!=failureFixture{panic("factory did not propagate control.New error")};return commandErrorFixture}
func newRunnerFixture(options controlOptionsFixture)(commandRunnerFixture,error){traceFixture=append(traceFixture,"control-new");if options.marker!="original-control-options"{panic("factory option projection")};return nil,failureFixture}
type flagRecordFixture struct{name,kind,help string;defaultValue any}
var flagRecordsFixture []flagRecordFixture
var flagOutputFixture bytes.Buffer
var parsedErrorFixture error
func stringFlagFixture(name,initial,help string)*string{flagRecordsFixture=append(flagRecordsFixture,flagRecordFixture{name,"string",help,initial});return flag.CommandLine.String(name,initial,help)}
func boolFlagFixture(name string,initial bool,help string)*bool{flagRecordsFixture=append(flagRecordsFixture,flagRecordFixture{name,"bool",help,initial});return flag.CommandLine.Bool(name,initial,help)}
func parseFlagsFixture(){traceFixture=append(traceFixture,"parse");flag.Parse()}
func resetFlagsFixture(args []string){flagRecordsFixture=nil;flagOutputFixture.Reset();flag.CommandLine=flag.NewFlagSet("tunex-agent",flag.ContinueOnError);flag.CommandLine.SetOutput(&flagOutputFixture);os.Args=append([]string{"tunex-agent"},args...);parsedErrorFixture=nil;traceFixture=nil}
var absValuesFixture []string
var absCountFixture int
var relativeFixture string
var relativeErrorFixture error
func absFixture(path string)(string,error){absCountFixture++;traceFixture=append(traceFixture,"abs:"+path);if failFixture==fmt.Sprint("abs",absCountFixture){return "",failureFixture};return absValuesFixture[absCountFixture-1],nil}
func proofFixture(proof,key,root string)error{traceFixture=append(traceFixture,"proof:"+proof+":"+key+":"+root);if failFixture=="proof"{return failureFixture};return nil}
func relFixture(root,key string)(string,error){traceFixture=append(traceFixture,"rel:"+root+":"+key);return relativeFixture,relativeErrorFixture}
func joinFixture(parts ...string)string{traceFixture=append(traceFixture,"join:"+strings.Join(parts,":"));return filepath.Join(parts...)}
var keyFixture []byte
var inspectSummaryFixture any
func readFileFixture(path string)([]byte,error){traceFixture=append(traceFixture,"read:"+path);if failFixture=="read"{return keyFixture,failureFixture};return keyFixture,nil}
func inspectFixture(journal string,key []byte,node string)(any,error){traceFixture=append(traceFixture,"inspect:"+journal+":"+node);if len(key)!=32||&key[0]!=&keyFixture[0]{panic("inspection key copied or changed")};if failFixture=="inspect"{return nil,failureFixture};return inspectSummaryFixture,nil}
type writerFixture struct{buffer bytes.Buffer;failure error;calls int}
func(w *writerFixture)Write(raw []byte)(int,error){w.calls++;traceFixture=append(traceFixture,"stdout");if w.failure!=nil{return 0,w.failure};return w.buffer.Write(raw)}
var stdoutFixture io.Writer
var stderrFixture io.Writer
var enrollmentTokenFixture string
var enrollmentOptionsValueFixture enrollmentOptionsFixture
type enrollHostFixture struct{Completed func()}
func getenvFixture(name string)string{traceFixture=append(traceFixture,"env:"+name);return enrollmentTokenFixture}
func enrollmentHostFixture()*enrollHostFixture{traceFixture=append(traceFixture,"enrollment-native");return &enrollHostFixture{}}
func(h *enrollHostFixture)Enroll(options enrollmentOptionsFixture,token string)error{traceFixture=append(traceFixture,"enroll:"+token);enrollmentOptionsValueFixture=options;if token==""{return fmt.Errorf("TUNEX_ENROLLMENT_TOKEN required")};if failFixture=="enroll"{return failureFixture};if h.Completed!=nil{h.Completed()};return nil}
func printlnFixture(values ...any)(int,error){traceFixture=append(traceFixture,"completed:"+fmt.Sprint(values...));return 0,failureFixture}
var entropyCountFixture,entropyNFixture int
func entropyFixture(raw []byte)(int,error){entropyCountFixture++;traceFixture=append(traceFixture,"entropy");if len(raw)!=16{panic("BootID entropy size changed")};for i:=range raw{raw[i]=byte(i)};if failFixture=="entropy"{return entropyNFixture,failureFixture};return entropyNFixture,nil}
var lockPathFixture string
var releasesFixture int
func lockFixture(path string)(func(),error){traceFixture=append(traceFixture,"lock:"+path);lockPathFixture=path;if failFixture=="lock"{return nil,failureFixture};return func(){releasesFixture++},nil}
var signalContextFixture context.Context
var signalCancelCallsFixture int
func notifyFixture(ctx context.Context,signals ...os.Signal)(context.Context,context.CancelFunc){traceFixture=append(traceFixture,"notify");if ctx!=context.Background()||len(signals)!=2||signals[0]!=os.Interrupt||signals[1]!=syscall.SIGTERM{panic("native signal source/order changed")};work,cancel:=context.WithCancel(ctx);signalContextFixture=work;return work,func(){signalCancelCallsFixture++;traceFixture=append(traceFixture,"cancel");cancel()}}
type exitFixtureValue int
func exitFixture(code int){traceFixture=append(traceFixture,fmt.Sprint("exit:",code));panic(exitFixtureValue(code))}
func sameFixture(t *testing.T,got,want any){t.Helper();if !reflect.DeepEqual(got,want){t.Fatalf("got %#v want %#v",got,want)}}

func TestNativeOriginalAbsProofRelPredicateAndJoinOrder(t *testing.T){
 for _,stage:=range []string{"abs1","proof","abs2","inside","parent","dotdot-prefix","empty","outside","rel-error"}{
  traceFixture=nil;absCountFixture=0;absValuesFixture=[]string{"absolute-state","absolute-key"};failFixture=stage;relativeErrorFixture=nil;relativeFixture=".."+string(os.PathSeparator)+"key";switch stage{case "inside":relativeFixture="child";case "parent":relativeFixture="..";case "dotdot-prefix":relativeFixture="..suffix";case "empty":relativeFixture="";case "rel-error":relativeFixture=".";relativeErrorFixture=failureFixture}
  value,err:=(Native{}).ResolvePaths("raw-state","raw-key","proof","proof-key");wantTrace:=[]string{"abs:raw-state"};if stage!="abs1"{wantTrace=append(wantTrace,"proof:proof:proof-key:absolute-state");if stage!="proof"{wantTrace=append(wantTrace,"abs:raw-key");if stage!="abs2"{wantTrace=append(wantTrace,"rel:absolute-state:absolute-key");if stage=="outside"||stage=="rel-error"{wantTrace=append(wantTrace,"join:absolute-state:node.pem","join:absolute-state:private.pem","join:absolute-state:journal.json")}}}};sameFixture(t,traceFixture,wantTrace)
  switch stage{case "abs1","proof","abs2":if err!=failureFixture||value!=(Paths{}){t.Fatal(stage,err,value)};case "inside","parent","dotdot-prefix","empty":if err==nil||err.Error()!="Journal MAC key must be outside the state directory"||value!=(Paths{}){t.Fatal("original lexical refusal",stage,err,value)};default:if err!=nil{t.Fatal(stage,err)};sameFixture(t,value,Paths{"absolute-state","absolute-key",filepath.Join("absolute-state","node.pem"),filepath.Join("absolute-state","private.pem"),filepath.Join("absolute-state","journal.json")})}
 }
 failFixture="";for _,relative:=range []string{".","a"+string(os.PathSeparator)+"..", "..other"}{traceFixture=nil;absCountFixture=0;relativeFixture=relative;relativeErrorFixture=nil;if _,err:=(Native{}).ResolvePaths("raw-state","raw-key","","");err==nil{t.Fatal("lexical path normalized or accepted",relative)}}
 for _,url:=range []string{"https://","https://host","https://host/../x","https:// host"}{if !(Native{}).TrustedControlURL(url){t.Fatal("literal HTTPS prefix changed",url)}};for _,url:=range []string{"","HTTPS://host"," httpS://host","http://host","https:/host"}{if (Native{}).TrustedControlURL(url){t.Fatal("new URL normalization",url)}}
}

func TestNativeOriginalReadonlyKeyMasksAndStdoutEncoder(t *testing.T){
 for _,mode:=range []string{"read","zero","31","33","inspect","encode","write","valid"}{
  traceFixture=nil;failFixture=mode;keyFixture=bytes.Repeat([]byte{0x80},32);if mode=="zero"{keyFixture=nil};if mode=="31"{keyFixture=keyFixture[:31]};if mode=="33"{keyFixture=append(keyFixture,1)};inspectSummaryFixture=map[string]any{"node":"native-node","generation":7};writer:=&writerFixture{};stdoutFixture=writer;if mode=="write"{writer.failure=failureFixture};if mode=="encode"{inspectSummaryFixture=map[string]any{"unsupported":make(chan int)}}
  err:=(Native{}).InspectJournal("journal","key-path","node");switch mode{case "read","zero","31","33","inspect":if err==nil||err.Error()!="JOURNAL_INSPECTION_FAILED"||err==failureFixture||writer.calls!=0{t.Fatal("inspection error mask/output short circuit",mode,err,traceFixture)};case "write":if err!=failureFixture||writer.calls!=1{t.Fatal("stdout original error",err)};case "encode":if err==nil||writer.calls!=0{t.Fatal("native encoding error stage",err)};case "valid":if err!=nil||writer.buffer.String()!="{\"generation\":7,\"node\":\"native-node\"}\n"||writer.calls!=1{t.Fatal("native encoder summary/newline",err,writer.buffer.String())}}
  want:=[]string{"read:key-path"};if mode!="read"&&mode!="zero"&&mode!="31"&&mode!="33"{want=append(want,"inspect:journal:node");if mode=="write"||mode=="valid"{want=append(want,"stdout")}};sameFixture(t,traceFixture,want)
 }
}

func TestNativeOriginalBootLockDiagnosticsSignalsAndEnrollmentEffects(t *testing.T){
 for _,count:=range []int{0,1,15,16}{traceFixture=nil;failFixture="";entropyCountFixture=0;entropyNFixture=count;boot,err:=(Native{}).BootID();if err!=nil||boot!="000102030405060708090a0b0c0d0e0f"||entropyCountFixture!=1{t.Fatal("single16byte read ignored count",count,boot,err)}}
 failFixture="entropy";entropyCountFixture=0;if boot,err:=(Native{}).BootID();boot!=""||err!=failureFixture||entropyCountFixture!=1{t.Fatal("BootID native error identity")}
 for _,fail:=range []bool{false,true}{failFixture="";if fail{failFixture="lock"};traceFixture=nil;releasesFixture=0;release,err:=(Native{}).AcquireInstance("root");if lockPathFixture!=filepath.Join("root","instance.lock"){t.Fatal("lock path changed")};if fail{if err!=failureFixture||release!=nil{t.Fatal("lock error")}}else{if err!=nil{t.Fatal(err)};release();if releasesFixture!=1{t.Fatal("lock release callback changed")}}};if got:=(Native{}).DiagnosticsPath("root");got!=filepath.Join("root","diagnostics","status.json"){t.Fatal(got)}
 for _,failure:=range []error{nil,failureFixture}{traceFixture=nil;signalCancelCallsFixture=0;err:=(Native{}).RunWithSignals(func(ctx context.Context)error{if ctx!=signalContextFixture||ctx.Err()!=nil{t.Fatal("native signal context input")};traceFixture=append(traceFixture,"run");return failure});if err!=failure||signalContextFixture.Err()!=context.Canceled||signalCancelCallsFixture!=1{t.Fatal("cancel/error/lifetime")};sameFixture(t,traceFixture,[]string{"notify","run","cancel"})}
 options:=enrollmentOptionsFixture{"url","node","ca","root","key","certificate","private","journal"};enrollmentTokenFixture="late-token";for _,mode:=range []string{"success","enroll"}{failFixture=mode;traceFixture=nil;err:=(Native{}).Enroll(options);want:=[]string{"env:TUNEX_ENROLLMENT_TOKEN","enrollment-native","enroll:late-token"};if mode=="success"{want=append(want,"completed:Node enrolled; journal initialized without execution authorization");if err!=nil{t.Fatal(err)}}else if err!=failureFixture{t.Fatal("enrollment error identity")};sameFixture(t,traceFixture,want);sameFixture(t,enrollmentOptionsValueFixture,options)}
 enrollmentTokenFixture="";failFixture="";traceFixture=nil;if err:=(Native{}).Enroll(options);err==nil||err.Error()!="TUNEX_ENROLLMENT_TOKEN required"{t.Fatal("empty token binding")};sameFixture(t,traceFixture,[]string{"env:TUNEX_ENROLLMENT_TOKEN","enrollment-native","enroll:"})
}

var originalFlagsFixture=[]flagRecordFixture{
 {"control","string","Trusted HTTPS Control URL",""},
 {"node","string","Node ID",""},
 {"ca","string","Trusted Control CA",""},
 {"state","string","Protected Agent state directory",""},
 {"journal-key","string","Protected journal MAC key path, outside state directory",""},
 {"enroll","bool","Exchange TUNEX_ENROLLMENT_TOKEN, then initialize state",false},
 {"rotate","bool","Rotate Node key/certificate after online Hello without resetting execution state",false},
 {"relay","bool","Enable authenticated Relay execution with a dedicated Node peer credential",false},
 {"probe-registration","bool","Maintain experimental Probe instance registration",false},
 {"probe-execution","bool","Opt in to bounded connect-only Probe tasks; requires --probe-registration",false},
 {"probe-ingress","bool","Opt in to local current Direct TCP ingress connect; requires --probe-registration and --probe-execution; may trigger the original listener's downstream dial",false},
 {"probe-services","bool","Opt in to exact pinned observation TLS handshake through current Direct ingress; requires --probe-ingress, --probe-execution and --probe-registration; TLS records count as real Forward payload",false},
 {"probe-path-echo","bool","Opt in to controlled full path Echo from local Relay or multihop ingress; requires echo and relay",false},
 {"probe-echo","bool","Opt in to controlled TCP/UDP nonce echo through current Direct ingress; requires services, ingress, execution and registration; real payload and original UDP association idle lifetime apply",false},
 {"multihop","bool","Opt in to execution extension 1 and upgrade the protected journal; requires --relay",false},
 {"import-transit-journal","string","Explicit legacy offline Transit journal to import as retired high-water; requires --multihop",""},
 {"time-proof","string","Optional supervisor OS synchronization proof",""},
 {"time-proof-key","string","Protected MAC key for the supervisor proof",""},
 {"diagnostics","bool","Write protected local resource samples for operator measurements",false},
 {"telemetry","bool","Opt in to bounded process and runtime telemetry; not payload usage or execution authority",false},
 {"forward-telemetry","bool","Opt in to bounded ingress operational payload counters; not billing or execution authority",false},
 {"host-telemetry","bool","Opt in to bounded Agent-visible OS resources; not cgroup limits or physical-host guarantees",false},
 {"probe-telemetry","bool","Opt in to cumulative actual Probe dial counters; does not enable Probe execution",false},
 {"inspect-journal","bool","Read-only authenticated journal summary; requires node, state and journal-key, no Control connection",false},
}

func TestNativeOriginalGlobalFlagsOrderHelpDefaultsCaptureAndDuplicate(t *testing.T){
 originalCommandLine,originalArgs:=flag.CommandLine,os.Args;defer func(){flag.CommandLine=originalCommandLine;os.Args=originalArgs}()
 resetFlagsFixture(nil);defaults:=ParseOptions();sameFixture(t,defaults,Options{});sameFixture(t,flagRecordsFixture,originalFlagsFixture);sameFixture(t,traceFixture,[]string{"parse"});if !flag.Parsed()||flag.NFlag()!=0{t.Fatal("native global parser not used")}
 for _,item:=range originalFlagsFixture{value:=flag.Lookup(item.name);if value==nil||value.Usage!=item.help||value.DefValue!=fmt.Sprint(item.defaultValue){t.Fatal("global flag registration changed",item)}}
 defer func(){recovered:=recover();if recovered==nil||!strings.Contains(fmt.Sprint(recovered),"tunex-agent flag redefined: control"){t.Fatalf("duplicate public parse registration did not retain native panic %v",recovered)};if !strings.Contains(flagOutputFixture.String(),"tunex-agent flag redefined: control"){t.Fatal("duplicate native diagnostic missing")}}()
 ParseOptions()
}

func TestNativeOriginalEveryPreexistingGlobalFlagStopsAtRegistrationPrefix(t *testing.T){
 originalCommandLine,originalArgs:=flag.CommandLine,os.Args;defer func(){flag.CommandLine=originalCommandLine;os.Args=originalArgs}()
 for index,item:=range originalFlagsFixture{resetFlagsFixture(nil);if item.kind=="string"{flag.String(item.name,"existing","existing help")}else{flag.Bool(item.name,true,"existing help")};var recovered any;func(){defer func(){recovered=recover()}();ParseOptions()}();want:="tunex-agent flag redefined: "+item.name;if fmt.Sprint(recovered)!=want||!strings.Contains(flagOutputFixture.String(),want){t.Fatal("duplicate native failure",item.name,recovered,flagOutputFixture.String())};sameFixture(t,flagRecordsFixture,originalFlagsFixture[:index+1]);if len(traceFixture)!=0||flag.Parsed(){t.Fatal("duplicate registration reached parse/capture",item.name,traceFixture)}}
}

func TestNativeOriginalParsedValuesAreCapturedAndNativeParserStopsAtOperand(t *testing.T){
 originalCommandLine,originalArgs:=flag.CommandLine,os.Args;defer func(){flag.CommandLine=originalCommandLine;os.Args=originalArgs}()
 args:=[]string{"--control=https://control/é","-node","node value","--ca=ca-path","--state=state-path","--journal-key=key-path","--enroll","--rotate","--relay","--multihop","--probe-registration","--probe-execution","--probe-ingress","--probe-services","--probe-echo","--probe-path-echo","--import-transit-journal=transit","--time-proof=proof","--time-proof-key=proof-key","--diagnostics","--telemetry","--forward-telemetry","--host-telemetry","--probe-telemetry","--inspect-journal"}
 resetFlagsFixture(args);captured:=ParseOptions();want:=Options{URL:"https://control/é",NodeID:"node value",CA:"ca-path",Directory:"state-path",JournalKey:"key-path",Enroll:true,Rotate:true,Relay:true,Multihop:true,ProbeRegistration:true,ProbeExecution:true,ProbeIngress:true,ProbeServices:true,ProbeEcho:true,ProbePathEcho:true,ImportTransitJournal:"transit",TimeProof:"proof",TimeProofKey:"proof-key",Diagnostics:true,Telemetry:true,ForwardTelemetry:true,HostTelemetry:true,ProbeTelemetry:true,InspectJournal:true};sameFixture(t,captured,want);sameFixture(t,flagRecordsFixture,originalFlagsFixture)
 if err:=flag.Set("control","late replacement");err!=nil{t.Fatal(err)};if err:=flag.Set("relay","false");err!=nil{t.Fatal(err)};sameFixture(t,captured,want)
 resetFlagsFixture([]string{"--control=first","--control=last","--relay=false","--node=before","operand","--node=after"});value:=ParseOptions();if value.URL!="last"||value.NodeID!="before"||value.Relay{t.Fatal("native repeat/bool/operand parse changed",value)};sameFixture(t,flag.Args(),[]string{"operand","--node=after"})
 resetFlagsFixture([]string{"--","--control=literal"});if value:=ParseOptions();value!=(Options{}){t.Fatal(value)};sameFixture(t,flag.Args(),[]string{"--control=literal"})
}

func TestNativeOriginalGlobalFlagHelpAndInvalidExitBehavior(t *testing.T){
 expected:=flag.NewFlagSet("tunex-agent",flag.ContinueOnError);var usage bytes.Buffer;expected.SetOutput(&usage);for _,item:=range originalFlagsFixture{if item.kind=="string"{expected.String(item.name,item.defaultValue.(string),item.help)}else{expected.Bool(item.name,item.defaultValue.(bool),item.help)}};expected.PrintDefaults();help:="Usage of tunex-agent:\n"+usage.String()
 for _,entry:=range []struct{mode string;args []string;code int;prefix string}{{"help",[]string{"--help"},0,help},{"unknown",[]string{"--missing"},2,"flag provided but not defined: -missing\n"+help},{"missing-value",[]string{"--control"},2,"flag needs an argument: -control\n"+help},{"bad-bool",[]string{"--relay=maybe"},2,"invalid boolean value \"maybe\" for -relay: parse error\n"+help}}{
  command:=exec.Command(os.Args[0],"-test.run=^TestNativeOriginalParserProcessHelper$");command.Env=append(os.Environ(),"TUNEX_B_NATIVE_FLAG_HELPER="+entry.mode);var stdout,stderr bytes.Buffer;command.Stdout=&stdout;command.Stderr=&stderr;err:=command.Run();code:=0;if err!=nil{var exit *exec.ExitError;if !errors.As(err,&exit){t.Fatal(err)};code=exit.ExitCode()};if code!=entry.code||stdout.Len()!=0||stderr.String()!=entry.prefix{t.Fatalf("native parser mode %s code%d stderr%q stdout%q want%q",entry.mode,code,stderr.String(),stdout.String(),entry.prefix)}
 }
}
func TestNativeOriginalParserProcessHelper(t *testing.T){mode:=os.Getenv("TUNEX_B_NATIVE_FLAG_HELPER");if mode==""{return};arguments:=map[string][]string{"help":{"--help"},"unknown":{"--missing"},"missing-value":{"--control"},"bad-bool":{"--relay=maybe"}}[mode];resetFlagsFixture(arguments);flag.CommandLine=flag.NewFlagSet("tunex-agent",flag.ExitOnError);flag.CommandLine.SetOutput(os.Stderr);ParseOptions();t.Fatal("native flag helper should exit before capture")}

func TestNativeOriginalMainRunEnrollmentSignaturesStderrAndExit(t *testing.T){
 var runSignature func()error=run;var enrollmentSignature func(string,string,string,string,string,string,string,string)error=enrollment;_ = runSignature
 originalCommandLine,originalArgs:=flag.CommandLine,os.Args;defer func(){flag.CommandLine=originalCommandLine;os.Args=originalArgs}()
 resetFlagsFixture([]string{"--node=node","--inspect-journal","--relay"});commandErrorFixture=failureFixture;if err:=run();err!=failureFixture{t.Fatal("main run host error changed",err)};if capturedOptionsFixture.NodeID!="node"||!capturedOptionsFixture.InspectJournal||!capturedOptionsFixture.Relay{t.Fatal("main did not pass parsed value",capturedOptionsFixture)};sameFixture(t,traceFixture,[]string{"parse","host-run","control-new"})
 for _,failure:=range []error{nil,failureFixture}{resetFlagsFixture(nil);commandErrorFixture=failure;var stderr bytes.Buffer;stderrFixture=&stderr;var recovered any;func(){defer func(){recovered=recover()}();main()}();want:=[]string{"parse","host-run","control-new"};if failure==nil{if recovered!=nil||stderr.Len()!=0{t.Fatal("success emitted error/exit")}}else{want=append(want,"exit:1");if recovered!=exitFixtureValue(1)||stderr.String()!=failureFixture.Error()+"\n"{t.Fatal("main error stderr/exit",recovered,stderr.String())}};sameFixture(t,traceFixture,want)}
 resetFlagsFixture(nil);commandErrorFixture=failureFixture;stderrFixture=&writerFixture{failure:errors.New("ignored stderr write failure")};var failedOutputExit any;func(){defer func(){failedOutputExit=recover()}();main()}();if failedOutputExit!=exitFixtureValue(1){t.Fatal("stderr failure replaced original exit",failedOutputExit)}
 traceFixture=nil;failFixture="";enrollmentTokenFixture="native-token";if err:=enrollmentSignature("url","node","ca","root","key","cert","private","journal");err!=nil{t.Fatal(err)};sameFixture(t,enrollmentOptionsValueFixture,enrollmentOptionsFixture{"url","node","ca","root","key","cert","private","journal"});sameFixture(t,traceFixture,[]string{"env:TUNEX_ENROLLMENT_TOKEN","enrollment-native","enroll:native-token","completed:Node enrolled; journal initialized without execution authorization"})
}
`

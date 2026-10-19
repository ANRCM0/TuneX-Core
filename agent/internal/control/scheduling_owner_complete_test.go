package control

import (
	"bytes"
	"context"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// Compile the current scheduling owners with recording collaborators. Only the
// wire type/function names are rebound: loop conditions, waits, defers, context
// creation, goroutines and joins are the original source declarations.
func TestSchedulingOwnerCompleteOriginalRunAndProbeLoops(t *testing.T) {
	set := token.NewFileSet()
	fixture := &ast.File{Name: ast.NewIdent("control")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"context", "errors", "fmt", "time"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: `"` + path + `"`}})
	}
	fixture.Decls = append(fixture.Decls, imports)
	count := 0
	for _, entry := range [][2]string{{"runner.go", "Run"}, {"probe_registration.go", "maintainProbe"}, {"probe_workflow.go", "maintainProbeExecution"}, {"probe_registration.go", "monitorProbe"}, {"probe_authority_watch.go", "superviseProbeWatch"}, {"probe_authority_watch.go", "runProbeWatch"}, {"probe_claim.go", "minProbeDeadline"}} {
		path, owner := entry[0], entry[1]
		original, err := parser.ParseFile(set, path, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		found := 0
		for _, declaration := range original.Decls {
			function, ok := declaration.(*ast.FuncDecl)
			if !ok || function.Name.Name != owner {
				continue
			}
			found++
			count++
			ast.Inspect(function, func(node ast.Node) bool {
				switch value := node.(type) {
				case *ast.CompositeLit:
					if selector, ok := value.Type.(*ast.SelectorExpr); ok {
						if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "adp3" && selector.Sel.Name == "HelloRequest" {
							value.Type = ast.NewIdent("helloRequestFixture")
						}
					}
				case *ast.CallExpr:
					if selector, ok := value.Fun.(*ast.SelectorExpr); ok {
						if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "nativeexecution" {
							switch selector.Sel.Name {
							case "EncodeRunnerHello", "DecodeRunnerHello", "ParseWireTime":
								value.Fun = ast.NewIdent(selector.Sel.Name + "Fixture")
							}
						}
					}
					for index, arg := range value.Args {
						if selector, ok := arg.(*ast.SelectorExpr); ok {
							if namespace, ok := selector.X.(*ast.Ident); ok && namespace.Name == "probe" && selector.Sel.Name == "ErrDenied" {
								value.Args[index] = ast.NewIdent("errDeniedFixture")
							}
						}
					}
				}
				return true
			})
			fixture.Decls = append(fixture.Decls, function)
		}
		if found != 1 {
			t.Fatalf("scheduling owner %s not found exactly once", owner)
		}
	}
	if count != 7 {
		t.Fatal("scheduling owner inventory changed")
	}
	var source bytes.Buffer
	if err := format.Node(&source, set, fixture); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	for name, raw := range map[string][]byte{"go.mod": []byte("module scheduling-owner-effects\n\ngo 1.26.3\n"), "original.go": source.Bytes(), "effects_test.go": []byte(schedulingOwnerCompleteFixture)} {
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
		t.Fatalf("original scheduling owners: %v\n%s", err, output)
	}
}

const schedulingOwnerCompleteFixture = `package control
import("context";"errors";"fmt";"reflect";"sync";"testing";"time")

type traceFixture struct{mutex sync.Mutex;values []string}
func(t *traceFixture)add(value string){t.mutex.Lock();defer t.mutex.Unlock();t.values=append(t.values,value)}
func(t *traceFixture)events()[]string{t.mutex.Lock();defer t.mutex.Unlock();return append([]string(nil),t.values...)}
func(t *traceFixture)count(value string)int{n:=0;for _,event:=range t.events(){if event==value{n++}};return n}
type timerFixture struct{ticks chan time.Time;stops int;interval time.Duration}
func(t *timerFixture)C()<-chan time.Time{return t.ticks}
func(t *timerFixture)Stop()bool{t.stops++;return t.stops==1}
type tickerFixture struct{ticks chan time.Time;trace *traceFixture;interval time.Duration;stopped chan struct{}}
func(t *tickerFixture)C()<-chan time.Time{return t.ticks}
func(t *tickerFixture)Stop(){t.trace.add("ticker-stop:"+t.interval.String());if t.stopped!=nil{close(t.stopped)}}
type scheduleFixture struct{mutex sync.Mutex;trace *traceFixture;now time.Time;after []time.Duration;timers []*timerFixture;waits []time.Duration;until time.Duration;untilInputs []time.Time;onAfter func(int);onTimer func(int,*timerFixture);onTicker func(*tickerFixture);timeoutContexts []context.Context;timeoutDurations []time.Duration;timeoutCancels int}
func(s *scheduleFixture)Now()time.Time{s.trace.add("now");return s.now}
func(s *scheduleFixture)Until(at time.Time)time.Duration{s.trace.add("until");s.mutex.Lock();s.untilInputs=append(s.untilInputs,at);s.mutex.Unlock();return s.until}
func(s *scheduleFixture)After(d time.Duration)<-chan time.Time{s.after=append(s.after,d);s.trace.add("after:"+d.String());ch:=make(chan time.Time,1);if s.onAfter!=nil{s.onAfter(len(s.after))};ch<-s.now;return ch}
func(s *scheduleFixture)NewTicker(d time.Duration)*tickerFixture{ticker:=&tickerFixture{ticks:make(chan time.Time,1),trace:s.trace,interval:d};s.trace.add("ticker:"+d.String());if s.onTicker!=nil{s.onTicker(ticker)};return ticker}
func(s *scheduleFixture)NewTimer(d time.Duration)*timerFixture{timer:=&timerFixture{ticks:make(chan time.Time,1),interval:d};s.mutex.Lock();s.waits=append(s.waits,d);s.timers=append(s.timers,timer);index:=len(s.timers);s.mutex.Unlock();if s.onTimer!=nil{s.onTimer(index,timer)};return timer}
func(s *scheduleFixture)AfterFunc(ctx context.Context,work func())func()bool{s.trace.add("afterfunc");stop:=context.AfterFunc(ctx,work);return func()bool{s.trace.add("afterfunc-stop");return stop()}}
func(s *scheduleFixture)WithTimeout(ctx context.Context,d time.Duration)(context.Context,context.CancelFunc){s.timeoutContexts=append(s.timeoutContexts,ctx);s.timeoutDurations=append(s.timeoutDurations,d);work,cancel:=context.WithCancel(ctx);return work,func(){s.timeoutCancels++;cancel()}}
type httpError struct{status int;code string}
func(e httpError)Error()string{return fmt.Sprintf("http:%d:%s",e.status,e.code)}
type helloRequestFixture struct{ProtocolVersion int;NodeId,BootId,AgentBuild string;Capabilities []string;LastStoredSnapshotGeneration uint64}
type helloFixture struct{NodeId,BootId,ServerTime string;Policy struct{PollIntervalSeconds int}}
var decodedFixture helloFixture
var decodeFailureFixture,parseFailureFixture error
var encodedFixture helloRequestFixture
func EncodeRunnerHelloFixture(value helloRequestFixture)([]byte,error){encodedFixture=value;return []byte("original-hello-bytes"),nil}
func DecodeRunnerHelloFixture(raw []byte)(helloFixture,error){if string(raw)!="reply"{panic("hello raw changed")};return decodedFixture,decodeFailureFixture}
func ParseWireTimeFixture(raw string)(time.Time,error){if raw!="server-time"{panic("wire parse input changed")};return time.Unix(100,0),parseFailureFixture}
type driverFixture struct{}
var builtinExecutionDrivers driverFixture
func(driverFixture)capabilities(int)[]string{return []string{"native-capability"}}
type guardFixture struct{runner *Runner;checkFailure,validateFailure error}
func(g *guardFixture)Check()error{g.runner.trace.add("guard-check");return g.checkFailure}
func(g *guardFixture)ValidateServerTime(at time.Time)error{if !at.Equal(time.Unix(100,0)){panic("guard time changed")};g.runner.trace.add("validate-server");return g.validateFailure}
type ticketFixture struct{failure error}
func(t *ticketFixture)Allow()error{return t.failure}
type streamFixture struct{trace *traceFixture}
func(s *streamFixture)Close(){s.trace.add("stream-close")}
type running struct{stream *streamFixture;ticket *ticketFixture}
type drainFixture struct{instance running}
type gateFixture struct{trace *traceFixture;ctx context.Context}
func(g *gateFixture)Close(){if g.ctx.Err()!=context.Canceled{panic("gate closed before session cancellation")};g.trace.add("gate-close")}
type registeredProbe struct{until time.Time;done chan struct{};ctx context.Context;cancel context.CancelFunc;gate *gateFixture}
var errDeniedFixture=errors.New("denied")
const probeStatusInterval=50*time.Millisecond
type probeAuthorityWatch struct{ctx context.Context;cancel context.CancelFunc;done,changed chan struct{};mutex sync.Mutex;until,freshUntil time.Time;receipt struct{session *registeredProbe};err error}
func(w *probeAuthorityWatch)fail(err error){w.mutex.Lock();if w.err==nil{w.err=err};w.mutex.Unlock();w.cancel()}
type channelFixture struct{runner *Runner}
func(c channelFixture)CloseIdleConnections(any){c.runner.trace.add("idle-close")}
type logFixture struct{runner *Runner}
func(l logFixture)Warn(values ...any){l.runner.trace.add(fmt.Sprint(values[0]))}
type Runner struct{
 mutex sync.Mutex;trace *traceFixture;clock *scheduleFixture;client any
 options struct{NodeID,BootID,Diagnostics string;Telemetry,ForwardTelemetry,HostTelemetry,ProbeTelemetry,Relay,ProbeRegistration,ProbeExecution,Rotate bool}
 journal struct{Generation uint64};hello helloFixture;guard *guardFixture;ticket *ticketFixture;credentialUntil time.Time;pending []int;instances map[string]running;drains map[string]drainFixture
 requestCount,rotations,reloads,renewals,polls,reports,ensureCalls,registrations,tasks,revokes int
 helloFailures []error;rotateFailures []error;reloadFailure,ensureFailure,renewFailure,pollFailure,reportFailure,initializeFailure error
 relayDue bool;onPoll func(context.Context);onReload func();onRegister func(context.Context,int)(*registeredProbe,error);onTask func(context.Context,int)error
 workerStarted chan string;workerRelease <-chan struct{};revokeContext context.Context;revoked chan struct{};probeRegistration *registeredProbe;current bool;onCurrent func();watchFailure error;statusCount int;onStatus func(*probeAuthorityWatch,int)error
}
func newRunnerFixture()(*Runner,context.Context,context.CancelFunc){trace:=&traceFixture{};r:=&Runner{trace:trace,instances:map[string]running{},drains:map[string]drainFixture{}};r.options.NodeID="node";r.options.BootID="boot";r.journal.Generation=42;r.clock=&scheduleFixture{trace:trace,now:time.Unix(100,0),until:time.Hour};r.guard=&guardFixture{runner:r};decodedFixture=helloFixture{NodeId:"node",BootId:"boot",ServerTime:"server-time"};decodedFixture.Policy.PollIntervalSeconds=7;decodeFailureFixture=nil;parseFailureFixture=nil;ctx,cancel:=context.WithCancel(context.Background());return r,ctx,cancel}
func(r *Runner)scheduler()*scheduleFixture{return r.clock}
func(r *Runner)executionFeatures()int{return 1}
func(r *Runner)channelProvider()channelFixture{return channelFixture{r}}
func(r *Runner)localLog()logFixture{return logFixture{r}}
func(r *Runner)stop(){r.trace.add("stop")}
func(r *Runner)request(_ context.Context,method,path string,body []byte,epoch bool)([]byte,error){if method!="POST"||path!="/agent/v3/hello"||string(body)!="original-hello-bytes"||epoch{panic("hello retry arguments changed")};r.requestCount++;r.trace.add("hello");if len(r.helloFailures)>0{err:=r.helloFailures[0];r.helloFailures=r.helloFailures[1:];return nil,err};return []byte("reply"),nil}
func(r *Runner)initializeGuard()error{r.trace.add("initialize");return r.initializeFailure}
func(r *Runner)ensureRelayCredential(context.Context)error{r.ensureCalls++;r.trace.add("ensure-relay");return r.ensureFailure}
func(r *Runner)credentialRenewalLead()time.Duration{return 2*time.Minute}
func(r *Runner)rotate(context.Context)error{r.rotations++;r.trace.add("rotate");if len(r.rotateFailures)>0{err:=r.rotateFailures[0];r.rotateFailures=r.rotateFailures[1:];return err};return nil}
func(r *Runner)reloadCredential()error{r.reloads++;r.trace.add("reload");if r.onReload!=nil{r.onReload()};return r.reloadFailure}
func(r *Runner)relayRenewalDue()bool{r.trace.add("relay-due");return r.relayDue}
func(r *Runner)renewRelayCredential(context.Context)error{r.renewals++;r.trace.add("renew-relay");return r.renewFailure}
func(r *Runner)poll(ctx context.Context)error{r.polls++;r.trace.add("poll");if r.onPoll!=nil{r.onPoll(ctx)};return r.pollFailure}
func(r *Runner)report(context.Context)error{r.reports++;r.trace.add("report");return r.reportFailure}
func(r *Runner)closeProbeLocked()*registeredProbe{r.trace.add("close-probe");return nil}
func(r *Runner)retainForwardCounterTailLocked(running){r.trace.add("retain-counter")}
func(r *Runner)writeDiagnostics(final bool)error{r.trace.add(fmt.Sprint("diagnostic:",final));return nil}
func(r *Runner)writeForwardCounters(final bool)error{r.trace.add(fmt.Sprint("counter:",final));return nil}
func(r *Runner)worker(ctx context.Context,name string){r.trace.add("start:"+name);if r.workerStarted!=nil{r.workerStarted<-name};<-ctx.Done();r.trace.add("cancel:"+name);if r.workerRelease!=nil{<-r.workerRelease};r.trace.add("done:"+name)}
func(r *Runner)maintainTelemetry(ctx context.Context,at time.Time){if at!=r.clock.now{panic("telemetry start sample changed")};r.worker(ctx,"process")}
func(r *Runner)maintainForwardTelemetry(ctx context.Context,at time.Time){if at!=r.clock.now{panic("forward start sample changed")};r.worker(ctx,"forward")}
func(r *Runner)maintainHostTelemetry(ctx context.Context,at time.Time){if at!=r.clock.now{panic("host start sample changed")};r.worker(ctx,"host")}
func(r *Runner)maintainProbeTelemetry(ctx context.Context,at time.Time){if at!=r.clock.now{panic("probe start sample changed")};r.worker(ctx,"probe")}
func(r *Runner)registerProbe(ctx context.Context)(*registeredProbe,error){r.registrations++;r.trace.add("register");if r.onRegister==nil{<-ctx.Done();return nil,ctx.Err()};return r.onRegister(ctx,r.registrations)}
func(r *Runner)revokeProbe(ctx context.Context)error{r.revokes++;r.revokeContext=ctx;r.trace.add("revoke");if ctx.Err()!=nil{panic("cleanup inherited cancelled run context")};if r.revoked!=nil{close(r.revoked)};return errors.New("ignored cleanup failure")}
func(r *Runner)runProbeTask(ctx context.Context)error{r.tasks++;r.trace.add("task");if r.onTask==nil{<-ctx.Done();return ctx.Err()};return r.onTask(ctx,r.tasks)}
func(r *Runner)probeCurrentLocked(*registeredProbe)bool{if r.mutex.TryLock(){r.mutex.Unlock();panic("probe current check moved outside runner lock")};r.trace.add("probe-current");if r.onCurrent!=nil{r.onCurrent()};return r.current}
func(r *Runner)probeWatchLocal(*probeAuthorityWatch)error{r.trace.add("watch-local");return r.watchFailure}
func(r *Runner)probeStatusExchange(w *probeAuthorityWatch)error{r.statusCount++;r.trace.add("status");if r.onStatus!=nil{return r.onStatus(w,r.statusCount)};return nil}
func equalFixture(t *testing.T,got,want any){t.Helper();if !reflect.DeepEqual(got,want){t.Fatalf("got %#v want %#v",got,want)}}
func waitTickerStopFixture(t *testing.T,stopped <-chan struct{}){t.Helper();select{case <-stopped:case <-time.After(5*time.Second):t.Fatal("original ticker deferred Stop did not finish")}}

func TestRunOriginalHelloBackoffFatalAndEarlyFailures(t *testing.T){
 failure:=errors.New("original-failure")
 for _,fatal:=range []httpError{{401,""},{403,""},{409,"SESSION_SUPERSEDED"},{400,"INTEGRITY_FAILURE"}}{r,ctx,cancel:=newRunnerFixture();r.helloFailures=[]error{fatal};if err:=r.Run(ctx);err!=fatal{t.Fatalf("fatal identity %v",err)};cancel();if r.requestCount!=1||len(r.clock.after)!=0||r.trace.count("idle-close")!=1||r.trace.count("stop")!=1{t.Fatal("fatal retry/cleanup changed")}}
 r,ctx,cancel:=newRunnerFixture();r.helloFailures=[]error{failure,failure,failure,failure,failure,failure,failure,failure};r.clock.onAfter=func(n int){if n==8{cancel()}};if err:=r.Run(ctx);err!=context.Canceled{t.Fatal(err)};equalFixture(t,r.clock.after,[]time.Duration{time.Second,2*time.Second,4*time.Second,8*time.Second,16*time.Second,30*time.Second,30*time.Second,30*time.Second});if r.requestCount<8||r.requestCount>9{t.Fatal("retry cancellation lost")}
 for _,mode:=range []string{"decode","node","boot","guard","parse","server","ensure"}{r,ctx,cancel:=newRunnerFixture();switch mode{case "decode":decodeFailureFixture=failure;case "node":decodedFixture.NodeId="foreign";case "boot":decodedFixture.BootId="foreign";case "guard":r.initializeFailure=failure;case "parse":parseFailureFixture=failure;case "server":r.guard.validateFailure=failure;case "ensure":r.options.Relay=true;r.ensureFailure=failure};err:=r.Run(ctx);cancel();if err==nil||(mode!="node"&&mode!="boot"&&err!=failure){t.Fatalf("%s original early error %v",mode,err)};if len(r.clock.after)!=0||r.polls!=0||r.trace.count("idle-close")!=1{t.Fatal("early failure reached main loop")}}
 if encodedFixture.ProtocolVersion!=3||encodedFixture.NodeId!="node"||encodedFixture.BootId!="boot"||encodedFixture.AgentBuild!="vnext-adp3-direct"||encodedFixture.LastStoredSnapshotGeneration!=42||!reflect.DeepEqual(encodedFixture.Capabilities,[]string{"native-capability"}){t.Fatal("hello pre-retry projection changed")}
}

func TestRunOriginalCredentialRenewalRetryReportAndRetirement(t *testing.T){
 failure:=errors.New("original-effect-error")
 for _,mode:=range []string{"rotate-retry","due-boundary","not-due","reload","relay-retry","relay-success","poll-error","report-error","empty","401","403","superseded","integrity"}{
  r,ctx,cancel:=newRunnerFixture();guardStopped:=make(chan struct{});r.clock.onTicker=func(ticker *tickerFixture){if ticker.interval==100*time.Millisecond{ticker.stopped=guardStopped}};r.pending=[]int{1};r.clock.onAfter=func(n int){limit:=1;if mode=="rotate-retry"{limit=3};if mode=="401"||mode=="403"||mode=="superseded"||mode=="relay-retry"||mode=="poll-error"||mode=="report-error"||mode=="integrity"{limit=2};if n==limit{cancel()}}
  switch mode{case "rotate-retry":r.options.Rotate=true;r.rotateFailures=[]error{failure,nil};case "due-boundary":r.clock.until=2*time.Minute;case "not-due":r.clock.until=2*time.Minute+time.Nanosecond;case "reload":r.reloadFailure=failure;case "relay-retry","relay-success":r.options.Relay=true;r.relayDue=true;if mode=="relay-retry"{r.renewFailure=failure};case "poll-error":r.pollFailure=failure;case "report-error":r.reportFailure=failure;case "empty":r.pending=nil;case "401":r.pollFailure=httpError{status:401};case "403":r.pollFailure=httpError{status:403};case "superseded":r.pollFailure=httpError{code:"SESSION_SUPERSEDED"};case "integrity":r.pollFailure=httpError{code:"INTEGRITY_FAILURE"}}
  err:=r.Run(ctx);cancel();if mode=="reload"{if err!=failure||r.polls!=0||len(r.clock.after)!=0{t.Fatal("reload original error/short circuit")};continue};if err!=context.Canceled{t.Fatal(mode,err)}
  if mode=="rotate-retry"{if r.rotations!=2||r.reloads!=3||r.polls!=3||r.trace.count("Credential rotation retry pending:")!=1{t.Fatal("rotation retry flag/reset")}}else if mode=="due-boundary"{if r.rotations!=1{t.Fatal("renewal equal bound not due")}}else if r.rotations!=0{t.Fatal("unexpected machine rotation",mode)}
  if mode=="relay-retry"{if r.renewals!=2||r.polls!=0||r.reports!=0||r.trace.count("Relay credential renewal retry pending:")!=2{t.Fatal("failed Relay renewal did not wait before reconcile")}}else if r.polls==0{t.Fatal("expected reconcile",mode)}
  if mode=="relay-success"&&(r.ensureCalls!=1||r.renewals!=1||r.reports!=1){t.Fatal("Relay success sequence")}
  retired:=mode=="401"||mode=="403"||mode=="superseded";if retired{equalFixture(t,r.clock.after,[]time.Duration{7*time.Second,time.Second});if r.polls!=1||r.reloads!=1||r.reports!=0{t.Fatal("retired loop resumed operational effects")}}else{for _,interval:=range r.clock.after{if interval!=7*time.Second{t.Fatal("poll retry interval",mode,interval)}}}
  if mode=="report-error"&&(r.reports!=2||r.polls!=2||r.trace.count("Agent report retry pending:")!=2){t.Fatal("report failure retry warning")}
  if (mode=="poll-error"||mode=="integrity")&&(r.polls!=2||r.reloads!=2){t.Fatal("non-retiring poll failure stopped retries",mode)}
  if (mode=="empty"||mode=="poll-error"||mode=="integrity")&&r.reports!=0{t.Fatal("report ran after poll failure or no pending")}
  // The original guard closes guardDone before its earlier deferred ticker.Stop.
  // Run joins guardDone; explicitly await the remaining deferred native effect.
  waitTickerStopFixture(t,guardStopped);if r.trace.count("ticker-stop:100ms")!=1||r.trace.count("idle-close")!=1||r.trace.count("stop")!=1{t.Fatal("Run guard join/final cleanup",mode,r.trace.events())}
 }
}

func TestRunOriginalWorkersCancelAndJoinBeforeReturning(t *testing.T){
 r,ctx,cancel:=newRunnerFixture();guardStopped:=make(chan struct{});r.clock.onTicker=func(ticker *tickerFixture){if ticker.interval==100*time.Millisecond{ticker.stopped=guardStopped}};r.options.Telemetry=true;r.options.ForwardTelemetry=true;r.options.HostTelemetry=true;r.options.ProbeTelemetry=true;r.options.Diagnostics="diagnostics";r.options.ProbeRegistration=true;r.options.ProbeExecution=true
 r.workerStarted=make(chan string,4);release:=make(chan struct{});r.workerRelease=release;entered:=make(chan struct{});r.onPoll=func(context.Context){for i:=0;i<4;i++{<-r.workerStarted};close(entered);cancel()}
 done:=make(chan error,1);go func(){done<-r.Run(ctx)}();<-entered
 select{case err:=<-done:t.Fatalf("Run returned before worker join %v",err);default:}
 close(release);select{case err:=<-done:if err!=context.Canceled{t.Fatal(err)};case <-time.After(5*time.Second):t.Fatal("Run failed to join cancelled workers")}
 for _,name:=range []string{"process","forward","host","probe"}{if r.trace.count("start:"+name)!=1||r.trace.count("cancel:"+name)!=1||r.trace.count("done:"+name)!=1{t.Fatal("worker lifecycle",name,r.trace.events())}}
 waitTickerStopFixture(t,guardStopped);for _,interval:=range []string{"100ms","500ms","10s"}{if r.trace.count("ticker:"+interval)!=1||r.trace.count("ticker-stop:"+interval)!=1{t.Fatal("ticker lifecycle",interval)}}
 if r.trace.count("diagnostic:true")!=1||r.trace.count("counter:true")!=1||r.trace.count("stop")!=2||r.trace.count("idle-close")!=1||r.revokes!=1||r.clock.timeoutCancels!=1{t.Fatal("diagnostic and registration finalization",r.trace.events())}
}

func TestRunOriginalRetirementCancelsRegistrationBeforeExecution(t *testing.T){
 r,ctx,cancel:=newRunnerFixture();defer cancel();r.options.ProbeRegistration=true;r.options.ProbeExecution=true;r.pollFailure=httpError{status:401};r.revoked=make(chan struct{})
 registered:=make(chan struct{});execution:=make(chan context.Context,1)
 r.onRegister=func(work context.Context,_ int)(*registeredProbe,error){close(registered);<-work.Done();return nil,work.Err()}
 r.onTask=func(work context.Context,_ int)error{execution<-work;<-work.Done();return work.Err()}
 var executionContext context.Context;r.onPoll=func(context.Context){<-registered;executionContext=<-execution}
 r.clock.onAfter=func(n int){if n==1{<-r.revoked;if executionContext.Err()!=nil{panic("retirement also cancelled execution context")}}else{cancel()}}
 if err:=r.Run(ctx);err!=context.Canceled{t.Fatal(err)};equalFixture(t,r.clock.after,[]time.Duration{7*time.Second,time.Second});if r.registrations!=1||r.tasks!=1||r.revokes!=1||executionContext.Err()!=context.Canceled{t.Fatal("retirement child context boundary")}
}

func TestProbeOriginalRegistrationBackoffResetSessionEndAndCleanup(t *testing.T){
 failure:=errors.New("registration unavailable")
 for _,mode:=range []string{"backoff","success-reset","minimum","ended","401","403","superseded","integrity"}{
  r,ctx,cancel:=newRunnerFixture();var session *registeredProbe
  r.onRegister=func(_ context.Context,n int)(*registeredProbe,error){switch mode{case "401":return nil,httpError{status:401};case "403":return nil,httpError{status:403};case "superseded":return nil,httpError{code:"SESSION_SUPERSEDED"};case "integrity":return nil,httpError{code:"INTEGRITY_FAILURE"};case "success-reset":if n==3{session=&registeredProbe{until:time.Unix(200,0),done:make(chan struct{})};r.clock.until=12*time.Second;return session,nil};case "minimum","ended":session=&registeredProbe{until:time.Unix(200,0),done:make(chan struct{})};r.clock.until=time.Second;return session,nil};return nil,failure}
  r.clock.onTimer=func(n int,timer *timerFixture){limit:=7;if mode=="success-reset"{limit=5};if mode=="ended"{limit=2};if mode=="minimum"||mode=="integrity"{limit=1};if n==limit{cancel();return};if mode=="ended"{close(session.done);return};timer.ticks<-r.clock.now}
  r.maintainProbe(ctx);cancel();if r.revokes!=1||len(r.clock.timeoutContexts)!=1||r.clock.timeoutContexts[0].Err()!=nil||r.clock.timeoutDurations[0]!=2*time.Second||r.clock.timeoutCancels!=1||r.revokeContext.Err()!=context.Canceled{t.Fatal("independent bounded revoke cleanup")}
  switch mode{case "backoff":equalFixture(t,r.clock.waits,[]time.Duration{5*time.Second,10*time.Second,20*time.Second,30*time.Second,30*time.Second,30*time.Second,30*time.Second});case "success-reset":equalFixture(t,r.clock.waits,[]time.Duration{5*time.Second,10*time.Second,10*time.Second,5*time.Second,10*time.Second});case "minimum":equalFixture(t,r.clock.waits,[]time.Duration{time.Second});case "ended":equalFixture(t,r.clock.waits,[]time.Duration{time.Second,time.Second});case "401","403","superseded":if len(r.clock.waits)!=0||r.registrations!=1{t.Fatal("fatal registration retried")};case "integrity":equalFixture(t,r.clock.waits,[]time.Duration{5*time.Second})}
  for index,timer:=range r.clock.timers{expected:=0;if index==len(r.clock.timers)-1||mode=="ended"{expected=1};if timer.stops!=expected{t.Fatal("registration timer stop boundary",mode,index,timer.stops)}}
 }
 r,ctx,cancel:=newRunnerFixture();cancel();r.maintainProbe(ctx);if r.registrations!=0||r.revokes!=1||len(r.clock.waits)!=0{t.Fatal("cancelled registration start still performed work")}
}

func TestProbeOriginalExecutionOneSecondPostCompletionNoOverlap(t *testing.T){
 r,ctx,cancel:=newRunnerFixture();failure:=errors.New("failed task stays failed");taskFinished:=0
 r.onTask=func(_ context.Context,n int)error{if n!=taskFinished+1||len(r.clock.waits)!=n-1{panic("task overlapped or timer preceded completion")};taskFinished=n;return failure}
 r.clock.onTimer=func(n int,timer *timerFixture){if taskFinished!=n{panic("wait began before task completed")};if n==3{cancel()}else{timer.ticks<-r.clock.now}}
 r.maintainProbeExecution(ctx);cancel();equalFixture(t,r.clock.waits,[]time.Duration{time.Second,time.Second,time.Second});if r.tasks!=3||r.clock.timers[0].stops!=0||r.clock.timers[1].stops!=0||r.clock.timers[2].stops!=1{t.Fatal("execution retry/cancel boundary")}
 r,ctx,cancel=newRunnerFixture();cancel();r.maintainProbeExecution(ctx);if r.tasks!=0||len(r.clock.waits)!=0{t.Fatal("cancelled execution start still polled")}
}

func TestProbeOriginalMonitorDeadlineTicksAndDeferredCloseOrder(t *testing.T){
 for _,mode:=range []string{"cancel","deadline","foreign","stale","current"}{
  r,ctx,cancel:=newRunnerFixture();session:=&registeredProbe{ctx:ctx,cancel:cancel,done:make(chan struct{}),until:r.clock.now.Add(9*time.Second)};session.gate=&gateFixture{r.trace,ctx};r.clock.until=9*time.Second;r.probeRegistration=session;r.current=true
  switch mode{case "cancel":cancel();case "foreign":r.probeRegistration=&registeredProbe{};case "stale":r.current=false;case "current":r.onCurrent=cancel}
  r.clock.onTicker=func(ticker *tickerFixture){if mode=="foreign"||mode=="stale"||mode=="current"{ticker.ticks<-r.clock.now}}
  r.clock.onTimer=func(_ int,timer *timerFixture){if mode=="deadline"{timer.ticks<-r.clock.now}}
  r.monitorProbe(session);cancel();select{case <-session.done:default:t.Fatal("monitor done not closed")};equalFixture(t,r.clock.waits,[]time.Duration{9*time.Second});equalFixture(t,r.clock.untilInputs,[]time.Time{session.until})
  if r.clock.timers[0].stops!=1||r.trace.count("ticker:25ms")!=1||r.trace.count("ticker-stop:25ms")!=1||r.trace.count("gate-close")!=1{t.Fatal("monitor scheduling/finalization",mode,r.trace.events())}
  want:=0;if mode=="stale"||mode=="current"{want=1};if r.trace.count("probe-current")!=want{t.Fatal("monitor current-check short circuit",mode,r.trace.events())}
 }
}

func newWatchFixture(r *Runner)(*probeAuthorityWatch,context.CancelFunc){ctx,cancel:=context.WithCancel(context.Background());sessionCtx,sessionCancel:=context.WithCancel(context.Background());w:=&probeAuthorityWatch{ctx:ctx,cancel:cancel,done:make(chan struct{}),changed:make(chan struct{},1),until:r.clock.now.Add(time.Hour),freshUntil:r.clock.now.Add(30*time.Minute)};w.receipt.session=&registeredProbe{ctx:sessionCtx,cancel:sessionCancel};return w,sessionCancel}

func TestProbeOriginalSupervisorExactDeadlineRefreshChangedAndTicker(t *testing.T){
 failure:=errors.New("local authority ended")
 for _,mode:=range []string{"cancel","local","equal","expired","refreshed","changed","ticker"}{
  r,_,cancel:=newRunnerFixture();defer cancel();w,sessionCancel:=newWatchFixture(r);defer sessionCancel();defer w.cancel();var tick *tickerFixture;r.clock.onTicker=func(value *tickerFixture){tick=value};r.clock.until=5*time.Second
  if mode=="cancel"{w.cancel()};if mode=="local"{r.watchFailure=failure};if mode=="equal"{w.freshUntil=r.clock.now};if mode=="expired"{w.freshUntil=r.clock.now.Add(-time.Nanosecond)}
  originalDeadline:=minProbeDeadline(w.until,w.freshUntil)
  r.clock.onTimer=func(n int,timer *timerFixture){if n==2{w.cancel();return};switch mode{case "equal","expired":timer.ticks<-r.clock.now;case "refreshed":w.mutex.Lock();w.freshUntil=r.clock.now.Add(time.Hour);w.mutex.Unlock();timer.ticks<-r.clock.now;case "changed":w.changed<-struct{}{};case "ticker":tick.ticks<-r.clock.now}}
  done:=make(chan struct{});r.superviseProbeWatch(w,done);select{case <-done:default:t.Fatal("supervisor done not closed")}
  wantTimers:=1;if mode=="cancel"||mode=="local"{wantTimers=0};if mode=="refreshed"||mode=="changed"||mode=="ticker"{wantTimers=2};if len(r.clock.timers)!=wantTimers{t.Fatal("supervisor recheck",mode,r.clock.waits)}
  if mode=="local"&&w.err!=failure{t.Fatal("supervisor local failure identity")};if (mode=="equal"||mode=="expired")&&w.err!=errDeniedFixture{t.Fatal("supervisor deadline equality refusal")};if mode=="refreshed"&&w.err!=nil{t.Fatal("old timer incorrectly denied refreshed deadline")}
  if wantTimers>0&&!r.clock.untilInputs[0].Equal(originalDeadline){t.Fatal("supervisor did not schedule minimum deadline")};if mode=="refreshed"&&!r.clock.untilInputs[1].Equal(w.until){t.Fatal("supervisor failed to resample extended freshness at original execution cap")}
  for index,timer:=range r.clock.timers{wantStop:=1;if index==0&&(mode=="equal"||mode=="expired"||mode=="refreshed"){wantStop=0};if timer.stops!=wantStop||timer.interval!=5*time.Second{t.Fatal("supervisor timer stop/Until",mode,index,timer)}}
  if r.trace.count("ticker:25ms")!=1||r.trace.count("ticker-stop:25ms")!=1{t.Fatal("supervisor ticker forwarding")}
 }
}

func TestProbeOriginalWatchFortyPostCompletionPollsAndReleaseJoin(t *testing.T){
 failure:=errors.New("original status failure")
 for _,mode:=range []string{"forty","first-failure","later-failure","cancel","session-cancel"}{
  r,_,cancel:=newRunnerFixture();defer cancel();w,sessionCancel:=newWatchFixture(r);defer sessionCancel();defer w.cancel();statusWaits:=0
  r.onStatus=func(w *probeAuthorityWatch,n int)error{if statusWaits!=n-1{panic("status request overlapped or wait preceded completion")};switch mode{case "first-failure":return failure;case "later-failure":if n==2{return failure};case "session-cancel":sessionCancel();<-w.ctx.Done();return w.ctx.Err()};return nil}
  r.clock.onTimer=func(_ int,timer *timerFixture){if timer.interval!=probeStatusInterval{return};statusWaits++;if r.statusCount!=statusWaits{panic("status interval allocated before completion")};if mode=="cancel"{w.cancel();return};timer.ticks<-r.clock.now}
  first:=make(chan error,1);released:=0;r.runProbeWatch(w,first,func(){if w.ctx.Err()==nil||r.trace.count("ticker-stop:25ms")!=1{panic("release before supervisor cancellation/join")};select{case <-w.done:panic("done closed before release");default:};released++})
  select{case <-w.done:default:t.Fatal("watch done not closed after release")};if released!=1||r.trace.count("afterfunc")!=1||r.trace.count("afterfunc-stop")!=1{t.Fatal("watch callback/release lifetime")}
  firstResult:=<-first;select{case <-first:t.Fatal("more than one first status result");default:}
  wantPolls,wantWaits:=40,40;switch mode{case "first-failure":wantPolls,wantWaits=1,0;if firstResult!=failure||w.err!=failure{t.Fatal("first status failure identity")};case "later-failure":wantPolls,wantWaits=2,1;if firstResult!=nil||w.err!=failure{t.Fatal("later status retried or replaced original failure")};case "cancel":wantPolls,wantWaits=1,1;if firstResult!=nil||w.err!=context.Canceled{t.Fatal("cancelled wait result")};case "session-cancel":wantPolls,wantWaits=1,0;if w.err!=errDeniedFixture{t.Fatal("session AfterFunc authority cancellation")};case "forty":if firstResult!=nil||w.err!=context.Canceled{t.Fatal("bounded completion cancellation")}}
  if r.statusCount!=wantPolls||statusWaits!=wantWaits{t.Fatal("bounded watch attempts/postcompletion interval",mode,r.statusCount,statusWaits)}
 }
}
`

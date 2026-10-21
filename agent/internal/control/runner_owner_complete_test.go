package control

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/state"
)

type runnerOwnerStream struct {
	runner *Runner
	name   string
	events *[]string
	count  uint64
	closed int
	check  func() error
}

func (s *runnerOwnerStream) event(stage string) {
	if s.runner.mutex.TryLock() {
		s.runner.mutex.Unlock()
		panic("Runner lifecycle effect escaped original lock")
	}
	*s.events = append(*s.events, s.name+":"+stage)
}
func (s *runnerOwnerStream) Close()            { s.event("close"); s.closed++ }
func (s *runnerOwnerStream) Drain()            { s.event("drain") }
func (s *runnerOwnerStream) Remaining() uint64 { s.event("remaining"); return s.count }
func (s *runnerOwnerStream) SetAuthorization(check func() error) {
	s.event("authorization")
	s.check = check
}

func TestRunnerOwnerCompleteActualHelloBytesAndPartialStartupStop(t *testing.T) {
	r, _, clock, trace := newTimeOwnerRunner()
	r.options.Relay = false
	r.journal.Generation = 42
	r.instances = map[string]running{}
	events := []string{}
	current := &runnerOwnerStream{runner: r, name: "current", events: &events}
	drain := &runnerOwnerStream{runner: r, name: "retiring", events: &events}
	r.instances["tcp/1"] = running{stream: current}
	r.drains = map[string]draining{"old": {instance: running{stream: drain}}}
	failure := httpError{status: 401, code: "AUTHENTICATION_FAILED"}
	requests := 0
	r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
		requests++
		want := `{"protocolVersion":3,"nodeId":"node","bootId":"boot","agentBuild":"vnext-adp3-direct","capabilities":["adp.3","native.direct.v1","tcp","udp","shared-resource-limits.v1"],"lastStoredSnapshotGeneration":42}`
		if method != "POST" || path != "/agent/v3/hello" || epoch || session != 2 || string(body) != want {
			t.Fatal("original Hello bytes and channel flags", method, path, epoch, session, string(body))
		}
		return nil, failure
	}}
	if err := r.Run(context.Background()); err != failure || requests != 1 || clock.calls != 1 {
		t.Fatal("early Run failure changed", err, trace.values())
	}
	if !reflect.DeepEqual(events, []string{"current:close", "retiring:close"}) || current.closed != 1 || drain.closed != 1 || len(r.instances) != 0 || len(r.drains) != 0 || !r.probeStopped {
		t.Fatal("partial startup deferred stop", events)
	}
	if !reflect.DeepEqual(trace.values(), []string{"now", "request:/agent/v3/hello", "close-idle"}) {
		t.Fatal("early defer order", trace.values())
	}
	r.stop()
	r.stop()
	if current.closed != 1 || drain.closed != 1 {
		t.Fatal("stop repeated removed engine cleanup")
	}
}

func runnerOwnerAssignment(t *testing.T, generation uint64) adp3.Assignment {
	t.Helper()
	target := adp3.Target{Host: "127.0.0.1", Port: 12345 + generation}
	revision := uint64(1)
	metadata := false
	cidrs := []string{"127.0.0.0/8"}
	config := adp3.RuntimeConfig{Target: &target, EgressPolicyRevision: &revision, AllowMetadataTargets: &metadata, AllowedDestinationCidrs: &cidrs}
	digest, err := contracts.ComputeDigest(config)
	if err != nil {
		t.Fatal(err)
	}
	return adp3.Assignment{AssignmentId: "assignment", ForwardId: "forward", ForwardRevision: generation, DeploymentGeneration: generation, BindingFence: generation, Role: "direct", Protocol: "tcp", Phase: "active", Resource: adp3.Resource{Address: "127.0.0.1", Port: 23456, Protocol: "tcp"}, Driver: adp3.Driver{Id: "native.direct.v1", SchemaVersion: 1, Config: config, ConfigDigest: digest}, DrainTimeoutSeconds: 20}
}
func runnerOwnerSnapshot(t *testing.T, now time.Time, generation uint64, assignments []adp3.Assignment) (adp3.Snapshot, []byte) {
	t.Helper()
	body := map[string]any{"protocolVersion": 3, "nodeId": "node", "sessionEpoch": 2, "snapshotGeneration": generation, "complete": true, "issuedAt": now.Add(-time.Second).Format(time.RFC3339Nano), "validUntil": now.Add(time.Minute).Format(time.RFC3339Nano), "assignments": assignments, "tombstones": []adp3.Tombstone{}}
	digest, err := contracts.ComputeDigest(body)
	if err != nil {
		t.Fatal(err)
	}
	body["snapshotDigest"] = digest
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := nativeexecution.DecodeRunnerSnapshot(raw)
	if err != nil {
		t.Fatal("native snapshot baseline", err)
	}
	return snapshot, raw
}
func newRunnerOwnerPoll(t *testing.T) (*Runner, *timeOwnerSchedule, *timeOwnerTrace, adp3.Assignment) {
	t.Helper()
	r, _, clock, trace := newTimeOwnerRunner()
	r.options.Relay = false
	r.options.Journal = filepath.Join(t.TempDir(), "journal.json")
	r.key = bytes.Repeat([]byte{31}, 32)
	r.hello.Policy = timeOwnerPolicy()
	r.instances = map[string]running{}
	r.drains = map[string]draining{}
	r.clock = func() (authorization.Sample, error) {
		return authorization.Sample{Wall: clock.now, Uptime: time.Hour}, nil
	}
	if err := r.initializeGuard(); err != nil {
		t.Fatal(err)
	}
	ticket, err := r.guard.Accept(clock.now.Add(-time.Second), clock.now.Add(40*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	r.ticket = ticket
	r.deadline = ticket.Deadline()
	if err := state.InitializeRuntimeJournal(r.options.Journal, r.key, "node"); err != nil {
		t.Fatal(err)
	}
	current, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
	if err != nil {
		t.Fatal(err)
	}
	old := runnerOwnerAssignment(t, 1)
	snapshot, _ := runnerOwnerSnapshot(t, clock.now, 1, []adp3.Assignment{old})
	stored, err := state.AcceptRuntimeSnapshot(r.options.Journal, r.key, current, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	r.runtimeState = stored
	r.journal = stored.Journal
	return r, clock, trace, old
}

func TestRunnerOwnerCompleteOriginalReplacementDrainFallbackAndPhase(t *testing.T) {
	for _, mode := range []string{"replace-success", "fallback-success", "fallback-error", "start-error", "same-phase-error", "remove"} {
		t.Run(mode, func(t *testing.T) {
			r, clock, trace, old := newRunnerOwnerPoll(t)
			events := []string{}
			previous := &runnerOwnerStream{runner: r, name: "old", events: &events, count: 3}
			fresh := &runnerOwnerStream{runner: r, name: "new", events: &events, count: 5}
			partial := &runnerOwnerStream{runner: r, name: "partial", events: &events}
			oldDeadline := r.deadline
			if mode != "start-error" {
				r.instances["tcp/23456"] = running{assignment: old, stream: previous, ticket: r.ticket}
			}
			next := runnerOwnerAssignment(t, 2)
			if mode == "same-phase-error" {
				next = old
			}
			assignments := []adp3.Assignment{next}
			if mode == "remove" {
				assignments = []adp3.Assignment{}
			}
			_, raw := runnerOwnerSnapshot(t, clock.now, 2, assignments)
			r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
				if method != "GET" || path != "/agent/v3/snapshot?sinceGeneration=1" || body != nil || !epoch || session != 2 {
					t.Fatal("poll exact request", method, path, string(body), epoch, session)
				}
				return raw, nil
			}}
			failure := errors.New("original driver failure")
			driver := nativeDirectDriver()
			locked := func() {
				if r.mutex.TryLock() {
					r.mutex.Unlock()
					t.Fatal("driver escaped Runner mutex")
				}
				stored, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
				if err != nil || stored.Journal.Generation != 2 {
					t.Fatal("driver before durable original acceptance", err)
				}
			}
			driver.replace = func(stream execution, a adp3.Assignment, check func() error) (execution, error) {
				locked()
				events = append(events, "replace")
				if stream != previous || !reflect.DeepEqual(a, next) || check() != nil || r.ticket == nil {
					t.Fatal("replacement inputs")
				}
				if mode == "replace-success" {
					return fresh, nil
				}
				return partial, failure
			}
			driver.start = func(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
				locked()
				events = append(events, "start")
				if host.nodeID != "node" || host.sessionEpoch != 2 || host.policy != r.hello.Policy || host.relayIdentity != nil || !reflect.DeepEqual(a, next) || check() != nil {
					t.Fatal("driver original Host/assignment/check")
				}
				if mode == "fallback-error" || mode == "start-error" {
					return partial, failure
				}
				return fresh, nil
			}
			driver.phase = func(stream execution, phase string) error {
				locked()
				events = append(events, "phase:"+phase)
				if stream != previous || phase != "active" || previous.check == nil || previous.check() != nil {
					t.Fatal("phase before renewed authorization")
				}
				return failure
			}
			driver.classify = func(err error) (string, bool) {
				locked()
				events = append(events, "classify")
				if err != failure {
					t.Fatal("classification replaced driver failure")
				}
				return "PORT_IN_USE", true
			}
			registry, err := newExecutionRegistry(driver)
			if err != nil {
				t.Fatal(err)
			}
			originalRegistry := builtinExecutionDrivers
			builtinExecutionDrivers = registry
			defer func() { builtinExecutionDrivers = originalRegistry }()
			if err := r.poll(context.Background()); err != nil {
				t.Fatal("original reconciliation", err, events)
			}
			want := []string{}
			switch mode {
			case "replace-success":
				want = []string{"replace", "old:authorization", "old:drain", "old:remaining"}
			case "fallback-success":
				want = []string{"replace", "old:authorization", "old:drain", "start", "old:remaining"}
			case "fallback-error":
				want = []string{"replace", "old:authorization", "old:drain", "start", "classify", "old:remaining"}
			case "start-error":
				want = []string{"start", "classify"}
			case "same-phase-error":
				want = []string{"old:authorization", "phase:active", "classify"}
			case "remove":
				want = []string{"old:authorization", "old:drain", "old:remaining"}
			}
			if !reflect.DeepEqual(events, want) {
				t.Fatal("replacement then drain then fallback/phase order", events, want)
			}
			if partial.closed != 0 {
				t.Fatal("Runner changed partial error-result ownership")
			}
			if r.sequence != 1 || r.journal.Generation != 2 || r.ticket == nil || r.deadline.Equal(oldDeadline) {
				t.Fatal("accepted ticket/history/sequence not published")
			}
			report := nativeexecution.DecodePendingRunnerReport(r.pending)
			if report.ReportSequence != 1 || report.ObservedAt != clock.now.UTC().Format(time.RFC3339Nano) || report.AcceptedSnapshotGeneration != 2 || report.NodeId != "node" || report.BootId != "boot" || report.SessionEpoch != 2 {
				t.Fatal("real poll report projection", string(r.pending))
			}
			hasOld := mode == "replace-success" || mode == "fallback-success" || mode == "fallback-error" || mode == "remove"
			if (len(r.drains) == 1) != hasOld {
				t.Fatal("old instance drain ownership", r.drains)
			}
			if hasOld {
				drain := r.drains[nativeexecution.RunnerDrainKey("assignment", 1, 1)]
				if drain.instance.stream != previous || drain.instance.ticket == r.ticket || !drain.deadline.Equal(clock.now.Add(20*time.Second)) || len(report.Drains) != 1 || report.Drains[0].Condition != "draining" || report.Drains[0].RemainingConnections != 3 {
					t.Fatal("old drain lost ticket/deadline/native projection", drain, report.Drains)
				}
			}
			wantCurrent := mode == "replace-success" || mode == "fallback-success" || mode == "same-phase-error"
			if (len(r.instances) == 1) != wantCurrent {
				t.Fatal("replacement publication", r.instances)
			}
			if wantCurrent {
				entry := r.instances["tcp/23456"]
				expected := execution(fresh)
				if mode == "same-phase-error" {
					expected = previous
				}
				if entry.stream != expected || entry.ticket != r.ticket || !reflect.DeepEqual(entry.assignment, next) {
					t.Fatal("current reference/ticket/assignment", entry)
				}
			}
			if mode == "remove" {
				if len(report.Observations) != 0 {
					t.Fatal("removed instance invented observation")
				}
			} else {
				if len(report.Observations) != 1 {
					t.Fatal("fallback appended duplicate observation", report.Observations)
				}
				observation := report.Observations[0]
				failed := mode == "fallback-error" || mode == "start-error" || mode == "same-phase-error"
				if (observation.Condition == "error") != failed || observation.Retryable != failed || (observation.ErrorCode != nil) != failed {
					t.Fatal("driver error/ready report", observation)
				}
				if failed && *observation.ErrorCode != "PORT_IN_USE" {
					t.Fatal("classification code lost")
				}
			}
		})
	}
}

func TestRunnerOwnerCompleteRetainedJSONErrorsAndSequenceAfterLifecycle(t *testing.T) {
	for _, mode := range []string{"retained-corrupt", "retained-unknown", "sequence"} {
		t.Run(mode, func(t *testing.T) {
			r, clock, trace, _ := newRunnerOwnerPoll(t)
			_, raw := runnerOwnerSnapshot(t, clock.now, 2, []adp3.Assignment{})
			r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(string, string, []byte, bool, uint64) ([]byte, error) { return raw, nil }}
			if mode == "retained-corrupt" {
				r.journal.Snapshot = []byte(`{`)
			} else if mode == "retained-unknown" {
				r.journal.Snapshot = []byte(`{"future":true,"assignments":[]}`)
			} else {
				r.sequence = contracts.MaxCounter
			}
			oldGeneration := r.journal.Generation
			err := r.poll(context.Background())
			switch mode {
			case "retained-corrupt":
				if err == nil || err.Error() != "INTEGRITY_FAILURE: persisted snapshot corrupted" || r.journal.Generation != oldGeneration || len(r.pending) != 0 {
					t.Fatal("retained corrupt bytes refusal", err)
				}
			case "retained-unknown":
				if err != nil || r.journal.Generation != 2 || len(r.pending) == 0 {
					t.Fatal("retained JSON-only path became strict", err)
				}
			case "sequence":
				if err == nil || err.Error() != "RESOURCE_LIMIT: Report sequence exhausted" || r.sequence != contracts.MaxCounter || r.journal.Generation != 2 || r.ticket == nil || len(r.pending) != 0 {
					t.Fatal("sequence failure moved before original acceptance/publication", err)
				}
			}
		})
	}
}

func TestRunnerOwnerCompletePendingPartialDecodeAfterStrictLiveAck(t *testing.T) {
	for _, strictFailure := range []bool{false, true} {
		t.Run(fmtBoolRunnerOwner(strictFailure), func(t *testing.T) {
			r, _, _, trace := newTimeOwnerRunner()
			r.sequence = 7
			r.pending = []byte(`{"nodeId":"local","reportSequence":"partial type error","drains":[{"assignmentId":"removed","deploymentGeneration":4,"bindingFence":5,"condition":"removed"},{"assignmentId":"active","deploymentGeneration":4,"bindingFence":5,"condition":"draining"}]}`)
			removed := nativeexecution.RunnerDrainKey("removed", 4, 5)
			active := nativeexecution.RunnerDrainKey("active", 4, 5)
			r.drains = map[string]draining{removed: {}, active: {}}
			before := append([]byte(nil), r.pending...)
			r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
				if method != "POST" || path != "/agent/v3/report" || !bytes.Equal(body, before) || !epoch || session != 2 {
					t.Fatal("pending original bytes lost")
				}
				raw := []byte(`{"protocolVersion":3,"nodeId":"node","bootId":"boot","sessionEpoch":2,"reportSequence":7,"status":"accepted"}`)
				if strictFailure {
					raw = append(append([]byte(nil), raw[:len(raw)-1]...), []byte(`,"future":true}`)...)
				}
				return raw, nil
			}}
			err := r.report(context.Background())
			if strictFailure {
				if err == nil || !bytes.Equal(r.pending, before) || len(r.drains) != 2 {
					t.Fatal("strict live ACK failure published best-effort local state", err)
				}
			} else {
				if err != nil || r.pending != nil || len(r.drains) != 1 {
					t.Fatal("local partial report was made strict", err)
				}
				if _, exists := r.drains[active]; !exists {
					t.Fatal("partial local decode retired active drain")
				}
			}
		})
	}
}
func fmtBoolRunnerOwner(value bool) string {
	if value {
		return "strict-live-refusal"
	}
	return "best-effort-local"
}

// Reuse the frozen scheduling collaborators, executing only a new supplemental
// case. The current seven loop owners are restaged so every helper compiles;
// only the Hello encoder's returned bytes/error are injected for this case.
func TestRunnerOwnerCompleteOriginalRunIgnoresLocalHelloMarshalError(t *testing.T) {
	set := token.NewFileSet()
	fixture := &ast.File{Name: ast.NewIdent("control")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"context", "errors", "fmt", "time"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: strconvQuoteRunnerOwner(path)}})
	}
	fixture.Decls = append(fixture.Decls, imports)
	for _, entry := range [][2]string{{"runner.go", "Run"}, {"probe_registration.go", "maintainProbe"}, {"probe_workflow.go", "maintainProbeExecution"}, {"probe_registration.go", "monitorProbe"}, {"probe_authority_watch.go", "superviseProbeWatch"}, {"probe_authority_watch.go", "runProbeWatch"}, {"probe_claim.go", "minProbeDeadline"}} {
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
				if literal, ok := node.(*ast.CompositeLit); ok {
					if selector, ok := literal.Type.(*ast.SelectorExpr); ok {
						if owner, ok := selector.X.(*ast.Ident); ok && owner.Name == "adp3" && selector.Sel.Name == "HelloRequest" {
							literal.Type = ast.NewIdent("helloRequestFixture")
						}
					}
				}
				if call, ok := node.(*ast.CallExpr); ok {
					if selector, ok := call.Fun.(*ast.SelectorExpr); ok {
						if owner, ok := selector.X.(*ast.Ident); ok && owner.Name == "nativeexecution" && (selector.Sel.Name == "EncodeRunnerHello" || selector.Sel.Name == "DecodeRunnerHello" || selector.Sel.Name == "ParseWireTime") {
							call.Fun = ast.NewIdent(selector.Sel.Name + "Fixture")
						}
					}
					for index, arg := range call.Args {
						if selector, ok := arg.(*ast.SelectorExpr); ok {
							if owner, ok := selector.X.(*ast.Ident); ok && owner.Name == "probe" && selector.Sel.Name == "ErrDenied" {
								call.Args[index] = ast.NewIdent("errDeniedFixture")
							}
						}
					}
				}
				return true
			})
			fixture.Decls = append(fixture.Decls, function)
		}
		if found != 1 {
			t.Fatal("original scheduling owner missing", entry)
		}
	}
	oldEncoder := `func EncodeRunnerHelloFixture(value helloRequestFixture)([]byte,error){encodedFixture=value;return []byte("original-hello-bytes"),nil}`
	newEncoder := `var helloMarshalBytesFixture []byte
var helloMarshalFailureFixture error
func EncodeRunnerHelloFixture(value helloRequestFixture)([]byte,error){encodedFixture=value;return helloMarshalBytesFixture,helloMarshalFailureFixture}`
	if strings.Count(schedulingOwnerCompleteFixture, oldEncoder) != 1 || strings.Count(schedulingOwnerCompleteFixture, `string(body)!="original-hello-bytes"`) != 1 {
		t.Fatal("frozen collaborator Hello boundary changed")
	}
	effects := strings.Replace(schedulingOwnerCompleteFixture, oldEncoder, newEncoder, 1)
	effects = strings.Replace(effects, `string(body)!="original-hello-bytes"`, `!reflect.DeepEqual(body,helloMarshalBytesFixture)`, 1) + runnerOwnerIgnoredHelloCase
	var source bytes.Buffer
	if err := format.Node(&source, set, fixture); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	for name, raw := range map[string][]byte{"go.mod": []byte("module runner-local-marshal-effects\n\ngo 1.26.3\n"), "original.go": source.Bytes(), "effects_test.go": []byte(effects)} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", "-run", "^TestRunnerWireOriginalIgnoredHelloMarshal$", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("original Run ignored local Hello marshal failure: %v\n%s", err, output)
	}
}
func strconvQuoteRunnerOwner(value string) string { return `"` + value + `"` }

const runnerOwnerIgnoredHelloCase = `
func TestRunnerWireOriginalIgnoredHelloMarshal(t *testing.T){for _,raw:=range [][]byte{nil,[]byte("partial bytes from failed local marshal")}{r,ctx,cancel:=newRunnerFixture();helloMarshalBytesFixture=raw;helloMarshalFailureFixture=errors.New("local original marshal failed");fatal:=httpError{status:401};r.helloFailures=[]error{fatal};err:=r.Run(ctx);cancel();if err!=fatal||r.requestCount!=1||len(r.clock.after)!=0||r.trace.count("idle-close")!=1||r.trace.count("stop")!=1{t.Fatal("local Marshal failure replaced original request/cleanup",err,r.trace.events())};if encodedFixture.ProtocolVersion!=3||encodedFixture.LastStoredSnapshotGeneration!=42||encodedFixture.NodeId!="node"||encodedFixture.BootId!="boot"||encodedFixture.AgentBuild!="vnext-adp3-direct"||!reflect.DeepEqual(encodedFixture.Capabilities,[]string{"native-capability"}){t.Fatal("original Hello projection changed")}}}
`

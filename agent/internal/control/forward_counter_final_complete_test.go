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

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/payloadstats"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type forwardFinalClock struct {
	runtimeplatform.Scheduler
	runner  *Runner
	samples []time.Time
	calls   int
	trace   *[]string
	locked  bool
}

func (c *forwardFinalClock) Now() time.Time {
	acquired := c.runner.mutex.TryLock()
	if acquired {
		c.runner.mutex.Unlock()
	}
	if acquired == c.locked {
		panic("Forward sample Runner lock scope changed")
	}
	c.calls++
	if c.trace != nil {
		*c.trace = append(*c.trace, fmt.Sprint("now:", c.calls))
	}
	return c.samples[min(c.calls-1, len(c.samples)-1)]
}

type forwardFinalStream struct {
	execution
	runner    *Runner
	values    payloadstats.Snapshot
	available bool
	locked    bool
	reads     int
	name      string
	trace     *[]string
	afterRead func()
}

func (s *forwardFinalStream) PayloadCounters() (payloadstats.Snapshot, bool) {
	acquired := s.runner.mutex.TryLock()
	if acquired {
		s.runner.mutex.Unlock()
	}
	if acquired == s.locked {
		panic("Forward payload observation Runner lock scope changed")
	}
	s.reads++
	if s.trace != nil {
		*s.trace = append(*s.trace, "payload:"+s.name)
	}
	values, available := s.values, s.available
	if s.afterRead != nil {
		s.afterRead()
	}
	return values, available
}
func forwardFinalAssignment(id string) adp3.Assignment {
	return adp3.Assignment{AssignmentId: id, ForwardId: "forward", ForwardRevision: 3, DeploymentGeneration: 5, BindingFence: 7, Role: "direct", Protocol: "tcp", Phase: "active", Driver: adp3.Driver{Id: "native.direct.v1", SchemaVersion: 1, ConfigDigest: "digest"}, Resource: adp3.Resource{Protocol: "tcp", Address: "192.0.2.1", Port: 443}}
}
func forwardFinalRunner(now time.Time) (*Runner, *forwardFinalClock) {
	r := &Runner{options: Options{NodeID: "node", BootID: "boot", ForwardTelemetry: true}, hello: adp3.HelloResponse{SessionEpoch: 9}, instances: map[string]running{}, drains: map[string]draining{}}
	clock := &forwardFinalClock{runner: r, samples: []time.Time{now}}
	r.effects.Schedule = clock
	return r, clock
}
func forwardFinalTail(r *Runner, id, epoch string, at time.Time) forwardCounterTail {
	return forwardCounterTail{identity: r.forwardCounterIdentityLocked(running{assignment: forwardFinalAssignment(id)}), phase: "draining", counters: payloadstats.Snapshot{Epoch: epoch, PayloadSentBytes: 2}, available: true, endedAt: at}
}

func TestForwardFinalPointNativeUTCMaxValuesAndDetachedOptionalPointers(t *testing.T) {
	identity := forwardCounterIdentity{NodeID: "node", Resource: forwardCounterResource{Protocol: "udp", Address: "192.0.2.1", Port: 53}}
	for _, stamp := range []time.Time{time.Time{}, time.Unix(0, 0), time.Unix(-1, 999999999), time.Date(2026, 10, 20, 1, 2, 3, 123456789, time.FixedZone("offset", 8*3600))} {
		for _, state := range []string{"current", "draining", "terminal"} {
			for _, available := range []bool{false, true} {
				values := payloadstats.Snapshot{Epoch: "native-epoch", PayloadSentBytes: ^uint64(0), PayloadReceivedBytes: ^uint64(0), TCPAccepted: ^uint64(0), TCPConnected: ^uint64(0), TCPClosed: ^uint64(0), UDPAssociationsCreated: ^uint64(0), UDPAssociationsClosed: ^uint64(0), UDPDatagramsSent: ^uint64(0), UDPDatagramsReceived: ^uint64(0), Overflowed: true}
				point := newForwardCounterPoint(identity, "active", state, stamp, values, available)
				if point.Identity != identity || point.Phase != "active" || point.State != state || point.CapturedAt != stamp.UTC().Format(time.RFC3339Nano) {
					t.Fatal("Forward point identity/input time projection", point)
				}
				if state == "terminal" {
					if point.EndedAt == nil || *point.EndedAt != point.CapturedAt || point.EndedAt == &point.CapturedAt {
						t.Fatal("terminal timestamp local pointer semantics")
					}
				} else if point.EndedAt != nil {
					t.Fatal("nonterminal EndedAt invented")
				}
				if available {
					want := "18446744073709551615"
					expected := forwardCounterValues{PayloadSentBytes: want, PayloadReceivedBytes: want, TCPAccepted: want, TCPConnected: want, TCPClosed: want, UDPAssociationsCreated: want, UDPAssociationsClosed: want, UDPDatagramsSent: want, UDPDatagramsReceived: want}
					if point.Availability != "available" || point.CounterEpoch == nil || *point.CounterEpoch != "native-epoch" || point.CounterEpoch == &values.Epoch || point.Overflowed == nil || !*point.Overflowed || point.Overflowed == &values.Overflowed || !reflect.DeepEqual(point.Counters, &expected) {
						t.Fatal("Forward counters truncated or aliased", point)
					}
					values.Epoch = "late"
					values.Overflowed = false
					if *point.CounterEpoch != "native-epoch" || !*point.Overflowed {
						t.Fatal("source mutation reached copied point")
					}
				} else {
					if point.Availability != "unavailable" || point.CounterEpoch != nil || point.Counters != nil || point.Overflowed != nil {
						t.Fatal("unavailable Forward measurement invented values")
					}
					raw, err := observationwire.EncodeValue(point)
					if err != nil || !bytes.Contains(raw, []byte(`"counterEpoch":null,"counters":null,"overflowed":null`)) {
						t.Fatal("unavailable explicit JSON null", err, string(raw))
					}
				}
			}
		}
	}
}

func TestForwardFinalPageSamplesBeforeLockAfterPayloadAndAfterFrozenMetadata(t *testing.T) {
	initial := time.Date(2026, 10, 20, 1, 2, 3, 100, time.FixedZone("offset", 3600))
	r, clock := forwardFinalRunner(initial)
	trace := []string{}
	clock.trace = &trace
	clock.samples = []time.Time{initial, initial.Add(time.Hour), initial.Add(2 * time.Hour)}
	r.journal.Generation = 17
	r.forwardCounterTailsEvicted = 2
	r.forwardCounterTailsExpired = 3
	assignment := forwardFinalAssignment("a-current")
	stream := &forwardFinalStream{runner: r, values: payloadstats.Snapshot{Epoch: "live", PayloadSentBytes: 11}, available: true, name: "live", trace: &trace}
	r.instances["current"] = running{assignment: assignment, stream: stream}
	tail := forwardFinalTail(r, "z-terminal", "old", initial.Add(-9*time.Minute))
	r.forwardCounterTails = []forwardCounterTail{tail}
	stream.afterRead = func() {
		r.options.NodeID = "later-node"
		r.options.BootID = "later-boot"
		r.hello.SessionEpoch = 77
		r.journal.Generation = 99
		r.forwardCounterTailsEvicted = 100
		r.forwardCounterTailsExpired = 101
		changed := r.instances["current"]
		changed.assignment.ForwardRevision = 1000
		changed.assignment.Phase = "prepared"
		r.instances["current"] = changed
	}
	page := r.captureForwardCounterPage(true, 2)
	if !reflect.DeepEqual(trace, []string{"now:1", "payload:live", "now:2", "now:3"}) || clock.calls != 3 || stream.reads != 1 {
		t.Fatal("Forward sample point timing", trace)
	}
	if page.nodeID != "node" || page.bootID != "boot" || page.sessionEpoch != 9 || page.SnapshotGeneration != 17 || page.CapturedAt != clock.samples[2].UTC().Format(time.RFC3339Nano) || !page.Final || page.Coverage.TailsEvicted != "2" || page.Coverage.TailsExpired != "3" {
		t.Fatal("late source state changed frozen page metadata", page)
	}
	if len(page.Items) != 2 || page.Items[0].Identity.AssignmentID != "a-current" || page.Items[0].Identity.ForwardRevision != 3 || page.Items[0].Identity.NodeID != "node" || page.Items[0].Phase != "active" || page.Items[0].CapturedAt != clock.samples[1].UTC().Format(time.RFC3339Nano) || page.Items[1].Identity.AssignmentID != "z-terminal" || page.Items[1].CapturedAt != tail.endedAt.UTC().Format(time.RFC3339Nano) || page.Items[1].EndedAt == nil || *page.Items[1].EndedAt != page.Items[1].CapturedAt {
		t.Fatal("point sampling/terminal timestamp or captured reference changed", page.Items)
	}
	if len(r.forwardCounterTails) != 1 {
		t.Fatal("final envelope time incorrectly repeated retention")
	}
	want := r.forwardCounterIdentityLocked(running{assignment: assignment})
	want.NodeID = "node"
	want.BootID = "boot"
	want.SessionEpoch = 9
	if page.Items[0].Identity != want {
		t.Fatal("complete assignment/resource identity not frozen before payload observer")
	}
}

func TestForwardFinalLocalAndRemoteSortedCursorRotationsAreIndependent(t *testing.T) {
	now := time.Unix(100, 0)
	r, clock := forwardFinalRunner(now)
	for index := 259; index >= 0; index-- {
		id := fmt.Sprintf("a%03d", index)
		stream := &forwardFinalStream{runner: r, values: payloadstats.Snapshot{Epoch: "e"}, available: true}
		r.instances[id] = running{assignment: forwardFinalAssignment(id), stream: stream}
	}
	first := r.captureForwardCounterPage(false, 2)
	local := r.captureForwardCounters(true)
	next := r.captureForwardCounterPage(false, 2)
	localNext := r.captureForwardCounters(false)
	if first.Items[0].Identity.AssignmentID != "a000" || first.Items[1].Identity.AssignmentID != "a001" || local.Items[0].Identity.AssignmentID != "a000" || local.Items[255].Identity.AssignmentID != "a255" || next.Items[0].Identity.AssignmentID != "a002" || next.Items[1].Identity.AssignmentID != "a003" || localNext.Items[0].Identity.AssignmentID != "a256" || localNext.Items[3].Identity.AssignmentID != "a259" || localNext.Items[4].Identity.AssignmentID != "a000" {
		t.Fatal("native Forward sorted page rotation changed")
	}
	if r.forwardTelemetryCursor != 4 || r.forwardCounterCursor != 512 || clock.calls != 4*262 {
		t.Fatal("local remote cursor or point clock isolation", r.forwardTelemetryCursor, r.forwardCounterCursor, clock.calls)
	}
	if local.Coverage != (forwardCounterCoverage{Limit: 256, Available: 260, Returned: 256, Omitted: 4, Truncated: true, Offset: 0, NextOffset: 256, TailLimit: 128, TailRetentionSeconds: 600, TailsEvicted: "0", TailsExpired: "0", HistoryComplete: false}) || !local.Final || localNext.Coverage.Offset != 256 || localNext.Coverage.NextOffset != 252 {
		t.Fatal("native local JSON coverage/cursor fields", local.Coverage, localNext.Coverage)
	}
	for _, entry := range []struct {
		limit      int
		cursor     uint64
		wantLimit  int
		wantCursor uint64
	}{{0, ^uint64(0), 1, 0}, {-5, 0, 1, 1}, {999, ^uint64(0) - 256, 256, ^uint64(0)}, {256, ^uint64(0), 256, 0}} {
		r, clock := forwardFinalRunner(now)
		if entry.wantLimit < 256 {
			r.forwardTelemetryCursor = entry.cursor
		} else {
			r.forwardCounterCursor = entry.cursor
		}
		page := r.captureForwardCounterPage(false, entry.limit)
		if page.Items == nil || len(page.Items) != 0 || clock.calls != 2 || page.Coverage.Limit != entry.wantLimit || page.Coverage.Offset != 0 || page.Coverage.NextOffset != 0 {
			t.Fatal("empty/clamped local page", entry, page)
		}
		selected := r.forwardCounterCursor
		if entry.wantLimit < 256 {
			selected = r.forwardTelemetryCursor
		}
		if selected != entry.wantCursor {
			t.Fatal("original cursor exhaustion inequality", entry, selected)
		}
		raw, err := observationwire.EncodeValue(page.ForwardCounterSnapshot)
		if err != nil || !bytes.Contains(raw, []byte(`"items":[]`)) {
			t.Fatal("empty local Items became null", err, string(raw))
		}
	}
}

func TestForwardFinalLocalKeyOrderDedupTerminalAndUnavailableSemantics(t *testing.T) {
	now := time.Unix(100, 0)
	r, _ := forwardFinalRunner(now)
	for _, entry := range []struct{ id, epoch string }{{"z", "e"}, {"aa", "e"}, {"a\"", "e"}, {"a", "e2"}, {"a", "e10"}, {"a", "e1"}} {
		r.forwardCounterTails = append(r.forwardCounterTails, forwardFinalTail(r, entry.id, entry.epoch, now))
	}
	foreignNode := forwardFinalTail(r, "foreign-node", "e", now)
	foreignNode.identity.NodeID = "foreign"
	foreignBoot := forwardFinalTail(r, "foreign-boot", "e", now)
	foreignBoot.identity.BootID = "foreign"
	foreignEpoch := forwardFinalTail(r, "foreign-epoch", "e", now)
	foreignEpoch.identity.SessionEpoch = 10
	r.forwardCounterTails = append(r.forwardCounterTails, foreignNode, foreignBoot, foreignEpoch)
	page := r.captureForwardCounterPage(false, 256)
	ids := []string{}
	for _, point := range page.Items {
		ids = append(ids, point.Identity.AssignmentID+"/"+*point.CounterEpoch)
	}
	if !reflect.DeepEqual(ids, []string{"a/e1", "a/e10", "a/e2", "a\"/e", "aa/e", "z/e"}) || page.Coverage.Available != 6 {
		t.Fatal("identity native JSON lexical key/epoch/session filter", ids, page.Coverage)
	}
	r, _ = forwardFinalRunner(now)
	assignment := forwardFinalAssignment("same")
	current := &forwardFinalStream{runner: r, values: payloadstats.Snapshot{Epoch: "epoch", PayloadSentBytes: 1}, available: true}
	drain := &forwardFinalStream{runner: r, values: payloadstats.Snapshot{Epoch: "epoch", PayloadSentBytes: 2}, available: false}
	r.instances["live"] = running{assignment: assignment, stream: current}
	r.drains["drain"] = draining{instance: running{assignment: assignment, stream: drain}}
	page = r.captureForwardCounterPage(false, 256)
	if len(page.Items) != 1 || page.Items[0].State != "draining" || page.Items[0].Availability != "unavailable" || page.Items[0].Counters != nil || page.Coverage.UnavailableSources != 1 || current.reads != 1 || drain.reads != 1 {
		t.Fatal("draining must replace same identity current even when unavailable", page)
	}
	r.forwardCounterTails = []forwardCounterTail{forwardFinalTail(r, "same", "epoch", now)}
	r.forwardCounterTails[0].available = true
	page = r.captureForwardCounters(false)
	if len(page.Items) != 1 || page.Items[0].State != "terminal" || page.Items[0].Counters.PayloadSentBytes != "2" || page.Coverage.UnavailableSources != 0 {
		t.Fatal("terminal values must override both live references", page)
	}
	for _, role := range []string{"relay-transit", "relay-egress", "multihop-transit", "multihop-egress", "unknown"} {
		r.instances[role] = running{assignment: adp3.Assignment{Role: role}, stream: &forwardFinalStream{runner: r, afterRead: func() { panic("non ingress payload observed") }}}
	}
	_ = r.captureForwardCounters(false)
}

// Marshal cannot currently fail for the closed string/counter identity. Pin the
// original ignored-error boundary using its real source, including partial bytes
// returned alongside an error, rather than changing the production DTO.
func TestForwardFinalOriginalPageIgnoresIdentityEncodeErrorAndUsesReturnedBytes(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "forward_counters.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	file.Name = ast.NewIdent("control")
	declarations := []ast.Decl{}
	encodes, functions := 0, 0
	for _, declaration := range file.Decls {
		if function, ok := declaration.(*ast.FuncDecl); ok {
			if function.Name.Name == "writeForwardCounters" {
				continue
			}
			functions++
			ast.Inspect(function, func(node ast.Node) bool {
				call, ok := node.(*ast.CallExpr)
				if !ok {
					return true
				}
				selector, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				namespace, ok := selector.X.(*ast.Ident)
				if ok && namespace.Name == "observationwire" && selector.Sel.Name == "EncodeValue" {
					call.Fun = ast.NewIdent("encodeIdentityFixture")
					encodes++
				}
				return true
			})
		}
		declarations = append(declarations, declaration)
	}
	file.Decls = declarations
	if encodes != 1 || functions != 9 {
		t.Fatal("Forward source owner/effect inventory changed", encodes, functions)
	}
	var source bytes.Buffer
	if err := format.Node(&source, set, file); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/forwardfinalfixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": source.Bytes(), "effects_test.go": []byte(forwardFinalEncodeFixture)} {
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
		t.Fatalf("original Forward identity Marshal boundary: %v\n%s", err, output)
	}
}

const forwardFinalEncodeFixture = `package control
import("errors";"reflect";"sync";"testing";"time";"github.com/tunex/vnext/agent/internal/adp3";"github.com/tunex/vnext/agent/internal/observationwire";"github.com/tunex/vnext/agent/internal/payloadstats")
type execution interface{}
type running struct{assignment adp3.Assignment;stream execution}
type draining struct{instance running}
type clockFixture struct{now time.Time;calls int}
func(c *clockFixture)Now()time.Time{c.calls++;return c.now}
type Runner struct{mutex sync.Mutex;options struct{NodeID,BootID,Diagnostics string;ForwardTelemetry bool};hello struct{SessionEpoch uint64};journal struct{Generation uint64};instances map[string]running;drains map[string]draining;forwardCounterTails []forwardCounterTail;forwardCounterCursor,forwardTelemetryCursor,forwardCounterTailsEvicted,forwardCounterTailsExpired uint64;clock *clockFixture}
func(r *Runner)scheduler()*clockFixture{return r.clock}
var identitiesFixture map[string]forwardCounterIdentity
var encodedFixture map[string][]byte
var callsFixture map[string]int
var failureFixture=errors.New("ignored original identity Marshal error")
func encodeIdentityFixture(value any)([]byte,error){identity,ok:=value.(observationwire.ForwardCounterIdentity);if !ok||identity!=identitiesFixture[identity.AssignmentID]{panic("identity was copied/projected differently before original EncodeValue")};callsFixture[identity.AssignmentID]++;return encodedFixture[identity.AssignmentID],failureFixture}
func TestOriginalPageIgnoredErrorAndPartialBytes(t *testing.T){
 for _,partial:=range []bool{false,true}{r:=&Runner{clock:&clockFixture{now:time.Unix(100,0)}};r.options.NodeID="node";r.options.BootID="boot";r.hello.SessionEpoch=7;identitiesFixture=map[string]forwardCounterIdentity{};encodedFixture=map[string][]byte{};callsFixture=map[string]int{}
  for _,id:=range []string{"a","b"}{identity:=forwardCounterIdentity{NodeID:"node",BootID:"boot",SessionEpoch:7,AssignmentID:id,ForwardRevision:3,DeploymentGeneration:5,BindingFence:7,Role:"direct",Protocol:"tcp",DriverID:"driver",DriverSchemaVersion:1,ConfigDigest:"digest",Resource:forwardCounterResource{Protocol:"tcp",Address:"192.0.2.1",Port:443}};identitiesFixture[id]=identity;r.forwardCounterTails=append(r.forwardCounterTails,forwardCounterTail{identity:identity,counters:payloadstats.Snapshot{Epoch:id},available:true,endedAt:r.clock.now})}
  expected:=[]string{"a","b"};if partial{encodedFixture["a"]=[]byte("Z-partial");encodedFixture["b"]=[]byte("A-partial");expected=[]string{"b","a"}}
  page:=r.captureForwardCounterPage(true,1);next:=r.captureForwardCounterPage(false,1);actual:=[]string{page.Items[0].Identity.AssignmentID,next.Items[0].Identity.AssignmentID};if !reflect.DeepEqual(actual,expected)||!reflect.DeepEqual(callsFixture,map[string]int{"a":2,"b":2})||page.Coverage.Available!=2||page.Coverage.Returned!=1||page.Coverage.Omitted!=1||page.Coverage.NextOffset!=1||next.Coverage.Offset!=1||!page.Final||next.Final||r.clock.calls!=4{t.Fatal("EncodeValue error propagated/lost partial bytes or changed page",partial,actual,callsFixture,page.Coverage,next.Coverage)}
 }
}
`

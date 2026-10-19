package main

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
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/platformstate"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
	"github.com/tunex/vnext/agent/internal/state"
)

type fixtureOpaqueCertificate struct{ Value byte }
type fixtureOpaqueRoots struct{ Value byte }
type fixtureOpaqueClient struct{ Value byte }
type fixtureOpaqueConnection struct{ Value byte }

// The remaining declarations are tested by this public consumer with opaque
// native parameters. Existing owner suites cover their actual effects; these
// independent complete method maps catch otherwise source-compatible widening.
func TestAgentSourceGraphCompleteRemainingPublicPortMethodSets(t *testing.T) {
	if executionidentity.InterfaceVersion != 2 || executionchannel.InterfaceVersion != 1 || runtimeplatform.InterfaceVersion != 2 {
		t.Fatal("public lower port version changed")
	}
	type methodMap map[string]reflect.Type
	providers := []struct {
		typ     reflect.Type
		methods methodMap
	}{
		{reflect.TypeOf((*executionidentity.Provider[fixtureOpaqueCertificate, *fixtureOpaqueRoots])(nil)).Elem(), methodMap{
			"Locations":               reflect.TypeOf((func(string, string, string) executionidentity.Locations)(nil)),
			"LoadMachine":             reflect.TypeOf((func(executionidentity.Locations, string, *fixtureOpaqueRoots) (executionidentity.MachineIdentity[fixtureOpaqueCertificate], error))(nil)),
			"PrepareRotation":         reflect.TypeOf((func(string, string) (executionidentity.RotationRequest, error))(nil)),
			"ValidateMachineRotation": reflect.TypeOf((func(executionidentity.Locations, string, executionidentity.RotationRequest, []byte) (executionidentity.CredentialBundle, error))(nil)),
			"SaveMachine":             reflect.TypeOf((func(string, executionidentity.CredentialBundle) error)(nil)),
			"ReadPending":             reflect.TypeOf((func(string) ([]byte, error))(nil)), "Missing": reflect.TypeOf((func(error) bool)(nil)), "Remove": reflect.TypeOf((func(string, bool) error)(nil)),
			"DecodeProtected": reflect.TypeOf((func([]byte, any) error)(nil)), "LoadRelay": reflect.TypeOf((func(string, []byte) (executionidentity.RelayBundle, bool, error))(nil)),
			"ValidateRelay":   reflect.TypeOf((func(executionidentity.RelayBundle, string, *fixtureOpaqueRoots) (fixtureOpaqueCertificate, time.Time, error))(nil)),
			"ValidateRelayAt": reflect.TypeOf((func(executionidentity.RelayBundle, string, *fixtureOpaqueRoots, time.Time) (fixtureOpaqueCertificate, time.Time, error))(nil)),
			"SaveRelay":       reflect.TypeOf((func(string, []byte, executionidentity.RelayBundle) error)(nil)),
		}},
		{reflect.TypeOf((*executionchannel.Provider[fixtureOpaqueClient, *fixtureOpaqueRoots, fixtureOpaqueCertificate])(nil)).Elem(), methodMap{
			"NewClient": reflect.TypeOf((func(*fixtureOpaqueRoots, func() fixtureOpaqueCertificate) fixtureOpaqueClient)(nil)),
			"Request":   reflect.TypeOf((func(context.Context, fixtureOpaqueClient, string, string, string, []byte, bool, uint64) ([]byte, error))(nil)), "CloseIdleConnections": reflect.TypeOf((func(fixtureOpaqueClient))(nil)),
		}},
		{reflect.TypeOf((*executionchannel.Auxiliary[fixtureOpaqueClient])(nil)).Elem(), methodMap{
			"ProbeInstance":  reflect.TypeOf((func(context.Context, fixtureOpaqueClient, string, []byte, uint64) (executionchannel.Reply, error))(nil)),
			"ProbeClaim":     reflect.TypeOf((func(context.Context, fixtureOpaqueClient, string, []byte, uint64) (executionchannel.Reply, error))(nil)),
			"ProbeDelivery":  reflect.TypeOf((func(context.Context, fixtureOpaqueClient, string, string, []byte, uint64) (executionchannel.Reply, error))(nil)),
			"PostTelemetry":  reflect.TypeOf((func(context.Context, fixtureOpaqueClient, string, string, []byte, uint64) (executionchannel.Reply, error))(nil)),
			"CloneTelemetry": reflect.TypeOf((func(fixtureOpaqueClient, string) (fixtureOpaqueClient, func(), bool))(nil)),
		}},
		{reflect.TypeOf((*runtimeplatform.Scheduler)(nil)).Elem(), methodMap{
			"Now": reflect.TypeOf((func() time.Time)(nil)), "Since": reflect.TypeOf((func(time.Time) time.Duration)(nil)), "Until": reflect.TypeOf((func(time.Time) time.Duration)(nil)), "After": reflect.TypeOf((func(time.Duration) <-chan time.Time)(nil)),
			"NewTimer": reflect.TypeOf((func(time.Duration) runtimeplatform.Timer)(nil)), "NewTicker": reflect.TypeOf((func(time.Duration) runtimeplatform.Ticker)(nil)),
			"WithTimeout": reflect.TypeOf((func(context.Context, time.Duration) (context.Context, context.CancelFunc))(nil)), "WithDeadline": reflect.TypeOf((func(context.Context, time.Time) (context.Context, context.CancelFunc))(nil)), "AfterFunc": reflect.TypeOf((func(context.Context, func()) func() bool)(nil)),
		}},
		{reflect.TypeOf((*runtimeplatform.Dialer[fixtureOpaqueConnection])(nil)).Elem(), methodMap{"DialContext": reflect.TypeOf((func(context.Context, string, string) (fixtureOpaqueConnection, error))(nil))}},
		{reflect.TypeOf((*runtimeplatform.Timer)(nil)).Elem(), methodMap{"C": reflect.TypeOf((func() <-chan time.Time)(nil)), "Stop": reflect.TypeOf((func() bool)(nil))}},
		{reflect.TypeOf((*runtimeplatform.Ticker)(nil)).Elem(), methodMap{"C": reflect.TypeOf((func() <-chan time.Time)(nil)), "Stop": reflect.TypeOf((func())(nil))}},
		{reflect.TypeOf((*runtimeplatform.Entropy)(nil)).Elem(), methodMap{"ReadRandom": reflect.TypeOf((func([]byte) (int, error))(nil))}},
		{reflect.TypeOf((*runtimeplatform.MeasurementFiles)(nil)).Elem(), methodMap{"WriteDiagnostics": reflect.TypeOf((func(string, []byte) error)(nil)), "WriteForwardCounters": reflect.TypeOf((func(string, []byte) error)(nil))}},
		{reflect.TypeOf((*runtimeplatform.LocalLog)(nil)).Elem(), methodMap{"Warn": reflect.TypeOf((func(...any))(nil))}},
	}
	for _, provider := range providers {
		if provider.typ.NumMethod() != len(provider.methods) {
			t.Fatal("public method set widened/narrowed", provider.typ, provider.typ.NumMethod(), len(provider.methods))
		}
		for name, want := range provider.methods {
			got, ok := provider.typ.MethodByName(name)
			if !ok || got.Type != want {
				t.Fatal("public generic method signature changed", provider.typ, name, got.Type, want)
			}
		}
	}
	locations := reflect.TypeOf(executionidentity.Locations{})
	names := []string{"Certificate", "PrivateKey", "CA", "MachineBundle", "MachineRequest", "RelayBundle", "RelayRequest"}
	if locations.NumField() != len(names) {
		t.Fatal("lower locations fields changed")
	}
	for i, name := range names {
		field := locations.Field(i)
		if field.Name != name || field.Type != reflect.TypeOf("") || field.Tag != "" || field.Anonymous {
			t.Fatal("lower locations layout changed", field)
		}
	}
	machine := reflect.TypeOf(executionidentity.MachineIdentity[fixtureOpaqueCertificate]{})
	for i, want := range []struct {
		name string
		typ  reflect.Type
	}{{"Certificate", reflect.TypeOf(fixtureOpaqueCertificate{})}, {"Until", reflect.TypeOf(time.Time{})}, {"Fingerprint", reflect.TypeOf([32]byte{})}} {
		if machine.NumField() != 3 {
			t.Fatal("lower machine identity widened")
		}
		field := machine.Field(i)
		if field.Name != want.name || field.Type != want.typ || field.Tag != "" || field.Anonymous {
			t.Fatal("opaque lower machine identity changed", field)
		}
	}
	problem := executionchannel.HTTPError{Status: 403, Code: "original-code"}
	if problem.Error() != "Control HTTP 403: original-code" {
		t.Fatal("public native error formatting changed")
	}
}

func TestAgentSourceGraphCompleteUnsupportedNativeLockFailsWithoutFiles(t *testing.T) {
	if runtime.GOOS == "linux" || runtime.GOOS == "windows" {
		return
	}
	path := filepath.Join(t.TempDir(), "uncreated-instance.lock")
	for _, acquire := range []func(string) (func(), error){platformstate.AcquireLock, state.AcquireLock} {
		release, err := acquire(path)
		if release != nil || err == nil || err.Error() != "Agent runtime supports Linux and Windows development only" {
			t.Fatal("unsupported native lock acquired fallback", err)
		}
		if _, err := os.Lstat(path); !os.IsNotExist(err) {
			t.Fatal("unsupported lock created a file", err)
		}
	}
}

// Stage the actual command sources, rebinding only external collaborators and
// run's composition calls. No fixture algorithm or validation predicate is copied.
func TestNetworkFixtureCompleteOriginalRootsAndExternalEffectLifetimes(t *testing.T) {
	root := t.TempDir()
	moduleRoot, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/networkfixtureacceptance\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	if err := os.WriteFile(filepath.Join(root, "go.mod"), []byte(module), 0600); err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, name := range []string{"main.go", "load.go", "tcp_proxy.go", "relay_negative.go", "udp_route_monitor.go"} {
		set := token.NewFileSet()
		file, err := parser.ParseFile(set, name, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			if name == "tcp_proxy.go" {
				replacement := ""
				if selector.Sel.Name == "DialContext" {
					replacement = "fixtureProxyDial"
				}
				if selector.Sel.Name == "SetDeadline" {
					replacement = "fixtureProxyDeadline"
				}
				if replacement != "" {
					call.Fun = ast.NewIdent(replacement)
					call.Args = append([]ast.Expr{selector.X}, call.Args...)
					counts[replacement]++
					return true
				}
			}
			owner, ok := selector.X.(*ast.Ident)
			if !ok {
				return true
			}
			key := owner.Name + "." + selector.Sel.Name
			replacement := map[string]string{"signal.NotifyContext": "fixtureSignal", "net.DialTimeout": "fixtureDial", "time.Sleep": "fixtureSleep"}[key]
			if replacement != "" {
				call.Fun = ast.NewIdent(replacement)
				counts[key]++
			}
			return true
		})
		for _, declaration := range file.Decls {
			function, ok := declaration.(*ast.FuncDecl)
			if !ok || function.Name.Name != "run" {
				continue
			}
			ast.Inspect(function.Body, func(node ast.Node) bool {
				call, ok := node.(*ast.CallExpr)
				if !ok {
					return true
				}
				identifier, ok := call.Fun.(*ast.Ident)
				if !ok {
					return true
				}
				for _, name := range []string{"tcpProxy", "relayNegative", "load", "target", "probe", "monitor", "udpRouteMonitor", "occupyUDP"} {
					if identifier.Name == name {
						call.Fun = ast.NewIdent(name + "DispatchFixture")
						counts["dispatch:"+name]++
					}
				}
				return true
			})
		}
		used := map[string]bool{}
		ast.Inspect(file, func(node ast.Node) bool {
			if selector, ok := node.(*ast.SelectorExpr); ok {
				if owner, ok := selector.X.(*ast.Ident); ok {
					used[owner.Name] = true
				}
			}
			return true
		})
		for _, declaration := range file.Decls {
			group, ok := declaration.(*ast.GenDecl)
			if !ok || group.Tok != token.IMPORT {
				continue
			}
			kept := group.Specs[:0]
			for _, entry := range group.Specs {
				spec := entry.(*ast.ImportSpec)
				path, err := strconv.Unquote(spec.Path.Value)
				if err != nil {
					t.Fatal(err)
				}
				parts := strings.Split(path, "/")
				alias := parts[len(parts)-1]
				if spec.Name != nil {
					alias = spec.Name.Name
				}
				if used[alias] {
					kept = append(kept, entry)
				}
			}
			group.Specs = kept
		}
		var output bytes.Buffer
		if err := format.Node(&output, set, file); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(root, name), output.Bytes(), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if counts["signal.NotifyContext"] != 4 || counts["net.DialTimeout"] != 6 || counts["time.Sleep"] != 4 || counts["fixtureProxyDial"] != 1 || counts["fixtureProxyDeadline"] != 2 {
		t.Fatal("native fixture external collaborator inventory changed", counts)
	}
	for _, name := range []string{"tcpProxy", "relayNegative", "load", "target", "probe", "monitor", "udpRouteMonitor", "occupyUDP"} {
		if counts["dispatch:"+name] != 1 {
			t.Fatal("native run composition inventory changed", counts)
		}
	}
	if err := os.WriteFile(filepath.Join(root, "native_effects_test.go"), []byte(networkFixtureCompleteEffects), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if out, err := command.CombinedOutput(); err != nil {
		t.Fatalf("actual original network fixture behavior: %v\n%s", err, out)
	}
}

const networkFixtureCompleteEffects = `package main
import("bytes";"context";"encoding/binary";"encoding/json";"errors";"flag";"fmt";"io";"net";"os";"os/exec";"reflect";"strings";"sync/atomic";"syscall";"testing";"time")
var fixtureParent context.Context=context.Background()
var fixtureCancel context.CancelFunc
var fixtureDialOverride func(string,string,time.Duration)(net.Conn,error)
var fixtureSleepOverride func(time.Duration)
var fixtureSignalCount int
func fixtureSignal(parent context.Context,signals ...os.Signal)(context.Context,context.CancelFunc){if parent!=context.Background()||!reflect.DeepEqual(signals,[]os.Signal{os.Interrupt,syscall.SIGTERM}){panic("original fixture signal vocabulary changed")};fixtureSignalCount++;ctx,cancel:=context.WithCancel(fixtureParent);fixtureCancel=cancel;return ctx,cancel}
func fixtureDial(network,address string,timeout time.Duration)(net.Conn,error){if fixtureDialOverride!=nil{return fixtureDialOverride(network,address,timeout)};return net.DialTimeout(network,address,timeout)}
func fixtureProxyDial(dialer *net.Dialer,ctx context.Context,network,address string)(net.Conn,error){if dialer.Timeout!=3*time.Second||network!="tcp"{panic("native proxy dial budget/network changed")};return dialer.DialContext(ctx,network,address)}
func fixtureProxyDeadline(socket net.Conn,deadline time.Time)error{remaining:=time.Until(deadline);if remaining<29*time.Second||remaining>30*time.Second{panic("native proxy socket deadline changed")};return socket.SetDeadline(deadline)}
func fixtureSleep(delay time.Duration){if fixtureSleepOverride!=nil{fixtureSleepOverride(delay);return};time.Sleep(delay)}
func fixtureReset(){fixtureParent=context.Background();fixtureCancel=nil;fixtureDialOverride=nil;fixtureSleepOverride=nil;fixtureSignalCount=0;fixtureDispatch=nil}
func fixtureOutput(t *testing.T,operation func()error)(error,[]map[string]any){t.Helper();file,err:=os.CreateTemp(t.TempDir(),"output");if err!=nil{t.Fatal(err)};old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old;file.Close()}();result:=operation();file.Seek(0,0);decoder:=json.NewDecoder(file);var output []map[string]any;for{var record map[string]any;err:=decoder.Decode(&record);if err==io.EOF{break};if err!=nil{t.Fatal(err)};output=append(output,record)};return result,output}
type fixtureSocket struct{read func([]byte)(int,error);write func([]byte)(int,error);closed atomic.Int32;deadline time.Time}
func(c *fixtureSocket)Read(raw []byte)(int,error){if c.read!=nil{return c.read(raw)};return 0,io.EOF}
func(c *fixtureSocket)Write(raw []byte)(int,error){if c.write!=nil{return c.write(raw)};return len(raw),nil}
func(c *fixtureSocket)Close()error{c.closed.Add(1);return nil}
func(c *fixtureSocket)LocalAddr()net.Addr{return &net.TCPAddr{IP:net.IPv4(127,0,0,1),Port:1}}
func(c *fixtureSocket)RemoteAddr()net.Addr{return &net.TCPAddr{IP:net.IPv4(127,0,0,1),Port:2}}
func(c *fixtureSocket)SetDeadline(deadline time.Time)error{c.deadline=deadline;return nil}
func(c *fixtureSocket)SetReadDeadline(deadline time.Time)error{return c.SetDeadline(deadline)}
func(c *fixtureSocket)SetWriteDeadline(deadline time.Time)error{return c.SetDeadline(deadline)}
func TestOriginalLoadLaterDialFailureAndInitialOutputFailureCleanup(t *testing.T){
 defer fixtureReset();sentinel:=errors.New("original second socket refusal");for _,stage:=range []string{"later-dial","progress-output"}{fixtureReset();first:=&fixtureSocket{};second:=&fixtureSocket{};calls:=0;fixtureDialOverride=func(network,address string,timeout time.Duration)(net.Conn,error){calls++;want:="tcp";if calls==2{want="udp"};if network!=want||address!="127.0.0.1:12345"||timeout!=5*time.Second{t.Fatal("original load dial arguments/order",network,address,timeout)};if calls==2{if stage=="later-dial"{return nil,sentinel};return second,nil};return first,nil}
  old:=os.Stdout;if stage=="progress-output"{file,err:=os.CreateTemp(t.TempDir(),"closed");if err!=nil{t.Fatal(err)};file.Close();os.Stdout=file};err:=load(12345,1,1,1,64,"run",true,0,false);os.Stdout=old;if stage=="later-dial"&&err!=sentinel{t.Fatal("original later dial error identity",err)};if err==nil||calls!=2||first.closed.Load()!=1||stage=="progress-output"&&second.closed.Load()!=1{t.Fatal("partial socket/client cleanup changed",stage,err,calls,first.closed.Load(),second.closed.Load())}
 }
}
func TestOriginalLoadWriteReplyClassesAndEveryClientVerification(t *testing.T){
 defer fixtureReset();for _,mode:=range []string{"short-write","write-timeout","payload-mismatch","udp-size-mismatch","no-client-verification"}{t.Run(mode,func(t *testing.T){fixtureReset();calls:=0;fixtureDialOverride=func(network,address string,timeout time.Duration)(net.Conn,error){index:=calls;calls++;round:=0;var sent []byte;c:=&fixtureSocket{};c.write=func(raw []byte)(int,error){round++;sent=append([]byte(nil),raw...);if round>1&&index==0&&mode=="short-write"{return len(raw)-1,nil};if round>1&&index==0&&mode=="write-timeout"{return 0,os.ErrDeadlineExceeded};return len(raw),nil};c.read=func(raw []byte)(int,error){if index==0&&mode=="no-client-verification"{return 0,io.EOF};if round>1{if index==0&&mode=="payload-mismatch"{copy(raw,sent);raw[len(sent)-1]^=1;return len(sent),nil};if index==1&&mode=="udp-size-mismatch"{return copy(raw,sent[:len(sent)-1]),nil};return 0,io.EOF};return copy(raw,sent),nil};return c,nil}
  err,records:=fixtureOutput(t,func()error{return load(12345,1,1,5,64,"run",true,0,true)});want:="";switch mode{case "payload-mismatch","udp-size-mismatch":want="payload corruption is never an expected cutoff";case "no-client-verification":want="every load client must verify payload before completion"};if want!=""&&(err==nil||err.Error()!=want){t.Fatal("original load failure priority",mode,err,want)};if mode=="short-write"||mode=="write-timeout"{if err!=nil{t.Fatal("expected cutoff with successful prefix should complete",err)};last:=records[len(records)-1];client:=last["clients"].([]any)[0].(map[string]any);kind:="short-write";if mode=="write-timeout"{kind="timeout"};if client["errorKind"]!=kind||client["failure"]!="write"{t.Fatal("original write class lost",client)}};if len(records)<1{t.Fatal("progress missing")}
 })}
}
func TestOriginalLoadInclusiveUpperBoundsReachOutputAndReleaseEverySocket(t *testing.T){fixtureReset();defer fixtureReset();var sockets []*fixtureSocket;fixtureDialOverride=func(network,address string,timeout time.Duration)(net.Conn,error){want:="tcp";if len(sockets)>=256{want="udp"};if network!=want||address!="127.0.0.1:12345"||timeout!=5*time.Second{t.Fatal("native upper-bound client dial sequence changed")};socket:=&fixtureSocket{};sockets=append(sockets,socket);return socket,nil};file,err:=os.CreateTemp(t.TempDir(),"closed-upper-output");if err!=nil{t.Fatal(err)};file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();err=load(12345,256,256,180,4096,"",true,1000,true);if err==nil||err.Error()=="bounded load parameters required"||len(sockets)!=512{t.Fatal("inclusive native load maximum rejected or exceeded",err,len(sockets))};for _,socket:=range sockets{if socket.closed.Load()!=1{t.Fatal("readiness failure leaked upper-bound fixture socket")}}}
func TestOriginalUDPRouteMonitorExactSequenceLossSwitchAndOldAfterSuccessor(t *testing.T){
 defer fixtureReset();for _,mode:=range []string{"cancel","old-after-successor","output-error","write-read-loss"}{t.Run(mode,func(t *testing.T){fixtureReset();socket:=&fixtureSocket{};var sent []byte;round:=0;delays:=0;socket.write=func(raw []byte)(int,error){round++;if len(raw)!=64||binary.BigEndian.Uint64(raw[:8])!=uint64(round){t.Fatal("native UDP sequence/length changed")};sent=append([]byte(nil),raw...);if mode=="write-read-loss"&&round==1{return 0,io.ErrClosedPipe};return len(raw),nil};socket.read=func(raw []byte)(int,error){if mode=="write-read-loss"&&round==2{return 0,os.ErrDeadlineExceeded};if mode=="write-read-loss"&&round==3{return copy(raw,[]byte("unrecognized")),nil};tag:="old:";if round>=2{tag="new:"};if mode=="old-after-successor"&&round==3{tag="old:"};return copy(raw,append([]byte(tag),sent...)),nil};fixtureDialOverride=func(network,address string,timeout time.Duration)(net.Conn,error){if network!="udp"||address!="127.0.0.1:12345"||timeout!=time.Second{t.Fatal("original UDP dial changed")};return socket,nil};fixtureSleepOverride=func(delay time.Duration){if delay!=150*time.Millisecond{t.Fatal("original route monitor pacing changed")};delays++;if mode=="cancel"&&round==2||mode=="write-read-loss"&&round==4{fixtureCancel()}}
  var err error;var records []map[string]any;if mode=="output-error"{old:=os.Stdout;file,createErr:=os.CreateTemp(t.TempDir(),"closed");if createErr!=nil{t.Fatal(createErr)};file.Close();os.Stdout=file;err=udpRouteMonitor(12345,"old:","new:");os.Stdout=old}else{err,records=fixtureOutput(t,func()error{return udpRouteMonitor(12345,"old:","new:")})};if socket.closed.Load()!=1||fixtureSignalCount!=1||fixtureCancel==nil||socket.deadline.IsZero(){t.Fatal("native route monitor context/socket lifetime changed")};if mode=="old-after-successor"{if err==nil||err.Error()!="Old UDP target replied after successor was established"||len(records)!=2{t.Fatal("old target accepted after successor",err,records)}}else if mode=="output-error"{if err==nil{t.Fatal("monitor output error ignored")}}else{if err!=nil{t.Fatal(err)};last:=records[len(records)-1];if last["tag"]!="new:"{t.Fatal("successor never established")};if mode=="write-read-loss"&&(last["lost"]!=float64(3)||delays!=3){t.Fatal("loss/malformed replies counted as migration success",last,delays)}}
 })};fixtureReset();for _,tags:=range [][2]string{{"","next"},{"old",""},{"same","same"}}{if err:=udpRouteMonitor(0,tags[0],tags[1]);err==nil||fixtureSignalCount!=0{t.Fatal("distinct-tag refusal moved after effects",err)}}
}
func TestOriginalOccupyUDPUsesRealPortAndCancelsAfterOutput(t *testing.T){
 fixtureReset();defer fixtureReset();ctx,cancel:=context.WithCancel(context.Background());defer cancel();fixtureParent=ctx;probe,err:=net.ListenUDP("udp4",&net.UDPAddr{IP:net.IPv4(127,0,0,1)});if err!=nil{t.Fatal(err)};port:=probe.LocalAddr().(*net.UDPAddr).Port;probe.Close();file,err:=os.CreateTemp(t.TempDir(),"occupy");if err!=nil{t.Fatal(err)};defer file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();done:=make(chan error,1);go func(){done<-occupyUDP(port,"run") }();deadline:=time.Now().Add(time.Second);for{info,err:=file.Stat();if err!=nil{t.Fatal(err)};if info.Size()>0{break};if time.Now().After(deadline){t.Fatal("occupier did not publish readiness")};time.Sleep(time.Millisecond)};other,err:=net.ListenUDP("udp4",&net.UDPAddr{IP:net.IPv4(127,0,0,1),Port:port});if err==nil{other.Close();cancel();t.Fatal("occupier did not hold native UDP port")};cancel();select{case err:=<-done:if err!=nil{t.Fatal(err)};case <-time.After(time.Second):t.Fatal("occupier failed cancellation")};replacement,err:=net.ListenUDP("udp4",&net.UDPAddr{IP:net.IPv4(127,0,0,1),Port:port});if err!=nil{t.Fatal("occupier did not release port",err)};replacement.Close();file.Seek(0,0);var record map[string]any;if err:=json.NewDecoder(file).Decode(&record);err!=nil||record["port"]!=float64(port)||record["runId"]!="run"||record["pid"]!=float64(os.Getpid()){t.Fatal("occupier readiness changed",record,err)}
}
func TestOriginalTCPProxyOpaqueBytesHalfCloseAndCancellationJoin(t *testing.T){
 fixtureReset();defer fixtureReset();upstream,err:=net.Listen("tcp4","127.0.0.1:0");if err!=nil{t.Fatal(err)};defer upstream.Close();ctx,cancel:=context.WithCancel(context.Background());defer cancel();fixtureParent=ctx;file,err:=os.CreateTemp(t.TempDir(),"proxy");if err!=nil{t.Fatal(err)};defer file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();done:=make(chan error,1);go func(){done<-tcpProxy("127.0.0.1","127.0.0.1",upstream.Addr().(*net.TCPAddr).Port,"opaque-run")}();deadline:=time.Now().Add(2*time.Second);var port int;for port==0{raw,err:=os.ReadFile(file.Name());if err!=nil{t.Fatal(err)};var record map[string]any;if json.Unmarshal(raw,&record)==nil{port=int(record["port"].(float64));if record["runId"]!="opaque-run"{t.Fatal("proxy run identity changed")}};if time.Now().After(deadline){t.Fatal("proxy did not publish readiness")};time.Sleep(time.Millisecond)}
  payload:=[]byte{0x16,3,3,0,0,255,0,1};peerDone:=make(chan error,1);go func(){server,err:=upstream.Accept();if err!=nil{peerDone<-err;return};defer server.Close();server.SetDeadline(time.Now().Add(2*time.Second));raw,err:=io.ReadAll(server);if err!=nil{peerDone<-err;return};if !bytes.Equal(raw,payload){peerDone<-fmt.Errorf("proxy changed opaque bytes: %x",raw);return};_,err=server.Write(append([]byte("opaque-reply:"),raw...));peerDone<-err}();client,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal(err)};client.SetDeadline(time.Now().Add(2*time.Second));if _,err:=client.Write(payload);err!=nil{t.Fatal(err)};client.(*net.TCPConn).CloseWrite();reply,err:=io.ReadAll(client);client.Close();if err!=nil||!bytes.Equal(reply,append([]byte("opaque-reply:"),payload...)){t.Fatal("proxy lost TCP half-close/end-to-end opaque reply",err,reply)};if err:=<-peerDone;err!=nil{t.Fatal(err)}
  held,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal(err)};server,err:=upstream.Accept();if err!=nil{t.Fatal(err)};defer server.Close();cancel();select{case err:=<-done:if err!=nil{t.Fatal(err)};case <-time.After(2*time.Second):t.Fatal("proxy did not cancel/join held workers")};held.SetReadDeadline(time.Now().Add(time.Second));if _,err:=held.Read(make([]byte,1));err==nil{t.Fatal("proxy cancellation retained held client")};held.Close()
}
func TestOriginalTCPProxyExactGlobal128PermitBoundAndRefusalCleanup(t *testing.T){
 fixtureReset();defer fixtureReset();for _,value:=range []struct{upstream string;port int;run string}{{"hostname",1,"run"},{"127.0.0.1",0,"run"},{"127.0.0.1",65536,"run"},{"127.0.0.1",1,""}}{if err:=tcpProxy("127.0.0.1",value.upstream,value.port,value.run);err==nil||err.Error()!="Explicit bounded proxy upstream and run identity required"||fixtureSignalCount!=0{t.Fatal("proxy explicit prerequisite reached signal/network phase",err)}}
 upstream,err:=net.ListenTCP("tcp4",&net.TCPAddr{IP:net.IPv4(127,0,0,1)});if err!=nil{t.Fatal(err)};defer upstream.Close();ctx,cancel:=context.WithCancel(context.Background());defer cancel();fixtureParent=ctx;file,err:=os.CreateTemp(t.TempDir(),"proxy-cap");if err!=nil{t.Fatal(err)};defer file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();done:=make(chan error,1);go func(){done<-tcpProxy("127.0.0.1","127.0.0.1",upstream.Addr().(*net.TCPAddr).Port,"bounded-run")}();deadline:=time.Now().Add(2*time.Second);port:=0;for port==0{raw,err:=os.ReadFile(file.Name());if err!=nil{t.Fatal(err)};var record map[string]any;if json.Unmarshal(raw,&record)==nil{port=int(record["port"].(float64))};if time.Now().After(deadline){t.Fatal("bounded proxy did not publish")};time.Sleep(time.Millisecond)}
 var clients,servers []net.Conn;defer func(){for _,socket:=range append(clients,servers...){socket.Close()}}();for i:=0;i<128;i++{client,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal("proxy refused within native capacity",i,err)};clients=append(clients,client);upstream.SetDeadline(time.Now().Add(time.Second));server,err:=upstream.AcceptTCP();if err!=nil{t.Fatal("proxy admitted no upstream within capacity",i,err)};servers=append(servers,server)}
 excess,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal(err)};excess.SetReadDeadline(time.Now().Add(time.Second));_,readErr:=excess.Read(make([]byte,1));excess.Close();if readErr==nil{t.Fatal("proxy forwarded excess admission")};if network,ok:=readErr.(net.Error);ok&&network.Timeout(){t.Fatal("excess client was queued instead of closed")};upstream.SetDeadline(time.Now().Add(30*time.Millisecond));if socket,err:=upstream.AcceptTCP();err==nil{socket.Close();t.Fatal("129th proxy client consumed upstream admission")}
 cancel();select{case err:=<-done:if err!=nil{t.Fatal(err)};case <-time.After(3*time.Second):t.Fatal("proxy cancellation did not join128 held workers")}
}
func TestOriginalTCPProxyOutputFailureClosesListenerAndSignalContext(t *testing.T){fixtureReset();defer fixtureReset();old:=os.Stdout;file,err:=os.CreateTemp(t.TempDir(),"closed-proxy-output");if err!=nil{t.Fatal(err)};file.Close();os.Stdout=file;defer func(){os.Stdout=old}();if err:=tcpProxy("127.0.0.1","127.0.0.1",1,"run");err==nil||fixtureSignalCount!=1{t.Fatal("native proxy readiness error was ignored",err)}}
func TestOriginalTCPProxyFailedUpstreamReturnsPermitAndClosesClient(t *testing.T){
 fixtureReset();defer fixtureReset();unavailable,err:=net.Listen("tcp4","127.0.0.1:0");if err!=nil{t.Fatal(err)};upstreamPort:=unavailable.Addr().(*net.TCPAddr).Port;unavailable.Close();ctx,cancel:=context.WithCancel(context.Background());defer cancel();fixtureParent=ctx;file,err:=os.CreateTemp(t.TempDir(),"failed-upstream");if err!=nil{t.Fatal(err)};defer file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();done:=make(chan error,1);go func(){done<-tcpProxy("127.0.0.1","127.0.0.1",upstreamPort,"retry-capacity")}();deadline:=time.Now().Add(2*time.Second);port:=0;for port==0{raw,err:=os.ReadFile(file.Name());if err!=nil{t.Fatal(err)};var record map[string]any;if json.Unmarshal(raw,&record)==nil{port=int(record["port"].(float64))};if time.Now().After(deadline){t.Fatal("proxy did not publish")};time.Sleep(time.Millisecond)};for i:=0;i<130;i++{client,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal(err)};client.SetReadDeadline(time.Now().Add(time.Second));_,err=client.Read(make([]byte,1));client.Close();if err==nil{t.Fatal("failed upstream remained readable")};if network,ok:=err.(net.Error);ok&&network.Timeout(){t.Fatal("failed upstream leaked client/permit",i)}};cancel();select{case err:=<-done:if err!=nil{t.Fatal(err)};case <-time.After(time.Second):t.Fatal("proxy failed to join failed dial workers")}
}
func TestOriginalTargetAndProbeActualTaggedTCPUDPAndNativeLifetime(t *testing.T){
 fixtureReset();defer fixtureReset();ctx,cancel:=context.WithCancel(context.Background());defer cancel();fixtureParent=ctx;file,err:=os.CreateTemp(t.TempDir(),"target");if err!=nil{t.Fatal(err)};defer file.Close();old:=os.Stdout;os.Stdout=file;defer func(){os.Stdout=old}();done:=make(chan error,1);go func(){done<-target("fixture-run","tag:","127.0.0.1",1)}();deadline:=time.Now().Add(2*time.Second);port:=0;for port==0{raw,err:=os.ReadFile(file.Name());if err!=nil{t.Fatal(err)};var record map[string]any;if json.Unmarshal(raw,&record)==nil{port=int(record["port"].(float64));if record["runId"]!="fixture-run"||record["tag"]!="tag:"{t.Fatal("native target identity projection",record)}};if time.Now().After(deadline){t.Fatal("target did not publish readiness")};time.Sleep(time.Millisecond)}
 for _,mode:=range []string{"both","tcp","udp"}{if err:=probe(port,mode=="udp",mode=="tcp","tag:","127.0.0.1");err!=nil{t.Fatal("actual tagged fixture/probe disagreement",mode,err)}}
 held,err:=net.DialTimeout("tcp4",fmt.Sprintf("127.0.0.1:%d",port),time.Second);if err!=nil{t.Fatal(err)};defer held.Close();held.SetReadDeadline(time.Now().Add(2*time.Second));header:=make([]byte,4);if _,err:=io.ReadFull(held,header);err!=nil||string(header)!="tag:"{t.Fatal("native target tag missing",err)};if _,err:=held.Read(make([]byte,1));err==nil{t.Fatal("bounded target held stream survived configured lifetime")}else if network,ok:=err.(net.Error);ok&&network.Timeout(){t.Fatal("target did not enforce connection lifetime")};cancel();select{case err:=<-done:if err!=nil{t.Fatal(err)};case <-time.After(time.Second):t.Fatal("target did not cancel listener")}
 file.Seek(0,0);decoder:=json.NewDecoder(file);var records []map[string]any;for{var record map[string]any;if err:=decoder.Decode(&record);err==io.EOF{break}else if err!=nil{t.Fatal(err)};records=append(records,record)};if len(records)!=4{t.Fatal("target/probe result count changed",records)};for i,mode:=range []string{"both","tcp","udp"}{record:=records[i+1];if record["tcp"]!=(mode!="udp")||record["udp"]!=(mode!="tcp")||record["tag"]!="tag:"||len(record["payloadSHA"].(string))!=64{t.Fatal("probe native protocol/hash projection changed",record)}}
}
func TestOriginalProbeAndHeldMonitorPartialIORefusalOrder(t *testing.T){
 defer fixtureReset();for _,mode:=range []string{"tcp-mismatch","udp-mismatch","tcp-dial","udp-dial","monitor-header","monitor-payload","monitor-ended"}{t.Run(mode,func(t *testing.T){fixtureReset();sentinel:=errors.New("native fixture dial refusal");calls:=0;reads:=0;var pending []byte;socket:=&fixtureSocket{};socket.write=func(raw []byte)(int,error){pending=append([]byte(nil),raw...);return len(raw),nil};socket.read=func(raw []byte)(int,error){reads++;if strings.HasPrefix(mode,"monitor"){if reads==1{value:="tag:";if mode=="monitor-header"{value="bad:"};return copy(raw,value),nil};if mode=="monitor-ended"&&reads>2{return 0,io.EOF};value:="held";if mode=="monitor-payload"{value="bad!"};return copy(raw,value),nil};if reads>1{return 0,io.EOF};return copy(raw,append([]byte("wrong:"),pending...)),nil};fixtureDialOverride=func(network,address string,timeout time.Duration)(net.Conn,error){calls++;if mode=="tcp-dial"||mode=="udp-dial"{return nil,sentinel};if address!="127.0.0.1:12345"||timeout!=5*time.Second{t.Fatal("probe/monitor original dial contract changed")};return socket,nil};fixtureSleepOverride=func(delay time.Duration){if delay!=200*time.Millisecond{t.Fatal("held monitor pacing changed")}}
  var err error;var records []map[string]any;if strings.HasPrefix(mode,"monitor"){err,records=fixtureOutput(t,func()error{return monitor(12345,"tag:")})}else{err,records=fixtureOutput(t,func()error{return probe(12345,strings.HasPrefix(mode,"udp"),false,"tag:","127.0.0.1")})};want:="";switch mode{case "tcp-mismatch":want="TCP payload mismatch";case "udp-mismatch":want="UDP payload mismatch";case "monitor-header":want="Held TCP target identity differs";case "monitor-payload":want="held stream payload mismatch"};if mode=="tcp-dial"||mode=="udp-dial"{if err!=sentinel||socket.closed.Load()!=0{t.Fatal("original dial error/cleanup changed",err)}}else{if socket.closed.Load()!=1{t.Fatal("fixture stream leaked",mode,socket.closed.Load())};if want!=""&&(err==nil||err.Error()!=want){t.Fatal("native fixture mismatch was credited",mode,err,want)}};if mode=="monitor-ended"{if err!=nil||len(records)!=3||records[2]["ended"]!=true||records[2]["verified"]!=float64(1){t.Fatal("held monitor termination/progress contract",err,records)}}else if len(records)!=0&&mode!="monitor-payload"{t.Fatal("failed probe/monitor emitted acceptance record",mode,records)};if calls!=1{t.Fatal("fixture retried failed peer",mode,calls)}
 })}
}
func TestOriginalTargetBoundsAndPortReadiness(t *testing.T){fixtureReset();defer fixtureReset();for _,seconds:=range []int{0,301}{if err:=target("run","tag","127.0.0.1",seconds);err==nil||err.Error()!="Bounded target connection lifetime required"||fixtureSignalCount!=0{t.Fatal("target bounds moved after native effects",err)}};if err:=target("run","tag","invalid-address",1);err==nil||fixtureSignalCount!=0{t.Fatal("native bind failure ignored",err)};oldArgs,oldFlags:=os.Args,flag.CommandLine;defer func(){os.Args=oldArgs;flag.CommandLine=oldFlags}();err,records:=fixtureOutput(t,func()error{return fixtureRun("--mode=port")});if err!=nil||len(records)!=1||records[0]["port"].(float64)<1||records[0]["platform"]==""||fixtureDispatch!=nil{t.Fatal("native port mode projection",err,records)}}
var fixtureDispatch []any
var fixtureDispatchError=errors.New("original dispatch effect")
func tcpProxyDispatchFixture(host,upstream string,port int,runID string)error{fixtureDispatch=[]any{"tcp-proxy",host,upstream,port,runID};return fixtureDispatchError}
func relayNegativeDispatchFixture(host string,port int,ca,cert,key,node,pin,open,bundle,protection string,old bool)error{fixtureDispatch=[]any{"relay-negative",host,port,ca,cert,key,node,pin,open,bundle,protection,old};return fixtureDispatchError}
func loadDispatchFixture(port,tcp,udp,seconds,size int,run string,progress bool,interval int,cutoff bool)error{fixtureDispatch=[]any{"load",port,tcp,udp,seconds,size,run,progress,interval,cutoff};return fixtureDispatchError}
func targetDispatchFixture(run,tag,host string,seconds int)error{fixtureDispatch=[]any{"target",run,tag,host,seconds};return fixtureDispatchError}
func probeDispatchFixture(port int,udp,tcp bool,tag,host string)error{fixtureDispatch=[]any{"probe",port,udp,tcp,tag,host};return fixtureDispatchError}
func monitorDispatchFixture(port int,tag string)error{fixtureDispatch=[]any{"monitor",port,tag};return fixtureDispatchError}
func udpRouteMonitorDispatchFixture(port int,old,next string)error{fixtureDispatch=[]any{"udp-route-monitor",port,old,next};return fixtureDispatchError}
func occupyUDPDispatchFixture(port int,run string)error{fixtureDispatch=[]any{"occupy-udp",port,run};return fixtureDispatchError}
func fixtureRun(args ...string)error{fixtureDispatch=nil;flag.CommandLine=flag.NewFlagSet("network-fixture",flag.ContinueOnError);os.Args=append([]string{"network-fixture"},args...);return run()}
func TestOriginalNetworkFixtureFlagsRoutingAndPriority(t *testing.T){
 oldArgs,oldFlags:=os.Args,flag.CommandLine;defer func(){os.Args=oldArgs;flag.CommandLine=oldFlags;fixtureReset()}();for _,mode:=range []string{"tcp-proxy","relay-negative","load","target","probe","monitor","udp-route-monitor","occupy-udp"}{err:=fixtureRun("--mode="+mode,"--port=12345","--run-id=run","--tag=old","--next-tag=new","--upstream-host=127.0.0.2","--upstream-port=456","--relay-ca=ca","--relay-cert=cert","--relay-key=key","--relay-node=node","--relay-pin=pin","--relay-open=open","--relay-bundle=bundle","--relay-journal-key=protection","--tls12");if err!=fixtureDispatchError||fixtureDispatch[0]!=mode{t.Fatal("original native mode dispatch/error identity",mode,err,fixtureDispatch)};expected:=map[string][]any{"tcp-proxy":{"tcp-proxy","127.0.0.1","127.0.0.2",456,"run"},"relay-negative":{"relay-negative","127.0.0.1",12345,"ca","cert","key","node","pin","open","bundle","protection",true},"load":{"load",12345,64,32,3,1024,"run",false,0,false},"target":{"target","run","old","127.0.0.1",30},"probe":{"probe",12345,false,false,"old","127.0.0.1"},"monitor":{"monitor",12345,"old"},"udp-route-monitor":{"udp-route-monitor",12345,"old","new"},"occupy-udp":{"occupy-udp",12345,"run"}}[mode];if !reflect.DeepEqual(fixtureDispatch,expected){t.Fatal("original full option projection changed",fixtureDispatch,expected)}}
 for _,args:=range [][]string{nil,{"--mode=probe","--port=0"},{"--mode=probe","--port=65536"},{"--mode=probe","--port=1","--udp-only","--tcp-only"},{"--mode=target","--host=::1"},{"--mode=target","--host=0.0.0.0"},{"--mode=target","--host=224.0.0.1"},{"--mode=target","--host=localhost"},{"--mode=target","--tag="+strings.Repeat("a",33),"--host=invalid"},{"--mode=target","--next-tag="+strings.Repeat("a",33)}}{if err:=fixtureRun(args...);err==nil||fixtureDispatch!=nil{t.Fatal("original CLI first refusal reached effects",args,err,fixtureDispatch)}}
 if err:=fixtureRun("--mode=target","--tag="+strings.Repeat("a",33),"--host=invalid");err==nil||err.Error()!="Bounded fixture tag required"{t.Fatal("tag no longer precedes host validation",err)}
}
func TestOriginalNetworkFixtureMainExitAndFlags(t *testing.T){for _,mode:=range []string{"help","unknown","missing-value","bad-int","main-error"}{command:=exec.Command(os.Args[0],"-test.run=^TestOriginalNetworkFixtureProcessHelper$");command.Env=append(os.Environ(),"TUNEX_NETWORK_PROCESS_MODE="+mode);var output,diagnostic bytes.Buffer;command.Stdout=&output;command.Stderr=&diagnostic;err:=command.Run();code:=0;if err!=nil{exit,ok:=err.(*exec.ExitError);if !ok{t.Fatal(err)};code=exit.ExitCode()};want:=2;if mode=="help"{want=0};if mode=="main-error"{want=1};if code!=want||output.Len()!=0||diagnostic.Len()==0{t.Fatal("original main/flag exit contract",mode,code,output.String(),diagnostic.String())};if mode=="main-error"&&diagnostic.String()!="target or probe with valid port required\n"{t.Fatal("original main diagnostic changed",diagnostic.String())}}}
func TestOriginalNetworkFixtureProcessHelper(t *testing.T){mode:=os.Getenv("TUNEX_NETWORK_PROCESS_MODE");if mode==""{return};args:=map[string][]string{"help":{"--help"},"unknown":{"--unknown"},"missing-value":{"--port"},"bad-int":{"--port=bad"},"main-error":nil}[mode];os.Args=append([]string{"network-fixture"},args...);flag.CommandLine=flag.NewFlagSet("network-fixture",flag.ExitOnError);main();t.Fatal("original native main did not exit")}
`

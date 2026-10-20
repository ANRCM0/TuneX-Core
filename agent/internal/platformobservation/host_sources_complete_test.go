//go:build linux

package platformobservation

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

// Compile the current original parser bodies with source reads/statfs rebound to
// test effects. No parser implementation is duplicated and no production hook is added.
func TestHostCompleteCurrentLinuxSourceEffects(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "host_linux.go", nil, 0); if err != nil { t.Fatal(err) }
	for _, declaration := range file.Decls {
		if imports, ok := declaration.(*ast.GenDecl); ok && imports.Tok == token.IMPORT {
			kept := imports.Specs[:0]; for _, spec := range imports.Specs { if spec.(*ast.ImportSpec).Path.Value != `"os"` { kept = append(kept, spec) } }; imports.Specs = kept
		}
	}
	opens, statfs := 0, 0
	ast.Inspect(file, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr); if !ok { return true }
		selector, ok := call.Fun.(*ast.SelectorExpr); if !ok { return true }
		owner, ok := selector.X.(*ast.Ident); if !ok { return true }
		if owner.Name == "os" && selector.Sel.Name == "Open" { call.Fun = ast.NewIdent("hostSourceOpen"); opens++ }
		if owner.Name == "syscall" && selector.Sel.Name == "Statfs" { call.Fun = ast.NewIdent("hostSourceStatfs"); statfs++ }
		return true
	})
	if opens != 1 || statfs != 1 { t.Fatalf("source effect binding changed: open=%d statfs=%d", opens, statfs) }
	var source bytes.Buffer; if err := format.Node(&source, set, file); err != nil { t.Fatal(err) }
	types, err := parser.ParseFile(set, "../observationwire/host_types.go", nil, 0); if err != nil { t.Fatal(err) }; types.Name.Name = "platformobservation"
	var nativeTypes bytes.Buffer; if err := format.Node(&nativeTypes, set, types); err != nil { t.Fatal(err) }
	root := t.TempDir()
	for name, raw := range map[string][]byte{"go.mod": []byte("module host-source-effects\n\ngo 1.26.3\n"), "host_linux.go": source.Bytes(), "types.go": nativeTypes.Bytes(), "effects_test.go": []byte(hostCompleteSourceHarness)} { if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil { t.Fatal(err) } }
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second); defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", "."); command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil { t.Fatalf("current Linux Host source effects: %v\n%s", err, output) }
}

const hostCompleteSourceHarness = `package platformobservation
import (
 "errors"
 "fmt"
 "io"
 "math"
 "reflect"
 "strings"
 "syscall"
 "testing"
)
type hostSourceFile struct { *strings.Reader; path string }
func (f *hostSourceFile) Read(raw []byte) (int,error) { n,err:=f.Reader.Read(raw);consumed[f.path]+=n;return n,err }
func (f *hostSourceFile) Close() error { closes[f.path]++;return nil }
var source map[string]string
var consumed,closes map[string]int
var trace []string
var filesystem syscall.Statfs_t
var filesystemError error
func resetHostSources() { source=map[string]string{};consumed=map[string]int{};closes=map[string]int{};trace=nil;filesystem=syscall.Statfs_t{Bsize:4096,Frsize:4096,Blocks:100,Bavail:25};filesystemError=nil }
func hostSourceOpen(path string) (io.ReadCloser,error) { trace=append(trace,path);raw,ok:=source[path];if !ok{return nil,errors.New("source unavailable")};return &hostSourceFile{Reader:strings.NewReader(raw),path:path},nil }
func hostSourceStatfs(path string, result *syscall.Statfs_t) error { trace=append(trace,"statfs:"+path);*result=filesystem;return filesystemError }
func TestCPUOriginalParserBranches(t *testing.T) {
 valid:="cpu 1 2 3 4 5 6 7 8 900 800\ncpu0 ignored\ncpu1 ignored\n"
 for _,test:=range []struct{name,raw string;good bool}{
  {"valid",valid,true},{"missing aggregate","cpu0 ignored\n",false},{"missing core","cpu 1 2 3 4 5 6 7 8\n",false},
  {"duplicate aggregate",valid+"cpu 1 2 3 4 5 6 7 8\n",false},{"short aggregate","cpu 1 2 3 4 5 6 7\ncpu0\n",false},
  {"negative","cpu -1 2 3 4 5 6 7 8\ncpu0\n",false},{"unsigned overflow","cpu 18446744073709551616 0 0 0 0 0 0 0\ncpu0\n",false},
  {"sum overflow","cpu 18446744073709551615 1 0 0 0 0 0 0\ncpu0\n",false},{"bad core",valid+"cpuwat\n",false},
  {"leading zero core",valid+"cpu01\n",false},{"duplicate core",valid+"cpu1\n",false},
 } { t.Run(test.name,func(t *testing.T){resetHostSources();source["/proc/stat"]=test.raw;got:=readHostCPU();if test.good {if got.Availability!="available"||*got.LogicalProcessors!=2||*got.TotalTicks!="36"||*got.IdleTicks!="4"||*got.IOWaitTicks!="5" {t.Fatalf("CPU guest or values: %+v",got)}} else if !reflect.DeepEqual(got,HostCPUResources{Availability:"unavailable"}){t.Fatalf("malformed CPU: %+v",got)};if closes["/proc/stat"]!=1{t.Fatal("source not closed")}}) }
 for _,count:=range []int{65536,65537}{resetHostSources();var raw strings.Builder;raw.WriteString("cpu 1 2 3 4 5 6 7 8\n");for i:=0;i<count;i++{fmt.Fprintf(&raw,"cpu%d\n",i)};source["/proc/stat"]=raw.String();got:=readHostCPU();if count==65536 {if got.Availability!="available"||*got.LogicalProcessors!=count{t.Fatal("CPU core bound rejected")}} else if got.Availability!="unavailable"{t.Fatal("CPU core bound exceeded")}}
}
func TestMemoryOriginalParserBranches(t *testing.T) {
 for _,test:=range []struct{name,raw string;good bool}{
  {"valid","MemTotal: 10 kB\nignored nonsense\nMemAvailable: 3 kB\n",true},
  {"duplicate total","MemTotal: 10 kB\nMemTotal: 10 kB\nMemAvailable: 3 kB\n",false},
  {"duplicate available","MemTotal: 10 kB\nMemAvailable: 3 kB\nMemAvailable: 3 kB\n",false},
  {"missing total","MemAvailable: 3 kB\n",false},{"missing available","MemTotal: 10 kB\n",false},
  {"wrong unit","MemTotal: 10 KB\nMemAvailable: 3 kB\n",false},{"extra field","MemTotal: 10 kB extra\nMemAvailable: 3 kB\n",false},
  {"negative","MemTotal: -1 kB\nMemAvailable: 0 kB\n",false},{"multiply overflow","MemTotal: 18014398509481984 kB\nMemAvailable: 0 kB\n",false},
  {"zero total","MemTotal: 0 kB\nMemAvailable: 0 kB\n",false},{"available exceeds total","MemTotal: 1 kB\nMemAvailable: 2 kB\n",false},
 } {t.Run(test.name,func(t *testing.T){resetHostSources();source["/proc/meminfo"]=test.raw;got:=readHostMemory();if test.good {if got.Availability!="available"||*got.TotalBytes!="10240"||*got.AvailableBytes!="3072"{t.Fatalf("memory kB units: %+v",got)}} else if !reflect.DeepEqual(got,HostMemoryResources{Availability:"unavailable"}){t.Fatalf("malformed memory: %+v",got)}})}
}
func TestLoadOriginalParserBranches(t *testing.T) {
 for _,test:=range []struct{raw string;good bool}{{"1 2.5 3.001 extra fields",true},{"1 2",false},{"1 -2 3",false},{"1 2.0000 3",false},{"1 2 18446744073709551.616",false},{"1 2 18446744073709552",false}}{resetHostSources();source["/proc/loadavg"]=test.raw;got:=readHostLoad();if test.good {if got.Availability!="available"||*got.OneMilli!="1000"||*got.FiveMilli!="2500"||*got.FifteenMilli!="3001"{t.Fatalf("milli load: %+v",got)}} else if !reflect.DeepEqual(got,HostLoadResources{Availability:"unavailable"}){t.Fatalf("malformed load: %+v",got)}}
}
func netLine(name string)string{return name+": 100 1 2 3 4 5 6 7 200 9 10 11 12 13 14 15\n"}
const netHeader="Inter-| Receive | Transmit\n face |bytes packets |bytes packets\n"
func TestNetworkOriginalParserSortTruncateAndRefusal(t *testing.T){
 resetHostSources();var raw strings.Builder;raw.WriteString(netHeader);raw.WriteString(netLine("lo"));for i:=19;i>=0;i--{raw.WriteString(netLine(fmt.Sprintf("eth%02d",i)))};source["/proc/net/dev"]=raw.String();got:=readHostNetwork();if got.Availability!="available"||got.Available!=20||got.Returned!=16||got.Omitted!=4||!got.Truncated||len(got.Interfaces)!=16||got.Interfaces[0].Name!="eth00"||got.Interfaces[15].Name!="eth15"||got.Interfaces[0].RXBytes!="100"||got.Interfaces[0].TXBytes!="200"{t.Fatalf("network bounds/sort/loopback/counters: %+v",got)}
 for _,bad:=range []string{"", "header\n", "header\nheader\n",netHeader+"missing colon\n",netHeader+netLine("-bad"),netHeader+netLine(strings.Repeat("a",64)),netHeader+netLine("eth0")+netLine("eth0"),netHeader+"eth0: 1 2\n",netHeader+strings.Replace(netLine("eth0"),"100","-1",1),netHeader+strings.Replace(netLine("eth0"),"200","18446744073709551616",1)}{resetHostSources();source["/proc/net/dev"]=bad;got:=readHostNetwork();if got.Availability!="unavailable"||got.Scope!="agent-network-namespace"||got.Limit!=16||got.Interfaces==nil||len(got.Interfaces)!=0||got.Available!=0||got.Truncated{t.Fatalf("malformed network accepted/leaked: %q %+v",bad,got)}}
 for _,count:=range []int{128,129}{resetHostSources();var raw strings.Builder;raw.WriteString(netHeader);for i:=0;i<count;i++{raw.WriteString(netLine(fmt.Sprintf("e%d",i)))};source["/proc/net/dev"]=raw.String();got:=readHostNetwork();if count==128 {if got.Availability!="available"||got.Available!=128||got.Returned!=16||got.Omitted!=112{t.Fatal("128 source entries refused")}} else if got.Availability!="unavailable" {t.Fatal("129 source entries accepted")}}
 resetHostSources();source["/proc/net/dev"]=netHeader+netLine("eth0:1")+netLine("lo");got=readHostNetwork();if got.Availability!="available"||got.Returned!=1||got.Interfaces[0].Name!="eth0:1"{t.Fatal("last-colon interface/loopback semantics")}
 resetHostSources();source["/proc/net/dev"]=netHeader+netLine("lo");got=readHostNetwork();if got.Availability!="available"||got.Interfaces==nil||len(got.Interfaces)!=0||got.Available!=0{t.Fatal("empty network became nil/unavailable")}
}
func TestFilesystemOriginalValuesAndFailure(t *testing.T){
 resetHostSources();got:=readHostFilesystem();if got.Availability!="available"||got.Scope!="agent-root-filesystem"||*got.TotalBytes!="409600"||*got.AvailableBytes!="102400"{t.Fatalf("filesystem bytes: %+v",got)}
 filesystem.Frsize=0;got=readHostFilesystem();if got.Availability!="available"||*got.TotalBytes!="409600"{t.Fatal("Bsize fallback changed")}
 for _,configure:=range []func(){func(){filesystemError=errors.New("statfs")},func(){filesystem.Bavail=filesystem.Blocks+1},func(){filesystem.Frsize=0;filesystem.Bsize=0},func(){filesystem.Blocks=math.MaxUint64},func(){filesystem.Blocks=math.MaxUint64;filesystem.Bavail=math.MaxUint64}}{resetHostSources();configure();if got:=readHostFilesystem();!reflect.DeepEqual(got,HostFilesystemResources{Availability:"unavailable",Scope:"agent-root-filesystem"}){t.Fatalf("filesystem refusal: %+v",got)}}
}
func TestOriginalSourceLimitsAndCaptureOrder(t *testing.T){
 for _,entry:=range []struct{path string;limit int;read func()string}{{"/proc/stat",1048576,func()string{return readHostCPU().Availability}},{"/proc/meminfo",65536,func()string{return readHostMemory().Availability}},{"/proc/loadavg",4096,func()string{return readHostLoad().Availability}},{"/proc/net/dev",131072,func()string{return readHostNetwork().Availability}}}{resetHostSources();source[entry.path]=strings.Repeat("x",entry.limit+100);if entry.read()!="unavailable"||consumed[entry.path]!=entry.limit+1||closes[entry.path]!=1{t.Fatalf("bounded source %s: %d closed%d",entry.path,consumed[entry.path],closes[entry.path])};resetHostSources();if entry.read()!="unavailable"||closes[entry.path]!=0{t.Fatalf("missing source %s",entry.path)}}
 resetHostSources();source["/proc/stat"]="cpu 1 2 3 4 5 6 7 8\ncpu0\n";source["/proc/meminfo"]="MemTotal: 10 kB\nMemAvailable: 3 kB\n";source["/proc/loadavg"]="1 2 3";source["/proc/net/dev"]=netHeader+netLine("eth0");got:=CaptureHost();if got.Scope!="agent-visible-os"||!reflect.DeepEqual(trace,[]string{"/proc/stat","/proc/meminfo","/proc/loadavg","statfs:/","/proc/net/dev"}){t.Fatalf("Host source order: %v %+v",trace,got)}
}
`

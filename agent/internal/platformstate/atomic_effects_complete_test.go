package platformstate

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
	"strings"
	"testing"
	"time"
)

// Stage the actual source body with test-owned effects. This is not another
// implementation of AtomicWrite and introduces no mutable production test hook.
// The native success/create/rename/permission cases remain in atomic_write_test.
func TestAtomicWriteCompleteSourceEffectsAndUnsupportedLock(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "files.go", nil, 0)
	if err != nil { t.Fatal(err) }
	for _, decl := range file.Decls {
		if imports, ok := decl.(*ast.GenDecl); ok && imports.Tok == token.IMPORT {
			kept := imports.Specs[:0]
			for _, spec := range imports.Specs {
				if spec.(*ast.ImportSpec).Path.Value != `"os"` { kept = append(kept, spec) }
			}
			imports.Specs = kept
		}
	}
	ast.Inspect(file, func(node ast.Node) bool {
		if selector, ok := node.(*ast.SelectorExpr); ok {
			if name, ok := selector.X.(*ast.Ident); ok && name.Name == "os" { name.Name = "atomicEffects" }
		}
		return true
	})
	var source bytes.Buffer
	if err := format.Node(&source, set, file); err != nil { t.Fatal(err) }
	unsupported, err := os.ReadFile("lock_other.go")
	if err != nil { t.Fatal(err) }
	unsupportedBody := strings.SplitN(string(unsupported), "\n", 2)
	if len(unsupportedBody) != 2 || !strings.Contains(unsupportedBody[0], "!linux && !windows") { t.Fatal("unsupported lock source changed") }
	root := t.TempDir()
	for name, raw := range map[string][]byte{
		"go.mod": []byte("module atomic-effects-fixture\n\ngo 1.26\n"),
		"files.go": source.Bytes(),
		"unsupported.go": []byte(unsupportedBody[1]),
		"effects_test.go": []byte(atomicWriteEffectsHarness),
	} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil { t.Fatal(err) }
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil { t.Fatalf("actual source effect fixture failed: %v\n%s", err, output) }
}

const atomicWriteEffectsHarness = `package platformstate
import (
 "bytes"
 "errors"
 "os"
 "path/filepath"
 "reflect"
 "testing"
)
type effectOS struct {
 PathSeparator byte
 fail map[string]error
 trace []string
 target, written []byte
 temp bool
}
var atomicEffects *effectOS
type effectFile struct { directory bool }
func (s *effectOS) stage(name string) error { s.trace=append(s.trace,name);return s.fail[name] }
func (s *effectOS) CreateTemp(dir, pattern string) (*effectFile,error) {
 if dir!=filepath.Dir("state/authority") || pattern!=".state-" { panic("temp parent or pattern") }
 if err:=s.stage("create");err!=nil{return nil,err};s.temp=true;return &effectFile{},nil
}
func (*effectFile) Name() string { return "state/.state-fixed" }
func (*effectFile) Chmod(mode os.FileMode) error { if mode!=0600 { panic("mode") };return atomicEffects.stage("chmod") }
func (*effectFile) Write(raw []byte) (int,error) {
 if !bytes.Equal(raw,[]byte{255,0,128,66}){panic("raw bytes")}
 if err:=atomicEffects.stage("write");err!=nil{return 0,err};atomicEffects.written=append([]byte(nil),raw...);return len(raw),nil
}
func (f *effectFile) Sync() error { if f.directory{return atomicEffects.stage("directory-sync")};return atomicEffects.stage("file-sync") }
func (f *effectFile) Close() error { if f.directory{return atomicEffects.stage("directory-close")};return atomicEffects.stage("close") }
func (s *effectOS) Rename(from,to string) error {
 if from!="state/.state-fixed" || to!="state/authority"{panic("rename paths")}
 if err:=s.stage("rename");err!=nil{return err};s.target=append([]byte(nil),s.written...);s.temp=false;return nil
}
func (s *effectOS) Open(path string) (*effectFile,error) {
 if path!=filepath.Dir("state/authority"){panic("directory path")}
 if err:=s.stage("directory-open");err!=nil{return nil,err};return &effectFile{directory:true},nil
}
func (s *effectOS) Remove(path string) error {
 if path!="state/.state-fixed"{panic("protected path removed")};if err:=s.stage("remove");err!=nil{return err};s.temp=false;return nil
}
func TestEffects(t *testing.T) {
 vectors:=[]struct{name string; failures []string; trace []string; replaced,success bool}{
  {"success",nil,[]string{"create","chmod","write","file-sync","close","rename","directory-open","directory-sync","directory-close","remove"},true,true},
  {"create",[]string{"create"},[]string{"create"},false,false},
  {"chmod",[]string{"chmod","close"},[]string{"create","chmod","close","remove"},false,false},
  {"write",[]string{"write","close"},[]string{"create","chmod","write","close","remove"},false,false},
  {"file-sync",[]string{"file-sync","close"},[]string{"create","chmod","write","file-sync","close","remove"},false,false},
  {"close",[]string{"close"},[]string{"create","chmod","write","file-sync","close","remove"},false,false},
  {"rename",[]string{"rename","remove"},[]string{"create","chmod","write","file-sync","close","rename","remove"},false,false},
  {"directory-open",[]string{"directory-open"},[]string{"create","chmod","write","file-sync","close","rename","directory-open","remove"},true,false},
  {"directory-sync",[]string{"directory-sync","directory-close"},[]string{"create","chmod","write","file-sync","close","rename","directory-open","directory-sync","directory-close","remove"},true,false},
  {"directory-close",[]string{"directory-close"},[]string{"create","chmod","write","file-sync","close","rename","directory-open","directory-sync","directory-close","remove"},true,true},
  {"remove",[]string{"remove"},[]string{"create","chmod","write","file-sync","close","rename","directory-open","directory-sync","directory-close","remove"},true,true},
 }
 for _,windows:=range []bool{false,true}{for _,v:=range vectors{
  name:="posix/"+v.name;if windows{name="windows/"+v.name}
  t.Run(name,func(t *testing.T){
   atomicEffects=&effectOS{PathSeparator:'/',fail:map[string]error{},target:[]byte("protected-old")}
   if windows{atomicEffects.PathSeparator='\\'}
   for _,stage:=range v.failures{atomicEffects.fail[stage]=errors.New(stage)}
   err:=AtomicWrite("state/authority",[]byte{255,0,128,66})
   success:=v.success || windows && (v.name=="directory-open" || v.name=="directory-sync")
   if success && err!=nil{t.Fatalf("ignored platform/cleanup error changed outcome: %v",err)}
   if !success && (len(v.failures)==0 || err!=atomicEffects.fail[v.failures[0]]){t.Fatalf("first error lost: %v",err)}
   if !reflect.DeepEqual(atomicEffects.trace,v.trace){t.Fatalf("trace %v want %v",atomicEffects.trace,v.trace)}
   want:=[]byte("protected-old");if v.replaced{want=[]byte{255,0,128,66}}
   retainedTemp:=v.name=="rename" // The remove failure is best effort and never replaces the rename error.
   if !bytes.Equal(atomicEffects.target,want) || atomicEffects.temp!=retainedTemp{t.Fatalf("authority/temp outcome: %x temp=%v",atomicEffects.target,atomicEffects.temp)}
  })
 }}
}
func TestUnsupportedLockHasNoRelease(t *testing.T){
 release,err:=AcquireLock("never-opened-protected-history")
 if release!=nil || err==nil || err.Error()!="Agent runtime supports Linux and Windows development only"{t.Fatalf("unsupported lock accepted: %v",err)}
}
`

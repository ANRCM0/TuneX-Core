package nativeexecution

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
)

// Execute the exact adapter body with only native transit.Prepare rebound. This
// exposes a partial native pointer without adding a production failure hook.
func TestOfflineAdapterCompleteNilPartialAndSuccessIdentity(t *testing.T) {
	set := token.NewFileSet()
	file, err := parser.ParseFile(set, "offline_transit.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	fixture := &ast.File{Name: ast.NewIdent("nativeexecution")}
	imports := &ast.GenDecl{Tok: token.IMPORT}
	for _, path := range []string{"github.com/tunex/vnext/agent/internal/executionhost"} {
		imports.Specs = append(imports.Specs, &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("%q", path)}})
	}
	fixture.Decls = append(fixture.Decls, imports)
	found, rebound := 0, 0
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "PrepareOfflineTransit" {
			continue
		}
		found++
		ast.Inspect(fn, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			owner, ok := selector.X.(*ast.Ident)
			if ok && owner.Name == "transit" && selector.Sel.Name == "Prepare" {
				call.Fun = ast.NewIdent("nativePrepareFixture")
				rebound++
			}
			return true
		})
		fixture.Decls = append(fixture.Decls, fn)
	}
	if found != 1 || rebound != 1 {
		t.Fatal("original adapter inventory changed", found, rebound)
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
	module := fmt.Sprintf("module github.com/tunex/vnext/agent/internal/offlineadapterfixture\n\ngo 1.26.3\n\nrequire github.com/tunex/vnext/agent v0.0.0\nreplace github.com/tunex/vnext/agent => %s\n", filepath.ToSlash(moduleRoot))
	for name, raw := range map[string][]byte{"go.mod": []byte(module), "original.go": source.Bytes(), "effects_test.go": []byte(offlineAdapterCompleteFixture)} {
		if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-mod=mod", "-count=1", ".")
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if out, err := command.CombinedOutput(); err != nil {
		t.Fatalf("original native adapter: %v\n%s", err, out)
	}
}

const offlineAdapterCompleteFixture = `package nativeexecution
import("errors";"reflect";"testing";"github.com/tunex/vnext/agent/internal/transit")
type OfflineTransitIdentity=transit.Identity
type nativeEngineFixture struct{activated,closed int}
func(e *nativeEngineFixture)Activate()error{e.activated++;return nil}
func(e *nativeEngineFixture)Close(){e.closed++}
var nativeReturned *nativeEngineFixture
var nativeFailure error
var nativeCalls int
var nativeRaw []byte
var nativeID OfflineTransitIdentity
var nativeAllow func()error
func nativePrepareFixture(raw []byte,id OfflineTransitIdentity,allow func()error)(*nativeEngineFixture,error){nativeCalls++;if len(raw)==0||&raw[0]!=&nativeRaw[0]||!reflect.DeepEqual(id,nativeID)||reflect.ValueOf(allow).Pointer()!=reflect.ValueOf(nativeAllow).Pointer(){panic("native adapter changed arguments")};return nativeReturned,nativeFailure}
func TestOriginalAdapterReturnShapes(t *testing.T){failure:=errors.New("original native Prepare error");nativeRaw=[]byte{0,255,128};nativeID=OfflineTransitIdentity{};allowCalls:=0;nativeAllow=func()error{allowCalls++;return failure}
 for _,present:=range []bool{false,true}{for _,err:=range []error{nil,failure}{nativeCalls=0;nativeFailure=err;nativeReturned=nil;if present{nativeReturned=&nativeEngineFixture{}}
 instance,got:=PrepareOfflineTransit(nativeRaw,nativeID,nativeAllow);if nativeCalls!=1||got!=err||allowCalls!=0{t.Fatal("adapter added effects/changed error",got)}
 if present{if instance!=nativeReturned||nativeReturned.closed!=0||nativeReturned.activated!=0{t.Fatal("partial native engine pointer normalized or activated/closed")};instance.Close();if nativeReturned.closed!=1{t.Fatal("caller could not close partial original native engine")}}else if instance!=nil{t.Fatal("typed nil escaped as prepared interface")}
 }}
}
`

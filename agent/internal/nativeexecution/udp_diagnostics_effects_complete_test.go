package nativeexecution

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

// The original exported helper's exact native type behavior is tested separately.
// Here the current helper and current UDP Stats/Remaining bodies are staged with
// counting storage effects to expose even the ignored ActiveSessions read.
func TestUDPDiagnosticsCompleteOriginalStatsReadAndProjectionEffects(t *testing.T) {
	set := token.NewFileSet()
	helper, err := parser.ParseFile(set, "diagnostic_values.go", nil, 0); if err != nil { t.Fatal(err) }
	kept := helper.Decls[:0]; for _, declaration := range helper.Decls { if imports, ok := declaration.(*ast.GenDecl); !ok || imports.Tok != token.IMPORT { kept = append(kept, declaration) } }; helper.Decls = kept
	ast.Inspect(helper, func(node ast.Node) bool {
		switch value := node.(type) {
		case *ast.Field:
			if selector, ok := value.Type.(*ast.SelectorExpr); ok { if owner, ok := selector.X.(*ast.Ident); ok && owner.Name == "executionhost" && selector.Sel.Name == "Instance" { value.Type = ast.NewIdent("instanceFixture") } }
		case *ast.StarExpr:
			if selector, ok := value.X.(*ast.SelectorExpr); ok { if owner, ok := selector.X.(*ast.Ident); ok && owner.Name == "forward" && selector.Sel.Name == "UDP" { value.X = ast.NewIdent("UDP") } }
		}; return true
	})
	forwardFile, err := parser.ParseFile(set, "../forward/udp.go", nil, 0); if err != nil { t.Fatal(err) }
	stats, remaining, shape := 0, 0, 0
	for _, declaration := range forwardFile.Decls {
		if function, ok := declaration.(*ast.FuncDecl); ok && function.Recv != nil && len(function.Recv.List) == 1 {
			pointer, ok := function.Recv.List[0].Type.(*ast.StarExpr); if !ok { continue }; receiver, ok := pointer.X.(*ast.Ident); if !ok || receiver.Name != "UDP" { continue }
			if function.Name.Name == "Stats" { helper.Decls = append(helper.Decls, function); stats++ }; if function.Name.Name == "Remaining" { helper.Decls = append(helper.Decls, function); remaining++ }
		}
		if declaration, ok := declaration.(*ast.GenDecl); ok && declaration.Tok == token.TYPE { for _, spec := range declaration.Specs { if spec.(*ast.TypeSpec).Name.Name == "UDPStats" { helper.Decls = append(helper.Decls, &ast.GenDecl{Tok: token.TYPE, Specs: []ast.Spec{spec}}); shape++ } } }
	}
	if stats != 1 || remaining != 1 || shape != 1 { t.Fatal("native UDP source owner changed") }
	var source bytes.Buffer; if err := format.Node(&source, set, helper); err != nil { t.Fatal(err) }
	root := t.TempDir()
	for name, raw := range map[string][]byte{"go.mod": []byte("module udp-diagnostic-effects\n\ngo 1.26.3\n"), "original.go": source.Bytes(), "effects_test.go": []byte(udpDiagnosticsCompleteEffectsHarness)} { if err := os.WriteFile(filepath.Join(root, name), raw, 0600); err != nil { t.Fatal(err) } }
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second); defer cancel()
	command := exec.CommandContext(ctx, "go", "test", "-count=1", "."); command.Dir = root; command.Env = append(os.Environ(), "GOWORK=off", "GO111MODULE=on", "GOTOOLCHAIN=local")
	if output, err := command.CombinedOutput(); err != nil { t.Fatalf("original UDP diagnostic effects: %v\n%s", err, output) }
}

const udpDiagnosticsCompleteEffectsHarness = `package nativeexecution
import ("reflect";"testing")
type instanceFixture interface {Close();Drain();Remaining()uint64;SetAuthorization(func()error)}
var reads []string
type mutexFixture struct{}
func(mutexFixture)Lock(){reads=append(reads,"remaining-lock")}
func(mutexFixture)Unlock(){reads=append(reads,"remaining-unlock")}
type loadFixture struct {name string;value uint64}
func(f *loadFixture)Load()uint64{reads=append(reads,f.name);return f.value}
type UDP struct {instanceFixture;mutex mutexFixture;sessions map[int]bool;capacity,rejected,datagrams,queues,amplified loadFixture}
func TestOriginalStatsAndIgnoredActiveSessions(t *testing.T){
 engine:=&UDP{sessions:map[int]bool{1:true,2:true},capacity:loadFixture{"capacity",3},rejected:loadFixture{"rejected",5},datagrams:loadFixture{"datagrams",7},queues:loadFixture{"queues",11},amplified:loadFixture{"amplified",^uint64(0)}}
 result,ok:=ReadUDPDiagnostics(engine)
 if !ok||result!=(UDPDiagnosticDrops{CapacityDropped:3,TargetRejected:5,DatagramDropped:7,QueueDropped:11,AmplificationDropped:^uint64(0)}){t.Fatalf("native projection: %+v %v",result,ok)}
 want:=[]string{"remaining-lock","remaining-unlock","capacity","rejected","datagrams","queues","amplified"}
 if !reflect.DeepEqual(reads,want){t.Fatalf("one original Stats including ignored ActiveSessions: %v",reads)}
 if reflect.TypeOf(result).NumField()!=5{t.Fatal("ignored ActiveSessions leaked into drops DTO")}
}
`

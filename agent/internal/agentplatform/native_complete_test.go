package agentplatform

import (
	"crypto/tls"
	"crypto/x509"
	"go/ast"
	"go/parser"
	"go/token"
	"net/http"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/controlchannel"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

func TestAgentPlatformCompleteCanonicalFieldsAndNativeDefaults(t *testing.T) {
	if InterfaceVersion != 1 { t.Fatal("native assembly interface version changed") }
	type field struct { name string; typ reflect.Type }
	for _,shape:=range []struct{ value any; name string; fields []field }{
		{Providers{},"Providers",[]field{{"Identity",reflect.TypeOf((*executionidentity.Provider[tls.Certificate,*x509.CertPool])(nil)).Elem()},{"Channel",reflect.TypeOf((*executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate])(nil)).Elem()}}},
		{Effects{},"Effects",[]field{{"Bootstrap",reflect.TypeOf((*runtimeplatform.Bootstrap[*x509.CertPool])(nil)).Elem()},{"Schedule",reflect.TypeOf((*runtimeplatform.Scheduler)(nil)).Elem()},{"Auxiliary",reflect.TypeOf((*executionchannel.Auxiliary[*http.Client])(nil)).Elem()}}},
		{LocalServices{},"LocalServices",[]field{{"Observation",reflect.TypeOf((*platformobservation.Provider)(nil)).Elem()},{"Entropy",reflect.TypeOf((*runtimeplatform.Entropy)(nil)).Elem()},{"Measurements",reflect.TypeOf((*runtimeplatform.MeasurementFiles)(nil)).Elem()},{"Log",reflect.TypeOf((*runtimeplatform.LocalLog)(nil)).Elem()}}},
	}{
		typ:=reflect.TypeOf(shape.value)
		if typ.PkgPath()!="github.com/tunex/vnext/agent/internal/agentplatform"||typ.Name()!=shape.name||typ.NumField()!=len(shape.fields){t.Fatal("canonical assembly owner/shape changed",typ)}
		for i,want:=range shape.fields{got:=typ.Field(i);if got.Name!=want.name||got.Type!=want.typ||got.Tag!=""||got.Anonymous{t.Fatalf("%s field%d = %#v",shape.name,i,got)}}
	}
	providers,effects,local:=DefaultProviders(),DefaultEffects(),DefaultLocalServices()
	wantProviders:=Providers{Identity:agentidentity.Native{},Channel:controlchannel.Native{}}
	wantEffects:=Effects{Bootstrap:platformruntime.Bootstrap{},Schedule:platformruntime.Schedule{},Auxiliary:controlchannel.Native{}}
	wantLocal:=LocalServices{Observation:platformobservation.Native{},Entropy:platformruntime.Local{},Measurements:platformruntime.Local{},Log:platformruntime.Local{}}
	if !reflect.DeepEqual(providers,wantProviders)||!reflect.DeepEqual(effects,wantEffects)||!reflect.DeepEqual(local,wantLocal){t.Fatal("native provider specialization or defaults changed")}
	// Each default remains a detached assembly value; mutating one does not
	// normalize or cache later defaults.
	providers.Identity=nil;effects.Schedule=nil;local.Entropy=nil
	if !reflect.DeepEqual(DefaultProviders(),wantProviders)||!reflect.DeepEqual(DefaultEffects(),wantEffects)||!reflect.DeepEqual(DefaultLocalServices(),wantLocal){t.Fatal("default assembly is shared mutable state")}
}

func TestAgentPlatformCompleteDefaultsCannotSampleTimeIOOrEntropy(t *testing.T) {
	// A behavioral clock replacement cannot observe native time.Now without a
	// production hook. Pin the default construction boundary instead: these three
	// functions assemble concrete zero-value providers and may invoke no effect.
	file,err:=parser.ParseFile(token.NewFileSet(),"native.go",nil,0);if err!=nil{t.Fatal(err)}
	wanted:=map[string]bool{"DefaultProviders":false,"DefaultEffects":false,"DefaultLocalServices":false}
	for _,declaration:=range file.Decls{
		fn,ok:=declaration.(*ast.FuncDecl);if !ok{continue};if _,ok:=wanted[fn.Name.Name];!ok{continue};wanted[fn.Name.Name]=true
		if len(fn.Body.List)!=1{t.Fatal("default assembly gained work",fn.Name.Name)}
		result,ok:=fn.Body.List[0].(*ast.ReturnStmt);if !ok||len(result.Results)!=1{t.Fatal("default no longer returns one assembly",fn.Name.Name)}
		if _,ok:=result.Results[0].(*ast.CompositeLit);!ok{t.Fatal("default no longer constructs its native record",fn.Name.Name)}
		ast.Inspect(fn.Body,func(node ast.Node)bool{if _,ok:=node.(*ast.CallExpr);ok{t.Errorf("%s invokes an effect during default construction",fn.Name.Name)};return true})
	}
	for name,present:=range wanted{if !present{t.Fatal("missing native default",name)}}
}

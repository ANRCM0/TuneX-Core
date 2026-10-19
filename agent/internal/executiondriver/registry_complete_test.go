package executiondriver_test

import (
	"reflect"
	"runtime"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/relay"
)

var (
	_ func(...executiondriver.Driver)(*executiondriver.Registry,error)=executiondriver.NewRegistry
	_ func(*executiondriver.Registry,adp3.Assignment,executiondriver.Features)(executiondriver.Driver,error)=(*executiondriver.Registry).Resolve
	_ func(*executiondriver.Registry)[]executiondriver.Descriptor=(*executiondriver.Registry).Descriptors
	_ func(executiondriver.Host)(relay.Identity,time.Time,error)=executiondriver.Host.RequirePeerIdentity
)

func TestExecutionDriverCompletePublicNativeAliasesAndZeroBinding(t *testing.T){
	for _,pair:=range [][2]reflect.Type{
		{reflect.TypeOf((*executiondriver.Instance)(nil)).Elem(),reflect.TypeOf((*executionhost.Instance)(nil)).Elem()},
		{reflect.TypeOf(executiondriver.Host{}),reflect.TypeOf(executionhost.Host[adp3.Policy,relay.Identity]{})},
		{reflect.TypeOf(executiondriver.Descriptor{}),reflect.TypeOf(executionhost.Descriptor{})},
		{reflect.TypeOf(executiondriver.ProbeTarget{}),reflect.TypeOf(executionhost.ProbeTarget{})},
		{reflect.TypeOf(executiondriver.Driver{}),reflect.TypeOf(executionhost.Driver[adp3.Assignment,adp3.Policy,relay.Identity]{})},
		{reflect.TypeOf(executiondriver.Features{}),reflect.TypeOf(executionhost.Features{})},
	}{if pair[0]!=pair[1]||pair[0].PkgPath()!="github.com/tunex/vnext/agent/internal/executionhost"{t.Fatal("typed native alias canonical identity changed",pair)}}
	if executiondriver.HostVersion!=1{t.Fatal("typed host version changed")}
	if executiondriver.HostVersion!=executionhost.HostVersion{t.Fatal("typed host version differs from executionhost")}
	zero:=&executiondriver.Registry{}
	if values:=zero.Descriptors();values==nil||len(values)!=0{t.Fatal("native zero Registry invented defaults")}
	if driver,err:=zero.Resolve(adp3.Assignment{},executiondriver.Features{});err==nil||err.Error()!="UNSUPPORTED_CAPABILITY: Execution host, platform, driver, version, role, phase or protocol unavailable"||driver.Descriptor.ID!=""{t.Fatal("native zero resolve changed")}
	for _,operation:=range []func(){func(){var absent *executiondriver.Registry;absent.Descriptors()},func(){var absent *executiondriver.Registry;_,_=absent.Resolve(adp3.Assignment{},executiondriver.Features{})}}{func(){defer func(){if recover()==nil{t.Error("nil native registry behavior normalized")}}();operation()}()}
	driver:=nativeexecution.Direct();driver.Descriptor.Platforms=[]string{"windows"};if runtime.GOOS=="windows"{driver.Descriptor.Platforms=[]string{"linux"}}
	registry,err:=executiondriver.NewRegistry(driver);if err!=nil{t.Fatal(err)}
	assignment:=adp3.Assignment{Role:"direct",Phase:"active",Protocol:"tcp",Driver:adp3.Driver{Id:"native.direct.v1",SchemaVersion:1}}
	if _,err:=registry.Resolve(assignment,executiondriver.Features{});err==nil||executiondriver.EnabledOnCurrentPlatform(driver.Descriptor,executiondriver.Features{}){t.Fatal("native registry trusted foreign declared platform")}
	registry,err=executiondriver.NewRegistry(nativeexecution.Direct());if err!=nil{t.Fatal(err)}
	got,err:=registry.Resolve(assignment,executiondriver.Features{});if (err==nil)!=(runtime.GOOS=="linux"||runtime.GOOS=="windows"){t.Fatal("native binding no longer supplies runtime.GOOS")}
	if err==nil{got.Descriptor.Platforms[0]="mutated";again,err:=registry.Resolve(assignment,executiondriver.Features{});if err!=nil||again.Descriptor.Platforms[0]!="linux"{t.Fatal("typed wrapper returned shared descriptors")}}
}

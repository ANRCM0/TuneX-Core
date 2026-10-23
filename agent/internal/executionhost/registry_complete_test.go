package executionhost

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

type completeHostAssignment struct{ ID string }
type completeHostPolicy struct{ Limit int }
type completeHostIdentity struct{ ID string }
type completeHostInstance struct{ closed,drained int; authorization func()error }
func(i *completeHostInstance)Close(){i.closed++}
func(i *completeHostInstance)Drain(){i.drained++}
func(i *completeHostInstance)Remaining()uint64{return 7}
func(i *completeHostInstance)SetAuthorization(check func()error){i.authorization=check}
type completeHostDriver = Driver[completeHostAssignment,completeHostPolicy,completeHostIdentity]
type completeHostRegistry = Registry[completeHostAssignment,completeHostPolicy,completeHostIdentity]

func completeHostDeclaration(calls *int)completeHostDriver{
	return completeHostDriver{Descriptor:Descriptor{ID:"custom.driver",HostVersion:1,SchemaVersion:1,Platforms:[]string{"linux","windows"},Roles:[]string{"custom-role"},Phases:[]string{"prepared","active","draining"},Protocols:[]string{"tcp","udp"},Capabilities:[]string{"custom.driver","custom.capability"}},
		Start:func(Host[completeHostPolicy,completeHostIdentity],completeHostAssignment,func()error)(Instance,error){*calls++;return &completeHostInstance{},nil},Phase:func(Instance,string)error{*calls++;return nil},Classify:func(error)(string,bool){*calls++;return "original",false}}
}

func TestExecutionHostCompletePublicBindingsFieldsAndZeroRegistry(t *testing.T){
	var _ func(...completeHostDriver)(*completeHostRegistry,error)=NewRegistry[completeHostAssignment,completeHostPolicy,completeHostIdentity]
	var _ func(*completeHostRegistry,Selection,Features,string)(completeHostDriver,error)=(*completeHostRegistry).Resolve
	var _ func(*completeHostRegistry)[]Descriptor=(*completeHostRegistry).Descriptors
	var _ Instance=(*completeHostInstance)(nil)
	var _ func(Host[completeHostPolicy,completeHostIdentity])(completeHostIdentity,time.Time,error)=Host[completeHostPolicy,completeHostIdentity].RequirePeerIdentity
	if HostVersion!=1||PreparedInstanceVersion!=1{t.Fatal("host vocabulary version changed")}
	for _,shape:=range []struct{actual,want reflect.Type}{
		{reflect.TypeOf(Host[completeHostPolicy,completeHostIdentity]{}),reflect.TypeOf(struct{NodeID string;SessionEpoch uint64;Policy completeHostPolicy;PeerIdentity func()(completeHostIdentity,time.Time,error);Payload PayloadGate}{})},
		{reflect.TypeOf(ProbeTarget{}),reflect.TypeOf(struct{Address string;Port uint64;Check func()error}{})},
		{reflect.TypeOf(Features{}),reflect.TypeOf(struct{Relay,Multihop bool}{})},
		{reflect.TypeOf(Selection{}),reflect.TypeOf(struct{DriverID string;SchemaVersion uint64;Role,Phase,Protocol string}{})},
		{reflect.TypeOf(completeHostDriver{}),reflect.TypeOf(struct{Descriptor Descriptor;Start func(Host[completeHostPolicy,completeHostIdentity],completeHostAssignment,func()error)(Instance,error);Replace func(Instance,completeHostAssignment,func()error)(Instance,error);Phase func(Instance,string)error;Classify func(error)(string,bool);ProbeIngress func(Instance)(ProbeTarget,error);ProbeUDPIngress func(Instance)(ProbeTarget,error)}{})},
	}{if shape.actual.NumField()!=shape.want.NumField(){t.Fatal("public record field count changed",shape.actual)};for i:=0;i<shape.want.NumField();i++{a,b:=shape.actual.Field(i),shape.want.Field(i);if a.Name!=b.Name||a.Type!=b.Type||a.Tag!=b.Tag||a.Anonymous!=b.Anonymous{t.Fatal("public record field/order/type changed",shape.actual,a)}}}
	for _,entry:=range []struct{typ reflect.Type;methods []string}{
		{reflect.TypeOf((*Instance)(nil)).Elem(),[]string{"Close","Drain","Remaining","SetAuthorization"}},
		{reflect.TypeOf((*completeHostRegistry)(nil)),[]string{"Descriptors","Resolve"}},
		{reflect.TypeOf(Host[completeHostPolicy,completeHostIdentity]{}),[]string{"RequirePeerIdentity"}},
		{reflect.TypeOf(Descriptor{}),[]string{"Clone","Enabled"}},
	}{if entry.typ.NumMethod()!=len(entry.methods){t.Fatal("public method set changed",entry.typ)};for i,name:=range entry.methods{if entry.typ.Method(i).Name!=name{t.Fatal("public method name changed",entry.typ)}}}
	gateType:=reflect.TypeOf((*PayloadGate)(nil)).Elem()
	if gateType.NumMethod()!=1{t.Fatal("payload gate method set changed")}
	if method:=gateType.Method(0);method.Name!="Acquire"||method.Type!=reflect.TypeOf((func(context.Context,int,bool)(int,error))(nil)){t.Fatal("payload gate acquisition contract changed",method)}
	descriptorFields:=[]string{"ID","HostVersion","SchemaVersion","Platforms","Roles","Phases","Protocols","Capabilities","ProbeCapabilities","RequiresRelay","RequiresMultihop"}
	typ:=reflect.TypeOf(Descriptor{});if typ.NumField()!=len(descriptorFields){t.Fatal("descriptor field count changed")};for i,name:=range descriptorFields{f:=typ.Field(i);want:=reflect.TypeOf([]string(nil));switch{case i==0:want=reflect.TypeOf("");case i==1||i==2:want=reflect.TypeOf(uint64(0));case i>=9:want=reflect.TypeOf(false)};if f.Name!=name||f.Type!=want||f.Tag!=""{t.Fatal("descriptor field/order/type changed",f)}}
	raw,err:=json.Marshal(Descriptor{ID:"d",HostVersion:1,SchemaVersion:2,Platforms:[]string{"linux"},Roles:[]string{},RequiresRelay:true})
	want:=`{"ID":"d","HostVersion":1,"SchemaVersion":2,"Platforms":["linux"],"Roles":[],"Phases":null,"Protocols":null,"Capabilities":null,"ProbeCapabilities":null,"RequiresRelay":true,"RequiresMultihop":false}`
	if err!=nil||string(raw)!=want{t.Fatal("descriptor serialization changed",string(raw),err)}
	zero:=&completeHostRegistry{}
	if values:=zero.Descriptors();values==nil||len(values)!=0{t.Fatal("zero registry descriptor shape changed")}
	if got,err:=zero.Resolve(Selection{},Features{},"linux");err==nil||err.Error()!="UNSUPPORTED_CAPABILITY: Execution host, platform, driver, version, role, phase or protocol unavailable"||got.Descriptor.ID!=""{t.Fatal("zero registry gained a fallback")}
	for _,operation:=range []func(){func(){var absent *completeHostRegistry;absent.Descriptors()},func(){var absent *completeHostRegistry;_,_=absent.Resolve(Selection{},Features{},"linux")}}{
		func(){defer func(){if recover()==nil{t.Error("nil Registry receiver silently acquired zero/default behavior")}}();operation()}()
	}
	var calls int;failure:=errors.New("native provider error");until:=time.Date(2026,10,20,0,0,0,0,time.UTC)
	if identity,expiry,err:=(Host[completeHostPolicy,completeHostIdentity]{}).RequirePeerIdentity();identity!=(completeHostIdentity{})||!expiry.IsZero()||err==nil||err.Error()!="AUTHORIZATION_DENIED: Host peer credential required"{t.Fatal("missing peer identity behavior changed")}
	host:=Host[completeHostPolicy,completeHostIdentity]{PeerIdentity:func()(completeHostIdentity,time.Time,error){calls++;return completeHostIdentity{"peer"},until,failure}}
	if identity,expiry,err:=host.RequirePeerIdentity();identity.ID!="peer"||expiry!=until||err!=failure||calls!=1{t.Fatal("peer callback result/error projected more than once")}
}

func TestExecutionHostCompleteBoundedDeclarationsFirstErrorsAndDetachedSlices(t *testing.T){
	calls:=0;driver:=completeHostDeclaration(&calls)
	if registry,err:=NewRegistry[completeHostAssignment,completeHostPolicy,completeHostIdentity]();registry!=nil||err==nil||err.Error()!="INVALID_CONFIG: Bounded execution drivers required"{t.Fatal("empty declarations accepted")}
	tooMany:=make([]completeHostDriver,65);if _,err:=NewRegistry(tooMany...);err==nil||err.Error()!="INVALID_CONFIG: Bounded execution drivers required"{t.Fatal("driver count unbounded")}
	for _,mutation:=range []func(*completeHostDriver){
		func(d *completeHostDriver){d.Descriptor.ID=strings.Repeat("x",129)},func(d *completeHostDriver){d.Descriptor.HostVersion=2},func(d *completeHostDriver){d.Descriptor.SchemaVersion=0},
		func(d *completeHostDriver){d.Start=nil},func(d *completeHostDriver){d.Phase=nil},func(d *completeHostDriver){d.Classify=nil},
		func(d *completeHostDriver){d.Descriptor.Platforms=[]string{"darwin"}},func(d *completeHostDriver){d.Descriptor.Phases=[]string{"suspended"}},func(d *completeHostDriver){d.Descriptor.Protocols=[]string{"quic"}},
		func(d *completeHostDriver){d.Descriptor.Roles=nil},func(d *completeHostDriver){d.Descriptor.Roles=[]string{}},func(d *completeHostDriver){d.Descriptor.Roles=[]string{"r","r"}},func(d *completeHostDriver){d.Descriptor.Roles=[]string{strings.Repeat("r",129)}},
		func(d *completeHostDriver){d.Descriptor.Roles=make([]string,65)},func(d *completeHostDriver){d.Descriptor.RequiresMultihop=true},func(d *completeHostDriver){d.Descriptor.Capabilities=[]string{"other"}},
	}{d:=driver;d.Descriptor=d.Descriptor.Clone();mutation(&d);if registry,err:=NewRegistry(d);registry!=nil||err==nil||err.Error()!="INVALID_CONFIG: Incompatible execution host or descriptor"{t.Fatal("descriptor vocabulary/bounds changed",d.Descriptor,err)}}
	// Header validation is before duplicate ID; duplicate is before Probe shape;
	// Probe shape is before collision. These representative pairs pin the order.
	for _,vector:=range []struct{change func(*completeHostDriver);prefix []completeHostDriver;want string}{
		{func(d *completeHostDriver){d.Start=nil;d.Descriptor.ProbeCapabilities=[]string{"bad"}},[]completeHostDriver{driver},"INVALID_CONFIG: Incompatible execution host or descriptor"},
		{func(d *completeHostDriver){d.Descriptor.ProbeCapabilities=[]string{"bad"}},[]completeHostDriver{driver},"INVALID_CONFIG: Duplicate execution driver"},
		{func(d *completeHostDriver){d.Descriptor.ProbeCapabilities=[]string{"custom.driver"}},nil,"INVALID_CONFIG: Observation ports and declarations differ"},
		{func(d *completeHostDriver){d.ProbeIngress=func(Instance)(ProbeTarget,error){calls++;return ProbeTarget{},nil};d.Descriptor.ProbeCapabilities=[]string{"custom.driver"}},nil,"INVALID_CONFIG: Duplicate observation capability"},
	}{d:=driver;d.Descriptor=d.Descriptor.Clone();vector.change(&d);if _,err:=NewRegistry(append(vector.prefix,d)...);err==nil||err.Error()!=vector.want{t.Fatal("first public registry error changed",err,vector.want)}}
	driver.ProbeIngress=func(Instance)(ProbeTarget,error){calls++;return ProbeTarget{},nil};driver.Descriptor.ProbeCapabilities=[]string{"custom.probe"}
	original:=driver.Descriptor.Clone();registry,err:=NewRegistry(driver);if err!=nil{t.Fatal(err)}
	mutate:=func(d *Descriptor){for _,values:=range [][]string{d.Platforms,d.Roles,d.Phases,d.Protocols,d.Capabilities,d.ProbeCapabilities}{values[0]="mutated"}}
	mutate(&driver.Descriptor)
	selection:=Selection{DriverID:"custom.driver",SchemaVersion:1,Role:"custom-role",Phase:"active",Protocol:"tcp"}
	resolved,err:=registry.Resolve(selection,Features{},"linux");if err!=nil||!reflect.DeepEqual(resolved.Descriptor,original){t.Fatal("input declaration mutation crossed registry")}
	mutate(&resolved.Descriptor);descriptors:=registry.Descriptors();mutate(&descriptors[0])
	again,err:=registry.Resolve(selection,Features{},"linux");if err!=nil||!reflect.DeepEqual(again.Descriptor,original)||calls!=0{t.Fatal("output mutation or metadata resolution executed callbacks")}
	if !validList([]string{strings.Repeat("x",128)},nil){t.Fatal("128-byte list boundary refused")}
	for _,platform:=range []string{"darwin","remote-linux",""}{if _,err:=registry.Resolve(selection,Features{},platform);err==nil{t.Fatal("declaration overrode actual platform")}}
}

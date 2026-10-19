package control

import (
	"errors"
	"reflect"
	"runtime"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/relay"
)

func TestControlCompleteLegacyRegistryFirstRefusalBeforePublicValidation(t *testing.T){
	base:=nativeDirectDriver()
	for _,vector:=range []struct{name string;prefix bool;mutate func(*executionDriver);want string}{
		{"header before duplicate and declaration",true,func(d *executionDriver){d.start=nil;d.descriptor.roles=nil},"INVALID_CONFIG: Incomplete execution driver"},
		{"duplicate before list and Probe",true,func(d *executionDriver){d.descriptor.roles=nil;d.probeIngress=nil},"INVALID_CONFIG: Duplicate execution driver native.direct.v1"},
		{"empty list before requirements and Probe",false,func(d *executionDriver){d.descriptor.roles=nil;d.descriptor.requiresMultihop=true;d.probeIngress=nil},"INVALID_CONFIG: Empty execution driver declaration"},
		{"invalid list before requirements",false,func(d *executionDriver){d.descriptor.roles=[]string{"direct","direct"};d.descriptor.requiresMultihop=true},"INVALID_CONFIG: Invalid execution driver declaration"},
		{"requirements before Probe agreement",false,func(d *executionDriver){d.descriptor.capabilities=[]string{"other"};d.probeIngress=nil},"INVALID_CONFIG: Inconsistent execution driver requirements"},
		{"Probe agreement before capabilities",false,func(d *executionDriver){d.probeIngress=nil;d.descriptor.probeCapabilities=[]string{"",""}},"INVALID_CONFIG: Probe port and capabilities must agree"},
		{"Probe invalid before public platform",false,func(d *executionDriver){d.descriptor.probeCapabilities=[]string{"bad","bad"};d.descriptor.platforms=[]string{"darwin"}},"INVALID_CONFIG: Invalid Probe capability declaration"},
		{"public strict validation last",false,func(d *executionDriver){d.descriptor.platforms=[]string{"darwin"}},"INVALID_CONFIG: Incompatible execution host or descriptor"},
	}{t.Run(vector.name,func(t *testing.T){
		driver:=base;driver.descriptor=adaptExecutionDriver(publicExecutionDriver(base)).descriptor;vector.mutate(&driver)
		var values []executionDriver;if vector.prefix{values=append(values,base)};values=append(values,driver)
		if registry,err:=newExecutionRegistry(values...);registry!=nil||err==nil||err.Error()!=vector.want{t.Fatal("legacy error precedence changed",err,vector.want)}
	})}
	if registry,err:=newExecutionRegistry();registry!=nil||err==nil||err.Error()!="INVALID_CONFIG: Bounded execution drivers required"{t.Fatal("empty private declarations no longer reach public bounded refusal")}
	zero:=&executionRegistry{}
	if got:=zero.capabilities(executionFeatures{relay:true,multihop:true,probeIngress:true,probeServices:true,probeEcho:true});!reflect.DeepEqual(got,[]string{"adp.3"}){t.Fatal("zero private registry acquired native default callbacks")}
	func(){defer func(){if recover()==nil{t.Error("partial private registry Resolve silently supplied contract")}}();_,_=zero.resolve(adp3.Assignment{},executionFeatures{})}()
	func(){defer func(){if recover()==nil{t.Error("nil private registry silently normalized")}}();var absent *executionRegistry;_=absent.capabilities(executionFeatures{})}()
	// Unknown public vocabulary fails construction; valid metadata on the wrong
	// actual host or with disabled features fails selection without callbacks.
	calls:=0
	for _,change:=range []func(*executionDriver){func(d *executionDriver){d.descriptor.platforms=[]string{"darwin"}},func(d *executionDriver){d.descriptor.phases=[]string{"paused"}},func(d *executionDriver){d.descriptor.protocols=[]string{"sctp"}}}{d:=nativeRelayDriver();change(&d);d.start=func(executionHost,adp3.Assignment,func()error)(execution,error){calls++;return nil,nil};if _,err:=newExecutionRegistry(d);err==nil||err.Error()!="INVALID_CONFIG: Incompatible execution host or descriptor"{t.Fatal("unknown host vocabulary accepted",err)}}
	for _,foreign:=range []bool{false,true}{d:=nativeRelayDriver();d.start=func(executionHost,adp3.Assignment,func()error)(execution,error){calls++;return nil,nil};if foreign{d.descriptor.platforms=[]string{"windows"};if runtime.GOOS=="windows"{d.descriptor.platforms=[]string{"linux"}}};registry,err:=newExecutionRegistry(d);if err!=nil{t.Fatal(err)};if _,err:=registry.resolve(executionTestAssignment("native.relay.v1","relay-egress","prepared","tcp"),executionFeatures{});err==nil||err.Error()!="UNSUPPORTED_CAPABILITY: Execution host, platform, driver, version, role, phase or protocol unavailable"{t.Fatal("wrong platform/feature refusal changed",err)}}
	if calls!=0{t.Fatal("metadata validation/selection executed driver")}
}

func TestControlCompletePrivatePublicDriverRoundtripCallbacksAndCopies(t *testing.T){
	failure:=errors.New("partial original callback error");check:=func()error{return failure};instance:=&completeRegistryExecution{}
	events:=[]string{};policy:=adp3.Policy{MaxTcpConnectionsPerAssignment:11};assignment:=adp3.Assignment{AssignmentId:"assignment"}
	until:=time.Date(2026,10,20,1,0,0,0,time.UTC);peer:=func()(relay.Identity,time.Time,error){events=append(events,"identity");return relay.Identity{},until,failure}
	original:=nativeDirectDriver()
	original.start=func(host executionHost,a adp3.Assignment,allow func()error)(execution,error){events=append(events,"start");if host.nodeID!="node"||host.sessionEpoch!=7||host.policy!=policy||!reflect.DeepEqual(a,assignment)||allow()!=failure{t.Fatal("private host/start/check projection changed")};if _,got,err:=host.peerIdentity();got!=until||err!=failure{t.Fatal("private peer callback changed")};return instance,failure}
	original.replace=func(old execution,a adp3.Assignment,allow func()error)(execution,error){events=append(events,"replace");if old!=instance||!reflect.DeepEqual(a,assignment)||allow()!=failure{t.Fatal("replacement identity/check changed")};return instance,failure}
	original.phase=func(old execution,phase string)error{events=append(events,phase);if old!=instance{t.Fatal("phase changed pointer")};return failure}
	original.classify=func(err error)(string,bool){events=append(events,"classify");if err!=failure{t.Fatal("classify error identity changed")};return "original",false}
	original.probeIngress=func(old execution)(executionProbeTarget,error){events=append(events,"observe-tcp");if old!=instance{t.Fatal("observation changed instance")};return executionProbeTarget{"192.0.2.1",42,check},failure}
	original.probeUDPIngress=func(old execution)(executionProbeTarget,error){events=append(events,"observe-udp");if old!=instance{t.Fatal("UDP observation changed instance")};return executionProbeTarget{"192.0.2.2",43,check},failure}
	public:=publicExecutionDriver(original);roundtrip:=adaptExecutionDriver(public)
	if !reflect.DeepEqual(public.Descriptor,publicExecutionDescriptor(original.descriptor)){t.Fatal("all descriptor fields did not project")}
	original.descriptor.roles[0]="mutated";if roundtrip.descriptor.roles[0]!="direct"{t.Fatal("private adapter did not detach descriptor")}
	got,err:=roundtrip.start(executionHost{nodeID:"node",sessionEpoch:7,policy:policy,relayIdentity:peer},assignment,check);if got!=instance||err!=failure{t.Fatal("partial start was normalized/closed")}
	got,err=roundtrip.replace(instance,assignment,check);if got!=instance||err!=failure{t.Fatal("partial replace was normalized/closed")}
	if roundtrip.phase(instance,"active")!=failure{t.Fatal("phase lost original failure")};if code,retry:=roundtrip.classify(failure);code!="original"||retry{t.Fatal("classification changed")}
	for _,observe:=range []func(execution)(executionProbeTarget,error){roundtrip.probeIngress,roundtrip.probeUDPIngress}{target,err:=observe(instance);if err!=failure||target.check()==nil||target.port<42{t.Fatal("observation result/error/check changed")}}
	if instance.closed!=0||instance.drained!=0||!reflect.DeepEqual(events,[]string{"start","identity","replace","active","classify","observe-tcp","observe-udp"}){t.Fatal("adapter invoked extra lifecycle callback",events)}
	blank:=adaptExecutionDriver(executiondriver.Driver{});if blank.start!=nil||blank.phase!=nil||blank.replace!=nil||blank.classify!=nil||blank.probeIngress!=nil||blank.probeUDPIngress!=nil{t.Fatal("nil public callbacks became available")}
	withoutOptional:=original;withoutOptional.replace=nil;withoutOptional.probeIngress=nil;withoutOptional.probeUDPIngress=nil
	p:=publicExecutionDriver(withoutOptional);if p.Replace!=nil||p.ProbeIngress!=nil||p.ProbeUDPIngress!=nil{t.Fatal("optional private callbacks became available")}
	if nilIdentity,expiry,err:=(executionHost{}).peerIdentity();!reflect.DeepEqual(nilIdentity,relay.Identity{})||!expiry.IsZero()||err==nil||err.Error()!="AUTHORIZATION_DENIED: Host peer credential required"{t.Fatal("old missing identity error changed")}
	for _,d:=range []executionDriver{nativeDirectDriver(),nativeRelayDriver(),nativeMultihopDriver()}{if d.descriptor.hostInterfaceVersion!=1{t.Fatal("legacy HostVersion changed")}}
	if len(nativeexecution.BuiltinDrivers())!=3{t.Fatal("partial fixture accidentally installed another driver")}
}

type completeRegistryExecution struct{closed,drained int;authorization func()error}
func(e *completeRegistryExecution)Close(){e.closed++}
func(e *completeRegistryExecution)Drain(){e.drained++}
func(e *completeRegistryExecution)Remaining()uint64{return 3}
func(e *completeRegistryExecution)SetAuthorization(check func()error){e.authorization=check}

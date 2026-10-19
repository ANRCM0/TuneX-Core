package probe

import (
	"context"
	"errors"
	"go/ast"
	"go/parser"
	"go/token"
	"net"
	"reflect"
	"runtime"
	"testing"

	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type completeConstructorSchedule struct{runtimeplatform.Scheduler}
type completeConstructorEntropy struct{runtimeplatform.Entropy}
type completeConstructorDial struct{runtimeplatform.Dialer[net.Conn]}

func TestProbeCompleteFourConstructorsExplicitEffectsAndResolverHierarchy(t *testing.T){
	failure:=errors.New("bound resolver sentinel")
	events:=[]string{}
	base:=Resolver(func(context.Context,Binding)(Target,error){events=append(events,"base");return Target{},failure})
	ingress:=Resolver(func(context.Context,Binding)(Target,error){events=append(events,"ingress");return Target{},failure})
	service:=ServiceResolver(func(context.Context,Binding,observationtrust.Context)(Target,error){events=append(events,"service");return Target{},failure})
	echo:=EchoResolver(func(context.Context,Binding,probeecho.Execution)(Target,error){events=append(events,"echo");return Target{},failure})
	effects:=Effects{Schedule:&completeConstructorSchedule{},Entropy:&completeConstructorEntropy{},Dial:&completeConstructorDial{}}
	for _,explicit:=range []bool{false,true}{for level:=0;level<4;level++{
		var executor *Executor;var err error
		if explicit{switch level{case 0:executor,err=NewWithEffects(base,effects);case 1:executor,err=NewWithIngressEffects(base,ingress,effects);case 2:executor,err=NewWithServicesEffects(base,ingress,service,effects);case 3:executor,err=NewWithEchoEffects(base,ingress,service,echo,effects)}}else{switch level{case 0:executor,err=New(base);case 1:executor,err=NewWithIngress(base,ingress);case 2:executor,err=NewWithServices(base,ingress,service);case 3:executor,err=NewWithEcho(base,ingress,service,echo)}}
		if err!=nil||executor==nil||executor.resolve==nil||executor.dial==nil||(executor.resolveIngress!=nil)!=(level>=1)||(executor.resolveService!=nil)!=(level>=2)||(executor.resolveEcho!=nil)!=(level>=3){t.Fatal("constructor resolver shape changed",explicit,level,err)}
		if len(events)!=0{t.Fatal("construction invoked a resolver")}
		if explicit{if executor.schedule!=effects.Schedule||executor.entropy!=effects.Entropy{t.Fatal("explicit Effects fallback/normalization")}}else{
			if reflect.TypeOf(executor.schedule)!=reflect.TypeOf(platformruntime.Schedule{})||reflect.TypeOf(executor.entropy)!=reflect.TypeOf(platformruntime.Local{}){t.Fatal("legacy constructors lost native schedule/entropy")}
			name:=runtime.FuncForPC(reflect.ValueOf(executor.dial).Pointer()).Name();if name!="github.com/tunex/vnext/agent/internal/platformruntime.(*Dialer).DialContext-fm"{t.Fatal("legacy default dial no longer binds native fresh Dialer",name)}
		}
		if _,err:=executor.resolve(context.Background(),Binding{});err!=failure{t.Fatal("base resolver error changed")}
		if level>=1{if _,err:=executor.resolveIngress(context.Background(),Binding{});err!=failure{t.Fatal("ingress resolver error changed")}}
		if level>=2{if _,err:=executor.resolveService(context.Background(),Binding{},observationtrust.Context{});err!=failure{t.Fatal("service resolver error changed")}}
		if level>=3{if _,err:=executor.resolveEcho(context.Background(),Binding{},probeecho.Execution{});err!=failure{t.Fatal("echo resolver error changed")}}
		want:=[]string{"base","ingress","service","echo"}[:level+1];if !reflect.DeepEqual(events,want){t.Fatal("bound resolver order changed",events)};events=nil
	}}
	// Each prerequisite is rejected, including a missing outer resolver while
	// earlier arguments are also invalid. Nil Effects never acquire defaults.
	for level:=0;level<4;level++{for missing:=0;missing<=level+3;missing++{
		r,i,s,e,fx:=base,ingress,service,echo,effects
		switch missing{case 0:r=nil;case 1:fx.Schedule=nil;case 2:fx.Entropy=nil;case 3:fx.Dial=nil;case 4:i=nil;case 5:s=nil;case 6:e=nil}
		var executor *Executor;var err error
		switch level{case 0:executor,err=NewWithEffects(r,fx);case 1:executor,err=NewWithIngressEffects(r,i,fx);case 2:executor,err=NewWithServicesEffects(r,i,s,fx);case 3:executor,err=NewWithEchoEffects(r,i,s,e,fx)}
		if executor!=nil||err!=ErrInvalid||len(events)!=0{t.Fatal("missing prerequisite invoked effects/resolver or changed denial",level,missing,err)}
	}}
	for _,construct:=range []func()(*Executor,error){func()(*Executor,error){return New(nil)},func()(*Executor,error){return NewWithIngress(nil,nil)},func()(*Executor,error){return NewWithServices(nil,nil,nil)},func()(*Executor,error){return NewWithEcho(nil,nil,nil,nil)}}{if executor,err:=construct();executor!=nil||err!=ErrInvalid{t.Fatal("legacy nil constructor hierarchy changed")}}
	for _,executor:=range []*Executor{nil,{}}{if !reflect.DeepEqual(executor.scheduler(),platformruntime.Schedule{})||!reflect.DeepEqual(executor.randomSource(),platformruntime.Local{}){t.Fatal("private nil/zero fixture lost native fallbacks")}}
	private:=&Executor{schedule:effects.Schedule,entropy:effects.Entropy,dial:func(context.Context,string,string)(net.Conn,error){return nil,failure}}
	if private.scheduler()!=effects.Schedule||private.randomSource()!=effects.Entropy{t.Fatal("private explicit fields lost priority")}
	if _,err:=private.dial(context.Background(),"custom-network","literal-address");err!=failure{t.Fatal("private dial mutation compatibility changed")}
}

func TestProbeCompleteLegacyFactoryAllocationAndNilPrerequisiteSourceBoundary(t *testing.T){
	// Combined with native Dialer's distinct/zero-state test, this pins one
	// allocation at the old base-constructor boundary without unsafe closure
	// receiver inspection or a production test hook.
	file,err:=parser.ParseFile(token.NewFileSet(),"probe.go",nil,0);if err!=nil{t.Fatal(err)}
	want:=map[string]string{"New":"NewWithEffects","NewWithIngress":"New","NewWithServices":"NewWithIngress","NewWithEcho":"NewWithServices"}
	found:=map[string]bool{}
	for _,declaration:=range file.Decls{fn,ok:=declaration.(*ast.FuncDecl);if !ok{continue};target,present:=want[fn.Name.Name];if !present{continue};found[fn.Name.Name]=true
		if len(fn.Body.List)<2{t.Fatal("constructor prerequisite disappeared")};if _,ok:=fn.Body.List[0].(*ast.IfStmt);!ok{t.Fatal("native factory moved ahead of nil prerequisite",fn.Name.Name)}
		calls:=map[string]int{};ast.Inspect(fn.Body,func(node ast.Node)bool{if call,ok:=node.(*ast.CallExpr);ok{if name,ok:=call.Fun.(*ast.Ident);ok{calls[name.Name]++}};return true})
		if calls[target]!=1{t.Fatal("constructor bypassed or repeated original hierarchy",fn.Name.Name,calls)}
		if fn.Name.Name=="New"{if calls["nativeEffects"]!=1{t.Fatal("base constructor no longer owns one native Effects assembly")}}else if calls["nativeEffects"]!=0{t.Fatal("outer constructor created another native dialer")}
	}
	if len(found)!=len(want){t.Fatal("legacy constructor inventory incomplete")}
}

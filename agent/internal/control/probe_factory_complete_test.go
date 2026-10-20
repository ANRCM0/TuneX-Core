package control

import (
	"context"
	"crypto/rand"
	"errors"
	"net"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type completeFactoryRandom struct{calls int}
func(r *completeFactoryRandom)Read(p []byte)(int,error){r.calls++;for i:=range p{p[i]=byte(i+1)};return len(p),nil}

func TestControlCompleteNativeProbeFactoryPriorityAndBoundResolvers(t *testing.T){
	reader:=&completeFactoryRandom{};original:=rand.Reader;rand.Reader=reader;t.Cleanup(func(){rand.Reader=original})
	for bits:=0;bits<8;bits++{
		runner:=&Runner{options:Options{ProbeEcho:bits&4!=0,ProbeServices:bits&2!=0,ProbeIngress:bits&1!=0},effects:Effects{Schedule:&completePlatformSchedule{}},local:LocalServices{Entropy:&completePlatformEntropy{}}}
		executor,err:=runner.newNativeProbeExecutor();if err!=nil||executor==nil{t.Fatal(err)}
		value:=reflect.ValueOf(executor).Elem()
		level:=0;if runner.options.ProbeIngress{level=1};if runner.options.ProbeServices{level=2};if runner.options.ProbeEcho{level=3}
		for i,field:=range []string{"resolve","resolveIngress","resolveService","resolveEcho"}{
			function:=value.FieldByName(field);if function.IsNil()!=(i>level){t.Fatal("factory priority changed",bits,field)}
			if i<=level{expected:=[]any{runner.resolveProbeTarget,runner.resolveProbeIngressTarget,runner.resolveProbeServiceTarget,runner.resolveProbeEchoTarget}[i];if function.Pointer()!=reflect.ValueOf(expected).Pointer(){t.Fatal("factory resolver was replaced",field)}}
		}
		if value.FieldByName("schedule").Elem().Type()!=reflect.TypeOf(platformruntime.Schedule{})||value.FieldByName("entropy").Elem().Type()!=reflect.TypeOf(platformruntime.Local{}){t.Fatal("Runner operational providers replaced native Probe defaults")}
		var nativeDialer runtimeplatform.Dialer[net.Conn]=platformruntime.NewDialer()
		if value.FieldByName("dial").Pointer()!=reflect.ValueOf(nativeDialer.DialContext).Pointer(){t.Fatal("factory bypassed native Dialer interface binding")}
	}
	if reader.calls!=0{t.Fatal("executor factory sampled entropy before NewGate")}
}

func TestControlCompleteGuardRefusesBeforeNativeProbeGateEntropy(t *testing.T){
	reader:=&completeFactoryRandom{};original:=rand.Reader;rand.Reader=reader;t.Cleanup(func(){rand.Reader=original})
	runner:=&Runner{effects:Effects{Schedule:&completePlatformSchedule{}},providers:Providers{Channel:&completePlatformChannel{}}}
	if session,err:=runner.negotiateProbe(context.Background());session!=nil||!errors.Is(err,probe.ErrDenied)||reader.calls!=0{t.Fatal("missing Guard reached constructor/Gate/HTTP",err,reader.calls)}
	runner,_,sample:=probeTestRunner(t)
	sample.Wall=sample.Wall.AddDate(0,0,1)
	if session,err:=runner.negotiateProbe(context.Background());session!=nil||!errors.Is(err,probe.ErrDenied)||reader.calls!=0{t.Fatal("failed Guard reached native entropy/HTTP",err,reader.calls)}
}

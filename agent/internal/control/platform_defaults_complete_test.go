package control

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net/http"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/agentplatform"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

var (
	_ func(Options)(*Runner,error)=New
	_ func(Options,Providers)(*Runner,error)=NewWithProviders
	_ func(Options,Providers,Effects)(*Runner,error)=NewWithEffects
	_ func(Options,Providers,Effects,LocalServices)(*Runner,error)=NewWithLocalServices
)

type completePlatformIdentity struct{executionidentity.Provider[tls.Certificate,*x509.CertPool]; events *[]string; failure error}
func(p *completePlatformIdentity)Locations(string,string,string)executionidentity.Locations{*p.events=append(*p.events,"locations");return executionidentity.Locations{}}
func(p *completePlatformIdentity)LoadMachine(executionidentity.Locations,string,*x509.CertPool)(executionidentity.MachineIdentity[tls.Certificate],error){*p.events=append(*p.events,"machine");return executionidentity.MachineIdentity[tls.Certificate]{},p.failure}
type completePlatformChannel struct{executionchannel.Provider[*http.Client,*x509.CertPool,tls.Certificate]; events *[]string; client *http.Client}
func(p *completePlatformChannel)NewClient(*x509.CertPool,func()tls.Certificate)*http.Client{*p.events=append(*p.events,"client");return p.client}
type completePlatformBootstrap struct{runtimeplatform.Bootstrap[*x509.CertPool]; events *[]string}
func(p *completePlatformBootstrap)ValidateProofBoundary(string,string,string)error{*p.events=append(*p.events,"proof");return nil}
func(p *completePlatformBootstrap)LoadRoots(string)(*x509.CertPool,error){*p.events=append(*p.events,"roots");return x509.NewCertPool(),nil}
func(p *completePlatformBootstrap)LoadProtectionKey(string)([]byte,error){*p.events=append(*p.events,"key");return make([]byte,32),nil}
func(p *completePlatformBootstrap)LoadRuntime(string,[]byte,string)(executionstate.RuntimeJournal,error){*p.events=append(*p.events,"load");return executionstate.RuntimeJournal{},nil}
type completePlatformSchedule struct{runtimeplatform.Scheduler}
type completePlatformAuxiliary struct{executionchannel.Auxiliary[*http.Client]}
type completePlatformObservation struct{platformobservation.Provider}
type completePlatformEntropy struct{runtimeplatform.Entropy}
type completePlatformMeasurements struct{runtimeplatform.MeasurementFiles}
type completePlatformLog struct{runtimeplatform.LocalLog}

func TestControlCompletePlatformAliasesDefaultsAndPartialFixtureFallbacks(t *testing.T){
	if reflect.TypeOf(Providers{})!=reflect.TypeOf(agentplatform.Providers{})||reflect.TypeOf(Effects{})!=reflect.TypeOf(agentplatform.Effects{})||reflect.TypeOf(LocalServices{})!=reflect.TypeOf(agentplatform.LocalServices{}){t.Fatal("old native aliases lost canonical identity")}
	if !reflect.DeepEqual(defaultProviders(),agentplatform.DefaultProviders())||!reflect.DeepEqual(defaultEffects(),agentplatform.DefaultEffects())||!reflect.DeepEqual(defaultLocalServices(),agentplatform.DefaultLocalServices()){t.Fatal("old defaults differ from public native assembly")}
	var events []string
	identity:=&completePlatformIdentity{events:&events};channel:=&completePlatformChannel{events:&events}
	schedule,auxiliary:=&completePlatformSchedule{},&completePlatformAuxiliary{}
	observer,entropy,files,log:=&completePlatformObservation{},&completePlatformEntropy{},&completePlatformMeasurements{},&completePlatformLog{}
	// Empty/partial same-package fixtures keep old per-field native fallbacks;
	// a present provider is returned unchanged, without invoking its methods.
	runner:=&Runner{}
	if !reflect.DeepEqual(runner.identityProvider(),defaultProviders().Identity)||!reflect.DeepEqual(runner.channelProvider(),defaultProviders().Channel)||!reflect.DeepEqual(runner.scheduler(),defaultEffects().Schedule)||!reflect.DeepEqual(runner.auxiliary(),defaultEffects().Auxiliary)||!reflect.DeepEqual(runner.observer(),defaultLocalServices().Observation)||!reflect.DeepEqual(runner.entropy(),defaultLocalServices().Entropy)||!reflect.DeepEqual(runner.measurementFiles(),defaultLocalServices().Measurements)||!reflect.DeepEqual(runner.localLog(),defaultLocalServices().Log){t.Fatal("zero fixture native fallback changed")}
	runner.providers.Identity=identity;runner.effects.Schedule=schedule;runner.local.Entropy=entropy
	if runner.identityProvider()!=identity||runner.scheduler()!=schedule||runner.entropy()!=entropy||!reflect.DeepEqual(runner.channelProvider(),defaultProviders().Channel)||!reflect.DeepEqual(runner.observer(),defaultLocalServices().Observation){t.Fatal("partial fixture normalized explicit or absent field")}
	runner.providers.Channel=channel;runner.effects.Auxiliary=auxiliary;runner.local.Observation=observer;runner.local.Measurements=files;runner.local.Log=log
	if runner.channelProvider()!=channel||runner.auxiliary()!=auxiliary||runner.observer()!=observer||runner.measurementFiles()!=files||runner.localLog()!=log||len(events)!=0{t.Fatal("explicit accessors invoked or replaced providers")}
}

func TestControlCompleteConstructorsRetainNativeDefaultsAndNoSampling(t *testing.T){
	// Embedded interfaces deliberately panic if any scheduler/local method is
	// sampled during construction. Only the established bootstrap/credential/
	// client sequence has concrete implementations.
	for _,mode:=range []string{"private","effects","local"}{t.Run(mode,func(t *testing.T){
		var events []string
		identity:=&completePlatformIdentity{events:&events};client:=&http.Client{}
		channel:=&completePlatformChannel{events:&events,client:client}
		providers:=Providers{Identity:identity,Channel:channel}
		effects:=Effects{Bootstrap:&completePlatformBootstrap{events:&events},Schedule:&completePlatformSchedule{},Auxiliary:&completePlatformAuxiliary{}}
		local:=LocalServices{Observation:&completePlatformObservation{},Entropy:&completePlatformEntropy{},Measurements:&completePlatformMeasurements{},Log:&completePlatformLog{}}
		options:=Options{URL:"https://control.example",NodeID:"node",BootID:"boot"}
		var runner *Runner;var err error
		switch mode{case "private":runner,err=newRunnerWithEffects(options,providers,effects);case "effects":runner,err=NewWithEffects(options,providers,effects);case "local":runner,err=NewWithLocalServices(options,providers,effects,local)}
		if err!=nil||runner==nil||!reflect.DeepEqual(events,[]string{"proof","roots","key","load","locations","machine","client"}){t.Fatal("constructor order/sample changed",events,err)}
		if runner.providers.Identity!=identity||runner.providers.Channel!=channel||runner.effects.Schedule!=effects.Schedule||runner.client!=client||runner.probeCounterClock==effects.Schedule{t.Fatal("assembly replaced explicit providers or native point clock")}
		if mode=="local"{if !reflect.DeepEqual(runner.local,local){t.Fatal("explicit locals changed")}}else if !reflect.DeepEqual(runner.local,defaultLocalServices()){t.Fatal("older constructor did not retain native local defaults")}
	})}
	// Old entrypoints still reach their original option gate before native file
	// bootstrap; they neither create state nor sample a local provider on refusal.
	for _,construct:=range []func(Options)(*Runner,error){New,func(o Options)(*Runner,error){return NewWithProviders(o,defaultProviders())}}{
		runner,err:=construct(Options{ProbeEcho:true,URL:"http://invalid"})
		if runner!=nil||err==nil||err.Error()!="INVALID_CONFIG: Echo Probe requires explicit services, ingress, execution and registration"{t.Fatal("legacy constructor first refusal changed",err)}
	}
	failure:=errors.New("original machine load error");var events []string
	providers:=Providers{Identity:&completePlatformIdentity{events:&events,failure:failure},Channel:&completePlatformChannel{events:&events}}
	effects:=Effects{Bootstrap:&completePlatformBootstrap{events:&events},Schedule:&completePlatformSchedule{},Auxiliary:&completePlatformAuxiliary{}}
	if runner,err:=NewWithEffects(Options{URL:"https://control.example"},providers,effects);runner!=nil||err!=failure||!reflect.DeepEqual(events,[]string{"proof","roots","key","load","locations","machine"}){t.Fatal("failed credential constructed client or changed error",events,err)}
}

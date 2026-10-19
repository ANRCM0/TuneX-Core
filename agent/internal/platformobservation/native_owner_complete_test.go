package platformobservation

import (
	"encoding/json"
	"os"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/runtimeobservation"
)

type observationCompleteHost struct { opaque chan int }
type observationCompleteProvider struct { host *observationCompleteHost; calls []string }
func (p *observationCompleteProvider) Memory() runtimeobservation.MemorySample { p.calls = append(p.calls, "memory"); return runtimeobservation.MemorySample{} }
func (p *observationCompleteProvider) Process() runtimeobservation.ProcessSample { p.calls = append(p.calls, "process"); return runtimeobservation.ProcessSample{} }
func (p *observationCompleteProvider) Goroutines() int { p.calls = append(p.calls, "goroutines"); return 0 }
func (p *observationCompleteProvider) ProcessID() int { p.calls = append(p.calls, "pid"); return 0 }
func (p *observationCompleteProvider) Platform() string { p.calls = append(p.calls, "platform"); return "opaque" }
func (p *observationCompleteProvider) Host() *observationCompleteHost { p.calls = append(p.calls, "host"); return p.host }

var _ runtimeobservation.Provider[*observationCompleteHost] = (*observationCompleteProvider)(nil)
var _ Provider = Native{}

func TestObservationCompleteGenericMethodSetAndNativeBinding(t *testing.T) {
	if InterfaceVersion != 2 || runtimeobservation.InterfaceVersion != 2 { t.Fatal("observation version") }
	generic := reflect.TypeOf((*runtimeobservation.Provider[*observationCompleteHost])(nil)).Elem()
	want := map[string]reflect.Type{"Memory": reflect.TypeOf(runtimeobservation.MemorySample{}), "Process": reflect.TypeOf(runtimeobservation.ProcessSample{}), "Goroutines": reflect.TypeOf(0), "ProcessID": reflect.TypeOf(0), "Platform": reflect.TypeOf(""), "Host": reflect.TypeOf((*observationCompleteHost)(nil))}
	if generic.NumMethod() != len(want) { t.Fatalf("method count: %d", generic.NumMethod()) }
	for name, output := range want { method, ok := generic.MethodByName(name); if !ok || method.Type.NumIn() != 0 || method.Type.NumOut() != 1 || method.Type.Out(0) != output { t.Fatalf("method %s: %+v", name, method) } }
	canonical := reflect.TypeOf((*Provider)(nil)).Elem()
	if canonical != reflect.TypeOf((*runtimeobservation.Provider[observationwire.HostResources])(nil)).Elem() { t.Fatal("native Host provider binding moved") }
	host := &observationCompleteHost{opaque: make(chan int)}
	p := &observationCompleteProvider{host: host}
	var contract runtimeobservation.Provider[*observationCompleteHost] = p
	if contract.Host() != host || !reflect.DeepEqual(p.calls, []string{"host"}) { t.Fatal("opaque generic host converted or performed extra reads") }
	p.host = nil
	if contract.Host() != nil { t.Fatal("generic nil Host replaced") }
}

func TestObservationCompleteEveryHostNativeFieldAndLowerTag(t *testing.T) {
	for _, entry := range []struct { native, lower reflect.Type; names, types, tags string }{
		{reflect.TypeOf(HostCPUResources{}), reflect.TypeOf(runtimeobservation.HostCPUResources{}), "Availability,LogicalProcessors,TotalTicks,IdleTicks,IOWaitTicks", "string,*int,*string,*string,*string", "availability,logicalProcessors,totalTicks,idleTicks,ioWaitTicks"},
		{reflect.TypeOf(HostMemoryResources{}), reflect.TypeOf(runtimeobservation.HostMemoryResources{}), "Availability,TotalBytes,AvailableBytes", "string,*string,*string", "availability,totalBytes,availableBytes"},
		{reflect.TypeOf(HostLoadResources{}), reflect.TypeOf(runtimeobservation.HostLoadResources{}), "Availability,OneMilli,FiveMilli,FifteenMilli", "string,*string,*string,*string", "availability,oneMilli,fiveMilli,fifteenMilli"},
		{reflect.TypeOf(HostFilesystemResources{}), reflect.TypeOf(runtimeobservation.HostFilesystemResources{}), "Availability,Scope,TotalBytes,AvailableBytes", "string,string,*string,*string", "availability,scope,totalBytes,availableBytes"},
		{reflect.TypeOf(HostNetworkInterface{}), reflect.TypeOf(runtimeobservation.HostNetworkInterface{}), "Name,RXBytes,TXBytes", "string,string,string", "name,rxBytes,txBytes"},
		{reflect.TypeOf(HostNetworkResources{}), reflect.TypeOf(runtimeobservation.HostNetworkResources{}), "Availability,Scope,Limit,Available,Returned,Omitted,Truncated,Interfaces", "string,string,int,int,int,int,bool,[]observationwire.HostNetworkInterface", "availability,scope,limit,available,returned,omitted,truncated,interfaces"},
		{reflect.TypeOf(HostResources{}), reflect.TypeOf(runtimeobservation.HostResources{}), "Scope,CPU,Memory,Load,Filesystem,Network", "string,observationwire.HostCPUResources,observationwire.HostMemoryResources,observationwire.HostLoadResources,observationwire.HostFilesystemResources,observationwire.HostNetworkResources", "scope,cpu,memory,load,filesystem,network"},
	} {
		names, types, tags := strings.Split(entry.names, ","), strings.Split(entry.types, ","), strings.Split(entry.tags, ",")
		if entry.native.PkgPath() != "github.com/tunex/vnext/agent/internal/observationwire" || entry.lower.PkgPath() != "github.com/tunex/vnext/agent/internal/runtimeobservation" || entry.native == entry.lower || entry.native.NumField() != len(names) || entry.lower.NumField() != len(names) { t.Fatalf("native/lower owner shape: %s", entry.native) }
		for index, name := range names {
			native, lower := entry.native.Field(index), entry.lower.Field(index)
			if native.Name != name || native.Type.String() != types[index] || string(native.Tag) != `json:"`+tags[index]+`"` || lower.Name != name || lower.Tag != "" { t.Fatalf("%s field %d: native=%+v lower=%+v", entry.native, index, native, lower) }
			wantLower := strings.ReplaceAll(types[index], "observationwire.", "runtimeobservation.")
			if lower.Type.String() != wantLower { t.Fatalf("lower field %s: %s", name, lower.Type) }
		}
	}
	got, err := json.Marshal(EmptyHostResources("unsupported"))
	want := `{"scope":"agent-visible-os","cpu":{"availability":"unsupported","logicalProcessors":null,"totalTicks":null,"idleTicks":null,"ioWaitTicks":null},"memory":{"availability":"unsupported","totalBytes":null,"availableBytes":null},"load":{"availability":"unsupported","oneMilli":null,"fiveMilli":null,"fifteenMilli":null},"filesystem":{"availability":"unsupported","scope":"agent-root-filesystem","totalBytes":null,"availableBytes":null},"network":{"availability":"unsupported","scope":"agent-network-namespace","limit":16,"available":0,"returned":0,"omitted":0,"truncated":false,"interfaces":[]}}`
	if err != nil || string(got) != want { t.Fatalf("unsupported native JSON: %s %v", got, err) }
}

func TestObservationCompleteActualNativeResources(t *testing.T) {
	native := Native{}
	if native.ProcessID() != os.Getpid() || native.Platform() != runtime.GOOS || native.Goroutines() < 1 { t.Fatal("native runtime reads changed") }
	memory := native.Memory()
	if memory.RuntimeBytes == 0 || memory.HeapAllocBytes > memory.RuntimeBytes { t.Fatalf("native memory units: %+v", memory) }
	process := native.Process()
	if runtime.GOOS != "linux" {
		if process.CPUTimeNanos != nil || process.MaxRSSBytes != nil || process.OpenFileDescriptors != nil { t.Fatal("unsupported process counters became zero values") }
		if !reflect.DeepEqual(native.Host(), EmptyHostResources("unsupported")) { t.Fatal("unsupported native Host mismatch") }
	} else {
		if process.CPUTimeNanos == nil || *process.CPUTimeNanos < 0 || process.MaxRSSBytes == nil || *process.MaxRSSBytes <= 0 || process.OpenFileDescriptors == nil || *process.OpenFileDescriptors < 0 { t.Fatalf("Linux resource availability/units: %+v", process) }
		host := native.Host()
		if host.Scope != "agent-visible-os" || host.Filesystem.Scope != "agent-root-filesystem" || host.Network.Scope != "agent-network-namespace" || host.Network.Limit != 16 || host.Network.Interfaces == nil { t.Fatalf("native Host scopes: %+v", host) }
		for _, availability := range []string{host.CPU.Availability, host.Memory.Availability, host.Load.Availability, host.Filesystem.Availability, host.Network.Availability} { if availability != "available" && availability != "unavailable" { t.Fatalf("Linux availability %q", availability) } }
	}
}

package platformclock

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

func TestSynchronizationCompleteNativeFactsCompetingFailures(t *testing.T) {
	now := time.Date(2026,10,19,0,0,0,0,time.UTC)
	for _, source := range []string{"linux-adjtimex","windows-w32time"} {
		for _, bad := range []string{"host","source","timestamp"} {
			events := []string{}
			status := SyncStatus{Host:"host",Source:source,Synchronized:true,ObservedAt:"invalid"}
			host := "host"
			if bad == "host" { host = "wrong" }
			platform := source
			if bad == "source" { platform = "wrong" }
			clock := executiontime.SynchronizedClock(time.Second,executiontime.SynchronizationSources{
				Sample:func()(executiontime.Sample,error){ events=append(events,"sample"); return executiontime.Sample{Wall:now,Uptime:time.Second},nil },
				Evidence:func()(executiontime.SyncStatus,error){ events=append(events,"evidence/parse"); return SynchronizationFacts(status),nil },
				Host:func()(string,error){ events=append(events,"host"); return host,nil },
				Source:func()string{ events=append(events,"source");return platform },
			})
			_,err := clock()
			want := []string{"sample","evidence/parse","sample","host"}
			message := "another host"
			if bad != "host" { want=append(want,"source");message="another platform" }
			if bad == "timestamp" { message="fresh bounded" }
			if err == nil || !strings.Contains(err.Error(),message) || !reflect.DeepEqual(events,want) { t.Fatalf("%s/%s: %v %v",source,bad,events,err) }
		}
	}
}

func TestSynchronizationCompleteParseCacheAndSampleFailures(t *testing.T) {
	now := time.Date(2026,10,19,0,0,0,0,time.UTC)
	uptime := time.Second
	parseCalls,samples := 0,0
	text := now.Format(time.RFC3339Nano)
	failure := errors.New("fresh provider failed")
	failEvidence := false
	clock := executiontime.SynchronizedClock(time.Second,executiontime.SynchronizationSources{
		Sample:func()(executiontime.Sample,error){samples++;return executiontime.Sample{Wall:now,Uptime:uptime},nil},
		Evidence:func()(executiontime.SyncStatus,error){
			parseCalls++
			facts := SynchronizationFacts(SyncStatus{Host:"host",Source:"linux-adjtimex",Synchronized:true,ObservedAt:text})
			if failEvidence { return facts,failure };return facts,nil
		},
		Host:func()(string,error){return "host",nil},Source:func()string{return "linux-adjtimex"},
	})
	if _,err:=clock();err!=nil {t.Fatal(err)}
	text="invalid" // Cache must retain parsed facts until refresh, not reread native text.
	uptime=3*time.Second-time.Nanosecond
	if _,err:=clock();err!=nil || parseCalls!=1 || samples!=4 {t.Fatalf("cache reparsed: %d %d %v",parseCalls,samples,err)}
	uptime=3*time.Second
	if _,err:=clock();err==nil || !strings.Contains(err.Error(),"fresh bounded") || parseCalls!=2 || samples!=6 {t.Fatalf("refresh parse stage: %d %d %v",parseCalls,samples,err)}
	text=now.Format(time.RFC3339Nano)
	uptime=time.Second // Rollback must force reparsing even after an invalid cached fact.
	if _,err:=clock();err!=nil || parseCalls!=3 || samples!=8 {t.Fatalf("rollback parse: %d %d %v",parseCalls,samples,err)}
	uptime=3*time.Second
	failEvidence=true
	if _,err:=clock();!errors.Is(err,failure) || parseCalls!=4 || samples!=9 {t.Fatalf("provider error did not precede second sample: %d %d %v",parseCalls,samples,err)}
	// A failed refresh is retried, without committing a false cache timestamp.
	failEvidence=false
	if _,err:=clock();err!=nil || parseCalls!=5 || samples!=11 {t.Fatalf("failed-refresh retry: %d %d %v",parseCalls,samples,err)}
}

package executiontime

import (
	"strings"
	"testing"
	"time"
)

func TestGuardCompleteDeadlineBoundariesAndUptimeRollback(t *testing.T){
	origin:=time.Date(2026,10,19,0,0,0,0,time.UTC)
	for _,duration:=range []time.Duration{0,-time.Nanosecond,time.Second,15*time.Second,30*time.Second}{
		for _,credential:=range []time.Duration{0,3*time.Second,time.Hour}{
			sample:=Sample{Wall:origin,Uptime:time.Hour}
			until:=time.Time{};if credential!=0{until=origin.Add(credential)}
			guard,err:=New(func()(Sample,error){return sample,nil},5*time.Second,300*time.Second,until);if err!=nil{t.Fatal(err)}
			ticket,err:=guard.Accept(origin,origin.Add(20*time.Second));if err!=nil{t.Fatal(err)}
			want:=15*time.Second;if credential!=0 && credential<want{want=credential};if duration<want{want=duration}
			drain:=ticket.Drain(duration)
			if drain.Deadline()!=origin.Add(want){t.Fatalf("earliest drain %v/%v: %v",duration,credential,drain.Deadline())}
			if want>0{sample.Wall=origin.Add(want-time.Nanosecond);sample.Uptime=time.Hour+want-time.Nanosecond;if err:=drain.Allow();err!=nil{t.Fatal("pre-cutoff refused",err)}}
			sample.Wall=origin.Add(max(want,0));sample.Uptime=time.Hour+max(want,0)
			if drain.Allow()==nil{t.Fatal("exact earliest cutoff allowed authority")}
		}
	}
	sample:=Sample{Wall:origin,Uptime:time.Hour}
	guard,err:=New(func()(Sample,error){return sample,nil},time.Second,time.Minute,time.Time{});if err!=nil{t.Fatal(err)}
	sample.Uptime-=time.Nanosecond
	failure:=guard.Check()
	if failure==nil || !strings.Contains(failure.Error(),"history diverged"){t.Fatal("uptime rollback not latched")}
	sample.Uptime=time.Hour
	if guard.Check()!=failure{t.Fatal("restored uptime revived failed Guard")}
}

func TestGuardCompleteSkewEdgesInvalidSamplesAndSuspendDelta(t *testing.T){
	origin:=time.Date(2026,10,19,0,0,0,0,time.UTC)
	for _,invalid:=range []Sample{{Wall:origin,Uptime:-1},{Uptime:time.Hour}}{
		if _,err:=New(func()(Sample,error){return invalid,nil},time.Second,time.Minute,time.Time{});err==nil{t.Fatal("invalid initial sample accepted")}
	}
	for _,delta:=range []time.Duration{-time.Second,time.Second,-time.Second-time.Nanosecond,time.Second+time.Nanosecond}{
		sample:=Sample{Wall:origin,Uptime:time.Hour}
		g,err:=New(func()(Sample,error){return sample,nil},time.Second,time.Minute,time.Time{});if err!=nil{t.Fatal(err)}
		err=g.ValidateServerTime(origin.Add(delta))
		want:=delta>=-time.Second && delta<=time.Second
		if (err==nil)!=want{t.Fatalf("server skew edge %v: %v",delta,err)}
	}
	// Suspend-aware uptime advances during sleep: a coherent large delta is not a wall jump.
	sample:=Sample{Wall:origin,Uptime:time.Hour}
	g,err:=New(func()(Sample,error){return sample,nil},time.Second,time.Minute,time.Time{});if err!=nil{t.Fatal(err)}
	ticket,err:=g.Accept(origin,origin.Add(20*time.Second));if err!=nil{t.Fatal(err)}
	sample.Wall=origin.Add(20*time.Second);sample.Uptime+=20*time.Second
	if g.Check()!=nil || ticket.Allow()==nil{t.Fatal("coherent suspend delta failed clock or extended old authority")}
	if _,err:=g.Accept(sample.Wall,sample.Wall.Add(time.Minute));err==nil{t.Fatal("suspend-expired session renewed")}
}

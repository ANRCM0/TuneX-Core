package probe

import (
	"context"
	"fmt"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/platformruntime"
)

type completeElapsedClock struct{platformruntime.Schedule;mutex sync.Mutex;now time.Time}
func(c *completeElapsedClock)Now()time.Time{c.mutex.Lock();defer c.mutex.Unlock();return c.now}
func(c *completeElapsedClock)advance(d time.Duration){c.mutex.Lock();defer c.mutex.Unlock();c.now=c.now.Add(d)}
type completeElapsedConn struct{net.Conn;closed int}
func(c *completeElapsedConn)Close()error{c.closed++;return nil}
type completeElapsedDial struct{clock *completeElapsedClock;elapsed time.Duration;connection *completeElapsedConn;calls int}
func(d *completeElapsedDial)DialContext(context.Context,string,string)(net.Conn,error){d.calls++;d.clock.advance(d.elapsed);return d.connection,nil}

func TestProbeCompleteDeterministicElapsedIncludesZeroResolution(t *testing.T){
	for _,elapsed:=range []time.Duration{0,7*time.Millisecond}{
		t.Run(fmt.Sprint(elapsed),func(t *testing.T){
			permit,target:=testRequest(t)
			clock:=&completeElapsedClock{now:time.Now()}
			connection:=&completeElapsedConn{}
			dial:=&completeElapsedDial{clock:clock,elapsed:elapsed,connection:connection}
			executor,err:=NewWithEffects(func(context.Context,Binding)(Target,error){return target,nil},Effects{Schedule:clock,Entropy:platformruntime.Local{},Dial:dial})
			if err!=nil{t.Fatal(err)}
			result,err:=executor.Run(context.Background(),permit,time.Second)
			if err!=nil || result.Elapsed!=elapsed || !result.MeasuredAt.Equal(clock.Now()) || result.Status!="connected" || result.Code!="tcp-connected" || !result.IndependentProbe || result.ApplicationHealth!="unknown" || result.Binding!=permit.Binding || result.ValidUntil.After(permit.Until) || dial.calls!=1 || connection.closed!=1{t.Fatalf("controlled elapsed=%v: %#v calls=%d closes=%d err=%v",elapsed,result,dial.calls,connection.closed,err)}
		})
	}
}

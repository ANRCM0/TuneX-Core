package relay

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/forward"
)

func TestRelayCompleteSharedUDPFailureReleasesTCPAndNodeAdmission(t *testing.T){
	udp:=make([]func(),0,4096)
	t.Cleanup(func(){for _,release:=range udp{release()}})
	for i:=0;i<4096;i++{release,err:=forward.AcquireNodeBudget("udp");if err!=nil{t.Fatalf("original UDP budget %d: %v",i,err)};udp=append(udp,release)}
	nodeMutex.Lock();before:=nodeConnections;nodeMutex.Unlock()
	if release,err:=acquireNode(4096,"udp");err==nil{release();t.Fatal("Relay bypassed original Forward UDP budget")}
	nodeMutex.Lock();after:=nodeConnections;nodeMutex.Unlock()
	if after!=before{t.Fatal("failed UDP stage retained Relay node admission")}
	tcp:=make([]func(),0,4096);t.Cleanup(func(){for _,release:=range tcp{release()}})
	for i:=0;i<4096;i++{release,err:=forward.AcquireNodeBudget("tcp");if err!=nil{t.Fatalf("failed Relay UDP stage leaked TCP permit at %d: %v",i,err)};tcp=append(tcp,release)}
	if release,err:=acquireNode(4096,"tcp");err==nil{release();t.Fatal("Relay bypassed original Forward TCP budget")}
	for _,release:=range tcp{release()};tcp=nil
	for _,release:=range udp{release()};udp=nil
	release,err:=acquireNode(4096,"udp");if err!=nil{t.Fatal(err)};release();release()
	nodeMutex.Lock();after=nodeConnections;nodeMutex.Unlock()
	if after!=before{t.Fatal("successful shared release was not exactly once")}
}

type completeGateIO struct{events *[]string;count int;failure error}
func(r completeGateIO)Read(p []byte)(int,error){*r.events=append(*r.events,"read");copy(p,bytes.Repeat([]byte{'x'},r.count));return r.count,r.failure}
func(w completeGateIO)Write(p []byte)(int,error){*w.events=append(*w.events,"write");return min(w.count,len(p)),w.failure}
func TestRelayCompleteReadBeforeAfterAndWriteBeforeAuthority(t *testing.T){
	failure:=errors.New("authority denied");ioFailure:=errors.New("source IO error")
	for _,stage:=range []string{"before","after","none"}{
		events:=[]string{};checks:=0
		allow:=func()error{checks++;events=append(events,"allow");if stage=="before"||stage=="after"&&checks==2{return failure};return nil}
		reader:=gateReader{in:completeGateIO{events:&events,count:3,failure:ioFailure},allow:allow}
		n,err:=reader.Read(make([]byte,4));want:=[]string{"allow","read","allow"}
		if stage=="before"{want=[]string{"allow"}}
		if !reflect.DeepEqual(events,want)||stage!="none"&&(n!=0||err!=failure)||stage=="none"&&(n!=3||err!=ioFailure){t.Fatal("read authority/IO precedence changed",events,n,err)}
	}
	for _,denied:=range []bool{false,true}{
		events:=[]string{}
		writer:=gateWriter{out:completeGateIO{events:&events,count:2,failure:ioFailure},allow:func()error{events=append(events,"allow");if denied{return failure};return nil}}
		n,err:=writer.Write([]byte("payload"));want:=[]string{"allow","write"}
		if denied{want=[]string{"allow"}}
		if !reflect.DeepEqual(events,want)||denied&&(n!=0||err!=failure)||!denied&&(n!=2||err!=ioFailure){t.Fatal("write authority/IO precedence changed",events,n,err)}
	}
}

func completePolicyEngine(allow func()error)*Engine{return &Engine{ctx:context.Background(),credentialUntil:time.Now().Add(time.Hour),allow:allow,assignment:adp3relay.Assignment{Driver:adp3relay.RelayDriver{Config:adp3relay.RelayConfig{AllowedDestinationCidrs:[]string{"127.0.0.0/8"},Profile:adp3relay.ProfileConfig{HandshakeTimeoutSeconds:1}}}}}}

func TestRelayCompleteDNSPolicyCallbackAndPostDialPartialClose(t *testing.T){
	failure:=errors.New("current authorization revoked")
	for _,deniedPolicy:=range []bool{false,true}{
		calls:=0;e:=completePolicyEngine(func()error{calls++;if !deniedPolicy{return failure};return nil})
		if deniedPolicy{e.assignment.Driver.Config.AllowedDestinationCidrs=[]string{"192.0.2.0/24"}}
		_,err:=e.dialTarget("tcp",adp3relay.Target{Host:"127.0.0.1",Port:1})
		if deniedPolicy{if err==nil||err.Error()!="TARGET_REJECTED"||calls!=1{t.Fatal("policy denial did not short-circuit per-IP allow/dial",err,calls)}}else if err!=failure||calls!=2{t.Fatal("authorization final error identity/order changed",err,calls)}
	}
	listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)};defer listener.Close()
	closed:=make(chan error,1)
	go func(){connection,err:=listener.Accept();if err!=nil{closed<-err;return};defer connection.Close();_ = connection.SetReadDeadline(time.Now().Add(3*time.Second));var one [1]byte;n,err:=connection.Read(one[:]);if n!=0||!errors.Is(err,io.EOF){closed<-errors.New("post-dial refused socket not closed cleanly");return};closed<-nil}()
	calls:=0;e:=completePolicyEngine(func()error{calls++;if calls==2{return failure};return nil})
	connection,err:=e.dialTarget("tcp",adp3relay.Target{Host:"127.0.0.1",Port:uint64(listener.Addr().(*net.TCPAddr).Port)})
	if connection!=nil||err==nil||err.Error()!="LEASE_EXPIRED"||calls!=2{t.Fatal("post-dial refusal/partial-close stage changed",err,calls)}
	select{case err:=<-closed:if err!=nil{t.Fatal(err)};case <-time.After(4*time.Second):t.Fatal("post-dial socket leaked")}
	// The existing DNS resolver seam is scoped to this nonparallel test.
	old:=net.DefaultResolver;t.Cleanup(func(){net.DefaultResolver=old})
	net.DefaultResolver=&net.Resolver{PreferGo:true,Dial:func(context.Context,string,string)(net.Conn,error){return nil,errors.New("controlled resolver refusal")}}
	calls=0;e=completePolicyEngine(func()error{calls++;return failure})
	if _,err:=e.dialTarget("tcp",adp3relay.Target{Host:"unavailable.invalid",Port:443});err==nil||calls!=0{t.Fatal("DNS failure did not precede policy/authorization",err,calls)}
}

type completePayloadWriter struct{count int;failure error}
func(w completePayloadWriter)Write(p []byte)(int,error){return min(w.count,len(p)),w.failure}
func TestRelayCompletePayloadWriterCountsSuccessfulPrefixOnly(t *testing.T){
	failure:=errors.New("partial downstream write")
	for _,n:=range []int{0,2,5}{
		count,calls:=0,0
		writer:=payloadWriter{out:completePayloadWriter{count:n,failure:failure},count:func(v int){count+=v;calls++}}
		got,err:=writer.Write([]byte("abcde"))
		wantCalls:=0;if n>0{wantCalls=1}
		if got!=n||err!=failure||count!=n||calls!=wantCalls{t.Fatal("payload counted framing/failed bytes or lost successful prefix")}
	}
}

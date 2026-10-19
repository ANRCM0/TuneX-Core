package control

import (
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/payloadstats"
)

type completePayloadExecution struct{execution; counters *payloadstats.Counters; calls int}
func(e *completePayloadExecution)PayloadCounters()(payloadstats.Snapshot,bool){e.calls++;return e.counters.Snapshot()}

func TestControlCompleteNativePayloadSnapshotConsumerAndTerminalCopy(t *testing.T){
	if got,available:=readPayloadCounters(nil);available||got!=(payloadstats.Snapshot{}){t.Fatal("missing execution invented counters")}
	if got,available:=readPayloadCounters(struct{execution}{});available||got!=(payloadstats.Snapshot{}){t.Fatal("non-reader execution invented counters")}
	counters:=payloadstats.New();if counters==nil{t.Fatal("fixture entropy unavailable")}
	counters.Sent(3);counters.Received(5);counters.TCPAccept();counters.TCPConnect();counters.TCPClose();counters.UDPCreate();counters.UDPClose();counters.UDPSent(0);counters.UDPReceived(0)
	stream:=&completePayloadExecution{counters:counters}
	want,_:=counters.Snapshot();got,available:=readPayloadCounters(stream)
	if !available||got!=want||stream.calls!=1{t.Fatal("Control did not consume exact native Snapshot")}
	now:=time.Date(2026,10,19,1,2,3,0,time.UTC)
	clock:=&pointClock{now:now}
	runner:=&Runner{options:Options{NodeID:"node",BootID:"boot",ForwardTelemetry:true},hello:adp3.HelloResponse{SessionEpoch:7},effects:Effects{Schedule:clock}}
	instance:=running{assignment:adp3.Assignment{AssignmentId:"assignment",Role:"relay-ingress",Protocol:"tcp",Phase:"active"},stream:stream}
	runner.retainForwardCounterTailLocked(instance)
	if len(runner.forwardCounterTails)!=1||runner.forwardCounterTails[0].counters!=want||!runner.forwardCounterTails[0].available{t.Fatal("native terminal snapshot was lost")}
	counters.Sent(100)
	page:=runner.captureForwardCounters(true)
	if len(page.Items)!=1{t.Fatal("terminal counter not exposed")}
	point:=page.Items[0]
	wantValues:=forwardCounterValues{PayloadSentBytes:"3",PayloadReceivedBytes:"5",TCPAccepted:"1",TCPConnected:"1",TCPClosed:"1",UDPAssociationsCreated:"1",UDPAssociationsClosed:"1",UDPDatagramsSent:"1",UDPDatagramsReceived:"1"}
	if point.State!="terminal"||point.Availability!="available"||point.CounterEpoch==nil||*point.CounterEpoch!=want.Epoch||point.Overflowed==nil||*point.Overflowed||!reflect.DeepEqual(point.Counters,&wantValues)||point.EndedAt==nil||*point.EndedAt!=now.Format(time.RFC3339Nano)||point.Identity.AssignmentID!="assignment"{t.Fatalf("native copied consumer values changed: %#v",point)}
	for _,role:=range []string{"relay-transit","relay-egress","multihop-transit","multihop-egress"}{instance.assignment.Role=role;runner.retainForwardCounterTailLocked(instance)}
	if len(runner.forwardCounterTails)!=1||stream.calls!=2{t.Fatal("non-ingress read or double accounting")}
	point=newForwardCounterPoint(forwardCounterIdentity{},"active","current",now,payloadstats.Snapshot{Epoch:"ignored",PayloadSentBytes:1},false)
	if point.Availability!="unavailable"||point.CounterEpoch!=nil||point.Overflowed!=nil||point.Counters!=nil||point.EndedAt!=nil{t.Fatal("unavailable native measurement became real values")}
}

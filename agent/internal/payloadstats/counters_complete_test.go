package payloadstats

import (
	"bytes"
	"crypto/rand"
	"errors"
	"io"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
)

type completePayloadEntropy struct{remaining,chunk,calls int;failure error;requests []int}
func(r *completePayloadEntropy)Read(p []byte)(int,error){
	r.calls++;r.requests=append(r.requests,len(p))
	if r.remaining==0{if r.failure!=nil{return 0,r.failure};return 0,io.EOF}
	n:=min(len(p),r.remaining);if r.chunk>0{n=min(n,r.chunk)}
	for i:=0;i<n;i++{p[i]=0xcd};r.remaining-=n
	return n,r.failure
}

func TestPayloadStatsCompleteEntropyErrorShortAndPartialStreams(t *testing.T){
	for _,vector:=range []struct{name string;reader *completePayloadEntropy;available bool;calls int}{
		{"error",&completePayloadEntropy{failure:errors.New("reader failure")},false,1},
		{"partial-error",&completePayloadEntropy{remaining:7,failure:errors.New("partial reader failure")},false,1},
		{"short-eof",&completePayloadEntropy{remaining:15},false,2},
		{"full",&completePayloadEntropy{remaining:19},true,1},
		{"partial-success",&completePayloadEntropy{remaining:16,chunk:3},true,6},
	}{t.Run(vector.name,func(t *testing.T){
		original:=rand.Reader;rand.Reader=vector.reader;t.Cleanup(func(){rand.Reader=original})
		counter:=New()
		if (counter!=nil)!=vector.available||vector.reader.calls!=vector.calls||len(vector.reader.requests)==0||vector.reader.requests[0]!=16{t.Fatalf("epoch reader behavior changed: counter=%v reader=%#v",counter,vector.reader)}
		if counter!=nil{snapshot,ok:=counter.Snapshot();if !ok||snapshot.Epoch!="cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"{t.Fatal("full epoch did not encode exact16 bytes")}}
		if vector.name=="full" && vector.reader.remaining!=3{t.Fatal("epoch consumed extra entropy")}
	})}
}

func TestPayloadStatsCompleteEpochSnapshotNilAndSuccessfulPayload(t *testing.T){
	original:=rand.Reader;rand.Reader=bytes.NewReader(bytes.Repeat([]byte{0xab},16));t.Cleanup(func(){rand.Reader=original})
	counters:=New();if counters==nil{t.Fatal("valid entropy made unavailable counters")}
	if snapshot,ok:=counters.Snapshot();!ok || snapshot.Epoch!="abababababababababababababababab"{t.Fatalf("epoch changed: %#v %v",snapshot,ok)}
	counters.Sent(-1);counters.Sent(0);counters.Received(-1);counters.Received(0);counters.UDPSent(-1);counters.UDPReceived(-1)
	counters.Sent(3);counters.Received(5);counters.TCPAccept();counters.TCPConnect();counters.TCPClose();counters.UDPCreate();counters.UDPClose();counters.UDPSent(0);counters.UDPSent(7);counters.UDPReceived(0);counters.UDPReceived(11)
	want:=Snapshot{Epoch:"abababababababababababababababab",PayloadSentBytes:10,PayloadReceivedBytes:16,TCPAccepted:1,TCPConnected:1,TCPClosed:1,UDPAssociationsCreated:1,UDPAssociationsClosed:1,UDPDatagramsSent:2,UDPDatagramsReceived:2}
	got,ok:=counters.Snapshot();if !ok || got!=want{t.Fatalf("successful bytes/empty UDP counts: %#v",got)}
	got.Epoch="mutated";again,_:=counters.Snapshot();if again!=want{t.Fatal("Snapshot is not detached")}
	var absent *Counters
	absent.Sent(1);absent.Received(1);absent.TCPAccept();absent.TCPConnect();absent.TCPClose();absent.UDPCreate();absent.UDPClose();absent.UDPSent(0);absent.UDPReceived(0);absent.add(nil,1)
	for _,value:=range []*Counters{absent,{}}{if s,available:=value.Snapshot();available || s!=(Snapshot{}){t.Fatal("nil/zero counter invented measurement identity")}}
	typ:=reflect.TypeOf(Snapshot{});if typ.PkgPath()!="github.com/tunex/vnext/agent/internal/payloadstats"{t.Fatal("Snapshot canonical owner changed")}
	fields:=[]string{"Epoch","PayloadSentBytes","PayloadReceivedBytes","TCPAccepted","TCPConnected","TCPClosed","UDPAssociationsCreated","UDPAssociationsClosed","UDPDatagramsSent","UDPDatagramsReceived","Overflowed"}
	if typ.NumField()!=len(fields){t.Fatal("Snapshot field count changed")}
	for i,name:=range fields{f:=typ.Field(i);wantType:=reflect.TypeOf(uint64(0));if i==0{wantType=reflect.TypeOf("")};if i==len(fields)-1{wantType=reflect.TypeOf(false)};if f.Name!=name||f.Type!=wantType||f.Tag!=""{t.Fatalf("Snapshot field%d: %v",i,f)}}
}

func TestPayloadStatsCompleteAtomicSaturationAndConcurrentSnapshots(t *testing.T){
	counters:=&Counters{epoch:"epoch"}
	all:=[]*atomic.Uint64{&counters.sent,&counters.received,&counters.accepted,&counters.connected,&counters.closed,&counters.udpCreated,&counters.udpClosed,&counters.udpSent,&counters.udpReceived}
	for _,counter:=range all{counter.Store(^uint64(0)-1);counters.add(counter,2);if counter.Load()!=^uint64(0){t.Fatal("counter wrapped")};counters.add(counter,1);if counter.Load()!=^uint64(0){t.Fatal("saturated counter resurrected")}}
	if snapshot,ok:=counters.Snapshot();!ok||!snapshot.Overflowed{t.Fatal("overflow latch not exposed")}
	counters.add(nil,9)
	counters=&Counters{epoch:"concurrent"}
	var writers sync.WaitGroup
	for i:=0;i<32;i++{writers.Add(1);go func(){defer writers.Done();for j:=0;j<100;j++{counters.Sent(1);counters.Received(2);counters.TCPAccept();counters.UDPSent(0);s,available:=counters.Snapshot();if !available||s.Epoch!="concurrent"{t.Error("concurrent snapshot lost stable epoch")}}}()}
	writers.Wait()
	snapshot,ok:=counters.Snapshot();if !ok||snapshot.PayloadSentBytes!=3200||snapshot.PayloadReceivedBytes!=6400||snapshot.TCPAccepted!=3200||snapshot.UDPDatagramsSent!=3200||snapshot.Overflowed{t.Fatalf("atomic totals differ: %#v",snapshot)}
}

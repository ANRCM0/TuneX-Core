package relay

import (
	"bytes"
	"io"
	"net"
	"testing"
	"time"
)

func TestRelayCompleteTCPIngressPayloadReadExcludesCarrierAndEgress(t *testing.T){
	ingress,egress:=makePair(t,"tcp",tcpTarget(t,"reply:",true),4,func()error{return nil})
	if err:=egress.Activate();err!=nil{t.Fatal(err)};if err:=ingress.Activate();err!=nil{t.Fatal(err)}
	connection,err:=net.Dial("tcp",ingress.listener.Addr().String());if err!=nil{t.Fatal(err)};defer connection.Close()
	_ = connection.SetDeadline(time.Now().Add(3*time.Second))
	if _,err:=connection.Write([]byte("hello"));err!=nil{t.Fatal(err)}
	if err:=connection.(*net.TCPConn).CloseWrite();err!=nil{t.Fatal(err)}
	raw,err:=io.ReadAll(connection);if err!=nil||string(raw)!="reply:hello"{t.Fatal("payload fixture failed",err)}
	wait(t,func()bool{snapshot,ok:=ingress.PayloadCounters();return ok&&snapshot.TCPClosed==1})
	snapshot,ok:=ingress.PayloadCounters()
	if !ok||snapshot.PayloadSentBytes!=5||snapshot.PayloadReceivedBytes!=11||snapshot.TCPAccepted!=1||snapshot.TCPConnected!=1||snapshot.TCPClosed!=1||snapshot.UDPDatagramsSent!=0||snapshot.Overflowed{t.Fatalf("ingress payload includes TLS/frame/control or wrong native lifecycle: %#v",snapshot)}
	if _,ok:=egress.PayloadCounters();ok{t.Fatal("Relay egress duplicated ingress accounting")}
}

func TestRelayCompleteUDPIngressEmptyDatagramsAndPayloadRead(t *testing.T){
	target,err:=net.ListenUDP("udp",&net.UDPAddr{IP:net.IPv4(127,0,0,1)});if err!=nil{t.Fatal(err)}
	done:=make(chan struct{})
	go func(){defer close(done);buffer:=make([]byte,64);for{n,client,err:=target.ReadFromUDP(buffer);if err!=nil{return};_,_=target.WriteToUDP(buffer[:n],client)}}()
	t.Cleanup(func(){target.Close();<-done})
	ingress,egress:=makePair(t,"udp",uint64(target.LocalAddr().(*net.UDPAddr).Port),4,func()error{return nil})
	if err:=egress.Activate();err!=nil{t.Fatal(err)};if err:=ingress.Activate();err!=nil{t.Fatal(err)}
	client,err:=net.DialUDP("udp",nil,ingress.udp.LocalAddr().(*net.UDPAddr));if err!=nil{t.Fatal(err)};defer client.Close()
	for _,packet:=range [][]byte{nil,[]byte("payload")}{
		_ = client.SetDeadline(time.Now().Add(3*time.Second));if _,err:=client.Write(packet);err!=nil{t.Fatal(err)}
		buffer:=make([]byte,64);n,err:=client.Read(buffer);if err!=nil||!bytes.Equal(buffer[:n],packet){t.Fatal("UDP payload fixture failed",err)}
	}
	wait(t,func()bool{snapshot,ok:=ingress.PayloadCounters();return ok&&snapshot.UDPDatagramsReceived==2})
	snapshot,ok:=ingress.PayloadCounters()
	if !ok||snapshot.UDPDatagramsSent!=2||snapshot.UDPDatagramsReceived!=2||snapshot.PayloadSentBytes!=7||snapshot.PayloadReceivedBytes!=7||snapshot.UDPAssociationsCreated!=1||snapshot.TCPAccepted!=0||snapshot.Overflowed{t.Fatalf("empty UDP or carrier bytes counted incorrectly: %#v",snapshot)}
	if _,ok:=egress.PayloadCounters();ok{t.Fatal("UDP egress duplicated ingress accounting")}
}

package relay

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"testing"

	"github.com/tunex/vnext/agent/internal/relaycontracts"
)

type completeChunkWriter struct{bytes.Buffer;maximum int;failure error;calls int}
func(w *completeChunkWriter)Write(p []byte)(int,error){w.calls++;if w.failure!=nil{return 0,w.failure};n:=min(len(p),w.maximum);if n>0{_,_=w.Buffer.Write(p[:n])};return n,nil}
type completeChunkReader struct{io.Reader}
func(r completeChunkReader)Read(p []byte)(int,error){return r.Reader.Read(p[:min(len(p),1)])}
func completeControlRaw(raw string)[]byte{header:=make([]byte,4);binary.BigEndian.PutUint32(header,uint32(len(raw)));return append(header,[]byte(raw)...)}

func TestRelayCompleteControlFramePartialIOAndValidationBeforeWrites(t *testing.T){
	failure:=errors.New("specific writer error")
	if err:=writeAll(&completeChunkWriter{failure:failure},[]byte("payload"));err!=failure{t.Fatal("writer error identity changed")}
	if err:=writeAll(&completeChunkWriter{},[]byte("payload"));!errors.Is(err,io.ErrShortWrite){t.Fatal("zero write did not refuse")}
	for _,kind:=range []byte{FrameTCP,FrameUDP,FrameFIN,FrameClose}{
		protocol:="tcp";if kind==FrameUDP{protocol="udp"}
		payload:=[]byte("payload");if kind==FrameFIN||kind==FrameClose{payload=nil}
		out:=&completeChunkWriter{maximum:1}
		if err:=WriteFrame(out,kind,payload,protocol,64);err!=nil{t.Fatal(err)}
		got,data,err:=ReadFrame(completeChunkReader{bytes.NewReader(out.Bytes())},protocol,64)
		if err!=nil||got!=kind||!bytes.Equal(data,payload){t.Fatal("partial frame IO changed",err)}
		for cut:=0;cut<len(out.Bytes());cut++{if _,_,err:=ReadFrame(bytes.NewReader(out.Bytes()[:cut]),protocol,64);err==nil{t.Fatal("truncated header/body accepted")}}
	}
	for _,size:=range []uint32{0,1,MaxControlBytes+1}{
		header:=make([]byte,4);binary.BigEndian.PutUint32(header,size)
		reader:=bytes.NewReader(append(header,[]byte("unread body")...))
		if _,err:=readControlPayload(reader);err==nil||reader.Len()!=len("unread body"){t.Fatal("control limit did not refuse before payload read")}
	}
	out:=&completeChunkWriter{maximum:1}
	open:=relaycontracts.Open{WireVersion:1,Type:"open",Action:"probe",RequestId:"request",Binding:testBinding()}
	if err:=WriteControl(out,"Open",open);err!=nil{t.Fatal(err)}
	var got relaycontracts.Open
	if err:=ReadControl(completeChunkReader{bytes.NewReader(out.Bytes())},"Open",&got);err!=nil||got!=open{t.Fatal("partial control IO changed",err)}
	for _,value:=range []any{func(){},map[string]any{"command":"run"}}{
		writer:=&completeChunkWriter{maximum:1};if err:=WriteControl(writer,"Open",value);err==nil||writer.calls!=0{t.Fatal("marshal/schema refusal wrote bytes")}
	}
	for _,raw:=range []string{`{"type":"accepted","type":"rejected"}`,`[]`,`{"type":"unknown"}`}{if err:=ReadReply(bytes.NewReader(completeControlRaw(raw)),"request","digest");err==nil{t.Fatal("non-IJSON/unknown reply accepted")}}
}

func TestRelayCompleteOpenValidationAuthorizationAndBindingFirstErrors(t *testing.T){
	open:=relaycontracts.Open{WireVersion:1,Type:"open",Action:"probe",RequestId:"request",Binding:testBinding()}
	failure:=errors.New("current permit refused")
	calls:=0;allow:=func()error{calls++;return failure}
	invalid:=open;invalid.Type="invalid"
	if err:=ValidateOpen(invalid,testBinding(),false,allow);err==nil||err.Error()=="DOWNSTREAM_NOT_ACTIVE"||calls!=0{t.Fatal("schema did not precede active/authorization")}
	if err:=ValidateOpen(open,testBinding(),false,allow);err==nil||err.Error()!="DOWNSTREAM_NOT_ACTIVE"||calls!=0{t.Fatal("active gate did not precede authorization")}
	if err:=ValidateOpen(open,testBinding(),true,nil);err==nil||err.Error()!="AUTHORIZATION_DENIED"{t.Fatal("nil authorization accepted")}
	different:=testBinding();different.EgressFence++
	if err:=ValidateOpen(open,different,true,allow);err!=failure||calls!=1{t.Fatal("current authorization did not precede binding hash")}
	if err:=ValidateOpen(open,different,true,func()error{return nil});err==nil||err.Error()!="STALE_DEPLOYMENT"{t.Fatal("different binding accepted")}
}

func TestRelayCompleteFramedBufferedFINAndAuthorityRefusalOrder(t *testing.T){
	calls:=0;allow:=func()error{calls++;return nil}
	stream:=&framedTCP{maximum:64,allow:allow,readBuffer:[]byte("abc")}
	if n,err:=stream.Read(nil);n!=0||err!=nil||calls!=0{t.Fatal("zero read touched authorization/wire")}
	buffer:=make([]byte,2)
	if n,err:=stream.Read(buffer);n!=2||string(buffer)!="ab"||err!=nil||calls!=1{t.Fatal("buffered frame read changed",n,err,calls)}
	if n,err:=stream.Read(buffer);n!=1||buffer[0]!='c'||err!=nil||calls!=2{t.Fatal("buffered remainder changed")}
	stream.readEnded=true
	if n,err:=stream.Read(buffer);n!=0||!errors.Is(err,io.EOF)||calls!=3{t.Fatal("FIN did not recheck authority before EOF")}
	stream.writeEnded=true
	if n,err:=stream.Write([]byte("a"));n!=0||!errors.Is(err,io.ErrClosedPipe)||calls!=3{t.Fatal("write after FIN touched authority/wire")}
	if err:=stream.CloseWrite();err!=nil||calls!=3{t.Fatal("repeat CloseWrite touched authority/wire")}
	failure:=errors.New("expired before wire")
	stream=&framedTCP{maximum:64,allow:func()error{return failure}}
	if n,err:=stream.Read(buffer);n!=0||err!=failure{t.Fatal("read performed wire before authority")}
	if n,err:=stream.Write([]byte("a"));n!=0||err!=failure{t.Fatal("write performed wire before authority")}
	if err:=stream.CloseWrite();err!=failure||stream.writeEnded{t.Fatal("failed CloseWrite advanced FIN state")}
}

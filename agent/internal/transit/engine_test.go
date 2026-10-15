package transit

import (
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/json"
 "io"
 "math/big"
 "net"
 "net/netip"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync"
 "testing"
 "time"

 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)
type labCA struct{root *x509.Certificate;key *ecdsa.PrivateKey;roots *x509.CertPool}
func newCA(t *testing.T)labCA{
 t.Helper();key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 root:=&x509.Certificate{SerialNumber:big.NewInt(1),Subject:pkix.Name{CommonName:"Lab CA"},NotBefore:time.Now().Add(-time.Hour),NotAfter:time.Now().Add(time.Hour),BasicConstraintsValid:true,IsCA:true,KeyUsage:x509.KeyUsageCertSign}
 raw,err:=x509.CreateCertificate(rand.Reader,root,root,&key.PublicKey,key);if err!=nil{t.Fatal(err)}
 cert,err:=x509.ParseCertificate(raw);if err!=nil{t.Fatal(err)}
 roots:=x509.NewCertPool();roots.AddCert(cert);return labCA{cert,key,roots}
}
func(c labCA)issue(t *testing.T,node string)tls.Certificate{
 t.Helper();key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 uri,err:=url.Parse("urn:tunex:node:"+node);if err!=nil{t.Fatal(err)}
 serial,err:=rand.Int(rand.Reader,new(big.Int).Lsh(big.NewInt(1),100));if err!=nil{t.Fatal(err)}
 tmpl:=&x509.Certificate{SerialNumber:serial,Subject:pkix.Name{CommonName:node},NotBefore:time.Now().Add(-time.Minute),NotAfter:time.Now().Add(time.Hour),KeyUsage:x509.KeyUsageDigitalSignature,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth},URIs:[]*url.URL{uri}}
 raw,err:=x509.CreateCertificate(rand.Reader,tmpl,c.root,&key.PublicKey,c.key);if err!=nil{t.Fatal(err)}
 leaf,err:=x509.ParseCertificate(raw);if err!=nil{t.Fatal(err)}
 return tls.Certificate{Certificate:[][]byte{raw},PrivateKey:key,Leaf:leaf}
}
func freePort(t *testing.T)uint64{
 t.Helper();l,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 defer l.Close();return uint64(l.Addr().(*net.TCPAddr).Port)
}
func fixture(t *testing.T,protocol string,a,c tls.Certificate,localPort,downPort uint64)*transitcontracts.TransitIntent{
 t.Helper()
 raw,err:=os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json");if err!=nil{t.Fatal(err)}
 var v struct{Cases []struct{Raw string}}
 if err:=json.Unmarshal(raw,&v);err!=nil{t.Fatal(err)}
 var intent transitcontracts.TransitIntent
 if err:=json.Unmarshal([]byte(v.Cases[0].Raw),&intent);err!=nil{t.Fatal(err)}
 intent.Protocol=protocol;intent.Listener.Port=localPort;intent.Downstream.Endpoint.Port=downPort
 intent.Upstream.PeerFingerprint=relay.Fingerprint(a.Leaf)
 intent.Downstream.PeerFingerprint=relay.Fingerprint(c.Leaf)
 intent.IssuedAt=time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano)
 intent.AuthorizationUntil=time.Now().Add(5*time.Second).UTC().Format(time.RFC3339Nano)
 return &intent
}
func encode(t *testing.T,v *transitcontracts.TransitIntent)[]byte{t.Helper();raw,err:=json.Marshal(v);if err!=nil{t.Fatal(err)};return raw}
func approvedIP(ip netip.Addr)bool{return ip==netip.MustParseAddr("127.0.0.1")}
func permit(v *transitcontracts.TransitIntent)error{
 if v.ScopeId!="scope-1"||v.NodeId!="node-b"||v.Upstream.NodeId!="node-a"||v.Downstream.NodeId!="node-c"{return io.ErrClosedPipe};return nil
}
func tail(t *testing.T,ca labCA,b,c tls.Certificate,intent *transitcontracts.TransitIntent){
 t.Helper()
 addr:=net.JoinHostPort("127.0.0.1",strconv.FormatUint(intent.Downstream.Endpoint.Port,10))
 listener,err:=net.Listen("tcp",addr);if err!=nil{t.Fatal(err)}
 config,err:=peerConfig(c,ca.roots,"node-b",relay.Fingerprint(b.Leaf),true);if err!=nil{t.Fatal(err)}
 var workers sync.WaitGroup
 workers.Add(1)
 go func(){
  defer workers.Done()
  for{
   raw,err:=listener.Accept();if err!=nil{return}
   workers.Add(1)
   go func(raw net.Conn){
    defer workers.Done();defer closeConn(raw)
    peer:=tls.Server(raw,config);peer.SetDeadline(time.Now().Add(3*time.Second))
    if peer.Handshake()!=nil{return}
    var open Open;if readControl(peer,&open)!=nil{return}
    if ValidateOpen(open,DownstreamBinding(*intent),true,func()error{return nil})!=nil{return}
    if writeAccepted(peer,open)!=nil||open.Action=="probe"{return}
    for{
     kind,payload,err:=relay.ReadFrame(peer,intent.Protocol,512);if err!=nil{return}
     if ValidateFrame(kind,intent.Protocol)!=nil{return}
     if kind==relay.FrameClose{return}
     if kind==relay.FrameFIN{_ = relay.WriteFrame(peer,relay.FrameFIN,nil,"tcp",512);return}
     if relay.WriteFrame(peer,kind,payload,intent.Protocol,512)!=nil{return}
    }
   }(raw)
  }
 }()
 t.Cleanup(func(){listener.Close();workers.Wait()})
}
func lab(t *testing.T,proto string)(*Engine,*transitcontracts.TransitIntent,labCA,tls.Certificate,tls.Certificate){
 t.Helper();ca:=newCA(t);a,b,c:=ca.issue(t,"node-a"),ca.issue(t,"node-b"),ca.issue(t,"node-c")
 i:=fixture(t,proto,a,c,freePort(t),freePort(t));tail(t,ca,b,c,i)
 e,err:=Prepare(encode(t,i),Identity{b,ca.roots},permit,func()error{return nil},Options{HandshakeTimeout:time.Second,MaxFrameBytes:512,EndpointAllowed:approvedIP})
 if err!=nil{t.Fatal(err)}
 t.Cleanup(e.Close)
 return e,i,ca,a,b
}
func upstream(t *testing.T,e *Engine,i *transitcontracts.TransitIntent,ca labCA,a,b tls.Certificate,action string)(*tls.Conn,error){
 t.Helper()
 raw,err:=net.DialTimeout("tcp",e.Addr().String(),time.Second);if err!=nil{return nil,err}
 config,err:=peerConfig(a,ca.roots,"node-b",relay.Fingerprint(b.Leaf),false);if err!=nil{raw.Close();return nil,err}
 peer:=tls.Client(raw,config);peer.SetDeadline(time.Now().Add(2*time.Second))
 if err=peer.Handshake();err==nil {
  var open Open;open,err=MakeOpen(action,UpstreamBinding(*i))
  if err==nil{err=writeControl(peer,open)};if err==nil{err=readAccepted(peer,open)}
 }
 if err!=nil{closeConn(peer);return nil,err}
 peer.SetDeadline(time.Now().Add(3*time.Second));return peer,nil
}
func TestPreparedGateAndTCPHalfClose(t *testing.T){
 e,i,ca,a,b:=lab(t,"tcp")
 if peer,err:=upstream(t,e,i,ca,a,b,"tcp");err==nil{closeConn(peer);t.Fatal("prepared Transit accepted upstream")}
 if err:=e.Activate();err!=nil{t.Fatal(err)}
 peer,err:=upstream(t,e,i,ca,a,b,"tcp");if err!=nil{t.Fatal(err)}
 defer closeConn(peer)
 payload:=[]byte("auth relay tcp")
 if err:=relay.WriteFrame(peer,relay.FrameTCP,payload,"tcp",512);err!=nil{t.Fatal(err)}
 kind,body,err:=relay.ReadFrame(peer,"tcp",512)
 if err!=nil||kind!=relay.FrameTCP||string(body)!=string(payload){t.Fatalf("incorrect TCP response kind=%d body=%q error=%v",kind,body,err)}
 if err:=relay.WriteFrame(peer,relay.FrameFIN,nil,"tcp",512);err!=nil{t.Fatal(err)}
 kind,_,err=relay.ReadFrame(peer,"tcp",512);if err!=nil||kind!=relay.FrameFIN{t.Fatalf("TCP FIN lost: %d %v",kind,err)}
}
func TestUDPDatagramFramesRemainSeparate(t *testing.T){
 e,i,ca,a,b:=lab(t,"udp");if err:=e.Activate();err!=nil{t.Fatal(err)}
 peer,err:=upstream(t,e,i,ca,a,b,"udp");if err!=nil{t.Fatal(err)}
 defer closeConn(peer)
 for _,payload:=range [][]byte{[]byte("one"),[]byte("two-different-length")}{
  if err:=relay.WriteFrame(peer,relay.FrameUDP,payload,"udp",512);err!=nil{t.Fatal(err)}
  kind,body,err:=relay.ReadFrame(peer,"udp",512)
  if err!=nil||kind!=relay.FrameUDP||string(body)!=string(payload){t.Fatalf("UDP payload changed %d %q: %v",kind,body,err)}
 }
 if err:=relay.WriteFrame(peer,relay.FrameClose,nil,"udp",512);err!=nil{t.Fatal(err)}
}
func TestWrongIdentityAuthorizationAndDrainRefused(t *testing.T){
 e,i,ca,a,b:=lab(t,"tcp");if err:=e.Activate();err!=nil{t.Fatal(err)}
 wrong:=ca.issue(t,"node-x")
 if peer,err:=upstream(t,e,i,ca,wrong,b,"tcp");err==nil{closeConn(peer);t.Fatal("wrong Node identity accepted")}
 if engine,err:=Prepare(encode(t,i),Identity{b,ca.roots},nil,func()error{return nil},Options{HandshakeTimeout:time.Second,MaxFrameBytes:512,EndpointAllowed:approvedIP});err==nil{engine.Close();t.Fatal("missing permit accepted")}
 if engine,err:=Prepare(encode(t,i),Identity{b,ca.roots},permit,nil,Options{HandshakeTimeout:time.Second,MaxFrameBytes:512,EndpointAllowed:approvedIP});err==nil{engine.Close();t.Fatal("missing live authorization accepted")}
 if engine,err:=Prepare(encode(t,i),Identity{b,ca.roots},func(*transitcontracts.TransitIntent)error{return io.ErrClosedPipe},func()error{return nil},Options{HandshakeTimeout:time.Second,MaxFrameBytes:512,EndpointAllowed:approvedIP});err==nil{engine.Close();t.Fatal("denied permit accepted")}
 peer,err:=upstream(t,e,i,ca,a,b,"tcp");if err!=nil{t.Fatal(err)};closeConn(peer)
 e.Drain()
 if peer,err:=upstream(t,e,i,ca,a,b,"tcp");err==nil{closeConn(peer);t.Fatal("draining Transit accepted new upstream")}
}
func TestNoDowngradeOrUnsafeEndpoint(t *testing.T){
 e,i,ca,a,b:=lab(t,"tcp");if err:=e.Activate();err!=nil{t.Fatal(err)}
 raw,err:=net.DialTimeout("tcp",e.Addr().String(),time.Second);if err!=nil{t.Fatal(err)}
 config,err:=peerConfig(a,ca.roots,"node-b",relay.Fingerprint(b.Leaf),false);if err!=nil{t.Fatal(err)}
 config.MinVersion=tls.VersionTLS12;config.MaxVersion=tls.VersionTLS12
 peer:=tls.Client(raw,config);peer.SetDeadline(time.Now().Add(time.Second))
 if err:=peer.Handshake();err==nil{t.Fatal("TLS 1.2 was accepted")};closeConn(peer)
 if _,err:=Prepare(encode(t,i),Identity{b,ca.roots},permit,func()error{return nil},Options{HandshakeTimeout:time.Second,MaxFrameBytes:512});err==nil{t.Fatal("missing endpoint policy accepted")}
 if strings.Contains(e.Addr().String(),":0"){t.Fatal("unexpected unbound port")}
}

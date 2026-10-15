package transit

import (
 "bytes"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/json"
 "fmt"
 "io"
 "math/big"
 "net"
 "net/url"
 "sync"
 "sync/atomic"
 "testing"
 "time"

 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

type caFixture struct{
 key *ecdsa.PrivateKey
 leaf *x509.Certificate
 roots *x509.CertPool
}
func newCA(t *testing.T)caFixture{
 t.Helper()
 key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 template:=&x509.Certificate{SerialNumber:big.NewInt(10),Subject:pkix.Name{CommonName:"isolated Transit test CA"},
  NotBefore:time.Now().Add(-time.Minute),NotAfter:time.Now().Add(time.Hour),
  IsCA:true,BasicConstraintsValid:true,KeyUsage:x509.KeyUsageCertSign}
 der,err:=x509.CreateCertificate(rand.Reader,template,template,&key.PublicKey,key)
 if err!=nil{t.Fatal(err)}
 leaf,err:=x509.ParseCertificate(der);if err!=nil{t.Fatal(err)}
 roots:=x509.NewCertPool();roots.AddCert(leaf)
 return caFixture{key,leaf,roots}
}
func (ca caFixture)node(t *testing.T,name string)tls.Certificate{
 t.Helper()
 key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 nodeURI,err:=url.Parse("urn:tunex:node:"+name);if err!=nil{t.Fatal(err)}
 serial,err:=rand.Int(rand.Reader,new(big.Int).Lsh(big.NewInt(1),95));if err!=nil{t.Fatal(err)}
 template:=&x509.Certificate{SerialNumber:serial,NotBefore:time.Now().Add(-time.Minute),NotAfter:time.Now().Add(time.Hour),
  KeyUsage:x509.KeyUsageDigitalSignature,
  ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth},
  URIs:[]*url.URL{nodeURI},BasicConstraintsValid:true}
 der,err:=x509.CreateCertificate(rand.Reader,template,ca.leaf,&key.PublicKey,ca.key)
 if err!=nil{t.Fatal(err)}
 leaf,err:=x509.ParseCertificate(der);if err!=nil{t.Fatal(err)}
 return tls.Certificate{Certificate:[][]byte{der},PrivateKey:key,Leaf:leaf}
}
func freeTCP(t *testing.T)uint64{
 t.Helper()
 l,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 port:=uint64(l.Addr().(*net.TCPAddr).Port);l.Close();return port
}
func sampleIntent(protocol string,port,downstreamPort uint64,certA,certC tls.Certificate)*transitcontracts.TransitIntent{
 return &transitcontracts.TransitIntent{
  ContractVersion:1,Role:"relay-transit",Driver:"native.transit.v1",Security:"mutual-tls13",
  ScopeId:"scope-a",ForwardId:"forward-a",ForwardRevision:1,DeploymentGeneration:2,
  ProfileId:"profile-a",ProfileRevision:1,ProfileDigest:"sha256:"+string(bytes.Repeat([]byte("1"),64)),
  PathDigest:"sha256:"+string(bytes.Repeat([]byte("2"),64)),
  NodeId:"node-b",AssignmentId:"assignment-b",SessionEpoch:3,BindingFence:4,
  Protocol:protocol,HopIndex:1,HopCount:3,
  Listener:transitcontracts.Listener{Address:"127.0.0.1",Port:port,Protocol:"tcp"},
  Upstream:transitcontracts.Neighbor{NodeId:"node-a",AssignmentId:"assignment-a",SessionEpoch:2,BindingFence:3,PeerFingerprint:relay.Fingerprint(certA.Leaf)},
  Downstream:transitcontracts.Downstream{NodeId:"node-c",AssignmentId:"assignment-c",SessionEpoch:4,BindingFence:5,PeerFingerprint:relay.Fingerprint(certC.Leaf),
   Endpoint:transitcontracts.Endpoint{Host:"127.0.0.1",Port:downstreamPort}},
  IssuedAt:time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano),
  AuthorizationUntil:time.Now().Add(3*time.Minute).UTC().Format(time.RFC3339Nano),
  EgressPolicyRevision:1,AllowedDestinationCidrs:[]string{"127.0.0.0/8"},
  AllowMetadataTargets:false,MaxConnections:4,
 }
}
func newFixture(t *testing.T,protocol string)(*Engine,Identity,*atomic.Bool){
 t.Helper()
 ca:=newCA(t)
 a,b,c:=ca.node(t,"node-a"),ca.node(t,"node-b"),ca.node(t,"node-c")
 serverTLS,err:=tlsConfig(Identity{c,ca.roots},"node-b",relay.Fingerprint(b.Leaf),true)
 if err!=nil{t.Fatal(err)}
 egress,err:=tls.Listen("tcp","127.0.0.1:0",serverTLS)
 if err!=nil{t.Fatal(err)}
 var wg sync.WaitGroup
 var engine *Engine
 wg.Add(1)
 go func(){
  defer wg.Done()
  for{
   raw,err:=egress.Accept()
   if err!=nil{return}
   wg.Add(1)
   go func(){
    defer wg.Done();defer raw.Close()
    conn:=raw.(*tls.Conn)
    conn.SetDeadline(time.Now().Add(3*time.Second))
    if err:=conn.Handshake();err!=nil{return}
    var open Open
    if err:=readMessage(conn,&open);err!=nil{return}
    if engine==nil || expectedInbound(engine.outboundBinding(),open)!=nil{return}
    digest,_:=bindingDigest(engine.outboundBinding())
    if err:=writeMessage(conn,Reply{Type:"accepted",RequestID:open.RequestID,BindingDigest:digest});err!=nil{return}
    if open.Action=="probe"{return}
    conn.SetDeadline(time.Time{})
    for{
     conn.SetReadDeadline(time.Now().Add(5*time.Second))
     kind,data,err:=relay.ReadFrame(conn,protocol,65536)
     if err!=nil{return}
     switch kind{
     case relay.FrameTCP,relay.FrameUDP:
      if err:=relay.WriteFrame(conn,kind,data,protocol,65536);err!=nil{return}
     case relay.FrameFIN:
      relay.WriteFrame(conn,relay.FrameFIN,nil,protocol,65536)
      return
     case relay.FrameClose:
      relay.WriteFrame(conn,relay.FrameClose,nil,protocol,65536)
      return
     }
    }
   }()
  }
 }()
 t.Cleanup(func(){egress.Close();wg.Wait()})
 allowed:=new(atomic.Bool);allowed.Store(true)
 grant:=func()error{if !allowed.Load(){return fmt.Errorf("LEASE_EXPIRED: revoked")};return nil}
 intent:=sampleIntent(protocol,freeTCP(t),uint64(egress.Addr().(*net.TCPAddr).Port),a,c)
 raw,err:=json.Marshal(intent);if err!=nil{t.Fatal(err)}
 engine,err=Prepare(raw,Identity{b,ca.roots},grant)
 if err!=nil{t.Fatal(err)}
 t.Cleanup(engine.Close)
 if err:=engine.Activate();err!=nil{t.Fatal("activation/downstream probe:",err)}
 return engine,Identity{a,ca.roots},allowed
}
func connectUpstream(t *testing.T,e *Engine,id Identity,open Open)(*tls.Conn,error){
 t.Helper()
 cfg,err:=tlsConfig(id,"node-b",relay.Fingerprint(e.identity.Certificate.Leaf),false)
 if err!=nil{return nil,err}
 raw,err:=net.DialTimeout("tcp",e.Addr().String(),time.Second)
 if err!=nil{return nil,err}
 client:=tls.Client(raw,cfg)
 client.SetDeadline(time.Now().Add(3*time.Second))
 if err=client.Handshake();err!=nil{client.Close();return nil,err}
 if err=writeMessage(client,open);err!=nil{client.Close();return nil,err}
 var reply Reply
 if err=readMessage(client,&reply);err!=nil{client.Close();return nil,err}
 digest,_:=bindingDigest(open.Binding)
 if err=validateReply(reply,open.RequestID,digest);err!=nil{client.Close();return nil,err}
 client.SetDeadline(time.Time{})
 return client,nil
}
func openFor(e *Engine,protocol string)Open{
 return Open{Type:"open",Action:protocol,RequestID:"0123456789abcdef0123456789abcdef",Binding:e.inboundBinding()}
}
func TestThreeNodeTLSBoundTransitTCPHalfClose(t *testing.T){
 e,id,_:=newFixture(t,"tcp")
 client,err:=connectUpstream(t,e,id,openFor(e,"tcp"))
 if err!=nil{t.Fatal(err)}
 defer client.Close()
 payload:=[]byte("a-to-b-to-c-encrypted")
 if err:=relay.WriteFrame(client,relay.FrameTCP,payload,"tcp",65536);err!=nil{t.Fatal(err)}
 kind,reply,err:=relay.ReadFrame(client,"tcp",65536)
 if err!=nil||kind!=relay.FrameTCP||!bytes.Equal(payload,reply){t.Fatalf("TCP payload: %d %q %v",kind,reply,err)}
 if err:=relay.WriteFrame(client,relay.FrameFIN,nil,"tcp",65536);err!=nil{t.Fatal(err)}
 kind,_,err=relay.ReadFrame(client,"tcp",65536)
 if err!=nil||kind!=relay.FrameFIN{t.Fatalf("TCP half-close not relayed: %d %v",kind,err)}
 client.Close()
 waitEmpty(t,e)
}
func TestThreeNodeTLSBoundTransitUDPAssociationAndEmptyDatagram(t *testing.T){
 e,id,_:=newFixture(t,"udp")
 client,err:=connectUpstream(t,e,id,openFor(e,"udp"))
 if err!=nil{t.Fatal(err)}
 defer client.Close()
 for _,payload:=range [][]byte{nil,[]byte("client1-udp"),bytes.Repeat([]byte{0xfa},4096)}{
  if err:=relay.WriteFrame(client,relay.FrameUDP,payload,"udp",65536);err!=nil{t.Fatal(err)}
  kind,reply,err:=relay.ReadFrame(client,"udp",65536)
  if err!=nil||kind!=relay.FrameUDP||!bytes.Equal(payload,reply){t.Fatalf("UDP payload mismatch: %d %v",kind,err)}
 }
 relay.WriteFrame(client,relay.FrameClose,nil,"udp",65536)
 client.Close()
 waitEmpty(t,e)
}
func waitEmpty(t *testing.T,e *Engine){
 t.Helper()
 until:=time.Now().Add(3*time.Second)
 for time.Now().Before(until){
  if e.Remaining()==0{return}
  time.Sleep(10*time.Millisecond)
 }
 t.Fatalf("Transit connection budget leaked: %d",e.Remaining())
}
func TestPreparedTransitRefusesMissingAuthorization(t *testing.T){
 ca:=newCA(t);a,b,c:=ca.node(t,"node-a"),ca.node(t,"node-b"),ca.node(t,"node-c")
 intent:=sampleIntent("tcp",freeTCP(t),freeTCP(t),a,c)
 raw,_:=json.Marshal(intent)
 if e,err:=Prepare(raw,Identity{b,ca.roots},nil);err==nil{e.Close();t.Fatal("nil authorizer accepted")}
 intent.NodeId="node-a";raw,_=json.Marshal(intent)
 if e,err:=Prepare(raw,Identity{b,ca.roots},func()error{return nil});err==nil{e.Close();t.Fatal("different local Node identity accepted")}
}
func TestTransitRejectsSpoofedOpenAndRevokedGrant(t *testing.T){
 e,id,grant:=newFixture(t,"tcp")
 wrong:=openFor(e,"tcp");wrong.Binding.ToFence++
 if c,err:=connectUpstream(t,e,id,wrong);err==nil{c.Close();t.Fatal("stale fence accepted")}
 good:=openFor(e,"tcp");good.RequestID="fedcba9876543210fedcba9876543210"
 client,err:=connectUpstream(t,e,id,good);if err!=nil{t.Fatal(err)}
 defer client.Close()
 grant.Store(false)
 client.SetReadDeadline(time.Now().Add(2*time.Second))
 if _,err:=client.Read(make([]byte,1));err==nil{t.Fatal("revoked authorization did not close active connection")}
 waitEmpty(t,e)
}

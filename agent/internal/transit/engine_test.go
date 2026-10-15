package transit

import (
 "bytes"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "fmt"
 "math/big"
 "net"
 "net/url"
 "sync/atomic"
 "testing"
 "time"

 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

type caFixture struct{ key *ecdsa.PrivateKey; ca *x509.Certificate; roots *x509.CertPool }
func newCA(t *testing.T)caFixture {
 t.Helper()
 key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 root:=&x509.Certificate{SerialNumber:big.NewInt(1),Subject:pkix.Name{CommonName:"Transit fixture CA"},NotBefore:time.Now().Add(-time.Hour),NotAfter:time.Now().Add(time.Hour),BasicConstraintsValid:true,IsCA:true,KeyUsage:x509.KeyUsageCertSign}
 raw,err:=x509.CreateCertificate(rand.Reader,root,root,&key.PublicKey,key);if err!=nil{t.Fatal(err)}
 cert,err:=x509.ParseCertificate(raw);if err!=nil{t.Fatal(err)}
 roots:=x509.NewCertPool();roots.AddCert(cert);return caFixture{key,cert,roots}
}
func(c caFixture)issue(t *testing.T,node string)tls.Certificate{
 t.Helper()
 key,err:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if err!=nil{t.Fatal(err)}
 uri,_:=url.Parse("urn:tunex:node:"+node)
 serial,err:=rand.Int(rand.Reader,new(big.Int).Lsh(big.NewInt(1),100));if err!=nil{t.Fatal(err)}
 leaf:=&x509.Certificate{SerialNumber:serial,Subject:pkix.Name{CommonName:node},URIs:[]*url.URL{uri},
  NotBefore:time.Now().Add(-time.Minute),NotAfter:time.Now().Add(10*time.Minute),
  KeyUsage:x509.KeyUsageDigitalSignature,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth,x509.ExtKeyUsageClientAuth}}
 raw,err:=x509.CreateCertificate(rand.Reader,leaf,c.ca,&key.PublicKey,c.key);if err!=nil{t.Fatal(err)}
 parsed,err:=x509.ParseCertificate(raw);if err!=nil{t.Fatal(err)}
 return tls.Certificate{Certificate:[][]byte{raw},PrivateKey:key,Leaf:parsed}
}
func freePort(t *testing.T)uint64{
 t.Helper();listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 port:=uint64(listener.Addr().(*net.TCPAddr).Port);listener.Close();return port
}
func intent(t *testing.T,a,b,c tls.Certificate,downstreamPort,localPort uint64,protocol string)transitcontracts.TransitIntent{
 t.Helper()
 return transitcontracts.TransitIntent{
  ContractVersion:1,Role:"relay-transit",Driver:"native.transit.v1",Security:"mutual-tls13",ScopeId:"scope-1",
  ForwardId:"forward-1",ForwardRevision:2,DeploymentGeneration:4,ProfileId:"profile-1",ProfileRevision:1,
  ProfileDigest:"sha256:"+string(bytes.Repeat([]byte("1"),64)),PathDigest:"sha256:"+string(bytes.Repeat([]byte("2"),64)),
  NodeId:"node-b",AssignmentId:"assignment-b",SessionEpoch:8,BindingFence:9,Protocol:protocol,HopIndex:1,HopCount:3,
  Listener:transitcontracts.Listener{Address:"127.0.0.1",Port:localPort,Protocol:"tcp"},
  Upstream:transitcontracts.Neighbor{NodeId:"node-a",AssignmentId:"assignment-a",SessionEpoch:7,BindingFence:8,PeerFingerprint:relay.Fingerprint(a.Leaf)},
  Downstream:transitcontracts.Downstream{NodeId:"node-c",AssignmentId:"assignment-c",SessionEpoch:9,BindingFence:10,PeerFingerprint:relay.Fingerprint(c.Leaf),Endpoint:transitcontracts.Endpoint{Host:"127.0.0.1",Port:downstreamPort}},
  IssuedAt:time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano),
  AuthorizationUntil:time.Now().Add(5*time.Second).UTC().Format(time.RFC3339Nano),
  EgressPolicyRevision:1,AllowedDestinationCidrs:[]string{"127.0.0.0/8"},AllowMetadataTargets:false,MaxConnections:3,
 }
}
func serveDownstream(t *testing.T,ca caFixture,b,c tls.Certificate,protocol string)(net.Listener,chan error){
 t.Helper()
 listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)}
 conf,err:=relay.TLSConfigForProtocol(c,ca.roots,"node-b",[]string{relay.Fingerprint(b.Leaf)},true,hopALPN)
 if err!=nil{t.Fatal(err)}
 outcome:=make(chan error,1)
 go func(){
  raw,err:=listener.Accept();if err!=nil{outcome<-err;return}
  defer raw.Close()
  peer:=tls.Server(raw,conf);defer peer.Close()
  peer.SetDeadline(time.Now().Add(3*time.Second))
  if err:=peer.Handshake();err!=nil{outcome<-err;return}
  var request hopOpen
  if err:=readControl(peer,&request);err!=nil{outcome<-err;return}
  if request.SenderNodeID!="node-b"||request.ReceiverNodeID!="node-c"||request.HopIndex!=2||request.Type!="hop-open"{outcome<-fmt.Errorf("incorrect next-hop binding");return}
  if err:=answerOpen(peer,request);err!=nil{outcome<-err;return}
  peer.SetDeadline(time.Now().Add(3*time.Second))
  for{
   kind,data,err:=relay.ReadFrame(peer,protocol,maxHopFrameBytes)
   if err!=nil{outcome<-err;return}
   if err:=relay.WriteFrame(peer,kind,data,protocol,maxHopFrameBytes);err!=nil{outcome<-err;return}
   if kind==relay.FrameFIN||kind==relay.FrameClose{outcome<-nil;return}
  }
 }()
 return listener,outcome
}
func connectedUpstream(t *testing.T,c caFixture,a,b tls.Certificate,endpoint string)*tls.Conn{
 t.Helper()
 conf,err:=relay.TLSConfigForProtocol(a,c.roots,"node-b",[]string{relay.Fingerprint(b.Leaf)},false,hopALPN);if err!=nil{t.Fatal(err)}
 raw,err:=net.DialTimeout("tcp",endpoint,time.Second);if err!=nil{t.Fatal(err)}
 peer:=tls.Client(raw,conf)
 peer.SetDeadline(time.Now().Add(3*time.Second))
 if err:=peer.Handshake();err!=nil{t.Fatal(err)}
 t.Cleanup(func(){peer.Close()})
 return peer
}
func expectReady(t *testing.T,upstream *tls.Conn,v transitcontracts.TransitIntent){
 t.Helper()
 token,err:=freshRequestID();if err!=nil{t.Fatal(err)}
 open:=buildOpen(v,false,token)
 if err:=writeControl(upstream,open);err!=nil{t.Fatal(err)}
 var ack hopAck
 if err:=readControl(upstream,&ack);err!=nil{t.Fatal("Transit refused valid neighbor",err)}
 digest,err:=digestOpen(open);if err!=nil{t.Fatal(err)}
 if ack.Type!="hop-accepted"||ack.RequestID!=token||ack.BindingDigest!=digest{t.Fatal("wrong hop acceptance",ack)}
}
func TestTransitActualMutualTLSTCPandUDP(t *testing.T){
 for _,protocol:=range []string{"tcp","udp"}{
  t.Run(protocol,func(t *testing.T){
   ca:=newCA(t);a:=ca.issue(t,"node-a");b:=ca.issue(t,"node-b");c:=ca.issue(t,"node-c")
   next,outcome:=serveDownstream(t,ca,b,c,protocol)
   defer next.Close()
   v:=intent(t,a,b,c,uint64(next.Addr().(*net.TCPAddr).Port),freePort(t),protocol)
   e,err:=Prepare(v,relay.Identity{Certificate:b,Roots:ca.roots},func()error{return nil});if err!=nil{t.Fatal(err)}
   defer e.Close()
   if err:=e.Activate();err!=nil{t.Fatal(err)}
   client:=connectedUpstream(t,ca,a,b,e.Address().String())
   expectReady(t,client,v)
   kind:=relay.FrameTCP;if protocol=="udp"{kind=relay.FrameUDP}
   payload:=[]byte("three-node-transit-framed-data")
   if err:=relay.WriteFrame(client,kind,payload,protocol,maxHopFrameBytes);err!=nil{t.Fatal(err)}
   got,data,err:=relay.ReadFrame(client,protocol,maxHopFrameBytes)
   if err!=nil||got!=kind||!bytes.Equal(data,payload){t.Fatalf("frame reply kind=%d err=%v",got,err)}
   doneKind:=relay.FrameFIN;if protocol=="udp"{doneKind=relay.FrameClose}
   if err:=relay.WriteFrame(client,doneKind,nil,protocol,maxHopFrameBytes);err!=nil{t.Fatal(err)}
   if reply,_,err:=relay.ReadFrame(client,protocol,maxHopFrameBytes);err!=nil||reply!=doneKind{t.Fatal("close/FIN response",err)}
   if err:=<-outcome;err!=nil{t.Fatal("downstream",err)}
  })
 }
}
func TestTransitRefusesWrongNodeAndStaleBindingWithoutOpeningDownstream(t *testing.T){
 ca:=newCA(t);a:=ca.issue(t,"node-a");b:=ca.issue(t,"node-b");c:=ca.issue(t,"node-c");bad:=ca.issue(t,"node-d")
 // Downstream never listens; both invalid inputs must be rejected before dial.
 v:=intent(t,a,b,c,freePort(t),freePort(t),"tcp")
 e,err:=Prepare(v,relay.Identity{Certificate:b,Roots:ca.roots},func()error{return nil});if err!=nil{t.Fatal(err)}
 defer e.Close()
 if err:=e.Activate();err!=nil{t.Fatal(err)}
 if _,err:=Prepare(v,relay.Identity{Certificate:bad,Roots:ca.roots},func()error{return nil});err==nil{t.Fatal("wrong local node passed")}
 badClientConf,err:=relay.TLSConfigForProtocol(bad,ca.roots,"node-b",[]string{relay.Fingerprint(b.Leaf)},false,hopALPN);if err!=nil{t.Fatal(err)}
 raw,err:=net.DialTimeout("tcp",e.Address().String(),time.Second);if err!=nil{t.Fatal(err)}
 wrong:=tls.Client(raw,badClientConf)
 wrong.SetDeadline(time.Now().Add(time.Second))
 // TLS handshake might appear successful client-side; the server must reject
 // before any hop-accepted application control frame.
 _=wrong.Handshake()
 _=writeControl(wrong,buildOpen(v,false,"0123456789abcdef0123456789abcdef"))
 var ack hopAck
 if err:=readControl(wrong,&ack);err==nil{t.Fatal("wrong Node got hop acceptance")}
 wrong.Close()
 good:=connectedUpstream(t,ca,a,b,e.Address().String())
 forged:=buildOpen(v,false,"0123456789abcdef0123456789abcdef")
 forged.DeploymentGeneration++
 if err:=writeControl(good,forged);err!=nil{t.Fatal(err)}
 if err:=readControl(good,&ack);err==nil{t.Fatal("stale deployment got hop acceptance")}
}
func TestTransitAuthorizationGateAndBoundedResources(t *testing.T){
 ca:=newCA(t);a:=ca.issue(t,"node-a");b:=ca.issue(t,"node-b");c:=ca.issue(t,"node-c")
 v:=intent(t,a,b,c,freePort(t),freePort(t),"tcp")
 var deny atomic.Bool
 check:=func()error{if deny.Load(){return fmt.Errorf("AUTHORIZATION_DENIED")};return nil}
 e,err:=Prepare(v,relay.Identity{Certificate:b,Roots:ca.roots},check);if err!=nil{t.Fatal(err)}
 if err:=e.Activate();err!=nil{t.Fatal(err)}
 deny.Store(true)
 deadline:=time.Now().Add(2*time.Second)
 for time.Now().Before(deadline){if e.context.Err()!=nil{break};time.Sleep(10*time.Millisecond)}
 if e.context.Err()==nil{t.Fatal("revoked execution retained listener")}
 if err:=e.Activate();err==nil{t.Fatal("revoked execution restarted")}
 e.Close()
 expired:=v;expired.AuthorizationUntil=time.Now().Add(-time.Second).UTC().Format(time.RFC3339Nano)
 if _,err:=Prepare(expired,relay.Identity{Certificate:b,Roots:ca.roots},func()error{return nil});err==nil{t.Fatal("expired hop accepted")}
 if _,err:=Prepare(v,relay.Identity{Certificate:b,Roots:ca.roots},nil);err==nil{t.Fatal("missing Control-authorized gate accepted")}
}
func TestTransitRejectsLegacyRelayALPN(t *testing.T){
 ca:=newCA(t);a:=ca.issue(t,"node-a");b:=ca.issue(t,"node-b");c:=ca.issue(t,"node-c")
 v:=intent(t,a,b,c,freePort(t),freePort(t),"tcp")
 e,err:=Prepare(v,relay.Identity{Certificate:b,Roots:ca.roots},func()error{return nil});if err!=nil{t.Fatal(err)}
 defer e.Close()
 if err:=e.Activate();err!=nil{t.Fatal(err)}
 config,err:=relay.TLSConfig(a,ca.roots,"node-b",[]string{relay.Fingerprint(b.Leaf)},false);if err!=nil{t.Fatal(err)}
 raw,err:=net.DialTimeout("tcp",e.Address().String(),time.Second);if err!=nil{t.Fatal(err)}
 peer:=tls.Client(raw,config);defer peer.Close()
 peer.SetDeadline(time.Now().Add(time.Second))
 if err:=peer.Handshake();err==nil{t.Fatal("legacy ALPN unexpectedly accepted Transit TLS")}
}

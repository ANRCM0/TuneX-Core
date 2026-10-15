package transit

import (
 "context"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "encoding/hex"
 "fmt"
 "net"
 "sync"
 "time"

 "github.com/tunex/vnext/agent/internal/contracts"
 "github.com/tunex/vnext/agent/internal/forward"
 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

// Engine is deliberately NOT registered in the live ADP/3 Runner.
// The externally supplied allow callback must be connected to durable
// deployment/lease/fence authorization before any production cutover.
type Engine struct {
 intent *transitcontracts.TransitIntent
 identity Identity
 allow func()error
 until time.Time
 credentialUntil time.Time
 ctx context.Context
 cancel context.CancelFunc
 mutex sync.Mutex
 listener net.Listener
 active bool
 connections map[net.Conn]net.Conn
 seen map[string]struct{}
 workers sync.WaitGroup
 stopOnce sync.Once
}

func Prepare(raw []byte,identity Identity,allow func()error)(*Engine,error){
 v,err:=transitcontracts.Parse(raw)
 if err!=nil{return nil,err}
 if allow==nil{return nil,fmt.Errorf("AUTHORIZATION_DENIED: Missing Transit runtime authorizer")}
 if err:=allow();err!=nil{return nil,err}
 until,err:=time.Parse(time.RFC3339Nano,v.AuthorizationUntil)
 if err!=nil||!time.Now().Before(until){return nil,fmt.Errorf("LEASE_EXPIRED: Transit grant")}
 issued,err:=time.Parse(time.RFC3339Nano,v.IssuedAt)
 if err!=nil||issued.After(time.Now().Add(time.Minute)){return nil,fmt.Errorf("AUTHORIZATION_DENIED: Future Transit grant")}
 if identity.Roots==nil||len(identity.Certificate.Certificate)==0{
  return nil,fmt.Errorf("AUTHENTICATION_FAILED: Transit peer CA and local identity required")
 }
 leaf:=identity.Certificate.Leaf
 if leaf==nil{
  leaf,err=x509.ParseCertificate(identity.Certificate.Certificate[0])
  if err!=nil{return nil,err}
 }
 if err:=verifyLeaf(leaf,identity.Roots,v.NodeId,relay.Fingerprint(leaf),x509.ExtKeyUsageServerAuth);err!=nil{
  return nil,err
 }
 if !time.Now().Before(leaf.NotAfter){return nil,fmt.Errorf("LEASE_EXPIRED: Local peer identity")}
 ctx,cancel:=context.WithCancel(context.Background())
 e:=&Engine{intent:v,identity:Identity{Certificate:identity.Certificate,Roots:identity.Roots.Clone()},allow:allow,
  until:until,credentialUntil:leaf.NotAfter,ctx:ctx,cancel:cancel,
  connections:map[net.Conn]net.Conn{},seen:map[string]struct{}{}}
 e.workers.Add(1)
 go e.watch()
 return e,nil
}
func (e *Engine) check()error {
 if e.ctx.Err()!=nil||!time.Now().Before(e.until)||!time.Now().Before(e.credentialUntil){
  return fmt.Errorf("LEASE_EXPIRED: Transit")
 }
 return e.allow()
}
func (e *Engine) inboundBinding()Binding {
 v:=e.intent
 return Binding{WireVersion:1,ScopeID:v.ScopeId,ForwardID:v.ForwardId,DeploymentGeneration:v.DeploymentGeneration,
  ProfileDigest:v.ProfileDigest,PathDigest:v.PathDigest,Protocol:v.Protocol,
  FromNodeID:v.Upstream.NodeId,FromAssignmentID:v.Upstream.AssignmentId,FromSessionEpoch:v.Upstream.SessionEpoch,FromFence:v.Upstream.BindingFence,
  ToNodeID:v.NodeId,ToAssignmentID:v.AssignmentId,ToSessionEpoch:v.SessionEpoch,ToFence:v.BindingFence}
}
func (e *Engine) outboundBinding()Binding {
 v:=e.intent
 return Binding{WireVersion:1,ScopeID:v.ScopeId,ForwardID:v.ForwardId,DeploymentGeneration:v.DeploymentGeneration,
  ProfileDigest:v.ProfileDigest,PathDigest:v.PathDigest,Protocol:v.Protocol,
  FromNodeID:v.NodeId,FromAssignmentID:v.AssignmentId,FromSessionEpoch:v.SessionEpoch,FromFence:v.BindingFence,
  ToNodeID:v.Downstream.NodeId,ToAssignmentID:v.Downstream.AssignmentId,ToSessionEpoch:v.Downstream.SessionEpoch,ToFence:v.Downstream.BindingFence}
}
// Activate requires a successful mutually authenticated, bound downstream
// probe BEFORE admitting even the first upstream connection.
func (e *Engine) Activate()error{
 if err:=e.check();err!=nil{return err}
 e.mutex.Lock()
 if e.active {e.mutex.Unlock();return e.check()}
 e.mutex.Unlock()
 peer,err:=e.dial("probe")
 if err!=nil{return err}
 peer.Close()
 if err:=e.check();err!=nil{return err}
 v:=e.intent
 listener,err:=net.Listen("tcp",net.JoinHostPort(v.Listener.Address,fmt.Sprint(v.Listener.Port)))
 if err!=nil{return err}
 if err:=e.check();err!=nil{listener.Close();return err}
 e.mutex.Lock()
 if e.ctx.Err()!=nil||e.active{
  e.mutex.Unlock();listener.Close()
  return fmt.Errorf("STALE_DEPLOYMENT: Transit already active or retired")
 }
 e.listener=listener;e.active=true
 e.workers.Add(1)
 go e.accept()
 e.mutex.Unlock()
 return nil
}
func (e *Engine) Addr()net.Addr{
 e.mutex.Lock();defer e.mutex.Unlock()
 if e.listener==nil{return nil}
 return e.listener.Addr()
}
func (e *Engine) Remaining()int{
 e.mutex.Lock();defer e.mutex.Unlock()
 return len(e.connections)
}
func (e *Engine) watch(){
 defer e.workers.Done()
 ticker:=time.NewTicker(25*time.Millisecond)
 defer ticker.Stop()
 for{
  select {
  case <-e.ctx.Done():return
  case <-ticker.C:
   if e.check()!=nil{e.stop();return}
  }
 }
}
func (e *Engine) Close(){e.stop();e.workers.Wait()}
func (e *Engine) stop(){
 e.stopOnce.Do(func(){
  e.mutex.Lock();defer e.mutex.Unlock()
  e.cancel();e.active=false
  if e.listener!=nil{e.listener.Close()}
  for up,down:=range e.connections {
   up.Close()
   if down!=nil{down.Close()}
  }
 })
}
func (e *Engine) accept(){
 defer e.workers.Done()
 for {
  raw,err:=e.listener.Accept()
  if err!=nil{return}
  e.mutex.Lock()
  if !e.active||e.check()!=nil||len(e.connections)>=int(e.intent.MaxConnections){
   e.mutex.Unlock();raw.Close();continue
  }
  release,err:=forward.AcquireNodeBudget(e.intent.Protocol)
  if err!=nil{e.mutex.Unlock();raw.Close();continue}
  e.connections[raw]=nil
  e.workers.Add(1)
  e.mutex.Unlock()
  go func(){
   defer e.workers.Done()
   defer release()
   defer func(){raw.Close();e.mutex.Lock();delete(e.connections,raw);e.mutex.Unlock()}()
   e.serve(raw)
  }()
 }
}
func (e *Engine) serve(raw net.Conn){
 v:=e.intent
 cfg,err:=tlsConfig(e.identity,v.Upstream.NodeId,v.Upstream.PeerFingerprint,true)
 if err!=nil{return}
 upstream:=tls.Server(raw,cfg)
 upstream.SetDeadline(time.Now().Add(3*time.Second))
 if err=upstream.HandshakeContext(e.ctx);err!=nil{return}
 var open Open
 if err=readMessage(upstream,&open);err!=nil{return}
 if err=expectedInbound(e.inboundBinding(),open);err!=nil{return}
 e.mutex.Lock()
 if len(e.seen)>=8192{e.mutex.Unlock();return}
 if _,exists:=e.seen[v.Upstream.NodeId+":"+open.RequestID];exists{e.mutex.Unlock();return}
 e.seen[v.Upstream.NodeId+":"+open.RequestID]=struct{}{}
 e.mutex.Unlock()
 if e.check()!=nil{return}
 if open.Action=="probe"{
  // The Transit itself is not ready until Activate downstream probe succeeds.
  e.mutex.Lock();ready:=e.active;e.mutex.Unlock()
  if !ready{return}
  digest,_:=bindingDigest(e.inboundBinding())
  writeMessage(upstream,Reply{Type:"accepted",RequestID:open.RequestID,BindingDigest:digest})
  return
 }
 downstream,err:=e.dial(open.Action)
 if err!=nil{return}
 defer downstream.Close()
 e.mutex.Lock();e.connections[raw]=downstream;e.mutex.Unlock()
 if e.check()!=nil{return}
 digest,_:=bindingDigest(e.inboundBinding())
 if err=writeMessage(upstream,Reply{Type:"accepted",RequestID:open.RequestID,BindingDigest:digest});err!=nil{return}
 upstream.SetDeadline(time.Time{})
 e.pipe(upstream,downstream)
}

func (e *Engine) dial(action string)(*tls.Conn,error){
 if err:=e.check();err!=nil{return nil,err}
 v:=e.intent
 ctx,cancel:=context.WithTimeout(e.ctx,3*time.Second)
 defer cancel()
 addresses,err:=net.DefaultResolver.LookupNetIP(ctx,"ip",v.Downstream.Endpoint.Host)
 if err!=nil{return nil,err}
 var raw net.Conn
 policy:=contracts.DirectConfig{AllowedDestinationCidrs:v.AllowedDestinationCidrs,AllowMetadataTargets:v.AllowMetadataTargets}
 for _,a:=range addresses{
  if e.check()!=nil{return nil,fmt.Errorf("LEASE_EXPIRED")}
  if !forward.Allowed(a,policy){continue}
  raw,err=(&net.Dialer{Timeout:2*time.Second}).DialContext(ctx,"tcp",net.JoinHostPort(a.Unmap().String(),fmt.Sprint(v.Downstream.Endpoint.Port)))
  if err==nil{break}
 }
 if raw==nil{return nil,fmt.Errorf("DOWNSTREAM_UNAVAILABLE: No authorized reachable Transit neighbor")}
 cfg,err:=tlsConfig(e.identity,v.Downstream.NodeId,v.Downstream.PeerFingerprint,false)
 if err!=nil{raw.Close();return nil,err}
 client:=tls.Client(raw,cfg)
 client.SetDeadline(time.Now().Add(3*time.Second))
 if err=client.HandshakeContext(ctx);err!=nil{client.Close();return nil,err}
 var request [16]byte
 if _,err=rand.Read(request[:]);err!=nil{client.Close();return nil,err}
 requestID:=hex.EncodeToString(request[:])
 binding:=e.outboundBinding()
 if err=writeMessage(client,Open{Type:"open",Action:action,RequestID:requestID,Binding:binding});err!=nil{client.Close();return nil,err}
 var reply Reply
 if err=readMessage(client,&reply);err!=nil{client.Close();return nil,err}
 digest,_:=bindingDigest(binding)
 if err=validateReply(reply,requestID,digest);err!=nil{client.Close();return nil,err}
 if err=e.check();err!=nil{client.Close();return nil,err}
 client.SetDeadline(time.Time{})
 return client,nil
}
func (e *Engine) pipe(up,down *tls.Conn){
 result:=make(chan error,2)
 pump:=func(from,to *tls.Conn){
  for {
   if err:=e.check();err!=nil{result<-err;return}
   from.SetReadDeadline(time.Now().Add(15*time.Second))
   kind,payload,err:=relay.ReadFrame(from,e.intent.Protocol,65536)
   if err!=nil{result<-err;return}
   if e.intent.Protocol=="udp"&&len(payload)>16384{result<-fmt.Errorf("RESOURCE_LIMIT: UDP datagram");return}
   if err=e.check();err!=nil{result<-err;return}
   to.SetWriteDeadline(time.Now().Add(3*time.Second))
   if err=relay.WriteFrame(to,kind,payload,e.intent.Protocol,65536);err!=nil{result<-err;return}
   if kind==relay.FrameFIN||kind==relay.FrameClose{result<-nil;return}
  }
 }
 go pump(up,down);go pump(down,up)
 first:=<-result
 if first!=nil{up.Close();down.Close();<-result;return}
 second:=<-result
 if second!=nil{up.Close();down.Close()}
}
// This engine has no production ADP/3 registration, no runtime-owned socket
// reservations and no durable rollback. Those must precede Runner activation.

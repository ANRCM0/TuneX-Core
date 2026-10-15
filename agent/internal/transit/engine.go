package transit

import (
 "context"
 "crypto/tls"
 "crypto/x509"
 "encoding/json"
 "fmt"
 "net"
 "net/netip"
 "strconv"
 "sync"
 "time"

 "github.com/tunex/vnext/agent/internal/forward"
 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

// Permission must be supplied by a *future* authenticated Runtime: offline
// TransitIntent parsing alone never grants authority to open a listener.
type Permission func(*transitcontracts.TransitIntent) error
// EndpointAllowed approves the resolved physical downstream hop IP. This is
// deliberately independent from the final target CIDRs in the Transit intent.
type EndpointAllowed func(netip.Addr) bool
type Identity struct{Certificate tls.Certificate; Roots *x509.CertPool}
type Options struct{HandshakeTimeout time.Duration; MaxFrameBytes int; EndpointAllowed EndpointAllowed}

// Engine is intentionally not integrated with Runner/ADP3. Only explicit
// permit-gated experimental tests may Prepare it; no production capabilities
// or Snapshot role are exposed.
type Engine struct {
 intent transitcontracts.TransitIntent
 identity Identity
 allow func()error
 approve EndpointAllowed
 handshake time.Duration
 frameMaximum int
 credentialUntil time.Time
 authorizedUntil time.Time
 listener net.Listener
 ctx context.Context
 cancel context.CancelFunc
 mutex sync.Mutex
 active bool
 draining bool
 conns map[net.Conn]net.Conn
 workers sync.WaitGroup
 watcherDone chan struct{}
 stopOnce sync.Once
}

// Prepare validates a fresh, trusted authorization decision before binding a
// physical port. It does not accept a naked TransitIntent as authority.
func Prepare(raw []byte,identity Identity,permit Permission,allow func()error,option Options)(*Engine,error){
 if permit==nil||allow==nil||option.EndpointAllowed==nil{return nil,fmt.Errorf("AUTHORIZATION_DENIED: Transit requires Runtime permit and endpoint policy")}
 v,err:=transitcontracts.Parse(raw);if err!=nil{return nil,err}
 if option.HandshakeTimeout<100*time.Millisecond||option.HandshakeTimeout>15*time.Second||option.MaxFrameBytes<64||option.MaxFrameBytes>65536{return nil,fmt.Errorf("INVALID_CONFIG: Bounded Transit timeouts and frames required")}
 if err:=permit(v);err!=nil{return nil,err}
 if err:=allow();err!=nil{return nil,err}
 localUntil,err:=verifyLocalIdentity(identity.Certificate,identity.Roots,v.NodeId);if err!=nil{return nil,err}
 authorizedUntil,err:=time.Parse(time.RFC3339Nano,v.AuthorizationUntil);if err!=nil{return nil,err}
 issuedAt,err:=time.Parse(time.RFC3339Nano,v.IssuedAt);if err!=nil{return nil,err}
 if !issuedAt.Before(authorizedUntil)||!time.Now().Before(authorizedUntil){return nil,fmt.Errorf("LEASE_EXPIRED: Transit authorization expired")}
 if v.Protocol!="tcp"&&v.Protocol!="udp"{return nil,fmt.Errorf("UNSUPPORTED_CAPABILITY")}
 if _,err:=peerConfig(identity.Certificate,identity.Roots,v.Upstream.NodeId,v.Upstream.PeerFingerprint,true);err!=nil{return nil,err}
 if _,err:=peerConfig(identity.Certificate,identity.Roots,v.Downstream.NodeId,v.Downstream.PeerFingerprint,false);err!=nil{return nil,err}
 // Copy the externally supplied identity references; do not retain caller's
 // mutable slices or an untrusted CA pool.
 cloned:=identity;cloned.Roots=identity.Roots.Clone()
 ctx,cancel:=context.WithCancel(context.Background())
 e:=&Engine{intent:*v,identity:cloned,allow:allow,approve:option.EndpointAllowed,handshake:option.HandshakeTimeout,
 frameMaximum:option.MaxFrameBytes,credentialUntil:localUntil,authorizedUntil:authorizedUntil,ctx:ctx,cancel:cancel,
 conns:map[net.Conn]net.Conn{},watcherDone:make(chan struct{})}
 address:=net.JoinHostPort(v.Listener.Address,strconv.FormatUint(v.Listener.Port,10))
 listener,err:=net.Listen("tcp",address)
 if err!=nil{cancel();return nil,err}
 e.listener=listener
 if err:=e.check();err!=nil{listener.Close();cancel();return nil,err}
 e.workers.Add(1);go e.accept()
 go e.watch()
 return e,nil
}
func(e *Engine) check()error{
 if e.ctx.Err()!=nil||!time.Now().Before(e.authorizedUntil)||!time.Now().Before(e.credentialUntil){return fmt.Errorf("LEASE_EXPIRED")}
 return e.allow()
}
func(e *Engine) ready()bool{
 e.mutex.Lock();defer e.mutex.Unlock()
 return e.active&&!e.draining&&e.ctx.Err()==nil
}
func(e *Engine) Addr()net.Addr{return e.listener.Addr()}
func(e *Engine) Remaining()int{e.mutex.Lock();defer e.mutex.Unlock();return len(e.conns)}
func(e *Engine) Activate()error{
 if err:=e.check();err!=nil{return err}
 peer,err:=e.dialDownstream("probe")
 if err!=nil{return err}
 closeConn(peer)
 e.mutex.Lock();defer e.mutex.Unlock()
 if e.draining||e.ctx.Err()!=nil{return fmt.Errorf("LEASE_EXPIRED")}
 if err:=e.check();err!=nil{return err}
 e.active=true
 return nil
}
// Drain refuses new paths immediately. Existing sessions end at the earlier
// of their lease/certificate expiry or explicit Close; graceful draining will
// require a separately authorized deadline in a later ADP/3 assignment.
func(e *Engine) Drain(){
 e.mutex.Lock();e.draining=true;e.active=false;e.mutex.Unlock()
 e.listener.Close()
}
func(e *Engine) Close(){e.stop();e.workers.Wait();<-e.watcherDone}
func(e *Engine) stop(){
 e.stopOnce.Do(func(){
  e.cancel()
  e.listener.Close()
  e.mutex.Lock()
  e.active=false;e.draining=true
  for upstream,downstream:=range e.conns{closeConn(upstream);if downstream!=nil{closeConn(downstream)}}
  e.mutex.Unlock()
 })
}
func(e *Engine) watch(){
 defer close(e.watcherDone)
 ticker:=time.NewTicker(50*time.Millisecond);defer ticker.Stop()
 for {
  select{
   case <-e.ctx.Done():return
   case <-ticker.C:if e.check()!=nil{e.stop();return}
  }
 }
}
func(e *Engine) accept(){
 defer e.workers.Done()
 for {
  raw,err:=e.listener.Accept();if err!=nil{return}
  e.mutex.Lock()
  if !e.active||e.draining||e.ctx.Err()!=nil||len(e.conns)>=int(e.intent.MaxConnections){
   e.mutex.Unlock();raw.Close();continue
  }
  // Share the existing process-wide TCP / UDP budgets with Direct and Relay.
  releaseTCP,err:=forward.AcquireNodeBudget("tcp")
  if err!=nil{e.mutex.Unlock();raw.Close();continue}
  releaseUDP:=func(){}
  if e.intent.Protocol=="udp"{
   releaseUDP,err=forward.AcquireNodeBudget("udp")
   if err!=nil{releaseTCP();e.mutex.Unlock();raw.Close();continue}
  }
  e.conns[raw]=nil
  e.workers.Add(1)
  e.mutex.Unlock()
  go func(raw net.Conn,releaseTCP,releaseUDP func()){
   defer e.workers.Done()
   defer releaseTCP();defer releaseUDP()
   defer func(){closeConn(raw);e.mutex.Lock();delete(e.conns,raw);e.mutex.Unlock()}()
   e.serve(raw)
  }(raw,releaseTCP,releaseUDP)
 }
}
func(e *Engine) serve(raw net.Conn){
 tlsConfig,err:=peerConfig(e.identity.Certificate,e.identity.Roots,e.intent.Upstream.NodeId,e.intent.Upstream.PeerFingerprint,true)
 if err!=nil{return}
 upstream:=tls.Server(raw,tlsConfig)
 upstream.SetDeadline(time.Now().Add(e.handshake))
 if err:=upstream.HandshakeContext(e.ctx);err!=nil{return}
 var open Open
 if err:=readControl(upstream,&open);err!=nil{return}
 if err:=ValidateOpen(open,UpstreamBinding(e.intent),e.ready(),e.check);err!=nil{
  _=writeRejected(upstream,open,"AUTHORIZATION_DENIED");return
 }
 downstream,err:=e.dialDownstream(open.Action)
 if err!=nil{_ = writeRejected(upstream,open,"DOWNSTREAM_UNAVAILABLE");return}
 defer closeConn(downstream)
 e.mutex.Lock()
 if e.ctx.Err()!=nil||e.draining{e.mutex.Unlock();return}
 e.conns[raw]=downstream
 e.mutex.Unlock()
 if err:=e.check();err!=nil{return}
 if err:=writeAccepted(upstream,open);err!=nil{return}
 if open.Action=="probe"{return}
 upstream.SetDeadline(time.Time{})
 e.bridge(upstream,downstream)
}
func(e *Engine) dialDownstream(action string)(*tls.Conn,error){
 if err:=e.check();err!=nil{return nil,err}
 if action!="probe"&&action!=e.intent.Protocol{return nil,fmt.Errorf("UNSUPPORTED_CAPABILITY")}
 config,err:=peerConfig(e.identity.Certificate,e.identity.Roots,e.intent.Downstream.NodeId,e.intent.Downstream.PeerFingerprint,false)
 if err!=nil{return nil,err}
 ctx,cancel:=context.WithTimeout(e.ctx,e.handshake);defer cancel()
 addresses,err:=net.DefaultResolver.LookupNetIP(ctx,"ip",e.intent.Downstream.Endpoint.Host)
 if err!=nil{return nil,fmt.Errorf("DOWNSTREAM_UNAVAILABLE: DNS resolution")}
 var last error
 for _,address:=range addresses{
  address=address.Unmap()
  if !address.IsValid()||address.IsUnspecified()||address.IsMulticast()||!e.approve(address){continue}
  socket,err:=(&net.Dialer{}).DialContext(ctx,"tcp",net.JoinHostPort(address.String(),strconv.FormatUint(e.intent.Downstream.Endpoint.Port,10)))
  if err!=nil{last=err;continue}
  conn:=tls.Client(socket,config)
  conn.SetDeadline(time.Now().Add(e.handshake))
  if err:=conn.HandshakeContext(ctx);err!=nil{closeConn(conn);last=err;continue}
  open,err:=MakeOpen(action,DownstreamBinding(e.intent))
  if err==nil{err=writeControl(conn,open)}
  if err==nil{err=readAccepted(conn,open)}
  if err==nil{err=e.check()}
  if err!=nil{closeConn(conn);last=err;continue}
  conn.SetDeadline(time.Time{})
  return conn,nil
 }
 if last==nil{return nil,fmt.Errorf("AUTHORIZATION_DENIED: Downstream endpoint IP refused")}
 return nil,fmt.Errorf("DOWNSTREAM_UNAVAILABLE: Peer authentication/open failed: %w",last)
}
func(e *Engine) peerAllow(peer *tls.Conn)error{
 if err:=e.check();err!=nil{return err}
 for _,cert:=range peer.ConnectionState().PeerCertificates{if !time.Now().Before(cert.NotAfter){return fmt.Errorf("AUTHENTICATION_FAILED: Peer certificate expired")}}
 return nil
}
func(e *Engine) pump(src,dst *tls.Conn)error{
 for {
  if err:=e.peerAllow(src);err!=nil{return err}
  if err:=e.peerAllow(dst);err!=nil{return err}
  kind,payload,err:=relay.ReadFrame(src,e.intent.Protocol,e.frameMaximum)
  if err!=nil{return err}
  if err=ValidateFrame(kind,e.intent.Protocol);err!=nil{return err}
  if err=e.peerAllow(src);err!=nil{return err}
  if err=e.peerAllow(dst);err!=nil{return err}
  if err=relay.WriteFrame(dst,kind,payload,e.intent.Protocol,e.frameMaximum);err!=nil{return err}
  if kind==relay.FrameClose{return fmt.Errorf("TRANSIT_PEER_CLOSED")}
  if kind==relay.FrameFIN{return nil}
 }
}
func(e *Engine) bridge(upstream,downstream *tls.Conn){
 outbound:=make(chan error,1)
 inbound:=make(chan error,1)
 go func(){outbound<-e.pump(upstream,downstream)}()
 go func(){inbound<-e.pump(downstream,upstream)}()
 for i:=0;i<2;i++ {
  select {
  case err:=<-outbound:if err!=nil{closeConn(upstream);closeConn(downstream)}
  case err:=<-inbound:if err!=nil{closeConn(upstream);closeConn(downstream)}
  case <-e.ctx.Done():closeConn(upstream);closeConn(downstream);return
  }
 }
}
func closeConn(conn net.Conn){
 if conn==nil{return}
 if secured,ok:=conn.(*tls.Conn);ok{secured.NetConn().Close();return}
 conn.Close()
}
// OfflineIntentionJSON lets tests explicitly provide raw schema validation
// without ever converting a Transit proposal into an existing ADP/3 Snapshot.
func OfflineIntentionJSON(intent transitcontracts.TransitIntent)([]byte,error){return json.Marshal(intent)}

// Package transit provides a separately gated, non-registered native Transit
// prototype. Nothing in control.Runner advertises or activates this driver.
// A Control-authorized ADP/3 Transit deployment remains a future requirement.
package transit

import (
 "bytes"
 "context"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "encoding/binary"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "io"
 "net"
 "sync"
 "time"

 "github.com/tunex/vnext/agent/internal/contracts"
 "github.com/tunex/vnext/agent/internal/forward"
 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

const maxHopControlBytes=4096
const maxHopFrameBytes=16384
const hopHandshakeTimeout=3*time.Second
const hopALPN="tunex-transit/1" // Versioned, non-downgradeable hop protocol.

// hopOpen binds both ends of ONE hop, not an unrestricted TLS tunnel.
type hopOpen struct {
 Version int `json:"version"`
 Type string `json:"type"`
 RequestID string `json:"requestId"`
 ScopeID string `json:"scopeId"`
 ForwardID string `json:"forwardId"`
 ForwardRevision uint64 `json:"forwardRevision"`
 DeploymentGeneration uint64 `json:"deploymentGeneration"`
 PathDigest string `json:"pathDigest"`
 ProfileDigest string `json:"profileDigest"`
 Protocol string `json:"protocol"`
 HopIndex uint64 `json:"hopIndex"`
 SenderNodeID string `json:"senderNodeId"`
 SenderAssignmentID string `json:"senderAssignmentId"`
 SenderSessionEpoch uint64 `json:"senderSessionEpoch"`
 SenderFence uint64 `json:"senderFence"`
 ReceiverNodeID string `json:"receiverNodeId"`
 ReceiverAssignmentID string `json:"receiverAssignmentId"`
 ReceiverSessionEpoch uint64 `json:"receiverSessionEpoch"`
 ReceiverFence uint64 `json:"receiverFence"`
}
type hopAck struct {
 Version int `json:"version"`
 Type string `json:"type"`
 RequestID string `json:"requestId"`
 BindingDigest string `json:"bindingDigest"`
}

func writeControl(c net.Conn, value any) error {
 raw,err:=json.Marshal(value);if err!=nil{return err}
 if len(raw)>maxHopControlBytes{return fmt.Errorf("RESOURCE_LIMIT: Transit handshake too large")}
 header:=make([]byte,4);binary.BigEndian.PutUint32(header,uint32(len(raw)))
 if err:=writeAll(c,header);err!=nil{return err}
 return writeAll(c,raw)
}
func readControl(c net.Conn, dest any) error {
 var head [4]byte
 if _,err:=io.ReadFull(c,head[:]);err!=nil{return err}
 size:=binary.BigEndian.Uint32(head[:]);if size<2||size>maxHopControlBytes{return fmt.Errorf("RESOURCE_LIMIT: Transit handshake size refused")}
 raw:=make([]byte,size);if _,err:=io.ReadFull(c,raw);err!=nil{return err}
 if _,err:=contracts.ParseJSON(raw,maxHopControlBytes);err!=nil{return err}
 dec:=json.NewDecoder(bytes.NewReader(raw));dec.DisallowUnknownFields()
 if err:=dec.Decode(dest);err!=nil{return err}
 // The message is exactly one strict JSON object, not trailing data.
 if dec.Decode(new(any))!=io.EOF{return fmt.Errorf("INVALID_CONFIG: Trailing Transit message")}
 return nil
}

// No legacy Relay/1 control message parser is used on this protocol.
func writeAll(out io.Writer,raw []byte)error{
 for len(raw)>0{n,err:=out.Write(raw);if err!=nil{return err};if n<=0{return io.ErrShortWrite};raw=raw[n:]}
 return nil
}

func buildOpen(v transitcontracts.TransitIntent, outgoing bool, requestID string) hopOpen {
 p:=hopOpen{Version:1,Type:"hop-open",RequestID:requestID,ScopeID:v.ScopeId,ForwardID:v.ForwardId,
  ForwardRevision:v.ForwardRevision,DeploymentGeneration:v.DeploymentGeneration,PathDigest:v.PathDigest,ProfileDigest:v.ProfileDigest,Protocol:v.Protocol}
 if outgoing {
  p.HopIndex=v.HopIndex+1
  p.SenderNodeID=v.NodeId;p.SenderAssignmentID=v.AssignmentId;p.SenderSessionEpoch=v.SessionEpoch;p.SenderFence=v.BindingFence
  p.ReceiverNodeID=v.Downstream.NodeId;p.ReceiverAssignmentID=v.Downstream.AssignmentId;p.ReceiverSessionEpoch=v.Downstream.SessionEpoch;p.ReceiverFence=v.Downstream.BindingFence
 } else {
  p.HopIndex=v.HopIndex
  p.SenderNodeID=v.Upstream.NodeId;p.SenderAssignmentID=v.Upstream.AssignmentId;p.SenderSessionEpoch=v.Upstream.SessionEpoch;p.SenderFence=v.Upstream.BindingFence
  p.ReceiverNodeID=v.NodeId;p.ReceiverAssignmentID=v.AssignmentId;p.ReceiverSessionEpoch=v.SessionEpoch;p.ReceiverFence=v.BindingFence
 }
 return p
}
func freshRequestID()(string,error){var token [16]byte;if _,err:=rand.Read(token[:]);err!=nil{return "",err};return hex.EncodeToString(token[:]),nil}
func verifyOpen(got,want hopOpen)error{
 if got.Version!=1||got.Type!="hop-open"||len(got.RequestID)!=32{return fmt.Errorf("INVALID_CONFIG: Unknown Transit hop request")}
 if _,err:=hex.DecodeString(got.RequestID);err!=nil{return fmt.Errorf("INVALID_CONFIG: Malformed Transit request ID")}
 want.RequestID=got.RequestID
 if got!=want{return fmt.Errorf("STALE_DEPLOYMENT: Neighbor/hop binding mismatch")}
 return nil
}
func digestOpen(open hopOpen)(string,error){return contracts.ComputeDigest(open)}
func answerOpen(c net.Conn,open hopOpen)error{hash,err:=digestOpen(open);if err!=nil{return err};return writeControl(c,hopAck{Version:1,Type:"hop-accepted",RequestID:open.RequestID,BindingDigest:hash})}

// Engine is NOT linked to the production Runner; activating it requires a trusted
// caller with already-verified Control provenance, Agent Journal and physical fences.
type Engine struct {
 intent transitcontracts.TransitIntent
 identity relay.Identity
 authorized func() error
 until time.Time
 context context.Context
 cancel context.CancelFunc
 mu sync.Mutex
 active bool
 stopping bool
 listener net.Listener
 live map[net.Conn]net.Conn
 permits chan struct{}
 workers sync.WaitGroup
 monitorDone chan struct{}
}
func Prepare(intent transitcontracts.TransitIntent,identity relay.Identity,authorized func()error)(*Engine,error){
 raw,err:=json.Marshal(intent);if err!=nil{return nil,err}
 checked,err:=transitcontracts.Parse(raw);if err!=nil{return nil,err}
 if authorized==nil||identity.Roots==nil{return nil,fmt.Errorf("AUTHORIZATION_DENIED: Trusted authorization and CA required")}
 if err:=authorized();err!=nil{return nil,err}
 until,err:=time.Parse(time.RFC3339Nano,checked.AuthorizationUntil);if err!=nil||!time.Now().Before(until){return nil,fmt.Errorf("LEASE_EXPIRED")}
 leaf:=identity.Certificate.Leaf
 if leaf==nil&&len(identity.Certificate.Certificate)>0{leaf,err=x509.ParseCertificate(identity.Certificate.Certificate[0]);if err!=nil{return nil,err}}
 if leaf==nil||len(leaf.URIs)!=1||leaf.URIs[0].String()!="urn:tunex:node:"+checked.NodeId||!time.Now().Before(leaf.NotAfter){
  return nil,fmt.Errorf("AUTHENTICATION_FAILED: Exact local Node certificate required")
 }
 // Validate the entire leaf chain, URI, fingerprint, TLS purposes, and expiry
 // through the same security policy used by existing two-node Relay.
 self:=tls.ConnectionState{Version:tls.VersionTLS13,NegotiatedProtocol:hopALPN,PeerCertificates:[]*x509.Certificate{leaf}}
 if err:=relay.VerifyPeerForProtocol(self,identity.Roots,checked.NodeId,[]string{relay.Fingerprint(leaf)},x509.ExtKeyUsageServerAuth,time.Now(),hopALPN);err!=nil{return nil,err}
 if leaf.NotAfter.Before(until){until=leaf.NotAfter}
 ctx,cancel:=context.WithCancel(context.Background())
 e:=&Engine{intent:*checked,identity:relay.Identity{Certificate:identity.Certificate,Roots:identity.Roots.Clone()},authorized:authorized,
  until:until,context:ctx,cancel:cancel,live:make(map[net.Conn]net.Conn),permits:make(chan struct{},int(checked.MaxConnections)),monitorDone:make(chan struct{})}
 go e.watch()
 return e,nil
}
func(e *Engine)check()error{
 if e.context.Err()!=nil||!time.Now().Before(e.until){return fmt.Errorf("LEASE_EXPIRED")}
 return e.authorized()
}
func(e *Engine)watch(){
 defer close(e.monitorDone)
 tick:=time.NewTicker(25*time.Millisecond);defer tick.Stop()
 for{select{case <-e.context.Done():return;case <-tick.C:if e.check()!=nil{e.stop();return}}}
}
func(e *Engine)stop(){
 e.mu.Lock();defer e.mu.Unlock()
 if e.stopping{return};e.stopping=true;e.active=false;e.cancel()
 if e.listener!=nil{e.listener.Close()}
 for upstream,downstream:=range e.live {upstream.Close();if downstream!=nil{downstream.Close()}}
}
func(e *Engine)Close(){e.stop();e.workers.Wait();<-e.monitorDone}
func(e *Engine)ActiveConnections()int{e.mu.Lock();defer e.mu.Unlock();return len(e.live)}
func(e *Engine)Address()net.Addr{e.mu.Lock();defer e.mu.Unlock();if e.listener==nil{return nil};return e.listener.Addr()}

// Activate binds only after the caller explicitly opts into this prototype.
// It does not make this module a supported ADP/3 driver or advertise a capability.
func(e *Engine)Activate()error{
 if err:=e.check();err!=nil{return err}
 e.mu.Lock();defer e.mu.Unlock()
 if e.stopping{return fmt.Errorf("LEASE_EXPIRED")}
 if e.active{return nil}
 l,err:=net.Listen("tcp",net.JoinHostPort(e.intent.Listener.Address,fmt.Sprint(e.intent.Listener.Port)))
 if err!=nil{return err}
 if err:=e.check();err!=nil{l.Close();return err}
 e.listener=l;e.active=true
 e.workers.Add(1);go e.accept(l)
 return nil
}
func(e *Engine)accept(listener net.Listener){
 defer e.workers.Done()
 for{
  raw,err:=listener.Accept();if err!=nil{return}
  e.mu.Lock()
  allowed:=e.active&&!e.stopping&&len(e.live)<cap(e.permits)
  if allowed{e.live[raw]=nil;e.workers.Add(1)}
  e.mu.Unlock()
  if !allowed{raw.Close();continue}
  go func(){
   defer e.workers.Done()
   defer func(){raw.Close();e.mu.Lock();delete(e.live,raw);e.mu.Unlock()}()
   if err:=e.check();err!=nil{return}
   select{case e.permits<-struct{}{}:defer func(){<-e.permits}();default:return}
   release,err:=forward.AcquireNodeBudget(e.intent.Protocol);if err!=nil{return};defer release()
   e.serve(raw)
  }()
 }
}
func(e *Engine)serve(raw net.Conn){
 v:=e.intent
 conf,err:=relay.TLSConfigForProtocol(e.identity.Certificate,e.identity.Roots,v.Upstream.NodeId,[]string{v.Upstream.PeerFingerprint},true,hopALPN);if err!=nil{return}
 upstream:=tls.Server(raw,conf)
 upstream.SetDeadline(time.Now().Add(hopHandshakeTimeout))
 if err:=upstream.HandshakeContext(e.context);err!=nil{return}
 var incoming hopOpen
 if err:=readControl(upstream,&incoming);err!=nil{return}
 if err:=verifyOpen(incoming,buildOpen(v,false,""));err!=nil{return}
 if err:=e.check();err!=nil{return}
 downstream,err:=e.dialDownstream()
 if err!=nil{return}
 defer downstream.Close()
 e.mu.Lock();if e.stopping {e.mu.Unlock();return};e.live[raw]=downstream;e.mu.Unlock()
 if err:=answerOpen(upstream,incoming);err!=nil{return}
 upstream.SetDeadline(time.Time{})
 cutoff:=e.until
 // Peer certificates do not renew the authority of already-opened flows.
 // Terminate at the earliest local lease, upstream leaf or downstream leaf expiry.
 for _,peer:=range []*tls.Conn{upstream,downstream}{
  certs:=peer.ConnectionState().PeerCertificates
  if len(certs)==0{return}
  cutoff=minTime(cutoff,certs[0].NotAfter)
 }
 e.bridge(upstream,downstream,cutoff)
}
func(e *Engine)dialDownstream()(*tls.Conn,error){
 v:=e.intent
 ctx,cancel:=context.WithTimeout(e.context,hopHandshakeTimeout);defer cancel()
 addresses,err:=net.DefaultResolver.LookupNetIP(ctx,"ip",v.Downstream.Endpoint.Host);if err!=nil{return nil,err}
 conf,err:=relay.TLSConfigForProtocol(e.identity.Certificate,e.identity.Roots,v.Downstream.NodeId,[]string{v.Downstream.PeerFingerprint},false,hopALPN)
 if err!=nil{return nil,err}
 policy:=contracts.DirectConfig{AllowedDestinationCidrs:v.AllowedDestinationCidrs,AllowMetadataTargets:v.AllowMetadataTargets}
 for _,address:=range addresses{
  if !forward.Allowed(address,policy){continue}
  raw,err:=(&net.Dialer{}).DialContext(ctx,"tcp",net.JoinHostPort(address.Unmap().String(),fmt.Sprint(v.Downstream.Endpoint.Port)))
  if err!=nil{continue}
  peer:=tls.Client(raw,conf);peer.SetDeadline(time.Now().Add(hopHandshakeTimeout))
  if err:=peer.HandshakeContext(ctx);err!=nil{peer.Close();continue}
  token,err:=freshRequestID();if err!=nil{peer.Close();return nil,err}
  request:=buildOpen(v,true,token)
  if err:=writeControl(peer,request);err!=nil{peer.Close();continue}
  var ack hopAck
  if err:=readControl(peer,&ack);err!=nil{peer.Close();continue}
  expected,err:=digestOpen(request)
  if err!=nil||ack.Version!=1||ack.Type!="hop-accepted"||ack.RequestID!=token||ack.BindingDigest!=expected {peer.Close();continue}
  if err:=e.check();err!=nil{peer.Close();return nil,err}
  peer.SetDeadline(time.Time{})
  return peer,nil
 }
 return nil,fmt.Errorf("DOWNSTREAM_UNAVAILABLE: Authenticated next hop refused")
}
// bridge preserves TCP FIN semantics and UDP datagram boundaries. There is no
// cross-client multiplexing: one upstream connection gets one downstream
// authenticated connection and an independent Agent-wide resource permit.
func(e *Engine)bridge(upstream,downstream *tls.Conn,cutoff time.Time){
 done:=make(chan error,2)
 pump:=func(in,out *tls.Conn){
  for{
   if err:=e.check();err!=nil{done<-err;return}
   if !time.Now().Before(cutoff){done<-fmt.Errorf("LEASE_EXPIRED: Peer credential expired");return}
   in.SetReadDeadline(cutoff)
   kind,data,err:=relay.ReadFrame(in,e.intent.Protocol,maxHopFrameBytes)
   if err!=nil{done<-err;return}
   if kind==relay.FrameUDP&&len(data)>maxHopFrameBytes{done<-fmt.Errorf("RESOURCE_LIMIT");return}
   if err:=e.check();err!=nil{done<-err;return}
   out.SetWriteDeadline(minTime(time.Now().Add(hopHandshakeTimeout),cutoff))
   if err:=relay.WriteFrame(out,kind,data,e.intent.Protocol,maxHopFrameBytes);err!=nil{done<-err;return}
   if kind==relay.FrameFIN&&e.intent.Protocol=="tcp"{done<-nil;return}
   if kind==relay.FrameClose{done<-nil;return}
  }
 }
 go pump(upstream,downstream)
 go pump(downstream,upstream)
 first:=<-done
 if first!=nil{upstream.Close();downstream.Close()} // Normal TCP FIN/UDP Close must preserve reverse-direction completion
 <-done
 upstream.Close();downstream.Close()
}
func minTime(a,b time.Time)time.Time{if a.Before(b){return a};return b}

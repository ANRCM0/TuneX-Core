// Package transit contains an isolated, opt-in experimental per-hop TLS data
// plane. Runner deliberately does NOT import this package or accept its intents.
package transit

import (
 "bytes"
 "crypto/rand"
 "crypto/sha256"
 "crypto/subtle"
 "crypto/tls"
 "crypto/x509"
 "encoding/binary"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "io"
 "net"
 "slices"
 "time"

 "github.com/tunex/vnext/agent/internal/contracts"
 "github.com/tunex/vnext/agent/internal/relay"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

const ALPN = "tunex-transit/1"
const maxControl = 4096

// Binding is versioned at the HopOpen envelope. Every pair is scoped to the
// current Forward/deployment/path and to both physical assignment fences.
type Binding struct {
 ScopeID string `json:"scopeId"`
 ForwardID string `json:"forwardId"`
 ForwardRevision uint64 `json:"forwardRevision"`
 DeploymentGeneration uint64 `json:"deploymentGeneration"`
 ProfileDigest string `json:"profileDigest"`
 PathDigest string `json:"pathDigest"`
 FromNodeID string `json:"fromNodeId"`
 ToNodeID string `json:"toNodeId"`
 FromAssignmentID string `json:"fromAssignmentId"`
 ToAssignmentID string `json:"toAssignmentId"`
 FromSessionEpoch uint64 `json:"fromSessionEpoch"`
 ToSessionEpoch uint64 `json:"toSessionEpoch"`
 FromFence uint64 `json:"fromFence"`
 ToFence uint64 `json:"toFence"`
 Protocol string `json:"protocol"`
}
type Open struct {
 WireVersion uint64 `json:"wireVersion"`
 Type string `json:"type"`
 Action string `json:"action"`
 RequestID string `json:"requestId"`
 Binding Binding `json:"binding"`
}
type Reply struct {
 WireVersion uint64 `json:"wireVersion"`
 Type string `json:"type"`
 RequestID string `json:"requestId"`
 BindingDigest string `json:"bindingDigest,omitempty"`
 Code string `json:"code,omitempty"`
}
func UpstreamBinding(v transitcontracts.TransitIntent) Binding {
 return Binding{v.ScopeId,v.ForwardId,v.ForwardRevision,v.DeploymentGeneration,v.ProfileDigest,v.PathDigest,
 v.Upstream.NodeId,v.NodeId,v.Upstream.AssignmentId,v.AssignmentId,
 v.Upstream.SessionEpoch,v.SessionEpoch,v.Upstream.BindingFence,v.BindingFence,v.Protocol}
}
func DownstreamBinding(v transitcontracts.TransitIntent) Binding {
 return Binding{v.ScopeId,v.ForwardId,v.ForwardRevision,v.DeploymentGeneration,v.ProfileDigest,v.PathDigest,
 v.NodeId,v.Downstream.NodeId,v.AssignmentId,v.Downstream.AssignmentId,
 v.SessionEpoch,v.Downstream.SessionEpoch,v.BindingFence,v.Downstream.BindingFence,v.Protocol}
}
func bindingDigest(v Binding) (string,error) {return contracts.ComputeDigest(v)}

func writeControl(out io.Writer, value any) error {
 raw,err:=json.Marshal(value);if err!=nil{return err}
 if len(raw)<2||len(raw)>maxControl{return fmt.Errorf("RESOURCE_LIMIT: Transit control message")}
 var head [4]byte;binary.BigEndian.PutUint32(head[:],uint32(len(raw)))
 if err:=writeAll(out,head[:]);err!=nil{return err}
 return writeAll(out,raw)
}
func writeAll(out io.Writer,raw []byte) error {
 for len(raw)>0 {n,err:=out.Write(raw);if err!=nil{return err};if n<=0{return io.ErrShortWrite};raw=raw[n:]}
 return nil
}
func readControl(in io.Reader,destination any) error {
 var head [4]byte;if _,err:=io.ReadFull(in,head[:]);err!=nil{return err}
 size:=binary.BigEndian.Uint32(head[:])
 if size<2||size>maxControl{return fmt.Errorf("RESOURCE_LIMIT: Transit control message")}
 raw:=make([]byte,size);if _,err:=io.ReadFull(in,raw);err!=nil{return err}
 if _,err:=contracts.ParseJSON(raw,maxControl);err!=nil{return err}
 decoder:=json.NewDecoder(bytes.NewReader(raw));decoder.DisallowUnknownFields()
 if err:=decoder.Decode(destination);err!=nil{return err}
 return nil
}
func MakeOpen(action string,binding Binding)(Open,error){
 if action!="probe"&&action!="tcp"&&action!="udp"{return Open{},fmt.Errorf("UNSUPPORTED_CAPABILITY")}
 var nonce [16]byte;if _,err:=rand.Read(nonce[:]);err!=nil{return Open{},err}
 return Open{WireVersion:1,Type:"hop-open",Action:action,RequestID:hex.EncodeToString(nonce[:]),Binding:binding},nil
}
func ValidateOpen(open Open, expected Binding, active bool, allow func()error) error {
 if open.WireVersion!=1||open.Type!="hop-open"||len(open.RequestID)!=32||open.Action!="probe"&&open.Action!=expected.Protocol||open.Binding!=expected {
  return fmt.Errorf("STALE_DEPLOYMENT: Transit hop binding mismatch")
 }
 if _,err:=hex.DecodeString(open.RequestID);err!=nil{return fmt.Errorf("INVALID_CONFIG: Transit nonce")}
 if !active{return fmt.Errorf("DOWNSTREAM_NOT_ACTIVE")}
 if allow==nil{return fmt.Errorf("AUTHORIZATION_DENIED")}
 return allow()
}
func writeAccepted(out io.Writer,open Open) error{
 digest,err:=bindingDigest(open.Binding);if err!=nil{return err}
 return writeControl(out,Reply{WireVersion:1,Type:"hop-accepted",RequestID:open.RequestID,BindingDigest:digest})
}
func writeRejected(out io.Writer,open Open,code string) error {
 return writeControl(out,Reply{WireVersion:1,Type:"hop-rejected",RequestID:open.RequestID,Code:code})
}
func readAccepted(in io.Reader,open Open) error {
 var reply Reply;if err:=readControl(in,&reply);err!=nil{return err}
 if reply.WireVersion!=1||reply.RequestID!=open.RequestID{return fmt.Errorf("STALE_DEPLOYMENT: Hop reply nonce")}
 if reply.Type=="hop-rejected" {return fmt.Errorf("DOWNSTREAM_REJECTED")}
 digest,err:=bindingDigest(open.Binding);if err!=nil{return err}
 if reply.Type!="hop-accepted"||reply.Code!=""||subtle.ConstantTimeCompare([]byte(digest),[]byte(reply.BindingDigest))!=1{return fmt.Errorf("STALE_DEPLOYMENT: Hop reply binding")}
 return nil
}
func peerConfig(cert tls.Certificate,roots *x509.CertPool,peerID,peerPin string,server bool)(*tls.Config,error){
 if roots==nil||len(cert.Certificate)==0||len(peerID)==0||len(peerPin)!=71||peerPin[:7]!="sha256:"{
  return nil,fmt.Errorf("INVALID_CONFIG: Dedicated pinned Transit identity required")
 }
 if _,err:=hex.DecodeString(peerPin[7:]);err!=nil{return nil,fmt.Errorf("INVALID_CONFIG: Transit peer fingerprint")}
 config:=&tls.Config{Certificates:[]tls.Certificate{cert},MinVersion:tls.VersionTLS13,MaxVersion:tls.VersionTLS13,NextProtos:[]string{ALPN},SessionTicketsDisabled:true}
 expectedUse:=x509.ExtKeyUsageServerAuth
 if server{config.ClientAuth=tls.RequireAndVerifyClientCert;config.ClientCAs=roots.Clone();expectedUse=x509.ExtKeyUsageClientAuth
 }else{
  // URI SAN peer identity has no hostname. Full chain, purpose, URI, pin and
  // TLS 1.3 ALPN checks are mandatory below.
  config.InsecureSkipVerify=true
 }
 trusted:=roots.Clone()
 config.VerifyConnection=func(state tls.ConnectionState)error{
  if state.Version!=tls.VersionTLS13||state.NegotiatedProtocol!=ALPN||len(state.PeerCertificates)==0{return fmt.Errorf("AUTHENTICATION_FAILED: Transit TLS 1.3 ALPN")}
  leaf:=state.PeerCertificates[0]
  if leaf.IsCA||!slices.Contains(leaf.ExtKeyUsage,x509.ExtKeyUsageClientAuth)||!slices.Contains(leaf.ExtKeyUsage,x509.ExtKeyUsageServerAuth){return fmt.Errorf("AUTHENTICATION_FAILED: Dedicated dual-purpose peer leaf")}
  chain:=x509.NewCertPool();for _,ca:=range state.PeerCertificates[1:]{chain.AddCert(ca)}
  if _,err:=leaf.Verify(x509.VerifyOptions{Roots:trusted,Intermediates:chain,CurrentTime:time.Now(),KeyUsages:[]x509.ExtKeyUsage{expectedUse}});err!=nil{return fmt.Errorf("AUTHENTICATION_FAILED: Peer chain or purpose")}
  if len(leaf.URIs)!=1||leaf.URIs[0].String()!="urn:tunex:node:"+peerID{return fmt.Errorf("AUTHENTICATION_FAILED: Exact peer Node identity")}
  actual:=sha256.Sum256(leaf.Raw);wanted,_:=hex.DecodeString(peerPin[7:])
  if subtle.ConstantTimeCompare(actual[:],wanted)!=1{return fmt.Errorf("AUTHENTICATION_FAILED: Exact peer certificate fingerprint")}
  return nil
 }
 return config,nil
}
func verifyLocalIdentity(cert tls.Certificate,roots *x509.CertPool,node string)(time.Time,error) {
 if roots==nil||len(cert.Certificate)==0{return time.Time{},fmt.Errorf("AUTHENTICATION_FAILED: Local Transit identity missing")}
 leaf:=cert.Leaf;var err error
 if leaf==nil{leaf,err=x509.ParseCertificate(cert.Certificate[0]);if err!=nil{return time.Time{},err}}
 if leaf.IsCA||len(leaf.URIs)!=1||leaf.URIs[0].String()!="urn:tunex:node:"+node||!slices.Contains(leaf.ExtKeyUsage,x509.ExtKeyUsageClientAuth)||!slices.Contains(leaf.ExtKeyUsage,x509.ExtKeyUsageServerAuth){
  return time.Time{},fmt.Errorf("AUTHENTICATION_FAILED: Local Transit Node differs")
 }
 chain:=x509.NewCertPool();for _,raw:=range cert.Certificate[1:]{ca,err:=x509.ParseCertificate(raw);if err!=nil{return time.Time{},err};chain.AddCert(ca)}
 if _,err:=leaf.Verify(x509.VerifyOptions{Roots:roots,Intermediates:chain,CurrentTime:time.Now(),KeyUsages:[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}});err!=nil{return time.Time{},fmt.Errorf("AUTHENTICATION_FAILED: Local Transit certificate chain")}
 return leaf.NotAfter,nil
}
func ValidateFrame(kind byte,protocol string)error{
 if (protocol=="tcp"&&(kind==relay.FrameTCP||kind==relay.FrameFIN||kind==relay.FrameClose)) ||
 (protocol=="udp"&&(kind==relay.FrameUDP||kind==relay.FrameClose)){return nil}
 return fmt.Errorf("INVALID_CONFIG: Wrong Transit frame protocol")
}

// Package adp3transit parses a versioned, OFFLINE Transit resource envelope.
// Nothing in the production ADP/3 Runner or Snapshot client imports this package.
package adp3transit

import (
 "encoding/json"
 _ "embed"
 "fmt"
 "net/netip"
 "strings"
 "sync"
 "time"

 jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
 "github.com/santhosh-tekuri/jsonschema/v6"
 "github.com/tunex/vnext/agent/internal/contracts"
 "github.com/tunex/vnext/agent/internal/transitcontracts"
)

//go:embed schema.json
var schemaBytes []byte
var once sync.Once
var validators map[string]*jsonschema.Schema
var compileError error

var RequiredCapabilities=[]string{"adp.multihop.1","transit.wire.1","native.transit.v1"}

type Resource struct {
 Address string `json:"address"`
 Port uint64 `json:"port"`
 Protocol string `json:"protocol"`
}
type Config struct { Intent transitcontracts.TransitIntent `json:"intent"` }
type Driver struct {
 Id string `json:"id"`
 SchemaVersion uint64 `json:"schemaVersion"`
 ConfigDigest string `json:"configDigest"`
 Config Config `json:"config"`
}
type Assignment struct {
 ProtocolVersion uint64 `json:"protocolVersion"`
 ExtensionVersion uint64 `json:"extensionVersion"`
 NodeId string `json:"nodeId"`
 SessionEpoch uint64 `json:"sessionEpoch"`
 AssignmentId string `json:"assignmentId"`
 ForwardId string `json:"forwardId"`
 ForwardRevision uint64 `json:"forwardRevision"`
 DeploymentGeneration uint64 `json:"deploymentGeneration"`
 BindingFence uint64 `json:"bindingFence"`
 Role string `json:"role"`
 Protocol string `json:"protocol"`
 Phase string `json:"phase"`
 Resource Resource `json:"resource"`
 Driver Driver `json:"driver"`
 DrainTimeoutSeconds uint64 `json:"drainTimeoutSeconds"`
}
type Tombstone struct {
 AssignmentId string `json:"assignmentId"`
 ForwardId string `json:"forwardId"`
 Role string `json:"role"`
 Protocol string `json:"protocol"`
 PhysicalProtocol string `json:"physicalProtocol"`
 Port uint64 `json:"port"`
 BindingFence uint64 `json:"bindingFence"`
 RetirementGeneration uint64 `json:"retirementGeneration"`
}
type Snapshot struct {
 ProtocolVersion uint64 `json:"protocolVersion"`
 ExtensionVersion uint64 `json:"extensionVersion"`
 Kind string `json:"kind"`
 RequiredCapabilities []string `json:"requiredCapabilities"`
 NodeId string `json:"nodeId"`
 SessionEpoch uint64 `json:"sessionEpoch"`
 SnapshotGeneration uint64 `json:"snapshotGeneration"`
 Complete bool `json:"complete"`
 IssuedAt string `json:"issuedAt"`
 ValidUntil string `json:"validUntil"`
 SnapshotDigest string `json:"snapshotDigest"`
 Assignments []Assignment `json:"assignments"`
 Tombstones []Tombstone `json:"tombstones"`
}

func compile() {
 c:=jsonschema.NewCompiler()
 c.AssertFormat()
 var source any
 if err:=json.Unmarshal(schemaBytes,&source);err!=nil{compileError=err;return}
 const schemaID="urn:tunex:adp:3:transit:1"
 if err:=c.AddResource(schemaID,source);err!=nil{compileError=err;return}
 validators=map[string]*jsonschema.Schema{}
 for _,name:=range []string{"Assignment","Snapshot"} {
  v,err:=c.Compile(schemaID+"#/$defs/"+name)
  if err!=nil{compileError=err;return}
  validators[name]=v
 }
}
func validate(name string, raw []byte, maxBytes int)([]byte,error){
 once.Do(compile)
 if compileError!=nil{return nil,compileError}
 value,err:=contracts.ParseJSON(raw,maxBytes)
 if err!=nil{return nil,err}
 if err=validators[name].Validate(value);err!=nil{return nil,fmt.Errorf("INVALID_CONFIG: Transit ADP/3 %s rejected: %w",name,err)}
 return jcs.Transform(raw)
}

// RequireCapabilities is an explicit negotiation gate; parse success never grants authority.
func RequireCapabilities(advertised []string)error{
 for _,need:=range RequiredCapabilities {
  found:=false
  for _,have:=range advertised {if have==need{found=true;break}}
  if !found{return fmt.Errorf("UNSUPPORTED_CAPABILITY: Transit ADP/3 capability %s not advertised",need)}
 }
 return nil
}
func ParseAssignment(raw []byte)(*Assignment,error){
 canonical,err:=validate("Assignment",raw,16384)
 if err!=nil{return nil,err}
 // Parse the ORIGINAL untyped intent so unknown fields cannot disappear during Go decoding.
 var wire struct{Driver struct{Config struct{Intent json.RawMessage `json:"intent"`} `json:"config"`} `json:"driver"`}
 if err=json.Unmarshal(canonical,&wire);err!=nil{return nil,err}
 intent,err:=transitcontracts.Parse(wire.Driver.Config.Intent)
 if err!=nil{return nil,err}
 var a Assignment
 if err=json.Unmarshal(canonical,&a);err!=nil{return nil,err}
 hash,err:=contracts.ComputeDigest(a.Driver.Config)
 if err!=nil{return nil,err}
 if hash!=a.Driver.ConfigDigest{return nil,fmt.Errorf("INTEGRITY_FAILURE: Transit driver config digest differs")}
 if a.NodeId!=intent.NodeId||a.SessionEpoch!=intent.SessionEpoch||
  a.AssignmentId!=intent.AssignmentId||a.ForwardId!=intent.ForwardId||
  a.ForwardRevision!=intent.ForwardRevision||a.DeploymentGeneration!=intent.DeploymentGeneration||
  a.BindingFence!=intent.BindingFence||a.Protocol!=intent.Protocol {
  return nil,fmt.Errorf("AUTHORIZATION_DENIED: Transit Assignment/Intent binding differs")
 }
 ip,err:=netip.ParseAddr(a.Resource.Address)
 if err!=nil||ip.Zone()!=""||ip.String()!=a.Resource.Address||
  a.Resource.Protocol!="tcp"||a.Resource.Address!=intent.Listener.Address||a.Resource.Port!=intent.Listener.Port {
  return nil,fmt.Errorf("RESOURCE_CONFLICT: Transit physical TLS listener differs")
 }
 return &a,nil
}
func parseTime(value string)(time.Time,error){
 instant,err:=time.Parse(time.RFC3339Nano,value)
 if err!=nil{return time.Time{},fmt.Errorf("INVALID_CONFIG: Transit timestamp: %w",err)}
 return instant,nil
}
func order(a,b Tombstone)int{
 if compare:=strings.Compare(a.PhysicalProtocol,b.PhysicalProtocol);compare!=0{return compare}
 if a.Port<b.Port{return -1};if a.Port>b.Port{return 1}
 if a.RetirementGeneration<b.RetirementGeneration{return -1}
 if a.RetirementGeneration>b.RetirementGeneration{return 1}
 return strings.Compare(a.AssignmentId,b.AssignmentId)
}
func ParseSnapshot(raw []byte)(*Snapshot,error){
 canonical,err:=validate("Snapshot",raw,4194304)
 if err!=nil{return nil,err}
 var object map[string]json.RawMessage
 if err=json.Unmarshal(canonical,&object);err!=nil{return nil,err}
 delete(object,"snapshotDigest")
 digest,err:=contracts.ComputeDigest(object)
 if err!=nil{return nil,err}
 var s Snapshot
 if err=json.Unmarshal(canonical,&s);err!=nil{return nil,err}
 if digest!=s.SnapshotDigest{return nil,fmt.Errorf("INTEGRITY_FAILURE: Transit Snapshot digest differs")}
 start,err:=parseTime(s.IssuedAt)
 if err!=nil{return nil,err}
 end,err:=parseTime(s.ValidUntil)
 if err!=nil{return nil,err}
 if !start.Before(end){return nil,fmt.Errorf("INVALID_CONFIG: Transit Snapshot time range")}
 // Raw assignment elements preserve strict nested Intent validation.
 var wire struct{Assignments []json.RawMessage `json:"assignments"`}
 if err=json.Unmarshal(canonical,&wire);err!=nil{return nil,err}
 logical:=map[string]bool{}
 physical:=map[string]bool{}
 previous:=""
 for _,body:=range wire.Assignments {
  a,err:=ParseAssignment(body)
  if err!=nil{return nil,err}
  intent:=a.Driver.Config.Intent
  issued,err:=parseTime(intent.IssuedAt)
  if err!=nil{return nil,err}
  until,err:=parseTime(intent.AuthorizationUntil)
  if err!=nil{return nil,err}
  if a.NodeId!=s.NodeId||a.SessionEpoch!=s.SessionEpoch||start.Before(issued)||end.After(until){
   return nil,fmt.Errorf("AUTHORIZATION_DENIED: Transit Snapshot Node/Session/lease differs")
  }
  logicalKey:=a.ForwardId+"/"+a.Protocol
  physicalKey:=fmt.Sprintf("tcp/%d",a.Resource.Port)
  if a.AssignmentId<=previous||logical[logicalKey]||physical[physicalKey]{
   return nil,fmt.Errorf("RESOURCE_CONFLICT: Duplicate, unsorted or overlapping Transit resource")
  }
  previous=a.AssignmentId;logical[logicalKey]=true;physical[physicalKey]=true
 }
 retired:=map[string]bool{}
 for i,t:=range s.Tombstones{
  key:=fmt.Sprintf("tcp/%d/%d",t.Port,t.BindingFence)
  if retired[key]||t.RetirementGeneration>s.SnapshotGeneration||
   (i>0&&order(s.Tombstones[i-1],t)>=0){
   return nil,fmt.Errorf("INVALID_CONFIG: Transit retirement order or high-water differs")
  }
  for _,a:=range s.Assignments {
   if a.Resource.Port==t.Port&&a.BindingFence<=t.BindingFence{
    return nil,fmt.Errorf("FENCING_REJECTED: Transit retirement fence resurrected")
   }
  }
  retired[key]=true
 }
 return &s,nil
}

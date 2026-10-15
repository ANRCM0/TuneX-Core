// Package state preserves offline Transit extension high-water separately from
// the deployed ADP/3 Runtime journal. A stored Snapshot is never executable authority.
package state

import (
 "bytes"
 "encoding/json"
 "fmt"
 "maps"
 "os"
 "regexp"

 "github.com/tunex/vnext/agent/internal/adp3transit"
 "github.com/tunex/vnext/agent/internal/contracts"
)

type TransitJournal struct {
 ProtocolVersion uint64 `json:"protocolVersion"`
 ExtensionVersion uint64 `json:"extensionVersion"`
 NodeID string `json:"nodeId"`
 Generation uint64 `json:"generation"`
 Digest string `json:"digest"`
 Snapshot json.RawMessage `json:"snapshot"`
 Fences map[string]uint64 `json:"fences"`
 Retired map[string]uint64 `json:"retired"`
}

var transitSlotPattern = regexp.MustCompile(`^tcp/[1-9][0-9]{0,4}$`)

func InitializeTransitJournal(path string, key []byte, node string) error {
 if len(key)!=32 || !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`).MatchString(node) {
  return fmt.Errorf("INTEGRITY_FAILURE: Transit journal identity/key required")
 }
 file,err:=os.OpenFile(path,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600)
 if err!=nil{return fmt.Errorf("INTEGRITY_FAILURE: Explicit new Transit journal required: %w",err)}
 if err=file.Sync();err!=nil{file.Close();return err}
 if err=file.Close();err!=nil{return err}
 initial:=TransitJournal{
  ProtocolVersion:3,ExtensionVersion:1,NodeID:node,
  Snapshot:json.RawMessage("null"),
  Fences:map[string]uint64{},Retired:map[string]uint64{},
 }
 return saveTransitJournal(path,key,initial)
}
func saveTransitJournal(path string,key []byte,j TransitJournal)error{
 if len(key)!=32{return fmt.Errorf("INTEGRITY_FAILURE: Transit journal key unavailable")}
 raw,err:=json.Marshal(j)
 if err!=nil{return err}
 return Save(path,key,Journal{
  Snapshot:raw,Generation:j.Generation,Digest:j.Digest,Fences:j.Fences,Retired:j.Retired,
 })
}
func LoadTransitJournal(path string,key []byte,node string)(TransitJournal,error){
 if len(key)!=32{return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Transit journal key unavailable")}
 // Parse raw HMAC envelope as I-JSON too, preventing duplicate-key normalization.
 file,err:=os.ReadFile(path)
 if err!=nil{return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Transit journal missing: %w",err)}
 if _,err=contracts.ParseJSON(file,6291456);err!=nil{
  return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Transit journal outer JSON: %w",err)
 }
 outer,err:=Load(path,key)
 if err!=nil{return TransitJournal{},err}
 if _,err=contracts.ParseJSON(outer.Snapshot,4194304+1048576);err!=nil{
  return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Transit journal inner JSON: %w",err)
 }
 decoder:=json.NewDecoder(bytes.NewReader(outer.Snapshot))
 decoder.DisallowUnknownFields()
 var j TransitJournal
 if err=decoder.Decode(&j);err!=nil{
  return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Invalid Transit journal: %w",err)
 }
 if j.ProtocolVersion!=3||j.ExtensionVersion!=1||j.NodeID!=node||
  j.Generation!=outer.Generation||j.Digest!=outer.Digest||
  !maps.Equal(j.Fences,outer.Fences)||!maps.Equal(j.Retired,outer.Retired)||
  j.Fences==nil||j.Retired==nil||j.Generation>contracts.MaxCounter {
  return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Transit journal envelope mismatch")
 }
 for _,entries:=range []map[string]uint64{j.Fences,j.Retired}{
  for slot,fence:=range entries {
   if !transitSlotPattern.MatchString(slot)||fence==0||fence>contracts.MaxCounter {
    return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Invalid Transit physical fence")
   }
  }
 }
 if j.Generation==0{
  if j.Digest!=""||string(j.Snapshot)!="null"||len(j.Fences)!=0||len(j.Retired)!=0 {
   return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Invalid empty Transit journal")
  }
 }else{
  snapshot,parseErr:=adp3transit.ParseSnapshot(j.Snapshot)
  if parseErr!=nil{return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Corrupt retained Transit Snapshot: %w",parseErr)}
  if snapshot.NodeId!=j.NodeID||snapshot.SnapshotGeneration!=j.Generation||snapshot.SnapshotDigest!=j.Digest {
   return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Retained Transit identity/generation differs")
  }
  for _,a:=range snapshot.Assignments{
   slot:=fmt.Sprintf("tcp/%d",a.Resource.Port)
   if j.Fences[slot]<a.BindingFence||j.Retired[slot]>=a.BindingFence {
    return TransitJournal{},fmt.Errorf("INTEGRITY_FAILURE: Retained Transit Fence inconsistent")
   }
  }
 }
 return j,nil
}

// AcceptTransitSnapshot atomically journals the new per-socket high-water BEFORE
// any caller can prepare a listener. Restart alone must never execute the cache.
func AcceptTransitSnapshot(path string,key []byte,current TransitJournal,s adp3transit.Snapshot)(TransitJournal,error){
 release,err:=AcquireLock(path+".lock")
 if err!=nil{return current,err}
 defer release()
 durable,err:=LoadTransitJournal(path,key,current.NodeID)
 if err!=nil{return current,err}
 if current.ProtocolVersion!=3||current.ExtensionVersion!=1||
  durable.Generation!=current.Generation||durable.Digest!=current.Digest||
  !maps.Equal(durable.Fences,current.Fences)||!maps.Equal(durable.Retired,current.Retired) {
  return current,fmt.Errorf("INTEGRITY_FAILURE: Stale Transit journal writer")
 }
 raw,err:=json.Marshal(s)
 if err!=nil{return current,err}
 if _,err=adp3transit.ParseSnapshot(raw);err!=nil{return current,err}
 if s.NodeId!=current.NodeID||s.SnapshotGeneration<current.Generation||
  s.SnapshotGeneration==current.Generation&&s.SnapshotDigest!=current.Digest {
  return current,fmt.Errorf("FENCING_REJECTED: Transit journal generation/Node changed")
 }
 if s.SnapshotGeneration==current.Generation{return current,nil}
 next:=current
 next.Fences=maps.Clone(current.Fences)
 next.Retired=maps.Clone(current.Retired)
 incoming:=map[string]bool{}
 // Same assignment identity/fence must not silently mutate physical bindings.
 var old adp3transit.Snapshot
 if current.Generation>0{
  if err=json.Unmarshal(current.Snapshot,&old);err!=nil{return current,err}
 }
 for _,a:=range s.Assignments {
  slot:=fmt.Sprintf("tcp/%d",a.Resource.Port)
  incoming[slot]=true
  if a.BindingFence<next.Fences[slot]||a.BindingFence<=next.Retired[slot]{
   return current,fmt.Errorf("FENCING_REJECTED: Stale Transit physical owner")
  }
  for _,prior:=range old.Assignments{
   samePort:=prior.Resource.Protocol==a.Resource.Protocol&&prior.Resource.Port==a.Resource.Port
   if samePort&&a.BindingFence==prior.BindingFence&&
    (prior.AssignmentId!=a.AssignmentId||prior.DeploymentGeneration!=a.DeploymentGeneration||prior.ForwardId!=a.ForwardId){
    return current,fmt.Errorf("FENCING_REJECTED: Transit port ownership changed without advancing Fence")
   }
   if prior.AssignmentId==a.AssignmentId&&prior.DeploymentGeneration==a.DeploymentGeneration&&prior.BindingFence==a.BindingFence {
    if prior.Driver.ConfigDigest!=a.Driver.ConfigDigest||prior.Resource!=a.Resource||prior.Protocol!=a.Protocol||
     prior.Phase=="active"&&a.Phase=="prepared"||prior.Phase=="draining"&&a.Phase!="draining"{
     return current,fmt.Errorf("INTEGRITY_FAILURE: Transit execution binding/phase changed without new Fence")
    }
   }
  }
  next.Fences[slot]=a.BindingFence
 }
 for slot,fence:=range next.Fences{
  if !incoming[slot]{next.Retired[slot]=max(next.Retired[slot],fence)}
 }
 for _,t:=range s.Tombstones{
  slot:=fmt.Sprintf("tcp/%d",t.Port)
  next.Retired[slot]=max(next.Retired[slot],t.BindingFence)
 }
 next.Generation=s.SnapshotGeneration
 next.Digest=s.SnapshotDigest
 next.Snapshot=raw
 if err=saveTransitJournal(path,key,next);err!=nil{
  return current,fmt.Errorf("PERSISTENCE_FAILURE: %w",err)
 }
 return next,nil
}

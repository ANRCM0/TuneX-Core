package control

import (
 "bytes"
 "crypto/tls"
 "crypto/x509"
 "encoding/json"
 "fmt"
 "net"
 "os"
 "path/filepath"
 "testing"
 "time"

 "github.com/tunex/vnext/agent/internal/adp3transit"
 "github.com/tunex/vnext/agent/internal/contracts"
 "github.com/tunex/vnext/agent/internal/state"
)

func transitRunnerHash(t *testing.T,v any)string{
 t.Helper()
 h,err:=contracts.ComputeDigest(v)
 if err!=nil{t.Fatal(err)}
 return h
}
func transitRunnerIntent(t *testing.T)map[string]any{
 t.Helper()
 raw,err:=os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json")
 if err!=nil{t.Fatal(err)}
 var vector struct{Cases []struct{Name,Raw string}}
 if err=json.Unmarshal(raw,&vector);err!=nil{t.Fatal(err)}
 for _,sample:=range vector.Cases{
  if sample.Name=="valid-three-node-transit-udp"{
   var v map[string]any
   if err=json.Unmarshal([]byte(sample.Raw),&v);err!=nil{t.Fatal(err)}
   return v
  }
 }
 t.Fatal("no Transit fixture")
 return nil
}
func transitRunnerSnapshot(t *testing.T,epoch,generation uint64,port uint64,phase string)[]byte{
 t.Helper()
 intent:=transitRunnerIntent(t)
 now:=time.Now().UTC().Add(-time.Second)
 issued:=now.Format(time.RFC3339Nano)
 until:=now.Add(3*time.Minute).Format(time.RFC3339Nano)
 intent["issuedAt"]=issued
 intent["authorizationUntil"]=until
 intent["listener"]=map[string]any{"address":"127.0.0.1","port":port,"protocol":"tcp"}
 intent["sessionEpoch"]=epoch
 config:=map[string]any{"intent":intent}
 a:=map[string]any{
  "protocolVersion":3,"extensionVersion":1,
  "nodeId":"node-b","sessionEpoch":epoch,"assignmentId":"assign-b",
  "forwardId":"forward-1","forwardRevision":2,
  "deploymentGeneration":4,"bindingFence":9,
  "role":"relay-transit","protocol":"udp","phase":phase,
  "resource":map[string]any{"address":"127.0.0.1","port":port,"protocol":"tcp"},
  "driver":map[string]any{"id":"native.transit.v1","schemaVersion":1,
   "configDigest":transitRunnerHash(t,config),"config":config},
  "drainTimeoutSeconds":30,
 }
 snapshot:=map[string]any{
  "protocolVersion":3,"extensionVersion":1,"kind":"transit-snapshot",
  "requiredCapabilities":[]string{"adp.multihop.1","transit.wire.1","native.transit.v1"},
  "nodeId":"node-b","sessionEpoch":epoch,"snapshotGeneration":generation,
  "complete":true,"issuedAt":issued,"validUntil":now.Add(2*time.Minute).Format(time.RFC3339Nano),
  "assignments":[]any{a},"tombstones":[]any{},
 }
 snapshot["snapshotDigest"]=transitRunnerHash(t,snapshot)
 raw,err:=json.Marshal(snapshot)
 if err!=nil{t.Fatal(err)}
 if _,err=adp3transit.ParseSnapshot(raw);err!=nil{t.Fatal(err)}
 return raw
}
func transitRunnerIdentity(t *testing.T)(tls.Certificate,*x509.CertPool){
 t.Helper()
 ca,caKey,roots:=relayTestCA(t)
 request,err:=prepareRotation(filepath.Join(t.TempDir(),"request.json"),"node-b")
 if err!=nil{t.Fatal(err)}
 bundle:=signRelayTest(t,ca,caKey,request,"node-b",[]x509.ExtKeyUsage{
  x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth,
 })
 certificate,_,err:=validateRelayBundle(bundle,"node-b",roots)
 if err!=nil{t.Fatal(err)}
 return certificate,roots
}
func TestTransitRunnerOfflinePersistBeforeEngineAndNoReplay(t *testing.T){
 path:=filepath.Join(t.TempDir(),"transit.journal")
 key:=bytes.Repeat([]byte{3},32)
 if err:=state.InitializeTransitJournal(path,key,"node-b");err!=nil{t.Fatal(err)}
 certificate,roots:=transitRunnerIdentity(t)
 listener,err:=net.Listen("tcp","127.0.0.1:0")
 if err!=nil{t.Fatal(err)}
 port:=uint64(listener.Addr().(*net.TCPAddr).Port)
 listener.Close()
 grant:=true
 guardPort:=true
 authorize:=func()error{
  if !grant{return fmt.Errorf("AUTHORIZATION_DENIED: revoked in test")}
  return nil
 }
 localPort:=func(a adp3transit.Assignment)error{
  if !guardPort{return fmt.Errorf("PORT_RESERVED: real Runtime owns resource")}
  if a.Resource.Port!=port{return fmt.Errorf("RESOURCE_CONFLICT")}
  return nil
 }
 capabilities:=[]string{"adp.multihop.1","transit.wire.1","native.transit.v1"}
 if _,err=NewTransitController(path,key,"node-b",8,capabilities,certificate,roots,nil,localPort);err==nil{
  t.Fatal("missing live authorizer accepted")
 }
 if _,err=NewTransitController(path,key,"node-b",8,[]string{"native.relay.v1"},certificate,roots,authorize,localPort);err==nil{
  t.Fatal("legacy capability downgrade accepted")
 }
 controller,err:=NewTransitController(path,key,"node-b",8,capabilities,certificate,roots,authorize,localPort)
 if err!=nil{t.Fatal(err)}
 defer controller.Close()
 raw:=transitRunnerSnapshot(t,8,10,port,"prepared")
 guardPort=false
 if _,err=controller.ApplyTransitSnapshot(raw);err==nil{t.Fatal("foreign physical owner accepted")}
 if generation,_:=controller.CurrentJournal();generation!=0{t.Fatal("port rejection changed journal")}
 guardPort=true
 observations,err:=controller.ApplyTransitSnapshot(raw)
 if err!=nil{t.Fatal(err)}
 if len(observations)!=1||observations[0].Condition!="prepared"{
  t.Fatalf("prepared Transit must not be reported ready: %+v",observations)
 }
 if generation,_:=controller.CurrentJournal();generation!=10{t.Fatal("journal not persisted before Engine")}
 check,err:=net.Listen("tcp",net.JoinHostPort("127.0.0.1",fmt.Sprint(port)))
 if err!=nil{t.Fatalf("prepared engine opened a listener: %v",err)}
 check.Close()
 controller.Close()
 restart,err:=NewTransitController(path,key,"node-b",8,capabilities,certificate,roots,authorize,localPort)
 if err!=nil{t.Fatal(err)}
 defer restart.Close()
 if _,err=restart.ApplyTransitSnapshot(raw);err==nil{t.Fatal("restart replayed old authority")}
 if generation,_:=restart.CurrentJournal();generation!=10{t.Fatal("restart lost durable generation")}
 grant=false
 if _,err=restart.ApplyTransitSnapshot(transitRunnerSnapshot(t,8,11,port,"active"));err==nil{
  t.Fatal("revoked Control authorization accepted")
 }
 if generation,_:=restart.CurrentJournal();generation!=10{t.Fatal("revocation changed durable state")}
 grant=true
 results,err:=restart.ApplyTransitSnapshot(transitRunnerSnapshot(t,8,11,port,"active"))
 if err!=nil{t.Fatal(err)}
 if len(results)!=1||results[0].Condition!="error"{
  t.Fatalf("missing downstream was falsely reported ready: %+v",results)
 }
 if generation,_:=restart.CurrentJournal();generation!=11{t.Fatal("failed activation did not retain higher fencing generation")}
}

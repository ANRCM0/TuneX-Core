package transitcontracts

import (
 "bytes"
 "encoding/json"
 "os"
 "testing"

 "github.com/tunex/vnext/agent/internal/adp3relay"
)
func TestSharedTransitVectors(t *testing.T) {
 raw,err:=os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json")
 if err!=nil{t.Fatal(err)}
 var fixture struct{Cases []struct{Name,Raw string; Valid bool}}
 if err:=json.Unmarshal(raw,&fixture);err!=nil{t.Fatal(err)}
 if len(fixture.Cases)<10 {t.Fatal("missing required positive/negative shared vectors")}
 for _,item:=range fixture.Cases{
  t.Run(item.Name,func(t *testing.T){
   value,err:=Parse([]byte(item.Raw))
   if (err==nil)!=item.Valid{t.Fatalf("valid=%v err=%v",item.Valid,err)}
   if item.Valid && (value.Role!="relay-transit"||value.Driver!="native.transit.v1"){t.Fatal("unexpected validated role")}
  })
 }
}

func TestTransitEmbeddedSchemaMatchesRepositoryContract(t *testing.T) {
 raw,err:=os.ReadFile("../../../docs/protocol/schemas/transit-v1.schema.json")
 if err!=nil{t.Fatal(err)}
 if !bytes.Equal(raw,schemaBytes){t.Fatal("Go embedded Transit schema differs from canonical TS schema")}
}
func TestLegacyRelayAgentParserDeniesNewTransitRole(t *testing.T) {
 raw,err:=os.ReadFile("../../../docs/protocol/fixtures/adp-v3-relay.json")
 if err!=nil{t.Fatal(err)}
 var fixture struct {Cases []struct {Name,Raw string}}
 if err:=json.Unmarshal(raw,&fixture);err!=nil{t.Fatal(err)}
 for _,item:=range fixture.Cases{
  if item.Name!="assignment-structure"{continue}
  var payload map[string]any
  if err:=json.Unmarshal([]byte(item.Raw),&payload);err!=nil{t.Fatal(err)}
  payload["role"]="relay-transit"
  driver:=payload["driver"].(map[string]any)
  driver["config"].(map[string]any)["role"]="relay-transit"
  forged,err:=json.Marshal(payload);if err!=nil{t.Fatal(err)}
  if err:=adp3relay.Parse("Assignment",forged,nil);err==nil{t.Fatal("legacy Relay parser accepted forged Transit role")}
  return
 }
 t.Fatal("legacy valid Relay vector missing")
}

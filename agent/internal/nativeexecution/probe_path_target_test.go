package nativeexecution

import (
    "testing"
    "github.com/tunex/vnext/agent/internal/adp3"
    "github.com/tunex/vnext/agent/internal/contracts"
)

func TestPathProbeDestinationRequiresNativeIngressAndImmutableConfig(t *testing.T) {
    revision := uint64(1)
    role := "relay-ingress"
    allowed := []string{"127.0.0.0/8"}
    a := adp3.Assignment{Role:role,Phase:"active",Protocol:"udp",Resource:adp3.Resource{Protocol:"udp"},
        Driver:adp3.Driver{Id:"native.relay.v1",SchemaVersion:1,Config:adp3.RuntimeConfig{Role:&role,EgressPolicyRevision:&revision,AllowedDestinationCidrs:&allowed}}}
    hash, err := contracts.ComputeDigest(a.Driver.Config)
    if err != nil { t.Fatal(err) }
    a.Driver.ConfigDigest = hash
    value, err := PathProbeDestination(a,"udp",hash,1,"127.0.0.2",8080)
    if err != nil || value.Host != "127.0.0.2" || value.Port != 8080 { t.Fatalf("path destination: %+v %v",value,err) }
    value.AllowedDestinationCIDRs[0] = "0.0.0.0/0"
    if allowed[0] != "127.0.0.0/8" { t.Fatal("projection aliases original policy") }
    for _, change := range []func(*adp3.Assignment){
        func(a *adp3.Assignment){ a.Phase="prepared" },func(a *adp3.Assignment){ a.Role="relay-egress" },
        func(a *adp3.Assignment){ a.Protocol="tcp" },func(a *adp3.Assignment){ a.Driver.ConfigDigest="changed" },
        func(a *adp3.Assignment){ a.Driver.Config.EgressPolicyRevision=nil },
    } { candidate:=a;change(&candidate);if _,err:=PathProbeDestination(candidate,"udp",hash,1,"127.0.0.2",8080);err==nil { t.Fatal("accepted stale or mismatched path") } }
}

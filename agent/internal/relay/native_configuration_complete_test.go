package relay

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"reflect"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/egress"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/payloadstats"
)

var (
	_ interface{PayloadCounters()(payloadstats.Snapshot,bool)}=(*Engine)(nil)
	_ interface{PayloadCounters()(payloadstats.Snapshot,bool)}=(*forward.TCP)(nil)
	_ interface{PayloadCounters()(payloadstats.Snapshot,bool)}=(*forward.UDP)(nil)
)

func completeMultihopFixture(t *testing.T,index int,protocol string)(adp3.Assignment,*adp3.HopConfig,*x509.Certificate){
	t.Helper()
	leaf:=&x509.Certificate{Raw:[]byte("local certificate fingerprint fixture")}
	profile:=adp3.ProfileConfig{Driver:"native.relay.v1",WireVersion:1,Security:"mutual-tls13",Protocols:[]string{"tcp","udp"},HandshakeTimeoutSeconds:5,IdleTimeoutSeconds:2,MaxFrameBytes:65536,MaxUdpDatagramBytes:16384,MaxConnectionsPerNode:128}
	profileDigest,err:=contracts.ComputeDigest(profile);if err!=nil{t.Fatal(err)}
	path:=make([]adp3.HopNode,3)
	for i:=range path{path[i]=adp3.HopNode{NodeId:fmt.Sprintf("hop-%d",i),AssignmentId:fmt.Sprintf("assignment-%d",i),SessionEpoch:uint64(i+1),BindingFence:uint64(i+2),PeerFingerprint:"sha256:"+strings.Repeat(fmt.Sprint(i+1),64),ListenAddress:"127.0.0.1",Host:fmt.Sprintf("192.0.2.%d",i+1),Port:uint64(12000+i)}}
	path[index].PeerFingerprint=Fingerprint(leaf)
	h:=&adp3.HopConfig{ScopeId:"scope",ForwardId:"forward",ForwardRevision:3,DeploymentGeneration:5,ProfileId:"profile",ProfileRevision:7,ProfileDigest:profileDigest,Protocol:protocol,HopIndex:uint64(index),Path:path,Profile:profile,Target:adp3.Target{Host:"198.51.100.8",Port:8080},EgressPolicyRevision:9,AllowedDestinationCidrs:[]string{"192.0.2.0/24","198.51.100.0/24"},AllowMetadataTargets:index%2!=0}
	h.PathDigest,err=adp3.HopPathDigest(*h);if err!=nil{t.Fatal(err)}
	config:=adp3.RuntimeConfig{Hop:h};digest,err:=contracts.ComputeDigest(config);if err!=nil{t.Fatal(err)}
	role,physical:="multihop-transit","tcp";if index==0{role="multihop-ingress";physical=protocol};if index==2{role="multihop-egress"}
	a:=adp3.Assignment{AssignmentId:path[index].AssignmentId,ForwardId:h.ForwardId,ForwardRevision:h.ForwardRevision,DeploymentGeneration:h.DeploymentGeneration,BindingFence:path[index].BindingFence,Role:role,Protocol:protocol,Phase:"prepared",Resource:adp3.Resource{Address:path[index].ListenAddress,Port:path[index].Port,Protocol:physical},Driver:adp3.Driver{Id:"native.multihop.v1",SchemaVersion:1,Config:config,ConfigDigest:digest},DrainTimeoutSeconds:11}
	return a,h,leaf
}

func TestMultihopCompleteImmutableNativeProjectionAllRolesAndProtocols(t *testing.T){
	for _,protocol:=range []string{"tcp","udp"}{for index:=0;index<3;index++{t.Run(fmt.Sprintf("%s/%d",protocol,index),func(t *testing.T){
		a,h,_:=completeMultihopFixture(t,index,protocol)
		original,err:=json.Marshal(h);if err!=nil{t.Fatal(err)}
		got,owned,err:=projectMultihop(a,h);if err!=nil{t.Fatal(err)}
		ownedRaw,err:=json.Marshal(owned);if err!=nil{t.Fatal(err)}
		if owned==h || !bytes.Equal(original,ownedRaw){t.Fatal("native JSON clone did not retain exact Hop")}
		edge:=index-1;role:="relay-egress";if index==0{edge=0;role="relay-ingress"}
		up,down:=h.Path[edge],h.Path[edge+1]
		binding:=adp3relay.Binding{ScopeId:h.ScopeId,ForwardId:h.ForwardId,ForwardRevision:h.ForwardRevision,DeploymentGeneration:h.DeploymentGeneration,ProfileId:h.ProfileId,ProfileRevision:h.ProfileRevision,ProfileDigest:h.ProfileDigest,IngressNodeId:up.NodeId,EgressNodeId:down.NodeId,IngressAssignmentId:up.AssignmentId,EgressAssignmentId:down.AssignmentId,IngressSessionEpoch:up.SessionEpoch,EgressSessionEpoch:down.SessionEpoch,IngressFence:up.BindingFence,EgressFence:down.BindingFence}
		profile:=adp3relay.ProfileConfig{Driver:"native.relay.v1",WireVersion:1,Security:"mutual-tls13",Protocols:[]string{"tcp","udp"},HandshakeTimeoutSeconds:5,IdleTimeoutSeconds:2,MaxFrameBytes:65536,MaxUdpDatagramBytes:16384,MaxConnectionsPerNode:128}
		config:=adp3relay.RelayConfig{Role:role,Binding:binding,Profile:profile,PeerFingerprints:[]string{up.PeerFingerprint},EgressPolicyRevision:h.EgressPolicyRevision,AllowMetadataTargets:h.AllowMetadataTargets,AllowedDestinationCidrs:[]string{"192.0.2.0/24","198.51.100.0/24"}}
		if index==0{config.PeerFingerprints=[]string{h.Path[1].PeerFingerprint};config.PeerEndpoint=&adp3relay.Target{Host:h.Path[1].Host,Port:h.Path[1].Port}}else{config.Target=&adp3relay.Target{Host:h.Target.Host,Port:h.Target.Port}}
		digest,err:=contracts.ComputeDigest(config);if err!=nil{t.Fatal(err)}
		want:=adp3relay.Assignment{ProtocolVersion:3,NodeId:h.Path[index].NodeId,SessionEpoch:h.Path[index].SessionEpoch,AssignmentId:a.AssignmentId,ForwardId:a.ForwardId,ForwardRevision:a.ForwardRevision,DeploymentGeneration:a.DeploymentGeneration,BindingFence:a.BindingFence,Role:role,Protocol:protocol,Phase:"prepared",Resource:adp3relay.Resource{Address:a.Resource.Address,Port:a.Resource.Port,Protocol:a.Resource.Protocol},Driver:adp3relay.RelayDriver{Id:"native.relay.v1",SchemaVersion:1,ConfigDigest:digest,Config:config},DrainTimeoutSeconds:a.DrainTimeoutSeconds}
		if !reflect.DeepEqual(got,want){t.Fatalf("synthetic assignment differs:\ngot %#v\nwant %#v",got,want)}
		before,err:=json.Marshal(got);if err!=nil{t.Fatal(err)}
		h.Path[0].Host="changed";h.Profile.Protocols[0]="changed";h.AllowedDestinationCidrs[0]="changed";h.Target.Host="changed"
		after,_:=json.Marshal(got);stillOwned,_:=json.Marshal(owned)
		if !bytes.Equal(before,after)||!bytes.Equal(original,stillOwned){t.Fatal("caller mutation crossed native immutable projection")}
		owned.Path[0].Host="owned changed";owned.AllowedDestinationCidrs[0]="owned changed";owned.Profile.Protocols[0]="owned changed"
		after,_=json.Marshal(got);if !bytes.Equal(before,after){t.Fatal("owned Hop mutation crossed synthetic config")}
	})}}
}

func TestMultihopCompleteValidationLeafFingerprintAndPrepareOrder(t *testing.T){
	a,h,leaf:=completeMultihopFixture(t,1,"tcp")
	version:=uint64(1);if err:=adp3.ValidateMultihopAssignment(a,h.Path[1].NodeId,h.Path[1].SessionEpoch,&version);err!=nil{t.Fatal("fixture must pass actual original validator",err)}
	called:=0;failure:=errors.New("authorization stage")
	allow:=func()error{called++;return failure}
	if _,err:=PrepareMultihop(adp3.Assignment{},Identity{},0,allow);err==nil||err.Error()!="INVALID_CONFIG: Multi-hop configuration required"||called!=0{t.Fatal("configuration precheck order changed",err)}
	invalid:=a;invalid.Driver.ConfigDigest="sha256:"+strings.Repeat("0",64)
	wantValidation:=adp3.ValidateMultihopAssignment(invalid,h.Path[1].NodeId,h.Path[1].SessionEpoch,&version)
	if _,err:=PrepareMultihop(invalid,Identity{Certificate:tls.Certificate{Certificate:[][]byte{[]byte("bad DER")}}},0,allow);err==nil||wantValidation==nil||err.Error()!=wantValidation.Error()||called!=0{t.Fatal("ADP validation did not precede leaf/prepare")}
	_,parseError:=x509.ParseCertificate([]byte("bad DER"))
	if _,err:=PrepareMultihop(a,Identity{Certificate:tls.Certificate{Certificate:[][]byte{[]byte("bad DER")}}},0,allow);err==nil||err.Error()!=parseError.Error()||called!=0{t.Fatal("leaf parse stage changed",err)}
	if _,err:=PrepareMultihop(a,Identity{},0,allow);err==nil||err.Error()!="AUTHENTICATION_FAILED: Local multi-hop credential differs"||called!=0{t.Fatal("local fingerprint stage changed",err)}
	identity:=Identity{Certificate:tls.Certificate{Leaf:leaf}}
	if _,err:=PrepareMultihop(a,identity,0,allow);err==nil||err.Error()!="AUTHENTICATION_FAILED: Trusted peer CA required"||called!=0{t.Fatal("projection did not reach original prepare CA check",err)}
	identity.Roots=x509.NewCertPool()
	if _,err:=PrepareMultihop(a,identity,0,allow);err==nil||err.Error()!="INVALID_CONFIG: Prepared authorized Relay required"||called!=0{t.Fatal("prepare bound preceded authorization",err)}
	if _,err:=PrepareMultihop(a,identity,1,allow);err!=failure||called!=1{t.Fatal("prepare authorization identity/order changed",err)}
}

func TestRelayCompletePublicEgressPolicyEqualsOriginalAllowedDetour(t *testing.T){
	addresses:=[]string{"192.0.2.8","::ffff:192.0.2.8","2001:db8::1","169.254.169.254","100.100.100.200","fd00:ec2::254","fe80::1","224.0.0.1","ff02::1","0.0.0.0","::","invalid"}
	for _,text:=range addresses{address,err:=netip.ParseAddr(text);if err!=nil{address=netip.Addr{}}
		for _,metadata:=range []bool{false,true}{for _,cidrs:=range [][]string{nil,{}, {"0.0.0.0/0","::/0"},{"invalid","192.0.2.0/24"},{"2001:db8::/32"}}{
			want:=forward.Allowed(address,contracts.DirectConfig{AllowedDestinationCidrs:cidrs,AllowMetadataTargets:metadata})
			if got:=egress.Allowed(address,cidrs,metadata);got!=want{t.Fatalf("policy differs %s/%v/%v",text,metadata,cidrs)}
		}}
	}
}

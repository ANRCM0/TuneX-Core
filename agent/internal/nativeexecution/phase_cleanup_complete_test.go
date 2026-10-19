package nativeexecution

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"math/big"
	"net"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/relay"
)

func completePhasePreparedRelay(t *testing.T,protocol string,allow func()error)(*relay.Engine,string){
	t.Helper()
	caPublic,caPrivate,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
	now:=time.Now();caTemplate:=&x509.Certificate{SerialNumber:big.NewInt(1),Subject:pkix.Name{CommonName:"phase-ca"},NotBefore:now.Add(-time.Minute),NotAfter:now.Add(time.Hour),IsCA:true,BasicConstraintsValid:true,KeyUsage:x509.KeyUsageCertSign}
	caRaw,err:=x509.CreateCertificate(rand.Reader,caTemplate,caTemplate,caPublic,caPrivate);if err!=nil{t.Fatal(err)}
	ca,err:=x509.ParseCertificate(caRaw);if err!=nil{t.Fatal(err)}
	public,private,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
	uri,err:=url.Parse("urn:tunex:node:node-b");if err!=nil{t.Fatal(err)}
	leafTemplate:=&x509.Certificate{SerialNumber:big.NewInt(2),Subject:pkix.Name{CommonName:"node-b"},NotBefore:now.Add(-time.Minute),NotAfter:now.Add(time.Hour),BasicConstraintsValid:true,KeyUsage:x509.KeyUsageDigitalSignature,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth},URIs:[]*url.URL{uri}}
	leafRaw,err:=x509.CreateCertificate(rand.Reader,leafTemplate,ca,public,caPrivate);if err!=nil{t.Fatal(err)}
	leaf,err:=x509.ParseCertificate(leafRaw);if err!=nil{t.Fatal(err)}
	roots:=x509.NewCertPool();roots.AddCert(ca)
	listener,err:=net.Listen("tcp","127.0.0.1:0");if err!=nil{t.Fatal(err)};address:=listener.Addr().String();port:=uint64(listener.Addr().(*net.TCPAddr).Port);_ = listener.Close()
	profile:=adp3relay.ProfileConfig{Driver:"native.relay.v1",WireVersion:1,Security:"mutual-tls13",Protocols:[]string{"tcp","udp"},HandshakeTimeoutSeconds:2,IdleTimeoutSeconds:1,MaxFrameBytes:65536,MaxUdpDatagramBytes:16384,MaxConnectionsPerNode:32}
	digest,err:=contracts.ComputeDigest(profile);if err!=nil{t.Fatal(err)}
	binding:=adp3relay.Binding{ScopeId:"scope-a",ForwardId:"forward-a",ForwardRevision:1,DeploymentGeneration:1,IngressNodeId:"node-a",EgressNodeId:"node-b",IngressAssignmentId:"assignment-a",EgressAssignmentId:"assignment-b",IngressSessionEpoch:2,EgressSessionEpoch:3,IngressFence:4,EgressFence:5,ProfileId:"profile-a",ProfileRevision:1,ProfileDigest:digest}
	config:=adp3relay.RelayConfig{Role:"relay-egress",Binding:binding,Profile:profile,PeerFingerprints:[]string{relay.Fingerprint(leaf)},Target:&adp3relay.Target{Host:"127.0.0.1",Port:9},EgressPolicyRevision:1,AllowedDestinationCidrs:[]string{"127.0.0.0/8"}}
	digest,err=contracts.ComputeDigest(config);if err!=nil{t.Fatal(err)}
	assignment:=adp3relay.Assignment{ProtocolVersion:3,NodeId:"node-b",SessionEpoch:3,AssignmentId:"assignment-b",ForwardId:"forward-a",ForwardRevision:1,DeploymentGeneration:1,BindingFence:5,Role:"relay-egress",Protocol:protocol,Phase:"prepared",Resource:adp3relay.Resource{Address:"127.0.0.1",Port:port,Protocol:"tcp"},Driver:adp3relay.RelayDriver{Id:"native.relay.v1",SchemaVersion:1,ConfigDigest:digest,Config:config},DrainTimeoutSeconds:1}
	engine,err:=relay.Prepare(assignment,relay.Identity{Certificate:tls.Certificate{Certificate:[][]byte{leafRaw},PrivateKey:private,Leaf:leaf},Roots:roots},4,allow);if err!=nil{t.Fatal(err)}
	t.Cleanup(engine.Close)
	return engine,address
}

func completePhasePortAvailable(t *testing.T,address string){t.Helper();listener,err:=net.Listen("tcp",address);if err!=nil{t.Fatal("partial start retained peer listener",err)};_ = listener.Close()}

func TestNativeExecutionCompleteRelayPhasePartialStartCleanupAndPointerIdentity(t *testing.T){
	for _,protocol:=range []string{"tcp","udp"}{for _,phase:=range []string{"prepared","active","draining","unknown","activation-denied"}{t.Run(protocol+"/"+phase,func(t *testing.T){
		var denied atomic.Bool;failure:=errors.New("AUTHORIZATION_DENIED: phase callback")
		engine,address:=completePhasePreparedRelay(t,protocol,func()error{if denied.Load(){return failure};return nil})
		if phase=="activation-denied"{denied.Store(true)}
		requested:=phase;if phase=="activation-denied"{requested="active"}
		instance,err:=FinishRelayStartInstance(engine,requested)
		if phase=="unknown"||phase=="activation-denied"{
			if instance!=nil||err==nil{t.Fatal("failed phase published partial engine")}
			if phase=="unknown"&&err.Error()!="UNSUPPORTED_CAPABILITY"{t.Fatal("unknown phase error normalized",err)}
			// The native 25ms watcher may concurrently observe revocation; both
			// original outcomes must close the partial prepared socket.
			if phase=="activation-denied"&&!errors.Is(err,failure)&&!strings.HasPrefix(err.Error(),"LEASE_EXPIRED"){t.Fatal("activation error mapping changed",err)}
			completePhasePortAvailable(t,address)
		}else{
			if err!=nil||instance!=engine{t.Fatal("successful phase lost exact native pointer",err)}
			if phase=="draining"{completePhasePortAvailable(t,address)}else{listener,err:=net.Listen("tcp",address);if err==nil{_ = listener.Close();t.Fatal("successful phase closed prepared listener")}}
		}
		engine.Close();engine.Close();completePhasePortAvailable(t,address)
	})}}
	var wrong executiondriver.Instance
	if instance,err:=FinishRelayStartInstance(wrong,"active");instance!=nil||err==nil||err.Error()!="UNSUPPORTED_CAPABILITY: Relay execution required"{t.Fatal("wrong type start error changed",err)}
	if err:=RelayPhase(wrong,"prepared");err==nil||err.Error()!="UNSUPPORTED_CAPABILITY: Relay execution required"{t.Fatal("wrong type phase precedence changed",err)}
	for _,maximum:=range []uint64{0,1,4095,4096,4097,^uint64(0)}{host:=executiondriver.Host{};host.Policy.MaxTcpConnectionsPerAssignment=maximum;host.Policy.MaxUdpSessionsPerAssignment=maximum;for _,protocol:=range []string{"tcp","udp"}{if got:=Maximum(host,adp3.Assignment{Protocol:protocol});got!=int(min(maximum,4096)){t.Fatal("native maximum boundary changed",maximum)}}}
}

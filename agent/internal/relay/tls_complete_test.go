package relay

import (
	"crypto/tls"
	"crypto/x509"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestRelayCompleteTLSProtocolPinAndRootOwnership(t *testing.T){
	ca,foreign:=createCA(t),createCA(t)
	usage:=[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth,x509.ExtKeyUsageServerAuth}
	local:=ca.issue(t,"local",usage,false)
	peer:=ca.issue(t,"peer",usage,false)
	foreignPeer:=foreign.issue(t,"peer",usage,false)
	for _,server:=range []bool{false,true}{for _,protocol:=range []string{ALPN,MultihopALPN}{
		// Both exact pins are accepted declarations; only the original CA is trusted.
		roots:=x509.NewCertPool();roots.AddCert(ca.certificate)
		pins:=[]string{Fingerprint(peer.Leaf),Fingerprint(foreignPeer.Leaf)}
		config,err:=tlsConfigProtocol(local,roots,"peer",pins,server,protocol);if err!=nil{t.Fatal(err)}
		if config.MinVersion!=tls.VersionTLS13||config.MaxVersion!=tls.VersionTLS13||!config.SessionTicketsDisabled||!reflect.DeepEqual(config.NextProtos,[]string{protocol})||server&&config.ClientAuth!=tls.RequireAndVerifyClientCert||!server&&!config.InsecureSkipVerify{t.Fatal("TLS protocol/default contract changed")}
		pins[0]="sha256:"+strings.Repeat("0",64);roots.AddCert(foreign.certificate)
		state:=tls.ConnectionState{Version:tls.VersionTLS13,NegotiatedProtocol:protocol,PeerCertificates:[]*x509.Certificate{peer.Leaf}}
		if err:=config.VerifyConnection(state);err!=nil{t.Fatal("caller pin mutation changed retained config",err)}
		state.PeerCertificates=[]*x509.Certificate{foreignPeer.Leaf}
		if err:=config.VerifyConnection(state);err==nil{t.Fatal("caller CA addition crossed cloned roots")}
		state.PeerCertificates=[]*x509.Certificate{peer.Leaf};state.NegotiatedProtocol="unknown"
		if err:=config.VerifyConnection(state);err==nil{t.Fatal("foreign ALPN accepted")}
		state.NegotiatedProtocol=protocol;state.Version=tls.VersionTLS12
		if err:=config.VerifyConnection(state);err==nil{t.Fatal("TLS1.2 state accepted")}
		state.Version=tls.VersionTLS13
		if err:=verifyPeerProtocol(state,ca.roots,"peer",[]string{Fingerprint(peer.Leaf)},x509.ExtKeyUsageServerAuth,peer.Leaf.NotAfter.Add(time.Second),protocol);err==nil{t.Fatal("per-handshake certificate time boundary ignored")}
	}}
}

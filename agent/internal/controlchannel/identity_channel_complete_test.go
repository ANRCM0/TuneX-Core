package controlchannel

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
)

type identityChannelCompleteTransport struct { roundTrip func(*http.Request)(*http.Response,error); idle int }
func (r *identityChannelCompleteTransport) RoundTrip(request *http.Request)(*http.Response,error){return r.roundTrip(request)}
func (r *identityChannelCompleteTransport) CloseIdleConnections(){r.idle++}
type identityChannelCompleteBody struct { reader io.Reader; consumed,closes int; failure error; trace *[]string }
func (b *identityChannelCompleteBody) Read(raw []byte)(int,error){*b.trace=append(*b.trace,"read");n,err:=b.reader.Read(raw);b.consumed+=n;if b.failure!=nil{return n,b.failure};return n,err}
func (b *identityChannelCompleteBody) Close()error{*b.trace=append(*b.trace,"close");b.closes++;return errors.New("ignored close failure")}

func TestIdentityChannelCompleteNativeClientPolicyAndLiveCertificateCallback(t *testing.T){
	roots:=x509.NewCertPool();current:=tls.Certificate{Certificate:[][]byte{{1}},Leaf:&x509.Certificate{SerialNumber:big.NewInt(1)}};calls:=0
	client:=(Native{}).NewClient(roots,func()tls.Certificate{calls++;return current})
	transport,ok:=client.Transport.(*http.Transport);if !ok||transport.TLSClientConfig.RootCAs!=roots||transport.TLSClientConfig.MinVersion!=tls.VersionTLS13||transport.TLSClientConfig.InsecureSkipVerify||client.Timeout!=10*time.Second{t.Fatal("native channel TLS/timeout policy changed")}
	if err:=client.CheckRedirect(nil,nil);err==nil||err.Error()!="Control redirects are forbidden"{t.Fatalf("native redirect refusal: %v",err)}
	first,err:=transport.TLSClientConfig.GetClientCertificate(&tls.CertificateRequestInfo{});if err!=nil||first.Leaf!=current.Leaf||calls!=1{t.Fatal("initial callback identity")}
	old:=current.Leaf;current=tls.Certificate{Certificate:[][]byte{{2}},Leaf:&x509.Certificate{SerialNumber:big.NewInt(2)}}
	second,err:=transport.TLSClientConfig.GetClientCertificate(nil);if err!=nil||second.Leaf!=current.Leaf||first.Leaf!=old||second==first||calls!=2{t.Fatal("rotating callback lost old/current value")}
}

func TestIdentityChannelCompleteRequestHeadersBoundsCloseAndErrors(t *testing.T){
	for _,mode:=range []string{"normal","epoch-off","exact-limit","limit-plus-one","over-limit-truncated","reader","status","partial-code","duplicate-code","invalid-code","io","cancel"}{t.Run(mode,func(t *testing.T){
		trace:=[]string{};data:=[]byte{255,0,128,'x'};status:=200;epoch:=mode!="epoch-off"
		switch mode{case "exact-limit":data=bytes.Repeat([]byte{'x'},4194304);case "limit-plus-one":data=bytes.Repeat([]byte{'x'},4194305);case "over-limit-truncated":data=bytes.Repeat([]byte{'x'},4194306);case "status":status=503;data=[]byte(`{"code":"DENIED"}`);case "partial-code":status=401;data=[]byte(`{"code":"PARTIAL","extra":`);case "duplicate-code":status=403;data=[]byte(`{"code":"FIRST","code":"LAST"}`);case "invalid-code":status=500;data=[]byte(`{"code":19}`)}
		body:=&identityChannelCompleteBody{reader:bytes.NewReader(data),trace:&trace};failure:=errors.New("original native read or transport");if mode=="reader"{body.failure=failure}
		ctx,cancel:=context.WithCancel(context.Background());defer cancel();if mode=="cancel"{cancel()}
		transport:=&identityChannelCompleteTransport{roundTrip:func(request *http.Request)(*http.Response,error){
			trace=append(trace,"request");if request.Context()!=ctx||request.Method!="PATCH"||request.URL.String()!="https://control.invalid/base/agent/v3/snapshot?sinceGeneration=9"||request.Header.Get("Content-Type")!="application/json"{t.Fatalf("main request shape: %+v",request)}
			wantEpoch:="18446744073709551615";if !epoch{wantEpoch=""};if request.Header.Get("X-TuneX-Session-Epoch")!=wantEpoch{t.Fatal("epoch opt-in/full uint64 changed")}
			raw,err:=io.ReadAll(request.Body);if err!=nil||!bytes.Equal(raw,[]byte{0,255,128,'r'}){t.Fatalf("request original bytes: %x %v",raw,err)}
			if mode=="io"{return nil,failure};if mode=="cancel"{return nil,ctx.Err()};return &http.Response{StatusCode:status,Body:body,Header:http.Header{}},nil
		}}
		client:=&http.Client{Transport:transport};raw,err:=(Native{}).Request(ctx,client,"https://control.invalid/base///","PATCH","/agent/v3/snapshot?sinceGeneration=9",[]byte{0,255,128,'r'},epoch,^uint64(0))
		if mode=="io"||mode=="cancel"{want:=failure;if mode=="cancel"{want=context.Canceled};if !errors.Is(err,want)||raw!=nil||body.closes!=0{t.Fatalf("transport/cancel identity: %x %v closes%d",raw,err,body.closes)};return}
		if body.closes!=1||trace[len(trace)-1]!="close"{t.Fatalf("deferred body close count/order: %v",trace)}
		if mode=="reader"{if err!=failure||raw!=nil{t.Fatalf("read original error: %x %v",raw,err)};return}
		if status!=200{var problem executionchannel.HTTPError;if raw!=nil||!errors.As(err,&problem)||problem.Status!=status{t.Fatalf("status mapping: %x %v",raw,err)};wantCode:=map[string]string{"status":"DENIED","duplicate-code":"LAST"}[mode];if problem.Code!=wantCode{t.Fatalf("original permissive code %s: %q want%q",mode,problem.Code,wantCode)};return}
		wantSize:=len(data);if wantSize>4194305{wantSize=4194305};if err!=nil||len(raw)!=wantSize||!bytes.Equal(raw,data[:wantSize])||body.consumed!=wantSize{t.Fatalf("native bounded raw reply: %d/%d %v consumed%d",len(raw),wantSize,err,body.consumed)}
		(Native{}).CloseIdleConnections(client);if transport.idle!=1{t.Fatal("idle close not forwarded once")}
	})}
	transport:=&identityChannelCompleteTransport{roundTrip:func(*http.Request)(*http.Response,error){t.Fatal("malformed URL reached transport");return nil,nil}};if _,err:=(Native{}).Request(context.Background(),&http.Client{Transport:transport},"https://%","POST","/x",nil,false,0);err==nil{t.Fatal("native URL parse error lost")}
}

func TestIdentityChannelCompleteRedirectNeverRetriesAndCancellationCloses(t *testing.T){
	var calls atomic.Int32
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){calls.Add(1);http.Redirect(w,r,"/target",http.StatusTemporaryRedirect)}));defer server.Close()
	client:=(Native{}).NewClient(x509.NewCertPool(),func()tls.Certificate{return tls.Certificate{}});defer (Native{}).CloseIdleConnections(client)
	if _,err:=(Native{}).Request(context.Background(),client,server.URL,"POST","/initial",[]byte("body"),true,2);err==nil||!strings.Contains(err.Error(),"Control redirects are forbidden")||calls.Load()!=1{t.Fatalf("redirect reached another request: %v calls%d",err,calls.Load())}
	entered:=make(chan struct{});finished:=make(chan struct{})
	cancelServer:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){defer close(finished);close(entered);<-r.Context().Done()}));defer cancelServer.Close()
	ctx,cancel:=context.WithCancel(context.Background());done:=make(chan error,1);go func(){_,err:=(Native{}).Request(ctx,client,cancelServer.URL,"POST","/wait",nil,false,0);done<-err}()
	select{case <-entered:case <-time.After(5*time.Second):t.Fatal("request never reached cancellation fixture")};cancel()
	select{case err:=<-done:if !errors.Is(err,context.Canceled){t.Fatalf("native cancel: %v",err)};case <-time.After(5*time.Second):t.Fatal("main channel did not cancel")}
	select{case <-finished:case <-time.After(5*time.Second):t.Fatal("server context not closed")}
}

func identityChannelCompleteCertificate(t *testing.T,ca *x509.Certificate,caKey ed25519.PrivateKey,serial int64,name string,server bool)(tls.Certificate,*x509.Certificate,ed25519.PrivateKey){
	t.Helper();public,key,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)};now:=time.Now()
	template:=&x509.Certificate{SerialNumber:big.NewInt(serial),Subject:pkix.Name{CommonName:name},NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour),BasicConstraintsValid:true,KeyUsage:x509.KeyUsageDigitalSignature}
	if ca==nil{template.IsCA=true;template.KeyUsage|=x509.KeyUsageCertSign;ca=template;caKey=key}else if server{template.ExtKeyUsage=[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth};template.IPAddresses=[]net.IP{net.ParseIP("127.0.0.1")}}else{template.ExtKeyUsage=[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}
	der,err:=x509.CreateCertificate(rand.Reader,template,ca,public,caKey);if err!=nil{t.Fatal(err)};parsed,err:=x509.ParseCertificate(der);if err!=nil{t.Fatal(err)};return tls.Certificate{Certificate:[][]byte{der},PrivateKey:key,Leaf:parsed},parsed,key
}

func TestIdentityChannelCompleteRealTLSUsesConfiguredTrustAndRotatingCertificate(t *testing.T){
	_,ca,caKey:=identityChannelCompleteCertificate(t,nil,nil,1,"configured-root",false)
	serverCert,_,_:=identityChannelCompleteCertificate(t,ca,caKey,2,"server",true)
	first,_,_:=identityChannelCompleteCertificate(t,ca,caKey,3,"node-before",false);second,_,_:=identityChannelCompleteCertificate(t,ca,caKey,4,"node-after",false)
	roots:=x509.NewCertPool();roots.AddCert(ca)
	var seenMutex sync.Mutex;var seen []string
	server:=httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){if r.TLS==nil||r.TLS.Version!=tls.VersionTLS13||len(r.TLS.PeerCertificates)!=1{t.Error("native mTLS handshake shape")};name:=r.TLS.PeerCertificates[0].Subject.CommonName;seenMutex.Lock();seen=append(seen,name);seenMutex.Unlock();w.Write([]byte(name))}))
	server.TLS=&tls.Config{Certificates:[]tls.Certificate{serverCert},ClientCAs:roots,ClientAuth:tls.RequireAndVerifyClientCert,MinVersion:tls.VersionTLS13};server.StartTLS();defer server.Close()
	var mutex sync.Mutex;current:=first;callbackCalls:=0
	client:=(Native{}).NewClient(roots,func()tls.Certificate{mutex.Lock();defer mutex.Unlock();callbackCalls++;return current});defer (Native{}).CloseIdleConnections(client)
	for index,want:=range []string{"node-before","node-after"}{if index==1{mutex.Lock();current=second;mutex.Unlock();(Native{}).CloseIdleConnections(client)};raw,err:=(Native{}).Request(context.Background(),client,server.URL,"POST","/identity",[]byte(`{}`),true,2);if err!=nil||string(raw)!=want{t.Fatalf("mTLS callback rotation%d: %s %v",index,raw,err)}}
	seenMutex.Lock();actual:=append([]string(nil),seen...);seenMutex.Unlock();mutex.Lock();count:=callbackCalls;mutex.Unlock();if !reflect.DeepEqual(actual,[]string{"node-before","node-after"})||count!=2{t.Fatalf("TLS no retry/current callback: %v count%d",actual,count)}
	untrusted:=(Native{}).NewClient(x509.NewCertPool(),func()tls.Certificate{return second});defer (Native{}).CloseIdleConnections(untrusted);if _,err:=(Native{}).Request(context.Background(),untrusted,server.URL,"POST","/identity",nil,false,0);err==nil{t.Fatal("unconfigured server trust accepted")}
}

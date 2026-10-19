package nativeexecution

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/executionidentity"
)

func TestPendingResponseCompleteNativeRelayProjectionAndRenewalAreDetachedValues(t *testing.T){
	overlap:="2030-01-02T03:04:05Z";response:=agentidentity.RelayResponse{NodeID:"node",Certificate:"certificate",CA:"informational-ca",Fingerprint:"hash",ValidUntil:"until",CertificateNotAfter:"not-after",OverlapUntil:&overlap};request:=executionidentity.RotationRequest{RequestID:"request",CSR:"csr",PrivateKey:"private"};beforeResponse,beforeRequest:=response,request
	want:=executionidentity.RelayBundle{NodeID:"node",Certificate:"certificate",PrivateKey:"private",Fingerprint:"sha256:hash",ValidUntil:"until",CertificateNotAfter:"not-after",RequestID:"request"};got:=RelayCredentialResponseBundle(response,request);if !reflect.DeepEqual(got,want)||!reflect.DeepEqual(response,beforeResponse)||request!=beforeRequest{t.Fatal("native response field projection/mutation",got)}
	// CA and overlap remain parent-owned validation inputs. The projection does
	// not interpret them, deduplicate a prefix, or infer a renewal time/clock.
	response.CA="other";response.OverlapUntil=nil;if RelayCredentialResponseBundle(response,request)!=want{t.Fatal("response-only validation fields leaked into bundle")};response.Fingerprint="sha256:hash";if value:=RelayCredentialResponseBundle(response,request);value.Fingerprint!="sha256:sha256:hash"{t.Fatal("projection normalized original fingerprint",value.Fingerprint)}
	renew:=time.Date(2030,1,2,11,4,5,123456789,time.FixedZone("offset",8*60*60));with:=RelayCredentialWithRenewal(got,renew);if with.RenewAfter!="2030-01-02T03:04:05.123456789Z"||got!=want{t.Fatal("renewal native UTC/value preservation",with,got)};with.RenewAfter="";if with!=got{t.Fatal("renewal changed non-renewal fields")}
	raw,err:=EncodeCredentialRotation(request);if err!=nil||string(raw)!=`{"csr":"csr","requestId":"request"}`{t.Fatal("native request fields/order",string(raw),err)};var fields map[string]any;if err:=json.Unmarshal(raw,&fields);err!=nil||len(fields)!=2{t.Fatal("native request acquired private key or record metadata",err)}
}

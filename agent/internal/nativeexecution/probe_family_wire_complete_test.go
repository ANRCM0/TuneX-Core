package nativeexecution

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
)

const familyWireIssued="2026-10-19T01:02:03.000Z"
const familyWireConsumed="2026-10-19T01:02:03.100Z"
const familyWireMeasured="2026-10-19T01:02:03.200Z"
const familyWireValid="2026-10-19T01:02:04.000Z"
const familyWireExpires="2026-10-19T01:02:05.000Z"

type familyWireAdapter struct{
	name string
	version int
	machine,descriptor,measurements,selection string
	qualification func(string,[]string)(any,[]byte,error)
	poll func([]string)(any,[]byte,error)
	claim func()(any,[]byte,error)
	status func()(any,[]byte,error)
	result func()(any,error)
	decode map[string]func(any,[]byte)(any,error)
	parse map[string]func([]byte)(any,error)
	digest func(any)(string,error)
}

func familyWireDecoder[Request,Response any](fn func(Request,[]byte)(*Response,error))func(any,[]byte)(any,error){
	return func(request any,raw []byte)(any,error){v,err:=fn(request.(Request),raw);if err!=nil{return nil,err};return *v,nil}
}
func familyWireParser[Response any](fn func([]byte)(*Response,error))func([]byte)(any,error){
	return func(raw []byte)(any,error){v,err:=fn(raw);if err!=nil{return nil,err};return *v,nil}
}

func familyWireFixtures()[]familyWireAdapter{
	instance,id:=strings.Repeat("a",64),strings.Repeat("b",64)
	m2:=ProbeTypesMachine("node","boot",2,instance,3,id);m3:=ProbeServicesMachine("node","boot",2,instance,3,id);m4:=ProbeEchoMachine("node","boot",2,instance,3,id)
	d2:=probetypes.Descriptor{Measurement:"tcp-connect-v1",TaskKind:"tcp-connect",Point:"agent-direct-egress",Capability:"probe.tcp-connect.v1"}
	d3:=probeservices.Descriptor{Measurement:d2.Measurement,TaskKind:d2.TaskKind,Point:d2.Point,Capability:d2.Capability}
	d4:=probeecho.Descriptor{Measurement:d2.Measurement,TaskKind:d2.TaskKind,Point:d2.Point,Capability:d2.Capability,BusinessProtocol:"tcp"}
	binding:=probetypes.Binding{NodeId:"node",BootId:"boot",SessionEpoch:2,SnapshotGeneration:4,AssignmentId:"assignment",ForwardId:"forward",ForwardRevision:5,DeploymentGeneration:6,BindingFence:7,ConfigDigest:"sha256:"+strings.Repeat("c",64),EgressPolicyRevision:8}
	fields:=proberesult.Request{NodeId:"node",BootId:"boot",SessionEpoch:2,InstanceId:instance,InstanceGeneration:3,RequestId:id,PermitId:"permit",TimeoutMs:1000,IssuedAt:familyWireIssued,ExpiresAt:familyWireExpires,ConsumedAt:familyWireConsumed,MeasuredAt:familyWireMeasured,ValidUntil:familyWireValid,ElapsedMs:5,Point:"agent-direct-egress",Status:"connected",Code:"tcp-connected",ApplicationHealth:"discarded",Source:"discarded",ApplicationPayloadBytes:99}
	baseDescriptor:=`"measurement":"tcp-connect-v1","taskKind":"tcp-connect","point":"agent-direct-egress","capability":"probe.tcp-connect.v1"`
	fixtures:=[]familyWireAdapter{
		{name:"types",version:2,descriptor:baseDescriptor,measurements:`["tcp-connect-v1","tcp-ingress-connect-v1"]`,
		 qualification:func(action string,ms []string)(any,[]byte,error){return EncodeProbeTypesQualification(m2,action,ms)},poll:func(ms []string)(any,[]byte,error){return EncodeProbeTypesPoll(m2,ms)},
		 claim:func()(any,[]byte,error){r:=ProbeTypesClaimRequest(m2,d2,"permit");raw,err:=EncodeProbeTypesClaim(r);return r,raw,err},status:func()(any,[]byte,error){return EncodeProbeTypesStatus(m2,d2,"permit")},result:func()(any,error){return ProbeTypesResult(fields,d2,binding)},
		 decode:map[string]func(any,[]byte)(any,error){"qualification":familyWireDecoder(DecodeProbeTypesQualification),"poll":familyWireDecoder(DecodeProbeTypesPoll),"claim":familyWireDecoder(DecodeProbeTypesClaim),"status":familyWireDecoder(DecodeProbeTypesStatus),"result":familyWireDecoder(DecodeProbeTypesResultResponse)},
		 parse:map[string]func([]byte)(any,error){"qualification":familyWireParser(probetypes.ParseQualificationResponse),"poll":familyWireParser(probetypes.ParsePollResponse),"claim":familyWireParser(probetypes.ParseClaimResponse),"status":familyWireParser(probetypes.ParseStatusResponse),"result":familyWireParser(probetypes.ParseResultResponse)},
		 digest:func(value any)(string,error){return probetypes.ResultDigest(value.(probetypes.ResultRequest))}},
		{name:"services",version:3,descriptor:baseDescriptor,measurements:`["tcp-connect-v1","tcp-ingress-connect-v1","tcp-ingress-tls-v1"]`,selection:`,"service":null`,
		 qualification:func(action string,ms []string)(any,[]byte,error){return EncodeProbeServicesQualification(m3,action,ms)},poll:func(ms []string)(any,[]byte,error){return EncodeProbeServicesPoll(m3,ms)},
		 claim:func()(any,[]byte,error){r:=ProbeServicesClaimRequest(m3,d3,"permit",nil);raw,err:=EncodeProbeServicesClaim(r);return r,raw,err},status:func()(any,[]byte,error){return EncodeProbeServicesStatus(m3,d3,"permit",nil)},result:func()(any,error){return ProbeServicesResult(fields,d3,binding,nil,nil)},
		 decode:map[string]func(any,[]byte)(any,error){"qualification":familyWireDecoder(DecodeProbeServicesQualification),"poll":familyWireDecoder(DecodeProbeServicesPoll),"claim":familyWireDecoder(DecodeProbeServicesClaim),"status":familyWireDecoder(DecodeProbeServicesStatus),"result":familyWireDecoder(DecodeProbeServicesResultResponse)},
		 parse:map[string]func([]byte)(any,error){"qualification":familyWireParser(probeservices.ParseQualificationResponse),"poll":familyWireParser(probeservices.ParsePollResponse),"claim":familyWireParser(probeservices.ParseClaimResponse),"status":familyWireParser(probeservices.ParseStatusResponse),"result":familyWireParser(probeservices.ParseResultResponse)},
		 digest:func(value any)(string,error){return probeservices.ResultDigest(value.(probeservices.ResultRequest))}},
		{name:"echo",version:4,descriptor:baseDescriptor+`,"businessProtocol":"tcp"`,measurements:`["tcp-connect-v1","tcp-ingress-connect-v1","tcp-ingress-tls-v1","tcp-ingress-echo-v1","udp-ingress-echo-v1"]`,selection:`,"service":null,"challenge":null`,
		 qualification:func(action string,ms []string)(any,[]byte,error){return EncodeProbeEchoQualification(m4,action,ms)},poll:func(ms []string)(any,[]byte,error){return EncodeProbeEchoPoll(m4,ms)},
		 claim:func()(any,[]byte,error){r:=ProbeEchoClaimRequest(m4,d4,"permit",nil,nil);raw,err:=EncodeProbeEchoClaim(r);return r,raw,err},status:func()(any,[]byte,error){return EncodeProbeEchoStatus(m4,d4,"permit",nil,nil)},result:func()(any,error){return ProbeEchoResult(fields,d4,binding,nil,nil,nil,0,0)},
		 decode:map[string]func(any,[]byte)(any,error){"qualification":familyWireDecoder(DecodeProbeEchoQualification),"poll":familyWireDecoder(DecodeProbeEchoPoll),"claim":familyWireDecoder(DecodeProbeEchoClaim),"status":familyWireDecoder(DecodeProbeEchoStatus),"result":familyWireDecoder(DecodeProbeEchoResultResponse)},
		 parse:map[string]func([]byte)(any,error){"qualification":familyWireParser(probeecho.ParseQualificationResponse),"poll":familyWireParser(probeecho.ParsePollResponse),"claim":familyWireParser(probeecho.ParseClaimResponse),"status":familyWireParser(probeecho.ParseStatusResponse),"result":familyWireParser(probeecho.ParseResultResponse)},
		 digest:func(value any)(string,error){return probeecho.ResultDigest(value.(probeecho.ResultRequest))}},
	}
	for i:=range fixtures{f:=&fixtures[i];f.machine=fmt.Sprintf(`"protocolVersion":3,"probeVersion":%d,"nodeId":"node","bootId":"boot","sessionEpoch":2,"instanceId":"%s","instanceGeneration":3,"requestId":"%s"`,f.version,instance,id)}
	return fixtures
}

func familyWireBindingJSON()string{return `{"nodeId":"node","bootId":"boot","sessionEpoch":2,"snapshotGeneration":4,"assignmentId":"assignment","forwardId":"forward","forwardRevision":5,"deploymentGeneration":6,"bindingFence":7,"configDigest":"sha256:`+strings.Repeat("c",64)+`","egressPolicyRevision":8}`}

func TestProbeFamilyCompleteLiteralProjectionAndNoDowngrade(t *testing.T){
	for _,f:=range familyWireFixtures(){t.Run(f.name,func(t *testing.T){
		var measurements []string;if err:=json.Unmarshal([]byte(f.measurements),&measurements);err!=nil{t.Fatal(err)}
		for _,action:=range []string{"inspect","register","revoke"}{
			request,raw,err:=f.qualification(action,measurements);want:="{"+f.machine+`,"kind":"probe-`+f.name+`-instance","action":"`+action+`","measurements":`+f.measurements+"}"
			if err!=nil||string(raw)!=want{t.Fatal("qualification literal bytes",string(raw),err,want)};remarshal,err:=EncodeProbeRequest(request);if err!=nil||string(remarshal)!=want{t.Fatal("exchange second encoding differs",string(remarshal),err)}
		}
		request,raw,err:=f.poll(measurements);want:="{"+f.machine+`,"kind":"probe-`+f.name+`-poll","measurements":`+f.measurements+"}";if err!=nil||string(raw)!=want{t.Fatal("poll literal bytes",string(raw),err)};second,_:=EncodeProbeRequest(request);if string(second)!=want{t.Fatal("poll second encoding differs")}
		for _,operation:=range []string{"claim","status"}{var request any;var raw []byte;var err error;if operation=="claim"{request,raw,err=f.claim()}else{request,raw,err=f.status()};want:="{"+f.machine+","+f.descriptor+`,"kind":"probe-`+f.name+"-"+operation+`","permitId":"permit"`+f.selection+"}";if err!=nil||string(raw)!=want{t.Fatal(operation+" field/null/version projection",string(raw),err,want)};second,_:=EncodeProbeRequest(request);if string(second)!=want{t.Fatal(operation+" exchange bytes differ")}}
		result,err:=f.result();if err!=nil{t.Fatal("valid original result rejected",err)};raw,err=json.Marshal(result)
		want="{"+f.machine+","+f.descriptor+`,"kind":"probe-`+f.name+`-result","permitId":"permit"`+f.selection+`,"binding":`+familyWireBindingJSON()+`,"timeoutMs":1000,"issuedAt":"`+familyWireIssued+`","expiresAt":"`+familyWireExpires+`","consumedAt":"`+familyWireConsumed+`","measuredAt":"`+familyWireMeasured+`","validUntil":"`+familyWireValid+`","elapsedMs":5,"status":"connected","code":"tcp-connected"`
		if f.version>=3{want+=`,"tls":null`};if f.version==4{want+=`,"echo":null,"requestBytes":0,"responseBytes":0`};want+=`,"applicationHealth":"unknown","source":"agent-reported","applicationPayloadBytes":0}`
		if err!=nil||string(raw)!=want{t.Fatal("result literal fields/nulls/version/bytes",string(raw),err,want)}
		var body map[string]json.RawMessage;if err:=json.Unmarshal([]byte(want),&body);err!=nil{t.Fatal(err)};delete(body,"requestId");wantDigest,err:=contracts.ComputeDigest(body);if err!=nil{t.Fatal(err)};digest,err:=f.digest(result);if err!=nil||digest!=wantDigest{t.Fatal("family digest did not retain actual fields",digest,wantDigest,err)}
	})}
}

func TestProbeFamilyCompleteQualificationPollClaimStatusResultParseBeforeCheck(t *testing.T){
	for _,f:=range familyWireFixtures(){t.Run(f.name,func(t *testing.T){
		var measurements []string;_ = json.Unmarshal([]byte(f.measurements),&measurements)
		qualification,_,err:=f.qualification("inspect",measurements);if err!=nil{t.Fatal(err)};poll,_,err:=f.poll(measurements);if err!=nil{t.Fatal(err)};claim,_,err:=f.claim();if err!=nil{t.Fatal(err)};status,_,err:=f.status();if err!=nil{t.Fatal(err)};result,err:=f.result();if err!=nil{t.Fatal(err)}
		digest,err:=f.digest(result);if err!=nil{t.Fatal(err)}
		consumedFields:=`,"binding":`+familyWireBindingJSON()+`,"timeoutMs":1000,"issuedAt":"`+familyWireIssued+`","expiresAt":"`+familyWireExpires+`","consumedAt":"`+familyWireConsumed+`","serverTime":"`+familyWireMeasured+`","state":"consumed","executionEnabled":false`
		responses:=map[string]string{
		 "qualification":"{"+f.machine+`,"kind":"probe-`+f.name+`-instance-ack","action":"inspect","measurements":`+f.measurements+`,"qualified":false,"qualifiedAt":null,"expiresAt":null,"serverTime":"`+familyWireMeasured+`","executionEnabled":false}`,
		 "poll":"{"+f.machine+`,"kind":"probe-`+f.name+`-poll-ack","measurements":`+f.measurements+`,"observedAt":"`+familyWireConsumed+`","serverTime":"`+familyWireMeasured+`","executionEnabled":false,"offer":null}`,
		 "claim":"{"+f.machine+","+f.descriptor+`,"kind":"probe-`+f.name+`-claim-ack","permitId":"permit"`+f.selection+consumedFields+"}",
		 "status":"{"+f.machine+","+f.descriptor+`,"kind":"probe-`+f.name+`-status-ack","permitId":"permit"`+f.selection+consumedFields+`,"checkedAt":"`+familyWireConsumed+`"}`,
		 "result":"{"+f.machine+","+f.descriptor+`,"kind":"probe-`+f.name+`-result-ack","permitId":"permit"`+f.selection+`,"resultDigest":"`+digest+`","acceptedAt":"`+familyWireMeasured+`","serverTime":"`+familyWireMeasured+`","duplicate":false,"health":"unknown","executionEnabled":false}`,
		}
		requests:=map[string]any{"qualification":qualification,"poll":poll,"claim":claim,"status":status,"result":result}
		for _,operation:=range []string{"qualification","poll","claim","status","result"}{t.Run(operation,func(t *testing.T){
			request,raw:=requests[operation],[]byte(responses[operation]);want,err:=f.parse[operation](raw);if err!=nil{t.Fatal("valid response fixture rejected",err,string(raw))};got,err:=f.decode[operation](request,raw);if err!=nil||!reflect.DeepEqual(got,want){t.Fatal("Parse+Check output",got,want,err)}
			mismatch:=strings.Replace(string(raw),strings.Repeat("b",64),strings.Repeat("d",64),1);if _,err:=f.parse[operation]([]byte(mismatch));err!=nil{t.Fatal("correlation fixture must pass Parse",err)};if got,err:=f.decode[operation](request,[]byte(mismatch));err==nil||got!=nil{t.Fatal("Check did not reject valid foreign response")}
			// With both an invalid request and malformed response, the original
			// decoder must still report response Parse before request Check.
			badRequest:=reflect.New(reflect.TypeOf(request)).Elem();badRequest.Set(reflect.ValueOf(request));badRequest.FieldByName("RequestId").SetString("invalid")
			for _,invalid:=range []string{"{",`{}`,strings.TrimSuffix(string(raw),"}")+`,"unknown":true}`,strings.TrimSuffix(string(raw),"}")+`,"kind":"duplicate"}`} {
				_,wantErr:=f.parse[operation]([]byte(invalid));got,err:=f.decode[operation](badRequest.Interface(),[]byte(invalid));if wantErr==nil||err==nil||err.Error()!=wantErr.Error()||got!=nil{t.Fatal("strict Parse-before-Check/error identity",err,wantErr,invalid)}
			}
		})}
	})}
}

func TestProbeFamilyCompletePrevalidationErrorsKeepRequestProjection(t *testing.T){
	for _,f:=range familyWireFixtures(){t.Run(f.name,func(t *testing.T){
		for _,operation:=range []string{"qualification","poll"}{var request any;var raw []byte;var err error;if operation=="qualification"{request,raw,err=f.qualification("invalid",nil)}else{request,raw,err=f.poll(nil)};if err==nil||raw!=nil{t.Fatal("invalid prevalidation reached exchange",operation,err)}
			projection,_:=json.Marshal(request);if !strings.Contains(string(projection),fmt.Sprintf(`"probeVersion":%d`,f.version))||!strings.Contains(string(projection),`"measurements":null`){t.Fatal("request was zeroed or downgraded on Parse failure",string(projection))}
		}
	})}
}

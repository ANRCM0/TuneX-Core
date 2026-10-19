import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as Node from '../src/modules/node-owner/public.ts';
import type { Nodes } from '../src/modules/nodes.ts';
import type { ControlApi } from '../src/api/public.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type Flat<T>={[K in keyof T]:T[K]};
type MutableKeys<T>={[K in keyof T]-?:Equal<{[P in K]:T[P]},{-readonly[P in K]:T[P]}> extends true?K:never}[keyof T];
type RequiredKeys<T>={[K in keyof T]-?:{} extends Pick<T,K>?never:K}[keyof T];
type ExpectedPolicy={
    readonly allowedListenerAddresses:readonly string[];readonly allowedPorts:readonly number[];
    readonly egressPolicyRevision:number;readonly allowedDestinationCidrs:readonly string[];readonly allowMetadataTargets:boolean;
};
type ExpectedEnrollment={certificate:string;ca:string};
type ExpectedProvisioned={nodeId:string;enrollmentToken:string;expiresAt:string};
type ExpectedRotation={certificate:string;ca:string;fingerprint:string;validUntil:string;oldCredentialUntil:string};
type ExpectedRelayCredential={nodeId:string;certificate:string;ca:string;fingerprint:string;validUntil:string;certificateNotAfter:string;overlapUntil:string|null};
type ExpectedGrantView={nodeId:string;revision:number;actorIds:string[]};
type ExpectedNodeView={
    nodeId:string;scopeId:string;policy:unknown;revoked:boolean;pendingRevocation:boolean;
    latestAuthorizationUntil:string|null;
    credentials:{fingerprint:string;validUntil:string;retireAfter:string|null;revoked:boolean}[];
};
type ExpectedNodeApi={
    machine(fingerprint:string):Promise<string>;
    enroll(nodeId:string,token:string,csr:string):Promise<ExpectedEnrollment>;
    provision(actor:string,scope:string,policy:ExpectedPolicy):Promise<ExpectedProvisioned>;
    listGrants(actor:string,scopeId:string,nodeId:string):Promise<ExpectedGrantView>;
    view(actor:string,scope:string,nodeId:string):Promise<ExpectedNodeView>;
    rotate(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<ExpectedRotation>;
    relayCredential(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<ExpectedRelayCredential>;
};
type Tx={readonly distinctTransaction:unique symbol};
export type IndependentNodeHttpContract23=[
    Same<Equal<Flat<Node.NodeApi>,ExpectedNodeApi>>,Same<Equal<Flat<ControlApi['nodes']>,ExpectedNodeApi>>,
    Same<Equal<Flat<Pick<Node.NodeService<Tx>,keyof ExpectedNodeApi>>,ExpectedNodeApi>>,
    Same<Equal<Flat<Pick<Nodes,keyof ExpectedNodeApi>>,ExpectedNodeApi>>,
    Same<Equal<Node.NodePolicy,ExpectedPolicy>>,Same<Equal<Node.NodeEnrollment,ExpectedEnrollment>>,
    Same<Equal<Node.NodeProvisioned,ExpectedProvisioned>>,Same<Equal<Node.NodeRotation,ExpectedRotation>>,
    Same<Equal<Node.NodeRelayCredential,ExpectedRelayCredential>>,Same<Equal<Node.NodeGrantView,ExpectedGrantView>>,
    Same<Equal<Node.NodeView,ExpectedNodeView>>,
    Same<Equal<RequiredKeys<Node.NodeApi>,keyof ExpectedNodeApi>>,
    Same<Equal<MutableKeys<Node.NodeEnrollment>,keyof ExpectedEnrollment>>,
    Same<Equal<MutableKeys<Node.NodeProvisioned>,keyof ExpectedProvisioned>>,
    Same<Equal<MutableKeys<Node.NodeRotation>,keyof ExpectedRotation>>,
    Same<Equal<MutableKeys<Node.NodeRelayCredential>,keyof ExpectedRelayCredential>>,
    Same<Equal<MutableKeys<Node.NodeGrantView>,keyof ExpectedGrantView>>,
    Same<Equal<MutableKeys<Node.NodeView>,keyof ExpectedNodeView>>,
    Same<Equal<RequiredKeys<Node.NodeView['credentials'][number]>,'fingerprint'|'validUntil'|'retireAfter'|'revoked'>>,
    Same<Equal<MutableKeys<Node.NodeView['credentials'][number]>,'fingerprint'|'validUntil'|'retireAfter'|'revoked'>>,
    Same<Equal<Extract<keyof Node.NodeApi,'transaction'|'store'|'db'|'codec'|'signer'|'now'>,never>>,
];

test('23 independent complete NodeApi retains all seven inherited methods mutable DTO fields null credentials and exact argument order',async()=>{
    const calls:[string,unknown[]][]=[],failure=new Error('original provider error');let reject=false;
    function call(name:string,args:unknown[]){calls.push([name,args]);if(reject)throw failure;}
    const api={
        async machine(...args){call('machine',args);return 'node-a';},
        async enroll(...args){call('enroll',args);return {certificate:'certificate-a',ca:'ca-a'};},
        async provision(...args){call('provision',args);return {nodeId:'node-a',enrollmentToken:'token-a',expiresAt:'expiry-a'};},
        async listGrants(...args){call('listGrants',args);return {nodeId:'node-a',revision:1,actorIds:['actor-a']};},
        async view(...args){call('view',args);return {nodeId:'node-a',scopeId:'scope-a',policy:undefined,revoked:false,pendingRevocation:false,latestAuthorizationUntil:null,credentials:[{fingerprint:'fingerprint-a',validUntil:'until-a',retireAfter:null,revoked:false}]};},
        async rotate(...args){call('rotate',args);return {certificate:'certificate-a',ca:'ca-a',fingerprint:'next-a',validUntil:'until-a',oldCredentialUntil:'old-a'};},
        async relayCredential(...args){call('relayCredential',args);return {nodeId:'node-a',certificate:'relay-a',ca:'ca-a',fingerprint:'relay-fingerprint',validUntil:'until-a',certificateNotAfter:'certificate-until-a',overlapUntil:null};},
    } satisfies Node.NodeApi;
    const publicApi:Node.NodeApi=api,policy:ExpectedPolicy={allowedListenerAddresses:[],allowedPorts:[],egressPolicyRevision:1,allowedDestinationCidrs:[],allowMetadataTargets:false};
    assert.equal(await publicApi.machine('fingerprint-a'),'node-a');
    const enrolled=await publicApi.enroll('node-a','token-a','csr-a');enrolled.certificate='changed-certificate';assert.equal(enrolled.certificate,'changed-certificate');
    const provisioned=await publicApi.provision('actor-a','scope-a',policy);provisioned.enrollmentToken='changed-token';assert.equal(provisioned.enrollmentToken,'changed-token');
    const grants=await publicApi.listGrants('actor-a','scope-a','node-a');grants.actorIds.push('actor-b');assert.deepEqual(grants.actorIds,['actor-a','actor-b']);
    const viewed=await publicApi.view('actor-a','scope-a','node-a');assert.equal(viewed.policy,undefined);assert.equal(viewed.latestAuthorizationUntil,null);viewed.policy={raw:true};viewed.credentials[0]!.revoked=true;assert.equal(viewed.credentials[0]?.retireAfter,null);assert.equal(viewed.credentials[0]?.revoked,true);
    const rotated=await publicApi.rotate('node-a','fingerprint-a',7,'request-a','csr-a');rotated.oldCredentialUntil='changed-old';assert.equal(rotated.oldCredentialUntil,'changed-old');
    const relay=await publicApi.relayCredential('node-a','fingerprint-a',7,'request-a','csr-a');assert.equal(relay.overlapUntil,null);relay.overlapUntil='changed-overlap';assert.equal(relay.overlapUntil,'changed-overlap');
    assert.deepEqual(calls,[['machine',['fingerprint-a']],['enroll',['node-a','token-a','csr-a']],['provision',['actor-a','scope-a',policy]],['listGrants',['actor-a','scope-a','node-a']],['view',['actor-a','scope-a','node-a']],['rotate',['node-a','fingerprint-a',7,'request-a','csr-a']],['relayCredential',['node-a','fingerprint-a',7,'request-a','csr-a']]]);
    assert.equal(calls[2]?.[1][2],policy);
    reject=true;
    for(const action of [()=>publicApi.machine('f'),()=>publicApi.enroll('n','t','c'),()=>publicApi.provision('a','s',policy),()=>publicApi.listGrants('a','s','n'),()=>publicApi.view('a','s','n'),()=>publicApi.rotate('n','f',1,'r','c'),()=>publicApi.relayCredential('n','f',1,'r','c')])await assert.rejects(action,error=>error===failure);
});

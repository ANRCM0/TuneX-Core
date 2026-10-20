import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { readObservationLeaf } from '../src/compatibility/public.ts';
import { observationTrust, parseObservationServiceConfig } from '../src/modules/observation-service-owner/public.ts';
import type { ObservationServiceConfig } from '../src/modules/observation-service-owner/public.ts';

// Follow the retained native PKI acceptance fixture's real openssl req/CA/x509
// recipe. Generation and functional parsing run only in GitHub Actions.
const actions=process.env.GITHUB_ACTIONS==='true',execute=promisify(execFile);
const scope='scope-a',service='service-a',server='probe.example',urn='urn:tunex:observation-service:scope-a:service-a';
const invalid={code:'INVALID_CONFIG',status:422};
type Leaf={raw:Buffer;pem:string;certificate:X509Certificate;encoded:string};
async function withPKI(action:(pki:Awaited<ReturnType<typeof fixture>>)=>Promise<void>){
    const directory=await mkdtemp(join(tmpdir(),'tunex-observation-leaf-'));
    try {await action(await fixture(directory));}finally{await rm(directory,{recursive:true,force:true});}
}
async function fixture(directory:string){
    const openssl=(...args:string[])=>execute('openssl',args,{cwd:directory,timeout:30000});let serial=1;
    await openssl('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=observation-test-ca','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign');
    const keyNames=new Map<string,string>();
    async function key(kind:string,args:string[]){
        const existing=keyNames.get(kind);if(existing)return existing;
        const name='key-'+keyNames.size;await openssl('req','-new','-newkey',...args,'-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+server);keyNames.set(kind,name);return name;
    }
    async function leaf(kind='ec256',args=['ec','-pkeyopt','ec_paramgen_curve:P-256'],options:{ca?:boolean;usage?:string|null;sans?:string|null}={}):Promise<Leaf>{
        const name=await key(kind,args),id='leaf-'+serial++,extensions='basicConstraints=critical,CA:'+(options.ca?'TRUE':'FALSE')+'\nkeyUsage=critical,'+
            (options.ca?'digitalSignature,keyCertSign,cRLSign':'digitalSignature')+'\n'+
            (options.usage===null?'':'extendedKeyUsage='+(options.usage??'serverAuth')+'\n')+
            (options.sans===null?'':'subjectAltName='+(options.sans??`DNS:${server},URI:${urn}`)+'\n');
        await writeFile(join(directory,id+'.ext'),extensions,{mode:0o600});
        await openssl('x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca.key','-set_serial',String(serial),'-days','1','-out',id+'.pem','-extfile',id+'.ext');
        const pem=await readFile(join(directory,id+'.pem'),'utf8'),certificate=new X509Certificate(pem),raw=certificate.raw;
        return {pem,certificate,raw,encoded:raw.toString('base64')};
    }
    return {leaf};
}
function config(leaf:Leaf):Extract<ObservationServiceConfig,{version:1}>{
    return {version:1,purpose:'direct-ingress-tls-handshake',endpoint:{address:'127.0.0.1',port:9443},trust:{mode:'pinned-leaf-v1',serverName:server,certificateDer:leaf.encoded},validFrom:Date.parse(leaf.certificate.validFrom),validUntil:Date.parse(leaf.certificate.validTo)};
}

test('40 actual generated native X509 RSA EC and Ed25519 leaves retain exact raw fingerprint dates scoped SAN server-only usage and detached frozen configuration',{skip:!actions,timeout:180000},async()=>withPKI(async pki=>{
    for(const [name,args,type,curve] of [
        ['rsa2048',['rsa:2048'],'rsa',undefined],
        ['ec256',['ec','-pkeyopt','ec_paramgen_curve:P-256'],'ec','prime256v1'],
        ['ec384',['ec','-pkeyopt','ec_paramgen_curve:P-384'],'ec','secp384r1'],
        ['ec521',['ec','-pkeyopt','ec_paramgen_curve:P-521'],'ec','secp521r1'],
        ['ed25519',['ed25519'],'ed25519',undefined],
    ] as const){
        const leaf=await pki.leaf(name,[...args]),input=config(leaf),events:string[]=[],expected=[`DNS:${server}`,`URI:${urn}`].sort();
        const projected=readObservationLeaf(leaf.encoded,leaf.raw.length,()=>{events.push('expected');return expected;},(facts,sans)=>{
            events.push('accept');assert.equal(sans,expected);assert.equal(facts.matchesDer,true);assert.equal(facts.ca,false);assert.equal(facts.strongKey,true);assert.deepEqual(facts.usage,['1.3.6.1.5.5.7.3.1']);assert.deepEqual(facts.sans,expected);assert.equal(facts.before,input.validFrom);assert.equal(facts.after,input.validUntil);
        });
        assert.deepEqual(events,['expected','accept']);assert.equal(leaf.certificate.publicKey.asymmetricKeyType,type);if(curve)assert.equal(leaf.certificate.publicKey.asymmetricKeyDetails?.namedCurve,curve);if(type==='rsa')assert.equal(leaf.certificate.publicKey.asymmetricKeyDetails?.modulusLength,2048);
        const fingerprint='sha256:'+createHash('sha256').update(leaf.raw).digest('hex');assert.deepEqual(projected,{fingerprint,before:input.validFrom,after:input.validUntil});
        const parsed=parseObservationServiceConfig(input,scope,service),trust=observationTrust(parsed,scope,service);
        assert.notEqual(parsed,input);assert.ok(Object.isFrozen(parsed));assert.ok(Object.isFrozen(parsed.endpoint));assert.ok(Object.isFrozen(parsed.trust));assert.ok(Object.isFrozen(trust));assert.deepEqual(trust,{mode:'pinned-leaf-v1',fingerprint,serverName:server,serviceIdentity:urn,alpn:'tunex-observation/1',certificateNotBefore:input.validFrom,certificateNotAfter:input.validUntil,chainValidation:'not-used-exact-leaf-pin'});
        (input.endpoint as {port:number}).port=9999;assert.equal(parsed.endpoint.port,9443);
        const window={...parsed,validFrom:parsed.validFrom+1,validUntil:parsed.validUntil-1};assert.doesNotThrow(()=>observationTrust(window,scope,service));
        for(const patch of [{validFrom:parsed.validFrom-1},{validUntil:parsed.validUntil+1}])assert.throws(()=>observationTrust({...parsed,...patch},scope,service),invalid);
        assert.throws(()=>observationTrust(parsed,'other-scope',service),invalid);assert.throws(()=>observationTrust(parsed,scope,'other-service'),invalid);
    }
}));

test('40 actual native certificate policy rejects weak or unsupported keys CA leaves extra or absent EKU and every exact DNS URI set mismatch without root or clock fallback',{skip:!actions,timeout:180000},async()=>withPKI(async pki=>{
    for(const [kind,args] of [['rsa1024',['rsa:1024']],['ec-k1',['ec','-pkeyopt','ec_paramgen_curve:secp256k1']],['rsa-pss',['rsa-pss','-pkeyopt','rsa_keygen_bits:2048']]] as const){
        const leaf=await pki.leaf(kind,[...args]);let projected=false;readObservationLeaf(leaf.encoded,8192,()=>[],facts=>{projected=true;assert.equal(facts.strongKey,false);assert.equal(facts.matchesDer,true);});assert.equal(projected,true);assert.throws(()=>observationTrust(config(leaf),scope,service),invalid);
    }
    for(const options of [
        {ca:true},{usage:null},{usage:'clientAuth'},{usage:'serverAuth,clientAuth'},
        {sans:null},{sans:`DNS:${server}`},{sans:`URI:${urn}`},{sans:`DNS:other.example,URI:${urn}`},
        {sans:`DNS:${server},URI:urn:other`},{sans:`DNS:${server},URI:${urn},DNS:extra.example`},
        {sans:`DNS:${server},URI:${urn},URI:${urn}`},
    ]){
        const leaf=await pki.leaf('ec256',['ec','-pkeyopt','ec_paramgen_curve:P-256'],options);
        // A CA fixture must also permit certificate signing for the native CA projection.
        if(options.ca)assert.equal(leaf.certificate.ca,true,'native CA fixture must represent a signing authority');
        assert.throws(()=>observationTrust(config(leaf),scope,service),invalid,JSON.stringify(options));
    }
}));

test('40 actual native DER canonical encoding bounds corruption and callback errors retain original preflight and exact leaf matching without chain verification',{skip:!actions,timeout:120000},async()=>withPKI(async pki=>{
    const leaf=await pki.leaf(),input=config(leaf),failure=new Error('original native outer callback');
    for(const [encoded,maximum] of [[leaf.encoded,leaf.raw.length-1],[leaf.encoded+'\n',8192],[leaf.encoded.slice(0,-1),8192],[leaf.raw.subarray(0,Math.floor(leaf.raw.length/2)).toString('base64'),8192],[Buffer.from([0x30,0x01,0x00]).toString('base64'),8192]] as const){
        assert.throws(()=>readObservationLeaf(encoded,maximum,()=>assert.fail('native parse must precede SAN callback'),()=>assert.fail('native parse must precede policy callback')),invalid);
    }
    const expectedFailure=()=>{throw failure;};assert.throws(()=>readObservationLeaf(leaf.encoded,8192,expectedFailure,()=>assert.fail('expected SAN failed')),error=>error===failure);assert.throws(()=>readObservationLeaf(leaf.encoded,8192,()=>[],expectedFailure),error=>error===failure);
    // X509Certificate accepts PEM input too; the original exact DER check is
    // enforced by the outer policy and must still reject the encoded PEM bytes.
    const pem=Buffer.from(leaf.pem).toString('base64');assert.throws(()=>observationTrust({...input,trust:{...input.trust,certificateDer:pem}},scope,service),invalid);
    const appended=Buffer.concat([leaf.raw,Buffer.from([0])]).toString('base64');assert.throws(()=>observationTrust({...input,trust:{...input.trust,certificateDer:appended}},scope,service),invalid);
    // Retain exact-leaf pin policy: changing only a well-formed signature does
    // not turn this parser into a CA-chain verifier or consult native time.
    const changed=Buffer.from(leaf.raw);changed[changed.length-1]=changed[changed.length-1]!^1;const modified=new X509Certificate(changed);assert.equal(modified.raw.equals(changed),true);
    const trust=observationTrust({...input,trust:{...input.trust,certificateDer:changed.toString('base64')}},scope,service);assert.equal(trust.fingerprint,'sha256:'+createHash('sha256').update(changed).digest('hex'));assert.ok('chainValidation' in trust);assert.equal(trust.chainValidation,'not-used-exact-leaf-pin');assert.notEqual(trust.fingerprint,'sha256:'+createHash('sha256').update(leaf.raw).digest('hex'));
}));

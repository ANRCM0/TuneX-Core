import { X509Certificate, createHash, createPublicKey } from 'node:crypto';
import { isIP } from 'node:net';
import { invalid } from '../framework/public.ts';

export { parseProbeEchoServiceConfig as parseObservationEchoConfig } from '@tunex/contracts/staged/probe-echo';

export function observationObject(input:unknown,fields:readonly string[]):Record<string,unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype,null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== [...fields].sort().join(',')) invalid('Closed observation service fields required');
    return input as Record<string,unknown>;
}
export function observationServerName(value:unknown):value is string {
    return typeof value === 'string' && value.length <= 253 && value.includes('.') && !isIP(value) &&
        value.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$(?![\s\S])/.test(label));
}
export function observationAddress(value:unknown):value is string {
    if (typeof value !== 'string' || value.length > 45 || value.includes('%')) return false;
    const family=isIP(value);
    if (family===4) {
        const parts=value.split('.').map(Number);
        return parts[0]!==0 && parts[0]!<224 && !(parts[0]===169 && parts[1]===254) && value!=='100.100.100.200';
    }
    if (family!==6) return false;
    let canonical:string;
    try {canonical=new URL(`http://[${value}]/`).hostname.slice(1,-1);} catch {return false;}
    return canonical===value && value!=='::' && value!=='fd00:ec2::254' && !value.startsWith('::ffff:') && !value.startsWith('ff') &&
        !/^fe[89ab]/.test(value);
}
export function observationIdentityURN(scope:string,id:string):string {
    return `urn:tunex:observation-service:${encodeURIComponent(scope)}:${id}`;
}
export function observationEchoFingerprint(encoded:string):string {
    const raw=Buffer.from(encoded,'base64');
    const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),raw]),format:'der',type:'spki'});
    if (raw.length!==32 || key.asymmetricKeyType!=='ed25519') invalid('Dedicated Ed25519 public observation key required');
    return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
}
export interface ObservationLeafFacts {
    readonly matchesDer:boolean;readonly ca:boolean;readonly strongKey:boolean;
    readonly usage:readonly string[]|undefined;readonly sans:readonly string[];readonly before:number;readonly after:number;
}
/** Native format projection only. The synchronous outer callback owns scoped pin/validity policy. */
export function readObservationLeaf(encoded:string,maximumBytes:number,expectedSans:()=>readonly string[],
    accept:(facts:ObservationLeafFacts,expected:readonly string[])=>void):{
    fingerprint:string;before:number;after:number;
} {
    if (encoded.length<4 || encoded.length>Math.ceil(maximumBytes/3)*4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
        invalid('One bounded canonical base64 DER certificate required');
    const raw=Buffer.from(encoded,'base64');
    if (raw.length>maximumBytes || raw.toString('base64')!==encoded) invalid('Canonical observation leaf DER required');
    let leaf:X509Certificate;
    try {leaf=new X509Certificate(raw);} catch {return invalid('Valid public observation certificate required');}
    const before=Date.parse(leaf.validFrom),after=Date.parse(leaf.validTo),usage=leaf.keyUsage;
    const sans=(leaf.subjectAltName??'').split(', ').sort();
    const expected=expectedSans();
    const key=leaf.publicKey,details=key.asymmetricKeyDetails;
    const strongKey=key.asymmetricKeyType==='ed25519' || key.asymmetricKeyType==='rsa' &&
        (details?.modulusLength??0)>=2048 && (details?.modulusLength??0)<=8192 || key.asymmetricKeyType==='ec' &&
        ['prime256v1','secp384r1','secp521r1'].includes(details?.namedCurve??'');
    // Preserve the old short-circuit native property reads during outer policy checks.
    accept({get matchesDer(){return leaf.raw.equals(raw);},get ca(){return leaf.ca;},strongKey,usage,sans,before,after},expected);
    return {fingerprint:`sha256:${createHash('sha256').update(raw).digest('hex')}`,before,after};
}

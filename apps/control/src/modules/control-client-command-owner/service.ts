import type { ControlClientEffects } from './contracts.ts';

export async function runControlClient<Url,Bytes>(effects:ControlClientEffects<Url,Bytes>):Promise<void> {
const [command, scope, idOrFile, key, expectedOrFile, mutationKey] = effects.arguments();
const base = effects.env('TUNEX_CONTROL_URL'), caPath = effects.env('TUNEX_CA_CERT'), token = effects.env('TUNEX_OWNER_TOKEN');
if (!base?.startsWith('https://') || !caPath || !token || !scope)
    throw new Error('Trusted Control URL/CA, owner token and scope required');
let method = 'GET', path = '', body: string | undefined;
if(command==='relay-plan'){if(!idOrFile)throw new Error('Forward JSON file required');method='POST';path='relay-plan';body=effects.stringify(effects.parseJson(await effects.readText(idOrFile)));}
else if(command==='profile-grants'){if(!idOrFile)throw new Error('Profile ID required');path=`transport-profiles/${effects.encodeComponent(idOrFile)}/grants`;}
else if(command==='profile-grant'){if(!idOrFile||!key||!expectedOrFile||!mutationKey)throw new Error('Usage: profile-grant <scope> <profileId> <actorId> <input.json> <stable-key>');method='PUT';path=`transport-profiles/${effects.encodeComponent(idOrFile)}/grants/${effects.encodeComponent(key)}`;body=effects.stringify(effects.parseJson(await effects.readText(expectedOrFile)));}
else if(command==='node-endpoint-get'){if(!idOrFile)throw new Error('Node ID required');path=`nodes/${effects.encodeComponent(idOrFile)}/relay-endpoint`;}
else if(command==='node-endpoint'){if(!idOrFile||!key||!expectedOrFile)throw new Error('Usage: node-endpoint <scope> <nodeId> <input.json> <stable-key>');method='PUT';path=`nodes/${effects.encodeComponent(idOrFile)}/relay-endpoint`;body=effects.stringify(effects.parseJson(await effects.readText(key)));}
else if(command==='profiles'){path='transport-profiles';}
else if(command==='profile-get'){if(!idOrFile)throw new Error('Profile ID required');path=`transport-profiles/${effects.encodeComponent(idOrFile)}${key?`?revision=${effects.encodeComponent(key)}`:''}`;}
else if(command==='profile'){if(!idOrFile||!key||!expectedOrFile)throw new Error('Usage: profile <scope> <profileId> <input.json> <stable-key>');method='PUT';path=`transport-profiles/${effects.encodeComponent(idOrFile)}`;body=effects.stringify(effects.parseJson(await effects.readText(key)));}
else if (command === 'members') {
    path = 'members';
}
else if (command === 'member') {
    if (!idOrFile || !key || !expectedOrFile)
        throw new Error('Usage: member <scope> <actorId> <input.json> <stable-key>');
    method = 'PUT';
    path = `members/${effects.encodeComponent(idOrFile)}`;
    body = effects.stringify(effects.parseJson(await effects.readText(key)));
}
else if (command === 'node-grants') {
    if (!idOrFile)
        throw new Error('Node ID required');
    path = `nodes/${effects.encodeComponent(idOrFile)}/grants`;
}
else if (command === 'node-grant') {
    if (!idOrFile || !key || !expectedOrFile || !mutationKey)
        throw new Error('Usage: node-grant <scope> <nodeId> <actorId> <input.json> <stable-key>');
    method = 'PUT';
    path = `nodes/${effects.encodeComponent(idOrFile)}/grants/${effects.encodeComponent(key)}`;
    body = effects.stringify(effects.parseJson(await effects.readText(expectedOrFile)));
}
else if (command === 'create' || command === 'node') {
    if (!idOrFile)
        throw new Error('JSON input file required');
    method = 'POST';
    path = command === 'create' ? 'forwards' : 'nodes';
    body = effects.stringify(effects.parseJson(await effects.readText(idOrFile)));
}
else if (command === 'get' || command === 'operation' || command === 'node-get') {
    if (!idOrFile)
        throw new Error('Resource ID required');
    path = `${command === 'get' ? 'forwards' : command === 'node-get' ? 'nodes' : 'operations'}/${effects.encodeComponent(idOrFile)}`;
}
else if (command === 'update' || command === 'node-policy') {
    if (!idOrFile || !key || !expectedOrFile || !mutationKey)
        throw new Error('Usage: update <scope> <id> <expectedRevision> <spec.json> <key>');
    method = 'PUT';
    path = command === 'update' ? `forwards/${effects.encodeComponent(idOrFile)}` : `nodes/${effects.encodeComponent(idOrFile)}/policy`;
    const input = effects.parseJson(await effects.readText(expectedOrFile));
    body = effects.stringify({ expectedRevision: Number(key), ...(command === 'update' ? { spec: input } : { policy: input }) });
}
else if (command === 'delete' || command === 'retry') {
    if (!idOrFile || !key || !expectedOrFile)
        throw new Error('Usage: delete|retry <scope> <id> <expectedRevision> <key>');
    method = command === 'delete' ? 'DELETE' : 'POST';
    path = command === 'delete' ? `forwards/${effects.encodeComponent(idOrFile)}` : `operations/${effects.encodeComponent(idOrFile)}/retry`;
    body = effects.stringify({ expectedRevision: Number(key) });
}
else if (command === 'node-revoke') {
    if (!idOrFile || !key)
        throw new Error('Usage: node-revoke <scope> <nodeId> <stable-key>');
    method = 'POST';
    path = `nodes/${effects.encodeComponent(idOrFile)}/revoke`;
    body = '{}';
}
else
    throw new Error('Usage: create|node|get|operation|update|delete|retry|node-get|node-policy|node-revoke|members|member|node-grants|node-grant|profiles|profile-get|profile|profile-grants|profile-grant|node-endpoint-get|node-endpoint');
const requestKey = command === 'update' || command === 'node-policy' || command === 'node-grant' || command==='profile-grant' ? mutationKey : command === 'delete' || command === 'retry' || command === 'member' || command === 'profile' || command==='node-endpoint' ? expectedOrFile : key;
if (command === 'create' && !key)
    throw new Error('Provide a persistent Idempotency-Key for create and reuse it on retry');
const url = effects.url(`/api/v1/scopes/${effects.encodeComponent(scope)}/${path}`, base);
const ca = await effects.readBytes(caPath);
const result = await effects.request(url,method,ca,token,requestKey,body);
effects.log(effects.stringify(effects.parseJson(result), null, 2));

}

import { request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { parseJson } from '@tunex/contracts';
const [command, scope, idOrFile, key, expectedOrFile, mutationKey] = process.argv.slice(2);
const base = process.env.TUNEX_CONTROL_URL, caPath = process.env.TUNEX_CA_CERT, token = process.env.TUNEX_OWNER_TOKEN;
if (!base?.startsWith('https://') || !caPath || !token || !scope)
    throw new Error('Trusted Control URL/CA, owner token and scope required');
let method = 'GET', path = '', body: string | undefined;
if(command==='relay-plan'){if(!idOrFile)throw new Error('Forward JSON file required');method='POST';path='relay-plan';body=JSON.stringify(parseJson(await readFile(idOrFile,'utf8')));}
else if(command==='profile-grants'){if(!idOrFile)throw new Error('Profile ID required');path=`transport-profiles/${encodeURIComponent(idOrFile)}/grants`;}
else if(command==='profile-grant'){if(!idOrFile||!key||!expectedOrFile||!mutationKey)throw new Error('Usage: profile-grant <scope> <profileId> <actorId> <input.json> <stable-key>');method='PUT';path=`transport-profiles/${encodeURIComponent(idOrFile)}/grants/${encodeURIComponent(key)}`;body=JSON.stringify(parseJson(await readFile(expectedOrFile,'utf8')));}
else if(command==='node-endpoint-get'){if(!idOrFile)throw new Error('Node ID required');path=`nodes/${encodeURIComponent(idOrFile)}/relay-endpoint`;}
else if(command==='node-endpoint'){if(!idOrFile||!key||!expectedOrFile)throw new Error('Usage: node-endpoint <scope> <nodeId> <input.json> <stable-key>');method='PUT';path=`nodes/${encodeURIComponent(idOrFile)}/relay-endpoint`;body=JSON.stringify(parseJson(await readFile(key,'utf8')));}
else if(command==='profiles'){path='transport-profiles';}
else if(command==='profile-get'){if(!idOrFile)throw new Error('Profile ID required');path=`transport-profiles/${encodeURIComponent(idOrFile)}${key?`?revision=${encodeURIComponent(key)}`:''}`;}
else if(command==='profile'){if(!idOrFile||!key||!expectedOrFile)throw new Error('Usage: profile <scope> <profileId> <input.json> <stable-key>');method='PUT';path=`transport-profiles/${encodeURIComponent(idOrFile)}`;body=JSON.stringify(parseJson(await readFile(key,'utf8')));}
else if (command === 'members') {
    path = 'members';
}
else if (command === 'member') {
    if (!idOrFile || !key || !expectedOrFile)
        throw new Error('Usage: member <scope> <actorId> <input.json> <stable-key>');
    method = 'PUT';
    path = `members/${encodeURIComponent(idOrFile)}`;
    body = JSON.stringify(parseJson(await readFile(key, 'utf8')));
}
else if (command === 'node-grants') {
    if (!idOrFile)
        throw new Error('Node ID required');
    path = `nodes/${encodeURIComponent(idOrFile)}/grants`;
}
else if (command === 'node-grant') {
    if (!idOrFile || !key || !expectedOrFile || !mutationKey)
        throw new Error('Usage: node-grant <scope> <nodeId> <actorId> <input.json> <stable-key>');
    method = 'PUT';
    path = `nodes/${encodeURIComponent(idOrFile)}/grants/${encodeURIComponent(key)}`;
    body = JSON.stringify(parseJson(await readFile(expectedOrFile, 'utf8')));
}
else if (command === 'create' || command === 'node') {
    if (!idOrFile)
        throw new Error('JSON input file required');
    method = 'POST';
    path = command === 'create' ? 'forwards' : 'nodes';
    body = JSON.stringify(parseJson(await readFile(idOrFile, 'utf8')));
}
else if (command === 'get' || command === 'operation' || command === 'node-get') {
    if (!idOrFile)
        throw new Error('Resource ID required');
    path = `${command === 'get' ? 'forwards' : command === 'node-get' ? 'nodes' : 'operations'}/${encodeURIComponent(idOrFile)}`;
}
else if (command === 'update' || command === 'node-policy') {
    if (!idOrFile || !key || !expectedOrFile || !mutationKey)
        throw new Error('Usage: update <scope> <id> <expectedRevision> <spec.json> <key>');
    method = 'PUT';
    path = command === 'update' ? `forwards/${encodeURIComponent(idOrFile)}` : `nodes/${encodeURIComponent(idOrFile)}/policy`;
    const input = parseJson(await readFile(expectedOrFile, 'utf8'));
    body = JSON.stringify({ expectedRevision: Number(key), ...(command === 'update' ? { spec: input } : { policy: input }) });
}
else if (command === 'delete' || command === 'retry') {
    if (!idOrFile || !key || !expectedOrFile)
        throw new Error('Usage: delete|retry <scope> <id> <expectedRevision> <key>');
    method = command === 'delete' ? 'DELETE' : 'POST';
    path = command === 'delete' ? `forwards/${encodeURIComponent(idOrFile)}` : `operations/${encodeURIComponent(idOrFile)}/retry`;
    body = JSON.stringify({ expectedRevision: Number(key) });
}
else if (command === 'node-revoke') {
    if (!idOrFile || !key)
        throw new Error('Usage: node-revoke <scope> <nodeId> <stable-key>');
    method = 'POST';
    path = `nodes/${encodeURIComponent(idOrFile)}/revoke`;
    body = '{}';
}
else
    throw new Error('Usage: create|node|get|operation|update|delete|retry|node-get|node-policy|node-revoke|members|member|node-grants|node-grant|profiles|profile-get|profile|profile-grants|profile-grant|node-endpoint-get|node-endpoint');
const requestKey = command === 'update' || command === 'node-policy' || command === 'node-grant' || command==='profile-grant' ? mutationKey : command === 'delete' || command === 'retry' || command === 'member' || command === 'profile' || command==='node-endpoint' ? expectedOrFile : key;
if (command === 'create' && !key)
    throw new Error('Provide a persistent Idempotency-Key for create and reuse it on retry');
const url = new URL(`/api/v1/scopes/${encodeURIComponent(scope)}/${path}`, base);
const ca = await readFile(caPath);
const result = await new Promise<string>((resolve, reject) => {
    const req = request(url, { method, ca, timeout: 10000, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(requestKey ? { 'idempotency-key': requestKey } : {}), ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, res => {
        const chunks: Buffer[] = [];
        res.on('data', value => chunks.push(value));
        res.on('end', () => {
            const text = Buffer.concat(chunks).toString();
            if (res.statusCode! >= 200 && res.statusCode! < 300)
                resolve(text);
            else
                reject(new Error(`HTTP ${res.statusCode}: ${text}`));
        });
    });
    req.on('timeout', () => req.destroy(new Error('Control request timeout')));
    req.on('error', reject);
    req.end(body);
});
console.log(JSON.stringify(parseJson(result), null, 2));

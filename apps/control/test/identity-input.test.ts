import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newToken,validBearerToken,tokenHash } from '../src/modules/identity.ts';
test('opaque bearer token input rejects trailing whitespace, Unicode and malformed lengths',()=>{
 const token=newToken();assert.equal(validBearerToken(token),true);assert.equal(tokenHash(token).length,64);
 for(const input of [null,32,'x'.repeat(31),'x'.repeat(129),`${token}\n`,`${token}\r`,' '.repeat(32),'a'.repeat(31)+'?'])assert.equal(validBearerToken(input),false);
 assert.equal(validBearerToken('a'.repeat(128)),true);
});

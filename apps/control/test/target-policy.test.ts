import assert from 'node:assert/strict';
import { test } from 'node:test';
import { targetAllowed } from '../src/modules/target-policy.ts';
import { validatePolicy } from '../src/modules/nodes.ts';
const facts = { allowMetadataTargets: false, allowedDestinationCidrs: ['127.0.0.0/8', '2001:db8::/32'] };
test('destination CIDR checks normalize mapped IPv4 and reject metadata/multicast', () => {
    for (const host of ['127.0.0.1', '::ffff:127.0.0.1', '2001:db8::1', 'dns.example'])
        assert.equal(targetAllowed(host, facts), true);
    for (const host of ['10.0.0.1', '::1', '0.0.0.0', '224.0.0.1', '169.254.169.254', '::ffff:169.254.169.254'])
        assert.equal(targetAllowed(host, facts), false);
    assert.equal(targetAllowed('169.254.169.254', { allowMetadataTargets: false, allowedDestinationCidrs: ['0.0.0.0/0'] }), false);
    assert.equal(targetAllowed('169.254.169.254', { allowMetadataTargets: true, allowedDestinationCidrs: ['169.254.0.0/16'] }), true);
});
test('Node policy parser rejects unknown fields, duplicate grants and invalid revisions', () => {
    const valid = { ...facts, allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [25565], egressPolicyRevision: 1 };
    assert.doesNotThrow(() => validatePolicy(valid));
    for (const invalid of [{ ...valid, extra: true }, { ...valid, allowedPorts: [25565, 25565] }, { ...valid, egressPolicyRevision: 0 }, { ...valid, allowedDestinationCidrs: ['10.0.0.1/24'] }])
        assert.throws(() => validatePolicy(invalid));
});

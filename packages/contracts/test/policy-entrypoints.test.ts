import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as policyEntry from '@tunex/contracts/policy';
import { DEFAULT_POLICY as rootDefault } from '@tunex/contracts';
import { DEFAULT_POLICY as sharedDefault } from '@tunex/contracts/shared';
import { DEFAULT_POLICY as legacyDefault } from '@tunex/contracts/legacy/adp2';
import { DEFAULT_POLICY as originalDefault } from '../src/types.ts';
import { RUNTIME_POLICY_INTERFACE_VERSION as frameworkVersion } from '../../../apps/control/src/framework/public.ts';
import type { Policy as RootPolicy } from '@tunex/contracts';
import type { Policy as SharedPolicy } from '@tunex/contracts/shared';
import type { Policy as RuntimePolicy, RuntimeMessages } from '@tunex/contracts/runtime';
import type { Policy as LegacyPolicy } from '@tunex/contracts/legacy/adp2';
import type { Policy as OriginalPolicy } from '../src/types.ts';
import type { Policy as FrameworkPolicy } from '../../../apps/control/src/framework/public.ts';

type ExpectedPolicy = {
    pollIntervalSeconds: number; leaseSeconds: number; renewalLeadSeconds: number; maxClockSkewSeconds: number;
    observationFreshnessSeconds: number; drainTimeoutSeconds: number; connectTimeoutSeconds: number;
    udpIdleTimeoutSeconds: number; maxTcpConnectionsPerAssignment: number; maxUdpSessionsPerAssignment: number;
    maxSnapshotBytes: number; maxReportBytes: number; maxAssignmentsPerNode: number;
};
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Same<T extends true> = T;
export type PolicySourceCompatibility = [
    Same<Equal<policyEntry.Policy, ExpectedPolicy>>, Same<Equal<RootPolicy, ExpectedPolicy>>,
    Same<Equal<SharedPolicy, ExpectedPolicy>>, Same<Equal<RuntimePolicy, ExpectedPolicy>>,
    Same<Equal<LegacyPolicy, ExpectedPolicy>>, Same<Equal<OriginalPolicy, ExpectedPolicy>>,
    Same<Equal<FrameworkPolicy, ExpectedPolicy>>, Same<Equal<RuntimeMessages['HelloResponse']['policy'], ExpectedPolicy>>,
];

const expected = {
    pollIntervalSeconds: 10, leaseSeconds: 300, renewalLeadSeconds: 120, maxClockSkewSeconds: 5,
    observationFreshnessSeconds: 30, drainTimeoutSeconds: 30, connectTimeoutSeconds: 10,
    udpIdleTimeoutSeconds: 60, maxTcpConnectionsPerAssignment: 1024, maxUdpSessionsPerAssignment: 4096,
    maxSnapshotBytes: 4194304, maxReportBytes: 1048576, maxAssignmentsPerNode: 1000,
};

test('the pure Policy entry has its own version and preserves thirteen required mutable numeric fields', () => {
    assert.deepEqual(Object.keys(policyEntry), ['RUNTIME_POLICY_INTERFACE_VERSION']);
    assert.equal(policyEntry.RUNTIME_POLICY_INTERFACE_VERSION, 1); assert.equal(frameworkVersion, 1);
    const mutable: policyEntry.Policy = { ...expected };
    for (const key of Object.keys(expected) as Array<keyof ExpectedPolicy>) mutable[key]++;
    for (const key of Object.keys(expected) as Array<keyof ExpectedPolicy>) assert.equal(mutable[key], expected[key] + 1);
});

test('old package entries retain the original frozen Policy default identity values and insertion order', () => {
    for (const value of [rootDefault, sharedDefault, legacyDefault, originalDefault]) {
        assert.equal(value, originalDefault); assert.equal(Object.isFrozen(value), true);
        assert.deepEqual(Object.keys(value), Object.keys(expected)); assert.deepEqual(value, expected);
        assert.equal(Reflect.set(value, 'leaseSeconds', 1), false); assert.equal(value.leaseSeconds, 300);
    }
});

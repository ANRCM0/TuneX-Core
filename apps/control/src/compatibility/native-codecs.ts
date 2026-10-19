import { digest } from '@tunex/contracts/shared';
import type { RuntimeAssignment, RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { RuntimeLedgerCompiler, RuntimeRelayCompiler } from '../framework/public.ts';
import type { NativeRuntimeFamily } from './native-runtime-family.ts';
import { compileDirect, compileSnapshot } from './native-runtime.ts';
import { compileRelayResources } from './native-relay-resources.ts';
import { compileRelayPlan, relayPeerPinsChanged } from './native-relay-plan.ts';
import { compileMultihopPlan, compileMultihopResources } from './native-multihop-plan.ts';
import { targetAllowed } from './native-target-policy.ts';
import { readStoredValue } from './stored-value.ts';
import { nativeParseTime, nativeIsoTime } from './native-module-values.ts';
import { nativeRelayAssignmentPolicy, nativeMultihopAssignmentPolicy } from './native-relay-assignment-policy.ts';

export const nativeLedgerCompiler:RuntimeLedgerCompiler<NativeRuntimeFamily>=Object.freeze({
    parseTime:nativeParseTime,formatTime:nativeIsoTime,
    direct:compileDirect,snapshot:compileSnapshot,targetAllowed,
    decodeSnapshot:(value:unknown)=>readStoredValue<RuntimeSnapshot>(value),
    decodeAssignment:(value:unknown)=>readStoredValue<RuntimeAssignment>(value),
});
export const nativeRelayCompiler:RuntimeRelayCompiler<NativeRuntimeFamily>=Object.freeze({
    relayAssignmentPolicy:nativeRelayAssignmentPolicy,multihopAssignmentPolicy:nativeMultihopAssignmentPolicy,
    parseTime:nativeParseTime,formatTime:nativeIsoTime,
    digest,readValue:readStoredValue,relayResources:compileRelayResources,relayPlan:compileRelayPlan,
    multihopResources:compileMultihopResources,multihopPlan:compileMultihopPlan,peerPinsChanged:relayPeerPinsChanged,
});

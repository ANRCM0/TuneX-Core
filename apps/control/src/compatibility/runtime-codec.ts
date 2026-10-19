import { DEFAULT_POLICY, digest } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/shared';
import { parseRuntimeMessage } from '@tunex/contracts/runtime';
import type { RuntimeMessages } from '@tunex/contracts/runtime';
import { ControlError } from '../framework/public.ts';
import type { RuntimeCodec } from '../framework/public.ts';
import type { NativeRuntimeFamily } from './native-runtime-family.ts';
import { compileSnapshot } from './native-runtime.ts';
import { nativeParseTime, nativeIsoTime } from './native-module-values.ts';

/** ADP/3's existing closed validators and compiler; no protocol translation. */
export const runtimeCodec:RuntimeCodec<NativeRuntimeFamily>=Object.freeze({
    defaultPolicy:DEFAULT_POLICY,digest,compileSnapshot,
    parseTime:nativeParseTime,formatTime:nativeIsoTime,
    checkHelloProtocol(input:RuntimeMessages['HelloRequest']):void {
        if(input.protocolVersion!==3||!input.capabilities.includes('adp.3'))
            throw new ControlError('UNSUPPORTED_PROTOCOL_VERSION',409,'ADP/3 capability required');
    },
    checkHelloCapabilities(input:RuntimeMessages['HelloRequest']):void {
        if((!input.capabilities.includes('tcp')&&!input.capabilities.includes('udp'))||!input.capabilities.includes('native.direct.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Direct protocol capability required');
    },
    helloResponse(nodeId:string,bootId:string,epoch:number,serverTime:string,policy:Policy):RuntimeMessages['HelloResponse'] {
        return {protocolVersion:3,nodeId,bootId,sessionEpoch:epoch,serverTime,policy};
    },
    reportAck(nodeId:string,bootId:string,epoch:number,sequence:number,status:'accepted'|'duplicate'):RuntimeMessages['ReportAck'] {
        return {protocolVersion:3,nodeId,bootId,sessionEpoch:epoch,reportSequence:sequence,status};
    },
    validatePolicy:(policy:Policy,at:number)=>parseRuntimeMessage('HelloResponse',JSON.stringify({protocolVersion:3,nodeId:'policy-validation',
        bootId:'policy-validation',sessionEpoch:1,serverTime:new Date(at).toISOString(),policy})).policy,
});

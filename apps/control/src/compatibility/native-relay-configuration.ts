import { isId, isCounter, MAX_COUNTER } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { parseRelayMessage } from '@tunex/contracts/runtime';
import type { NativeRelayConfigurationCodec as RelayConfigurationCodec } from './native-runtime-family.ts';
import { nativeIsoTime } from './native-module-values.ts';
import { parseRelayEndpoint } from './native-relay-endpoint.ts';
import { readStoredValue } from './stored-value.ts';

export const nativeRelayConfigurationCodec:RelayConfigurationCodec=Object.freeze({
    formatTime:nativeIsoTime,
    isId,isCounter,maxRevision:MAX_COUNTER,
    validRequestKey:(value:string)=>/^[\x21-\x7e]{1,128}$/.test(value),
    profile:(value:unknown)=>parseRelayMessage('ProfileConfig',JSON.stringify(value)),
    endpoint:parseRelayEndpoint,readStored:readStoredValue,
    encode:(value:unknown)=>JSON.stringify(value),digest,
});

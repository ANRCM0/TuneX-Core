import { readStoredValue } from './stored-value.ts';
import { nativeParseTime, nativeIsoTime, nativeWallClockNow } from './native-module-values.ts';

/** Original permissive stored JSON and dynamic native clock/time operations. */
export const nativeRuntimeStatusCodec=Object.freeze({read:readStoredValue,parseTime:nativeParseTime,
    formatTime:nativeIsoTime,now:nativeWallClockNow});

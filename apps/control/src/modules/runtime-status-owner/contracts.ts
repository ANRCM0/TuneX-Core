import type { StoredValues } from '../../framework/public.ts';

export const RUNTIME_STATUS_QUERY_INTERFACE_VERSION=1 as const;

export interface RuntimeStatusCodec extends Pick<StoredValues,'read'> {
    parseTime(value:string):number;
    formatTime(value:number):string;
    now():number;
}

export const CANCELLATION_INTERFACE_VERSION=1 as const;

/** One-way cancellation observation; native controllers remain with their adapter.
 * Providers retain callback identity, honor once/removal and throw the stored
 * reason after cancellation. Observers cannot reset or dispatch cancellation.
 */
export interface CancellationSignal {
    readonly aborted:boolean;
    readonly reason:unknown;
    throwIfAborted():void;
    addEventListener(type:'abort',listener:()=>void,options?:{readonly once?:boolean}):void;
    removeEventListener(type:'abort',listener:()=>void):void;
}

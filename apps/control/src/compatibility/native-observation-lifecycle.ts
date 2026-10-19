export function nativeObservationController():AbortController {
    return new AbortController();
}

export function nativeObservationTimeout(callback:()=>void,delayMs:number) {
    return setTimeout(callback,delayMs);
}

export function nativeClearObservationTimeout(timer:ReturnType<typeof setTimeout>):void {
    clearTimeout(timer);
}

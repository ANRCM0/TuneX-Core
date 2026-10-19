export interface ModuleLogEntry {
    readonly level:'info'|'warn'|'error';
    readonly module:string;
    readonly code:string;
    readonly requestId?:string|undefined;
}

/** Composition supplies the sink; module logs contain codes, not raw secrets/errors. */
export interface ModuleLogger {
    write(entry:ModuleLogEntry):void;
}

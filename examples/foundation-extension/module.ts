import { freezeModuleValue, requireScopedIdentity } from '../../apps/control/src/framework/public.ts';
import type { ForwardImportAdapter, ForwardIntent, ModuleLogger, ScopeAuthorization, TransactionBoundary } from '../../apps/control/src/framework/public.ts';

export interface ForwardImportPreviewDependencies<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly auth:ScopeAuthorization<Tx>;
    readonly adapter:ForwardImportAdapter;
    readonly log?:ModuleLogger|undefined;
}

export interface ForwardImportPreview {
    readonly version:1;
    readonly formatId:string;
    readonly formatVersion:number;
    readonly spec:ForwardIntent;
    readonly executionAuthorized:false;
}

/** L3 example: public L1 ports and a supplied L2 adapter, with no storage or kernel access. */
export class ForwardImportPreviewModule<Tx> {
    private readonly db:TransactionBoundary<Tx>;
    private readonly auth:ScopeAuthorization<Tx>;
    private readonly adapter:ForwardImportAdapter;
    private readonly log:ModuleLogger|undefined;
    constructor(dependencies:ForwardImportPreviewDependencies<Tx>) {
        this.db=dependencies.db;this.auth=dependencies.auth;this.adapter=dependencies.adapter;this.log=dependencies.log;
    }
    async preview(actor:string,scope:string,input:unknown):Promise<ForwardImportPreview> {
        requireScopedIdentity(actor,scope);
        // The pure adapter returns detached immutable intent before any await.
        const spec=this.adapter.parse(input);
        const result=await this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            return freezeModuleValue({version:1 as const,formatId:this.adapter.formatId,formatVersion:this.adapter.formatVersion,
                spec,executionAuthorized:false as const});
        });
        try{this.log?.write({level:'info',module:'forward-import-preview',code:'PREVIEW_READY'});}catch{}
        return result;
    }
}

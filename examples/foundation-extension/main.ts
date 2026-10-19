import { ControlError, RequestLifecycle } from '../../apps/control/src/framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../apps/control/src/framework/public.ts';
import { flatForwardAdapter } from '../../apps/control/src/compatibility/public.ts';
import { ForwardImportPreviewModule } from './public.ts';

// Composition only: this immutable, one-actor demonstration is not production identity/storage.
type ExampleTransaction={readonly actor:'example-actor';readonly scope:'example-scope'};
const transaction:ExampleTransaction=Object.freeze({actor:'example-actor',scope:'example-scope'});
const db:TransactionBoundary<ExampleTransaction>={transaction:async action=>action(transaction)};
const auth:ScopeAuthorization<ExampleTransaction>={scope:async(tx,actor,scope)=>{
    if(actor!==tx.actor||scope!==tx.scope)throw new ControlError('AUTHORIZATION_DENIED',403,'Example actor/Scope mismatch');
}};
const module=new ForwardImportPreviewModule({db,auth,adapter:flatForwardAdapter,
    log:{write:entry=>{process.stderr.write(JSON.stringify(entry)+'\n');}}}),requests=new RequestLifecycle();
try {
    const result=await requests.run(()=>module.preview('example-actor','example-scope',{
        version:1,nodeId:'example-node',enabled:true,protocol:'BOTH',listenAddress:'127.0.0.1',listenPort:18080,
        targetHost:'Example.COM.',targetPort:8080,
    }));
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
} finally {await requests.drain();}

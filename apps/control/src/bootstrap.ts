import { nativeControlBootstrapEffects } from './compatibility/public.ts';
import type { NativeControlBootstrapDatabase } from './compatibility/public.ts';
import { runControlBootstrap } from './modules/control-bootstrap-command-owner/public.ts';
import { Identity } from './modules/identity.ts';

await runControlBootstrap({...nativeControlBootstrapEffects,
    bootstrap:(db:NativeControlBootstrapDatabase,scope:string,actor:string,token:string)=>new Identity(db).bootstrap(scope,actor,token)});

import { runControlClient } from './modules/control-client-command-owner/public.ts';
import { nativeControlClientEffects } from './compatibility/public.ts';

await runControlClient(nativeControlClientEffects);

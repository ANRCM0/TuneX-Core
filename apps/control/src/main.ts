import { startControl } from './server.ts';
import { runControlStartup } from './modules/control-startup-owner/public.ts';
import { nativeControlStartupEffects, verifyMultihopRelease } from './compatibility/public.ts';

await runControlStartup({...nativeControlStartupEffects,start:startControl,verifyRelease:verifyMultihopRelease});

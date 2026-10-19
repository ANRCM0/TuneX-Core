import { BackgroundTasks as BackgroundTasksHost } from '../framework/public.ts';
import type { BackgroundTask, BackgroundTaskEffects } from '../framework/public.ts';
import { nativeMonotonicNow } from './native-module-values.ts';

export const nativeBackgroundTaskEffects:BackgroundTaskEffects=Object.freeze({
    now:nativeMonotonicNow,
    scheduleInterval(action:()=>void,intervalMs:number):()=>void {
        const timer=setInterval(action,intervalMs);
        return ()=>clearInterval(timer);
    },
});

/** Historical application construction binds native effects to the same L1 lifecycle. */
export class BackgroundTasks extends BackgroundTasksHost {
    constructor(options:readonly BackgroundTask[]) {super(options,nativeBackgroundTaskEffects);}
}

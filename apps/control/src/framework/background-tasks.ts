export const BACKGROUND_TASKS_INTERFACE_VERSION=2 as const;

/** Monotonic milliseconds and deferred intervals; cancellation leaves active work running. */
export interface BackgroundTaskEffects {
    now():number;
    scheduleInterval(action:()=>void,intervalMs:number):()=>void;
}

export interface BackgroundTask {
    readonly id:string;
    readonly intervalMs:number;
    readonly enabled:boolean;
    readonly run:()=>Promise<void>;
    readonly onStop?:(()=>Promise<void>)|undefined;
    readonly onFailure?:((id:string)=>void)|undefined;
    readonly failureDelay?:{readonly initialMs:number;readonly maxMs:number}|undefined;
}

class PeriodicTask {
    private readonly options:BackgroundTask;
    private readonly effects:BackgroundTaskEffects;
    private timer:(()=>void)|undefined;
    private active:Promise<void>|null=null;
    private closing:Promise<void>|undefined;
    private started=false;
    private stopping=false;
    private failures=0;
    private nextAt=0;
    constructor(options:BackgroundTask,effects:BackgroundTaskEffects) {
        this.effects=effects;
        if(!/^[a-z][a-z0-9.-]{0,63}$/.test(options.id)||!Number.isSafeInteger(options.intervalMs)||options.intervalMs<100||options.intervalMs>3600000||
            typeof options.enabled!=='boolean'||typeof options.run!=='function'||options.onStop!==undefined&&typeof options.onStop!=='function'||
            options.onFailure!==undefined&&typeof options.onFailure!=='function')throw new Error('Bounded background task declaration required');
        const delay=options.failureDelay;
        if(delay&&(!Number.isSafeInteger(delay.initialMs)||!Number.isSafeInteger(delay.maxMs)||delay.initialMs<100||delay.maxMs<delay.initialMs||delay.maxMs>3600000))
            throw new Error('Bounded background task backoff required');
        this.options=Object.freeze({...options,...(delay?{failureDelay:Object.freeze({...delay})}:{})});
    }
    start() {
        if(this.stopping)throw new Error('Stopped task cannot restart');
        if(this.started)return;this.started=true;
        if(this.options.enabled)this.timer=this.effects.scheduleInterval(()=>this.tick(),this.options.intervalMs);
    }
    private tick() {
        if(this.stopping||this.active||this.effects.now()<this.nextAt)return;
        this.active=Promise.resolve().then(()=>this.options.run()).then(()=>{this.failures=0;this.nextAt=0;},()=>{
            this.failures=Math.min(this.failures+1,16);
            const delay=this.options.failureDelay;
            this.nextAt=delay?this.effects.now()+Math.min(delay.maxMs,delay.initialMs*2**(this.failures-1)):0;
            // Logging cannot expose raw owner errors or break the worker's drain promise.
            try{this.options.onFailure?.(this.options.id);}catch{}
        }).finally(()=>{this.active=null;});
    }
    stopAdmission() {this.stopping=true;const cancel=this.timer;if(cancel!==undefined)cancel();this.timer=undefined;}
    close():Promise<void> {
        this.stopAdmission();
        return this.closing??=(async()=>{
            const results=await Promise.allSettled([Promise.resolve().then(()=>this.options.onStop?.()),this.active??Promise.resolve()]);
            if(results.some(result=>result.status==='rejected'))throw new Error(`Background task ${this.options.id} shutdown failed`);
        })();
    }
}

/** Independent timers and in-flight slots, not a business queue or an execution coordinator. */
export class BackgroundTasks {
    private readonly tasks:readonly PeriodicTask[];
    private closing:Promise<void>|undefined;
    constructor(options:readonly BackgroundTask[],effects:BackgroundTaskEffects) {
        if(!Array.isArray(options)||options.length>64||new Set(options.map(task=>task?.id)).size!==options.length)
            throw new Error('Unique bounded background task registrations required');
        if(typeof effects?.now!=='function'||typeof effects?.scheduleInterval!=='function')
            throw new Error('Background task scheduling effects are required');
        this.tasks=Object.freeze(options.map(task=>new PeriodicTask(task,effects)));
    }
    start() {for(const task of this.tasks)task.start();}
    stopAdmission() {for(const task of this.tasks)task.stopAdmission();}
    close():Promise<void> {
        this.stopAdmission();
        return this.closing??=(async()=>{
            const results=await Promise.allSettled(this.tasks.map(task=>task.close()));
            if(results.some(result=>result.status==='rejected'))throw new Error('Background task shutdown failed after draining');
        })();
    }
}

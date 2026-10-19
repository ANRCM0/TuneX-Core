import { ControlError } from './errors.ts';

/** Wait for actual application completion, not merely a disconnected HTTP socket. */
export class RequestLifecycle {
    private active=0;
    private stopping=false;
    private waiting:Promise<void>|undefined;
    private drained:(()=>void)|undefined;
    async run<T>(action:()=>Promise<T>):Promise<T> {
        if(this.stopping)throw new ControlError('CONTROL_STOPPING',503,'Control is shutting down',true);
        this.active++;
        try{return await action();}finally{this.active--;if(this.active===0)this.drained?.();}
    }
    stopAdmission() {this.stopping=true;}
    drain():Promise<void> {
        this.stopAdmission();
        if(this.active===0)return Promise.resolve();
        return this.waiting??=new Promise<void>(resolve=>{this.drained=resolve;});
    }
}

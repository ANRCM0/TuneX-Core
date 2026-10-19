import { DEFAULT_POLICY } from '@tunex/contracts/shared';

export { verifyMultihopRelease } from '../infrastructure/multihop-release.ts';

export const nativeControlStartupEffects = {
    env:(name:string)=>process.env[name],
    defaultPolicy:DEFAULT_POLICY,
    log:(message:string)=>console.log(message),
    onSignal:(signal:'SIGINT'|'SIGTERM',callback:()=>void)=>process.on(signal,callback),
};

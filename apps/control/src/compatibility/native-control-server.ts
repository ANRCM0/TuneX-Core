import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { ControlError } from '../framework/public.ts';

export interface NativeProtectedNotificationPaths {
  notificationSecretsDirectory?:string|undefined;stateDirectory:string;caCert:string;caKey:string;serverCert:string;serverKey:string;
}

export function nativeProtectedNotificationRoot(options:NativeProtectedNotificationPaths):string {
      const root=resolve(options.notificationSecretsDirectory!),contains=(parent:string,child:string)=>{
        const tail=relative(resolve(parent),resolve(child));return tail===''||tail!=='..'&&!tail.startsWith('..'+sep)&&!isAbsolute(tail);
      };
      if (!isAbsolute(options.notificationSecretsDirectory!)||root!==options.notificationSecretsDirectory||
          [options.stateDirectory,...[options.caCert,options.caKey,options.serverCert,options.serverKey].map(dirname)].some(path=>contains(root,path)||contains(path,root)))
        throw new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Independent protected notification directory required');
  return root;
}

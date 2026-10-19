import { ControlError } from '../../framework/public.ts';

export interface ControlServerPreflightPolicy {
  leaseSeconds:number;maxClockSkewSeconds:number;pollIntervalSeconds:number;
}
export interface ControlServerPreflightOptions<Policy extends ControlServerPreflightPolicy> {
  webhookDeliveryEnabled?:boolean;notificationSecretsDirectory?:string|undefined;
  probeScheduleEnabled?:boolean;probeExecutionEnabled?:boolean;probeIngressEnabled?:boolean;
  probeServicesEnabled?:boolean;policy?:Policy;relayCredentialSeconds?:number;credentialOverlapSeconds?:number;
}

export function checkControlServerPreflight<Policy extends ControlServerPreflightPolicy>(
  options:ControlServerPreflightOptions<Policy>,defaultPolicy:Policy):Policy {
  if(options.webhookDeliveryEnabled===true&&!options.notificationSecretsDirectory)throw new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Webhook delivery requires protected notification storage');
  if(options.probeScheduleEnabled===true&&options.probeExecutionEnabled!==true)throw new Error('Probe schedule requires original Probe execution');
  if(options.probeIngressEnabled===true&&options.probeExecutionEnabled!==true)throw new Error('Ingress Probe requires original Probe execution');
  if(options.probeServicesEnabled===true&&(options.probeIngressEnabled!==true||options.probeExecutionEnabled!==true))throw new Error('Controlled service TLS Probe requires ingress and original Probe execution');
  if(options.probeExecutionEnabled===true&&(options.policy??defaultPolicy).maxClockSkewSeconds!==1)throw new Error('Probe execution requires an explicitly configured one-second maximum clock skew');
  const policy=options.policy??defaultPolicy,lead=Math.max(60,policy.leaseSeconds+2*policy.maxClockSkewSeconds+2*policy.pollIntervalSeconds),lifetime=options.relayCredentialSeconds??86400;
  if(!Number.isInteger(lifetime)||lifetime<2*lead||lifetime>86400||(options.credentialOverlapSeconds??120)+1>=lifetime-lead)throw new Error('Relay credential lifetime must allow renewal before expiry and bounded overlap');
  return policy;
}

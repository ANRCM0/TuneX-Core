import type { PathTemplateHead } from '../path-owner/public.ts';
import type { PathTemplateQueryApi, PathTemplateCommandApi, PathTemplatePage, PathTemplateView } from '../path-owner/public.ts';
import type { PathBindingApi } from '../path-owner/public.ts';
import type { ForwardBindingApi } from '../forward-owner/public.ts';

export const NATIVE_TUNNEL_API_INTERFACE_VERSION=1 as const;
export interface NativeTunnelManagement {
    readonly version:1;readonly kind:'native-logical-tunnel';readonly backingResource:'path-template';
    readonly configurationReuse:true;readonly physicalConnectionSharing:false;
    readonly allocationOwner:'forward-runtime';readonly health:'not-assessed';
}
export interface NativeTunnelPage extends Omit<PathTemplatePage,'items'> {
    items:(PathTemplateHead&{tunnelId:string})[];management:NativeTunnelManagement;
}
export interface NativeTunnelView extends PathTemplateView {
    tunnelId:string;management:NativeTunnelManagement;
    topology:{nodeId:string;role:string;endpointRevision:number|null}[];
}
export interface NativeTunnelApi {
    list(...args:Parameters<PathTemplateQueryApi['list']>):Promise<NativeTunnelPage>;
    get(...args:Parameters<PathTemplateQueryApi['get']>):Promise<NativeTunnelView>;
    publish:PathTemplateCommandApi['publish'];
    archive:PathTemplateCommandApi['archive'];
    binding:PathBindingApi['get'];
    preview:PathBindingApi['preview'];
    references:PathBindingApi['references'];
    apply:ForwardBindingApi['applyPath'];
}

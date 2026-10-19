import { isCounter, isId } from '@tunex/core';
import { invalid, pageWindow as consolePage } from '../framework/public.ts';

export type NativeQuerySearch = URLSearchParams;
export interface NativeReferenceQuery {page?:string|undefined;limit?:string|undefined;revision?:number|undefined;targetRevision?:number|undefined}
export interface NativeTunnelPaging {page?:string|undefined;limit?:string|undefined}
export interface NativeTelemetryRollupQuery {
    family?:string|undefined;resolution?:string|undefined;from?:string|undefined;to?:string|undefined;
    limit?:string|undefined;seriesKey?:string|undefined;after?:string|undefined;
}

export function nativeConsoleQuery<Kind extends string>(kind: Kind, search: URLSearchParams,
    filterNames: Readonly<Record<Kind, readonly string[]>>,
    validateFilters: (kind: Kind, filters: Record<string, string>) => void) {
    const filters: Record<string, string> = {};
    for (const [key, value] of search) {
        if (search.getAll(key).length !== 1 || !['page', 'limit', ...filterNames[kind]].includes(key))
            invalid('Invalid console query parameter');
        if (key !== 'page' && key !== 'limit') filters[key] = value;
    }
    validateFilters(kind, filters);
    const page = search.get('page') ?? undefined, limit = search.get('limit') ?? undefined;
    consolePage(page, limit);
    return { page, limit, filters };
}

export function transportReferenceQuery(search: URLSearchParams): NativeReferenceQuery {
    const query: NativeReferenceQuery = {};
    for (const [key, value] of search) {
        if (!['page', 'limit', 'revision', 'targetRevision'].includes(key) || search.getAll(key).length !== 1)
            invalid('Unknown or duplicate Profile reference query parameter');
        if (key === 'page' || key === 'limit') query[key] = value;
        else {
            if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value))) invalid('Canonical locked Profile revision required');
            query[key as 'revision' | 'targetRevision'] = Number(value);
        }
    }
    consolePage(query.page, query.limit);
    return query;
}

export function tunnelReferenceQuery(search: URLSearchParams): NativeTunnelPaging {
    const query: NativeTunnelPaging = {};
    for (const [key, value] of search) {
        if (!['page', 'limit'].includes(key) || search.getAll(key).length !== 1) invalid('Unknown or duplicate tunnel reference parameter');
        query[key as 'page' | 'limit'] = value;
    }
    consolePage(query.page, query.limit);
    return query;
}

export function pathTemplateListQuery(search: URLSearchParams) {
    const query: { page?: string; limit?: string; prefix?: string } = {};
    for (const [name, value] of search) {
        if (!['page', 'limit', 'prefix'].includes(name) || search.getAll(name).length !== 1) invalid('Unknown or duplicate PathTemplate list query');
        query[name as keyof typeof query] = value;
    }
    consolePage(query.page, query.limit); return query;
}

export function pathTemplateRevisionQuery(search: URLSearchParams): number | undefined {
    for (const [name] of search) if (name !== 'revision' || search.getAll(name).length !== 1) invalid('Only one exact template revision is supported');
    const value = search.get('revision');
    if (value === null) return undefined;
    if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value))) invalid('Canonical PathTemplate revision required');
    return Number(value);
}

export function pathReferenceQuery(search: URLSearchParams) {
    const query: { page?: string; limit?: string; revision?: number; targetRevision?: number } = {};
    for (const [name, value] of search) {
        if (!['page', 'limit', 'revision', 'targetRevision'].includes(name) || search.getAll(name).length !== 1)
            invalid('Unknown or duplicate PathTemplate reference query');
        if (name === 'page' || name === 'limit') query[name] = value;
        else {
            if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value)) || Number(value) > 64) invalid('Canonical exact PathTemplate revision required');
            query[name as 'revision' | 'targetRevision'] = Number(value);
        }
    }
    consolePage(query.page, query.limit); return query;
}

export function pathGroupReferenceQuery(search: URLSearchParams) {
    if (search.has('targetRevision')) invalid('Group references do not expand or switch a target revision');
    const query = pathReferenceQuery(search);
    return { ...query };
}

export function pathPublicationListQuery(search: URLSearchParams) {
    const query: { page?: string; limit?: string } = {};
    for (const [name, value] of search) {
        if (!['page', 'limit'].includes(name) || search.getAll(name).length !== 1) invalid('Unknown or duplicate publication query');
        query[name as keyof typeof query] = value;
    }
    consolePage(query.page, query.limit); return query;
}

export function ingressDeploymentListQuery(search: URLSearchParams) {
    const query: { page?: string; limit?: string; groupId?: string } = {};
    for (const [name,value] of search) {
        if (!['page','limit','groupId'].includes(name) || search.getAll(name).length !== 1) invalid('Unknown or duplicate ingress deployment query');
        query[name as keyof typeof query] = value;
    }
    consolePage(query.page, query.limit);
    if (query.groupId !== undefined && !isId(query.groupId)) invalid('Exact ingress group filter required');
    return query;
}

export function telemetryHistoryQuery(search: URLSearchParams) {
    const query: { from?: string; to?: string; limit?: string } = {};
    for (const [name, value] of search) {
        if (!['from', 'to', 'limit'].includes(name) || search.getAll(name).length !== 1)
            invalid('Unknown or duplicate telemetry query');
        query[name as keyof typeof query] = value;
    }
    return query;
}

export function telemetryRollupQuery(search: URLSearchParams): NativeTelemetryRollupQuery {
    const result: NativeTelemetryRollupQuery = {};
    const allowed = new Set(['family', 'resolution', 'from', 'to', 'limit', 'seriesKey', 'after']);
    for (const [key, value] of search) {
        if (!allowed.has(key) || Object.hasOwn(result, key) || !value) invalid('Closed aggregate query required');
        Object.assign(result, { [key]: value });
    }
    return result;
}

export function auditQuery(search: URLSearchParams) {
    const result: Record<string,string> = {};
    for (const [key,value] of search) {
        if (!['from','to','limit','cursor','actorId','nodeId','forwardId','operationId','errorCode','source'].includes(key) || search.getAll(key).length !== 1)
            invalid('Unknown or duplicate audit query parameter');
        result[key] = value;
    }
    return result;
}

export function stationEventQuery(search: URLSearchParams) {
    const values: Record<string,string>={};
    for (const [key,value] of search) {
        if (!['from','to','limit','cursor','policyId','targetId','rule','kind','acknowledged'].includes(key)||search.getAll(key).length!==1)
            invalid('Unknown or duplicate station event query parameter');
        values[key]=value;
    }
    return values;
}

export function notificationDeliveryQuery(search:URLSearchParams):Record<string,string> {
    const values:Record<string,string>={};
    for(const [key,value]of search) {
        if(!['from','to','limit','cursor','endpointId','eventId','status'].includes(key)||search.getAll(key).length!==1)invalid('Unknown or duplicate notification query parameter');
        values[key]=value;
    }
    return values;
}

export function probeRunQuery(search:URLSearchParams):Record<string,string> {
    const values:Record<string,string>={};
    for(const [key,value]of search) {
        if(!['from','to','limit','cursor','forwardId','nodeId','probeId','state','resultStatus'].includes(key)||search.getAll(key).length!==1)
            invalid('Unknown or duplicate Probe history query parameter');
        if(key==='resultStatus'&&!['connected','unreachable','verified','unverified','echoed','missing'].includes(value))invalid('Invalid Probe history result status');
        values[key]=value;
    }
    return values;
}

export function probePlanQuery(search:URLSearchParams):Record<string,string> {
    const values:Record<string,string>={};
    for(const [key,value]of search) {
        if(!['from','to','limit','cursor','forwardId','mode','state'].includes(key)||search.getAll(key).length!==1)invalid('Unknown or duplicate Probe plan query parameter');
        values[key]=value;
    }
    return values;
}

export function observationServiceRevisionQuery(search: URLSearchParams): number | undefined {
    for (const [name] of search) if (name !== 'revision' || search.getAll(name).length !== 1)
        invalid('Only one exact observation configuration revision is supported');
    const value = search.get('revision');
    if (value === null) return undefined;
    if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value)) || Number(value) > 64)
        invalid('Canonical observation configuration revision required');
    return Number(value);
}

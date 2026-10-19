import { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import { nativeControlClientFingerprint } from './native-control-http.ts';

export interface NativeControlHttpEnvironment {
    Bindings: HttpBindings;
    Variables: {
        actor: string;
        node: string;
        requestId: string;
        fingerprint: string;
    };
}

export type NativeControlHttpApp = Hono<NativeControlHttpEnvironment>;

export function nativeCreateControlHttpApp(): NativeControlHttpApp {
    return new Hono<NativeControlHttpEnvironment>();
}

export function nativeControlQueryString(url: string): string {
    return new URL(url).search;
}

export function nativeControlQueryParams(url: string): URLSearchParams {
    return new URL(url).searchParams;
}

export function nativeControlRequestFingerprint(context: { env?: HttpBindings }): string {
    return nativeControlClientFingerprint(context.env?.incoming?.socket);
}

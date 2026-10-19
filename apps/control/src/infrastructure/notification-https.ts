import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { request } from 'node:https';
import type { RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { Socket, TcpSocketConnectOpts } from 'node:net';
import { ipBytes, isId } from '@tunex/core';
import { parseNotificationDestinationUrl } from '../compatibility/public.ts';
import type { NotificationSender, NotificationSendCode, NotificationSendResult } from '../framework/public.ts';

const result = (outcome: NotificationSendResult['outcome'], code: NotificationSendCode, statusCode: number | null = null): NotificationSendResult =>
    ({ outcome, code, statusCode });
function publicAddress(answer: LookupAddress): boolean {
    const bytes = ipBytes(answer.address);
    if (!bytes || (answer.family === 4 ? bytes.length !== 4 : answer.family === 6 ? bytes.length !== 16 : true)) return false;
    if (bytes.length === 4) {
        const [a,b,c] = bytes as [number,number,number,number];
        return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 100 && b >= 64 && b <= 127) &&
            !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
            !(a === 168 && b === 63 && c === 129 && bytes[3] === 16) &&
            !(a === 192 && (b === 0 || b === 168 || b === 88 && c === 99 || b === 31 && c === 196 ||
                b === 52 && c === 193 || b === 175 && c === 48)) &&
            !(a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) && !(a === 203 && b === 0 && c === 113);
    }
    const first = bytes[0]! * 256 + bytes[1]!, second = bytes[2]! * 256 + bytes[3]!;
    // Conservative unicast only: no mapped/translated, IETF special, documentation or transition networks.
    return first >= 0x2000 && first <= 0x3fff && !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
        first !== 0x2002 && first !== 0x3ffe && !(first === 0x3fff && second < 0x1000) &&
        !(first === 0x2620 && second === 0x4f && bytes[4] === 0x80 && bytes[5] === 0);
}

/** Each attempt resolves once and pins a validated answer; no proxy, redirects, pool reuse or retry. */
export class ControlledNotificationHttps implements NotificationSender {
    private active = 0;
    private closed = false;
    private readonly cancels = new Set<() => void>();
    private drained: Promise<void> = Promise.resolve();
    private signalDrained: (() => void) | undefined;
    idle(): Promise<void> { return this.drained; }
    async close(): Promise<void> {
        this.closed = true;
        for (const cancel of [...this.cancels]) cancel();
        await this.idle();
    }
    async send(input: Parameters<NotificationSender['send']>[0]): Promise<NotificationSendResult> {
        if (this.closed) return result('rejected','ABORTED');
        let destination: ReturnType<typeof parseNotificationDestinationUrl>;
        try { destination = parseNotificationDestinationUrl(input.destination); }
        catch { return result('rejected','DESTINATION_DENIED'); }
        if (!isId(input.deliveryId) || typeof input.body !== 'string' || Buffer.byteLength(input.body,'utf8') > 16384 ||
            !(input.secret instanceof Uint8Array) || input.secret.byteLength !== 32 || typeof input.beforeDispatch !== 'function')
            return result('rejected','REQUEST_INVALID');
        try {
            const body: unknown = JSON.parse(input.body);
            if (!body || typeof body !== 'object' || Array.isArray(body)) return result('rejected','REQUEST_INVALID');
        } catch { return result('rejected','REQUEST_INVALID'); }
        if (input.signal?.aborted) return result('rejected','ABORTED');
        if (this.active >= 2) return result('rejected','CAPACITY_UNAVAILABLE');
        const payload = Buffer.from(input.body,'utf8'), secret = Buffer.from(input.secret);
        let signature: string;
        try { signature = 'v1=' + createHmac('sha256',secret).update(input.deliveryId + '\n','utf8').update(payload).digest('hex'); }
        catch { return result('rejected','REQUEST_INVALID'); }
        finally { secret.fill(0); }
        if (this.active === 0) this.drained = new Promise<void>(resolve => { this.signalDrained = resolve; });
        this.active++;
        const deadlineAt = performance.now() + 5000;
        return new Promise<NotificationSendResult>(resolve => {
            let settled = false, released = false, dnsPending = true, guardPending = false, requestClosed = true, socketClosed = true;
            let req: ClientRequest | undefined, socket: Socket | undefined, response: IncomingMessage | undefined;
            let dnsTimer: ReturnType<typeof setTimeout> | undefined, overallTimer: ReturnType<typeof setTimeout> | undefined;
            const release = () => {
                if (!released && !dnsPending && !guardPending && requestClosed && socketClosed) {
                    released = true; this.cancels.delete(abort); this.active--;
                    if (this.active === 0) { this.signalDrained?.(); this.signalDrained = undefined; }
                }
            };
            const finish = (value: NotificationSendResult) => {
                if (settled) return;
                settled = true;
                if (dnsTimer) clearTimeout(dnsTimer);
                if (overallTimer) clearTimeout(overallTimer);
                input.signal?.removeEventListener('abort',abort);
                resolve(value); release();
            };
            const stop = (code: NotificationSendCode) => {
                finish(result(req ? 'unknown' : 'rejected',code));
                response?.destroy(); req?.destroy(); socket?.destroy();
            };
            const abort = () => stop('ABORTED');
            this.cancels.add(abort);
            input.signal?.addEventListener('abort',abort,{ once: true });
            if (input.signal?.aborted) { dnsPending = false; stop('ABORTED'); return; }
            overallTimer = setTimeout(() => stop('DEADLINE'),5000);
            dnsTimer = setTimeout(() => stop('DNS_TIMEOUT'),2000);
            try {
                lookup(destination.hostname,{ all: true, verbatim: true },async (error,answers) => {
                    dnsPending = false;
                    if (dnsTimer) clearTimeout(dnsTimer);
                    if (settled) { release(); return; }
                    if (error) { finish(result('rejected','DNS_FAILED')); return; }
                    if (!Array.isArray(answers) || answers.length < 1 || answers.length > 8 || !answers.every(publicAddress)) {
                        finish(result('rejected','DNS_DENIED')); return;
                    }
                    const selected = answers[0]!;
                    if (performance.now() >= deadlineAt) { stop('DEADLINE'); return; }
                    // Admission may return early, but an outstanding DB guard still owns this attempt's capacity.
                    guardPending = true;
                    let allowed: boolean;
                    try { allowed = await input.beforeDispatch(); }
                    catch {
                        guardPending = false;
                        if (!settled) finish(result('rejected','GUARD_FAILED'));
                        release(); return;
                    }
                    guardPending = false;
                    if (settled) { release(); return; }
                    if (this.closed || input.signal?.aborted) { stop('ABORTED'); return; }
                    if (performance.now() >= deadlineAt) { stop('DEADLINE'); return; }
                    if (allowed !== true) { finish(result('rejected','DISPATCH_DENIED')); return; }
                    requestClosed = false;
                    try {
                        // Pinned Node24: agent:false creates a fresh Agent without the global Agent's environment proxy options.
                        const options: RequestOptions & Pick<TcpSocketConnectOpts, 'autoSelectFamily'> = {
                            protocol: 'https:', hostname: destination.hostname, port: 443, path: destination.path,
                            method: 'POST', agent: false, servername: destination.hostname, rejectUnauthorized: true,
                            minVersion: 'TLSv1.3', maxHeaderSize: 8192, autoSelectFamily: false,
                            lookup: (_hostname,_options,callback) => callback(null,selected.address,selected.family),
                            headers: { 'Host': destination.hostname, 'Content-Type': 'application/json', 'Accept': 'application/json',
                                'Content-Length': payload.byteLength, 'Connection': 'close', 'X-TuneX-Delivery-Id': input.deliveryId,
                                'X-TuneX-Signature': signature } };
                        req = request(options,incoming => {
                            response = incoming;
                            if (settled) { incoming.destroy(); req?.destroy(); return; }
                            let received = 0;
                            incoming.on('data',(chunk: Buffer) => {
                                received += chunk.byteLength;
                                if (received > 4096) stop('RESPONSE_LIMIT');
                            });
                            incoming.on('error',() => stop('NETWORK_UNKNOWN'));
                            incoming.on('aborted',() => stop('NETWORK_UNKNOWN'));
                            incoming.on('end',() => {
                                if (!incoming.complete) { stop('NETWORK_UNKNOWN'); return; }
                                const status = incoming.statusCode;
                                if (status === undefined || status < 100 || status > 599) { stop('NETWORK_UNKNOWN'); return; }
                                finish(result(status >= 200 && status < 300 ? 'delivered' : 'rejected',
                                    status >= 200 && status < 300 ? 'HTTP_ACCEPTED' : 'HTTP_REJECTED',status));
                                req?.destroy(); socket?.destroy();
                            });
                        });
                        req.on('socket',owned => {
                            socket = owned; socketClosed = false;
                            owned.once('close',() => { socketClosed = true; release(); });
                            if (settled) owned.destroy();
                        });
                        req.once('close',() => { requestClosed = true; release(); });
                        req.on('error',() => stop('NETWORK_UNKNOWN'));
                        req.end(payload);
                    } catch {
                        if (!req) requestClosed = true;
                        stop('NETWORK_UNKNOWN'); release();
                    }
                });
            } catch {
                dnsPending = false; finish(result('rejected','DNS_FAILED'));
            }
        });
    }
}

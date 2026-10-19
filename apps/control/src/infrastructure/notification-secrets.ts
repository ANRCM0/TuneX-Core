import { constants } from 'node:fs';
import { lstat, open, opendir, link, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { isId } from '@tunex/core';
import { parseJson } from '@tunex/contracts/shared';
import { ControlError } from '../framework/public.ts';
import { parseNotificationDestinationUrl } from '../compatibility/public.ts';
import type { NotificationDestination, NotificationSecretBinding, NotificationSecretLease, NotificationSecrets } from '../framework/public.ts';

interface Envelope {
    version: 1; reference: string; binding: NotificationSecretBinding; createdAt: number;
    iv: string; ciphertext: string; tag: string;
}
interface Entry { name: string; reference: string; envelope: Envelope; identity: Stats }
const referencePattern = /^[a-f0-9]{64}$(?![\s\S])/;
const filenamePattern = /^([a-f0-9]{64})(?:\.json|\.[a-f0-9]{32}\.tmp)$(?![\s\S])/;
function unavailable(): never { throw new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Protected notification material unavailable'); }
function capacity(): never { throw new ControlError('RESOURCE_LIMIT',429,'Protected notification material capacity unavailable'); }
function safe(error: unknown): ControlError {
    return error instanceof ControlError && ['NOTIFICATION_SECRETS_UNAVAILABLE','RESOURCE_LIMIT'].includes(error.code) ? error :
        new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Protected notification material unavailable');
}
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).sort().join(',') === keys.sort().join(',');
}
function binding(value: NotificationSecretBinding): NotificationSecretBinding {
    if (!exact(value,['scopeId','endpointId','credentialRevision','authorityDigest']) || !isId(value.scopeId) || !isId(value.endpointId) ||
        typeof value.credentialRevision !== 'number' || !Number.isSafeInteger(value.credentialRevision) || value.credentialRevision < 1 ||
        typeof value.authorityDigest !== 'string' || !/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value.authorityDigest)) unavailable();
    return { scopeId: value.scopeId, endpointId: value.endpointId, credentialRevision: value.credentialRevision, authorityDigest: value.authorityDigest };
}
function destination(value: NotificationDestination): NotificationDestination {
    if (!exact(value,['url','signingKey']) || typeof value.url !== 'string' || typeof value.signingKey !== 'string' ||
        !/^[a-f0-9]{64}$(?![\s\S])/.test(value.signingKey)) unavailable();
    const parsed = parseNotificationDestinationUrl(value.url);
    return { url: parsed.url, signingKey: value.signingKey };
}
const sameIdentity = (a: Stats, b: Stats) => a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.mode === b.mode;
const sameFile = (a: Stats, b: Stats) => sameIdentity(a,b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs && a.nlink === b.nlink;
function secure(info: Stats, directory: boolean, mode: number, maxLinks = 1): void {
    if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()) || info.uid !== process.getuid!() ||
        (info.mode & 0o7777) !== mode || !directory && (info.nlink < 1 || info.nlink > maxLinks)) unavailable();
}
function decode64(value: unknown, length?: number): Buffer {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$(?![\s\S])/.test(value)) unavailable();
    const bytes = Buffer.from(value,'base64url');
    if (bytes.toString('base64url') !== value || length !== undefined && bytes.length !== length) unavailable();
    return bytes;
}
const aad = (value: NotificationSecretBinding, reference: string, createdAt: number) => Buffer.from(JSON.stringify({ version: 1, binding: value, reference, createdAt }));

/** Linux-only protected endpoint material, separate from Authority and SQL backups. */
export class FileNotificationSecrets implements NotificationSecrets {
    private readonly root: string;
    private readonly records: string;
    private readonly key: Buffer;
    private readonly keyIdentity: Stats;
    private readonly rootIdentity: Stats;
    private readonly recordsIdentity: Stats;
    private readonly lock: FileHandle;
    private readonly lockIdentity: Stats;
    private pending: Promise<unknown> = Promise.resolve();
    private closing: Promise<void> | null = null;
    // Process-local leases protect in-flight material, not SQL backup or undiscovered queue references.
    private readonly pins = new Map<string,number>();
    private leases = 0;
    private pinsDrained: Promise<void> = Promise.resolve();
    private signalPinsDrained: (() => void) | undefined;
    private constructor(root: string, key: Buffer, keyIdentity: Stats, rootIdentity: Stats, recordsIdentity: Stats, lock: FileHandle, lockIdentity: Stats) {
        this.root = root; this.records = join(root,'records'); this.key = key;
        this.keyIdentity = keyIdentity;
        this.rootIdentity = rootIdentity; this.recordsIdentity = recordsIdentity; this.lock = lock; this.lockIdentity = lockIdentity;
    }
    static async open(directory: string): Promise<FileNotificationSecrets> {
        let lock: FileHandle | undefined, key: Buffer | undefined, lockIdentity: Stats | undefined;
        let root: string | undefined;
        try {
            if (process.platform !== 'linux' || typeof process.getuid !== 'function' || !isAbsolute(directory) || directory !== resolve(directory)) unavailable();
            root = directory;
            await this.ancestors(root);
            const rootIdentity = await lstat(root), recordsIdentity = await lstat(join(root,'records'));
            secure(rootIdentity,true,0o700); secure(recordsIdentity,true,0o700);
            const contents = await opendir(root);
            try { for await (const entry of contents) if (entry.name !== 'key' && entry.name !== 'records') unavailable(); }
            finally { await contents.close().catch(() => {}); }
            key = await this.readFile(join(root,'key'),32,1);
            if (key.length !== 32) unavailable();
            const keyIdentity = await lstat(join(root,'key')); secure(keyIdentity,false,0o600);
            lock = await open(join(root,'writer.lock'),constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
            lockIdentity = await lock.stat(); secure(lockIdentity,false,0o600);
            await lock.writeFile(JSON.stringify({ pid: process.pid })); await lock.sync();
            await this.syncDirectory(root);
            const owner = new FileNotificationSecrets(root,key,keyIdentity,rootIdentity,recordsIdentity,lock,lockIdentity);
            await owner.parents();
            await owner.inventory();
            return owner;
        } catch (error) {
            key?.fill(0);
            if (lock) {
                await lock.close().catch(() => {});
                if (root && lockIdentity) {
                    try { if (sameIdentity(await lstat(join(root,'writer.lock')),lockIdentity)) await unlink(join(root,'writer.lock')); } catch {}
                }
            }
            throw safe(error);
        }
    }
    private static async ancestors(path: string): Promise<void> {
        let current = path;
        for (;;) {
            const info = await lstat(current);
            if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 && info.uid !== process.getuid!() || (info.mode & 0o022) !== 0) unavailable();
            const parent = dirname(current); if (parent === current) return; current = parent;
        }
    }
    private async parents(): Promise<void> {
        await FileNotificationSecrets.ancestors(this.root);
        const root = await lstat(this.root), records = await lstat(this.records);
        secure(root,true,0o700); secure(records,true,0o700);
        if (!sameIdentity(root,this.rootIdentity) || !sameIdentity(records,this.recordsIdentity)) unavailable();
        const key = await lstat(join(this.root,'key')), lock = await lstat(join(this.root,'writer.lock'));
        secure(key,false,0o600); secure(lock,false,0o600);
        if (!sameFile(key,this.keyIdentity) || !sameIdentity(lock,this.lockIdentity)) unavailable();
        const directory = await opendir(this.root), found = new Set<string>();
        try {
            for await (const entry of directory) {
                if (!['key','records','writer.lock'].includes(entry.name) || found.has(entry.name)) unavailable();
                found.add(entry.name);
            }
        } finally { await directory.close().catch(() => {}); }
        if (found.size !== 3) unavailable();
    }
    private static async readFile(path: string, maximum: number, maxLinks = 2): Promise<Buffer> {
        const initial = await lstat(path); secure(initial,false,0o600,maxLinks);
        const file = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW);
        let result: Buffer | undefined;
        try {
            const before = await file.stat(); secure(before,false,0o600,maxLinks);
            if (!sameFile(initial,before) || before.size > maximum) unavailable();
            result = Buffer.alloc(maximum+1);
            let offset = 0;
            while (offset < result.length) {
                const next = await file.read(result,offset,result.length-offset,null);
                if (!next.bytesRead) break; offset += next.bytesRead;
            }
            const after = await file.stat(), named = await lstat(path);
            if (offset > maximum || offset !== before.size || !sameFile(before,after) || !sameFile(after,named)) unavailable();
            const output = Buffer.from(result.subarray(0,offset)); result.fill(0); result = undefined;
            return output;
        } finally { result?.fill(0); await file.close(); }
    }
    private static async syncDirectory(path: string): Promise<void> {
        const file = await open(path,constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try { await file.sync(); } finally { await file.close(); }
    }
    private serial<T>(action: () => Promise<T>): Promise<T> {
        if (this.closing) return Promise.reject(safe(null));
        const result = this.pending.then(action);
        this.pending = result.catch(() => {});
        return result;
    }
    private async envelope(name: string, expectedReference: string): Promise<{ value: Envelope; material: NotificationDestination }> {
        await this.parents();
        const bytes = await FileNotificationSecrets.readFile(join(this.records,name),8192);
        let plaintext: Buffer | undefined;
        try {
            const value = parseJson(bytes.toString('utf8'),8192);
            if (!exact(value,['version','reference','binding','createdAt','iv','ciphertext','tag']) || value.version !== 1 || value.reference !== expectedReference ||
                typeof value.createdAt !== 'number' || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0) unavailable();
            const bound = binding(value.binding as NotificationSecretBinding), iv = decode64(value.iv,12), tag = decode64(value.tag,16), ciphertext = decode64(value.ciphertext);
            const decipher = createDecipheriv('aes-256-gcm',this.key,iv); decipher.setAAD(aad(bound,expectedReference,value.createdAt)); decipher.setAuthTag(tag);
            plaintext = Buffer.concat([decipher.update(ciphertext),decipher.final()]);
            const decoded = parseJson(plaintext.toString('utf8'),4096), material = destination(decoded as NotificationDestination);
            if (!exact(decoded,['url','signingKey']) || decoded.url !== material.url) unavailable();
            await this.parents();
            return { value: { version: 1, reference: expectedReference, binding: bound, createdAt: value.createdAt,
                iv: value.iv as string, ciphertext: value.ciphertext as string, tag: value.tag as string }, material };
        } finally { bytes.fill(0); plaintext?.fill(0); }
    }
    private async inventory(): Promise<Entry[]> {
        await this.parents();
        const result: Entry[] = [], counts = new Map<string,number>(), directory = await opendir(this.records);
        try {
            for await (const entry of directory) {
                if (result.length >= 4096) capacity();
                const matched = filenamePattern.exec(entry.name); if (!matched) unavailable();
                const reference = matched[1]!, identity = await lstat(join(this.records,entry.name)); secure(identity,false,0o600,2);
                const { value } = await this.envelope(entry.name,reference);
                const endpoint = JSON.stringify([value.binding.scopeId,value.binding.endpointId]), count = (counts.get(endpoint) ?? 0)+1;
                if (count > 32) capacity(); counts.set(endpoint,count);
                result.push({ name: entry.name, reference, envelope: value, identity });
            }
        } finally { await directory.close().catch(() => {}); }
        return result;
    }
    async stage(value: NotificationSecretBinding, requestDigest: string, input: NotificationDestination, keepReference: string | null): Promise<string> {
        try {
            const bound = binding(value), material = destination(input);
            if (typeof requestDigest !== 'string' || !/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(requestDigest) ||
                keepReference !== null && (typeof keepReference !== 'string' || !referencePattern.test(keepReference))) unavailable();
            return await this.serial(async () => {
                const reference = createHmac('sha256',this.key).update(JSON.stringify({ binding: bound, requestDigest })).digest('hex');
                const entries = await this.inventory(), existing = entries.find(entry => entry.name === reference+'.json');
                if (existing) {
                    const previous = await this.envelope(existing.name,reference);
                    if (JSON.stringify(previous.value.binding) !== JSON.stringify(bound) || previous.material.url !== material.url || previous.material.signingKey !== material.signingKey) unavailable();
                    await FileNotificationSecrets.syncDirectory(this.records);
                    return reference;
                }
                const now = Date.now();
                const removable = entries.filter(entry => entry.identity.nlink === 1 && !this.pins.has(entry.reference) && entry.reference !== keepReference && entry.reference !== reference &&
                    entry.envelope.binding.scopeId === bound.scopeId && entry.envelope.binding.endpointId === bound.endpointId &&
                    entry.envelope.createdAt < now-86400000)
                    .sort((a,b) => a.envelope.createdAt-b.envelope.createdAt || (a.name < b.name ? -1 : 1)).slice(0,16);
                for (const entry of removable) {
                    await this.parents();
                    if (!sameFile(await lstat(join(this.records,entry.name)),entry.identity)) unavailable();
                    await unlink(join(this.records,entry.name));
                }
                if (removable.length) await FileNotificationSecrets.syncDirectory(this.records);
                const retained = entries.filter(entry => !removable.includes(entry));
                if (retained.length > 4094 || retained.filter(entry => entry.envelope.binding.scopeId === bound.scopeId && entry.envelope.binding.endpointId === bound.endpointId).length > 30) capacity();
                const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm',this.key,nonce);
                cipher.setAAD(aad(bound,reference,now));
                const plaintext = Buffer.from(JSON.stringify(material));
                let ciphertext: Buffer;
                try { ciphertext = Buffer.concat([cipher.update(plaintext),cipher.final()]); } finally { plaintext.fill(0); }
                const envelope: Envelope = { version: 1, reference, binding: bound, createdAt: now, iv: nonce.toString('base64url'),
                    ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
                const encoded = Buffer.from(JSON.stringify(envelope)); if (encoded.length > 8192) unavailable();
                const temporary = join(this.records,reference+'.'+randomBytes(16).toString('hex')+'.tmp'), final = join(this.records,reference+'.json');
                await this.parents();
                const file = await open(temporary,constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,0o600);
                try { secure(await file.stat(),false,0o600); await file.writeFile(encoded); await file.sync(); }
                finally { encoded.fill(0); await file.close(); }
                // link is exclusive: a committed reference can never be replaced by rename.
                await this.parents(); await link(temporary,final); await FileNotificationSecrets.syncDirectory(this.records);
                await unlink(temporary); await FileNotificationSecrets.syncDirectory(this.records);
                await this.parents();
                return reference;
            });
        } catch (error) { throw safe(error); }
    }
    async read(value: NotificationSecretBinding, reference: string): Promise<NotificationDestination> {
        try {
            const expected = binding(value); if (typeof reference !== 'string' || !referencePattern.test(reference)) unavailable();
            return await this.serial(async () => {
                const result = await this.envelope(reference+'.json',reference);
                if (JSON.stringify(result.value.binding) !== JSON.stringify(expected)) unavailable();
                return result.material;
            });
        } catch (error) { throw safe(error); }
    }
    async acquire(value: NotificationSecretBinding, reference: string): Promise<NotificationSecretLease> {
        try {
            const expected = binding(value); if (typeof reference !== 'string' || !referencePattern.test(reference)) unavailable();
            return await this.serial(async () => {
                if (this.leases >= 2) capacity();
                const result = await this.envelope(reference+'.json',reference);
                if (JSON.stringify(result.value.binding) !== JSON.stringify(expected)) unavailable();
                if (this.leases === 0) this.pinsDrained = new Promise<void>(resolve => { this.signalPinsDrained = resolve; });
                this.leases++; this.pins.set(reference,(this.pins.get(reference) ?? 0)+1);
                let released = false;
                return Object.freeze({ destination: Object.freeze(result.material), release: () => {
                    if (released) return;
                    released = true;
                    const count = this.pins.get(reference)!;
                    if (count === 1) this.pins.delete(reference); else this.pins.set(reference,count-1);
                    this.leases--;
                    if (this.leases === 0) { this.signalPinsDrained?.(); this.signalPinsDrained = undefined; }
                } });
            });
        } catch (error) { throw safe(error); }
    }
    async close(): Promise<void> {
        if (!this.closing) this.closing = (async () => {
            await this.pending;
            // Active network owners release leases only after the sender's real DNS/socket drain.
            await this.pinsDrained;
            try {
                await this.parents();
                const current = await lstat(join(this.root,'writer.lock'));
                if (!sameIdentity(current,this.lockIdentity)) unavailable();
                await this.lock.close(); await unlink(join(this.root,'writer.lock')); await FileNotificationSecrets.syncDirectory(this.root);
            } catch (error) { await this.lock.close().catch(() => {}); throw safe(error); }
            finally { this.key.fill(0); }
        })();
        return this.closing;
    }
}

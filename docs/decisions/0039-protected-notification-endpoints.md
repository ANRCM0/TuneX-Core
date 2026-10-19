# ADR-0039: Protected Notification Endpoint Intent

Date: 2026-10-18 (Asia/Shanghai). Status: D3-B2 first slice locally implemented,
unverified. See [contract](../spec/notification-endpoints-v1.md).

Historical first-slice boundary: the unconnected-sender statements below describe
this slice as delivered. The subsequent [ADR-0040](0040-bounded-notification-delivery.md)
adds a default-off bounded outbox/worker and post-DNS dispatch guard; see its
[delivery contract](../spec/notification-deliveries-v1.md) for the later behavior.
This does not retroactively validate either slice or remove the separation of secrets.

## Decision And Deliberate Incompleteness

Add manager-owned notification endpoint intent, bounded management audit and a
separate protected destination store. Provide an independent controlled HTTPS
sender implementation, but DO NOT connect it to station events, HTTP routes,
scheduled timers or a queue in this slice. API reports `deliveryAvailable:false`.
Saving/enabling an endpoint never sends, tests, validates DNS reachability or
authorizes Forward/Runtime/Probe execution. No external delivery is active.

Policies/events remain the station-alert owner's facts. Endpoint subscription
metadata selects explicit policy IDs and event kinds with fixed minimum interval;
that interval is stored intent, not implemented delivery rate enforcement.
Later source-event handoff/outbox/dedupe/silence/recovery/rate/retry/dead-letter
work is still required before any sender is wired.

## Secret Separation And Transaction Boundary

SQL owns only endpoint/config metadata, credential revision, private opaque
credential reference and Authority binding digest. Public DTOs disclose neither
URL/hostname nor signing key, credential reference, Authority digest or a
secret-derived digest. `configDigest` hashes NONSECRET config only. GET does not
read/decrypt vault records and does not prove that material remains usable.

Manager authorization, CAS, original Idempotency, SQL endpoint and management audit
commit in the original supplied transaction. Every PUT fully replaces destination
and signing key and advances both endpoint and credential revision, even with the
same values. Identical-key replay returns the old bounded receipt. Disable does
not require vault availability and only changes enabled/config digest/revision;
already-disabled is a no-op after CAS. No partial key/URL readback or merge API.

Vault stage writes an immutable durable encrypted file BEFORE SQL publishes its
reference. There is no filesystem/MySQL atomic transaction: SQL failure may leave
a bounded orphan. Reference derives from local-key HMAC of binding/request digest;
same accepted intent cannot silently replace another immutable file. AES-256-GCM
authenticates scope, endpoint, credential revision, Authority digest, reference and
creation time. The independent vault key is NOT Authority signing material.

## Operator-Provisioned Linux Vault

Vault is optional and Linux-only. Operator preprovisions an absolute canonical root,
`records/` directory and raw32-byte `key`; root/records require0700, key0600 and
current process UID ownership. Ancestors must be root/process-owned directories,
not symlinks or group/world writable. No auto-create, auto-init or automatic key
rotation. Missing/malformed permissions/material fail closed; Windows support is
not claimed. Exclusive writer.lock prevents concurrent writers. A stale lock after
crash requires operator verification and cleanup, not automatic takeover.

`TUNEX_NOTIFICATION_SECRETS` optionally selects this root; it cannot overlap Control
state/Authority or configured PKI certificate/key directories in either direction.
Unset/empty config leaves the vault unavailable, without disabling safe metadata
reads or disable. Configuring storage does not activate a delivery worker.

Records are bounded and authenticated during inventory; unrecognized files or
tampering fail closed. At most4096 record entries,32 per Scope/endpoint,8192 bytes
per envelope: at most32MiB logical envelope bytes, not measured filesystem capacity.
Staging reserves temporary/final entry capacity. Opportunistic GC considers at
most16 old records for the same endpoint, older than24 hours,
excluding the current supplied keepReference/new reference and multiply linked
files, including failed same-credential-revision orphans. Current SQL head lock and
single writer protect this no-outbox slice. Future outbox references will require
separate retention protection before delivery is added. This is not universal
SQL-reference discovery, guaranteed orphan cleanup or
unlimited rotation. Capacity rejection is preferable to silently removing live data.

Node path operations use lstat/O_NOFOLLOW, ownership/mode/inode checks, bounded
reads and file/directory fsync; immutable publication uses exclusive link, not
replace-by-rename. These checks assume no malicious root/same-UID process racing
trusted parent directories; they are not openat2/dirfd isolation or a hostile-host
security boundary. Vault backups/key lifecycle remain an explicit operator duty,
separate from SQL backup and protected Journal/high-water.

## Controlled HTTPS Primitive

Each attempt accepts HTTPS443 and a canonical public DNS hostname only; no IP
literal, credentials, query/fragment, redirect, proxy or automatic retry. Resolve
each attempt, validate EVERY answer (at most8) against conservative IPv4/IPv6
public-address policy, then pin one IP while retaining original Host, SNI and
certificate verification. TLS minimum1.3. DNS2 seconds/overall5 seconds, at most2
active attempts; timeout/abort may return early but retain capacity until actual
lookup/request/socket completion. No late DNS callback can initiate a timed-out send.

POST JSON body at most16384 bytes; headers8192 bytes and response body4096 bytes.
Key is32 bytes. Stable delivery ID and signature headers use HMAC-SHA256 over
deliveryId + newline + exact body; no timestamp changing retry identity. HTTP 2xx
means HTTP acceptance only, not downstream application processing. Results expose
only closed outcomes/codes/status, never body or raw network errors. TLS/network
uncertainty after dispatch remains unknown. Sender has no active caller here.

Subsequent change: [ADR-0040](0040-bounded-notification-delivery.md) now supplies
the default-off caller with post-DNS preflight, fenced attempts and actual-drain
vault leases. The preceding unconnected statement records this first slice only.

No tests, static/type/syntax checks, formatters, generated fixtures, network feature
requests, CI, commits or pushes were run. Official Node API/source lookup was
documentation research only. D3, notification delivery and the project are not complete.

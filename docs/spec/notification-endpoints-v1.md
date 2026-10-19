# Protected Notification Endpoints v1

Date: 2026-10-18 (Asia/Shanghai). D3-B2 first slice: local implementation,
unverified. [ADR-0039](../decisions/0039-protected-notification-endpoints.md).

Historical scope: this document records the first endpoint/sender slice. Its
unconnected/deliveryAvailable:false statements remain that slice's record.
[Notification deliveries v1](notification-deliveries-v1.md) /
[ADR-0040](../decisions/0040-bounded-notification-delivery.md) adds the subsequent
default-off outbox/worker, actual-drain vault pins and post-DNS guard. Consult that
contract for later delivery behavior; neither slice has verification evidence yet.

## Scope And Access

Manager-only endpoint list/get/publish/disable manage notification INTENT. No
station event handoff, outbox, delivery queue, timer, send/test route or external
delivery is connected. `deliveryAvailable:false` is fixed. Config enabled does not
mean sending enabled; `minimumIntervalSeconds` does not yet enforce delivery rate.
No GET or management command performs DNS, sockets, Probe or Runtime work.

Current manager Scope authorization shares the supplied SQL transaction with
reads or CAS/original Idempotency/management audit. Before it, Bearer lookup and
pre-auth admission use the observation boundary, not a claim of atomic identity
authentication plus projection. Requests have2 active slots,128 actor keys and
1000ms cooldown without Runtime-pool fallback. Cross-Scope lookup never borrows
another Scope's policy, endpoint or credentials.

Routes (Bearer, no query parameters):
- `GET /api/v1/scopes/:scope/notification-endpoints`
- `GET /api/v1/scopes/:scope/notification-endpoints/:id`
- `PUT /api/v1/scopes/:scope/notification-endpoints/:id`
- `POST /api/v1/scopes/:scope/notification-endpoints/:id/disable`

PUT body is exactly `{expectedRevision,config,destination}`. Disable body is
exactly `{expectedRevision}`. There is no endpoint test/send API.

## Closed Configuration And Commands

Nonsecret config is exactly `{schemaVersion,enabled,policyIds,kinds,minimumIntervalSeconds}`.
Version is1; enabled is boolean. Policy IDs are nonempty, sorted, unique valid IDs,
at most16, and must exist in the same Scope when published. Kinds are nonempty,
sorted, unique selections of firing/invalidated/recovered. Minimum interval is an
integer10..3600 seconds. No free expression, destination options or arbitrary headers.

Destination is exactly `{url,signingKey}`. URL is at most2048 UTF-8 bytes, HTTPS
only on443, canonicalized ASCII DNS hostname with a non-special-use suffix, no
IP literal/userinfo/query/fragment/backslash/control characters. Signing key is
exactly64 lowercase hexadecimal characters representing32 bytes. This does not
resolve DNS during publication; network validation belongs to a later send attempt.

Every PUT includes complete config and destination plus expectedRevision. A new
ID uses revision0. After original replay handling, any accepted new PUT advances
endpoint revision AND credentialRevision, even for identical config/destination;
it is full credential replacement/adoption, not secret comparison or partial merge.
Config digest includes only nonsecret config. No echo of URL/key or secret digest.

Disable takes expectedRevision and original Idempotency key. It operates without
reading/requiring the vault. Already-disabled is200/changed:false after CAS; a new
disable is202/changed:true and increments endpoint revision only. Old credentials
are not revealed or rotated. Current manager authorization precedes replay, and
replayed receipts are reconstructed as closed endpointId/revision/changed values.

## Public DTO And Limits

Envelope includes notificationEndpointsVersion1, scopeId, numeric epoch capturedAt,
secretsConfigured, deliveryAvailable:false, source:persisted-notification-endpoints,
readOnly:true, executionAuthorized:false, health:unknown, networkCheck:not-performed,
consistency:read-committed-not-global-snapshot, limits and bounded metadata.
Endpoint DTO contains endpointId, revision, credentialRevision, nonsecret config,
configDigest, managedBy, createdAt, updatedAt, suspended and
credentials:{configured:true,verification:not-read-on-get}. The credentials marker
is metadata, not a successful vault read/decryption or delivery test.

Do not return URL/hostname/path, signing key, credentialRef, Authority digest,
secret-derived digest, ciphertext, raw vault errors or original request bodies.
Audit contains only ID/endpoint/revision/kind/actor/time; get shows at most16
entries with truncation. Limits are16 endpoints per Scope including disabled IDs,
16 policy selections per endpoint,128 retained management audits per Scope,
request8192 bytes and response131072 bytes. Evicted audit count is explicit.

## Protected Material And Recovery

SQL tables0030 hold endpoint Scope/metadata/audit only. The immutable encrypted
vault record is durable before SQL publication. SQL rollback can leave an orphan;
filesystem and SQL are not jointly atomic. Stage reference is local-key HMAC of
binding/request digest. AES-256-GCM authenticated binding includes Scope, endpoint,
credential revision, Authority digest, reference and creation time. Local key is
independent of Authority key material and SQL backup.

Optional Linux vault root must be operator-preprovisioned, absolute/canonical,
owned by current UID with0700 root and records; `key` is raw32 bytes,0600,
single-linked. Ancestors are root/current-UID owned, non-symlink and not
group/world writable. No auto-init/key generation/lock stealing. Exclusive
writer.lock serializes processes; operator must verify process death before
cleaning a stale lock. Unknown root entries, bad ownership/modes, bad authentication
or changed file identity fail closed. Normal close removes its own lock and clears
the in-memory key buffer; it is not comprehensive process-memory erasure.

Set optional `TUNEX_NOTIFICATION_SECRETS` to that absolute root; layout is
`<root>/key` and `<root>/records/`. Empty/unset environment does not open a vault.
The directory must not overlap Control state/Authority or any configured PKI
certificate/key directory in either direction. Server opens/closes its configured
vault owner; no delivery flag or sender start is composed. This environment
configures protected storage only, not network delivery.

Inventory caps4096 entries globally,32 per Scope/endpoint,8192 bytes per envelope;
temporary and final names both consume entries. Logical envelope cap32MiB excludes
filesystem overhead, key/lock and physical storage behavior. Stage reserves two
entries. GC examines up to16 same-endpoint old singly-linked
records older than24 hours, excluding current keepReference/new reference; no
universal reference scan or guaranteed immediate orphan cleanup. Exhaustion rejects
rather than growing without bound. Storage operations/GC costs remain unverified.
Same-binding failed publication orphans are eligible too; single writer and current
SQL head lock apply in this no-outbox slice. Future queued references require new
retention protection before delivery is connected.

Path checks use Linux lstat/O_NOFOLLOW/inode/mode/owner checks and fsync with
exclusive immutable link publication, not openat2 directory-FD confinement.
Root/same-UID hostile directory replacement, malicious process monkeypatching,
kernel compromise and comprehensive filesystem rollback protection are outside
this boundary. Protected parent paths and independent vault backup/key handling
are operator responsibilities. Do not clear Journal or physical high-water.

Recovery suspends endpoint metadata; Authority binding prevents treating restored
credentials as automatically current. No automatic delivery/resume/replay exists.
Explicit full current-manager publication is required to rebind/re-adopt. Missing
vault configuration does not prevent SQL metadata reads or disable.

## HTTPS Sender Primitive, Not Connected Delivery

Subsequent implementation: [notification deliveries](notification-deliveries-v1.md)
connects the default-off outbox worker, post-DNS preflight and actual-drain vault
pins. The unconnected/pending descriptions in this section remain the historical
first-slice boundary, not a statement that the subsequent source is absent.

`ControlledNotificationHttps.send` accepts destination URL, stable deliveryId,
exact JSON body,32-byte secret and optional AbortSignal. At most2 attempts are
active, with no queue. Every attempt revalidates syntax and resolves all answers;
at most8 answers and ALL must be conservatively public. Deny private, loopback,
link-local, metadata, documentation, reserved, mapped/translated and transition
addresses. IPv6 permits only2000::/3 minus excluded special/documentation ranges.
If one answer is forbidden, do not choose a different permissible answer.
The explicitly denied Azure platform VIP168.63.129.16 is not treated as an ordinary
public destination just because it uses globally numbered address space; see the
[platform address description](https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16).
This fixed policy is not an inventory of an operator's custom routes, NAT, special
network services or future registry changes; deployment egress isolation remains
an independent requirement, not something syntax/DNS checks prove.

One selected IP is pinned with a request-local lookup while original hostname
remains HTTP Host/TLS SNI/certificate identity. No global DNS mutation, proxy,
redirect, pooled connection or automatic retry. TLS minimum1.3 with certificate
verification. Pinned Node24 agent:false creates a fresh Agent without global
Agent environment-proxy options; malicious runtime monkeypatching is not defended.

DNS deadline2000ms; overall deadline5000ms; request JSON16384 bytes; response
headers8192 bytes; response body4096 bytes maximum. Timeout or abort may return a
result early but holds active capacity until actual noncancelable lookup callback
and request/socket close. Never dial after an expired DNS attempt. No response
body or raw network errors are returned, persisted or logged by the sender.

Fixed method POST, Content-Type/Accept application/json, exact Content-Length,
X-TuneX-Delivery-Id and X-TuneX-Signature. Signature is `v1=` plus lowercase
HMAC-SHA256 hex of deliveryId + newline + exact UTF-8 body. No per-attempt timestamp.
Recipient dedupe needs stable delivery ID/body, not signature freshness assumptions.
HTTP 2xx returns delivered/HTTP_ACCEPTED meaning HTTP receipt ONLY. Complete
non2xx, including3xx/429/5xx, returns rejected/HTTP_REJECTED without redirect or
retry. Predispatch denial is rejected; TLS/network/deadline uncertainty after
request creation is unknown. Delivery results never change Forward/Operation status.

Source-event handoff, durable outbox, delivery dedupe/rate/silence/recovery handling,
bounded retries/dead-letter and controlled worker activation remain PENDING. No
network feature calls or tests/static/type/syntax checks/formatting/scripts/fixtures/
CI/commit/push were performed. D3/project completion or production safety is not claimed.

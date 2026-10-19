# Observation Service Declarations v1

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[ADR-0044](../decisions/0044-observation-service-authority.md).

## Ownership And Meaning

A Scope manager declares a dedicated controlled service endpoint and public TLS
trust; no endpoint ownership, remote certificate, private-key control, availability
or health is verified. The registry is inert metadata, not a probe executor,
remote process controller or target-policy exception. No private key/secret enters
its schema, GET or Console. All operations require current Scope manager rights.
An independently operated TLS-only responder is included. The initial ADR-0044
slice had no measurement client. The subsequent
[Direct ingress TLS contract](direct-ingress-tls-probes-v1.md) connects a narrow
current-trust resolver to the original Probe owner, not an issuer in this registry.
measurementAvailable is now a boolean for configured Control TLS issuance only,
not a command, Agent/worker liveness or network success. All registry operations
remain no-network/no-permit and do not establish endpoint ownership or health.

## Closed Configuration

Exactly these fields:
- version:1 and purpose:direct-ingress-tls-handshake.
- endpoint:{address,port}: exact numeric IP and integer port 1..65535.
- trust:{mode:pinned-leaf-v1,serverName,certificateDer}: lowercase multi-label DNS
  identity, not a DNS network target, and one canonical base64 public DER leaf.
- validFrom/validUntil: numeric UTC epoch milliseconds, safe nonnegative integers
  no later than 253402300799999, positive span at most 604800000 milliseconds.

Address rejects wildcard/unspecified, mapped IPv6, zones, multicast, IPv4 0/8,
169.254/16, 100.100.100.200, IPv6 link-local and fd00:ec2::254. IPv6 text is canonical;
exact loopback is allowed but is not external observation. No user URL path,
credentials, arbitrary headers, DNS resolution or wildcard-to-loopback rewrite.

Service ID is `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. The identity URI is exactly
`urn:tunex:observation-service:${encodeURIComponent(scope)}:${serviceId}`. Public
DER is at most 8192 bytes, config at most 16384 UTF-8 bytes. Server parses a dedicated
non-CA serverAuth-only leaf with exactly one DNS SAN matching serverName and one
URI SAN matching that scoped identity; no IP/email/extra SAN or dual-purpose EKU.
Accepted public keys are Ed25519, RSA 2048..8192 bits or EC P-256/P-384/P-521.
Certificate validity must encompass the entire configuration window. Certificate
structure is a configuration constraint, not a remote possession/ownership proof.

Trust detail reports mode, SHA-256 raw-leaf fingerprint, serverName, serviceIdentity,
alpn:tunex-observation/1, certificateNotBefore/certificateNotAfter milliseconds and
chainValidation:not-used-exact-leaf-pin. No public-CA/OS-store chain verification
is claimed. The leaf is public, but its manager-only disclosure does not authorize
a client or endpoint. A config digest identifies normalized config, not authority.

## Head, Revisions And Limits

Head is {serviceId,revision,configRevision,archived,recoverySuspended}. revision is
the CURRENT metadata CAS, separate from immutable configRevision (1..64), and never
less than configRevision. Selected revision record is exactly
{configRevision,config,configDigest,createdBy,createdAt}. Old records are immutable.

Limits are servicesPerScope:32 (including archived identities),
revisionsPerService:64, auditPerScope:256, auditPage:16, certificateBytes:8192,
configBytes:16384, responseBytes:131072 and validityMs:604800000. No automatic
eviction/reuse of service IDs or config history is offered. Audit is lossy: append
at capacity evicts oldest event and increases cumulative Scope auditEvicted; absence
from the latest bounded audit is not proof that an action never occurred.
These are this owner's detail audits only. The existing central AuditEvents query
retains its closed fifteen-source contract and does not automatically ingest this
new owner; no all-site audit coverage or complete security history is claimed.

## Manager API

All routes are under `/api/v1/scopes/:scope/observation-services`:
- GET list: no query; returns all bounded heads (at most 32, including archived).
- GET /:id: the only optional query is revision=1..64 for one EXACT configRevision;
  omission selects the current one. Unknown/duplicate/noncanonical query rejects.
- PUT /:id: exactly {expectedRevision,config}, Idempotency-Key required. Metadata
  expectedRevision=0 means create, otherwise exact current head CAS.
- DELETE /:id: exactly {expectedRevision}, positive current metadata CAS and original
  Idempotency-Key. It archives, never deletes immutable history or reuses the ID.

GET remains read-only/no-network. PUT request bound is 18432 UTF-8 bytes; DELETE
is 2048. Unknown fields/mutation queries reject. Unknown/cross-Scope records return
404 after current management authorization. Archived public history remains readable.

Publication requires now < validUntil <= now+7days in addition to the fixed config
span/certificate bounds; validFrom can be in the future. New identity starts
metadata/config revision 1. Same config when not suspended returns unchanged 200.
Changed config advances metadata and appends configRevision+1. Explicit valid
same-config republish after recovery advances metadata only and clears suspension;
old invalid/expired config cannot be reactivated merely by replaying a new command.
Archived identities reject PUT permanently; first archive advances metadata only,
repeat archive is unchanged. Command checks CAS and current permission; immutable
revision creation, metadata/audit and original-key response commit together.

HTTP command body is {serviceId,revision,configRevision,configDigest,archived,
recoverySuspended,changed}; changed uses status 202, unchanged 200. The internal
idempotency receipt wraps status/body, but HTTP returns body directly. Replay
requires current manager permission and returns the original receipt without
rewriting config or repairing a missing response with a new command key.

Every GET envelope is {observationServicesVersion:1,scopeId,capturedAt,
source:manager-declared-observation-services,readOnly:true,executionAuthorized:false,
health:unknown,ownership:not-verified,networkCheck:not-performed,
measurementAvailable:false,consistency:read-committed-not-global-snapshot,limits}.
List adds items/auditEvicted. Detail adds head, selected revision, trust, lifecycle,
audit:{items,truncated}, auditEvicted. Lifecycle precedence is current head archived,
then recovery-suspended, then selected config not-yet-valid/expired/declared relative
to capturedAt. The selected old config does not change current metadata head/CAS.
Audit entries are {id,serviceId,revision,configRevision,kind:publish|archive,actorId,
createdAt}; latest detail has at most 16 with truncation and cumulative Scope loss.
The head is a shared-lock projection for that service with a selected immutable
configuration. Other services in the Scope can still change or evict audit rows;
the bounded audit window and Scope loss counter are not a frozen global snapshot.

Authentication and manager projection/commands use the existing independent
two-connection observation pool, never Runtime fallback. Current Scope authorization
is transactional with the projection/command, not with an earlier bearer-auth read.
Admission is two concurrent requests, two active operations, 128 tracked actor keys
and one-second per-actor cooldown; OBSERVATION_SERVICE_BUSY/429 is not network health.
No feature flag, worker, poller or startup action is needed for inert registry use.

## Recovery And Future Authority

Recovery sticky-suspends nonarchived heads and advances metadata CAS; immutable
revisions/digests are preserved. Explicit current manager republish is required to
clear isolation and must satisfy current validity/leaf checks. Archive and recovery
do not stop/reconfigure an independent operator responder.
Metadata revision exhaustion fails the entire original restore-quarantine
transaction through the Schema CHECK; maintenance isolation/manual review remains.
Recovery never saturates or skips CAS advancement, wraps counters or clears history.

Historical GET is never authority to select an old trust revision. A future actual
issuer/authority-watch must require exact CURRENT metadata revision and config
revision/digest, unarchived/unsuspended state, current manager/original Node Grant,
network policy/window and binding. New config can bar future old selections, but
in-flight withdrawal needs that future execution-owner integration. This slice
has no new permit or measurement, so it cannot claim immediate task revocation.

## Console

Dedicated manager-only panel provides manual bounded list, exact config read,
local prepare/digest confirmation, publish and archive. No connect/test/run,
automatic GET/polling, certificate generator, key importer or secret upload exists.
It validates closed DTOs, normalized config digest and raw public DER fingerprint;
it does not implement browser X.509/CA-chain or remote handshake validation.

Metadata CAS and selected config revision are visibly separate. Any input/read
selection/Scope change invalidates prepared confirmation. Disconnect clears all
details/drafts. An uncertain write keeps frozen original method/path/body/key in
module memory, locks other reads/writes and requires explicit same-command replay.
A rejected replay cannot prove the original commit absent; clearing local state is
not remote rollback. No storage persistence, endpoint hyperlink, arbitrary HTML or
server exception text is used to present a service declaration.

## Independent Responder Boundary

The separate `tunex-observation-responder` command requires explicit Scope/service,
canonical numeric listener, dedicated operator cert/key, exact serverName, incoming
source CIDRs and a UTC millisecond valid-until within seven days/certificate expiry.
TLS 1.3, exact SNI, ALPN tunex-observation/1 and disabled session tickets are enforced.
There is no mTLS/Scope-client authentication; CIDRs are only a source-IP filter.
It handshakes then closes, with no application I/O, echo, proxy/dial, UDP, Agent
identity or Runtime/Journal access. Explicit loopback is local-only, not remote proof.

Defaults are 16 active connections and 16 global handshake admissions/second,
each bounded 1..64, token burst min(rate,maxConnections). Incoming CIDRs are 1..32
distinct canonical comma-separated entries without whitespace. Handshake budget
is two seconds, whole connection three seconds anchored at accept; each direction
has a 32768-byte TLS wire cap, with no buffering beyond the TLS implementation.
Expiry/signal/fatal accept closes listener and tracked sockets and waits for workers;
no auto-renew, hot reload or implicit restart is offered.

The responder accepts one dedicated serverAuth-only leaf (DER <=8192 bytes), with
exact DNS/URI, no extra/unknown EKU or critical extensions; RSA is 2048..8192 bits,
EC P-256/P-384/P-521 or Ed25519. Cert/key are separate bounded regular final-path
nonsymlink operator files <=16KiB; Linux private key must be owned by the effective
UID, 0400 or 0600 and nonexecutable. Windows permission proof is unsupported and
fails closed. See deployment notes for separate UID10001 identity directory and
source-only image/Compose boundaries. No certificate/key generation was run.

No tests, static/type/syntax checks, scripts, formatters, fixtures, network/CI,
build/release, commits or pushes in this slice. All source remains unverified;
registry/responder are not completed D1 TLS/echo measurement, C3 or production proof.

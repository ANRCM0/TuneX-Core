# ADR-0044: Declared Observation Service Identity And Public Trust

Date: 2026-10-18 (Asia/Shanghai). Status: local source implementation, unverified.
See [contract](../spec/observation-services-v1.md) and
[operator deployment notes](../../deploy/README.md#independent-observation-responder).

## Scope

Add a manager-only Scope-owned registry for an explicitly declared controlled
observation service. It stores immutable endpoint/public TLS leaf-pin configuration
revisions and a separate metadata CAS head, bounded audit and sticky recovery
isolation. A declaration is not endpoint ownership, service presence, a valid
remote handshake, current health, a Probe permit or Runtime authority.

This slice also adds an independent operator-started finite TLS-only responder,
with a dedicated server identity rather than an Agent/Relay credential. Registry
commands never start, stop, deploy, dial, validate a remote endpoint or send a
measurement. No new measurement issuer, Agent TLS client, nonce echo, application
exchange, UDP or health aggregation is delivered. measurementAvailable is false.

## Declaration And Public Trust

Configuration is closed: version/purpose, exact numeric endpoint, public trust
mode/serverName/certificateDer and at-most-seven-day validity window. The sole
purpose is direct-ingress-tls-handshake; it names a future permitted measurement
type, not an implemented measurement. No private key, bearer token, signing secret,
arbitrary URL/headers, DNS target or certificate-generation path enters Control.

The dedicated non-CA leaf must have serverAuth ONLY, exactly one lowercase DNS SAN
and one scoped observation-service URI SAN, acceptable public-key strength, and
cover the configuration window. Public DER is bounded/canonical and manager-only
on read. Exact SHA-256 leaf pin is the trust mode; no public CA-chain validation,
network ownership or private-key possession is inferred from parsing a declaration.
This identity is deliberately incompatible with dual-purpose business Relay leaves.

## Lifecycle And Future Authority Boundary

At most 32 service identities per Scope, including archived IDs, and 64 immutable
configuration revisions per identity. Metadata revision advances for changed
publication/archive/recovery independently from configRevision. Same-config normal
publication is a no-op; explicit valid same-config republish after recovery clears
isolation and advances only metadata CAS. Changed config appends one immutable
revision. Archived IDs never rearm/reuse and remain readable as history.
Recovery revision exhaustion blocks the original quarantine transaction through
Schema CHECK, retaining maintenance isolation for review instead of saturating,
wrapping or bypassing CAS advancement.

Authorization, original-key idempotency, Scope locking, head/config/audit writes
and receipt share one transaction. Replay checks current manager rights and returns
the original receipt; unknown writes are not repaired by a new key or query.
Recovery isolates nonarchived heads without modifying immutable configurations;
explicit current manager republish must satisfy current time/certificate constraints.

An exact historical revision GET is only historical declaration, not selectable
execution authority. A FUTURE issuer/watch must require exact current head metadata
revision plus current configRevision/digest, nonarchived/nonsuspended state, current
manager/original Node Grant/network policy and valid window. New publication can
invalidate future old selections; actual in-flight withdrawal requires that future
owner integration, not a claim this metadata-only slice implements. Archive/recovery
does not remotely kill the independent responder, which has its own finite expiry.

## Observation Pool And Console

Registry API/Console use the existing independent two-connection observation pool,
current transactional Scope manager authorization, bounded requests/actor cooldown
and no Runtime fallback. GET does not prune, write, validate a remote certificate,
fetch secrets or issue work. Detail separates current metadata head from selected
immutable revision and exposes declaration lifecycle, not network status.

Console requires explicit manual list/read/local-prepare/confirm-publish/archive.
It checks closed DTOs, config digest and public DER fingerprint without pretending
to be an X.509 validator. It invalidates prepared state on input/read/Scope changes,
clears manager details on disconnect and preserves only the original in-memory
method/path/body/key for explicit replay after an uncertain commit.

## Independent TLS-Only Responder

The separate Linux process uses operator cert/key files and an explicit numeric
listen endpoint, Scope/service identity, SNI name, incoming source CIDRs and finite
expiry. It serves TLS 1.3 with exact SNI and tunex-observation/1 ALPN, then closes:
no application read/write, echo, proxy/dial, mTLS or Scope-client authorization.
Source CIDRs restrict network origins only. Bounded connection/rate/byte/time limits
and shutdown/expiry drain are independent of Control's metadata lifecycle.

An unbuilt scratch/UID10001 image recipe and explicit opt-in host-network Compose
example are source only, not released/signed/scanned or production-accepted images.
Operator credentials must never be copied into source/fixtures/Console or reused
from Agent/Relay. Windows key-permission proof is unsupported and fails closed.

## Evidence

No tests, static/type/syntax checks, scripts, generators, formatters, new fixtures,
CI, network, build/release, commits or pushes in this slice. Metadata authorization,
certificate compatibility, concurrency/idempotency, recovery, responder TLS/limits/
drain, UI and deployment need final-source concentrated acceptance. Registry and
responder do not satisfy D1 TLS/echo measurements, C3, physical or production gates.

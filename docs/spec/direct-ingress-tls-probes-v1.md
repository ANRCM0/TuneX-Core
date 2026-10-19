# Direct Ingress TLS Probes v1

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md).

## Measurement And Owners

The new measurement is explicitly `tcp-ingress-tls-v1`, taskKind
`tcp-ingress-tls`, point `agent-local-direct-ingress`, capability
`probe.tcp-ingress-tls.v1`. It starts in the Agent's network namespace, uses the
current numeric Direct TCP ingress listener and traverses the original Forward
to a manager-declared controlled TLS service. It never substitutes a direct dial
to that service or treats a same-host result as public ingress acceptance.

Direct is a transparent TCP forwarder, not a TLS terminator. The observed TLS
server is the downstream controlled service, not the Direct listener itself.
The original Forward/Runtime/Runner own listeners, tickets, assignments and
downstream execution. ProbePermits retains its single global budget of 256,
one-use consumption, two-second upper deadline, current instance checks and
withdrawal/result authority. ProbePlan only orchestrates this original owner.

## Exact Service Authority

TLS manager requests add exactly:

```json
{
  "service": {
    "serviceId": "controlled-observer",
    "revision": 1,
    "configRevision": 1,
    "configDigest": "sha256:<64 lowercase hexadecimal characters>"
  }
}
```

This is an exact current metadata CAS plus immutable config reference, not
`latest`, enrollment, ownership verification or new network authority. Service
IDs and public DER follow [Observation services v1](observation-services-v1.md).
Old `tcp-connect` and `tcp-ingress-connect` requests forbid the service field and
retain their original object shapes and hashes.

Current service head must be unarchived and not recovery-suspended, with matching
metadata revision, configRevision and digest. Configuration and certificate windows
must be valid. The original Forward's numeric target address/port must exactly
equal the registered endpoint and remain within original Node destination policy.
The current ingress listener is separately checked against the original listener
policy, numeric-resource facts and live execution instance. Membership, Node
grants, session/boot, credential, published assignment/revision/config/fence and
service authority are rechecked at every original execution-authority stage.

Service changes do not rebase old tasks. Metadata-changing publication, archive
and recovery invalidate old references without issuing replacement tasks. An
ordinary same-config publication remains a no-op; an explicit same-config
recovery re-declaration advances metadata CAS without inventing a config revision.
The registry cannot stop the independent responder process.

## TLS And Result Meaning

The bounded client uses TLS 1.3 only, selected exact SNI, fixed ALPN
`tunex-observation/1`, one exact pinned dedicated non-CA serverAuth leaf, scoped
service URI and certificate time bounds. It uses no Relay identity/private key,
client certificate, public-CA/OS chain, arbitrary DNS resolution, hostname fallback
or application payload. The shared pinned-trust implementation validates the
configured leaf and peer proof, rather than accepting an arbitrary certificate.

TLS handshake records are real original Forward payload. The original listener
may accept, dial downstream and increment byte/connection counters. Zero TLS
application bytes does not imply zero Forward bytes, zero packets, zero cost or
absence of service side effects. No HTTP/application response or nonce echo is
performed.

| TLS measurement status | Code | TLS evidence |
| --- | --- | --- |
| verified | tls-handshake-verified | Exact success object below |
| unverified | tls-handshake-failed | null |
| unreachable | tcp-connect-failed | null |

The success object is exactly `{version:"TLSv1.3",alpn:"tunex-observation/1",
leafFingerprint:"sha256:...",verified:true}`. A valid reported failure only
describes that actual bounded attempt. Admission refusal, cancellation, authority
loss, budget exhaustion, expired validity, lost report and uncertain commit do not
become fabricated `unverified` or `unreachable`; missing evidence stays unknown.
All reports remain `source:agent-reported`, `applicationHealth:unknown` and
`applicationPayloadBytes:0`, not current aggregate health or external reachability.

## Machine Family And Qualification

New routes use mTLS and probeVersion 3 under `/agent/v3/probe/services/`:
`instance`, `poll`, `claim`, `status`, `result`. The explicit ordered measurement
set is `[tcp-connect-v1,tcp-ingress-connect-v1,tcp-ingress-tls-v1]`.
No v1/v2 fallback follows failure. Older families never receive a TLS permit.

Qualification strengthens the existing original slot, not a second instance or
budget. Optional persisted servicesVersion 1 is absent on legacy rows and added
only by explicit current strong registration. Same qualified identity upgrade
does not extend qualifiedAt/expiresAt; v2 cannot erase the marker, and revoked or
quarantined identity cannot be rearmed. Original credential/instance expiry and
all original source authority still apply independently of qualification.

Only poll offer contains full `serviceContext` for TLS: selection plus public
config, at most 16384 UTF-8 bytes. contextDigest hashes all context fields except
itself; configDigest hashes config. Poll response is bounded to 32768 bytes;
other machine requests/acknowledgements/results remain 4096 bytes. Claim/status/
result carry only `{scopeId,serviceId,revision,configRevision,configDigest,
contextDigest}`. The two old measurements in v3 carry `service:null,tls:null` in
results; no DER is duplicated into result storage.

## Manager API And Console

Existing endpoints are retained under `/api/v1/scopes/:scope`:
- POST `/forwards/:id/probe-plan` preflights
  `{version:1,kind:"tcp-ingress-tls",expectedRevision,timeoutMs,service}`.
- POST `/forwards/:id/probes` accepts that fixed command with the original
  Idempotency-Key. Same-key replay does not issue or extend another permit.
- GET `/probes/:id` and POST `/probes/:id/revoke` retain original observation and
  withdrawal behavior, without following a newer service reference.

TLS acceptance body is the original six keys plus probeVersion 3, four explicit
descriptor keys and compact service selection. Ingress-connect keeps v2 plus
its descriptor; egress acceptance remains the original six-key shape. TLS inspect
adds descriptor and compact service, never DER. Actual result parsing switches
strictly on wire probeVersion 1/2/3, not permit category; v3 old-measurement
reports must not be relabeled as TLS.

Console selects kind explicitly and requires the four service-reference fields
read manually from current manager metadata. It freezes scope/method/resource/
body/kind/service/key after a possibly transmitted command. Invalid response or
timeout leaves that original write uncertain; only explicit identical replay is
allowed. Changing kind requires fresh consent, never an automatic new key.
Service registry `measurementAvailable` and execution capabilities are only
configured enablement, not Agent/workflow/network liveness or a command to run.

## Finite Plans And History

Finite-plan config adds service only for TLS, with exact current revisions/digest.
Preview includes full public context for review, but saved config, receipts and
decisions contain no DER. Every decision resolves the same exact reference again,
not latest. Existing 32 plans/Scope, 16 decisions/plan, one-hour lifetime, 30..3600
second intervals, config/head 4096 and decision 2048 byte bounds remain unchanged.
Plan expiry never extends the original two-second permit. Rejected decisions
still consume a slot; unknown SQL/commit outcomes do not create fake decisions.

Run history captures only compact service/context digest and whitelist TLS result
scalars at the original owner's mutation. It keeps the same 1024 rows/Scope,
seven-day logical window, 4096-byte record, 262144-byte response and loss counters.
Old records and digests acquire no new null keys; TLS records add measurement,
service and result.tls. ResultStatus filters add verified/unverified. GET does not
read current service as permission, issue work or recompute original wire evidence.
Old Probe telemetry/counters/rollups remain egress-only; ingress TLS is not silently
mixed into them. Forward payload counters can legitimately count handshake bytes.

The passive Forward diagnostic consumer recognizes the actual v1/v2/v3 result
families and explicit measurement/point instead of parsing a v3 egress result as
v1. TLS full context is bounded internal validation input only. Viewer details
contain compact selection and whitelisted proof, while same-read support removes
all service identities, trust digests and leaf fingerprint; only fixed TLS enums
and verified flag may survive. This remains no-network, no-current-authority and
incomplete ephemeral evidence, not a separate Probe owner or new retained history.

## Deployment, Schema And Recovery

Control `TUNEX_PROBE_SERVICES` defaults to 0 and requires original execution,
ingress enablement and explicit one-second clock policy. Agent `--probe-services`
defaults false and requires ingress, registration and execution opt-in. Real host
clock synchronization is an independent operator responsibility, not proved by
flags. Scheduler remains a separate default-off finite orchestration option.

Schema 0036 / Control profile `adp3-probe-services-v1` adds original permit TLS
context, compact history selection/evidence, measurement enum values and optional
qualification marker. The original 4096-byte result bound and Agent's existing
two compatibility profiles are unchanged. The migration explicitly replaces the
original classification CHECK `probe_runs_chk_18` with a named typed constraint;
unexpected deployed CHECK names fail closed for manual review, not dynamic removal.
Old migrations are not edited. Closing flags does not undo applied DDL.

Original recovery quarantines permits/qualification and suspends active plans and
service heads. It retains qualification marker, configuration/history/audit,
withdrawal and budget facts, and protected Journal/Authority high-water; no refund,
new task, automatic resume or historical catch-up. Revision exhaustion fails the
whole restore-quarantine transaction and requires review.

## Acceptance Still Open

This is source-only implementation. No tests, type/static/syntax checks, scripts,
formatting, fixtures/generators, network/MySQL/browser/container run, build, CI or
Git mutation is performed in this slice. A subagent used one read-only `git status`
while recovering context; it did not change repository state. Trust/handshake/cancellation/time and
wire budgets, concurrent revocation, exact MySQL 8.4 CHECK names and partial DDL,
upgrade/recovery, old-version compatibility and desktop/mobile flows await the
concentrated acceptance phase. Neighbor/external observation, nonce echo, UDP,
Relay/multihop Probe, health aggregation, C3 switching and physical/production
gates are not completed by this feature.

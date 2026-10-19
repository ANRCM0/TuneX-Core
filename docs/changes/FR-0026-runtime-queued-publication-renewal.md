# FR-0026: Queued Runtime Publication Respects Renewal Lead

Date: 2026-10-20 (Asia/Shanghai).
Status: implemented-unverified; proposal recorded before implementation.
Owner and authorization: RuntimeHost publication owner. The human's 2026-10-19
standing foundation source authorization covers this semantic repair. The active
explicit B verification/commit/push authorization supplies its separate test gate.
No acceptance, PR merge, product parallelism or release is authorized here.

## Task Proposal

1. Layer: L1 RuntimeHost orchestration. L0 publication predicates remain unchanged.
2. Consumed public interfaces: existing RuntimeHostOptions, RuntimeStateStore,
   RuntimeLedgerPort, protected authority recorder and kernel publication functions.
3. Foundation impact: earlier publication while an operation awaits claim; no
   public signature, database, wire or Journal layout changes.
4. Contract behavior: holding a same-session, preserved-multihop snapshot must
   stop at the configured renewal lead, as ordinary snapshot reuse already does.
   The original five-second minimum hold cutoff remains a further restriction.
5. Acceptance: authored exact equality/one-millisecond-before/after boundaries,
   continuous queued work, nonpreserved changes, same transaction and publication
   failure ordering; exact-source Actions must include Agent and 8-node browser
   integration. Local verification is static only. No functional result yet.
6. Parallel impact: only RuntimeHost, its publication tests and this record change;
   Agent, Identity, Notification and other owner test work remains independent.

## Why Current Extensions Are Insufficient

Candidate 0c51cc0, Actions 39293728114, tested checkout
24740a29b2b35b0bdbc0cae23e9942496a2cbee4 failed the 8-node browser batch.
Sanitized evidence records ingress snapshot47 issued at 17:38:44.783Z with
validUntil17:39:29.783Z. The Agent safely exited at17:39:24.807Z after subtracting
the existing five-second skew; Control snapshot48 was issued at17:39:29.789Z.
Other Agents continued reporting and the pending operation retained cleanup.

RuntimeHost's queued-publication hold precedes ordinary reuse and ignores its
renewal lead. Repeated pending work can therefore hold until the Agent cutoff.
Existing injected stores/clocks cannot correct that orchestration decision.
Constrain the hold using the same configured lead before returning the old value.
No domain Core or kernel extension is needed and authority checks stay mandatory.

## Impact And Compatibility

Queued operations may now cause a new snapshot earlier, at the normal renewal
lead, instead of waiting for the five-second cutoff. Existing compiled assignment
selection, related-Node locks, original supplied transaction, counter checks,
retirement/tombstone, publishability, worker claim checks, protected authority,
snapshot persistence and lease recording remain in their original order.
Never extend any old lease in place, bypass authorization, admit a different
session or reset authenticated Agent state. Credential and Relay bounds still
cap every new publication. Errors retain their existing stage and identity.

## Migration And Version Plan

No signature/version/schema migration is required. Current native and injected
RuntimeHost consumers receive the same source repair. L0 holdPublishedSnapshot
keeps its original five-second predicate; RuntimeHost applies an additional
existing-policy constraint. A source rollback retains all published generations,
leases, fences, authority and protected history; it does not restore liveness.

## Acceptance And Known Limits

Tests are authored for the same frozen candidate and Actions environment. They
must show queued hold outside the lead, fresh generation at equality and inside,
normal deadline caps, mandatory authority/save/lease order and failure rollback.
The original Agent guard must continue refusing expiry with no grace extension.
The observed production timeout is not considered resolved until exact-source
3/4/8-node and other configured jobs pass. Independent physical-host, long-run,
Responder publication and release gates remain separate.

## Source Authorization And Acceptance Gate

Choose this bounded host repair under standing source authorization and proceed
without another confirmation. This record explicitly discloses the earlier
publication behavior on the frozen foundation. B acceptance remains unfinished
while any mapped assertions or applicable execution evidence are missing.

# FR-0042: Shared Probe Budget Observation

Date: 2026-10-24.
Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.
Owner and authorization: original ProbePermits and its original lower storage.
The human's 2026-10-19 standing source authorization and 2026-10-24 P Actions
failure-repair request authorize this serial correction. Merge, publication,
release and delegation remain outside this task.

## Task Proposal

1. Layers: L1 observation storage contract, L2 native SQL, L3 original Probe
   owner. L0, Agent authority and Journal are unchanged.
2. Public interfaces: ProbePermitStorage1, ProbePermitStore, original permit
   budget/withdrawal validation and current plan/Node/instance readers.
3. Foundation impact: additive separately versioned read-only storage extension;
   existing mutation provider and its exclusive lock order are unchanged.
4. New contract: ProbePermitObservationStorage1.observe(tx) returns the same
   bounded, current budget snapshot under a shared lock in the caller's original
   transaction. Ordinary owner writers retain their exclusive budget lock first;
   startup recovery retains its original SQL and admission isolation.
   offer/check may use the optional reader; legacy providers retain lock(tx).
5. Planned acceptance: exact SQL/decoders, no writes, malformed snapshot refusal,
   legacy fallback, reader failure identity, unchanged writer admission, actual
   independent MySQL readers/writer blocking, and exact-source Actions signed
   Direct/Relay/multihop evidence. Nothing is accepted from source alone.
6. Parallel impact: integrate contract, lower adapter, native compatibility
   binding and original owner serially. No other module or parallel gate opens.

## Why Current Extensions Are Insufficient

Three-node Actions shows server poll/status delays above the existing 200ms
exchange while original Agent refusal remains safe. Even empty discoveries use
SELECT FOR UPDATE on the one global budget and all retained permit/withdrawal
rows. Independent non-executing observers serialize behind one another and a
slow authorization read. Forward-scoped Relay reads reduce repeated work but
do not remove this unnecessary exclusive-read queue.

Discovery reserves nothing and status is a current observation, not a lease.
A shared budget lock still excludes every original issuer/consumer/revoker/
result/recovery writer until the read transaction ends, while allowing other
observers to read the same protected snapshot. All permit/body/clock/current
authority checks remain with the original owner. No lock-free or stale cache
is introduced and no deadline is extended.

## Impact And Compatibility

Add an optional final observation-provider constructor argument to ProbePermits,
separate from its unchanged L3 store contract. Native composition passes the
same lower store explicitly; legacy constructors do not inspect a new method
on an older provider. Old providers keep their original exclusive lock call
and error/clock order. The native lower storage
implements the new separate L1 interface and the old interface. Its shared
reader uses the same three bounded SQL projections, decode functions and
corruption checks, with FOR SHARE instead of FOR UPDATE.

Only offer and check select the optional read path. Every state mutation,
including issuance, consumption, revocation, withdrawal, budget-clock update,
result capture and recovery, retains the original exclusive owner path. A
reader error propagates; it never causes silent lock fallback. Current Scope,
Node, instance, qualification, binding, budget and deadline checks still execute
in the supplied transaction. No wire, schema, protected state or public HTTP
shape changes.

## Migration And Version Plan

Export PROBE_PERMIT_OBSERVATION_INTERFACE_VERSION=1 and its generic read
contract from framework/public.ts; retain ProbePermitStorage1. Native Control
composition passes the same original lower store as both constructor ports;
MySqlProbePermits explicitly delegates observe to its one lower store. Legacy wrappers
and callers remain usable. There is no database migration or history reset.

The lower and legacy observation methods detect existing `lock` overrides and
delegate to that original override. An older subclass therefore does not
silently bypass its custom locking implementation through an inherited reader.
Explicit observers may implement their new contract; legacy fallback remains
exclusive. SQL projections, byte/row bounds and supplied decode callbacks remain
shared private implementation, with only the closed lock mode differing.

Public composition uses the same original store:

```ts
import type { ProbePermitObservationStorage } from './apps/control/src/framework/public.ts';
import type { ProbePermitRecord } from './apps/control/src/modules/probe-owner/public.ts';
import type { Transaction } from './apps/control/src/infrastructure/mysql.ts';
import { MySqlProbePermits } from './apps/control/src/infrastructure/mysql-probe-permits.ts';

const reader:ProbePermitObservationStorage<Transaction,ProbePermitRecord>=new MySqlProbePermits();
await reader.observe(tx);
```

The store/owner and real MySQL
cases exercise that public binding, two simultaneous readers, both required
reader releases before writer admission, reader failure identity and unchanged
mutation selection. The real SQL case is authored for Actions, not executed
locally.

## Acceptance And Known Limits

Author source/contract/SQL/concurrency cases, then execute authorized functional
and MySQL evidence in Actions. Shared readers must coexist; an original writer
must wait until all shared budget locks release. Current unrelated physical-host,
capacity and long-run acceptance remains unverified. The new read is not an
execution permit, continued authorization or a production latency guarantee.

## Source Authorization And Acceptance Gate

Decision: implement the explicit original-owner observation extension under
standing source authorization and the current failure-repair task. Preserve
exclusive mutation ownership, monotonic clock checks and original hard limits.

## Verification Update - 2026-10-24

The current [P verification record](../development/product-verification-p-2026-10-24.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.

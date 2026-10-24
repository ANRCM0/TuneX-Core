# FR-0041: Bounded Relay Forward Assignment Read

Date: 2026-10-24.
Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.
Owner and authorization: original RuntimeRelayHost. The human's 2026-10-19
standing foundation source authorization and 2026-10-24 P Actions/failure-repair
instruction cover this serial corrective extension. No separate confirmation
is required; merge, publication, release and delegation remain closed.

Corrective amendment recorded before implementation: the successor's numeric
Actions trace shows 458-651ms server poll calls against the unchanged 200ms
exchange. The new Forward reader will reuse one current multihop input inside
its single owner call for resource compilation and immutable-plan checks.
Original Node/grant/credential/Profile/endpoint SQL readers hold their original
locks in the same supplied transaction. No input survives this call or its
transaction. The legacy node reader keeps its original two-read flow and error
ordering; no frozen legacy contract is silently optimized. This amendment is
covered by the same standing source/current failure-repair authorization.

## Task Proposal

1. Layers: L1 original Relay host/read contract; L3 Probe planner and native
   composition. No L0 change.
2. Consumed interfaces: RuntimeRelay7, RelayAssignmentReader and Probe path
   assignment port, original ledger/session, Node, Profile and endpoint ports.
3. Foundation impact: additive separately versioned public read extension;
   existing node assignment semantics and constructor arguments are retained.
4. Contract: RelayForwardAssignmentReader1 reads current publishable assignments
   for one Forward in the caller transaction. Authorization occurs once for the
   complete original plan, with original per-node session/phase checks. It
   neither publishes snapshots nor grants execution or caches authority.
5. Planned acceptance: compare new/old projections, once-only plan validation,
   per-node unsafe-session filtering, withdrawn/corrupt/stale plans, failures and
   exact transaction identity; real native MySQL/Agent signed path in Actions.
   Source authoring or local compilation is not a pass.
6. Parallel impact: integrate the public type, original host, Probe adapter and
   composition serially. No new worktree or parallel feature is opened.

## Why Current Extensions Are Insufficient

Actions found the three-node Echo remaining issued despite server-side nonempty
polls. The old per-node assignment API scans every deployment for that node and
revalidates each entire path. Calling it once for every node repeats all-path
authority work and unrelated Forward reads within the original 200ms exchange.
The two-node scenario succeeds; numeric artifacts show three-node permits with
only 1569-1736ms lifetime before discovery. Deadline checks must remain intact.

A cross-call or cross-transaction cache would retain time-sensitive authority.
The new explicit owner read instead evaluates the one original Forward once
per call. Private projection extraction keeps phase and session rules shared
with the legacy entrypoint rather than copying them into Probe.

## Impact And Compatibility

Existing RelayAssignmentReader, RuntimeRelay7 and assignments(tx,node,accepted)
remain available with their old order and effects. The additive method returns
detached per-node assignment arrays, or an empty result when no current
publishable plan exists. Original corruption and provider failures propagate.
The Probe port optionally consumes this extension; its legacy node provider
remains supported and receives the same original per-node reads.

No wire, SQL schema, public HTTP, Journal, protected history, deadlines,
capabilities, budgets or cancellation behavior changes. All current grant,
Profile, endpoint, immutable plan, Operation and per-node session checks remain
with their original owners. Caller transactions are never replaced.

## Migration And Version Plan

Export RELAY_FORWARD_ASSIGNMENTS_INTERFACE_VERSION=1 and
RelayForwardAssignmentReader through framework/public.ts. RuntimeRelayHost
implements it alongside the existing reader; no old interface counter changes.
Native Probe composition supplies the explicit new callback. Existing legacy
callers and old-path providers continue compiling; no data downgrade is needed.

## Acceptance And Known Limits

Author contract cases and a public example, then run the authorized checks and
functional/MySQL/network/browser/container acceptance in Actions on the exact
new source. Older passes do not accept this extension. Physical-host, load,
24/72-hour and release gates remain independent and unavailable as recorded.

Public composition example (the existing caller owns `tx`):

```ts
import type { RelayForwardAssignmentReader } from './apps/control/src/framework/public.ts';
import type { NativeRuntimeFamily } from './apps/control/src/compatibility/public.ts';
import type { Transaction } from './apps/control/src/infrastructure/mysql.ts';

const reader:RelayForwardAssignmentReader<Transaction,NativeRuntimeFamily>=relay;
const nodes=await reader.assignmentsForForward(tx,forward.id);
```

The public owner contract cases compile and exercise this same binding against
RuntimeRelayHost, including unchanged legacy node projections. The Probe provider
adds optional `forForward(tx,id)` beside its required legacy `assignments(tx,node)`;
native composition supplies both explicitly. Incomplete/duplicate/foreign node
groups and mismatched published assignments are refused rather than falling back.

## Source Authorization And Acceptance Gate

Decision: implement the additive original-owner read under the above standing
source and current failure-repair authorization. Do not extend production
deadlines or move path authorization into a second owner to obtain a pass.

## Verification Update - 2026-10-24

The current [P verification record](../development/product-verification-p-2026-10-24.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.

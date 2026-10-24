# FR-0044: Original Relay Progress With One Locked Input

Date: 2026-10-24.
Status: accepted within recorded P Actions case scope at `69dcaa7`; independent-host/load/long-run and latency/reliability claims remain unverified. Proposal recorded before implementation.
Owner: original RuntimeRelayHost. The 2026-10-19 standing foundation source
authorization and the current P Actions/failure-repair task authorize this serial
source proposal and its bounded verification. Merge, image publication, release
and parallel features remain separate.

## Task Proposal

1. Layers: L1 Relay progress contract/original owner; original native Runtime
   constructor and server composition. No L0 change.
2. Consume RuntimeHost4, RuntimeRelay7, RuntimeRelay lifecycle port, original
   locked Node/Profile/Endpoint providers and ledger/observation ports.
3. Foundation impact: separate additive version-1 progress extension. RuntimeHost
   options, old Relay interfaces and original entrypoint behavior remain.
4. Add RELAY_PROGRESS_INTERFACE_VERSION=1 and RelayProgressCoordinator.progressForNode.
   For each multihop deployment, reuse one complete locked input through the
   original progress authorization/refresh/immutable-plan checks. Read current
   time again for credentials, peer expiry and plan/deadline checks. Never retain
   inputs across deployments, calls or transactions. Two-node Relay retains its
   original flow. Old advance/advanceForNode and canExecute overrides retain
   their original receiver/dispatch. Unknown provider failures propagate.
5. Planned acceptance: legacy/new state/write parity; four-versus-one Node-fact
   passes and three-versus-one complete inputs on an unchanged active plan;
   next-call fresh facts; changed
   permissions, pins, endpoint and sessions; time expiry during a call; original
   provider errors and compatibility overrides; public type/example; native
   Runtime atomicity, lifecycle and signed workflows on an exact saved source.
   Local checks are static/type/boundary only. No functional pass exists yet.
6. Serial integration in the existing server. No new composition root, owner,
   scheduler, table, Runtime ledger or Agent authority/Journal is introduced.

## Why Current Extensions Are Insufficient

3983abb baseline 40067813546, job 120794730676, artifact 12549564916 directly
observes Probe shared locks on runtime_nodes PRIMARY waiting for original
Runtime tick/report/snapshot exclusive locks. Those Runtime transactions also
queue behind each other. Connection labels are emitted only when the same
borrow exists before/after the metadata read. Earlier durations alone could not
identify the blocking owner; this evidence does. It is not a physical-host or
production latency proof.

Source inspection finds that unchanged active multihop advance loads a complete
input in canExecute, reads Node facts again for refresh, and loads another two
inputs in authorized. All happen while the original Runtime transaction holds
the related Runtime Node locks. FR-0041/43 improve assignment readers but do not
change this original progress walk. A module cannot combine private progress
stages without duplicating the owner. Do not weaken Probe/Runtime locks, split
atomic transactions, cache authority across calls or extend deadlines.

## Impact And Compatibility

Old advance and advanceForNode retain their provider/error order. New progress
captures/delegates an existing advanceForNode override; each deployment retains
an advance override. An overridden canExecute follows the legacy walk. The new
native entry deliberately changes complete input frequency from three to one
and Node-fact passes from four to one; this is a separately selected contract,
not silent legacy equivalence.

The new caller must hold the original sorted related-Node locks in its original
transaction, and providers must retain their locked facts until it ends. The
existing RuntimeHost already does so. Reuse never treats an expired credential
or peer as current: time/peer filtering is re-evaluated before later uses. All
original plan/session/pin/resource/operation/cleanup/renewal logic remains with
its owner. A branch which changes the deployment discards this input and returns
through the original accept/refresh flow.

RuntimeController's optional Relay argument is widened from the native concrete
Coordinator type to the existing public RuntimeRelay port, keeping its argument
positions, runtime constructor and all valid previous calls. This is an explicit
source-type widening; exact constructor type witnesses/consumers must account
for it. Server passes a five-method public lifecycle adapter: four methods
delegate unchanged to the same host; advanceForNode explicitly selects the new
progress method. The compatibility constructor continues to select the old
method when passed the old Coordinator directly. RuntimeHost4 is unchanged.

No wire/version, database migration, Journal, authority, protected history,
capacity, heartbeat, permit, exchange, retry or deadline change is introduced.

## Migration And Version Plan

Export the separate port/version from framework/public.ts. Integrate original
owner and contract cases, then the existing constructor's public port type,
then explicit native server binding. Other callers remain on old progress.

Minimal public use after acquiring the original locks:

```ts
import type { RelayProgressCoordinator } from './apps/control/src/framework/public.ts';
import type { Transaction } from './apps/control/src/infrastructure/mysql.ts';
const progress:RelayProgressCoordinator<Transaction>=relay;
await progress.progressForNode(tx,nodeId);
```

## Acceptance And Known Limits

Contract cases and the unchanged original native rollback/withdrawal/capacity
tests must pass on the successor. Verify the actual lock metadata, signed
TCP/UDP results and recent-path Station/outbox case, not only contract counters.
Do not claim reduced latency or first-command reliability from fewer reads.
Preserve failed attempts and original hard deadlines. Physical deployment,
reviewed load and 24/72-hour campaigns remain separately unverified.

## Source Authorization And Acceptance Gate

Decision: select the additive original-owner progress port under the standing
authorization, preserve old behavior, and serially select it in the original
native Runtime composition. This proposal is recorded before implementing the
public entrypoint/type widening. Exact-source acceptance remains pending.

## Verification Update - 2026-10-24

The preceding planned/pending wording retains the source proposal snapshot.
The implemented successor is now verified at
`69dcaa710ee0298adde0656674b99c5cb6e1f2b8`, tree
`62cd28b39e8e7e37cce2745c4781827186cac403`; actual PR test merge
`62b0b98022dd804c8e1b6fafbc3cec0111b4d405` has that identical tree.
Baseline `40069707791` has all ten jobs successful; packaging `40069707745`
also passes. New progress parity/count/freshness/expiry/error/override and native
public binding cases pass, as do unchanged Snapshot/Runtime rollback and actual
signed workflows including the new recent-path Station/outbox SQL case.

The original-owner input reuse is accepted only in that recorded case scope.
Three-node UDP needs a fourth independent command in this sample; 236ms status
and 222ms result calls remain observed. Fewer input reads do not prove latency,
first-command reliability, physical deployment, reviewed load or 24/72-hour
acceptance. Old ports/overrides remain, RuntimeHost4 is unchanged, and the explicit
constructor source-type widening above remains part of the migration contract.
See the [P verification record](../testing/verification-status.md)
for exact jobs/artifacts, failed predecessors and remaining gates. No merge,
publication, release or parallel feature gate is opened.

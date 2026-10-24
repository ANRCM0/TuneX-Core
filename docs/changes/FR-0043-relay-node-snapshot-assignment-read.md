# FR-0043: Single-Input Relay Node Snapshot Read

Date: 2026-10-24.
Status: accepted within the recorded P Actions case scope on 245d438. The proposal was
recorded before implementation.
Owner and authorization: original RuntimeRelayHost. The human's 2026-10-19
standing foundation source authorization and current P Actions/failure-repair
task authorize this serial correction. Merge, publication, release and
delegation remain separate gates.

## Task Proposal

1. Layers: L1 original Relay owner and read contract; L3 native Snapshot source
   composition. L0 and Agent authority/Journal are unchanged.
2. Consume RuntimeRelay7, RelayAssignmentReader, the original ledger, Node,
   Profile/Endpoint providers and FR-0041's single-call locked input reuse.
3. Foundation impact: additive separately versioned read extension. Preserve
   the existing constructor and legacy assignments entrypoint semantics.
4. Add RelayNodeAssignmentReader1.assignmentsForNode(tx,node,includeAccepted?)
   and RELAY_NODE_ASSIGNMENTS_INTERFACE_VERSION=1. Read original forNode records,
   validate each complete original plan once per call, and project only the
   requested Node through the same original stage/session helper. Default
   includeAccepted=false; an explicit true retains original accepted-stage
   projection. Reject invalid Node IDs or non-boolean inclusion flags before
   provider access. Multihop reuses one locked input; two-node Relay retains its
   original validation sequence. An existing canExecute override retains the
   original provider/authorization path. Do not cache authority, rows or inputs
   across calls.
5. Planned acceptance: new/legacy projection parity for every retained stage
   and inclusion flag; one versus two multihop input reads; caller transaction,
   invalid inputs, missing/unsafe sessions, refusal/corruption/provider errors,
   composition binding and exact-source native Actions lifecycle/signed Echo.
   Local verification is static/type/boundary only; none is a functional pass.
6. Integrate contract, original owner, native binding, explicit consumer tests
   and inventory serially. No parallel feature or separate owner is introduced.

## Why Current Extensions Are Insufficient

The fe531cb Actions diagnostic records an empty poll taking 679ms, with zero
connection-acquisition wait and 676ms in the original machine evidence shared
JOIN query over Runtime/Node/credential rows. Other shared reads take 559ms and
426ms. This identifies a locked machine-evidence read rather than pool queueing
for those samples; it does not identify which individual joined row is blocked.

Source inspection shows that original Runtime Snapshot collection calls the
legacy node assignment reader while the original Runtime transaction retains
its locks. That reader validates each multihop plan through canExecute's
multihopInput and then reads the same input again for immutable plan checks.
FR-0041 removes this repetition for a Forward-scoped Probe read, but the native
Runtime Snapshot source still consumes the legacy node reader. Reducing this
known repeated work is an owner-preserving correction; a measured latency
improvement must still be established on the successor.

A module adapter cannot access the Relay owner's private deployment/plan walk.
Changing the legacy reader in place would silently change frozen provider
call/error order. A new explicit reader uses the original owner, private
projection and existing single-input validation without another compiler,
ledger, Snapshot publisher or authority cache.

## Impact And Compatibility

Legacy assignments(tx,node,includeAccepted=false), RelayAssignmentReader,
RuntimeRelay7 and constructors retain their signatures, projections and original
two-input provider/error order. The new contract requires original providers to
retain their locked facts in the supplied transaction. All original operation,
Forward revision, resource, grant, Profile/Endpoint, credential/pin, session,
deployment stage and time checks remain with their original owners.

Compatibility amendment recorded before its implementation: compare the current
canExecute method with the original host method before selecting input reuse.
An inherited/instance override follows the original canExecute dispatch and
two-input validation instead. Native RelayCoordinator only assembles providers
and does not override that method. This guard is not a fallback after an error;
unknown getter/provider errors still propagate and custom authorization is not
bypassed. The existing Forward-scoped reader is unchanged by this amendment.

A second compatibility amendment is recorded before implementation after the
first successor's native atomicity step failed: existing Snapshot consumers
override the old assignments method to inject original read failures and
resource conflicts. The new reader must capture that current method once and,
when it differs from the original host method, delegate to it with the original
receiver/arguments/result/error before any optimized provider access. Retain
the existing native rollback/conflict cases unchanged and add explicit override
and getter/error cases. This is a compatibility dispatch before reads, never
a fallback after failed optimized I/O. The ordinary native host has no override.

Only the existing native Snapshot source callback selects assignmentsForNode.
SnapshotAssignmentContext, RelayAssignmentSource, registry driver declarations,
wire formats and Runtime ledger remain unchanged. Explicitly migrate the native
composition fake's method expectation; its original receiver, deferred lookup,
argument/transaction identity and error assertions remain required.

Unknown/corrupt plans and unknown provider failures propagate; recognized
authority refusal keeps the original empty projection. No silent fallback to
legacy reads follows a failed new read. No SQL/schema, heartbeat, capacity,
deadline, execution gate, history, Journal or recovery change is introduced.

## Migration And Version Plan

Export the separate version-1 port from framework/public.ts. RuntimeRelayHost
implements both the old reader and new port. Native Control explicitly adapts
the new method to its existing RelayAssignmentSource callback. Other legacy
callers remain on their original entrypoint. There is no automatic capability
lookup, cross-transaction memoization or removal of the old method.

Minimal public use (the caller owns tx):

```ts
import type { RelayNodeAssignmentReader } from './apps/control/src/framework/public.ts';
import type { NativeRuntimeFamily } from './apps/control/src/compatibility/public.ts';
import type { Transaction } from './apps/control/src/infrastructure/mysql.ts';

const reader:RelayNodeAssignmentReader<Transaction,NativeRuntimeFamily>=relay;
const assignments=await reader.assignmentsForNode(tx,nodeId);
```

## Acceptance And Known Limits

Source `245d438ace32e1a58c39f00c9dca0a5d1d8cc7d4`, tree
`750d32fdd962e7fa7bda4abbb468cf7509f8bf43`, passed baseline `40062014210`
(all ten jobs) and packaging `40062014243`. Actual PR test merge
`2a66270b73595d135d0a86fb0b20e1128b3c43b4` has the identical tree. Public
type/binding/projection/input-count/override/error cases and the original native
Snapshot rollback/conflict cases pass. See the full exact-source job/artifact
index in [P verification](../development/product-verification-p-2026-10-24.md).

Keep fe531cb and failed 17a9c2a samples separate. Current signed three-node
TCP requires three independent commands; UDP first refuses an unavailable
permit, then its next command succeeds. The slowest empty poll still records
746ms in the original shared machine-evidence JOIN, with zero connection
acquisition wait. Input reuse is verified; a latency or first-command reliability
improvement is not established. The change targets duplicate work during the
original locked Snapshot collection; it is not proof that all lock contention
disappears or that the original 200ms exchange always succeeds.
Physical-host, deployment/load/24-72-hour and release gates remain independent.

## Source Authorization And Acceptance Gate

Decision: implement the separately versioned original-owner Node reader under
the standing source authorization and current bounded failure-repair task.
The native composition intentionally selects its single-input semantics;
legacy public behavior remains available. Applicable successor Actions jobs and
contract cases passed on the source/tree above; the stated operational limits
remain open. This does not authorize merge, publication or release.

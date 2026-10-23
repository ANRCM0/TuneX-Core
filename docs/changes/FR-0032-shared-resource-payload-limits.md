# FR-0032: Shared Resource Payload Limits

Date: 2026-10-21.
Status: authorized-under-standing-source-scope; source integrated, unverified.
Owner and authorization: original Node/Runtime, Runner, execution host and protected
Journal owners. The human confirmed both pending quota questions on 2026-10-21:
aggregate per user and administrator-provided machine, bidirectional payload,
administrator-defined start/end period (including monthly periods), private
machines exempt, and stop affected forwarding when exhausted. The N-stage named
source tasks and 2026-10-19 foundation source authorization cover this proposal.

## Task Proposal

1. Layers: L1 injected publication/payload/persistence ports; L2 native ADP/3,
   original MySQL and authenticated Journal adapters; L3 shared resource policy.
2. Public interfaces: RuntimeHost3/RuntimeCodec, executionhost1, executionstate3,
   Node authority5, original identity, transaction and driver entrypoints.
3. Foundation impact: additive closed Snapshot extension, required production
   publication policy and persisted Journal history; original Core API unchanged.
4. Contracts: `shared-resource-limits.v1`; immutable per-user/node/period bucket,
   revisioned bandwidth/byte limit, shared payload gate and durable precharge.
5. Acceptance: author contract/concurrency/crash/SQL/wire/lifecycle cases only;
   execution requires later authorization and exact-source GitHub Actions.
6. Parallel impact: original named isolated agents own engine integration,
   Agent Journal/Runner integration and L3 policy respectively. Root serially owns
   public schemas/types, Runtime, migration catalog, HTTP/composition and documents.

## Why Current Extensions Are Insufficient

Ingress telemetry counts neither every shared transit/egress nor durable hard
consumption. Node-wide connection budgets and physical port slots do not express
per-user payload. Inject into existing execution and persistence owners; do not
create another Runtime allocator, authority issuer or disposable billing file.

## Chosen Semantics And Compatibility

One bucket is bound immutably to scopeId, actorId, nodeId, startsAt and endsAt.
The administrator explicitly chooses the period; periods for that user/node may
not overlap. Changes use revision CAS and original transaction/identity/replay.
The product actor is the immutable Forward owner, never authorization_actor.
Private Nodes omit buckets. Shared grants without configured limits retain their
unlimited behavior. A configured limit requires the explicit Agent capability;
unsupported native/offline execution must refuse rather than omit enforcement.

`resourceLimits` is an optional closed ADP/3 Snapshot object with version 1 and
sorted buckets. Each contains bucketId, scopeId, actorId, nodeId, revision,
startsAt, endsAt, bytesPerSecond (nonnegative safe integer or null), burstBytes
(1..65536), byteLimit (nonnegative safe integer or null), and sorted distinct
assignmentIds. At least one limit must be non-null. Every reference must belong
to this Node/Snapshot, one assignment has at most one bucket, unknown fields
refuse, and the existing Snapshot digest covers this entire extension. New period
timestamps use canonical four-digit-year ISO UTC millisecond representation;
native integer-millisecond projection must roundtrip exactly. Existing Snapshot
timestamps retain their original precision contract.

Payload is charged once per direction per traversal of that shared machine.
TCP direct, ingress, transit and egress charge application bytes before writing;
Relay framing/TLS/handshakes/Probe control are excluded. UDP payloads are atomic:
insufficient credit drops/refuses the whole datagram. All assignments and both
directions for one bucket share its rate and byte balance, including draining
instances. A path through multiple shared Nodes consumes each Node separately.
The token bucket has the administrator's explicit bounded burst; zero rate denies
traffic. Cancellation, original authorization and period deadline remain enforced
while waiting. No rate/limit may expand original grants or authority.

Before handing permitted payload to the socket, persist its debit in the same
MAC-protected Runtime Journal under its original instance/file locks. Failed or
partial writes and crashes may conservatively consume unsent bytes; never refund
an ambiguous debit. Consumed counts only increase for a bucket; new Snapshot,
boot, deployment, protocol, phase, rate revision or process restart cannot reset
them. At exhausted balance/period end the gate denies payload and Runner stops
affected instances while retaining fences, retirement and debit history. Storage
failure fails closed. Local token state starts empty after restart, preventing a
new burst from being minted by restarting. Wall-clock authority uses existing
Runner proof/lease owners; rate waiting uses monotonic elapsed time.

The first implementation retains old bucket history and refuses new identities
at a declared capacity instead of evicting protected entries. Quota use is
conservative payload reservation, separately labelled from operational telemetry;
it is not exact delivered-byte billing. Administrative cycle changes do not clear
old consumption. Rollback to binaries without the extended durable format refuses
unknown fields. Never reset Journal to make rollback work.

## Migration And Version Plan

Add immutable migration 0041 for shared-resource policy, command receipts and
audit records through its own owner; old rows remain unlimited. Add one reviewed
Control upgrade profile and keep historical ceilings unchanged. Agent persisted
format and inspection profile must cover the added history before acceptance.
Wire schemas and manually synchronized native source mirrors are authored without
running generators during this source phase. Runtime publication must compare
policy changes before reuse/hold and sign/hash the resulting extension; original
authority recording still precedes Snapshot publication.

The legacy engine constructors remain explicit unmetered entrypoints for inputs
without this extension. Production limited assignments receive a gate before any
socket starts. Native replacement/renewal must preserve or deliberately replace
the immutable gate binding; neither fallback nor unsupported drivers may bypass
the limit. Original exact stop, removal, CAS, unknown command outcome and cleanup
stay owned by existing modules.

## Acceptance And Known Limits

Planned: private exemption and ungranted denial; same-user multi-rule/direction/
TCP+UDP aggregation; shared transit/egress; period overlap and endpoints; zero,
partial TCP, atomic UDP, narrow/increase CAS and replay; unsupported capability;
renewal/hold policy changes; rate cancellation and fairness; save-before-write,
failed save, crash after save, restart empty rate tokens, repeated Snapshot and
original Journal history/locks; immutable Forward ownership; actual MySQL and
original rollback; HTTP personal/governance isolation and usable public example.
No case has run. Exact-source CI, schema/type/boundary checks, native platform,
physical hosts, long-run load, acceptance, commit/push and release remain separate.

## Source Authorization And Acceptance Gate

This record precedes implementation. Proceed with the confirmed policy and
standing source authorization. Do not treat source integration as verification
or weaken any original authority, protected history or single Runtime ledger.

## Integrated Owner Chain And Compatibility Ledger

The implementation and authored consumers now reside in the main worktree.
No test, checker, generator, formatter, build, CI or runtime experiment has run.

| Entry | Actual successor binding | Compatibility consequence |
| --- | --- | --- |
| Browser / HTTP | `resource-limit-console.js` -> authenticated `GET/PUT /api/v1/scopes/:scope/nodes/:node/payload-limits/:actor` -> `ControlApi.resourceLimits` | Governance sets policy; personal reads are caller-bound; same-key unknown-result replay retains the exact request |
| Product command | `SharedResourceLimits.set` -> original Identity owner/member checks -> original Runtime Node lock -> own policy head lock -> CAS/history/audit/receipt | Only policy-owned tables are written; one original transaction; changing a period never resets an old bucket |
| Online publication | `RuntimeHost` -> injected `RuntimePayloadPolicy.limits` -> immutable Forward owner / Node claim+grant / complete policy history -> original retirement/compiler/authority/save | `RuntimeHostOptions.payloadPolicy` is required; changes prevent queued hold and ordinary reuse; original authority still records before Snapshot |
| Original Runtime entry | `RuntimeController` default provider and server composition bind the real product policy / original MySQL stores | Original constructor position remains valid; no permissive production fallback |
| Offline Transit entry | `TransitStagingService` requires `OfflinePayloadPolicy`; legacy `runtime/transit-staging.ts` supplies the real provider | Any configured shared resource refuses offline staging before profile/reservation; abort retains original cleanup semantics |
| Wire | original compiler -> closed optional `resourceLimits` -> existing digest and ADP/3 parser -> Runner | Protocol remains 3; new capability is required for limited assignments, not for old unlimited assignments |
| Execution | Runner -> `executionhost.Host.Payload` -> native direct/relay drivers -> forward/relay metered constructors -> gate before socket write | Old unmetered constructors remain explicit nil-gate entries; limited assignments cannot use an unsupported driver |
| Durable consumption | `payloadbudget.Gate` -> original `executionstate.RuntimeHost.Precharge` -> native `state` adapter -> same authenticated Journal Load/Save | Instance mutex then original OS file lock; Snapshot Accept reloads durable debits; no second consumption file or history reset |
| Withdrawal / drain | control-only bucket with empty assignmentIds -> same gate policy -> original Runner watch and close | It grants no execution. Existing drains observe policy narrowing even when no active assignment remains. Old proof/lease remains required |
| Inspection / recovery | original read-only JournalInspection2 / UpgradeAssessment5 / generic whole-database backup | Older binary downgrade with new protected history refuses. Preserve all 0041 policy, receipt and audit rows, AuthorityStore/key and authenticated Agent Journal |

New declared source counters are resource-limit ports/module 1, Runtime values 3,
RuntimeHost 4, executionstate 4, payloadbudget 1 and UpgradeAssessment 5.
Transit module advances to 2 for its required offline policy construction contract;
the unchanged Transit command API stays 1. Control HTTP advances to 2 for the
required aggregate provider successors (including resourceLimits); native HTTP
representation and original factory aliases remain their original versions.
executionhost remains version 1 with an additive optional payload port. The
Runtime wire remains version 3 with an optional resourceLimits version 1 object.
The reviewed Control profile is `adp3-shared-resource-limits-v1`, ceiling 0041;
the same named Agent profile includes native budget history support. Older
Control ceilings and Agent profiles retain their original limits. Journal
inspection version 2 exports only budget version/count and exact decimal total.

Control-only buckets are bounded and sorted just like executing buckets. Their
empty assignmentIds update an already retained binding without granting an
assignment. Agent history has a global 1024-bucket capacity; Control policy
history has 1024 per user/Node and wire publication has at most 1000 buckets.
Capacity and original file-size refusals preserve history and fail closed.

Policy changes reach the Agent through original publication. An old accepted
Snapshot or offline authorization is not retroactively revoked by a database
write: its original bounded proof/lease/hard cutoff still governs, including
original drain handling after a newer Snapshot. An old unmetered instance has no
bucket to update. First zero/out-of-period/unsupported configuration excludes the
assignment and uses original stop/drain; old unmetered connections may continue
until their bounded drain/lease deadline without retrospective charging. Existing
limited drains receive same-bucket revision updates; supported nonzero binding
changes close/restart active execution with a gate. The explicit period deadline is also enforced
locally. No immediate physical stop on an unreachable machine is promised.

The public [specification](../spec/shared-resource-payload-limits-v1.md) and
[provider example](../../examples/shared-resource-limits/README.md) record units,
period selection, recovery limits and the original public entrypoints. Wire,
publication, offline, protected Journal, native engines, upgrade, HTTP, audit
and Web cases are authored, including old consumer migrations; all remain
unexecuted. Source integration does not establish a frozen accepted successor.

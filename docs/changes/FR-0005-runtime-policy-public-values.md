# FR-0005: Runtime Policy Public Value Contract

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: common L1 Runtime policy value contract; the human's
2026-10-19 standing source authorization covers this similar foundation proposal.
This design was recorded before source implementation; source is now authored and
unverified. Acceptance, Git, release
and parallel-feature gates remain separate.

## Task Proposal

1. Layers: L1 shared Runtime policy values and L2 old shared/runtime wire consumers.
2. Public interfaces: new @tunex/contracts/policy entry, re-exported by framework
   public; old shared/runtime/index/legacy Policy imports remain the same type alias.
3. Foundation impact: additive public entry and exact declaration relocation. No
   L0 Core/kernel interface change, policy semantics, default values or validation change.
4. Contracts: Policy's thirteen original required mutable number fields have one
   canonical declaration in packages/contracts/src/policy.ts, interface version1.
   Old types.ts imports/re-exports it; DEFAULT_POLICY remains at its original site.
5. Acceptance: planned later exact-source type/export/alias/boundary acceptance and
   authorized Actions native constructor/validation behavior; no execution now.
6. Parallel impact: six direct L1 Policy consumers migrate together. All other
   current product/native imports retain existing signatures and object identities.

## Why Current Extensions Are Insufficient

L1 currently reaches Policy through @tunex/contracts/shared, an entry that exports
native JSON/hash/time/validation implementations. A type-only import has no runtime
execution but still creates the forbidden source dependency. Policy itself is a
common owner-independent numeric parameter contract, not an ADP parser or native
format implementation. It belongs with L1 contracts, not in the protected domain
Core or the minimal publication kernel. Moving ADP/Relay/Multihop wire shapes into
L0 with it would misclassify native formats and enlarge Core without need.

Choose a separate precise public leaf within the existing contracts package. Package
directories are not wholesale layer exemptions: only this source leaf is classified
L1, with no L2 type/value dependency. L2 imports the lower declaration. No second
Policy interface, forwarding alias back to an outer owner, package installation,
generator or new dependency is needed.

## Exact Contracts And Behavior

The new leaf owns RUNTIME_POLICY_INTERFACE_VERSION=1 and the original Policy body:
pollIntervalSeconds, leaseSeconds, renewalLeadSeconds, maxClockSkewSeconds,
observationFreshnessSeconds, drainTimeoutSeconds, connectTimeoutSeconds,
udpIdleTimeoutSeconds, maxTcpConnectionsPerAssignment, maxUdpSessionsPerAssignment,
maxSnapshotBytes, maxReportBytes and maxAssignmentsPerNode. All remain required
mutable number fields; no readonly, brand, range, optional field or runtime check.

Existing types.ts imports/re-exports this same declaration for its HelloResponse
and DEFAULT_POLICY annotation; shared/runtime/index/legacy exports keep their old
paths and type shapes. The native frozen DEFAULT_POLICY initializer, value order,
property values, module owner and object identity stay at the original site.
No new default fallback moves into L1. Native validators and schemas stay unchanged.

framework/public exports the common Policy type/version. The six direct L1 source
consumers use @tunex/contracts/policy instead of /shared. Host/ledger/Relay interface
versions stay2 from their previous FRs; this exact type relocation has no new refusal
or behavior change. Unknown policy input is still rejected by existing injected
native validation at its original call point, not by a replacement validator.

## Impact And Compatibility

Read actual types.ts, shared/runtime/index/legacy entrypoints, adp3/Relay/Multihop
declarations, native validators/time code, package exports and host/compiler sources.
Six observed direct L1 consumers: runtime-host[-ports], runtime-ledger[-ports],
runtime-relay[-ports]. Existing native compile/policy/default consumers continue
using their old public paths; their Policy is now an alias of the lower declaration.
No new runtime side effect is introduced by type-only aliases. The version constant
is additive at the new entry/framework public, not a replacement DEFAULT_POLICY.

Runtime wire types in nine L1 files and Relay configuration's transitive native
type remain separate migration debt. This proposal does not claim those schemas
became lower contracts or that full A5 is closed. No database/wire/Journal/version,
transaction, authority, clock sampling, policy copying or exception text changes.

## Migration And Version Plan

Add the manually edited package export for the pure leaf, relocate the original
declaration rather than copy it, preserve old type aliases/default initializer,
migrate six lower imports and record exact layer ownership. No dependency/lockfile
or generated artifact changes are needed by this design. Keep old Policy aliases
for all native/public consumers until a separately scoped removal is accepted.
No source path move authorizes protected-history rollback or clearing unknown
accepted cleanup; there is no persisted migration.

## Acceptance And Known Limits

Readiness124 planned only: old/new Policy assignability, mutable/required thirteen
fields, public version and package-subpath resolution; old index/shared/runtime/
legacy paths; DEFAULT_POLICY identity/frozen values and constructor copy timing;
native refusal/error/sample behavior. Include tooling consumers that locate source
declarations, not just compiled imports. Later boundary acceptance must classify the
new leaf precisely and reject transitive L2 imports, while recording unresolved
runtime wire dependencies without a broad shared-contract allowlist.

Uninspected source-text tooling and private-path declaration augmentation can rely
on the old declaration location; inventory/migrate those before acceptance rather
than promising that structural aliases prove every such consumer compatible.

No tests/checks/formatters/generators/builds/CI/experiments/commits/pushes ran. Exact
full candidate, public example, functional/MySQL/physical/long-run/release gates
remain unverified. Source relocation is not proof of alias or runtime acceptance.

## Source Authorization And Acceptance Gate

### B verification repair, 2026-10-19

The Runtime package entry omitted the direct Policy type alias promised above.
Add that type-only re-export from the same canonical lower declaration; this
implements this request's already-authorized compatibility plan. It adds no
runtime initialization, native default, policy field or validation behavior.
The human's standing source and B verification authorization covers this repair.
The B tests compare all thirteen mutable/required numeric fields through old/new
entries, exact frozen native defaults, and host copy/validation/sample timing.
Actual source scans found no declaration augmentations or source-text tooling
targeting the former declaration location. Exact-revision Actions remain required.

Implement under standing source authorization without repeated confirmation, then
record authored/unverified status. All verification and feature gates stay separate.

# FR-0013: Agent Journal Facts And Explicit Native Records

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner: original L1 executionstate/Bootstrap ports, L2 native state/platformruntime,
and original Runner composition. The human's standing source authorization of
2026-10-19 covers this similar proposal after recording its concrete break and
migration; do not request repeated confirmation. All evidence/Git/release/feature
gates remain independent and closed without their later authorization.

## Task Proposal

1. Layers: L1 neutral authenticated-history facts; L2 native Journal representation,
   store/Bootstrap adaptation; L3 Runner native binding.
2. Consumed public interfaces: existing RuntimeStore, SnapshotInput/SnapshotCodec,
   runtimeplatform.Bootstrap, original state Journal/RuntimeJournal functions.
3. Foundation impact: executionstate2 -> 3; runtimeplatform1 -> 2 and its native
   platformruntime provider1 -> 2 for transitive Bootstrap output contract changes.
   No L0, durable bytes, wire/protocol/schema or history migration is intended.
4. Contracts: lower records become tagless facts with Snapshot []byte,
   FormatVersion and ImportedHistoryDigest; native state records keep original
   JSON fields/order/RawMessage and public names. Their former type identity is
   intentionally split, requiring explicit converters at actual boundaries.
5. Acceptance: planned lower/native type and conversion/reference vectors, complete
   native JSON/MAC/load/save/migration/inspection and original call/error/persistence
   ordering on exact source. No verification is authorized or executed now.
6. Parallel impact: migrate native store/wrapper/Bootstrap/Runner together, preserving
   original state APIs for Transit/credentials/CLI/tests and one history authority.

## Why Current Extensions Are Insufficient

FR-0012 moved protocol/slot interpretation behind the existing codec but correctly
left explicit debt: executionstate still imports encoding/json and exposes native
tags/ProtocolVersion/ImportedTransitDigest. Native wrappers alone cannot remove
that source/type dependency. Keeping a RawMessage alias or copied native schema in
L1, or declaring the whole state package an exception, would retain the problem.

Separate the exact native record from the facts used by the existing host. No
parallel Journal store/host/authority is introduced: one host consumes projected
facts and the same state owner still authenticates, serializes and saves the same
native record. The separate records are representations, not separate state copies.
Converters retain existing byte/map/pointer references without cloning or parsing.

## Exact Lower And Native Contracts

executionstate.Journal keeps Snapshot, Generation, Digest, Fences and Retired, with
Snapshot []byte and no tags. executionstate.RuntimeJournal keeps NodeID, Journal,
ExecutionExtension, and renames ProtocolVersion -> FormatVersion and
ImportedTransitDigest -> ImportedHistoryDigest, without tags. These are the exact
format binding/history facts needed by the host; no native JSON representation is
defined for them. Direct lower JSON serialization is no longer the old persisted
contract and must migrate to native state APIs. No MarshalJSON fallback is added.

RuntimeHost's only body changes are those two field names in stale-caller/protocol
checks. Extension gate/copy, lock/load/validation/codec order, session/Fence/owner/
phase/retirement rules, save, errors and returned facts remain original. FR-0012's
required codec methods remain unchanged and still supply native interpretation.

L2 state owns canonical Journal and RuntimeJournal structs with the exact previous
field names, declaration order, json tags, RawMessage and omitempty semantics.
The same package-level names remain available to all old native API callers, but
they cease to be aliases of lower facts. Reflection package/type identity and direct
native-to-lower assignment therefore change intentionally. Unknown callers relying
on those identities must migrate; source-shaped fields alone are not proof of
source/type compatibility. There is no new persistence or codec implementation.

state.RuntimeJournalFacts(native) -> executionstate.RuntimeJournal maps every
field, raw bytes, maps and extension pointer; state.RuntimeJournalFromFacts does
the exact reverse. Explicit RawMessage/[]byte conversions share backing storage,
nil/length/capacity and maps/pointers. Neither conversion validates, normalizes,
sorts, clones, serializes, locks, reads time or initializes/reset/migrates state.
Do not default a missing version, extension, digest, map or raw value.

## Complete Observed Production Migration

runtimeFileStore.Load invokes the same original native loader then projects its
returned value, including any error return, to lower facts. Save converts facts
at its original site and invokes the same saveRuntimeJournal. The native wrapper
AcceptRuntimeSnapshot projects its current input before calling the same host,
returns the original native current on error with the same error, and converts
successful facts back. Equal-generation success preserves all field values and
references; save failure still reports caller state, even if native commit outcome
is uncertain. No extra load/save/lock/retry or raw-copy stage is added.

platformruntime.Bootstrap.LoadRuntime/EnableRuntime keep their original native
state calls and project returned records plus errors into the existing Bootstrap
return type. That type's fields/serialization meaning changed transitively, hence
runtimeplatform/provider interface2. Other scheduling/dial/local effects and method
signatures stay as before. Custom Bootstrap providers construct lower facts with
new field names; they do not return native state values implicitly.

Runner receives lower Bootstrap output, returns on the original error first, then
converts to native state before its existing extension refusal/record initialization.
Credential reload remains before optional EnableRuntime; successful enabled facts
convert before the original journal/runtimeState assignment. Client construction,
root/key/proof/load/credential/default-provider and feature/error order stays original.
Runner fields and all other original native state callers retain state-native types.

Native Initialize/Load/save/Enable/Inspect, general protected Save/Load, offline
Transit and credential envelope bodies retain their original representation/API.
The general state.Journal also protects Relay credentials: preserve their raw JSON
and empty maps/zero generation exactly, without projecting unrelated protected data
through Runtime facts. No history/identity/nonce/credential changes are introduced.

## Migration, Consumers And Compatibility Limits

Observed lower producers/consumers are runtimeFileStore, native Bootstrap and Runner
composition. Original state/Runner/native Probe/diagnostic/Relay credential/Transit
tests construct native state values and old literal keys. Agentidentity uses the
general native state.Journal for protected Relay data. These remain native and their
source entry names/fields/tags are retained. No bounded source-search result is a
full consumer/type or behavior pass; unknown consumers and boundary tooling still
need later concentrated acceptance on a complete frozen source revision.

Preserve public native entries until actual callers and same-source native byte/
history/error tests pass; lower direct consumers must migrate to interface3 facts,
custom Bootstrap to interface2. Accepted versions/removal conditions require later
evidence. Old binaries/native readers are intended to see the same durable bytes;
this does not authorize downgrading previously migrated extension history, removing
unknown fields, clearing protected records, or resetting authenticated high-water.

## Acceptance And Known Limits

141 planned: lower no encoding/json/tags/native Transit field; native canonical
fields/order/types/tags and intentional split type identity, new lower field names
and Bootstrap/provider versions; custom store/codec/provider source migration.
Round trip nil/empty/invalid raw bytes, len/cap/backing, maps and extension pointers,
zero/nonzero metadata without mutation/default/copy. No stable lower JSON format.

142 planned: same original native JSON payload/envelope/HMAC bytes, RawMessage
null/empty/invalid behavior, omitempty/order, loader strict validation/first errors,
atomic write/locks, equal generation, imported history and read-only inspector.
General protected Relay and offline Transit records must retain their native codec
without unintended Runtime conversion. Unknown/malformed/history/authority failures
remain existing refusals, never clearing/resetting records. All unexecuted now.

143 planned: lock/load/stale/input/extension/protocol/history/save/release order,
same current/error on native wrapper refusal/save failure, same raw/map/pointer
identity; Bootstrap original error/partial record projection and constructor feature/
proof/root/key/load/extension/credential/enable/client ordering; successful facts
conversion before original assignments. Runner still saves before binding, old
Guard/Ticket/drain/ACK/currentness and sole Journal remain. Later authorized native/
persistence/platform Actions required; no local experiments or physical substitute.

This closes only the inspected lower/native Journal representation chain in source.
Complete Agent/Control/CLI/engine/wire/default/private/type/consumer/removal/frozen
candidate and public example remain open. Original47 plus later cases are all
planned/unexecuted, with no claim of acceptance. No tests/checks/gofmt/generators/
builds/CI/network/PKI/native/container/MySQL/browser experiments/Git/delegation.
Independent physical-host, long-run, backup/recovery and release gates remain unmet
where unavailable and cannot be replaced by hosted same-host evidence.

## Source Authorization And Acceptance Gate

This record precedes the concrete source change and explicitly authorizes its
interface/type-identity migration under the standing human source instruction.
After implementation mark authored/unverified; later frozen-source evidence and
verification permission remain separate conditions for acceptance.

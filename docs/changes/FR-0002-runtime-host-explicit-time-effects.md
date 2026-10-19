# FR-0002: RuntimeHost Explicit Clock And Time Codec

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; source scope authorized**.
Owner and authorization: the human explicitly confirmed this FR-0002 source
migration on 2026-10-19, then issued standing authorization to autonomously select
and implement similar future foundation source proposals without repeated human
confirmation. Root AGENTS.md and the change template record that policy. FR-0001
alone did not authorize the breaking scope; the direct confirmation and later
standing instruction do. No verification/commit/push/release permission follows.

## Task Proposal

1. Layers: L1 RuntimeHost/RuntimeHostOptions/RuntimeCodec and L2 runtimeCodec;
   existing RuntimeController composition supplies the original native effects.
2. Consumed public interfaces: framework Runtime host interface1, Core/kernel
   publication decisions, original transaction/store/Node/ledger/Relay/authority
   ports and public native clock/ISO/time parser. No L0 change.
3. Foundation impact: **breaking public direct-host construction**, no wire,
   database, authority/Journal or product policy change. The historical positional
   RuntimeController constructor remains compatible through explicit native binding.
4. Contract: Runtime host interface2 requires now and two codec methods;
   it refuses incomplete time effects before policy validation/clock/I-O. Exact
   signatures and timing follow below. Source is now authored, not accepted.
5. Acceptance: confirmed source migration; later separately authorized
   exact-frozen-source contract and GitHub Actions behavior/MySQL/network evidence.
   All cases here are planned, not authored/executed/passed evidence.
6. Concurrent impact: direct host/codec consumers must migrate together on the
   existing foundation task before freeze. Product modules consume unchanged machine
   APIs. No feature branches, second host/ledger or protected-history reset.

## Why Current Extensions Are Insufficient

The complete current RuntimeHost was read, including constructor, hello, publish,
snapshot, tick, report and status. now is optional and the L1 constructor uses a
dynamic native Date.now fallback. Hello and Snapshot use native Date/ISO, previous
Snapshot reuse/authority issue/report freshness use Date.parse. RuntimeCodec only
offers policy validation/digest/Snapshot compilation and cannot supply those
representations. Injecting now only in production would leave L1's implicit default
and Date operations in place. Importing compatibility/public into L1 reverses the
declared dependency direction. A no-op wrapper or new composition exemption would
not resolve this boundary.

Requiring these effects changes direct-host construction even if current in-repo
production uses RuntimeController. Thus this proposal uses an explicit confirmed
versioned change rather than silently treating it as a private file move.

## Exact Contracts And Behavior

The following signatures are authored in current source; no compiler/check ran:

```ts
export const RUNTIME_HOST_INTERFACE_VERSION = 2 as const;
export interface RuntimeCodec {
    // Existing fields/methods retain their exact signatures.
    parseTime(text: string): number;
    formatTime(at: number): string;
}
export interface RuntimeHostOptions<Tx> {
    // Existing other fields retain their exact signatures.
    readonly now: () => number;
}
```

RuntimeHost keeps one original class, machine methods, tick/status and all caller
transactions. Before policy validation or any clock call its constructor checks
that now, codec.parseTime and codec.formatTime are functions; missing/wrong-kind
effects throw Error with message `Runtime clock and time codec are required`.
There is no native fallback, lazy provider resolution, ambient registry or retry.
This earlier refusal is an intentional direct-host construction change.

Every existing Date operation is replaced at its original expression position,
without sampling earlier, caching text, normalizing invalid dates or adding a
finite-number check. codec.parseTime must retain Date.parse semantics, including
NaN on invalid text; formatTime retains new Date(at).toISOString and its RangeError.
Calls use the supplied codec receiver, just like its existing methods. All original
clock calls, short circuits, Node lock/credential/state order, prior Snapshot hold/
reuse, claim expiry checks, authority issue before save/lease recording, report
replay/fencing and current Snapshot freshness decisions remain in their owner.

L2 runtimeCodec supplies the original public nativeParseTime/nativeIsoTime functions.
RuntimeController supplies nativeWallClockNow, which dynamically reads Date.now on
each call, matching the old host fallback rather than capturing Date.now earlier.
It keeps its current positional constructor, defaults, class inheritance and all
same ledger callback receivers. No legacy direct L1 overload is retained: it would
keep the unresolved native fallback. Direct clients migrate explicitly to interface2.
FRAMEWORK_INTERFACE_VERSION and all unrelated interfaces remain unchanged by this
proposal; the Runtime-host-specific version communicates this construction change.

## Impact And Compatibility

Observed live source consumers (manual source search, not a completed repository
boundary check):

- framework/public.ts exports RuntimeHost, RuntimeCodec, RuntimeHostOptions and
  the host version; host implementation consumes its local declarations.
- compatibility/runtime-codec.ts constructs the one native codec.
- modules/runtime/controller.ts is the one observed direct extends/super production
  binding. server.ts uses that historical positional class. Existing test sources
  use RuntimeController through their fixtures or type references; exact full
  consumer inventory still belongs to A5 and later acceptance.
- The current public extension example previews a Forward import and does not
  construct RuntimeHost. It does not prove runtime construction behavior.
- Unknown external direct-host/custom-codec callers must update for interface2;
  no claim of undocumented external compatibility is made.

No ADP/REST/driver/SQL schema, lease duration/skew bound, claim identity, publication
ownership, protected high-water, Journal format or persisted timestamp text changes.
No additional clock reads, authorization, resource reservation, event hop, transaction
or logging is added. No secret is included in the proposed configuration error.

## Migration And Version Plan

Source changes now update the host-specific interface/version and native codec,
bind native effects in existing RuntimeController and update the documented
acceptance map. The observed production direct binding is migrated. Every further
direct/custom consumer found by A5 must also migrate; this source record is not
a proof of complete repository or external consumer closure.
Do not publish a frozen interface2 candidate until all source consumers and planned
contract cases are mapped. Older direct-host construction is intentionally refused;
no indefinite v1 host implementation or parallel Runtime ledger is introduced.

Before any distribution, rollback can restore prior source and native bindings
because no data format changes. This does not authorize clearing authority/Journal
or rolling persisted history backward; authenticated monotonic history and unknown
accepted cleanup outcomes stay with the original owners. No commits/pushes/release
are authorized by confirming this source scope.

## Acceptance And Known Limits

Planned only: explicit/custom native effects, missing/wrong-kind effects refuse
before policy/clock/store calls, receiver binding/error identity, unchanged legacy
constructor, dynamic Date.now lookup and exact sample count/order. Compare zero/
offset/fraction/invalid/NaN/infinite inputs and original ISO/parse failures at each
old call point, including short-circuit revoked/credential, previous hold/reuse,
stale claim and authority-before-save/lease. Preserve rollback, report duplicate/
digest/fencing/error projection and failed publication outcomes on one frozen source.

Later authorized Actions must establish fake-port contracts and real Control/Agent/
MySQL behavior on that same revision, plus boundary acceptance proving no L1 Date
clock/format/parser fallback and a usable public runtime example. If further L1
native dependencies are found, classify them explicitly instead of assuming this
request authorizes arbitrary interfaces. Independent physical-host, long-run,
backup/recovery, image/release/production gates remain separate and unverified.

## Authorization And Evidence

The human explicitly confirmed this interface2 source migration and intentional
refusal of direct-host callers that omit required time effects. The later standing
instruction removes repeated confirmation for similar future source proposals;
each still records its design/impact/compatibility/migration and chosen decision.
Source implementation is not acceptance. No tests, syntax/type/static/boundary/
import checks, formatter/generator/build, CI, experiments, commits or pushes ran.
Readiness119 records the planned vectors. Further A5 source work continues under
the same source-only agreement; B acceptance still requires later authorization.

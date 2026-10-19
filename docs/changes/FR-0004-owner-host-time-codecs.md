# FR-0004: Ledger Relay And Node Time Codecs

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing Ledger, Relay and Node owners, under the human's
2026-10-19 standing authorization for similar foundation source proposals. This
design was recorded before implementation; source is now authored/unverified.
Verification, Git, release and feature gates remain separate. No L0 interface,
wire/data version or authority owner changes.

## Task Proposal

1. Layers: L1 RuntimeLedgerHost/RuntimeRelayHost/NodeAuthorityHost and their public
   compiler/codec ports, L2 native implementations, L3 NodeService presentation.
2. Consumed public interfaces: existing framework hosts/ports, native compiler/Node
   codec and nativeParseTime/nativeIsoTime. Existing Core/kernel APIs are protected.
3. Foundation impact: breaking direct/custom compiler/codec construction. Native
   Ledger/Relay/Nodes positional constructors and all method results retain their
   signatures; intended native time text and policy remain the same, unverified.
4. Contracts: Ledger and Relay interface2 require compiler parseTime/formatTime;
   Node authority interface2 requires codec formatTime. Missing methods refuse
   before clock/I-O. No new generic provider, clock, fallback or time policy.
5. Acceptance: planned exact-frozen-source contracts and later authorized Actions
   behavior/MySQL/network evidence. No test/check/build/CI/experiment in this phase.
6. Parallel impact: direct/custom provider users migrate together; NodeService
   inherits the same required codec. No extra state/ledger/signer/Journal, feature
   branches or composition roots; original owners and caller transactions persist.

## Why Current Extensions Are Insufficient

Complete host bodies and the NodeService were read as source. All three hosts
already inject clocks, but still perform native Date conversion. Their existing
compiler/codec ports do not express time conversion. Production clock injection
alone does not remove those representation dependencies. Reuse each existing port
instead of adding another provider registry, exposing native Date objects to L1,
copying host coordination into adapters or importing L2 implementation into L1.

## Exact Contracts And Behavior

```ts
export const RUNTIME_LEDGER_INTERFACE_VERSION = 2 as const;
export const RUNTIME_RELAY_INTERFACE_VERSION = 2 as const;
export const NODE_AUTHORITY_INTERFACE_VERSION = 2 as const;
// RuntimeLedgerCompiler and RuntimeRelayCompiler each add:
// parseTime(text: string): number;
// formatTime(at: number): string;
// NodeAuthorityCodec adds formatTime(at: number): string;
```

After the existing assignment-collector check, Ledger checks both time methods;
missing/wrong-kind effects throw Error('Runtime ledger time codec is required').
Relay checks both before copying options/policy, throwing Error('Runtime relay time
codec is required'). Node preserves overlap/lifetime checks first, then checks its
formatter, throwing Error('Node authority time codec is required'). New refusal
and associated precedence for incomplete direct/custom providers are intentional.
Constructors do not sample clocks, format text, parse input or invoke storage.
FRAMEWORK_INTERFACE_VERSION and unrelated versions stay unchanged.

L2 binds the existing nativeParseTime/nativeIsoTime functions. Parsing must retain
Date.parse semantics, including NaN; formatting must retain new Date(at).toISOString
semantics and RangeError. Methods keep the supplied compiler/codec receiver.
No normalization, extra finite check, duration/skew change or exception remapping.
Replacements stay at their original expression positions:

- Ledger capacity: sample now before assignments/other awaited reads as before,
  format issued/valid times only at the final snapshot compile expression.
- Ledger drains: look up retirement and lease first; parse only for draining with
  a truthy lease bound. No new check for removed/absent leases or invalid-date NaN.
- Ledger completion: report/snapshot/execution-deadline short circuits retain both
  original Now calls and parse position, before protocol/assignment observations.
- Relay status: session/report/freshness short circuits stay; receivedAt uses its
  existing truthiness test, so zero still projects null. Authorization formatting
  remains after all node observations and isolation lookup.
- Relay plan: resource reservation and original Now evaluation precede issuance
  formatting; plan compilation and store's separate two Now calls stay in place.
- Relay observed: original session/report/snapshot lookups precede validity parse
  and conditional Now; no cached earlier validity or widened publish authority.
- Node relay issuance: replay/current credential/overlap/sign/recheck precede
  existing retirement/insertion; format response fields after those writes and
  before saveRelayRequest and audit. Overlap formatting stays conditional on active.
- Node rotation: original replay/sign/credential recheck and insert/retire/current
  writes precede response formats, then replay save and audit in the original Tx.
- NodeService provision: native-equivalent expiry format stays after transaction
  completion; formatting failure must not be reported as if provisioning rolled
  back. Node view keeps pending-revocation sample and existing until/retireAfter
  truthiness, credential map order and response/error timing inside its original Tx.

## Impact And Compatibility

Observed source chains: RuntimeLedger -> nativeLedgerCompiler -> RuntimeLedgerHost;
RelayCoordinator -> nativeRelayCompiler -> RuntimeRelayHost; Nodes -> nativeNodeCodec
-> NodeService -> NodeAuthorityHost. Public framework and Node owner re-export the
same port declarations. Native Node policy/command consumers also share this codec.
Source search found those provider literals/extends bindings; this is a bounded
source observation, not full A5/external-consumer acceptance.

Direct old/custom compiler or codec objects without required methods are refused.
No legacy native fallback remains inside these hosts. Existing wrappers keep their
parameter defaults, captured Date.now function at construction, policy copies,
resource factories and static recovery. RuntimeController's dynamic clock under
FR-0002 remains distinct and untouched. Native functions look up Date.parse/Date
at each conversion, preserving their original behavior. No new clock sample.

No database statement, response field/order, REST/ADP/schema version, signer call,
credential lifetime, overlap, resource fence, authority history or Journal changes.
Unknown accepted cleanup outcomes and protected history stay with existing owners.

## Migration And Version Plan

Update the three specific public versions/required methods, native providers and
existing host/NodeService conversion sites in one source slice. Existing wrapper
constructors need no new parameters. Every further direct/custom consumer found
by A5 must supply the required native-equivalent methods or document intentional
custom representation behavior before acceptance. Do not freeze from scoped search.

No persisted migration or protected-state reset is needed or authorized. A source
rollback before distribution does not allow authority/Journal high-water rollback.
There is one implementation per host and no permanent parallel v1 state owner.

## Acceptance And Known Limits

Planned: required method refusal/first-error precedence before policy copy or I/O,
native/custom receiver/error identity, zero/offset/fraction/invalid/NaN/infinite
inputs, exact parse/format/Now counts and short circuits. Compare all conversion
sites above, plus same-Tx rollback on Node response-format errors after writes,
replay returning before sign/format, post-sign credential expiry, partial overlap,
and provision's post-commit format error. Compare Ledger drain/lease fencing,
completion/cleanup, Relay status/activation/multihop publication and reservations.

All cases are planned/unexecuted. Native equivalent text/errors and old wrapper
behavior are intended, not proven. Later authorized exact-source Actions must
cover contracts and real owner transactions. Full source/type/default/consumer
classification, usable public runtime example, independent physical-host, long-run,
backup/recovery and release/production gates remain unverified.

## Source Authorization And Acceptance Gate

The human's standing instruction authorizes choosing and implementing this similar
proposal without another confirmation. Source implementation does not open any
verification/commit/push/release/parallel-feature gate or certify foundation stability.

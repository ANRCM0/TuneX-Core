# FR-0010: Node Native Input Support And Fingerprint Codec

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing L1 Node authority and L2 native input codec,
under the human's standing 2026-10-19 source authorization. Recorded before source
implementation, now authored/unverified. No verification, Git, release or feature
gate follows.

## Task Proposal

1. Layers: L1 NodeAuthorityHost/NodeAuthorityCodec and L2 nativeNodeCodec.
2. Public interfaces: existing Node codec/facts/signer/store/resources/clock and
   original Nodes -> NodeService -> NodeAuthorityHost construction chain.
3. Foundation impact: required codec methods/direct custom construction change,
   Node authority interface3. No L0, input/wire/schema/authority semantics change.
4. Contracts: validEnrollmentToken, validCredentialRequest, supportsDirectRuntime
   and relayFingerprint supply original input/native marker predicates and prefix
   projection. The fingerprint scope amendment is recorded before that additional
   implementation. Host retains
   input error mapping, identity/network/credential/transaction/sign/replay policy.
5. Acceptance: planned exact-source predicate/alias/ordering and authorized Actions
   enrollment/rotation/Relay/authorization equivalence. None executed now.
6. Parallel impact: native provider migrates with the host; original Node wrapper
   constructor/defaults/static recovery and all actual state owners stay unchanged.

## Why Current Extensions Are Insufficient

Complete current NodeAuthorityHost and native codec/ports were read. L1 directly
tests base64url-style enrollment token text, bounded PEM CSR prefix, and native
ADP/direct capability tags. Existing codec already owns ID/counter/network-policy/
target/digest/format representations but cannot provide these predicates. Moving
whole authorization/signing flows to L2 or keeping native literals in L1 would
retain the mixed boundary. Extend the existing codec rather than add an authority,
parser pipeline, callback protocol or new configuration owner.

## Exact Contracts And Behavior

NODE_AUTHORITY_INTERFACE_VERSION becomes3, superseding2. NodeAuthorityCodec adds:

```ts
validEnrollmentToken(value: unknown): value is string;
validCredentialRequest(value: unknown): value is string;
supportsDirectRuntime(facts: AuthorizedNodeFacts): boolean;
relayFingerprint(fingerprint: string): string;
```

After original overlap/lifetime and formatTime checks, constructor checks these
four function kinds. Missing/wrong-kind methods throw Error('Node authority native
codec is required') before assigning providers, reading time or invoking I/O.
This earlier refusal for incomplete direct/custom codecs is intentional.

Native token predicate keeps typeof string and the exact original 32..128 character
alphabet regex. Credential request predicate keeps typeof string, original <=16384
bound and the exact PEM prefix. It is only the original input preflight, not a new
cryptographic CSR validator, normalization, algorithm/key policy or signer bypass.
Native support predicate performs the exact original adp.3 then native.direct.v1
includes checks, reading facts.capabilities independently at each original access.
Passing the whole facts reference preserves those getter/short-circuit stages;
do not cache its capability array or pre-read Forward protocols.

Enrollment validation keeps isId -> token -> credential request -> same invalid
error before digest/Tx. Rotation/Relay issue keep isId -> request predicate -> same
caller-specific invalid error before digest/Node lock/replay/signing. Short circuit
on earlier invalid input does not run later predicates. No parser/sample/I/O is
introduced in these native functions and original text is passed to hashing/signing.

intentAllowed keeps Node/Scope/listener/port comparisons first, then invokes native
support at the old two-marker stage, then original Forward protocol iteration and
targetAllowed. Host retains all policy/authority decisions and errors. No additional
capability is accepted, refreshed, persisted or inferred by the native predicate.

relayCredentialFacts also projects a native sha256 prefix. Its new codec formatter
returns the exact original template expression with no parsing, validation or
normalization. Invoke it at the original fingerprint map property, preserving
credential order, certificate and validity-bound evaluation. This additional scope
was recorded before its implementation and remains part of source interface3.

## Impact And Compatibility

nativeNodeCodec adds four synchronous pure methods to its existing frozen object;
old policy/format/digest/ID/target methods remain. Nodes still supplies this codec,
original signer/secrets/MySQL/resource providers and captured Date.now; no constructor
arguments/defaults/static API change. NodeService inherits the same host/authority.
Unknown custom codecs must supply these methods for interface3; no native fallback.

Enrollment history/replay, post-sign expiry check, rotation current credential and
idempotency, Relay overlap/lifetime bounds, same Tx writes/replay/audit, Node locks,
grant/session/resource/Journal/protected history stay original. No SQL, signer call,
token hash, wire field, schema or data migration. Invalid/unknown input retains
existing refusal; native predicates do not grant execution or credential authority.

## Acceptance And Known Limits

133 planned: constructor first-error precedence, native/custom method receivers,
token type/alphabet/31/32/128/129 bounds, CSR type/size/prefix boundaries and original
three invalid error texts; no full parse/normalization. Compare capability getter
counts/order and short circuits, Node/Scope/listener/port before support, Forward
protocol/target access afterward. Do not combine predicates or eagerly project facts.

Also compare relayFingerprint's original template/coercion/error, method receiver
and credential-map property order with no extra validation/digest/sample.

134 planned: full native Node construction, enrollment/replay/digest/token hash/sign
and post-sign expiry, rotation/Relay current credential/overlap/refusal/replay and
same-Tx lock/write/save/audit/rollback. Compare captured clock counts/defaults/static
recovery and original authorization/network failures, with no second authority or
history reset. All cases remain unexecuted on this source.

No checks/tests/formatters/generators/builds/CI/experiments/commits/pushes occur.
This bounded native input migration is not complete L1/repository classification
or acceptance. HTTP/Agent/CLI/default/private/consumer/removal/frozen candidate,
public example, independent physical/long-run/backup/release gates remain open.

## Source Authorization And Acceptance Gate

Proceed under the standing source instruction without repeated confirmation, then
record authored/unverified status separately from exact-source acceptance.

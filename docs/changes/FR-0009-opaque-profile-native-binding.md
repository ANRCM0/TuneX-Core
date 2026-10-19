# FR-0009: Opaque Profile Port And Native Binding

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing L1 Relay/configuration ports, L2 native Profile
codec/compiler and L3 Transport owner, under the human's standing 2026-10-19 source
authorization. This design was recorded before implementation; source is now
authored/unverified. Verification, Git, release
and parallel-feature gates remain separate.

## Task Proposal

1. Layers: L1 opaque Profile family/configuration ports; L2 native binding; L3
   Transport/Endpoint public native type selection and Transport timestamp output.
2. Public interfaces: existing RuntimeValueFamily/RuntimeRelayCompiler/configuration
   codec and native Profile schema/parser; original public Transport/Transit types.
3. Foundation impact: breaking direct/common Profile type defaults and custom codec
   construction; no L0/Core/kernel, actual Profile/wire schema or storage change.
4. Contracts: family relayProfile:unknown, generic lower Profile/configuration
   contracts and explicit Native Profile aliases; required codec formatTime.
   Values2, Relay5, relay configuration2, Transport module2 are source candidates.
5. Acceptance: planned exact-source type/alias/consumer/boundary and authorized
   Actions parse/Tx/replay/format behavior. No check/test/build/CI/experiment now.
6. Parallel impact: migrate existing native compiler/Transport/Endpoint/Transit/
   legacy aliases together; retain constructors, instances, original Tx/authority.

## Why Current Extensions Are Insufficient

FR-0008 leaves RuntimeRelayProfile.config directly typed as native RelayProfileConfig
and TransportProfileConfig deriving it. The complete inspected host only passes
that payload to its injected native compiler; schema parsing/interpretation stays
in the existing native codec/resources/plan implementation. Therefore L1 does not
need to own/import the native schema. Re-exporting it under another lower alias or
moving its fixed driver/wire/security schema into L0 would preserve the wrong owner.

Use the existing erased value family for the Profile payload too. The common default
is unknown; only the native family binds the actual old Profile type. Parameterize
the existing Profile/input/transport/compiler/configuration contracts instead of
adding a second generic registry or parallel compiler. Preserve native consumers
through explicit specialized aliases, not a hidden native lower default.

Transport get also directly constructs native Date for createdAt. Its existing
codec is the representation owner and can supply the original formatter. Keep
formatting at the same response expression inside the original transaction; do
not hoist it, change the stored timestamp, normalize failures or move owner policy.

## Exact Contracts And Behavior

RuntimeValueFamily gains readonly relayProfile:unknown; common values version2.
NativeRuntimeFamily binds relayProfile to existing native RelayProfileConfig.
RuntimeRelayProfile<F>.config is F['relayProfile']; Profile transport, multihop/Relay
plan inputs and compiler signatures carry the same F. Relay interface5 supersedes4.
No host/ledger runtime code or protocol/driver/data version changes in this scope.

TransportProfileConfig<F> derives the family's payload and RelayConfigurationCodec<F>
returns it from profile(value). It adds required formatTime(at:number):string;
configuration interface2 supersedes1. Endpoint config and store/transaction shapes
stay unchanged. Native codec retains its original parser/encode/digest/ID methods
and binds existing nativeIsoTime, without reading time or I/O at construction.

Native public aliases specialize lower Profile/transport/plan inputs/configuration
codec to the native family. Transport ResolvedProfile/View/Resolver/Options and
Endpoint Options select those aliases, preserving their original closed native
payloads. Native resource/Relay/multihop/Transit compiler types and old multihop
input export use the explicit native aliases; actual parser/compile bodies remain.

TransportService constructor checks formatTime is a function before assigning its
providers; missing/wrong-kind formatter throws Error('Transport time formatter is
required') before clock/store/owner calls. This new direct/custom refusal is
intentional and advances Transport module to2. The historical Transport constructor
binds the updated native codec and keeps its original parameters/default clock/UUID
and static recovery. Endpoint does not use the formatter or add a runtime guard;
its existing API/module version1 and method bodies stay unchanged while its codec
dependency selects the native configuration2 contract.

Transport get replaces only new Date(record.created_at).toISOString() with the
supplied codec formatter at the original response property. Authorization/current
revision/record reads, native decode/parse and digest checks still precede it inside
the same Tx. Original native ISO output and RangeError are intended, not demonstrated.
No extra sample, fallback, retry, changed flag, publish/grant behavior or error map.

## Impact And Compatibility

Read actual framework Profile/configuration declarations, full Transport service/
contracts/wrapper, Endpoint service/contracts/wrapper, native configuration codec,
native resources/plan/multihop/Transit types, public legacy aliases and Native family.
The observed planner test source consumes old transport-ports.ResolvedProfile with
the native schema; that alias remains explicitly native. No test is executed.

Native Profile driver/wire/security/lifetime/size/protocol fields, schema/parser
refusal, frozen configuration, digest/JSON values and old public native records
stay unchanged. Common direct clients now see opaque config unless they select a
family; old custom codec clients need the formatter. Unknown source-text/private
augmentation consumers still need inventory before acceptance.

## Migration And Version Plan

Record Values2/Relay5/configuration2/Transport2, update the family and lower generic
ports, bind native aliases/provider and migrate all observed source consumers.
Other Runtime/ledger/evidence/Node/framework/ADP/driver markers remain unchanged.
No dependency/install/lockfile/generator/schema change is needed. Retain old native
aliases until actual consumers and same-revision acceptance support removal.
No new transaction, authority, ledger, Journal or protected-history rollback.

## Acceptance And Known Limits

130 planned: opaque default versus native family Profile shape, required/mutable/
literal fields, generic compiler/transport/config codec correlation, old native
ResolvedProfile/multihop/Transit/public aliases, versions and declaration consumers.
131 planned: original native parse/digest/freeze/resource/plan/Transit argument and
error order; same owner Tx/SQL/replay/revision/grant behavior and constructor/static
defaults with explicit type specialization. No L1 native schema duplicate/alias.
132 planned: formatter-required refusal before any provider effect, native/custom
receiver/output/RangeError, original get read/parse/digest-before-format position
inside Tx and rollback/error outcome. Endpoint still does not invoke it. Cover
invalid/zero/fraction/NaN/infinite timestamps, no extra clock and unchanged other
public responses.

All planned/unexecuted. This resolves the named Profile source dependency in the
inspected graph, not a full framework/repository boundary pass. Remaining native
owner policies, HTTP/Agent/CLI/default/type/consumer/removal/candidate classification,
usable public example, independent physical/long-run/backup/release gates stay open.
No tests/checks/formatters/generators/builds/CI/experiments/commits/pushes run.

## Source Authorization And Acceptance Gate

Implement this concrete similar proposal under standing source authorization;
no repeated human confirmation. Record source completion separately from acceptance.

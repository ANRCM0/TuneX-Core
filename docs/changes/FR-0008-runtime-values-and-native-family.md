# FR-0008: Runtime Coordination Values And Explicit Native Family

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing L1 Runtime/ledger/Relay/assignment/evidence owners
and L2 ADP/native providers, under the human's standing 2026-10-19 source authority.
This design was recorded before implementation; source is now authored/unverified.
No verification, Git, release or
parallel-feature gate is authorized by this record.

## Task Proposal

1. Layers: L1 common execution values and generic Runtime providers; L2 native
   envelope/driver family, wire projections, existing stores/compilers/wrappers;
   current L3 Forward/Probe and HTTP consume the explicit native specializations.
2. Public interfaces: existing policy/observation leaves, new precise public
   @tunex/contracts/execution-values, framework ports, native public family aliases.
3. Foundation impact: breaking direct/custom host/port type construction; no Core/
   kernel, ADP/schema, protected history or actual execution semantics change.
4. Contracts: one common fact declaration, erased RuntimeValueFamily parameters,
   required machine codec validation/projections. Host3, ledger3, Relay4, evidence2;
   new execution value entry1. Old native constructor/method/wire types are bound
   explicitly to NativeRuntimeFamily instead of leaking native imports into L1.
5. Acceptance: planned same-frozen-source type/export/alias/boundary and authorized
   Actions native behavior/MySQL/network equivalence. No checks/tests/build/CI now.
6. Parallel impact: migrate all observed production source bindings together;
   existing ledger, authority, transactions/defaults/recovery remain. No new state,
   plugin loader, queue, driver, protocol support or feature branch.

## Why Current Extensions Are Insufficient

Nine framework files directly reference native RuntimeAssignment/Snapshot/Messages/
Tombstone and Profile types despite earlier compiler/format extraction. Merely
re-exporting these native declarations through L1 or moving complete ADP/native
schemas into L0 changes neither ownership nor source direction. Host also owns
native protocol/capability checks and literal Hello/ACK envelopes.

Choose lower common coordination facts and an erased type family for outer envelope
extensions/driver payload. Native wire interfaces extend/alias the common facts,
so there is one declaration for shared fields. L1 imports only common facts; L2
chooses its existing closed native driver and protocol extension types. Generic
parameters are static provider bindings, not runtime protocol negotiation or a new
callback/dispatch system. L0 is unchanged. RelayProfileConfig remains an explicit
separate debt rather than being relabeled a common value to claim closure.

## Common Facts And Family Contract

New execution-values owns ExecutionRole, execution resource/driver identity,
assignment/tombstone/snapshot and Hello/report/ACK facts. Fields, mutable arrays,
phase/role unions, fences/generations/digests and time text retain their original
shapes. No protocolVersion/executionExtension, native driver ID/schema/config union,
parser, default, validation, I/O or clock belongs to this common leaf. It uses only
public Core and existing lower policy/observation type contracts.

Native RuntimeAssignment retains its old driver payload through a specialization
of the common assignment; RuntimeTombstone aliases the common tombstone; native
Snapshot adds its original protocolVersion3/executionExtension envelope. Legacy
Hello/report/ACK interfaces add their original protocolVersion2 to common facts.
ADP/3 RuntimeMessages keeps its existing Omit/3 specializations. No schemas/parsers,
field/key ordering, DEFAULT_POLICY or serialized values change in this relocation.

RuntimeValueFamily binds driver/source declaration types and Hello/Snapshot/report/
ACK extensions. Assignment/snapshot/message type operators derive from those
bindings, preserving the relation between a snapshot's assignment type and its
compiler/store/ledger. The native family derives extensions from existing native
types; native IDs/schema versions/configs stay in L2. Default L1 family contains
common facts only. Direct clients requiring native payload fields must specify the
native family; silently using a native default inside L1 is deliberately removed.

Propagate the family through hosts, state/ledger/Relay stores and compilers, snapshot
input/source/collector/reader and machine port. Evidence retains its existing
generic record specialization and gains a family-parameterized snapshot value.
Current native wrappers/providers and public old compatibility aliases specialize
the native family to retain their original closed signatures. Common status role/
resource fields use the canonical common facts without native dependencies.

## Machine Codec Semantics And Timing

RuntimeCodec gains required checkHelloProtocol/checkHelloCapabilities, helloResponse
and reportAck methods, specialized by the family. Missing/wrong-kind methods throw
Error('Runtime machine codec is required') after the existing clock/time guard and
before policy validation, constructor clock/I/O. This intentional earlier refusal
applies to incomplete direct/custom codecs; the native wrapper supplies all methods.

Move the exact ADP3/capability predicate and original ControlError to the native
codec at the first old hello condition, then retain foreign Node rejection in the
host, then invoke the exact direct capability predicate at its original position.
No combined validation may reorder these three refusal stages. Native methods add
no parse, sample, I/O or accepted capability. Hello response is projected at the
original return expression after boot/history/capability state operations; server
time formatting/Now, bootId read and policy copy stay at their original argument
evaluation point. Native formatter returns the original mutable key order/object.

ACK projection remains at the original expression after digest/prior lookup and
before duplicate-body conflict handling. It retains boot/sequence getters, status,
key order and duplicate return before later report work. No formatter validates,
samples, normalizes, freezes or changes original owner policy/error mapping.

All remaining host publish/hold/reuse/claim, authority-before-Snapshot-save/leases,
report fence/replay and cleanup order is unchanged. Ledger and Relay changes are
type parameter propagation; no new runtime policy, clock sample or transaction.

## Impact And Compatibility

Observed source graph includes all three native wrappers, native codec/compilers,
MySQL Runtime stores, Forward assignment registry/source, runtime legacy type
bridges, Probe publication read port/store and HTTP machine types. Preserve native
type aliases for existing old entrypoints and exact generic/mutable wire fields;
native-only consumers use those explicit aliases rather than the new common default.
Native object identity, prototype/static recovery, default capture and original
provider instances remain. Unknown direct/custom/source-text/augmentation consumers
must migrate explicitly; scoped search is not full A5 compatibility proof.

Host interface3 supersedes FR-0002's2, ledger3 supersedes FR-0004's2, Relay4
supersedes FR-0007's3, runtime evidence2 supersedes1. Unrelated interface/framework/
protocol/schema/driver versions remain. Native format and existing constructor
APIs stay fixed through explicit provider binding; there is no v1 parallel host,
second ledger, authority reset or data migration. Reverting source before release
does not authorize rolling back authenticated history or losing accepted cleanup.

## Acceptance And Known Limits

Readiness127: exact common/native type relation, public exports and family defaults,
native old aliases, declaration/source/tool consumers, generic snapshot-assignment
correlation, readonly/mutable/optional unions and no duplicate schema declarations.
Readiness128: machine codec required/refusal precedence, native predicate counts and
identity order, Hello/ACK object/key/getter/clock/copy timing and no formatter side
effect; existing publication/Tx/authority/report/cleanup equivalence.
Readiness129: complete actual native wrapper/compiler/store/Forward/Probe/HTTP/legacy
consumer integration and default/prototype/static behavior; boundary enforcement
must still report unresolved Profile/native choices and all other A5 work.

All cases planned/unexecuted. Test/tool source compatibility may need later authorized
adaptation. Do not infer full closure from source edits; no checker/build ran. Relay
ProfileConfig/transitive configuration, remaining native owner policies, full HTTP/
Agent/CLI/default classification, exact candidate, public example, independent
physical-host/long-run/backup/release gates remain open and unverified.

## Source Authorization And Acceptance Gate

Proceed with this concrete migration under standing source authorization without
repeated confirmation. Source authorship, verification, acceptance and release
remain separate; the whole goal stays active until its actual requirements pass.

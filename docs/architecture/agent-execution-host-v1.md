# Agent Execution Host v1

Date: 2026-10-18 (Asia/Shanghai). Source candidate only, unverified and not accepted.

FR-0014 later adds PreparedInstanceVersion1 with only Activate/Close for the original
offline Transit engine. Existing HostVersion1/Driver/Instance/registry remain; no
fake drain/authorization methods or new driver. Native adapter preserves concrete
pointer/nil/partial error semantics and original controller persistence/order.
See [actual offline binding and debt](offline-transit-native-binding-v1.md),144-146
planned/unexecuted. The engine remains absent from deployed Run/poll/registry.

## Layers And Entrypoints

| Layer | Public source | Responsibility |
| --- | --- | --- |
| L1 | agent/internal/executionhost | Generic Host/Driver/Instance, descriptor/feature/target/header values, bounded registry, clone and explicit selection/refusal |
| L2 | agent/internal/executiondriver | Existing typed aliases for ADP assignment/policy and native Relay identity; actual OS binding and old registry methods |
| L2 | agent/internal/nativeexecution | Original Direct/Relay/Multihop config/engine/lifecycle/observation/error adapters |
| Existing owner/legacy bindings | agent/internal/control | Runner authority, Journal, Guard/Ticket, current instances/retirement and old helper names |

Generic source imports neither native engine/wire types nor OS/clock/I/O. It owns
one implementation of the public registry, not a second execution authority.
Typed executiondriver.Registry holds that lower registry by value, preserving the
old zero-value behavior: empty Descriptors and unsupported Resolve, not a nil-inner
panic or implicit registration. Descriptor/Features/Instance/ProbeTarget and typed
Host/Driver aliases keep old public names, fields and method signatures. Alias,
method-set and metadata serialization compatibility still needs acceptance.

The process-local HostVersion stays 1. This is not ADP, assignment schema, Go binary
plugin or persisted Journal migration versioning. No new protocol or external
binary-loader compatibility is claimed. The source is compiled-in and trusted.

## Selection And Lifecycle

The generic registry validates the same bounded, duplicate-free descriptors and
clones all declaration slices. Resolve takes only selection headers, feature gates
and a trusted actual platform; it returns a descriptor clone or the original
unsupported error. It does not parse assignment bodies or authorize them.

The typed/native binding projects the existing ADP headers and reads runtime.GOOS.
Control capability selection delegates actual-platform checking to that binding;
it does not use an observed or remote platform as authority. Existing schema/role/
phase/protocol/feature/platform rejection and capability order remain source intent.

Native execution receives existing assignment/policy/peer-identity/check inputs,
not a Runner, Journal, authority issuer or permit manager. Direct conversion retains
the original native config/policy JSON path and TCP/UDP replacement checks. Relay
retains peer lookup before conversion, strict native parsing, prepared start,
activation/drain transitions, 4096 clamp, partial-start close and exact error/retry
classification. Observation returns actual native instance endpoints/checks only;
Probe still needs its original owner/Gate/watch/current-binding authorization.

Runner still persists protected history before sockets, performs Guard/Ticket and
fence/deadline checks, owns replacement/retirement, and restricts peer credentials
by the original driver declaration. No protected-state format, MAC, high-water,
recovery/reset, registration, retry, capability, feature default or staged echo
execution is added. Existing native engines have not been rewritten here.

## Compatibility And Remaining Debt

Old Control Direct/Relay/Multihop factory, conversion, start, replace, phase,
capacity/finish and error helper names are exact delegates. Existing host translation
passes field values/callbacks, not authority or parser fallbacks. New drivers use
public contracts and normal known composition, not those legacy private helpers.

Control's old private declaration/precheck/indexing compatibility code, native
ADP/Relay identity type references, Probe target/trust code and CLI/native engine
internals remain mixed debt. This is not certification that all of Control is L3,
all Agent policy is generic L1 or every native dependency is already classified.
No new composition-root exemptions or copied second registry are created.

Foundation readiness item 29 records unexecuted source alias/generic binding,
zero-value/nil behavior, clone/refusal, native marshaling/order/cleanup/authorization,
capability and protected-owner cases. No tests, checks, gofmt, build, network/native
experiment, Actions, commit or push has run for this slice. Exact frozen-source
acceptance and independent physical gates remain required; the parallel gate is
closed.

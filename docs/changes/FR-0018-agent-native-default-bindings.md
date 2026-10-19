# FR-0018: Agent Native Default Bindings And Explicit Counter Clock

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner and authorization: Agent Control/native binding owners. The human's
2026-10-19 source authorization permits selecting and implementing similar source
proposals after recording their impact. This record precedes implementation.
The current goal continuation retains source-only work and no delegation.

## Task Proposal

1. Layers: L2 native binding package agentplatform; L3 Runner; existing Control
   constructor/default compatibility seam. No L0/L1 behavior or interface changes.
2. Consumed public interfaces: executionidentity/channel, runtimeplatform2,
   platformruntime2, agentidentity1, controlchannel1, platformobservation2 and the
   existing public Probe constructors/CounterSet. Same concrete TLS/X509/HTTP types.
3. Foundation impact: additive L2 native binding interface1 and moved native
   binding struct declarations with exact old Control aliases; source/reflection
   type identity change is recorded, not treated as an invisible private move.
4. Contracts: agentplatform owns Providers/Effects/LocalServices and their original
   defaults. Control public names become aliases, retaining original fields and
   constructors. Counter projection accepts an explicit scheduler internally;
   original free helper remains a native compatibility wrapper. Production binds
   a separate native counter scheduler, never the Runner's injected Schedule.
5. Acceptance: planned174-176, exact-source alias/type/import/default/nil/provider,
   Probe mode/error/allocation and clock sample/current/terminal/counter lifecycle
   cases. Functional native evidence later in Actions. None executed in this phase.
6. Other modules: no parallel agents or edits, protocol/schema/Core/Authority/Journal
   changes, external provider discovery, feature/Transit activation or new budget.

## Why Current Extensions Are Insufficient

Original public lower ports already express every required effect; no lower
interface needs expansion. Control's platform seam currently declares native
binding structs and constructs concrete defaults/fallbacks. Move those typed
native combinations into one public L2 package that imports no product module.
Control keeps its existing constructor validation, selection and compatibility
seam. Do not create another entrypoint/composition root or copy framework bodies.

Probe feature policy continues to select the same original constructor hierarchy
in the existing Control native compatibility seam, immediately after the original
Guard check. Its public product constructors remain the original producers; no
L2 package imports Probe or Control. Guard/Permit/current-instance ownership stays.

The native counter clock is a different original domain from Runner scheduling.
Injecting Runner effects.Schedule into this path would change existing semantics.
Instead the original Runner constructor privately binds platformruntime.Schedule
through the L2 native defaults; zero-value/package-local fixtures keep the same
native fallback. Every point samples Now().UTC() before checking EndedAt, including
terminal points. Selection/retention/loss/cursor/formatting stays with its old owner.

## Impact And Compatibility

Control Providers/Effects/LocalServices remain named public aliases with identical
field names, order and types, including platformobservation.Provider and concrete
TLS certificate/X509 pool/HTTP client specialization. No field, optional provider,
nil guard, positional constructor or operational method is added. Existing
New/NewWithProviders/NewWithEffects/NewWithLocalServices and private partial fixture
fallbacks preserve their current refusal order and original native provider types.

Canonical named structs now belong to agentplatform. Reflection/package-qualified
runtime type identity and tools expecting control as the declaring package change;
unknown reflective/generated/source-text consumers are not claimed compatible.
Ordinary source references continue through aliases; old import removal requires
actual consumer migration and matching-source acceptance. Private Runner layout
adds a scheduler field; no layout/reflection guarantee is made.

All native defaults are stateless struct literals. Binding/returning their groups
does not sample time, open a connection, read files, issue identity, allocate a
Probe dialer or authorize execution. Fallback field projection may construct the
other stateless values in that group; it adds no intended observable effect.
Probe's existing constructors still create the fresh dialer at the original branch
and preserve their resolver validation and inheritance sequence. No constructor
is cached or replaced with the Runner's injected effects.

## Migration And Version Plan

Introduce agentplatform.InterfaceVersion1 and canonical native group declarations,
then alias Control names and bind defaults/fallbacks. At original Runner assembly,
bind a native counter scheduler as a private field without reading it. Move the
old free counter helper into the existing compatibility seam; its core receives
the explicit scheduler, and both production capture call sites pass the Runner's
native counter provider. Move original Probe constructor selection into the same
existing seam; negotiation still calls it after Guard and before NewGate/counters.

Existing L0/L1, ADP/Probe/native driver/schema/DB/Journal/Authority/observationwire
versions remain unchanged. This changes no persisted state, ledger or history,
so it introduces no rollback/migration/reset operation. Aliases/fallbacks remain
until identified consumers and authorized negative/default/native cases pass.

## Acceptance And Known Limits

174: old/new aliases and field order/type identity, native defaults, nil/partial
providers, constructor failure/evaluation order, same current lower public imports
and no reverse product import. Record reflection distinction explicitly.
175: all four Probe mode precedence/constructor stages, failed resolver/fresh
dialer behavior, native scheduler/entropy/counter defaults and existing Gate ID,
NewGate/EnableCounters/defer-close/negotiation/authority checks.
176: current/terminal/unavailable/overflow counter point projection, unconditional
native Now before terminal selection, non-UTC EndedAt representation, both live
source and frozen tail call paths, original Runner injected scheduling versus
native point clock, fixture helper and no extra sample on field binding.

All planned/unexecuted. No source-stage tests, type/syntax/static/boundary checks,
formatters/generators/build/CI/native/network/MySQL experiments or Git writes.
Full A5/public/private/consumer/assets/candidate/example and independent physical,
long-run/recovery/release acceptance remain open. This source authorization opens
none of those gates and provides no physical-host evidence.

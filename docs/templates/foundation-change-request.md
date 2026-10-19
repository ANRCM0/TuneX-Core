# FR-NNNN: Foundation Change Title

Date: YYYY-MM-DD.
Status: proposed / authorized-under-standing-source-scope / implemented-unverified /
accepted-on-exact-source / rejected.
Owner and authorization: identify the source owner and applicable direct or standing
human authorization. Similar foundation source proposals use the 2026-10-19 standing
authorization to select the best design and proceed without repeated confirmation.

## Task Proposal

1. Layer(s): L0 / L1 / L2 / L3 and affected source owners.
2. Consumed public interfaces: exact entrypoints and versions.
3. Foundation impact: private-only / additive public / breaking public / persisted or wire change.
4. Added/changed contracts: signatures, semantics, errors and behavior before/after.
5. Test/acceptance method: planned cases, allowed environment and exact-source evidence.
6. Parallel impact: modules/branches affected, integration order and coordination.

## Why Current Extensions Are Insufficient

State the concrete need and why a module/adapter/public port cannot already express
it. For L0 changes, explain why the minimum shared semantics must change. Consider
an adapter-only/private change before expanding a public foundation contract.

## Impact And Compatibility

List all public consumers, type/import paths, wire schemas/versions, database
readers, Journal/authority and protected history affected. Identify behavioral
changes even if signatures compile. Define error, logging, configuration, resource,
deadline and cancellation effects. Unknown input must have an explicit refusal.

## Migration And Version Plan

Define new/old versions, overlap/aliases, migration order and removal conditions.
State how unknown command outcomes and accepted cleanup remain owned. Rollback
must preserve authenticated high-water and safety history; never reset it to make
an old reader work. Do not promise rollback where only forward recovery is safe.

## Acceptance And Known Limits

List contract vectors, owner transactions/CAS/replay, lifecycle/authority rejection,
platform differences, minimal public example and boundary analysis as applicable.
Record planned/authored/executed/passed separately and attach exact tested source
identity. Record outstanding integration/physical/long-run/release gates explicitly.

## Source Authorization And Acceptance Gate

Record this concrete proposal before public interface or semantic implementation.
For similar foundation source changes covered by the human's 2026-10-19 standing
authorization, choose the best design, record the impact/compatibility/migration
decision and proceed without asking for separate confirmation. Amend the record
when the chosen source scope changes. This authorization is not verification,
acceptance, commit/push, release or parallel-feature permission; those gates remain
independent. Preserve the original authority, ledger and protected history owners.

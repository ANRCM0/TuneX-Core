# FR-0023: Agent Synchronization Facts And Native Status

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner: Agent executiontime/platformclock/authorization. Recorded before source
implementation under the human's 2026-10-19 standing source authorization and
explicit parallel A5 instruction. Verification and release gates remain closed.

## Task Proposal

1. L1 executiontime decisions; L2 platformclock native status; authorization binding.
2. Consume existing Clock/Sample/Guard/Ticket and native proof/OS APIs.
3. Breaking L1 SyncStatus representation and source interpretation; no wire change.
4. executiontime interface2: tagless SyncStatus has time.Time ObservedAt plus
   ObservationValid and SourceAccepted facts; lower code knows no JSON tags,
   RFC3339 parser or Linux/Windows source spellings. platformclock interface2 owns
   the original native SyncStatus record and a pure SynchronizationFacts conversion.
   authorization.SyncStatus aliases that native record. Existing public native
   ValidateSynchronization/ReadProof/WriteProof/ReadSystemSynchronization remain.
5. Planned exact-source Actions: native JSON/HMAC/order/type and lower source/time
   conversion, malformed/unknown/host/source/refusal/cache/holdover/sample vectors.
   No verification executes during source development.
6. Isolated Agent slice; coordinator owns shared readiness/version inventory.

## Why Current Extensions Are Insufficient

L1 currently declares native JSON status and parses RFC3339 with fixed OS source
names. Merely deleting tags changes proof output while retaining source coupling.
Use the existing native platformclock owner for representation and source-name
recognition; supply parsed validity facts to the existing lower decision API.

## Impact And Compatibility

Public lower facts no longer support original native status composite literals or
direct JSON proof serialization. Custom lower Evidence sources must supply parsed
ObservedAt and explicit validity/source acceptance. Source() remains an opaque
source identity callback for the original equality check, without OS constants.
Canonical native type identity moves from executiontime to platformclock; native
field names/order/tags and source spellings remain exact. Old authorization names,
proof JSON/MAC, OS provider output and existing same-package test fixtures stay.
The conversion parses text without I/O, returns validity instead of an early error,
and does not normalize or reserialize native status. Pure text parsing now occurs
once when Evidence is projected, rather than once per cached lower validation;
there is no I/O, time sample or error return in that conversion. Lower rejection
remains after the second sample/host/source stages. Cache stores the projected status, preserving
the two-second uptime cache, 30-second freshness and 500-ppm uncertainty rules.
No clock read, sample count, proof/OS selection, Guard/Ticket/history change.

## Migration And Version Plan

Move exact native declaration into platformclock/synchronization_values.go; project
native Evidence in authorization only after provider completion. Direct native
ValidateSynchronization projects at its old entry. Preserve all provider errors
and their wrapping, then retain lower validation error text and stage. Keep native
aliases until actual consumer migration and frozen-source equivalence acceptance.
No persisted migration/reset, protocol version, key or database operation.

## Acceptance And Known Limits

Planned: exact native status/invalid timestamp/unknown source and proof bytes/MAC;
empty/zero/native time conversion; before/evidence/after/host/source/validate error
order and sample count; cache refresh/rollback/provider failures; fresh/future/
stale/holdover boundaries; Linux/Windows/unsupported defaults and old fixtures.
All unexecuted; source identity and physical-host gates remain separate.

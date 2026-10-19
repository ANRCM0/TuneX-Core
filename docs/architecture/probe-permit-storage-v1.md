# Probe Permit Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A1, preserving the existing permit authority and persisted history.

## Contracts And Owners

The framework public entry exports permit storage interface 1: detached permit,
input and result records, a parameterized transactional storage port and synchronous
owner value providers. Binding, context and challenge values remain generic at this
lower boundary. L1 imports no Probe product type, wire parser or database adapter.
The old ProbePermitStore name specializes this storage contract with the unchanged
product permit/result types; it does not create an issuer or a second budget.

MySqlProbePermitStore owns the original SQL, native JSON serialization, byte bounds,
row mapping and recovery statements. probePermitStorageValues owns the original
measurement/context relationship, validProbePermit call, frozen permit result and
version-specific result verification. These synchronous functions receive no
transaction, connection, authority, retry or network service. The decode function
is passed only to preserve lazy native JSON decoding at the original branch.

Control explicitly supplies the original value provider to the lower store. The
existing recovery composition uses the same lower static implementation. The old
MySqlProbePermits class retains its zero-argument/stateless/prototype methods,
subclass override points and static recovery entry, forwarding to one lower SQL
implementation. It is a precise compatibility binding, not a general exemption for
L2 to import L3. No SQL statement or product validator is copied into that wrapper.

## Preserved Source Intent

- The existing shared budget row is locked first. Permit and withdrawal scans keep
  their original ordering, LIMIT 257 and FOR UPDATE in the supplied transaction.
- Permit SQL retains the 2048-byte binding, 16384-byte TLS context and 512-byte
  challenge predicates and original invalid sentinels. Measurement/null relationships
  are checked before decoding. Context/challenge decode remains branch-dependent,
  binding decode remains after those fields, then validation and freezing occur.
- Clock CAS, prune predicates, issued-only insertion, closure and consumed-only
  withdrawal retain their statements, argument order, return/error behavior and
  absence of a new transaction or ownership cache.
- Result reads retain the locked 4096-byte SQL predicate and undefined-on-absence.
  Result writes retain the UTF-8 byte cap before product validation and before SQL.
  Body serialization and permitId/digest/time argument order remain unchanged.
- Result verification still checks echo v4 first, then services v3; v1/v2 are
  deliberately not revalidated here. The requestId-own-property rejection, temporary
  64-zero requestId, original parser/digest functions and original error mapping
  remain. No validation hardening is silently added during extraction.
- Recovery keeps two separate Date.now calls and statement order. Issued permits
  become quarantined; consumed permits gain withdrawal records using GREATEST. IDs,
  results, consumption and budget history are not cleared or refunded.

These are authored equivalence intentions, not executed evidence. The provider
objects are trusted composition inputs, not a user-configurable bypass or a new
grant boundary. The original ProbePermits application remains the sole issuance,
consume, offer/check, revoke/withdraw, replay and history owner. Existing feature
flags, staged echo status, wire/schema and Runtime/Agent authority remain unchanged.

## Planned Acceptance And Remaining Debt

Readiness item 50 covers exact generic specialization, legacy construction and
subclass behavior, SQL/lock/parameter equivalence, lazy decode/freeze/error order,
byte-bound/version-specific results, same-transaction rollback and recovery clock
behavior. Existing source-string boundary tooling still targets the historical
file; adapt it in the later authorized concentrated-verification phase. It was not
expanded or executed in this source phase.

No tests, type/syntax/static/boundary checks, formatter, generator, build, experiment,
CI, commit or push ran. Remaining Probe application/private/type/wire dependencies,
Path/Ingress/Transit, Agent/native/Runner and full repository classification remain
open. This completes one A1 source slice only; A1 and foundation acceptance and the
independent upper-module parallel gate remain unmet.

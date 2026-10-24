# Shared Payload Policy Public Example

FR-0032 public example, loaded by Node in the configured N Actions contracts job.
That check does not invoke the exported composition/configuration functions.
Exact source and job evidence are recorded in
[N verification](../../docs/testing/verification-status.md).
This example does not prove deployment or grant execution authority.
`main.ts` has no top-level side effects, database connection, socket, clock or
authority issuer. It imports only the resource-limit owner's public entrypoint
and framework public contracts.

Pass the original transaction boundary, Identity scope/owner provider, Node
authority store, Runtime Node locks, immutable Forward-owner reader and the
resource-limit store to `sharedPayloadOwners`. Keep their original transaction
type and lock ownership. The returned publication provider is suitable for the
required `RuntimeHostOptions.payloadPolicy`; the returned offline provider is
suitable for `TransitStagingOptions.payloadPolicy`. A composition root injects
these; product business modules must not import MySQL implementations.

`ControlApplication.resourceLimits` already supplies the production command and
publication owner, and the original Runtime/Transit constructors bind the real
policy. Do not instantiate a second Runtime ledger or replace the production
policy with an unlimited fake. The separate engine nil-gate constructors are
explicitly unmetered compatibility entries, not limited execution providers.

For a first monthly period, obtain the current view and supply its revision,
the authenticated governance actor, existing shared Node/subject grant, a fresh
request ID and explicit UTC dates such as 2026-11-01T00:00:00.000Z through
2026-12-01T00:00:00.000Z to `configureExplicitPeriod`. It requests 1048576 bytes/s,
65536-byte burst and 10737418240 bytes for that period. Repeat an unknown request
only with the original complete body and ID. A definite stale CAS requires a
new read and deliberate new command; a new ID is not an unknown-result retry.

All changes still pass original Identity, Node, transaction, audit and receipt
checks. The response is configured policy; consumption remains unavailable/null.
The actual Agent must advertise shared-resource-limits.v1. Private Nodes are
exempt; limited offline Transit is refused. Read the [specification](../../docs/spec/shared-resource-payload-limits-v1.md)
for conservative precharge, drain handling, period boundaries, history capacity,
old authority cutoffs and protected-state recovery. Example usability and
contracts require later authorized verification on the frozen source revision.

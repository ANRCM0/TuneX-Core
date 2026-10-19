# Transport Profile Owner

Public module interface 1, source candidate and unverified. Import public.ts for
TransportApi, TransportOwner<Tx>, grant/resolver contracts and TransportService.
HTTP uses the independent API, not a Pick of an implementation class. Old
Transport(db, identity, idempotency, forwarding) and transport-ports exports remain
compatibility bindings to the same owner; static recovery still deletes only the
original profile grants when its existing caller explicitly invokes it.

Composition supplies transaction/Scope/idempotency/Forward-reference contracts,
TransportProfileStore, RelayConfigurationCodec, clock and ID source. L3 retains
publication, grant, revision, read and response policy. Native closed Profile
parsing, digest/JSON/ID/counter/key handling remain L2; SQL stays in the L2 store.
The store never starts a transaction or retries a command.

publish retains owner -> idempotency -> ensure/current lock -> old revision/digest
-> changed revision write/current pointer -> initial owner grant -> response.
applyGrant joins the caller's transaction and locks original Forward references
before mutating grant authority; TransportGrantCommands still reconciles Runtime
effects before commit. Do not replace that atomic owner interaction with a queue
or nested transaction. resolve locks the authorized immutable revision reference,
not a silently chosen latest profile. Native compilation/registration is not
execution authorization. Original errors, SQL/locks, digests, no-op and aliases
require exact-source acceptance in foundation-readiness item 21, not yet executed.

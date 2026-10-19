# Idempotency Coordination

Interface 1, source candidate and unverified. IdempotencyHost implements the public
IdempotentRequests/IdempotencyService contracts with injected transaction-only
IdempotencyStore and StoredValues. Supply these through known composition; do not
construct a new connection, event queue, authority, retry or alternate request
ledger inside a business command. The old Idempotency() bridge keeps its original
ForwardAccepted default response generic; lower code has no Forward command type
or product response dependency.

claim retains ensure -> FOR UPDATE -> recovery invalidated rejection -> digest
conflict -> completed response decode or pending undefined. The scope/actor/key
snapshot stays stable across awaits exactly as before; digest comparison still
uses the request at its original point. respond reads status, encodes body, then
reads the request key for the update. Stored JSON decode is lazy; invalidated or
conflicting histories must reject before attempting response parsing.

All writes and locks join the caller's original transaction, including intent,
operation, resource and audit effects. Recovery only marks existing requests
invalidated when explicitly invoked; it never deletes or resets protected history.
No policy is added for absent locked rows, new statuses, replay retries or future
schemas. Default/injected/codec/SQL/error/alias acceptance is planned in readiness
item 22, unexecuted. This source document does not establish accepted semantics.

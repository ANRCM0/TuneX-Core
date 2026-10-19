# Transit Negotiation Owner And Machine Read Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original contract-only negotiation; not live Transit execution.

## Public Chain And Ownership

The existing HTTP route retains input parsing, mTLS identity mapping and request
lifecycle. The API consumes the public TransitNegotiationApi. Control explicitly
assembles TransitNegotiationService with the original transaction boundary and
MySqlTransitMachineReader. The service receives a required reader, never a hidden
SQL/default fallback. TransitDeliveryApi retains the exact original preview-only
methods and wire types through the same public entry; delivery implementation
extraction remains open. Old transit-api-contract.ts exports directly alias it.

The original hello order remains: Node/session/counter -> fingerprint -> caller
transaction -> locked machine row -> current session/boot -> one dynamic time
sample -> credential checks -> stored JSON decode -> advertised capabilities ->
retained-generation refusal -> response projection. L3 retains these decisions
and the original error messages/statuses and short-circuit credential order.
The current ADP/3 Hello and credential owners remain authoritative.

L1 MachineSessionLockReader and LockedMachineSession describe the original raw
lock-bound evidence, including number/null flags, deadlines and opaque facts. L2
retains the original query, argument order, LEFT JOIN and FOR UPDATE. It returns
missing undefined without eager JSON decode, filtering or null/boolean conversion.
The existing Probe reader is deliberately not substituted: it uses FOR SHARE and
normalizes/decodes earlier, which would change locking and refusal/error order.

readStoredValue is the same implementation formerly exported by mysql.json. Its
call remains after credential checks, so malformed facts must not outrank session
or credential refusal. Native wall-clock access remains dynamic at the old point,
not captured during construction. The capability tuple is the original same array
identity and is not copied/frozen by this slice. The L2 formatter receives node,
boot, epoch and sampled time; original response key order, UTC conversion, mutable
object behavior and lack of a new parser/freeze pass remain. It reads no clock or
state and always returns contract-only / executionEnabled:false.

## Compatibility And Remaining Work

TransitNegotiator retains its one-argument construction, original db field and
public async prototype hello method. A lazy transaction bridge keeps db lookup
after the original input refusals. Its method delegates to the one product
implementation and original SQL reader with no I/O during construction, copied
query or alternative authority. The production Control property now names the
public API rather than a concrete class; no public method is removed. Legacy
removal requires caller inventory and accepted evidence on the same frozen source.

Staging/preparation/reservations, offline coordination and delivery remain explicit
mixed owners, not blanket exceptions. Their current full chain remains: staged
Forward authorization and physical reservation -> immutable preparation -> offline
journal step and authenticated proof boundary -> preview outbox -> current-machine
poll/report -> received ACK. The transport ACK does not call confirm, advance the
offline journal, issue a lease or acknowledge listener readiness. The retained
nonzero generation refusal is not reconciliation and must not erase Agent history.

Readiness item 62 is planned only. Later source work must preserve the staging/
coordination/port lock order, deadlines, digest/CAS, recovery and explicit cleanup
refusals, one Runtime ledger and original Agent authority/Journal. No schema,
protocol, feature, issuer, automatic stage, execution, history reset or new pool/
transaction is added. No checks/tests/builds/experiments/CI/commits/pushes/delegation
ran. A1 residuals, remaining A2, A3-A5 and all later acceptance gates stay open.

Follow-up: the original preview delivery extraction is now authored, unverified;
see [delivery boundary](transit-delivery-owner-v1.md) and readiness item 63.
Other Transit storage/coordination and all acceptance gates remain open.

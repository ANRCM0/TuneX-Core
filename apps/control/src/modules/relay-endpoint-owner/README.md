# Relay Endpoint Owner

Public module interface 1, source candidate and unverified. Import public.ts for
RelayEndpointApi, RelayEndpointOwner<Tx>, resolver/value contracts and the service.
Old RelayEndpoints construction and endpoint parser/type paths remain compatible
bindings. Parsing still uses the same native codec; no endpoint schema/platform or
protocol support is added by this extraction.

Composition supplies transaction/Scope/idempotency, Node-owned management/read/
audit, Forward reference, storage, codec and clock contracts. The product owner
retains owner/idempotency -> Node management/revocation -> endpoint lock/revision
-> changed digest -> live Relay refusal -> write -> Node audit -> response. All
participants use the original transaction. Node writes its own security event;
this owner only writes node_relay_endpoints through its L2 store.

An unchanged endpoint bypasses the live-reference/write/audit branch exactly as
before; a changed active endpoint still refuses instead of inventing withdrawal.
get retains Scope -> Node cleanup facts -> shared endpoint read and still reports
executionSupported false. Source extraction does not turn that view into execution
support or authority. The original caller owns Runtime, leases and Journal.
No acceptance has run; foundation-readiness item 21 records the required traces,
refusal, rollback, digest/format and old/new contract cases.

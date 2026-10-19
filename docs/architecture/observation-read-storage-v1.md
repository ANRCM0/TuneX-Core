# Observation Metadata And Audit Storage V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

L1 framework/public.ts exports observation-read-store-ports.ts interface 1:
parameterized metadata config/audit values and supplied-transaction storage, plus
untrusted audit columns, query/policy and synchronous per-row projection. It owns
no product config, trust root, audit vocabulary, event store or execution policy.

L2 MySqlObservationServiceStore keeps original metadata SQL/JSON/numeric/digest/
locking/limits. L3 observationServiceStorageValues supplies the original kind
predicate and config type projection. That projection intentionally adds no full
config/trust validation: the old storage code asserted the decoded object, and
application validation must remain at its original point. Native 16KiB/object/
digest checks and immutable revision/head/archive/recovery semantics stay put.

L2 MySqlAuditReadStore keeps original fifteen-family SQL/joins/whitelisted columns,
native counters/flags, binary filtering/order, keyset window and scope attribution.
L3 AuditReadModels supplies original source/error-code policy and the old product
type assertion. Native rows explicitly remain untrusted; the original closed
AuditEvents.row validator is unchanged and still rejects invalid business data.
Projection executes synchronously inside the original map after numeric/flag
conversion, without another await, raw owner JSON, connection or retry.

Audit policy holds the original arrays by reference, shallow-freezing only its
new holder. Their identity/runtime mutability and per-query code interpretation
are not silently changed. The native mapping still refuses unsupported sources;
injecting a name cannot create a new table/source or authority.

Existing server/control/recovery roots bind lower stores and owner values directly.
Old MySqlAuditEvents and MySqlObservationServices remain zero-argument stateless
public wrappers; metadata head/count override points and static recovery entry
remain. Those are precise compatibility bindings, not whole-file exemptions or
new composition roots. Metadata declarations/availability are not ownership,
liveness, reachability, health or execution permission. No Probe/echo/default,
schema, issuer, sender, worker or protected-history behavior is added.

Readiness item 37 covers exact-source types/old constructors/overrides/static/root
wiring, SQL/args/locks/parse/digest/projection/error timing, all audit source/query/
attribution/cursor/coverage rules, metadata quota/revision/archive/audit/recovery
and original authorization/Probe binding. Other diagnostic/station SQL and mixed
native value/type dependencies remain debt. No checks/tests/format/build/scripts/
MySQL/network/CI/Git ran. All foundation/parallel acceptance remains unmet.

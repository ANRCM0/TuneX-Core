# Notification Storage Boundary V1

Date: 2026-10-18. Source candidate; unverified and not accepted.

## Layers And Public Entries

| Layer | Entry | Scope |
| --- | --- | --- |
| L1 | framework/public.ts / notification-store-ports.ts | Parameterized endpoint/outbox storage envelopes, supplied-transaction stores and synchronous value-validation callbacks; interface 1 |
| L2 | infrastructure/mysql-notification-endpoint-store.ts | Original endpoint/scope/event SQL, native numeric/JSON mapping and integrity errors |
| L2 | infrastructure/mysql-notification-outbox-store.ts | Original delivery/scope/attempt/rate SQL, native numeric/JSON mapping, immutable comparison and conditional writes |
| L3 | modules/notification-ports.ts / notification-delivery-ports.ts | Original product configurations, payloads, state/code/outcome vocabularies and specialized public contracts |
| L3 | application/notification-endpoint-storage-values.ts / notification-outbox-storage-values.ts | Separate frozen bindings to the original owner parsers |
| Existing composition | server.ts | Explicit typed stores plus each owner's values, same observation transaction/pool/services |

The L1 envelopes describe persistence fields, not notification business decisions.
Config/payload and suspension/status/code/outcome are type parameters, not copied
alert rules, destination/credential interpretation or new dispatch/retry policy.
Existing product interface names extend the exact specializations and keep their
field types, optional/null distinctions and method signatures. No Core, schema,
HTTP/notification wire, feature or package version changes here.

## SQL And Value Callbacks

Each L2 source has one copy of its original SQL implementation, importing only
public lower contracts/Core and SQL helpers. It does not import an application
parser, product module DTO or concrete service. Root composition supplies the
original parser functions through synchronous typed callback ports. Executing an
outer provider does not create a reverse source/type dependency.

Callbacks run at the original native row/value decode points, without await,
retention, I/O or retry. Native integer/boolean/JSON-size and scope checks, closed
product reconstruction, parse exception-to-INTEGRITY_FAILURE mapping, JSON order
and immutable comparison stay in their original sequence in source intent. Keep
the supplied transaction; adapters open no pool, transaction or worker and write
only their existing owner tables. Endpoint and outbox value bindings are separate
so importing one old family does not newly initialize the other's parser graph.

Endpoint locks, 16-identity quota, 128-event eviction/loss accounting and selected
fields/order remain unchanged in intent. Outbox duplicate/immutable checks,
terminal-only expiry/eviction, 1024-row quota/rejection, 256-attempt tail, 16 endpoint
rate rows, exact revision/fence predicates, header deferral, share/update locks,
keyset history and loss counters also retain their original SQL/argument order.
There is no new outbox, source-event write, alternate secret store or authority.

## Legacy Compatibility

Existing MySqlNotificationEndpoints and MySqlNotificationDeliveries remain
zero-argument, stateless public prototype wrappers over the one lower
implementation. They are precise existing compatibility bindings, not new whole
composition-root exemptions. Production does not use these reverse-import paths.

The old endpoint put call can still dispatch through an overridden public count,
and outbox put through an overridden public get, at their original transaction
points. The lower putUsingCount/putUsingCurrent hooks exist only to preserve those
legacy calls; ordinary storage ports expose neither hook, nor another owner's
tables. They are not a precedent for a business module to override authority or
bypass owner transactions. No request/claim/counter/provider mutable state moves
to the wrappers; their module-level typed bindings perform no I/O on construction.

## Remaining Work And Acceptance

Original NotificationEndpoints/Deliveries services, station-event handoff, vault
stage/pin, HTTPS sender, claim/fence/preflight, current authorization, attempts,
uncertainty, rate, workers and HTTP remain untouched. Product value files still
contain mixed native format/time/crypto dependencies; vault/sender and other
observability SQL owners still need source separation/classification. The old
compatibility imports remain precisely recorded, not certified as pure L2.

Readiness item 35 requires exact-source type/alias/constructor/override/substitution
and initialization cases, original SQL/args/lock/codec/error/rollback/retention/
loss/duplicate/CAS/rate/history order, root wiring and real MySQL/notification
regressions. Functional evidence belongs in authorized Actions. No checks/tests/
format/build/database/network/CI or Git operation ran for this extraction. All
behavioral equivalence and foundation/parallel acceptance remain unmet.

## Public Product And Effect Owners Follow-Up (2026-10-19)

Endpoint/outbox classes, contracts, parsers/projections/policies and storage values
now live in notification-owner/public.ts. Station rules and the original supplied-Tx
handoff live in station-alert-owner/public.ts. Original Vault/Sender interfaces now
live in L1; existing native implementations import them without product references.
No native or lower SQL body changes. The old application/flat paths directly alias
canonical leaves, retaining separate parser/provider graphs and original count/get
hooks. See [owner chains](station-notification-owners-v1.md), readiness70-72 entirely
unexecuted. Earlier remaining-work statements describe their historical source
slice; full behavioral/native/foundation acceptance still remains open.
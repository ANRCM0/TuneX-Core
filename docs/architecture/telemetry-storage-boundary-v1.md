# Telemetry Storage Boundary V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

L1 framework/public.ts exports telemetry storage and rollup storage interface 1.
Raw Node/Host heads/points, mapped Forward/Probe records, accepted-point/mapping
envelopes and read-only provenance ports parameterize outer samples/identities.
They import no observability/runtime wire or L3 product types. Source/instance and
family/resolution labels describe existing stored metadata; they grant no authority.
Rollup contracts contain only persistence identity/window/limits and opaque
parameterized observation/bucket values. Series schemas, metric vocabulary,
quality/coverage arithmetic and full validation remain L3.

Existing Node/Host/Forward/Probe module and Runtime mapping type names specialize
those lower contracts with their original wire types. Their classes, constructor
shapes, method signatures and callers stay in place. The six L2 native raw stores/
mapping adapters now import lower contracts directly rather than upper modules;
their runtime method bodies, SQL and wire decoders are retained. Native exporter
type projections remain local to L2. No new wrappers, callbacks or pool are added
for those six adapters. The original two-slot, nonqueued observation database,
1500ms deadline, authority guard, rollback/release/close sequence and errors remain
with MySqlTelemetryDatabase. It does not borrow the Runtime pool.

Native provenance still validates the original immutable published Snapshot or
retirement/lease context. Forward ingress/driver/config/scope/identity projections
and Probe direct-TCP/active Snapshot/binding/current-instance checks stay in their
L2 adapters. Provenance neither creates a permit nor proves execution, reachability,
health or ownership. No current/retired/instance fallback or execution capability
is added by the generic contracts.

L2 MySqlTelemetryRollupStorage holds the original aggregate SQL once. Its explicit
value provider supplies original observation/bucket parsers, fold function and
the same TELEMETRY_ROLLUP_LIMITS object. The shallow-frozen L3 binding retains those
function/object identities, not copies or alternate rules. Callbacks are trusted,
synchronous, no-I/O and unretained beyond their binding references; they receive
no transaction or permission. No incomplete-provider fallback is supplied.

Append still parses input before the original scope lock; stored cursor/bucket
parsers execute after native JSON/size conversion in their original corruption
wrappers. Fold runs inside the same loop after prior-cursor/row selection and
quota/eviction work, with the same previous/current values and minute/hour order.
Native size/digest/cross-column checks, SQL predicates/args/locking/retention,
row limits, loss markers, monotone recovery suspension, keyset queries and pruning
remain in source intent. Storage does not implement a second fold/receipt policy.

Old MySqlTelemetryRollups remains a stateless zero-argument public method wrapper
over one lower implementation. Existing server composition binds the lower store
to the original L3 values and shares that instance for all enabled raw recorders
and rollup queries. Aggregate writes remain inside each original accepted-raw
transaction. There is no new transaction, pool, retry, worker, schema/migration,
authority/Journal/ledger owner, feature/echo/default change or history reset.

Readiness item 39 covers exact-source type/constructor/prototype/async/initialization
compatibility, all original raw/mapping/rollup SQL and receipt/atomicity behavior,
callback/limit identity and timing, and source direction. No check, type/syntax/
boundary run, test, formatter, generator, build, script, database/network/browser/
container experiment, CI or Git/commit/push ran. Classifying this named storage
scope does not accept all application/value/HTTP/Agent or unlisted repository
dependencies. Full foundation acceptance and the parallel gate remain unmet.

## Public Telemetry Product Follow-Up (2026-10-19)

Original Node/Host/Forward/Probe and aggregate query implementations now live in
a public telemetry module with separate unchanged service state/budgets/providers.
Actual product record/API/policy/observation/fold callbacks move with them; lower
raw/mapping/aggregate SQL/database source is unchanged. Old paths are precise leaf
aliases, and original server/HTTP/wrapper roots use public contracts. L2 formats
the original four ACKs and provides exact wire type aliases; L3 retains count and
state decisions. See [owner chains](telemetry-public-owners-v1.md), readiness75-77
unexecuted. Source separation does not establish full import compliance, precise
arithmetic/transaction equivalence, native support, health or foundation acceptance.
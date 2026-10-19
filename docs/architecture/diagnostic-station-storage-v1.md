# Forward Diagnostic And Station Storage V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

L1 framework/public.ts exports diagnostic detached read records/ports and
parameterized station policy/audit/event envelopes, synchronous value projections,
supplied-transaction storage and passive fact ports, each interface version 1.
Diagnostic target endpoints reuse Core's public readonly TargetEndpoint; native
driver IDs, SQL/JSON paths and format interpretation stay L2. Station product
rules, thresholds, state transitions, reasons and configuration schemas stay L3.
Existing modules retain their original public type names through these contracts.
No new execution, authorization, authority or state owner is introduced.

L2 MySqlForwardDiagnosticReadStore holds the original SELECT-only diagnostic
implementation once. Scope/node bounds, JSON caps, closed SQL projections, native
driver/link projections, assignment identities and report joins, invalid snapshot/
report markers, optional Probe trust context, ordering and truncation stay there.
It uses no product class/parser/type imports or Runtime methods. Detached facts are
not health, connectivity or permission, and compact public DTO conversion remains
with the original diagnostic application. Stored trust context stays internal.

L2 MySqlStationAlertStorage keeps original four-table station SQL, limits, locks,
conditional deferral, retention/loss accounting and acknowledgement CAS. Its
native row mapper keeps the same JSON object/byte/numeric/ID/flag handling and
event-body rule/target consistency check. L3 stationAlertStorageValues performs
only the original type assertions after those mappings. It deliberately does not
run full policy/event/config/state validators earlier; StationAlerts still runs
them at its original business points. Mutable acknowledgement/restore columns
continue to override immutable event-body values. Values are synchronous, with
no I/O, clock, retry or retained transaction/result references.

L2 MySqlStationAlertFactStore keeps the old Forward/Operation/Node/report/snapshot
SELECT projections and consistency checks. L3 stationAlertFactValues retains the
original module-initialized error-code Set and null/OTHER_ERROR mapping. Only the
holder is shallow frozen. The callback executes at the old field mapping point;
target selection still checks the same IDs and uses the original non-Forward
Node branch. No alert threshold/evaluation is moved to SQL, no raw report/snapshot
is returned and no resource lock, owner-table write or execution connection is added.
Original native helpers live once in station-alert-storage-native.ts as a private
L2 implementation dependency, not a product API or second policy implementation.

Existing server composition binds the new stores and original product values on
the same observation host and transaction paths. Notification routing and station
evaluation share the same original stationStore instance. Old MySqlForwardDiagnostics,
MySqlStationAlertStore and MySqlStationAlertFacts remain stateless zero-argument
public method wrappers. Station putPolicy preserves the public policyCount
override at the original post-existing-row-query point through a precise lower
compatibility hook, outside the L1 business storage contract. No new composition
root, pool, transaction, worker, migration or protected-history reset is added.

Readiness item 38 is planned only: exact-source type/constructor/prototype/
initialization/async/override/root compatibility, diagnostic SQL/projection and
station SQL/retention/facts/error/validation ordering, and original authorization,
notification handoff and recovery behavior need acceptance. The two old storage
files are now precise bridges rather than blanket mixed-adapter exemptions;
other mixed applications, value/native helpers, telemetry/owner SQL, HTTP, Agent
and whole-repository classification remain open. No checks/tests/type/syntax/
boundary/format/generators/build/scripts/MySQL/network/browser/CI/Git/commit/push
ran. Full-source closure, foundation acceptance and parallel development remain unmet.

## Diagnostic Product Owner Follow-Up (2026-10-19)

Original compact diagnostics and same-read support projection now live under
forward-diagnostic-owner/public.ts. SELECT-only lower storage is unchanged and
still consumes no L3 types. Original audit product/read projection also has an
independent public owner over the same lower SQL. See
[owner chains](passive-diagnostic-audit-owners-v1.md); readiness68/69 unexecuted.
Station storage/rules remain their own source task and are not accepted here.
## Public Station Follow-Up (2026-10-19)

Original Station rules/service/API/storage-value assertions now live under
station-alert-owner/public.ts. It owns the same event handoff consumed by public
Notification, retaining append/enqueue/policy update in one Tx and original failure
deferral. Lower storage/fact SQL is unchanged and still receives original provider
callbacks. See [owner chains](station-notification-owners-v1.md), readiness70-72
unexecuted. This is source separation, not functional/native/foundation acceptance.
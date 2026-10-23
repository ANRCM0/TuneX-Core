# FR-0037: Shared Resource Limit Station Alerts

Date: 2026-10-24. Status: authorized-under-standing-source-scope; unverified.
Authorization: P implementation and 2026-10-19 standing source scope.

1. L3 resource-limit observation and original Station evaluation/event/outbox;
   L2 native migration/SQL and existing alert/notification Web representations.
2. Original SharedResourceLimits, ResourceUsageReader, StationAlertFacts/Storage,
   Identity owner authorization and same-transaction StationEventHandoff.
3. Add schema-version-2 Station configuration and two rule enum members in 0044.
   Preserve L0, Runtime/Agent authority, Journal, history and admission semantics.
4. `shared-usage-high` uses an explicit subjectActorId and thresholdPercent;
   `shared-period-ending` uses subjectActorId and thresholdSeconds. Target remains
   a scoped shared node. New reader joins caller's transaction and rechecks owner,
   subject membership and grant. Unknown/stale consumption never fires or recovers
   a usage alert. Explicit configured period expiry can be observed independently.
5. Author parser, numeric bounds, stale/unknown, future policies, new period,
   threshold/expiry, duplicate episodes, revoked access, rollback and outbox cases.
   All exact-source and MySQL/browser execution is separately gated/unexecuted.
6. Serial integration into existing Station worker, event/outbox transaction,
   notification payload validation, Web and upgrade catalog/profile consumers.

## Semantics And Migration

Schema v1 and its three original rules keep their field shape and semantics.
Schema v2 has the original fields plus subjectActorId and thresholdPercent; use
null percent for period-ending and zero seconds for usage-high. Percentage is
1..100; expiry seconds are 60..604800. Current/latest started policy is selected
from retained history, not a future head. A missing grant or policy is unknown.
No automatic renewal, money accounting, switching, retries or policy mutation.

Usage compares exact decimal counters against the configured byte limit using
integer arithmetic; precharge is not delivered bytes. Period-ending derives from
the configured period and may fire when usage is unknown. A new bucket invalidates
the prior episode rather than proving recovery. Expired current period remains
firing until an explicit successor applies; changing a future head alone cannot
clear it. Scope governance sees the existing event; no raw account credential or
payload is included in notifications. Original event/outbox dedup stays atomic.

Add an optional supplied-actor argument to the L3 fact contract; old private/native
fact readers continue serving v1. Production uses StationResourceFacts with the
original fact adapter and public ResourceLimitAlertReader. New resource reader
requires the managing actor and validates original owner authorization itself.
No cross-owner table writes or nested transactions. Station API3/module2,
resource-limit module3 and UpgradeAssessment8 reflect the successor. Migration
0044 expands only the Station event rule enum; add a Control-only resource-alerts
profile and preserve every older migration ceiling/Agent profile. Old readers
must refuse unknown schema/rule instead of silently interpreting it as a v1 rule.

New alert/source availability is not quality/physical/load acceptance. FR-0040
separately adds a recent controlled path sample condition with original history
and current-issuer/path revalidation; it is not inferred from quota or node reports.

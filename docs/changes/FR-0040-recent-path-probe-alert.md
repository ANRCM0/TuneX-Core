# FR-0040: Recent Controlled Path Sample Condition

Date: 2026-10-24. Authorized under the P source task and standing source change
scope. Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.

Layers: L3 Probe history read service and Station condition; L2 SQL enum, native
composition and browser representation. Consume original ProbeRunStore,
ResourceReadAccess, ProbePermitPlans and Station event/handoff contracts. No L0
change, Runtime write, new Probe issuer, collector or competing observation store.

Add a public same-transaction `ProbePathObservations.readIn` contract. It reads
at most 26 recent Forward history rows through the original principal, selects
the latest matching path measurement, refuses missing/withdrawn/quarantined/
recovery-suspended results, and reauthorizes its original issuing actor through
the original Probe planner. Require the same complete current binding and exact
current registered service context. Permission/lifecycle loss yields unavailable;
corrupt stored input or storage failures remain errors. No nested transaction.

Station schema3 `recent-path-probe-degraded` targets a Forward and one TCP/UDP
path measurement, with an explicit 30..300 second maximum recorded sample age
and 1..2000 ms elapsed threshold. It describes the latest recent accepted sample,
not current execution authority, external reachability, availability, loss rate
or aggregate SLO. Original result validUntil stays recorded and is never extended;
the alert evaluates historical sample outcome under its separately named age
window. Negative accepted outcomes or a slower signed Echo fire the condition.
Missing/stale/changed-route samples remain unknown, not healthy or zero latency.
Recovery requires a different, newer accepted successful sample at the same
binding. A new binding invalidates the old incident instead of proving recovery.

Migration0046 expands only original Station rule enum. Old config1/config2
remain unchanged. UpgradeAssessment10 adds Control-only path-sample-alert profile
ceiling46; Agent profiles/Journal unchanged. Station API4/module3 and Probe history
module3 expose the new additive source contracts. Native composition explicitly
binds the original locking planner/store. Closed old clients must upgrade before
consuming schema3, and old schema readers refuse the new migration footprint.

Planned cases: original transaction/principal/issuer, bounded selection, newest
missing sample versus older success, wrong service/binding/revocation, clock and
age boundaries, exact threshold, no recovery from stale/identical samples, new
binding invalidation, original event/handoff rollback, closed Web fields and no
POST/network side effect from reading/evaluating. Real SQL/network/browser and
physical acceptance remain separately unexecuted. No parallel work is started.

## Verification Update - 2026-10-24

The current [P verification record](../development/product-verification-p-2026-10-24.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.

# Telemetry Public Owners v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2 twenty-first through twenty-fifth source slices. No new sampling,
aggregation, scheduling or execution capability.

## Public Entry And Independent Services

modules/telemetry-owner/public.ts exposes the original five service classes,
their exact existing shared API, policy objects, record/read/mapping/recorder
contracts and rollup rules/provider. Each class keeps its original constructor,
private counters/maps/keys, feature flag and methods. A common source entry does
not share or replace admission state, family tables, epochs or authority.

| Service | Original state and providers | Original coordination |
| --- | --- | --- |
| NodeTelemetry | Process sample head/raw store, machine credential and Scope, optional rollup recorder | Original Node/session/epoch/sample sequence/digest/time decisions |
| HostTelemetry | Separate host sample head/raw store and its independent admission | Original platform availability/CPU-context/precise tick delta decisions |
| ForwardTelemetry | Separate mapped head/raw store and read-only published Forward mapping | Original accepted/rejected point accounting, driver/assignment identity and payload deltas |
| ProbeTelemetry | Separate mapped head/raw store and read-only published Probe mapping | Original instance/binding/availability/in-flight and attempt accounting |
| TelemetryRollups | Original aggregate store/facts/targets and separate read admission | Original family-specific observation/fold/quality/coverage, history and capacity |

L1 transaction/Scope/raw/mapped/rollup storage contracts are unchanged. Existing
L2 SQL, mapping and MySqlTelemetryDatabase implementations are unchanged. Server
still constructs the same five instances on the original observation database,
same enabled flags, original stores/mappers, target callbacks and optional recorder.
No new pool, connection queue, retry, table, worker or Runtime/resource operation.

## Types, Mappings And L2 ACK Projection

Original product record and mapping interfaces move from flat/runtime paths into
canonical telemetry contract files. They still specialize the exact lower raw
envelopes and read-only mapping ports; a published provenance is not new execution
or permit authorization. Native providers continue consuming L1 interfaces only.
Original wire sample/ACK/identity types now come through public L2 aliases to the
same contracts, without copied schemas, widened optional fields or new versions.

compatibility/native-telemetry-acks.ts owns the original four ACK field projections
and strict parser calls. It receives the original parsed sample and supplied time,
never reads a clock or examines state. Node/Host retain their stored-before-time
field order; mapped Forward/Probe retain time-before-stored/count order. L3 private
ack methods remain at their original dispatch points. Forward/Probe still check
accepted+rejected against the original item count BEFORE the L2 projection; no
storage, mapping or count policy moves into a formatter.

## Raw Intake And Query Semantics

Each ingest keeps disabled refusal, its own original parser/fingerprint checks,
digest and per-key admission, followed by the same transaction: machine credential,
current Node/session/credential/boot, clock-skew, head lock/validation, epoch/session
ownership, exact replay, monotonic sequence/uptime and rate decisions. Duplicate
latest samples return the same original receipt time/counts and do not append or
record rollups. The small original Node-versus-other-family input guard differences
are not normalized in this extraction.

Mapped intake retains distinct Forward versus Probe resolve signatures and
provenance/source/instance checks, original item order, age/recovery filtering and
accepted-point freezing. The original raw append precedes optional rollup append
in the SAME Tx, then ACK projection; a later callback/parser/storage failure must
roll back original writes together. No mapper issues/renews execution or a permit.

Queries retain original wall-clock/cooldown/admission timing, Scope/Node/Forward
identity and visibility, retained windows, record/latest query ordering, item/epoch/
series uniqueness, digest/framing/byte checks and current-credential/session versus
historical distinctions. Scope association is not bypassed by a shared source
module. Observed-at sampling and original freshness/disabled/recovery flags remain
unchanged in source intent. Reads/prune never dispatch network probes or commands.

All uint64 values and deltas keep strings/BigInt. Baseline, historical, unavailable,
overflowed, terminal, counter reset, gap and continuous precedence stays specific
to the original family. Host CPU requires the original availability/logical-CPU
context and tick consistency; absent values remain absent/null. Forward bytes and
Probe attempted/succeeded/failed/unknown/inFlight retain different meanings, with
the original before-in-flight projection. Export drops, tails, truncation, epoch/
instance changes and prior terminal data never silently become continuous rates.

## Aggregate Rules, Storage Values And Reads

The single original rollup-values implementation moves with the product owner.
It still consumes public L2 identity/uint64/digest/time/JSON primitives; it does not
enter L0 or become a second metric authority. Process/host/forward/probe builders
retain original metric membership, paired availability, null omission, gauges,
cumulative counters, sampled receipt/capture times, series identity and size/freeze.
Probe counter conservation and Host CPU/availability consistency stay unchanged.

Fold preserves original closed bucket/observation validation and receipt-end
minute/hour attribution, series/context, counter regression and quality precedence,
export/tail/truncation markers, exact wide sums/min/max/counts, cumulative values,
and increment/coverage intervals. A sample count is not substituted for an interval
denominator; missing metrics do not become zero or proof of completeness. Host CPU
context changes still remove those deltas using the original rules. Boundary
interval accounting, recovery flags, overflow/bounds, JSON clone and freezing are
not changed by moving files.

telemetryRollupStorageValues is the same shallow-frozen original limit/parser/fold
provider. Lower MySqlTelemetryRollupStorage still owns its original SQL/locking/
cursor/bucket/retention/loss behavior and invokes those callbacks at original
points. Its legacy zero-argument wrapper keeps its original module-local provider.

Rollup query/capacity keep original target-family/resolution/aligned UTC bounds,
cursor canonicalization and series/Node restriction, admission, Scope/target read,
strict row ordering and bucket validation, retention/loss, bytes/quality and logical
capacity budgets. Current health/authorization are not inferred. Capacity continues
to distinguish logical JSON bounds from unmeasured physical bytes and a missing
Scope raw hard cap. No load optimization or new scheduling mechanism is introduced.

## Compatibility And Evidence

Old application classes/API/provider, flat records/mappings/policy/value paths
directly export their canonical leaves. Type-only/constants-only paths do not
import a service root or widen the old exported surface. Original class identity,
methods, default clock capture and per-instance state are preserved in source
intent. Existing HTTP/query/server and legacy rollup-wrapper consumers use the
public entry, with no new composition root or change to constructed instances.
Remove aliases only after consumer inventory, same-revision acceptance and a
separately confirmed compatibility-removal task.

Readiness75-77 is planned only: raw Node/Host, mapped Forward/Probe and aggregate
state/type/API/alias/ACK/clock/transaction/delta/fold/query/native-provider cases.
No tests/type/syntax/static/boundary checks, formatter/generator/build, native/
network/MySQL/browser/container experiment, CI, commit/push or delegation ran.
Later functional/MySQL evidence belongs in authorized Actions on the same frozen
source; physical-host/load/release gates remain independent and unverified.

A1 Probe application coordination, ObservationServices and other application/HTTP/
private dependencies, Agent Probe/native, Runner and full source/type/default/
bridge classification remain open. This source move does not prove full A2 closure,
native/wire equivalence, foundation acceptance, health or an upper-module gate.

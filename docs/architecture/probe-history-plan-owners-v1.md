# Probe History And Finite Plan Owners v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2 nineteenth/twentieth source slices and the original consumed Probe
command API declaration. No new issuer, scheduler semantics or product Probe kind.

## Public Call Chains

| Public entry | Original rules and coordination | Required providers | State owner |
| --- | --- | --- | --- |
| probe-history-owner/public.ts | ProbeRunHistoryRecorder, ProbeRuns, historical permit/result/lifecycle validators, DTOs and limits | L1 supplied-Tx history storage/transaction/Scope, public Probe binding/measurement and L2 codecs | Original bounded history tables/losses only; original permit owner calls recordIn |
| probe-plan-owner/public.ts | ProbePlans, finite config/head/receipt/decision validators, APIs/limits/storage callbacks | L1 plan storage/Scope/idempotency/transaction, original supplied-Tx ProbePlanIssuer, public Probe/Observation contracts and L2 codecs | Original finite intent/decision tables; issuer remains the original permit authority |
| probe-owner/public.ts | Original ForwardProbePlanApi, ForwardProbeApi and acceptance declarations | Same original binding, inspection/revocation and public L2 selection types | No implementation/state change; original API declarations moved from application/forward-probe-api.ts |
| compatibility/public.ts | Existing service-selection parser plus original retained echo invocation formatter | Existing native wire/value helpers and supplied retained facts | No I/O, clock sample, current context resolution, admission or authority |

Actual services, validators, type contracts, APIs, policies and storage-value
providers move into the two product directories. They are not copies or aliases
over a still-mixed implementation. Lower MySqlProbeHistoryStore/MySqlProbePlanStore
and L1 storage contracts are unchanged. The same existing Control/server roots
bind the same recorder, issuer callbacks, SQL providers and feature flags.

## Historical Capture And Read Boundaries

Only the original permit owner invokes recordIn after its actual accepted
mutation, using the same Tx. The recorder validates capture kind/time/permit/result
at its original points, then locks the history Scope/head. Missing non-issue heads
only increment the original updatesWithoutHead loss; they do not recreate a
permit/head. Original immutable association, issue replay, consumed/revoked,
withdrawn/result state, duplicate result digest, revision/time and recovery rules
remain in the original order. A history failure rolls back the original caller
transaction; there is no new transaction, permit consume/revocation, budget refund
or alternate authority in the recorder.

Original validators retain closed-key/optional measurement/service/challenge,
binding/instance/time/state, result/TLS/echo proof, byte, immutable digest and freeze
rules. The private retained echo invocation projection moves to public L2
nativeProbeHistoryEchoInvocation: same domain/version/measurement, probeId, original
binding/selection references, supplied-time ISO and retained nonce in the same
property/read order. It is deliberately distinct from live nativeProbeEchoInvocation,
which resolves a context into a selection; substituting that live projection would
add a transformation to retained data. No wire/parser/proof algorithm is copied.

Source reading found that both history and plan value modules already consumed
parseProbeServiceSelection, while the compatibility re-export chain omitted it.
The existing contracts parser is now directly re-exported through the native
codec and public entry. This fixes source wiring without a new parser or changed
selection semantics; module/alias compatibility is still unverified.

History reads stay on the original observation host with manager Scope authority,
per-instance request/actor admission and the same default clock/skew. Fixed-window
cursor/filter/keyset, retention, ordering/duplicates, response bytes, loss counters,
historical flags/digests and capturedAt behavior remain unchanged in source. Reads
do not consult current permits/Runtime, recompute original result authority or
prove current binding/health. Existing staged echo summary branches are preserved,
not a new issuer, supported plan kind or widened history result-status filter.

## Finite Plans And Original Issuance

Config keeps the three original Direct TCP kinds, exact Forward revision/timeout,
optional locked TLS service, manual/scheduled mode, finite maxRuns/expiry and
original one-hour/interval/decision bounds. Public issuer methods keep the exact
previewIn/issueIn signatures and caller Tx; no child idempotency, pool, execution
engine or network path is added. Original acceptance fields/versions and
executionEnabled:false receipts stay unchanged.

Preview retains manager authorization, window check, original issuer preflight,
binding/kind/point/timeout/disabled validation, exact TLS context and a second
window check at the original clock point. Create preserves request framing/replay,
fresh preview digest comparison, Scope lock/window recheck, original ID/head/
originBinding/config digest, store and response order. Source capabilities and
flags do not change just because the API declaration has a public owner path.

Manual commands preserve replay/CAS/retention/backwards-clock before cancel or
active-manual/recovery guards. Decide samples before time/expiry, runs creator
authorization and original issuance inside the existing store.isolate savepoint,
then samples time and validates the original acceptance or recognized rejection.
The same failure callback accepts only the original codes/status/retryable
combination. Recognized refusals roll back to/release the original savepoint and
become decisions; unrecognized failures abort the outer Tx, not an uncertain
automatic issuance retry. Append decision before updating head in that same Tx,
preserving accepted count, completed/permanent-suspension/expiry precedence and
scheduled nextRunAt bounds.

Scheduled tick preserves single running-promise identity, stopping/flag checks,
cutoff sampling before Tx, due/unlocked candidate, creator check, Scope/head lock
and header revision/state/mode/deadline/recovery recheck. Expiry/revocation updates
keep their original order; issuing uses the original creator. Error deferral uses
the original header/revision/cutoff condition in a separate Tx, without changing
expiry or replacing a decision. Close waits for the original running promise.

GET/history retain share-locked head plus exact bounded ordered decision tail,
accepted-count/distinct-permit consistency, manager authority, fixed query window/
cursor/filter/order/retention/loss/byte checks and original public projections.
They do not issue work or claim a plan's stored origin binding is still current.

## Compatibility And Evidence

Old application class/value/storage-value, flat record/issuer/recorder and selected
observation-policy paths directly re-export canonical leaves. The old combined
probe-history-api.ts exposes its original version constant and the exact original
Run/Plan types from their respective canonical APIs; it does not import service
roots. The old ProbePlanReceipt and Forward Probe API/acceptance paths remain
precise aliases. New HTTP, Control, server, permit-recorder and command consumers
use public owners. No old constructor/default/method/readonly/literal/optional or
exported DTO shape is intentionally changed.

Legacy MySqlProbeRuns/MySqlProbePlans remain original zero-argument public wrappers
with module-local defaults, original get/lockScope/put callback override points and
static recovery. SQL statements, supplied Tx, limits/retention/recovery and failure
mapping bodies are unchanged. The policy holder freezes and runtime array
mutability remain the original ones. Remove bridges only after caller inventory,
same-revision compatibility acceptance and a separately confirmed removal.

Readiness 73/74 records initialization/type/API/alias, state/error/refusal/order,
capture atomicity/savepoint/clock/worker/cursor/byte/proof and old override cases.
All are planned only. No tests/type/syntax/static/boundary checks, formatter/
generator/build, network/MySQL/browser/container/native experiment, CI,
commit/push or delegation ran. Later functional/MySQL evidence belongs in
authorized Actions on the same frozen source; physical gates remain separate.

Telemetry/rollup, other application/HTTP/private dependencies, A1 residuals, Agent
Probe/native, Runner and complete source/type/default/bridge classification remain
open. These source slices do not establish A1/A2/foundation acceptance, current
authorization/health, release readiness or an upper-module gate.

# ADR-0015: Bounded Agent delivery exchanges and fail-closed authority observation

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted internal host direction; working-tree implementation;
functional acceptance pending Actions.

## Scope and ownership

Add internal Runner hooks `pollProbe` and `monitorConsumedProbe` for
[delivery v1](../protocol/probe-delivery-v1.md). Neither is called by production
Run/poll or registration maintenance. There is no new flag, executable grant,
result ingestion, target socket or automated claim/dispatch loop. All responses
still require `executionEnabled:false`; status requires consumed state.

The host reads existing Runner-owned identity, registered instance, fingerprint,
Guard, execution tickets, full active Direct TCP binding and target policy.
Checks happen before and after network work, without holding Runner's mutex over
HTTP. The monitor only observes and cancels its own context. It cannot replace
Runner authorization, publish deployment state or mutate Journal/high-water.

Successful claim receipts are retained by exact pointer in the registered
instance's bounded map. Only an owner-retained accepted receipt may start a
monitor; fabricated copies and foreign/old-instance receipts fail. A receipt
records original issue/expiry/consumption strings, binding, timeout, instance
and conservative monotonic deadline. The monitor takes a detached copy and
compares every original field against every status response.

One monitor attempt is allowed per eligible receipt. Mark its start before
resource admission; a busy/failing/cancelled admitted attempt cannot be retried
or resurrected by restoring permissions or receiving a late reply. The start
tombstone remains in the same instance as the original claim-burn set. At most
256 successful receipts can be retained because claims have that existing cap;
no eviction/reconstruction from wire responses, new disk format or restart
authority. Preflight rejection before a monitor attempt does not change state.

## Transport and resource bounds

- Each exchange uses the existing HTTPS/mTLS-configured Control client, forbids
  redirects and URL user-info/query/fragment, limits response bodies to 4096
  bytes and clips the request context to 200 ms, the caller and instance deadline.
  Requests carry fresh random 256-bit correlation IDs and exact identity/echo
  validation. No retries on denial, timeout, malformed or uncertain outcomes.
- Shared process-wide admission: at most four delivery operations/monitors,
  one per Node, and 128 tracked Node slots. Discovery consumes a one-second
  per-Node cooldown from attempt start, including failure; constructing another
  Runner or rotating instances does not refund it. A consumed monitor may use
  that Node's inactive cooldown slot but cannot overlap an active operation.
- The monitor holds its slot for its entire lifetime, including initial status,
  waits and cancellation drain. Status requests are serial, with a 50 ms wait
  AFTER each success, maximum 40 exchanges and an immutable deadline no later
  than the accepted receipt's original two-second bound. There are no catch-up
  bursts or retries. These are host bounds, not an additional server rate limit
  or a substitute for existing permit issuance/socket execution budgets.
- First status must succeed before returning a usable monitor. Each later
  success must match the original consumed receipt; checked/server time cannot
  regress. Unknown, explicitly withdrawn or now-unauthorized source state closes
  the monitor permanently. A status response cannot consume again or mint a
  permit, nor can a discovered offer bypass the existing one-use claim hook.

## Freshness and cancellation

Use the monotonic instant immediately before request construction. The new local
freshness deadline is `requestStart + 250ms - (serverTime - checkedAt)` (or
observedAt for poll). All local elapsed time is therefore deducted, including
network, body read, parsing and lock waits. Validate server time with the existing
Guard. A delivered reply with no remaining freshness is rejected; receipt time
never starts a new window. Poll additionally clips original expiry by configured
clock uncertainty, instance and current execution deadlines.

The monitor's execution deadline can only shrink from its detached receipt,
current instance and current execution deadline; later ticket renewal cannot
extend it. A response cannot revive an already stale or closed monitor. Synchronous
`Check` validates readiness, cancellation, current monotonic deadlines and local
authority before returning success. Before first status, or after any failure,
it rejects. This remains a bounded authority OBSERVATION, not an executable
`probe.Permit`/`probe.Grant` or a promised continuously valid lease.

A separate local supervisor checks Runner authority every 25 ms and arms a
timer for the earlier freshness/execution deadline while HTTP may be blocked.
Parent cancellation, instance closure/rotation, local binding/credential/ticket
loss, status failure or stale time permanently closes the context. The timer
rechecks the latest deadline when it fires so an old timer cannot invalidate
a newer timely response. Explicit Close waits for both supervisor and HTTP
worker to terminate; only then are the process/Node slot and done signal released.

The 200/250/25 ms values are cooperative request/freshness/checking limits, NOT an
OS real-time SLA or proof a disconnected physical Agent has stopped a socket.
Go scheduling, suspend, Runner lock contention or a transport that ignores
cancellation can delay worker termination. Check still rejects expired/closed
state; an uncooperative HTTP worker keeps its bounded slot until it actually
returns, even after cancellation. No unlimited replacement goroutines or early
slot refunds are allowed. A future executor must retain its own Gate/check,
context propagation and drain-before-release rules and must not equate this
internal context to accepted real-world cancellation evidence.

## Compatibility and evidence

Core, Runner production loop, authorization/Guard implementation, Journal,
execution engines/Gate, existing machine schemas, migrations and Control owner
logic are unchanged. The existing 0016 Control profile/recovery boundaries apply.
Only ephemeral registered-instance receipt bookkeeping is extended; shutdown
and instance rotation already cancel that instance's context.

Eleven Go `TestProbeDelivery*` groups are authored and explicitly Actions-wired:
empty/current poll and cooldown, foreign/stale/burned offers, immutable receipt
status and one-start semantics, every full binding/original receipt field,
withdrawal/HTTP failure without retry, local authority and cancellation,
monotonic freshness/deadline/non-resurrection, process/Node/cooldown/tracked caps,
uncooperative transport holding admission until drain with late positive reply,
forged/invalid preflight and failed discovery outcomes. HTTPS tests use TLS
fixtures and existing host assembly, not physical hosts or a new real Agent +
MySQL end-to-end pass. Existing real mTLS/MySQL contract/withdrawal suites and
full Go race remain wired. Tests have NOT run locally or passed matching-SHA CI.

Static guards prohibit production calls, executable Grant/Permit construction,
claim/target socket admission and authority writes in these new hooks. Next:
result contract/ingestion and one-use host execution admission, then a separately
reviewable opt-in production loop and combined Actions acceptance. This slice
does not make Control able to trigger an actual Probe.

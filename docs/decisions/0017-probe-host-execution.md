# ADR-0017: One-use host Probe execution and conservative result serialization

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted incremental direction, working-tree implementation;
functional acceptance pending Actions.

Follow-up: [ADR-0018](0018-probe-production-workflow.md) connects this adapter to
an explicit default-off production-path workflow. Statements about absent callers
below describe this ADR's original slice, not the later combined working tree.

## Scope and ownership

Add the internal `Runner.executeConsumedProbe` adapter. It connects an exact
owner-retained [claim receipt](../protocol/probe-claim-v1.md), the fail-closed
[authority watch](0015-probe-agent-authority-watch.md), the registered instance's
existing one-use `probe.Gate`, the bounded numeric TCP executor and the closed
[result contract](../protocol/probe-result-v1.md). No production code calls this
adapter yet. There is no new command/flag, remote issuance, background task
dispatcher, Agent result HTTP caller, retry loop or health aggregation.

An offer, contract-only response, copied receipt or execution ticket alone is
insufficient. The monitor must accept the retained receipt and complete a fresh
status check, including original consumption times, timeout and full binding,
before the adapter constructs an internal Grant. Only this adapter may construct
such a Grant in production source. It cannot manufacture a Gate or target.
The Gate is the one already bound to the registered Node/boot/session/instance;
the executor still resolves its own current host-owned assignment and policy.

The receipt's existing monitor-start tombstone is burned before monitor resource
admission. Its Gate independently burns the permit ID before socket admission.
Neither busy admission, cancellation, status error, uncertain result, socket
failure nor serialization failure clears either tombstone. No gate reconstruction,
receipt eviction or re-execution for reporting is introduced. Preflight denial
before a valid monitor attempt retains its existing non-burning behavior.

The Grant's check is the live watch, not a permanently successful callback.
Every existing executor check and its cooperative monitor therefore checks both
independent consumed authority observations and live local execution authority.
Numeric target, exact full binding, egress policy, one socket, no DNS/proxy or
application bytes, cooldown and process/Node budgets remain the executor's rules.
Its deadline is clipped by the original receipt/instance/execution deadlines;
subsequent status success or ticket renewal cannot extend it.

## Result lifetime and cancellation

On execution/serialization failure, the adapter returns no result and closes
the watch, waiting for its HTTP and supervisor workers to terminate. Executor
work is already drained by the Gate/executor before that return. A transport
ignoring cancellation retains its bounded watch slot until it actually exits;
there are no unbounded replacement workers or early slot refunds.

Success returns a private observation handle retaining the live watch. The future
reporting caller must defer `Close` and keep it alive through the bounded report
exchange. Each `resultRequest` rechecks current authority and reporting cutoff
and returns a detached copy of one fixed body. It never refreshes measurement,
expiry or correlation ID. Closed, stale, withdrawn, cancelled, locally replaced
or expired authority cannot export another request. If the current deadline
shrinks below the serialized cutoff, discard the report rather than rewriting it.
Even an abandoned handle expires within its original fixed two-second bound.

The 25 ms local checks, 200 ms requests and 250 ms freshness remain cooperative
bounds, not a real-time physical revocation SLA. A detached request can become
stale immediately after any check; it is data, not a lease or permission to run.
The existing Control result owner must still reauthorize the original Actor,
instance, binding, consumed/unwithdrawn permit and times during ingestion.
The adapter does not turn reported reachability into independently attested
physical execution or application health.

## Clock evidence and serialization

The accepted claim receipt now privately retains the validated server time `S`
bracketed by local monotonic request start `Q` and acknowledgement-validation
completion `R`. These are not added to a wire message or persisted. For an executor measurement at local
monotonic `M`, serialize `floor_ms(S + (M - R))`. For the clipped local validity
deadline `U`, serialize `floor_ms(S + (U - R))`. This uses the server-clock lower
bound after deducting the response/validation delay, not the Agent wall clock or
an invented clock-skew grace. It assumes the guarded clocks advance normally;
it is not clock attestation or tolerance of arbitrary remote clock changes.
Status must not regress behind the original claim's server anchor; existing
Guard/status checks and final server ingestion reject observed uncertainty or
future/late evidence. No claim of acceptance under arbitrary clock skew is made.

For wire validity `V`, the local report cutoff is `Q + (V - S) - 1ms`, using the
inverse server-clock upper bound, NOT `R + (V - S)`. This deducts the entire
exchange uncertainty again plus server timestamp quantization and flooring; a report whose
wire expiry might already have passed is discarded even if its local execution
deadline remains live. Keep the separate `R + (V - S)` validity bound to reject
reports if local execution authority shrinks below the serialized validity,
even while the earlier reporting cutoff remains within that authority.
Precision loss never extends local validity.
Round nonnegative elapsed duration UP to integer
milliseconds, bounded by the original timeout; it remains total executor
invocation time, not TCP RTT. Verify that measurement is after local invocation
start and not in the local future, elapsed fits that history, and the result is
independent, exact-binding, connect-only and application-health unknown.
Preserve the original issue/expiry/consume strings and timeout. Only the paired
connected/tcp-connected and unreachable/tcp-connect-failed observations can pass
the strict existing Go result parser. Missing anchors, bad windows or unsupported
outcomes are discarded, never clamped into a valid measurement or rewritten as
a network failure. No raw network error, target, credential, Scope or Actor is
serialized. Source remains agent-reported and application payload bytes zero.

## Compatibility and evidence

Core, production Runner/CLI flow, authorization implementation, Journal/Gate/
executor, machine schemas/fixtures, Control acceptance and migrations are
unchanged. Only ephemeral accepted-receipt clock evidence and this internal
adapter/report handle are added. The 0017 migration and existing Control-only
compatibility/recovery profile from ADR-0016 still apply; this ADR number is not
a new database migration. A restart cannot reconstruct execution authority from
serialized results or old receipts.

Nine Go `TestProbeExecution*` groups are authored and explicitly Actions-wired,
also included in the existing full Go race gate. They cover actual loopback TCP
EOF with zero application bytes, concurrent duplicates, forged/old receipts,
initial status failure and clock regression, watch/socket busy non-refunds,
in-flight local/remote revocation, cancellation and timeout, uncooperative HTTP
drain with late positive reply, closed/shortened/expired report handles, exact
immutable report bodies, conservative clock mapping/rounding and invalid
serialization evidence. Their registry and Control responses are synthetic TLS
fixtures, not a real Agent + Control + MySQL end-to-end pass or physical-host
proof. Existing executor/contract/MySQL gates remain wired.

Local work is static checks only; these functional tests have not run locally
or passed Actions for this working tree's exact SHA. Next: a separately reviewed,
default-off production flow connecting issuance, poll, claim, execution and
reporting, followed by combined Actions acceptance and fault/resource tests.
Production still cannot trigger a real Probe from Control in this slice.

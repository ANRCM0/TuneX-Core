# Agent Execution Wire Source Continuation

Date: 2026-10-19. Authored source only. Readiness111/112/114 are planned and
unexecuted; no Agent/foundation acceptance or independent physical evidence.

Later FR-0015 source-separates the four original observation exporter DTO/encode/
ACK/body/time formats and explicit native Host family, while sampling/counter/
retention/budget/transport lifecycle stay original.147-149 are planned/unexecuted;
see [actual native observation chain](agent-observation-wire-native-v1.md). This
does not claim complete wire/default/type/source or original native engine acceptance.

## Actual Original Chains

| Caller and original stage | Canonical L2 source | State/decision owner retained |
| --- | --- | --- |
| v2/v3/v4 status request after machine/descriptor | nativeexecution/probe_delivery_wire.go Encode/Decode family Status | Watch/local authority, original deadline/exchange, identity/service/challenge/receipt checks, freshness, cancellation and publish |
| v1/v2/v3/v4 report ACK after exchange | nativeexecution/probe_result_wire.go Decode family ResultResponse | Once-only burn, exact family route/receipt, service/challenge equality, Guard and final result authority recheck |
| Generic original result field construction after entropy | Same file ProbeResultProjection/ProjectProbeResult | Measurement/family/currentness/result/window policy, monotonic conservative server projection, quantization, entropy and final reporting cutoff |
| Echo context encode/decode around original error/sample sites | probe/native/echo_format.go EncodeEchoContext/DecodeEchoContext | Parent marshal-error refusal, decode, original scheduler.Now then parse-error/product refusal |
| Echo detached input equality | Existing SameEchoExecution in same native file | Parent nil behavior, original instance/target binding and Check callback |
| Native RFC3339Nano parse | nativeexecution/wire_time.go ParseWireTime | Parent exact call position and raw error handling, every clock/Guard/history/expiry decision |

The original three execution source files still own their existing private status,
result getter and report methods. They consume the same machine/descriptor, receipt
and version-specific selection/challenge functions. Status request construction and
Marshal/strict Parse precede the existing exchange, which still performs its own
encoding. Response Parse then Check remains before the parent's binding/time/timeout
or service/challenge comparisons; freshness and local watch checks still precede
CheckedAt/ServerTime parsing, cancellation and publish. No duplicate or replacement
watch, new polling family, claim, authority budget or fallback is introduced.

reportProbe still burns its original atomic bit before family dispatch, local
result authority retrieval, deadline creation, I/O and ACK parsing. Every version
uses its original route and codec. v3 equality and v4 selection/challenge checks
remain after Parse/Check and before the original server parse/Guard. The final
family resultRequest still rechecks authority; no failure refunds a report.

## Generic Result Projection

ProbeResultProjection contains only supplied identity/binding, timestamps/durations
and result fields, not a receipt, Gate, scheduler, entropy source, Guard or Journal.
ProjectProbeResult formats the original fixed three-digit UTC-text values supplied
by the parent, rounds elapsed milliseconds by the original expression, projects
the same v1-shaped internal fields, marshals and conditionally runs the original
legacy parser. The parent still passes exactly `!receipt.typed && !receipt.services`;
this extraction does not change how an echo receipt reaches that existing branch.
It does not broaden issuance or correct existing behavior under a source move.

The parent still selects the measurement point before its original scheduler.Now,
parses consumed/expires at the original points, validates receipt/session/result,
computes minimum validity, projects monotonic elapsed time conservatively and
quantizes measured/valid before entropy. Gate.InstanceID and all supplied facts
are read at the original stage. After successful native projection it computes
the original inverse report cutoff and samples Now again before return. Native
formatting neither reads a clock nor changes the uncertainty deduction.

## Echo Stages And Shared Time

Existing ParseEchoContext now composes the two explicit native stages, keeping its
signature and error order for Probe executor callers. Control uses the stages
separately: encoding failure returns before scheduler.Now; DecodeEchoContext is
called next, then Now is sampled even when decode failed, then the original error/
purpose/validity/selection checks run. The adapter is not given a clock callback.
SameEchoExecution uses the same original reflect.DeepEqual, after parent nil checks.
Echo protocol/digest/endpoint/actual-driver/observed-ingress/current-instance and
deadline policies remain parent-owned. No target or proof rule was relaxed.

ParseWireTime shares the exact original RFC3339Nano time.Parse implementation;
the existing ParseProbeWireTime remains a compatibility function calling it. The
qualification pair still parses both fields even if the first fails. Snapshot
still parses ValidUntil first and stops before IssuedAt on failure. Retained Relay
schedule still parses expiry before optional renewal and retains its own errors.

Run Hello calls the same native parser after Guard initialization and diagnostics
setup, immediately before ValidateServerTime. Relay ensure re-parses expiry after
provider failure; renewal also re-parses after provider failure even if retryExpired
is false. Original retry/parse-success/Now short circuits and historical ValidateRelayAt
are unchanged. Overlap parse remains before its original parse-error short circuit,
conditional Now.Add bound, until comparison and renewal refusal. The statements
remain in the parent; only the shared text parser is lower-owned. No earlier parsed
value is reused across a callback and no current-time sample is hoisted.

## Planned Acceptance And Remaining Scope

Later authorized same-frozen-source Actions must compare exact version fields,
request/ACK bytes and Parse/Check errors, prevalidation versus exchange encoding,
service/challenge/receipt mismatches, status cancellation/local-watch/publish order,
all report-once failures and final authority refusal. Compare generic result fields,
zero/nanosecond/millisecond elapsed and quantization, parser branch by family,
entropy errors, raw timestamp failures, uncertainty cutoff, first/last Now counts
and no payload/version/digest expansion. Compare nil/slice equality, echo invalid
encode/decode paths and sampling order, raw time.Parse errors and offset/fraction,
Hello setup/Guard order, Relay parse/provider/history/retry/overlap short circuits.

No tests, syntax/type/static/boundary/import checks, formatters/generators/builds,
CI, native/network/MySQL/browser/container experiments, commits or pushes ran.
This turn used no subagents. Known source work remains in native URL/protected key
representations, complete driver/engine/wire/CLI/default/public-type classification,
Runtime/private collaboration and the full A5 inventory/freeze candidate. Product
binding/measurement/expiry comparisons remain intentionally at their original L3
owner and are not format debt to move into an adapter.

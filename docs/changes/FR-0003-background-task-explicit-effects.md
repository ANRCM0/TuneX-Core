# FR-0003: Background Task Explicit Scheduling Effects

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing L1 background lifecycle owner, under the human's
2026-10-19 standing authorization to choose and implement similar foundation source
proposals after recording impact, compatibility, migration and planned acceptance.
The proposal was recorded before implementation; source is now authored and has
not been checked or executed. Verification, Git and release gates stay closed.

## Task Proposal

1. Layers: L1 BackgroundTasks and L2 native interval/monotonic effects; existing
   server composition and application compatibility entry migrate together.
2. Consumed public interfaces: framework BackgroundTask/BackgroundTasks and L2
   nativeMonotonicNow. Core/kernel, storage and product APIs do not change.
3. Foundation impact: breaking direct L1 construction. No wire, persisted state,
   authority, Journal, resource reservation or business scheduling policy change.
4. Contract: background-specific interface2 requires BackgroundTaskEffects as the
   second constructor argument. Native effects live in L2. The historical one-arg
   application entry binds them through one subclass of the same L1 implementation.
5. Acceptance: planned only, on a later authorized exact frozen revision. Cover
   independent intervals, non-overlap, backoff samples, cancellation and draining;
   no tests/checks/builds/CI/experiments are authorized by this source proposal.
6. Parallel impact: server retains the original five declarations and owners;
   direct/custom scheduler clients migrate together. No additional feature branch,
   scheduler registry, work queue or competing execution/authority owner.

## Why Current Extensions Are Insufficient

The complete BackgroundTasks/PeriodicTask source directly reads performance.now,
starts native intervals and clears native handles. BackgroundTask describes each
task's work and callbacks, but has no scheduler effect port. Supplying callbacks
from server alone would leave native scheduling/time in L1. Moving the whole
lifecycle to L2 would mix reusable non-overlap/drain decisions with native effects.
Importing compatibility into L1 would reverse the dependency direction.

Choose a small explicit effect port. scheduleInterval returns a receiver-free
cancellation function, keeping native timer handle types and cancellation in L2.
No generic timer handle, process global provider, native fallback or alternate
PeriodicTask implementation is added to L1.

## Exact Contracts And Behavior

```ts
export const BACKGROUND_TASKS_INTERFACE_VERSION = 2 as const;
export interface BackgroundTaskEffects {
    now(): number;
    scheduleInterval(action: () => void, intervalMs: number): () => void;
}
// BackgroundTasks constructor(options: readonly BackgroundTask[], effects: BackgroundTaskEffects)
```

now supplies the original monotonic millisecond scale. scheduleInterval must defer
the first tick as native setInterval does, return a cancellation function, and not
invoke action during registration. Cancellation stops future admission without
cancelling the already active task. The provider owns native handle representation.
Methods retain their provider receiver. The returned cancellation has no receiver.

The aggregate registration/duplicate/64-task validation stays first. Missing or
wrong-kind effects then throw Error('Background task scheduling effects are required')
before individual declaration validation, time sampling, interval allocation or
owner callbacks. This new error precedence for incomplete direct-host construction
is intentional. Valid effects keep all original per-task validation and freezing.
No eager clock sample, new time-number normalization or timer-return fallback.

The original started/stopping flags, enabled behavior and interval order remain.
tick keeps stopping/active short circuits before its monotonic read; rejected work
increments the bounded failure count, reads time only with failureDelay, computes
the same exponential cap and calls onFailure afterward. Success resets both fields.
run still begins in a Promise continuation; failure logger exceptions stay swallowed.
stopAdmission sets stopping, invokes cancellation if present, then clears it, so an
exception retains the handle for retry as before. close still stops all admission,
settles onStop with the captured active promise, drains all tasks and reports the
original sanitized errors through the same memoized close promises.

## Impact And Compatibility

Observed source consumers: framework/public.ts; application/background-tasks.ts
(currently an exact old alias); and server.ts with five registrations. Scoped
source search found no other production/example consumer, but full A5 and unknown
external clients remain unverified. Existing test/tool consumers must be inventoried
on the frozen revision during later authorized acceptance.

server supplies explicit native effects at its existing construction expression.
L2 native effects dynamically resolve setInterval at start, clearInterval at stop
and performance.now on each original sample; they do not capture native functions
or read time at module load/construction. The old application entry exports the
native wrapper with its original BackgroundTasks name and one-argument constructor.
It inherits all lifecycle methods; it is no longer the identical constructor
object exported by framework/public.ts. That identity distinction is explicit;
undocumented cross-entry constructor equality is not promised. The old task type
is the exact L1 alias. The wrapper owns no duplicate task state or lifecycle body.

The five original server task declarations, intervals, worker flags, failure
messages, backoff object, authority check, serial retention prune calls, onStop
callbacks, HTTPS startup/partial cleanup and dependency-close ordering remain.
FRAMEWORK_INTERFACE_VERSION and unrelated interface versions are unchanged.

## Migration And Version Plan

Add the background-specific version and required effect contract to framework
public, implement one native L2 provider/wrapper, rebind the old application entry,
and migrate server in this source slice. Direct L1 clients must supply effects;
there is no v1 native overload in L1. Record precise compatibility/defaults and
readiness cases before any frozen-candidate claim. Remove the application wrapper
only after every actual consumer migrates and same-revision acceptance supports it.

This is a source/API change without data migration. Reverting source/bindings before
distribution does not authorize clearing authenticated high-water, authority or
Journal history, or forgetting an accepted cleanup outcome.

## Acceptance And Known Limits

Planned: invalid aggregate/declaration/effects precedence, no constructor sampling,
disabled/duplicate start/stopped restart, registration order and interval duration,
independent active slots, deferred run, ticks while active/stopping, failure counts
through 16/capped backoff, exact now counts/positions, throwing onFailure, successful
reset, cancellation once/retry after exception, repeated close, onStop and active
settlement, mixed shutdown failures, and server startup failure/normal shutdown.
Compare native legacy construction and explicit effects, inherited methods, original
errors and separate cross-entry constructor identity. Check no native timer/time
types or operations remain in this L1 mechanism on the exact frozen source.

All cases are planned and unexecuted. Later functional/Control/MySQL/network evidence
belongs in authorized GitHub Actions. Public example, full A5 consumer/type/default
inventory, independent physical-host, long-run and release gates stay unverified.

## Source Authorization And Acceptance Gate

Proceed under the human's standing source authorization; separate confirmation is
not required for this similar proposal. Keep the original owners and one lifecycle
implementation. Source completion does not imply accepted behavior, a frozen public
interface, an opened parallel-feature gate or authorization to verify/publish.

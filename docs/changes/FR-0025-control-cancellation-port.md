# FR-0025: Control Cancellation Observation Port

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified; proposal recorded before implementation.
Owner and authorization: Control framework cancellation/read/effect owners;
the human's 2026-10-19 standing source authorization and explicit parallel A5
instruction authorize this source proposal, including the source type changes.
No verification, Git write, release or parallel feature gate is opened.

## Task Proposal

1. Layers: L1 common cancellation observation, L2 native MySQL/HTTPS consumers,
   L3 passive Node observation and notification composition.
2. Public interfaces: `framework/public.ts` NodeObservationContext,
   AuthorizedNodeReportReader and NotificationSender, notification effects v1;
   original Node observation API v1 and native observation controller effects.
3. Foundation impact: a new L1 structural CancellationSignal port replaces two
   references to the platform-global AbortSignal type. No runtime, persisted,
   wire, SQL, authority or Journal change.
4. Contracts: cancellation v1 exposes readonly aborted/reason, throwIfAborted,
   abort callback registration with optional once, and callback removal.
   Notification effects advances to v2. Node report read gets explicit v2 for
   its changed context, distinguishing the previously unversioned native view.
5. Acceptance: planned native-signal structural substitution and owner-independent
   fake cancellation, exact listener identity/once/removal/order, cancellation
   races and resource drain on the later saved revision. Functional/MySQL/network
   evidence belongs in authorized Actions. Nothing is executed during source work.
6. Parallel impact: only Control framework contracts/public exports and its
   dedicated source record are edited. Root agent integrates shared candidate,
   boundary and readiness records; application and old module aliases keep their
   existing paths. Agent/Web slices do not need shared implementation changes.

## Why Current Extensions Are Insufficient

`framework/node-report-read-ports.ts` puts native AbortSignal in the L1 reader
context; `notification-effects-ports.ts` does the same in NotificationSender.
Neither requires native EventTarget/DOM events/controller mutation. Existing
injected clocks, codecs and storage providers cannot remove a platform type
dependency from these public declarations. A type-only common observation port is
sufficient; moving controllers, timers or native signal wrappers into L1 is not.
The public domain Core does not change.

## Impact And Compatibility

The complete native HTTPS sender body and MySqlNodeObservationReader body were
read. Sender uses aborted and add/remove abort callback only; MySQL reader uses
aborted, throwIfAborted and the same callback registration/removal. Neither passes
the supplied signal to fetch/request or another API requiring full AbortSignal.
NodeObservations constructs the original native AbortController and puts that
same signal into NodeObservationContext; its own native controller reason,
throwIfAborted, race and timer behavior remain as before. Its public HTTP-facing
observe(signal?:AbortSignal) API remains the existing native specialization at L3.

NotificationDeliveries does not provide a signal in its existing sender call;
the sender's optional cancellation remains available to existing direct callers.
Endpoint owner contracts re-export the same framework NotificationSender type;
Node owner public and old `modules/observation-ports.ts` re-export the same reader
context declarations. Existing Node observation tests construct a real native
signal and inspect cancellation state; no fixture is edited in this source phase.

Native signals can be supplied structurally without any wrapper, method rebinding,
controller substitution or listener replacement. Callback identity and options
objects at every runtime call site remain unchanged. A cancellation provider must
set its terminal state/reason, notify listeners once, honor once/removal, and
throw the stored reason after cancellation; it cannot reset to active or grant
execution authority. Adapters are responsible for their provider contract. This
type boundary does not add native brand checks or silently repair invalid signals.

Source compatibility changes intentionally: a consumer typed through the L1
context/send input can no longer access platform-only members such as onabort,
dispatchEvent or arbitrary event options, or pass that L1 view directly into an
API demanding full AbortSignal. Such a consumer must keep its own native handle
at L2 or explicitly supply a native adapter at its existing composition boundary.
No cast is added to promise full native compatibility. Runtime objects retain
their original identity and all actual native members.

## Migration And Version Plan

Add `framework/cancellation-ports.ts` and public type/version exports.
NodeObservationContext.signal and NotificationSender's optional signal select the
same CancellationSignal declaration. Notification effects v1 becomes v2;
`NODE_REPORT_READ_INTERFACE_VERSION=2` identifies the changed formerly unversioned
context, and `CANCELLATION_INTERFACE_VERSION=1` identifies the new minimal port.
The aggregate framework version remains independent as with the existing other
interface counters. There is no legacy default back to a native signal type.

Old aliases remain exact forwards, not duplicated interfaces. Existing native
constructors/readers/sender call bodies and cancellation ownership remain.
Rollback is a source contract decision, never permission to reset authority,
Journal, leases, consumed permits or protected history.

## Acceptance And Known Limits

- Planned: native AbortSignal to common signal substitution with no DOM or Node
  type dependency in the L1 declaration; unsupported platform-only L1 access must
  remain outside the common contract.
- Planned: normal, already cancelled, cancel-before/after-registration and once/
  removal cases using original callback identity, same reason and throw behavior.
- Planned: passive observation pool-wait/owned-connection cancellation keeps its
  capacity until actual work stops and never destroys a Runtime transaction.
- Planned: sender cancellation before admission/DNS/guard/request/response retains
  original rejected versus unknown result and in-flight capacity/socket cleanup.
- Planned: existing owner contracts, example and full source/type/private boundary
  rules on exact saved source; no full AbortSignal cast or native fallback in L1.

No checks, tests, build, formatter, generator, network/MySQL experiment or CI ran.
The candidate is not frozen/accepted and physical-host, long-run and release gates
remain separate.

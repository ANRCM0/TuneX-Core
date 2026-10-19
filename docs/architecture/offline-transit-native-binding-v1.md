# Offline Transit Native Binding V1

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0014 source-authored/unverified. PreparedInstanceVersion1 and
OfflineTransitAdapterVersion1 candidates; existing driver HostVersion remains1.

## Actual Owners And Entries

| Public entry -> coordinator/port -> implementation | Original ownership and stage |
| --- | --- |
| control.NewTransitController -> original L3 controller | Same underlying native constructor types, feature/capability/Journal/authorize order |
| nativeexecution.OfflineTransitCertificate/Roots/Identity | Exact TLS/X509/transit aliases, never relabeled L1; old underlying source type identity retained |
| constructor -> OfflineTransitIdentityAvailable | Original root non-nil/certificate slice checks, no leaf/trust parse or clock |
| constructor -> OfflineTransitPeerIdentity | Certificate copy/root clone at old literal field, after key copy and before capability copy |
| controller.now -> original native Schedule.Now method | Bind method value at construction without reading time, invoke at both original Apply/check points |
| Apply -> existing native ParseWireTime twice | Original issued then valid text, first parse error returns before second, both before Now |
| Apply -> EncodeOfflineTransitIntent | Same original JSON of assignment.Driver.Config.Intent, separate marshal error return |
| Apply -> PrepareOfflineTransit -> original transit.Prepare | Same raw bytes/identity/allow and native engine object, no added Activate/Close/authority |
| controller engines -> executionhost.PreparedInstance | Only original Activate/Close calls exposed; no fake Drain/Remaining/SetAuthorization methods |
| old control.transitErrorCode -> native OfflineTransitErrorCode | Same nil/Error/range/separator/prefix/fallback, used at same per-item error stage |
| Runner offline integration hook -> same controller/physical guard | Independent Control permission/live Ticket/identity/exclusive guard, absent from Run/poll |

The generic existing Instance contract requires methods this engine does not
provide; adding the exact prepared lifecycle avoids copying an engine or inventing
unsupported drain/authorization behavior. PreparedInstance is an additive L1 port;
existing driver/registry/Instance interfaces and versions remain unchanged.

The controller no longer imports TLS/X509/JSON or concrete transit.Engine, calls
global time.Now, or decodes native time text itself. Its stdlib time usage is
deadline arithmetic/value typing. It consumes explicit public native types/codec/
Schedule and existing state APIs, retaining all product authority/history/phase
decisions. No new composition root, public clock option or provider fallback.

## Original Constructor And Apply Sequence

Constructor preflight still short-circuits missing authorizer, missing physical
guard, unavailable native identity and zero epoch before capability checking. It
then loads the original protected offline Journal, invokes authorizer, copies key,
clones roots, copies capabilities and allocates engines. The private now method
value is bound without sampling. Original NewTransitController callers keep the
same actual TLS certificate/root types through aliases. No new crypto validation.

Apply keeps the existing mutex, deferred unlock and closed/capability/authorize
refusals before strict native Snapshot parsing. Node/epoch and strictly-new
generation checks precede issued/valid parsing and the one original native Now.
The one-second future tolerance and deadline comparison remain. Every assignment
still passes authorize/reserve; final authorize precedes the same state acceptance.

Only after successful persistence does the controller update its Journal and
close/delete all prior engines. Failed preparation/activation cannot resurrect
their old generation/Fence. Its new allow closure still calls authorizer before
native Now/deadline and is passed unchanged into original native preparation.

| Original branch | Preserved result/effects |
| --- | --- |
| Per-item initial check fails | Error observation appended, no intent JSON/engine, continue |
| Intent JSON fails | Return prior observations plus error; current item is not converted to a Prepare-error result |
| Prepare fails with nil pointer | Nil lifecycle interface and original error; no erroneous Close |
| Prepare fails with non-nil partial engine | Return same pointer through port for original caller Close and error observation |
| Prepared phase | Keep same native engine without Activate, observation remains prepared |
| Active phase | Original Activate; success ready/map, failure Close/error |
| Draining phase | Original Prepare then Close/removed, no new map entry |
| Close / CurrentJournal | Same mutex/closed idempotency/engine delete and committed high-water read |

Native Prepare returning a nil pointer is explicitly converted to a nil interface;
otherwise a Go typed-nil would make the original `engine != nil` cleanup branch
invoke a nil receiver. A non-nil returned native pointer is never wrapped or copied.
The adapter does not swallow errors or activate/close automatically. The old private
error helper keeps its signature and delegates to the one native text implementation.

Engine-owned native time/TLS/network/watch/budget/replay/frames/allow checks remain
untouched and are not virtualized through controller.now. No cached Journal grants
authority. Native engine tests still use the original concrete native APIs. Neither
this minimal port nor a successful parse introduces a new driver or execution grant.

## Exact Native Source Classification And Remaining Dependencies

| Source | Declared native purpose |
| --- | --- |
| nativeexecution/offline_transit.go | Actual original identity/intent/error/Prepare adapter and aliases, prepared lifecycle binding |
| transit/engine.go | Existing native prototype lifecycle, TLS/TCP listener/dial/frame pipeline, shared node budgets and caller allow |
| transit/tls.go | Original certificate/root/purpose/URI/pin/TLS1.3/ALPN validation and native time reads |
| transit/wire.go | Original bounded length/JSON/control frames, adjacent-hop binding, replay fields and correlated reply |
| adp3transit/validate.go + schema.json | Original offline resource/snapshot native schema, digest/order/time/binding/capability checks |
| transitcontracts/validate.go + schema.json | Original native intent/endpoint/CIDR/neighbor/time/schema decoder |

These exact files were read and classified, not their whole directories exempted.
Native engine/codec bodies and schemas were not edited. Original imported
forward.AcquireNodeBudget/Allowed, relay.ReadFrame/WriteFrame/Fingerprint and native
contracts parsing/digest/CIDR remain explicit existing mixed/native dependencies.
This source classification and wrapper does not certify those owners, their public
boundaries, the data plane or whole repository acceptance. No new behavior extends
those dependencies; their broader source/default/private/type/consumer work remains.

One observed native compatibility limit stays unchanged: transit/tls.go rejects a
peer certificate chain whose length is not1 before its intermediate-building loop.
This source move does not claim intermediate-chain support or alter that refusal;
later native TLS vectors must distinguish the existing single-leaf behavior.

Observed old constructor/bridge consumers are original offline controller tests and
the not-Run-wired integration hook. The source search is not full consumer/type
evidence. Preserve controller/observation/New/Apply/Close/CurrentJournal entries and
native engine APIs until complete actual caller migration and same-source contract/
native acceptance passes; no alias removal or accepted extension recipe now.

The bridge still refuses any Direct/Relay historical/retired Fence, active physical
key or retiring TCP port. Runtime Ticket alone never authorizes Transit. There is
no registry/capability/Run/poll insertion, production Report, protocol change,
automatic cutover, driver enable or protected history reset in this slice.

## Planned Evidence And Limits

Readiness144-146 are planned/unexecuted: lifecycle/aliases/native nil and partial
pointer semantics; default/copy/error/time/parse order; same mutex/auth/guard/save-
before-engine/phase/JSON versus Prepare error outcomes; old offline Journal/replay/
restart/refusal/high-water, native TLS/frame/budget/watch/allow and not-live integration.
Functional native/platform/persistence/PKI/network evidence needs later authorized
Actions on the full frozen source. Independent physical-host/long-run/backup/example/
release and foundation/parallel gates remain unmet where unavailable.
No tests/checks/gofmt/generators/build/CI/experiments/Git/delegation occurred here.

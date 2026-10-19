# Passive Node observation and Relay preview owner candidates

Date: 2026-10-19. Authored dirty source only; no verification or Git writes ran.
These candidates do not accept A2, the foundation or the parallel module gate.

## Passive observation source chain

modules/node-observation-owner/public.ts owns the original NodeObservations class,
limits, product policy/reason/view contracts, public command API and complete
observeNodeReport rules. The original raw reader context, bounded report provenance,
evidence and authorized reader declarations now live unchanged in L1
framework/node-report-read-ports.ts and are exposed by framework/public.ts.
The MySqlNodeObservationReader change only redirects those type imports to L1;
SQL, report parsing, dedicated connection, guard/auth, rollback and cancellation
stream-destruction bodies are untouched.

The original chain is HTTP observation request -> required reader bound to its
original receiver -> independent instance-local admission -> cancellable dedicated
same-transaction scope authorization/scoped read -> bounded raw evidence -> original
product validation/reason precedence -> deeply frozen passive observation. No
Runtime transaction, deployment/lease/Journal/resource owner is replaced.

The narrow lifecycle continuation moves only original controller creation,
setTimeout scheduling and clearTimeout expressions into public L2
compatibility/native-observation-lifecycle.ts primitives. Each primitive looks up
the native global when called, not at module load or construction. The timer keeps
its original native handle, which is passed back unchanged to clearing in the
original finally location before removing the external signal listener. Controller
signals, event listeners, timeout/error callbacks, Promise.race and work-settled
budget release remain owned by the same original product host. No second lifecycle
host, cancellation policy, captured clock or default provider is introduced.
AbortController/AbortSignal remain explicit standard native public types; the timer
return type is the original inferred native setTimeout handle, not a new L1 timer
contract. Later classification must account for these native type references.

Constructor policy validation, freshness clamp and copied frozen policy remain.
Limits retain their single frozen object, defaults and exact values. Identity and
closed source/version/timeout input validation precede cancellation and admission.
Actor cooldown pruning, global/per-Node/per-actor limits and active counters retain
their original scope and ordering. Existing public L2 nativeMonotonicNow,
nativeWallClockNow and nativeJsonEncoderBytes perform the same dynamic operations
at their original call points; they do not add captured clocks or byte defaults.
The AbortController, timer and external signal listeners retain their original
lifecycle. A timed-out reader holds capacity until work actually settles; release
then establishes actor cooldown. Returning a timeout or cancellation does not
release an owned connection or slot early. Error normalization and finally cleanup
remain in their original locations.

Product evidence rules retain identity/timestamp/counter validation and bounded
copied provenance, rather than exposing the source object. Reason precedence stays
revoked -> expired credential -> invalid report -> missing report -> session ->
snapshot -> clock -> snapshot expiry -> report expiry. Only the two expiry reasons
are stale; other non-recent reasons are unknown. Health remains unknown and
independentProbe false. Public L2 nativeIsoTime performs the original new Date(value)
ISO operation at each original projection site. Null report/credential/snapshot
distinctions and the expiry intersection remain unchanged.

Old application/node-observations.ts, node-observation-contract.ts and
modules/node-report-observation.ts directly alias canonical leaves. The old
modules/observation-ports.ts directly aliases original L1 raw types and canonical
product types. Version, class/function/limit identities, DTO readonly declarations
and the supplied reader requirement are preserved. This exact original-port
extraction adds no breaking public semantics or new default provider.

## Relay preview source chain

There were no application/relay-plans.ts or relay-queries.ts implementations to
move. The original planRelay method body was in ControlApplication. Its exact
coordination now has modules/relay-plan-owner/RelayPlans with required L1 transaction,
scope authorization and precise RelayPreviewProvider<Tx>. The provider accepts the
original public Core Forward value and returns the original RelayPreview union.
The original RuntimeRelayHost/RelayCoordinator remains the preview implementation;
no class-derived port, new native planner, reserve/accept step or ledger is added.

The method preserves parseForwardSpec -> malformed-spec rejection -> path/Profile
requirement rejection -> transaction -> manage authorization -> preview with
id:'preview', revision:1 and enabled:true. It does not add separate actor/Scope
validation or change rejection ordering. Preview responses retain both original
endpointRevision versus endpointRevisions/path shapes and general Boolean flag
types; they are not tightened into unsupported literal claims or newly frozen.

The full original relay-query-contract.ts declarations and version constant are
canonical in relay-plan-owner/contracts.ts; the old path is a precise leaf alias.
The new provider is required and has no fallback/default. This does not extract
the existing lower Runtime Relay facts, resolver, wire or native/default chains;
those remain explicit separate source work.

## Main integration and planned acceptance

Main must import NodeObservations from node-observation-owner/public.ts and obtain
NodeObservationApi there in HTTP application ports. RelayPlans and RelayPlanApi
come from relay-plan-owner/public.ts. Add a root RelayPlans<Transaction> instance
after the existing this.relay assembly, using new RelayPlans(db,identity,this.relay).
Keep the original public async root planRelay method and delegate to that instance.
The existing root RelayCoordinator and original reader instance/policy stay unchanged.
Main owns shared readiness/boundary/index integration; those documents were not
edited here.

Planned, unexecuted cases: exact old/new exports/class/function/limits/type identity;
same reader receiver and required-provider behavior; closed input and policy bounds;
per-instance global/actor/Node admission and cooldown; cancellation before admission,
pool acquisition, reads, timeout and late resolution; no early slot/connection
release; listener/timer cleanup; original error masking and result byte limits;
all raw evidence malformed/null/counter/timestamp cases, reason precedence and expiry
intersection; provenance copy/deep freeze and unknown-health/non-authorizing flags.
Lifecycle continuation cases additionally cover replacing native globals after
module import, creation/schedule/clear call ordering, identical callback/delay/native
handle forwarding, timeout versus external cancellation races, finally clearing
before listener removal and no early release while underlying work remains pending.
Relay cases cover exact parse/path/Profile/auth refusal order, same authorization
transaction, forced-enabled preview Forward identity, unchanged endpoint union and
flags, provider receiver/error propagation and original async root delegation.
MySQL/HTTP/cancellation functional evidence belongs to GitHub Actions on the exact
authorized frozen source revision. No tests/checks/builds/experiments/CI ran here.

Remaining work includes lower Runtime Relay/private native coordination, other
Path/Ingress commands, complete HTTP chains and all-source/type/default/bridge
classification. Source relocation does not constitute acceptance.

Current main integration imports the public owners, binds RelayPlans immediately
after the original RelayCoordinator, and keeps async root delegation. Shared
raw L1/L2/L3 inventory and readiness102/103 are source declarations, unexecuted.

# Foundation B Assertion Coverage

Updated: 2026-10-20 (Asia/Shanghai).

This is the maintained acceptance map for readiness 1–220, replacing temporary
per-agent JSON and scratch extracts. It identifies actual assertion anchors and
remaining obligations. It is not a pass certificate.

## Status And Source Identity

The latest saved candidate at this map update is `fff3a91d8de003aa804420613663b72fb4e7b35b` in PR #112.
Additional working-tree suites listed below require their next saved candidate's
own Actions. The functional/MySQL/network/container/browser runs occur only in GitHub Actions.
A workflow's exact tested checkout/tree and its conclusion must be recorded with
the source revision; old passing revisions do not validate later tests.

| Assertion identification | Items | Meaning |
| --- | ---: | --- |
| covered | 184 | Identified assertions cover the whole listed requirement; execution is separate |
| partial | 36 | Identified assertions cover only the stated subset |
| gap | 0 | No sufficient direct behavioral assertion is mapped |

No percentage of B completion is inferred from these categories. A partial row
can contain many passing tests and still have a specific acceptance gap.

Foundation is **not stable/accepted**; product parallelism and release stay closed.
Independent physical-host, long-run/load and independent Responder/release gates
retain their own evidence requirements. Same-runner namespaces do not satisfy
independent physical-host acceptance.

## Execution Routing

- TypeScript Control/Core/contracts suites: `npm test`; conditional MySQL suites
  additionally run with disposable MySQL in the named `phase1` job.
- Web: `npm run test:web`; real Chromium/mTLS and Relay/multihop composition in
  `probe-workflow` and `multihop (3/4/8)`.
- Agent: full Go test/build/vet/race in `contracts`; actual native network/clock
  lifecycle in the integration jobs.
- Boundary negative cases: `npm run test:boundaries`; compile-only compatibility:
  `npm run typecheck`; public extension and generated parity in `contracts`.
- Recovery, fault, capacity and security scripts run in `phase1`; container image
  build/refusal/scan in the separate packaging workflow. No release is approved.

## Item Map

Evidence IDs below refer to the actual source suites listed after the table.
The requirement number and heading refer to [readiness section 3](foundation-readiness.md#3-concentrated-verification-plan-not-executed).

| Item | Assertion status | Actual evidence | Asserted subset / remaining obligation |
| ---: | --- | --- | --- |
| 1 | covered | E322, E323, E324 | Covered: Every explicit item1 obligation has actual graph enforcement plus named negative and positive assertions. covered is assertion completeness, not an Actions pass or foundation acceptance. Recursively scans current TS/JS/Go production leaves under Core/contracts/Control/Web/Agent internal+cmd/public examples/operator scripts; each source goes through sourceViolations using the actual foundation-boundaries-v1 inventory; missing mapped local dependency targets refuse. Invokes the canonical full graph checker against the real checkout; no saved path-count fixture or handpicked file list. Value/import type/inline type specifier, named/type/inline type/star/namespace reexports, import type expressions, dynamic import, require/import-equals and triple-slash path all reject real lower->native adapter target; computed import and require also reject. Includes triple-slash native Node type reference and comment/string non-reference control. Rejects private Core/contracts package subpaths, relative private Core leaves and cross-owner/example private imports; public Core and owner entry positive controls remain. Adds type-only private package reexports and L1 root/runtime/shared native-barrel refusal. Direct Core mutation leaves reject fetch/process/Buffer/WebSocket/URL/globalThis.fetch/native Date now/parse. Retains parser/JSON/new Date/AbortSignal/Buffer type checks and precise original Core stringify positive; Go lower tags/clock/parser/runtime aliases reject. All reference syntaxes target actual infrastructure/mysql-intent-store.ts; no fake target classification or broad composition exemption. Binding label does not exempt classified lower source native imports. Real nonbinding Control and Web owner classification rejects if/switch/ternary process.platform/arch including globalThis/computed member/native alias/destructuring, navigator facts and Deno build selection. Go L3 native runtime.GOOS/GOARCH reads reject normal/aliased/block/dot imports, OS go:build/+build constraints and OS-specific filename selection. Injected platform facts and Go comment/string controls remain allowed. A specific existing named binding is separately identified; arbitrary new owners remain unclassified. No directory-wide binding exemption added. Unknown Control/Web/Agent/operator source paths reject; a classified Control L3 cross-owner private type reexport rejects. Existing unknown product/Web/operator paths and framework/native-private/direct-store/external native imports reject. Every explicit item1 obligation has actual graph enforcement plus named negative and positive assertions. covered is assertion completeness, not an Actions pass or foundation acceptance. Recursively scans current TS/JS/Go production leaves under Core/contracts/Control/Web/Agent internal+cmd/public examples/operator scripts; each source goes through sourceViolations using the actual foundation-boundaries-v1 inventory; missing mapped local dependency targets refuse. Invokes the canonical full graph checker against the real checkout; no saved path-count fixture or handpicked file list. Value/import type/inline type specifier, named/type/inline type/star/namespace reexports, import type expressions, dynamic import, require/import-equals and triple-slash path all reject real lower->native adapter target; computed import and require also reject. Includes triple-slash native Node type reference and comment/string non-reference control. Rejects private Core/contracts package subpaths, relative private Core leaves and cross-owner/example private imports; public Core and owner entry positive controls remain. Adds type-only private package reexports and L1 root/runtime/shared native-barrel refusal. Direct Core mutation leaves reject fetch/process/Buffer/WebSocket/URL/globalThis.fetch/native Date now/parse. Retains parser/JSON/new Date/AbortSignal/Buffer type checks and precise original Core stringify positive; Go lower tags/clock/parser/runtime aliases reject. All reference syntaxes target actual infrastructure/mysql-intent-store.ts; no fake target classification or broad composition exemption. Binding label does not exempt classified lower source native imports. Real nonbinding Control and Web owner classification rejects if/switch/ternary process.platform/arch including globalThis/computed member/native alias/destructuring, navigator facts and Deno build selection. Go L3 native runtime.GOOS/GOARCH reads reject normal/aliased/block/dot imports, OS go:build/+build constraints and OS-specific filename selection. Injected platform facts and Go comment/string controls remain allowed. A specific existing named binding is separately identified; arbitrary new owners remain unclassified. No directory-wide binding exemption added. Unknown Control/Web/Agent/operator source paths reject; a classified Control L3 cross-owner private type reexport rejects. Existing unknown product/Web/operator paths and framework/native-private/direct-store/external native imports reject. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 2 | covered | E313, E325, E326, E170, E244, E327, E328, E329 | Covered: Independent protected Core public value/type closure, compile-only exact domain and lower/native generic shape witnesses, closed-family native parser suites, actual legacy canonical export identity maps and original example/error/lifecycle compatibility assertions cover the specified contracts and retained callers. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: No missing assertion identified; exact-source execution still required. |
| 3 | covered | E312, E153, E366 | Covered: Exact 5000ms hold boundary, renewal equality, absent/same/different sessions, queued multihop preservation, withdrawal and credential/Relay caps; host counters refuse before retirement/publication. FR0026 adds the normal renewal-lead constraint to queued publication hold. Host tests pin 18001/18000/17999 and 5001/5000ms remaining, same-generation hold only outside lead, mandatory new snapshot/authority/save/leases order at lead, changed-instance immediate publication and same-error rollback before lease/completion on authority/save failure. Earlier public hold/reuse/deadline cases remain. Actual Agent cutoff and multihop regression require exact-source Actions. Remaining: No missing assertion identified; exact-source execution still required. |
| 4 | partial | E153, E145 | Covered: Host fake traces cover Hello/boot history, capabilities, one Tx, authority/save/lease order and failures, stale claim after compile, report duplicate/body/fence/phase refusal and expiry. MySQL tests cover existing multihop lifecycle/withdrawal. Remaining: Full related-Node closure/lock/cleanup/drain traces and statement-level transaction fault comparison remain bounded to listed cases. |
| 5 | partial | E367, E145, E66 | Covered: SQL splitter refusal/quoting/comments and MySQL Runtime cases plus Agent read-only inspection refusal are exercised; CI supplies native build/vet/race. Remaining: No exhaustive adapter pre/post SQL/claim-competition differential; independent Windows functional execution and exact absent-field projection matrix are not supplied by Linux CI. |
| 6 | covered | E325 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: No missing assertion identified; exact-source execution still required. |
| 7 | partial | E145, E355, E354 | Covered: The configured full Actions matrix includes lifecycle, contracts, Go vet/race, MySQL, recovery, browser, namespace/multihop and container gates on each PR candidate. Remaining: Bind final exact checkout revision and all job conclusions after execution; conditional skips remain separate and physical hosts are not included. |
| 8 | covered | E368, E369, E145, E278, E154, E271, E151 | Covered: Caller-Tx Node/epoch/null/zero access, Direct same-owner refusal, protocol sort, Relay physical order/same-owner renewal, capacity after reservations, initial-owned transition lock, generation/fence exhaustion, drain retention and exact ordered removals. Existing runtime-resource-ports independently pins initialization/session/absence, Direct protocol sorting and same-owner refusal, Relay sorted physical resources and same-owner increment, capacity after all reservations, initial owned-row lock and max generation, limits and desired removal order. New native store test pins all fifteen original SQL strings/args/supplied execute receiver, raw/undefined/null/zero results and driver errors with no pool/transaction fallback. Real MySQL regression proves full Direct insertion rollback on capacity, retained physical TCP/UDP distinction and same-owner refusal, transition keeping old slots until explicit obsolete release, Relay capacity rollback restoring existing fence/generation and removing new rows, same-owner Relay fresh fences, exact owner/fence/generation removal and retained/all release. Native default/explicit-zero constructor capacity and no constructor I/O plus old shared ledger/server provider bindings are mapped to existing construction suites. Original drain retention/cross-session 5000ms boundary and null/zero max lease remain in Ledger tests. Remaining: No missing assertion identified; exact-source execution still required. |
| 9 | covered | E145, E146, E147 | Covered: Real-MySQL tests preserve succeeded history after terminal failure, fail existing deploying attempt, keep retryable active generation, reject stale reports and roll back owner/effect/response failures. Relay scenario exercises scanner terminal cleanup and duplicate delayed Report. Direct actual RuntimeLedgerHost command methods preserve record-error/fail/succeed/clear method receivers and original caller Tx, original error object and precise one/one/two/one clock samples. Actual RuntimeRelayHost executionError preserves error detail/key/digest/source actor, retryable running-only last-error path, nonretryable running failure vs separate incident after succeeded history, old generation/config/session and lifecycle/status refusal, provider first-error propagation and withdrawal time sampling. Existing private complete method exercised without production hook for all operation statuses x expired/equal/future deadline x active/stopped, cleanup selection, pending retirements, live published authority, unsafe/previous leases, deleting slots, withdrawn-but-enabled refusal and fresh observation clocks. Public advance retains original eligibility/touch/order/clock boundaries. Native store exact four command SQL/argument/error-JSON vectors assert claim clearing plus strict running/deadline terminal predicates; legacy captured Date.now executable trace preserves five samples. Real MySQL all status/deadline rows establish actual predicate effects, error detail, claim NULL vs retained and terminal-only cleanup with unrelated Forward preserved. Real actual host+ledger+store transaction injects failure after failed Operation write and before deployment withdrawal for running and succeeded source, asserts changed in-Tx row and rollback restores every original operation/deployment field, then successful run proves new failed incident plus unchanged succeeded history and withdrawal. No extra connection/transaction in owner paths. Assertion completeness only, Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 10 | covered | E145, E148, E149, E150, E151, E152, E153, E154 | Covered: Snapshot source ownership/conflicts, late publication rollback with durable independent high-water, stale-report isolation, capacity rollback, authorizer withdrawal and genuine Reports while Forward row locked have explicit assertions. Combined existing precise host tests and new gap package cover original B10 scope without arbitrary every-SQL fault expansion. Quarantine exact original 3 authorization/observation writes then Snapshot SELECT, shared native decoder and duplicate retirement SQL/provider ownership with MAX_COUNTER clamping; normal duplicate retirement transfers Operation ownership but retains original generation on real MySQL. Empty/path-only/no actor/no authorization/denied/succeeded expired/accepted opt-in paths and receiver/Tx identity, unused malformed previous/error bodies stay lazy. Current permission changes at capacity/compiler callback boundaries are observed by subsequent original collection; operation invalidation/failure/deadline during compile rejects verifyPublishable. Malformed authoritative snapshot and retired assignment fail at actual native JSON decoder after original pending/path/current-ready guards and before unsafe/session work. Monotonic accept ID->latest->clock->write with absent/zero/older/equal/newer prior, default/source/previousSpec and original retirement owner/order. Empty claim avoids ID; expiry/selector/claim first errors preserve identity; original get vs read lock flags retained. RuntimeHost tick has pre- and post-compilation stale status/token/until/clock/revision/deadline vectors, Node before Operation, no protected authority/Snapshot write and original transaction count. Real MySQL accept failure precisely after inserted Operation and before supersession rolls back every original Operation and retirement row; success proves monotonic timestamp/deadline, source/previousSpec, supersession claim clearing and retirement transfer. Real expiry accepted/running/equal deadline and recovery exclusion, two-connection SKIP LOCKED contention, token/attempt/deadline and exact claim-until reclaim boundary. Real Node then Operation locks plus NOWAIT proves Forward intent remains unlocked. Real cross-session lease +5000 strict boundary, NULL vs zero maxima, removal epoch versus other sessions, safe retirement and stopped/ready/failed distinct claim/cleanup writes. Existing tombstone sort/clamp/drain generation/deadline/absence and completion source tests retained. All functional/MySQL acceptance remains pending precise-source Actions. Direct LedgerHost traces now assert quarantine/duplicate retirement, accepted/running/succeeded intent and authority filtering, monotone timestamps, expire-before-claim with deadline/attempt/token, generation-limited tombstones and absent/null/zero/exact-boundary drains and distinct completion cleanup. Remaining: No missing assertion identified; exact-source execution still required. |
| 11 | partial | E145, E155, E156, E157, E146, E158 | Covered: Compiler tests assert peer/session/credential/generation/fence binding, deterministic immutable digests, physical TCP/UDP separation and target policy. Real-MySQL tests cover activation, grant withdrawal, stale generation reports, late failure retention and capacity rollback; real Relay scenarios include deadline/partial-protocol/retry. Remaining: No full direct host/store/observations call trace verifies transitive Node closure locks, every phase pin/retiring overlap boundary or pending-query 100 ordering. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 12 | covered | E159, E145, E160, E161, E162, E163, E164 | Covered: Node policy management/revocation replays, scope rejection, immutable policy and transaction rollback are asserted. Security script checks concurrent rotation same-CSR replay/conflict, exactly two credential records, old/current overlap cutoffs and unchanged session/revision. Transport script tests Relay credentials and caps. NEW host fake records receiver, exact supplied Tx, method args, call prefix and original error identity. Enrollment covers invalid request short circuits, digest before transaction, token hash failure inside Tx, missing/revoked/equal-expiry tokens, same CSR persisted replay versus conflict, sign failure and expiry while signing, accept then fresh clock sample then credential insert. Every persistence ordinal fails with rollback and no published credential. NEW machine and Relay rotation matrices compare Runtime lock -> current Node lock -> credential -> replay before superseded-source rejection; missing/revoked/expired source, replay conflicts, active Relay count, sign, second credential read and post-sign expiry. Every read/sign/write/audit failure stops exact prefix with original error and rollback. Exact signer arguments preserve default control omission and explicit Relay purpose; credential/request/security event order and native result field order pinned. NEW Relay authority uses original min(certificate,machine,lifetime), overlap min(authority,window), zero versus one active old credential and limit two; original initial machine bound retained after signing. Relay facts currentOnly both booleans, count 0..3, original sha256 coercion/error, mapping field order and min(valid,retire,node) bound pinned. Machine lookup and credential min(valid,retire) equal-expiry denial retained. NEW grant matrices cover no-op both directions, changed grant/remove, exact revision conflict, revoked refusal only for grant, max-safe exhaustion versus max-safe no-op, invalid subject/revision/flag, permission failure and each provider stage error. Visibility -> Runtime lock -> scoped Node read -> grant revision lock -> optional subject authority -> hasGrant -> mutation -> revision -> access audit order uses caller Tx. All three revocation/quarantine statements and first-error cutoff pinned. NEW authorization scope/grant/not-found/state/revoked/time/network tests and canExecute short circuit preserve no new authority. Native intent tests pin Node/Scope/listener/port before direct runtime, separate adp/direct capability getter reads, protocols then target/provider receiver. Cleanup retains revoked facts only within original Scope. NEW policy exact fields/invalid types/duplicate arrays/single revision and deep immutable independent command snapshot. View pins pendingRevocation including absent/zero leases, latest authorization formatting and no credentials. Legacy Nodes defaults/captured clock/native codec/secrets/same NodeService+Host ownership and native random token32-byte base64url/hash outputs retained. NEW independent exact literal SQL matrix covers every MySqlNodeAuthorityStore method, currentOnly and lock switches, SQL argument order, FOR SHARE/FOR UPDATE, JSON encoding, returned native row/list identity, missing rows and each statement failure; pool-backed machine lookup does not open a Tx and preserves pool receiver/separate time samples. Signed property/native JSON getter faults occur before execute in original evaluation order. NEW canonical migration-backed MySQL uses real NodeService, native NodeStore, Identity and original RuntimeResources on one captured transaction. Injects failure at every real enrollment2, rotation5, Relay4 and grant3 write; complete Node/grant/credential/replay/security/access/membership/Runtime/lease snapshots restore on rollback. Native replay does not sign or write, old live credential replay allowed before new issuance refusal. Grant access audit and visibility -> Runtime lock -> scoped Node FOR UPDATE verified. Revoke/quarantine fail at each of three real writes, commit revokes only original credential tables and repeat quarantine preserves requests/history. NEW native OpenSSL CA accepts only original P256 CSR, pins default control versus explicit control/Relay EKU/SAN, caller Node subject, native fingerprint and validTo, CA chain and cleanup; RSA/malformed CSR refusal cleans temporary work. Existing legacy-owner-defaults.test.ts retains captured distinct clock samples, native aliases and resources construction; node-management-ports.test.ts retains immutable commands and whole-Node reconcile/audit atomicity. No production authority or Journal implementation changed. Remaining: No missing assertion identified; exact-source execution still required. |
| 13 | covered | E1, E2, E3, E4, E5, E6, E7, E8, E9, E10 | Covered: Old Sample/Clock/Ticket names compile in both directions as lower aliases Replacing old private Guard.clock is observed exactly once by Check/ValidateServerTime/Credential/Accept and already-issued Ticket.Allow/Drain; original clock not sampled, same single lower Guard retained Read failure triggered by pre-existing Ticket maps to stable CLOCK_UNCERTAIN; subsequent API calls preserve same error identity before resampling healthy replacement or validating invalid server/credential/snapshot arguments; failed Drain remains nonauthoritative Nil old/lower Ticket.Allow returns exact LEASE_EXPIRED refusal Nil clock, zero/negative skew and maximum<=skew refuse before clock; initial provider failure returned once with original identity Old authorization entrypoints/types and private clock compatibility, one lower Guard, read-error latch, nil Ticket and nil-provider refusal are covered by existing guard_compatibility_test and executiontime synchronization tests; no duplication added. Sample/Evidence/second-sample traces, blocked provider,2s cache/rollback,30s freshness,500ppm and native host/platform/parsing order are covered by existing executiontime suites plus new native fact projection/cache tests. Actual native counters are exercised with uptime-before/SystemClock/uptime-after and wall brackets, UTC and unsupported platform exact errors. Current source inventory confirms Linux CLOCK_BOOTTIME syscall clock ID7 and Windows QueryInterruptTimePrecise100ns conversion; neither was changed. Runtime branch tests belong on their respective OS Actions jobs. Windows parser adds invalid/fractional leap/stratum/state, negative/overbound delay/dispersion/offset/holdover, local reference, empty source,NaN/Inf,extra layout and decimal-comma cases; existing forgery/unknown/stale/missing proof tests retained. Existing old-ticket/no-renewal/expiry/server-skew/jump/read-latch tests plus new exact skew edges, negative uptime/zero-wall initial refusal, uptime rollback stable latch, coherent suspend delta with expired ticket/no session revival, duration0/negative/short/long drains x no/earlier/later credential cutoffs and exact deadline boundaries. Covered describes authored assertions and actual current source inventory. No claim of executed suspend/resume physical-host acceptance; this remains an independent execution gate rather than an invented missing API consumer. Remaining: No missing assertion identified; exact-source execution still required. |
| 14 | covered | E11, E12, E13, E14, E15, E16 | Covered: Durable-before-error and not-durable Save outcomes preserve original authority with wrapped original cause. Authenticated reload refuses old caller before input and admits equal durable generation without Save. All native history compared fields, exact encoded native bytes versus decision-only projection, foreign node, generation rollback/digest conflict, active-to-prepared refusal and initial lazy prior are explicit; existing authenticated MAC/history/Runner save-before-bind cases retained. Remaining: No missing assertion identified; exact-source execution still required. |
| 15 | covered | E17, E18, E19, E20, E21 | Covered: Actual AtomicWrite function body is parsed and staged with only OS selectors replaced by test-owned effects; no production hook or copied implementation. Eleven vectors run with POSIX and Windows path-separator semantics: create/chmod/write/file-sync/close/rename/directory-open/directory-sync/directory-close/remove, simultaneous first/cleanup failures, exact paths/raw bytes/0600/order, protected target outcome and best-effort cleanup. Actual unsupported lock body is compiled without its platform build tag and must refuse with no release. Existing native atomic/lock/Journal/proof/inspect/migration tests remain complementary native evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 16 | covered | E22, E23, E24, E25, E26, E27, E28, E29 | Covered: Runner request injected provider receives original context/client/base/method/path/raw backing slice/epoch/session exactly once; native raw+generic error identity retained, value and wrapped-value HTTPError map once to original private httpError; pointer-form HTTPError retains original errors.As behavior Default identity/channel wrapper families retained; explicit constructor nil refusal existing platform_contract_test.go Machine rotate real owner success/failure order: Prepare->request->Validate->Save->Locations->Load->Probe gate close/cancel before certificate publication->Guard.Credential original sample->idle close->Remove. Save/reload/Guard/remove failures stop later effects; same fingerprint retains Probe and skips idle close; machine values/expiry/fingerprint published exactly once at old stage Existing PendingResponseCompleteMachineDurableRetryAndPublication, RunnerTimeOwnerCompleteMachineRotationReloadAndPublication, PendingResponseCompleteRelaySaveRemoveAndCrashRecovery, InitialMissingAndLaterStoreError, ProtectedOuterInnerAndMACErrors, PermissiveMachineVersusStrictNativeRecords, RetainedPendingCleanupAndPublicationFailures preserve durable replay/serialization/strictness/cleanup branches Main native channel NewClient same roots pointer/TLS1.3 minimum/verification/10s timeout/exact redirect error; live TLS callback returns current certificate values on every invocation and retains old snapshots Request exact method/base-trailing-slash/path/query/content type/epoch opt-in/full uint64/raw bytes/context; body read-before-close and close once/ignored close error; original4194305 limit returns limit+1 and truncates larger sources without adding a new size refusal; reader identity and permissive non200 Code behavior (duplicate LAST, malformed/type error empty code) retained Native original transport errors/cancellation wrapping via errors.Is, actual localhost redirect refuses after one request/no retry, actual server sees cancellation; idle close delegated once Actual TLS1.3 mutual handshake with configured CA, certificate callback rotates from node-before to node-after after idle close; unknown configured server trust refuses; native machine identity pending tests keep responseCA informational Remaining: No missing assertion identified; exact-source execution still required. |
| 17 | covered | E25, E14, E30, E31, E32, E26, E33, E34, E35, E36, E37 | Covered: Injected constructor complete success traces and failure table: flags/URL before any effect; proof paths->roots configuredCA->key same32byte backing->authenticated LoadRuntime->extension refusal->Locations/configured trust->LoadMachine->EnableRuntime explicit import->NewClient. Every error returns nilRunner/original sentinel and no later effect; original history/raw/maps/extension references retained with no scheduler read Native Bootstrap exact32bytekey, invalid/missing key stable refusal, valid/invalid/missing configured rootCA; actual default New/WithProviders/WithEffects/WithLocalServices use genuine native certificates/roots/authenticated Journal and do not add state files/locks or write Journal Native Bootstrap missing/corrupt LoadRuntime and EnableRuntime refuse without initialization/history repair; existing state migration/corruption tests retained Actual Runner.Run hello retry1/2/4/8/16/30/30s cap and cancellation;401/403/SESSION_SUPERSEDED/INTEGRITY_FAILURE return after one request/noAfter. Hello retry bytes unchanged; idle close exactlyonce Current observation-owner tests already cover500ms Host bound/nooverlap/late drop and Run diagnostics/guard joins/tickers; Probe wire-owner tests already cover exact WithTimeout/WithDeadline/AfterFunc stop/cancel/body close stages and operational entropy/deadline callsites Actual Guard provider remains separate from injected scheduling; constructor fake schedule has no implemented clock and never runs; existing synchronization/Guard clock owners retain their explicit time policy tests TestScheduleOwnerCompleteNativeTimersAndReadDomain: native Now bracketed by real clock, Since and Until bounded by adjacent native calls; After(0) completion; concrete native Timer/Ticker channel identity, active timer Stop true then false, consumed zero timer Stop false, repeated ticker Stop TestScheduleOwnerCompleteNativeContextDeadlineAndAfterFunc: real timeout creation deadline bracket, exact explicit deadline, parent cancellation with original context.Canceled; timeout zero and past deadline use context.DeadlineExceeded; native AfterFunc executes once after cancellation, started stop false, pending stop true then false and suppresses callback TestRunOriginalHelloBackoffFatalAndEarlyFailures: true Run source 1/2/4/8/16/30/30/30 second Hello backoff, exact retry arguments and hello projection, cancellation, four terminal refusal predicates, malformed/decode/identity/guard/parser/server/Relay setup short circuits, idle close and stop TestRunOriginalCredentialRenewalRetryReportAndRetirement: requested rotation failure retries and successful rotation clears flag; exact renewal-lead equality versus +1ns; reload original error; Relay ensure once then repeated failed renewal waits 7 seconds and skips reconcile/report; successful renewal proceeds; repeated poll/report failure warns and retries at policy interval; empty pending skips report; 401/403/SESSION_SUPERSEDED retire with subsequent 1 second waits and no more reload/poll/report; INTEGRITY_FAILURE during poll remains nonretiring; guard ticker stop and outer cleanup once TestRunOriginalWorkersCancelAndJoinBeforeReturning: real Run starts all four telemetry workers with same initial sample, registration and execution owners, diagnostics; blocks telemetry exits to prove Run cannot return before joins; all cancel and done once; exact 100ms guard, 500ms diagnostics and 10s counter ticker creation/stop, final diagnostics/counters, separate 2 second registration cleanup TestRunOriginalRetirementCancelsRegistrationBeforeExecution: 401 retirement cancels Probe registration and waits independent revoke cleanup while execution child remains live; final run cancellation then joins execution; exact policy then 1 second retired wait TestProbeOriginalRegistrationBackoffResetSessionEndAndCleanup: 5/10/20/30/30/30/30 failure waits, success expiry-minus2seconds and failure backoff reset to5, minimum1second, session.done stops current timer and immediately registers again, terminal401/403/SESSION_SUPERSEDED no timer, INTEGRITY_FAILURE still retries, timer Stop on cancellation/end only, already cancelled start performs no registration; every exit revokes with uncancelled Background child bounded2seconds and invokes cancel despite ignored revoke error TestProbeOriginalExecutionOneSecondPostCompletionNoOverlap: each original task completes before1second timer allocation, failed task result ignored and future independent polls continue; no overlap; cancellation stops active timer; already cancelled start performs no work TestProbeOriginalMonitorDeadlineTicksAndDeferredCloseOrder: Until receives exact session.until; deadline timer and25ms ticker; parent cancellation/deadline/foreign session/stale current end monitor, true current branch continues; native gate-close after session cancel; done closes after all deferred finalizers; current guard remains under Runner mutex TestProbeOriginalSupervisorExactDeadlineRefreshChangedAndTicker:25ms ticker; pre-cancel and local failure skip timer, original local error identity; Until receives minimum execution/fresh deadline, equality and past deadline deny; timer selected after freshness extension rechecks new min and does not deny; changed and ticker stop current timer before next local check; cancellation stops next timer and closes done TestProbeOriginalWatchFortyPostCompletionPollsAndReleaseJoin: real40-attempt bound, each50ms wait allocated only after preceding status completes, first result once, first/later failure original error and no retry, cancellation stops wait, session AfterFunc denies and is stopped once, watch cancellation joins supervisor/ticker before release, done closes only after release Remaining: No missing assertion identified; exact-source execution still required. |
| 18 | covered | E38, E39, E40, E41, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53 | Covered: Four CloneTelemetry independent native pools, declared limits, base immutability, exact family redirect messages and native-transport refusal Four native telemetry requests preserve POST/path/raw bytes/JSON content type/full uint64 session epoch/context and caller-owned unread/unclosed response Current original Linux readHostResource/CPU/memory/load/filesystem/network functions executed by source-effect fixture: exact bounds+1 and closes, aggregate/core duplicate/missing/65536 bound, CPU guest exclusion and arithmetic overflow, kB units/refusal, load fixed-point/refusal, filesystem block fallback/overflow, network 16 sorted truncation/loopback/128 source bound/last colon/name/16 fields/unsigned refusal Actual native Linux availability values/scopes and non-Linux full unsupported JSON; all native/lower alias/layout and retained default-wrapper assertions Pre-existing Probe wire/claim/delivery evidence remains credited; no repeated176 tests Remaining: No missing assertion identified; exact-source execution still required. |
| 19 | covered | E54, E25, E41, E55, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53 | Covered: Real Runner captureTelemetry and writeDiagnostics exact Memory/Process/Now/PID/Platform/Goroutines read order; Remaining outside lock for telemetry versus inside for diagnostics; each OS/provider read verifies Runner lock released Native PID/platform/goroutine/memory and Linux process counters supported, non-Linux absent rather than zero; native full Host unsupported literal JSON Disabled diagnostics returns before any effects; configured original path, measurement sentinel identity, values/units/time format, nil/zero/negative counter projection; retained default native helper families Four maintain exporters read exactly16 bytes independently, lowercase unique epochs; random error closes clone before ticker/HTTP; original short-count+nil-error behavior retained Four failed exporter samples await next external tick, seq1/2 and dropped0/1, same epoch/no extra entropy/retry/catchup; original four loop sequence max boundary via only local state-entry AST seed Host500ms worker blocked/no overlap, ticks drop while pending, late result drained/discarded, next fresh result sequence/drop accounting; exact cutoff equality result path refuses send; capture onlyNow/Platform and resource pointers/slice pass through Native configured/sibling diagnostics writes preserve bytes/0700 parents/0600 files/atomic temp cleanup; mkdir and rename failures preserve histories; underlying file write/sync/close/rename/directory-fsync branches existing platformstate atomic_effects_complete_test.go Actual Runner.Run drives500ms/10s diagnostic failures, identical single-argument warnings, drains diagnostic/counter/guard ticker before execution.Close->final diagnostics->final counters->close-idle; Local.Warn uses original stderr Fprintln argument/newline placement Existing Probe32-byte entropy, result deadline/guard/trust/one-use tests retained, not restated as new coverage Remaining: No missing assertion identified; exact-source execution still required. |
| 20 | covered | E165, E166, E145, E150, E167, E168, E169, E164, E170 | Covered: Token grammar rejects whitespace/Unicode/lengths. Access port tests assert same-Tx current owner rechecks/replay/no-op/immutable token digest and rollback. Real MySQL/script assertions cover owner protection, member CAS/account conflict, orphan-account/replay rollback, scoped permissions, recovery token invalidation and retained Journal generation. NEW owner fixture exhaustive auth/member/bootstrap/list/recovery errors/order/receiver/Tx matrices and native boundary grammar. NEW independent literal SQL table covers all17 MySqlIdentityStore methods, projection fields/raw identity/empty/query errors and exact original argument order. NEW raw duplicate versus member-only mapping, delegated receiver and native UUID-clock-JSON first error order. NEW canonical MySQL bootstrap/member/account/audit/prior Runtime rollback all write ordinals and real recovery sorted lock/all tokens before nonowner deactivation; complete database snapshots preserve unrelated authority/history. RETAINED identity-input.test.ts, legacy-owner-defaults.test.ts, legacy-entrypoints.test.ts, access-command-ports.test.ts and current public-type consumers; root exact-candidate Actions still required. Remaining: No missing assertion identified; exact-source execution still required. |
| 21 | covered | E171, E145, E161, E156, E172, E173, E174, E175, E164, E170 | Covered: Profile grant tests cover authorization before replay, revoked/restored/no-op/stale/cross-scope references and failure rollback. Transport script asserts Profile concurrent CAS/history/no-op/changed-key conflict, Endpoint reference refusal and credential issuance. Compiler tests cover normalization/refusal. NEW explicit TransportService and RelayEndpointService fixtures assert original provider receivers and same caller Tx, with prototype-based Identity/Forward references. Legacy constructors retain same canonical owner, native codec and dynamic clock. RETAINED transport-formatter-complete.test.ts132 pins formatter prerequisite before provider effects, custom receiver/timestamps/native ISO clipping and exact failures; legacy-owner-defaults.test.ts pins captured UUID, dynamic clock, constructor arity/default provider/old export aliases. NEW native Profile and endpoint normalization/closed malformed unknown fields; keys ASCII1..128; original Profile JSON.stringify inherited toJSON success/error preserved, endpoint parser does not serialize input. Public result key order and mutable native records preserved. Profile config normalized before config/request digests; publication request uses original method/path/expectedRevision/config. Endpoint keeps separate input parse then request digest. NEW Profile publish traces owner -> idempotency -> ensure -> current FOR UPDATE; initial revision encode -> clock -> immutable insert -> current pointer -> initial owner grant -> response. Same-key replay is owner-gated and skips owner writes. Invalid inputs refuse before transaction. Scope/stale conflict before old revision read, missing old revision, lazy malformed JSON/parser/digest errors, unchanged/noop at max revision, changed max exhaustion and all provider/write/pointer/response failures roll back with original error identity. NEW locked resolve retains Scope manage and authorized Profile grant before requested immutable revision, lazy decode/parse/digest integrity. get ordinary Scope without manage then current pointer and requested immutable revision, original formatter response field order; list/grants retain original permissions, sorted provider ordering and response shape. Missing grant and digest refusal stop original stage. NEW Profile grant owner -> Profile FOR UPDATE -> optional subject management -> exact-one count -> Forward reference lock -> mutation -> grant revision -> UUID -> now -> native encode -> grant event. count0/1/2 x allowed true/false covers original exact-one semantics, no-op without live check/event including max-safe, missing/stale/exhaustion and every stage error. Existing transport-grant-ports.test.ts retains original application owner-gated replay/noop and same-Tx Runtime reconciliation/rollback/operation IDs/current grant contracts. NEW endpoints owner -> claim -> Node management/revoked -> endpoint FOR UPDATE -> revision/digest -> Forward references -> encode -> now -> save -> Node security audit -> response. Missing initial endpoint, replay, revoked/stale/live-changed refusal, no-op with live references without Forward query, max-safe noop/changed exhaustion, malformed stored JSON, old valid JSON shape digest-only without new parse and all provider/save/audit/response failures retain original error and shared rollback. NEW endpoint get is Scope -> Node cleanup -> shared endpoint read -> decode/parse with false execution support, missing/corrupt failures and original Tx. Native stores preserve raw row/config identity and do not eagerly decode. NEW independent literal SQL matrix covers all17 Transport store entries and3 endpoint entries, raw row/list/boolean/count shape, empty values, exact SQL locks/order/args/opaque encoded values, supplied executor receiver and original query failure. Legacy static quarantine calls exactly DELETE transport_profile_grants with original failure; no other table mutation. NEW canonical production-migration MySQL composes old native Transport, RelayEndpoints, Identity, Nodes, Forwarding and Idempotency over one captured caller Tx. Every publication6 SQL write, grant3 and endpoint4 write failure restores full canonical database snapshot, including original request/history and Runtime rows. Captured native grant Forward lock precedes authority mutation; endpoint visibility -> Runtime FOR UPDATE -> Node FOR UPDATE -> endpoint FOR UPDATE -> Forward references -> endpoint insert -> Node security event exact order. NEW real MySQL successful same-key publication replay leaves full database unchanged, successful Profile grants and endpoint publication, active Forward no-op allowed versus changed endpoint refusal with rollback; actual restored idempotency row refuses replay with RECOVERY_REPLAY_REQUIRES_REVIEW. Static Transport recovery authored only for Actions deletes grant rows and full snapshot confirms all other canonical tables/history unchanged. No local recovery experiment run. RETAINED legacy-entrypoints.test.ts, legacy-owner-defaults.test.ts, transport-formatter-complete.test.ts, transport-grant-ports.test.ts, transport-query-ports.test.ts and current compiled public consumers cover old parser/type/constructor imports and independent HTTP/Node/Forward ports.135 is Hono Bindings/API entrypoint and is intentionally not remapped by this Transport owner slice. Source assertions require root exact-source static and Actions; no physical/release claim. Remaining: No missing assertion identified; exact-source execution still required. |
| 22 | covered | E176, E177, E145, E178, E151, E164, E170, E179 | Covered: B direct fake stores assert key snapshot across ensure/lock awaits with live digest, recovery refusal before decoding, pending/completed decode identity/fault, response evaluation order, separate Forward encodes across awaits, CAS affected rows 0/2 and no history after failed current write. Command ports/real MySQL assert one caller transaction and atomic rollback. New literal native SQL table pins all 17 Forward and four Idempotency statements, exact filters/FOR SHARE/FOR UPDATE/newest25 ordering, original parameter order/Tx receiver/raw references/absence/affected count and every driver failure. Actual ForwardStateService asserts lazy raw revisions, missing record before decoding, mutable spec identity, flags, actor/profile argument translations, null authorizer and profile-first reference selection. Existing intent-store-ordering assertions retain separate encodes around awaited writes, CAS refusal before history, stable key snapshot/live digest and respond evaluation order. Existing command/owner real-MySQL rollback and same-Tx integration plus constructor/legacy/type tests preserve caller transactions, public aliases and old generic defaults; no new clock/authority or duplicate ledger is introduced. Remaining: No missing assertion identified; exact-source execution still required. |
| 23 | partial | E180, E181, E177, E166, E159, E160, E150 | Covered: HTTP structural fakes assert original actor/scope/key/operation args, body/status/no-store, strict duplicate/unknown-body rejection, cookie/anonymous refusal, scoped operation reads. Owner port and real HTTP scripts exercise mutations, policy/revocation and membership. Remaining: Not every management HTTP method has an independently typed complete structural fake; all inherited NodeApi/nullable/readonly signatures and every machine CSR/rotation error status need explicit contract tests. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 24 | partial | E182, E183, E184, E185, E175, E186, E187, E188 | Covered: Authorized same-Tx query fakes/SELECT-only real MySQL assert scope-before-read, bounded detached paging, exact native grants/reference revisions, non-authorizing metadata, four-peer windows and denial/corrupt rows. Remaining: Full old/new declaration identities and every optional/default HTTP argument are not established; exact callback/conversion clock boundaries need direct traces. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 25 | partial | E189, E190, E191, E192 | Covered: Transit mTLS machine path rejects missing verified TLS, retired boot/revoked credentials/capability spoofing; delivery offline MySQL asserts commit/replay/status/current identity without advancing execution. Relay production HTTP planning is exercised by relay script. Remaining: No dedicated complete structural RelayPlanApi/Transit API substitution test or full route argument/error-precedence matrix. Real Relay reservation-free preview path needs explicit no-write assertion. |
| 26 | partial | E193, E194, E195, E196, E197, E198, E199 | Covered: Path template/binding tests assert closed inputs, scoped manager/grant reads, CAS, quotas, immutable history, shared Forward rollback and SELECT-only impact. Browser scripts exercise template/binding and publication workflows. Remaining: All five Path/Ingress HTTP APIs are not covered by structural fake route tests; IngressGroup resolution/migration/deployment has no dedicated owner MySQL suite. Browser publication coverage is narrower than exhaustive Ingress semantics. |
| 27 | partial | E181, E200, E201, E202, E203, E204, E205, E206, E207, E208 | Covered: HTTP/owner tests check mTLS identity rather than Bearer/header substitutes, detached minimized receipts, owner commit before ACK, spent claims and bounded delivery/status, replay/conflicts/current grants and exact-Tx result rollback; machine/permit real MySQL is covered. Remaining: Typed v2/service v3 qualification/poll/claim/status/result APIs lack full dedicated adapter tests; all eleven independently typed HTTP fakes and staged v4 behavior are not proven. No new Echo acceptance is inferred. |
| 28 | partial | E183, E184, E185, E175, E186, E187, E188 | Covered: SQL-fake tests assert scope before projection, bound scoped count/page filters/literal bounded offsets, candidate/overview gates, count independence and diagnostics sanitized reads. SELECT-only MySQL suites assert real raw projections and unchanged persisted tables. Remaining: Full seven-consumer synchronous callback-after-final-read traces, conversion/getter/error/clock ordering, native iso(undefined) refusal and count-vs-page live-reference changes lack dedicated assertions. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 29 | covered | E56, E57, E14, E58, E59, E60, E61, E62, E63, E64 | Covered: Public aliases, generic/native bindings, fields/method sets and descriptor literal serialization; bounded declaration validation/first errors/zero/nil behavior and detached slices; runtime.GOOS native selection; unchanged native callbacks/default catalog/identity/error/max conversion; real Relay phase partial cleanup and exact successful pointer identity. Existing original engine/Runner/current-instance and boundary anchors remain necessary evidence rather than new duplicate suites. Remaining: No missing assertion identified; exact-source execution still required. |
| 30 | partial | E209, E210, E211, E212 | Covered: New B table checks all five optional telemetry HTTP families via named/positional construction, absence status, admit-before-auth, release on auth/owner errors, cookie/unknown-query refusal and body passthrough. Cancellation identity crosses public ports. Adds only recovery SQL ordering, retained raw/rollup sample flags/history preservation, operational head/cursor reset and same-Tx rollback across four telemetry families. Reuses existing HTTP/type/telemetry suites without modifying them. Remaining: This bounded recovery package does not establish the remainder of the original item30 requirement: actual optional HTTP disabled collection versus absent adapters, per-family four-request/two-active/key/cooldown and observation-pool refusal, full credential/boot/session/sample/digest/rate ingestion checks, replay/conflict, mapping/rollup append order, retention/corruption refusal, delta gap/reset/overflow/terminal cases and aggregate window/resolution/cursor/bucket quality. Retain root's existing detailed item30 mapping; recovery tests cannot certify whole telemetry owners or erase those residuals. |
| 31 | partial | E209, E211, E212 | Covered: New B table checks eight remaining optional HTTP families named/positional availability, admission/auth/owner ordering and release/error mapping, and rejects unknown query/cookies before owner calls. Adds bounded Station/Notification recovery data semantics and real native Station event-before-outbox same-Tx handoff without secret/send/authority effects. Broad item31 remains partial; existing worker/HTTP/recovery suites are retained. Remaining: This package does not close original item31 diagnostics/audit/query provenance/budgets/observation-pool, all Station command CAS/silence/replay/ack/member-manager permissions, complete Notification read redaction/vault staging/enqueue duplicate/history/retention/loss/worker sender cases, Probe history/finite-plan/service metadata and type/admission boundaries. Retain root's existing detailed mappings and remaining owner-specific requirements; exact recovery SQL coverage does not certify all those APIs. |
| 32 | covered | E65, E66, E31, E67 | Covered: old CLI flags, proof/path/inspection/enrollment priority, instance/signals and exact options: Retain agentcommand/native_cli_complete_test.go and command_run_lifecycle_test.go/inspection_test.go. TestAgentCLICompleteModeAndCompetingFirstRefusalOrder and TestAgentCLICompleteEachEchoAndServicesDependencyRefusesBeforeEffects preserve original priority/each flag short circuit. TestNativeOriginalAbsProofRelPredicateAndJoinOrder, TestNativeOriginalReadonlyKeyMasksAndStdoutEncoder, TestNativeOriginalBootLockDiagnosticsSignalsAndEnrollmentEffects and TestNativeOriginalMainRunEnrollmentSignaturesStderrAndExit stage actual original native/CLI source, exact paths and8 enrollment options, invocation-time token, one success message only via completed callback, before reply/client defers. TestAgentCLICompleteEveryRunnerOptionAndNativeCancelBeforeLockRelease/ActualNativeInterruptAndTermination retain lock/Runner/signal lifetime. generic exact operation/argument/error/cleanup order, no effects after first failure: Retain executionenrollment/enrollment_failure_order_test.go TestEnrollmentEveryFailurePreservesOrderAndCleanup for missing token, existing-state refusal, directories, CSR, configured roots, post, decode, certificate validation, entropy, MAC write, Journal init, certificate write and success. Exact sentinel identity, original argument refs, reply close then idle close; close errors cannot replace original failure/success. New native compile assignments pin Platform/Channel full generic method sets and exact Native return specialization. native Stat/read/directory/private/CSR original behavior and native delegates: TestEnrollmentNativeCompleteCSRGenerationReuseAndOriginalReadErrors asserts P256 PKCS8 private key, signed CSR CN/original paths, exact existing opaque CSR/private reuse, private read-error generation versus CSR non-ENOENT refusal, invalid PEM/PKCS8/nonECDSA, native0700 on supported OS, all original Stat errors treated absent and any existing protected state refused. TestEnrollmentNativeCompleteOriginalFileFailureAndJournalDelegates exercises first/second mkdir failures and retained first directory, missing CA original os error, missing private creation before existing opaque CSR reuse, native AtomicWrite bytes/overwrite/rename error, original Journal EXCL refusal preserving existing protected bytes. native configured roots/PKI, JSON projection, TLS/HTTP/no redirects/retry and response stages: TestEnrollmentNativeCompleteChannelConfigurationBoundedDecodeAndErrorOrder pins native TLS13 roots, ten-second timeout, redirect policy, nodeId/token/csr body with original JSON invalidUTF8 conversion, trimmed URL POST/contenttype and transport error one call. Decode checks read before status before strictIJSON before typed Unmarshal, duplicates/typed field/32769 oversize versus exact32768, no early close, unknown fields and response CA retained, CloseReply original error. TestEnrollmentNativeCompleteActualHTTPSRootTLSNoRedirectOrRetry uses real TLS13 server and original Channel.Open/Post/Decode: configured trust successful exact request, redirect one request and original refusal,503 no retry, wrong roots before handler, actual TLS12 endpoint refusal. native certificate identity/client EKU/current clock/keypair and roots ownership: TestEnrollmentNativeCompleteConfiguredTrustAndCertificateRefusals creates actual PKI and checks configured roots success, missing/wrongNode/untrusted/expired/serveronlyEKU/key mismatch, native ReadRoots valid/malformed, ProtectionKey32, Native exact Platform/Channel and nil Completed. Actual final Host cases supply malformed response CA while retaining configured roots, proving response CA ignored. final write order and durable partial state retry/no rollback/reset: TestEnrollmentNativeCompleteFinalWritesRetainPartialProtectedStateAndCleanup executes actual generic Host plus native CSR/CA/PKI/key/state effects, injecting each final write boundary failure. Trace MAC->original InitializeRuntimeJournal->certificate->completed->replyClose->idleClose; body stays open during completion, ignored cleanup error, no success on errors. Native on-disk MAC and authenticated original Runtime Journal generation0 remain after later failure; protected partial publication refuses retry before further effects; MAC failure leaves no protected write and permits pending retry; same key/opaque CSR bytes preserved. No second Journal or authority introduced. native entropy failure semantics on actual declared Go1.26.3: TestEnrollmentNativeCompleteEntropyFailureUsesActualGoFatalBoundary runs native Platform.ProtectionKey in a child with a failing Reader and requires actual crypto/rand fatal diagnostic, rather than pretending native rand.Read returned an error. Native P256 generation and32-byte MAC success stay real; generic host entropy error branch has existing fake-port coverage. "On Go1.26.3 rand.Read never returns an ordinary error, so its native returned-error guard cannot be induced without replacing the function. ECDSA ignores custom Reader by default; no cryptocustomrand runtime override is used to claim native key-generation errors. These runtime-unconstructible guards are explicit qualification, not inferred executed coverage. HTTPS/file/PKI/entropy-child assertions are authored only and require authorized Linux/Windows Actions on the exact source. Independent physical-host evidence remains outside this item." Remaining: No missing assertion identified; exact-source execution still required. |
| 33 | covered | E68, E69, E70, E71, E72, E73, E74, E75, E35, E76, E77, E78, E79, E80, E81 | Covered: native Direct header/digest/config/policy/target refusal and identity/order; no authority/dial in helpers: TestNativeConstructionCompleteDirectProjectionRefusalAndNumericEndpointMatrix; nativeexecution/runner_dispatch_complete_test.go: TestRunnerDispatchCompleteOriginalDirectRelayAndMultihopEffectOrder; nativeexecution/probe.go: DirectProbeDestination remains projection-only Runner protocol/Node/boot/session/generation/Guard/Ticket/duplicate/missing/nil/current tuple and detached CIDR/deadline/callback: control/native_direct_probe_test.go: all three TestProbeHost tests; TestNativeConstructionCompleteDirectProjectionRefusalAndNumericEndpointMatrix; control/probe_wire_owner_complete_test.go: TestProbeWireOwnerCompleteServiceContextTLSValidationAndNowStage; control/probe_echo_target_complete_test.go configured/observed endpoints, port min/max, mapped/zone/unspecified/multicast/link-local/metadata/policy; exact service business equality; no fallback: TestNativeConstructionCompleteDirectProjectionRefusalAndNumericEndpointMatrix; TestHandshakeCompleteStrictNewAndLeafRefusalsHaveNoFallback; probe/probe_test.go: TestProbeRejectsDNSMetadataAndForeignBindingsWithoutDial; probe/echo_binding_complete_test.go strict Context/New/Current/VerifyConnection digests/DER/leaf/SAN/EKU/key/purpose/time/pin/resumption: TestHandshakeCompleteStrictNewAndLeafRefusalsHaveNoFallback; TestHandshakeCompleteTrustNativeClockAndVerificationBoundaries; TestHandshakeCompleteNativeTLS13SNIAlpnRevocationAndNoCallerClose missing context deadline/SetDeadline error, before/after revoke, cancellation close, RX/TX exact caps/partial IO/budget, TLS13 SNI ALPN, timeout vs unknown/unverified, original raw socket ownership: TestHandshakeCompletePrerequisiteDeadlineAndUnknownErrorOrder; TestHandshakeCompleteWireExactCapsPartialIOAndIndependentBudgets; TestHandshakeCompleteNativeTLS13SNIAlpnRevocationAndNoCallerClose; TestHandshakeCompleteCancellationClosesRawAndTimeoutDenies missing verification last refusal and old handshake wrapper/budget alias: observationtrust/handshake.go: verified == nil remains final fail-closed branch after successful native HandshakeContext; probe/service_tls.go: original wrapper maps native error to ErrDenied and alias is observationtrust.ErrTLSBudget Qualification: No successful native TLS handshake can skip the configured VerifyConnection callback; unreachable final guard retained by source, not claimed as independently injected native runtime evidence. Gate 256-ID burn/global admission/monitoring/one-use/current watch/result/counter/freshness; unchanged staged echo and debt inventory: probe/gate_test.go; probe/probe_test.go; probe/counters_complete_test.go; probe/echo_exchange_complete_test.go; control/probe_wire_owner_complete_test.go; TestNativeConstructionCompleteExplicitProbeDeadlineWatchDeferAndEntropy Qualification: Boundary classification/native Linux-Windows/physical host/feature integration gates remain independent and unexecuted. Remaining: No missing assertion identified; exact-source execution still required. |
| 34 | covered | E69, E70, E41, E71, E72, E73, E82, E83, E84, E85, E86, E87, E80, E88, E77, E81 | Covered: all four old and explicit constructors, resolver prerequisites/order/missing Effects/no explicit fallback: probe/constructors_complete_test.go: TestProbeCompleteFourConstructorsExplicitEffectsAndResolverHierarchy; probe/constructors_complete_test.go: TestProbeCompleteLegacyFactoryAllocationAndNilPrerequisiteSourceBoundary fresh zero-config native Dialer, network/address/context/errors and legacy mutation/zero fixture fallback; unchanged Runner provider scope: probe/native/defaults_complete_test.go; probe/constructors_complete_test.go; control/probe_factory_complete_test.go; control/platform_defaults_complete_test.go original Now/deadline/ticker/defer/watch/cancel order, 100ms and 2s inclusive bounds/25ms watch, shared clock domain: TestNativeConstructionCompleteExplicitProbeDeadlineWatchDeferAndEntropy; probe/elapsed_complete_test.go; probe/probe_test.go: TestProbeCancellationDeadlineAndRevocation; probe/probe_test.go: TestProbePostConnectRevocationClosesConnection; probe/platform.go: native/process deadline-domain contract Gate random failure, one 32-byte instance read, 256 non-evicting claims burned before work; global four-active/128-key/one-second cooldown across Executor factories: TestNativeConstructionCompleteExplicitProbeDeadlineWatchDeferAndEntropy; probe/gate_test.go; probe/probe_test.go: TestProbeBoundedAdmissionAndCooldown; probe/probe_test.go: TestProbeConnectOnlyAndProvenance counter 16-byte epoch/read before eligibility/repeated closed enable/errors/saturation/Seal Close/races/once finish nil readers/detachment/end time: probe/counters_complete_test.go; control/probe_counters_complete_test.go native trust/echo effects retained; no reset/API/feature/authority change; product type/wire debt and acceptance gates: observationtrust/handshake_complete_test.go; probe/echo_binding_complete_test.go; probe/echo_exchange_complete_test.go; docs/development/foundation-readiness.md item34 Qualification: No production edits, no new enablement, no boundary or functional execution claimed. Remaining: No missing assertion identified; exact-source execution still required. |
| 35 | covered | E209, E213, E214, E215, E216, E217, E218, E211 | Covered: Notification read endpoints receive correct actor/scope/ID and opaque owner response under optional-service admission/error boundaries. Worker explicit stores check one owner transaction per claim/preflight/finish, sorted manager authorization and policy->endpoint->outbox locks with callback transaction identity. Failed claim append rolls back row/fence/rate/attempt; failed finish preserves existing claimed fence/pending attempt and defers only once without another sender. Public read excludes reference/authority/destination/signing key. NotificationCompleteDeclarations35 independently pins complete endpoint/outbox/attempt/header/query/loss records, default and product specialization payload/state/code/outcome, all Tx store methods optional locks and synchronous readonly value callbacks. Independent endpoint config/payload fields and closed status/send/delivery code vocabularies are pinned. SQL retention parser initialization override sender and rollback behavior are not inferred. Actual lower endpoint/outbox source is executed with injected mysql rows/write and owner value callbacks: fixed SQL and ordered arguments, lazy synchronous decode, first-error identity, singleton stateless zeroarg wrappers preserve prototype this.count/this.get; quotas16/128/256/1024, terminal-only7day prune max16, bounded loss arithmetic, duplicate immutability, CAS, lock modes, due/defer/rate/read-only history. Six actual MySQL tests create isolated migrated schemas and use original public canonical value providers. Original endpoint/outbox/attempt/rate writes, JSON/integer/schema corruption, old zeroarg prototype count/get override, due/defer/share/update/current-revision CAS and ordered readonly history are asserted against database rows. Real quota exact16endpoint/128audit/256attempt/1024outbox plus raw17/129/257/1025 integrity refusal, strict7day terminal-only prune max16, terminal-only full-queue eviction/rejection, missing/evicted finish without history recreation and16rate identities. Every loss family maximum saturation is asserted; native arithmetic before cascade failure retains all original rows. Failures injected after each original write position execute on the original supplied native connection then reject the original Error. Seven-table full-row snapshots match after UnitOfWork rollback for scope lock, endpoint upsert/audit retention, terminal prune/queue eviction and loss changes, claim CAS, attempt insertion/retention/completion, rate reservation and header defer. Original endpoint/outbox source executed with injected declared providers pins exact native SQL/ordered params and lower decoder ordering. Dedicated isolated binding test pins own parser pair identity/init/freeze and rejects any upper source/type import. All wrapper constructors remain zeroarg/stateless with original prototype this/count/get hooks. Reuse existing NotificationCompleteDeclarations35 for independent complete records/default and product generic specializations, optional/null/literal/readonly/mutable fields, caller Tx method sets and synchronous values callbacks. Reuse current command publish/replay/CAS/durable stage before same-Tx SQL/audit/response/rollback-orphan and dispatch enqueue/claim/fence/auth/rate/retry/silence/recovery/header defer/read redaction matrices; these regress storage split original consumers without certifying native Vault/Sender71. Reuse original explicit root store worker claim/finish rollback, current manager authorization and exact secret binding, commit-before-lease/send and zeroing/idle-before-release assertions. Reuse original native cancellation/physical DNS and guard completion, bounded sender admission and HTTP outcome/TLS single-attempt assertions; full native sender corpus remains separate71/211. Reuse exact notification recovery four-write supplied-Tx quarantine and protected delivery/attempt history rollback cases. Remaining: No missing assertion identified; exact-source execution still required. |
| 36 | partial | E219, E203, E209, E215 | Covered: Related publication savepoint tests assert success/known-refusal/unknown-error/fault order; Probe permits test original transaction failures; HTTP covers history/plan admission only. HistoryPlanCompleteDeclarations36 independently pins complete history permit/result/metadata/record/query/loss/capture/recorder and finite plan config/head/decision/failure/header/query/loss/issuer/store declarations. Generic defaults, optional TLS/echo bytes/service fields, literal status/code unions, mutable fields, caller Tx, nullable reads, optional lock modes and synchronous readonly parser/expiry/refusal callbacks are compared. Savepoints and parser/runtime timing remain behavioral. Remaining: Publication savepoint coverage does not cover Probe-plan-specific savepoints or retryable quota exceptions. No run/plan store suites located for history1024/7day/16prune, heads32/decisions16, parser family initialization, override hooks, exact SQL and sticky recovery. |
| 37 | partial | E209, E220, E215 | Covered: Audit query and observation-service list optional HTTP dispatch/auth/admission are checked only. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors MetadataAuditCompleteDeclarations37 independently pins metadata head/revision/audit/store and readonly TLS/echo configs; exact nullable raw audit row versus validated business record are deliberately distinct. Pins fifteen source names, public source tuple declaration, audit error vocabulary, readonly source/kind/error contract, filters/query/position/DTO fields and generic synchronous row projection. Actual constant array value order and initialization remain runtime/source evidence. Remaining: Per-family fifteen-source SQL/node-association/attribution/projection golden cases; actual constant value ordering/initialization/reflection; complete cursor/property/byte-limit/error permutations; physical SQL plan/pool evidence. Public declaration source/error/default/mutability shapes now have type witnesses. |
| 38 | partial | E184, E209, E221, E215 | Covered: Console Node diagnostics asserts scoped read-only sanitized evidence/no health. Separate Forward diagnostics and station HTTP admission/dispatch has B tests. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick DiagnosticStationCompleteDeclarations38 independently pins all thirteen diagnostic envelopes and complete SELECT port, including readonly Core endpoint references, mutable records, null joins and generic pages. Pins station config/rule/reason/evidence/evaluation/state and generic policy/audit/event/query/loss/store/fact specializations, literal discriminants, optional locks and synchronous readonly projection callbacks. No SQL/rule/worker behavior follows from these types. Remaining: Public command replay/CAS/quota/silence/ack sequence, policyCount legacy overrides, pure rules/recovery/episode matrix, storage retention/loss/SQL pruning, diagnostic owner and existing native store row mapping |
| 39 | partial | E222, E223, E209, E224, E215 | Covered: Observation dedicated connection tests assert cancel destroy, failed rollback never returned, delayed pool acquisition cancellation and actual MySQL blocked authorization deadline. HTTP covers telemetry family dispatch only. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero TelemetryCompleteDeclarations39 independently pins raw node/head/point, mapped forward/probe records and provenance mappings; exact wire Sample/Point/Identity specialization and readonly input/result arrays are retained through all stores and mapping ports. Pins complete rollup lower records/window/loss/count/readonly limits/callbacks and product series/observation/metric/cumulative/bucket schemas, generic recorder/store, nullable values and literal quality/coverage fields. Receipt arithmetic/pool/provenance behavior remains separate. Remaining: Forward/Probe mapped-family provenance/counter matrices; latest/history actual point ordering/digests/deltas/cooldown/rate/clock bounds; adapter SQL/observation pool deadlines/destruction; raw quotas/pruning and real MySQL rollback |
| 40 | partial | E176, E225, E203, E209, E226 | Covered: Request keys/encode timing and non-metadata/native target guards are covered in related Forward/Probe tests; B HTTP covers observation-service availability/auth only. Native helper aliases/default capture; closed plain/null objects and IP/hostname/URN/base64; malformed DER preflight; actual X509 projection source with injected native certificate facts covers property/evaluation order and RSA/EC/Ed bounds; actual outer TLS trust source covers exact SAN/EKU/validity competing refusals; real staged echo key/trust/config preserves detached freeze. Remaining: No real generated X509 certificate acceptance/corruption corpus or all native DER formats. Metadata command list/get/publish/archive authorization/replay/quota/CAS/history/audit/recovery; request UUID/monotone quota/HTTP byte and every command rollback obligation remain separate. Native projection VM is direct implementation/effect-order evidence, not physical PKI acceptance. |
| 41 | partial | E206, E205, E204, E209, E226 | Covered: Probe adapters assert receipt identity/freshness and no ACK after failed commit; optional observation HTTP mapping is covered. Public native telemetry/probe/shared parser aliases; default wall clock capture; exact JSON UTF8 encoder/default bytes, base64url cursor text, clone, fingerprint and permissive native hex/time helper semantics including getter errors. Probe result and machine codec test covers direct canonical projection/dispatch identity and initialization with no provider effects. Remaining: Complete telemetry wire field matrices/ACK owner clock behavior and response limits; actor/two-active cooldown; audit/station/notification/Probe cursor query framing across every owner; notification sender secret zeroing and diagnostic DER business projection; UUID placement and SQL callback refusal/rollback remain separate. |
| 42 | partial | E227, E228 | Covered: Authored native URL tests establish canonical HTTPS/default-port/path output and exact legacy function identity; refuse alternate schemes, credentials, empty query/hash, control/Unicode/backslash, IP numeric/IPv6 forms, private name families, malformed labels/TLD, and supplied/canonical2048-byte and hostname253 bounds. TCP/UDP staged invocation and retained history helper field order, original context/nonce callbacks, ISO bytes, selection identity; independently reconstructed fixed 256-byte frame/192-byte signed response, invocation/request digest, real Ed25519 proof success/failure and challenge mismatch. Native JSON/base64/time/hex helpers have direct exact-byte tests in observation-native-values file. Remaining: Notification payload/signing digests and URL caller/network evidence remain existing or separate. Probe plan/run every error/size limit and owner pipeline; complete rollup series/sample/bucket digest/fold callback/metric/quality/coverage/quota arithmetic remain separate. No echo issuance/execution or DNS/sender safety acceptance follows. |
| 43 | covered | E181, E180, E183, E175, E209, E229, E230, E231 | Covered: HTTP tests reject duplicate/oversized/unknown JSON/query and preserve auth/status; console paging validates integer/default/duplicate/injection and scoped filter binding; optional APIs reject unknown query before owner. Adds all native parser/UUID/JSON function identities across Runtime/Transit/Probe/observation families and fatal UTF8 split-chunk body reading, exact default/custom byte limit, limit+1 short circuit, response lock release before decode, read/getReader/finally release failure priority. Request error mapping retains exact old codes/status/identity and private-detail redaction. Existing request/header/query/type suites retained. The retained exact canonical parser/codec aliases, every Runtime/Transit/Probe/observability family and query grammar/pageWindow/consolePage suites now combine with actual current route-module dispatch. Management and machine routes independently pin their body limits and inclusive/limit+1 behavior, malformed JSON and fatal UTF8, middleware/session/field/provider first errors, exact parser selection/version labels and original owner arguments. The actual global middleware assigns the UUID before request lifecycle admission; v2 remains 409 without fallback. No production codec, feature or authority was added. Remaining: No missing assertion identified; exact-source execution still required. |
| 44 | covered | E225, E232, E226, E233, E234, E235 | Covered: Plan tests enforce exact active published binding, numeric destination, policy/grants, expired/missing source, no SQL writes and preview non-authorization. Real echo metadata resolver authorization/read/clock/context digest and disabled TLS version refusal. Actual resolver source VM pins default clock capture without sampling, explicit clock bypass, reference-before-auth, parsed head before archived/recovery/revision fences, parsed revision/digest before clock, clock/window before version/transport/parser, error identity/corruption wrapping and original code/status. Native parser aliases are identical. Requirement44 is resolver-only: exact parser/context/default/authorization/read/error/window behavior is directly asserted in existing observation-native-values-complete tests40/44 and the new public alias suite. Actual metadata owner/store/canonical MySQL tests supply the original public reader chain; real certificate corpus and physical mTLS operation are distinct execution gates, not missing resolver source assertions. Remaining: No missing assertion identified; exact-source execution still required. |
| 45 | covered | E204, E205, E206, E200, E201, E228, E236, E237, E238, E239 | Covered: Adapters check same input identity/session, one owner call, commit before detached ACK, 250ms freshness/post-commit expiry, no retry and executionEnabled:false. Exact public parser/helper alias equality and all result ACK v1/v2/v3 ordered keys, canonical UTC receipt/serverTime/digest/duplicate/health unknown/execution false. Actual machine source covers v1 negotiation/instance/claim/poll/status and v2/v3 qualification/poll/claim/status spread/order/callback/null phases. Real typed/service poll all supported measurements, nullable offers/service context and 250ms/251ms boundary. New machine bridge and actual permit-to-v1/v2/v3 adapter tests close default/explicit clocks, all identity/freshness/selection/max-time and postcommit late/lost/duplicate/no-refund behavior. Existing native codec tests45/53 assert exact parser/helper identities, request/response ordered labels/UTC/disabled fields and lazy callbacks; existing registry/instance owners retain original postowner timing. No wider issuer or physical acceptance claim. Remaining: No missing assertion identified; exact-source execution still required. |
| 46 | covered | E203, E208, E228, E237, E240, E241 | Covered: Permit suite checks budget/actor/plan/instance/machine authorization, consumed single use, across-host replay, current tuple/grants, deadline minima/cooldown, corruption, sticky withdrawals, result digest/replay/history rollback and no new authority. Exact native parser/digest/body/echo helper alias equality; all four result request envelope body/digest and mutable field ordering; independent real echo invocation/frame/nonce/signature verification and retained history bytes; caller callback failure identity and no nonce call after failed context. Exact codec/function/bytes/invocation/proof behavior retained in native codec/permit validator suites; new actual permit constructor, original issue/consume/write/history order, precise255/256/257 and3/4 reservations, real v1/v2/v3 adapter postcommit late/duplicate cases supplement existing full permit port/canonical MySQL authorization/expiry/withdrawal/result/rollback/history cases and actual history staged v4 refusal/capture. One original owner remains; no echo issuance accepted. Remaining: No missing assertion identified; exact-source execution still required. |
| 47 | covered | E203, E204, E205, E206, E241 | Covered: Malformed binding/session/version/measurement/current authorization and receipt invariants have explicit refusal tests. all three validators public/legacy/canonical strict identity; native TLS/echo context/challenge/digest equal original wire exports; exact runtime and erased import lists reverse key order/null prototypes; every missing/extra key; every binding equality field in both directions; malformed values; all original scalar limits; all four closed union shapes and both echo protocols; removing ingress measurement intentionally gives valid legacy permit valid TLS and both echo; independently redigested scope mismatch; echo v1 refusal; selected TCP/UDP mismatch; inclusive boundaries and out-of-window values; malformed context/challenge and parser-caught false nonce/challenge shape and mismatching digest; mutation of every invocation-relevant permit field; literal ISO strings; exact invocation keys and binding reference; digest equals JCS digest and challenge digest; noncanonical ISO rejected getter bombs prove closed-key-before-values and caught parser errors before scalar access; traced context then challenge before scope/window; synchronous boolean and uncaught original common-getter identity; Date.now forbidden dynamically; facts unchanged/no authority fields; source imports and forbidden async/native/SQL effect calls asserted No local functional execution. Parent integrates suite into exact-head GitHub Actions. This does not assert full permit owner or Agent acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 48 | partial | E202, E242, E215, E243, E239, E238 | Covered: Registration/replacement/replay/revocation/current-evidence validation, resampling after lock, exhaustion, transactional rollback and sticky recovery are tested with direct ports and real MySQL. RegistrationCompleteDeclarations48And51 independently pins readonly instance records, command/registration/inspection/owner/store signatures and the generic registration contract. Pins mutable qualification record defaults and exact product state/servicesVersion/echoVersion specializations, both optional markers, null versus undefined read results and readonly synchronous value callbacks. Persistence/parser marker acceptance and constructor effects are not established. Remaining: This slice does not close every original lower qualification storage optional-marker/default/prototype/deferred-validation and every-statement SQL differential. Reconcile separately against79/80 native registry/store evidence and original48 contract before changing status. |
| 49 | partial | E225, E232, E200, E215 | Covered: Current published/intent/machine reads enforce scoped JOIN identity/session/generation/expiry; planner denies metadata/foreign/corrupt/current mismatch and proves SELECT-only. EvidenceCompleteDeclarations49 independently pins complete readonly machine evidence, nullable boot/retireAfter and readonly capabilities, generic default reader plus original Probe specialization. Pins native published snapshot specialization, undefined absence, read argument order, original intent/node read contracts and full readonly ProbeBinding. SQL parsing/defaults/helper identity stay behavioral. Remaining: No dedicated complete exact lower published/evidence/intent JOIN SQL/argument/lazy decoder/capability/null projection/statement failure differential was authored by this bridge slice; retained real MySQL tests assert their original paths only. |
| 50 | partial | E203, E208, E215, E237 | Covered: Permit and withdrawal storage real MySQL exercises atomic claims/budgets/expiry/replay/current grants/sticky revocation, result unique ingestion/conflict and rollback. PermitCompleteDeclarations50 independently pins complete readonly raw permit input/record/result, optional specialized measurement/service/challenge, native result body union, budget lock readonly arrays, close literal union, undefined result absence and all supplied-Tx store/plan methods. Pins synchronous read/valid/readResult/checkResult callbacks and original result-store Pick. No decoder validation order recovery clocks or prototype dispatch is inferred. Remaining: This slice does not newly close all original LIMIT257/UTF8-before-decoder, native lower versus legacy wrapper/default/prototype or separate dynamic recovery-clock SQL evaluation obligations. Owner tests are not a storage-text/decoder-order substitute. |
| 51 | partial | E202, E201, E200, E203, E215, E243, E239, E237 | Covered: Instance evidence and machine/session/capability refusals, owner register/revoke/inspect and permit ACK transaction boundaries have tests. RegistrationCompleteDeclarations48And51 plus MetadataAuditCompleteDeclarations37 pin exact Probe/observation declaration fields, mutable qualification optional v3/v4 markers versus readonly instance, mutable measurement descriptions and paired echo unions, readonly service reference and exact native resolver contexts. ObservationServiceReadPort is compared to the exact head/revision Pick of its parameterized metadata store including optional lock and nullable responses. Existing integrated type-source/runtime-legacy maps retain canonical alias evidence; import-time effects and actual parser/refusal semantics remain separate. Remaining: Existing declarations and79/80 registry owner/storage traces are relevant, but this bridge slice does not assert every persisted v4 marker versus narrower application qualification parser, original import effect/provider identity and max-time storage path. Keep partial until those exact sentences are reconciled. |
| 52 | partial | E206, E203, E228, E236, E237, E208 | Covered: Result adapters and owners assert failed commit no ACK, post-commit freshness and identity/digest replay refusal. Restored canonical/public function export identity and no import-time provider call; actual source v4/v3/v2/v1 dispatch and inherited getter counts, fallback null/array/unknown primitives, one initial JSON phase then parser/body/digest; exact mutable envelope key order and v1 measurement. Stored guard exact v4-before-v3, own requestId rejection/inherited acceptance, temporary zero64 requestId append order, native parser/digest error mapping, no acceptedAt read and deliberate unchecked v1/v2. Real four families and ACK1/2/3 UTC/key/duplicate/disabled field checks; no v4 ACK exported. Remaining: All owner/parser/default-clock/late/duplicate adapter clauses now have native codec plus real owner assertions, but original SQL UTF8-bound-before-guard/insert and exact lower storage ordering still require50 evidence. No v4 ACK or public issuer widening is accepted. |
| 53 | covered | E200, E201, E204, E205, E206, E228, E236, E237, E239, E238, E215, E244 | Covered: Negotiation/instance/v1 claim/delivery/result compare returned immutable receipt/status flags, current identity and post-owner clock refusals; null offers/status behavior covered. Actual original native negotiation/instance/claim/poll/status plus v2/v3 qualification/poll/claim/status source projections pin request spread/key order, null offers/current/service fields, original parser/check names, lazy descriptors only on non-null offer and serverTime callback evaluation after projected owner result timestamps. Provider initialization is effect-free. Real typed/service poll schema and measurement/nullability/freshness cases; public parser aliases identical. Original native projection tests53 retain exact parser/check/request spread/key order/nullability/disabled fields and lazy callback-only behavior. New machine bridges and real permit adapters close caller owner-before-clock/ACK, all version-specific arguments/refusals and actual committed late/duplicate behavior. Existing registry owner/instance owner tests prove their postowner serverTime behavior; public type and source compatibility suites retain exact erased aliases and no second implementation. Remaining: No missing assertion identified; exact-source execution still required. |
| 54 | covered | E193, E195, E245, E246, E247, E170 | Covered: Native template parser closed/bounded/ordered/detached, immutable versions, CAS/no-op/archive/quota/reference grants and real transaction rollback are tested. NEW exact public/legacy class, parser, validator and mutable limits identity; original constructor arities and no construction provider effects, native clock capture without early reads, original async method descriptors. Compile-only equality supplements independent publication-public-types-complete Template declarations, mutable/optional fields and lower specializations. NEW parser/retained state cases preserve canonical key/protocol ordering, null prototype versus foreign prototype, deep freeze, original hash terminal-newline refusals, timestamp zero/max and fractional/nonfinite/overflow guards, parser exception wrapping before other retained fields, original ControlError code/status and native getter failures. Existing path-template-ports covers complete closed-field/bounds/distinct/order/parser/quota/history/CAS/query grammar. NEW actual template-state/templates source with declared providers records independent config/profileDigest and method/path/expectedRevision/config digest key order, original digest exception and replay before time reads; no duplicate production algorithm. NEW query fake ports preserve auth/head/notFound/revision/config/time/page validation, requested historical revision versus current archived metadata, original ISO and immutable response without reference reauthorization. Commands preserve auth/claim/scope lock/head lock/CAS/prior revision/clock/references/quota/publish/audit/respond, error identity and caller rollback at every stage, no-op and archived semantics. Archive has its full ordered failure matrix and no reference/publication call. NEW NativePathReferences uses exact receiver/supplied transaction/actor/scope, independently sorted Nodes then locked Profile then sorted Endpoints, every Node identity/scope/capability and Profile identity/revision/protocol and Endpoint identity/revision refusal plus every provider first failure prefix. Returns only immutable Profile digest and no execution or alternate authority. RETAINED path-template-mysql-acceptance exercises actual Control public HTTP/Path composition with original Identity/Node/Profile/Endpoint references, concurrent CAS, quota, immutable history, archived rows and SELECT-only scoped reads; new native store suite adds exact-write fault rollback. Both require same-source Actions; source/type/private boundary checks remain independent evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 55 | covered | E193, E195, E247, E246, E245, E170 | Covered: Real native authorization, concurrent publication CAS/quota, immutable archive/history and SELECT-only scoped query behavior have assertions. TemplateCompleteDeclarations55 independently pins complete lower/product mutable head/revision, readonly nested PathTemplateConfig, two distinct generic config specializations and complete reader/writer methods with null reads/optional lock/caller Tx. Pins ReadPageWindow and ConsolePaging exact page/limit/offset structure and old template public aliases; source constructors/prototypes/hooks and SQL/JSON timing remain behavioral. NEW independent SQL table pins all8 lower/native legacy methods including both head lock modes, count-before-page, revision1 versus later write sequences and original audit UUID. Both adapters use the exact supplied executor receiver, raw count/current revision/Boolean archive mapping, nullable missing reads, raw string/object/null/scalar JSON and unchanged malformed JSON error without product validation. NEW bounded LIMIT/OFFSET minimum/maximum/invalid windows assert count before invalid page refusal; prefix remains a bound repeated parameter, no wildcard substitution. Actual lower modules are loaded intact with declared dependencies to assert no construction I/O or reverse product dependency; legacy module constructs one stateless lower singleton, owns zeroarg async public prototype methods and dynamically delegates to its original receiver; original method override/error behavior retained. NEW actual SQL source with injected native UUID pins UUID before single event write, original UUID failure before effects; native JSON getter/toJSON failure occurs after revision1 head insert and before immutable revision/head update. No cleanup or eager product parser is added. NEW canonical MySQL composes PathTemplateCommands/Queries with original Identity, Idempotency and native legacy store. Every6 create writes,5 next-publication writes and4 archival writes is allowed to execute then fails with original sentinel; all canonical table snapshots, including seeded Runtime state and immutable history, exactly restore. Capture confirms auth before scope/head locks before quota before head/revision/pointer/audit/response. Successful replay retains full database; historical/current/archived queries and terminal archive reuse refusal remain original. NEW real READ COMMITTED list deliberately commits another original lower publication between count and page: total reflects first read and items reflect later read, without a new global snapshot. Literal-percent prefix, archived head, absent head/revision and corrupt product JSON remain raw lower behavior; old public query performs the original later integrity refusal. RETAINED publication-public-types-complete independently pins mutable records, nullable reads, optional lock, generic/lower specialization and legacy API equality. Existing actual Control Path/Ingress metadata acceptance and current source consumers retain ownership and original one-transaction contracts; exact saved-source Actions still required. Remaining: No missing assertion identified; exact-source execution still required. |
| 56 | covered | E194, E196, E248, E249, E250, E199, E251, E252, E247, E170, E253, E254, E219, E255, E256, E257 | Covered: Numeric/DECIMAL sequence and limit-before-write, immutable cap, closed detached selection, same-Tx original Forward/CAS/capacity/provenance/replay, no-op metadata attach and retained history are asserted. NEW public/legacy class and parser/expansion identities, compile-only original mutable records and lower reader/writer/sequence-at contracts, zeroarg storage wrapper constructor and original async prototypes/subclass/dynamic singleton dispatch. NEW lower+legacy all six methods exact original SQL and arguments, supplied execute receiver, b.* projections and both Scope predicates, optional revision and deleting exclusion, raw null/JSON/Boolean/no inner product validation, count before bounded page and no hidden transaction. Every statement first failure retains its exact Error. NEW exact numeric/DECIMAL sequence corruption and64 cap before getter/JSON or writes, original JSON failure before immutable/pointer writes, expanded getter twice on success and original spread property order. Canonical MySQL original Forward lock plus two-write rollback preserves every table; competing append serializes sequences, detach only removes current pointer and failed detach restores it; different Scope cannot read/remove provenance. Real read committed count can see1 while later page sees no nondeleting rows. NEW original owner closed input/counter/digest/time bounds, immutable template and reference receiver/Tx order, current provenance shape/digest/topology rejection, no-op before clock/append, append before original checked receipt, ordinary business changes preserve pointer and topology changes detach only current pointer. Read/preview/reference transaction ordering, errors, frozen flags, historical contiguous/cap/current checks, target availability and page corruption are asserted. NEW actual native modules prove default Date.now captured without read and retained after replacement; reference observedAt constructs fresh zeroarg Date only after final page and failed final time rolls back. Retained original Forward apply/CAS/capacity/Operation/replay/no-op and real MySQL public cases stay mapped. The shared actual ForwardCommands/default Executor/native adapter/PathBindings/PathGroups chain now closes the previously missing real Group caller, including safety/capacity-before-Path-before-Group and rollback. Forward creation/Ingress supplied-Tx command methods and restoration resolver/fallback are separately directly asserted by the new Forward metadata suite. Retained Path owner/store and real MySQL public creation/apply/history cases remain mapped. The previously enumerated remaining outer-caller obligation is now fulfilled by actual PathPublications -> ForwardCommands -> native execution -> PathBindings -> PathGroups plus the original Control/Identity/IngressGroups/IngressDeployments/IngressMigrations/Forward/path MySQL composition. New Ingress canonical statement-fault tests execute each actual INSERT/UPDATE/DELETE before raising an independent error and verify whole-Tx rollback for accepted create/update/no-op/add/remove/conditional deletion/restoration/cancel and attempt/event/response writes. Known savepoint refusal retains separately committed accepted work; origin/current-state/revoked-grant/recovery and immutable path/group history stay in the actual owner chain. The earlier parser/default-clock/raw-SQL/count/sequence/history/no-op/archived/reference tests remain mapped. This reconciles only source assertions; exact-source execution remains pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 57 | covered | E199, E194, E196, E251, E252, E250, E247, E170, E253, E254 | Covered: Existing browser batch workflow covers group selection, stale CAS/lost-reply/publication and immutable path binding behavior; binding suite covers owner shared transaction. NEW public/legacy class/parser/selection/limit identities, original mutable-as-const limit object and bounds; compile-only product/lower config/record/writer/generic/nullability contracts; frozen detached config, closed prototype/version/kind/candidate order/unique ID/unique digest and exact selection refusal corpus. NEW both lower and zeroarg legacy SQL owners cover all original methods, exact SQL/argument arrays, supplied execute receiver, per-statement first-error cutoffs, raw numeric/Boolean/JSON/null projections, literal prefix and optional revision arguments, double Scope joins, b.* projection, count-before-page, group-only history LIMIT64, original archived head CAS and affectedRows===1 refusal. NEW zeroarg singleton construction and async prototype dispatch, revision-one-only lazy original this.count override with exact Tx/Scope and count/error identity; lower import initialization has no SQL/UUID work. Raw count is not newly normalized. Publication count/head insert precede lazy config JSON, later publication JSON precedes native CAS; provenance maximum/cap precedes lazy spec encoding and both writes. Native audit UUID remains before execute. NEW DECIMAL/numeric sequence boundary corpus,63-to64, malformed/null/unsafe/negative/fraction/noncanonical strings and cap refusal before writes; original pointer upsert/detach SQL and unchanged history. Canonical isolated MySQL uses production migrations, original Scope and Forward locks, application+SQL quota reads, all create/next/archive write-fault rollbacks across every table, actual idempotency/no-op, concurrent binding sequences and pointer-only detach. Real read-committed count1/page0 after concurrent Forward deleting is preserved. NEW original command manager/replay/Scope/head/current-revision/clock/sorted template reads/live authorization/quota/publish/audit/respond order with failure prefix and state rollback at each step. No-op still revalidates candidates and avoids quota/writes/audit. Archive preserves immutable history and archived IDs cannot be reused. Candidate reads sort a then b while result priority restores b then a. Archived historical template/group queries differ from active new-use refusal; missing reference, exact digest, Profile digest, ingress/protocol and distinct terminal checks keep original errors. NEW original current/at Path provenance checks validate selected template, exact sequence/digest/actor/time/current topology, historical missing/corrupt records and current-pointer mismatch. Group accept validates receipt before clock/append, preserves exact no-op and records linked Path sequence; ordinary business changes preserve history, topology edits/detach remove only current pointer. Preview delegates Path with same Tx and no writes. Read/ref/history bound/duplicate/gap/current-pointer/counter/corrupt page and suspension/deleting refusal retain frozen non-authorizing flags and original ISO timestamps. NEW actual module VM asserts default wall-clock capture without read and retains original captured function; request digest uses original actor/Scope/key/PUT/path and body key order expectedRevision then config. RETAINED dedicated public type, pure legacy-entrypoint and canonical boundary tests supplement original declaration/consumer/asset compatibility. SHARED forward-metadata-owner-complete.test.ts drives actual ForwardCommands/default ForwardCommandExecutor/native path adapter/PathBindings/PathGroups. Original Group selection then Path reference authorization and expansion precede Runtime lock/canExecute, Forward write/authorizer/plan/Operation/capacity, real Path append then real Group append and exact checked receipts. Same-Tx no-op, canExecute refusal, per-effect failure and corrupt appended dual provenance roll back original state. These source assertions are separate from actual Runtime/MySQL execution evidence. All original lower SQL, group parse/validation/provenance and Forward/Executor/Path/Group chain assertions from the group suites are retained. The remaining outer PathPublication caller is now directly tested through actual PathPublications + ForwardCommands + native execution + PathBindings + PathGroups, one transaction, full grant/Runtime/Operation/capacity/metadata order, late rollback and pointer-only compensation preserving immutable history. Remaining: No missing assertion identified; exact-source execution still required. |
| 58 | covered | E219, E199, E253, E254, E247, E250 | Covered: New B savepoint suite checks success result identity, classify-before-rollback/project-after-release, unknown/refused/classifier/projection errors and create/rollback/release faults; classifier status/retryable/error identity/shared mutable Set tested. Browser tests cover publication workflow. Public/canonical/legacy parser, hash, runtime mutable limits and rejection Set identity; original closed plain/null-prototype fields, versions, item order/bounds/uniqueness, exact source/provenance/digest/path-only replacement, real JSON UTF8 byte equality and limit+1. Existing publication-public-types-complete pins independent generic Plan/Outcome/storage/API and optional/null/mutable contracts. Literal lower and native SQL, supplied transaction receiver, raw counts/numbers/Boolean/JSON reference shape, default FOR SHARE versus FOR UPDATE followed by same-transaction attempts LIMIT20, initial quota recheck, all append/cancel revision<24/recovery/cancel predicates, affectedRows exact1, immutable attempt/event order, per-statement error identity and native encoding timing. Native zero-argument module singleton owns async public/private event methods; lazy overridable count/event hooks retain subclass receiver, args and result/error identity. Existing publication-savepoints uses actual three native bodies with every SAVEPOINT/action/classifier/rollback/release/late projection first-failure order, original ControlError versus unknown/retryable statuses and shared mutable refusal Set; no implicit retry or swallowed SQL failure. Preview sorts Forward traversal then restores user positions. Create manager-before-replay then Scope lock/count/replan/digest/ID/time/write/respond, exact request bytes and property order, quota/corrupt count, stale preview, invalid ID/time, all provider failures and no execution effects. Creator/recovery checks precede claim; claim precedes CAS/attempt/cancel/compensation checks. Lost reply same-key replay keeps exact receipt and one attempt. Accepted/known-refused/unknown results, all accepted status/revision/operation/path/group receipt validators, unchanged status200/null-operation, independent persisted head/plan/attempt/actor/request/time/outcome/ancestry/uniqueness corruption and operation association/count/status/bool guards. Cancel changed/no-op/replay time sampling, original source conditional compensation after cancellation, immutable history and non-authorizing unknown-health non-atomic flags. Actual outer PathPublications uses actual ForwardCommands, native ForwardCommandExecutor/native adapters, actual PathBindings and PathGroups with public port fixtures in one supplied transaction. Original live grant/safety authorization precedes replacement/authorizer/Runtime plan/Operation/capacity/Path accept/Group accept. Every late owner/append/response failure restores all Forward metadata; invalid returned provenance aborts. Grant denial creates only a refused attempt. Actual compensation rechecks restoration grant, native direct Node facts/slot transitions, detaches only pointers and preserves both histories. Existing forward-metadata-owner-complete exhausts original source/CAS/provenance/restore selection guards and fallback resolver. Canonical MySQL original Identity/Idempotency/PathPublications/store path runs every write fault in create/refused-apply/cancel and compares every schema table; test-owned Forward port uses its original test Forward row to prove real SAVEPOINT rollback before durable refused attempt. Same-key replay, no-op, restored recovery refusal, terminal history, real competing head FOR UPDATE locks/CAS, revision/cancel predicates and 64 durable batches including terminal IDs are asserted. Real Forward/Path/Group execution is separately tied by the actual inter-owner test; no fake runtime authority is claimed. Remaining: No missing assertion identified; exact-source execution still required. |
| 59 | covered | E258, E259, E260, E247, E193, E250, E261 | Covered: Authored explicit-port tests assert manager auth before replay; template grants sorted before write and no-op revalidation; supplied Tx across all collaborators; response persistence failure rolls back head/revision/audit/replay and same-key retry succeeds; historical describe permits archived metadata without live grants but active resolve refuses before template disclosure; returned members preserve requested/input order and distinct ingress/common protocol refusals precede writes. Public/legacy parser class and mutable INGRESS_LIMITS identity, zero-argument lower/legacy constructors and async prototype descriptors Closed prototype version member selection hash uniqueness and input ordering; explicit false versus omitted enabled; exact N+1 dummy Forward listener then target parser calls Immutable plan ordered positions, distinct ingress Nodes and shared enabled/protocol/target; inclusive native UTF8 plan byte branch Exact product/lower generic records and store shape, mutable members/page response, optional lock/query and nullable records; public/legacy aliases Manager auth before claim, Scope before head lock, CAS and immutable revision validation then clock, sorted template traversal then restored input member order, application count/quota and native write/audit/respond sequence No-op publication still live revalidates after one clock; archive no-op clock sample and no extra archive/audit; replay skips clocks and reads after auth Historical get/describe default inactive and persisted-only references, explicit active resolve, requested array snapshot/order, missing archived digest malformed record and first error differences Actual native Path references sort per-template Node grants then Profile then Endpoint checks; failures preserved before group write; no resolver result promoted to permit Both exact lower and original SQL/args for Scope/head locks/count raw JSON Boolean nulls/prefix paging/audit UUID; initial head and immutable inserts versus later archived-false head CAS; affected row conflicts Original singleton lower receiver and lazy dynamic subclass count callback only on revision one, same Tx Scope and error identity; UUID and JSON encoding failure phase Canonical MySQL one-Tx auth/idempotency/Scope/head/double quota order and full all-table rollback after every successful write in first/noop/update/archive/noop commands; immutable archived CAS and archived identifiers included in64 quota Remaining: No missing assertion identified; exact-source execution still required. |
| 60 | covered | E219, E247, E256, E262, E257, E212 | Covered: Ingress deployment isolation shares tested success/refusal/fault ordering and same supplied SQL transaction object. DeploymentCompleteDeclarations60 independently pins complete mutable lower/product batch head/Plan index/attempt/Outcome/record/Operation/store, default unknown outcome and two incompatible generic Plan/Outcome/Failure families. Pins optional count/event hooks and exact event kind/Tx signatures, optional read/list arguments, generic isolate success/refusal union, complete product plan/item index and failure status union. Dispatch/quota/origin/SQL/savepoint semantics remain behavioral. Original lower/product head, Plan index, Outcome, attempt/Operation/store shapes, optional locks, null and mutable fields are independently witnessed by existing publication-public-types-complete.test.ts IngressDeploymentCompleteDeclarations60 and publication-public-types-complete.test.ts shared Batch types; canonical legacy/parser/limits identity and async prototype descriptors are exercised by the new owner/store tests. New ingress-batch-store-complete.test.ts exercises actual MySqlIngressDeploymentStore and zero-argument MySqlIngressDeployments, exact Scope FOR UPDATE, independent filtered COUNT and bound args, batch FOR SHARE/FOR UPDATE, attempts/Operations LIMIT16, raw JSON/Boolean projection, group index evaluation after virtual quota,64 quota, revision<20 and recovery/cancel predicates, affected rows, create/append/cancel event order, receiver identity and async subclass count dispatch. Original named savepoint behavior is retained and expanded by publication-savepoints.test.ts plus new direct lower-store classifier-before-rollback/project-after-release assertions, shared pathPublicationStorageValues and mutable rejection Set identity, success release and unknown/retryable/database/classifier/projection/savepoint failure identity. New actual IngressDeployments owner tests trace Scope authorization, create replay before Scope/count/replan, quota/digest/ID/clock/time, creator/recovery before act/cancel replay, CAS/duplicate/cancel/no-op/compensation eligibility, re-resolution of exact group/member, createForward then conditional deletion, receipt/Operation/path validation inside isolate, unique accepted Forward IDs and malformed immutable records, durable partial refusal, historical origin eligibility without current-state authority, ISO projections and non-authorizing/non-atomic/unknown flags. New ingress-batch-mysql-acceptance.test.ts uses original ControlApplication, Identity, IngressGroups, ForwardCommands/path admission and L2 stores on the same MySQL PoolConnection. Each original INSERT/UPDATE/DELETE in create, accepted Forward create, conditional deletion and cancel executes before a separately injected Error; inventory must match before each whole-Tx rollback, including attempt/event/response failures. A known refusal after actual Forward INSERT rolls back only that savepoint while persisting refusal and retaining previously committed accepted item. Revoked Node grant re-admission, original path history, recovery-before-replay and historical receipt failing current Forward inspection are covered. Public/legacy origin/lineage/migration parser identity, exact frozen migration limits, group revision/complete sorted diff/source/action invariants, explicit enabled false, update-only path/Profile, explicit remove for replacement add, closed helper errors and inclusive131072/131073 UTF8-byte bound are exercised across the two batch owners; default Date.now is captured without sampling at construction and cancellation no-op/replay/CAS avoid time reads. Remaining: No missing assertion identified; exact-source execution still required. |
| 61 | covered | E219, E247, E256, E262, E257, E212 | Covered: Ingress migration savepoint success, classified refusal and every create/rollback/release/projection failure preserve identity/order. MigrationCompleteDeclarations61 independently pins complete lower/product source/target Plan indexes, mutable head/attempt/outcome/record/operation/store relation, default unknown outcome and two incompatible generic families. Pins origin/lineage/plan/change/item declarations, null fields, optional locks/hooks/list arguments, generic isolate result, public legacy record/store aliases and exact method sets. Apply/remove/restore lineage behavior, initialization and transaction effects remain separate. Original lower/product Plan index, head/attempt/Outcome/Failure/Operation fields, optional locks, null/mutable meanings and legacy alias initialization are retained through existing publication-public-types-complete.test.ts migration declaration witnesses and new canonical identity/prototype/zero-argument wrapper tests. New actual MySqlIngressMigrationStore/MySqlIngressMigrations tests preserve different-group guard before quota/query/insert/event, getter order for source/target index versus lazy count, independently filtered COUNT, Scope/head locks, raw JSON/Boolean mapping, FOR SHARE/FOR UPDATE, attempt/Operation LIMIT16,64 quota,revision<20,CAS/recovery/cancel affected rows, exact SQL/args and create/append/cancel private event hook receivers. Named savepoint, pre-rollback shared refusal classification, post-release projection and all error propagation retain original identity. New actual IngressMigrations preview tests independently sort origins then current Forward inspections, read exact historical source and active target definitions, derive complete sorted diff while retaining input-order sources/actions, and preserve create replan/digest/ID/clock and outer idempotency. Owner command matrix checks creator/recovery before replay then CAS/duplicate/cancel and compensation eligibility. Apply checks exact origin lineage/current Forward state and uses action-specific add/update/remove; remove never resolves target. Compensation conditionally removes accepted add, restores accepted update and refuses remove. Checked results stay inside savepoint; no-op/update revisions, receipt/Operation/path/group provenance, unique add IDs including collision with source, durable partial refusals, immutable record errors, ISO timing/default clock capture/list/get operation association and all non-authorizing/non-atomic flags are covered. Migration originIn admits only migration accepted non-remove outcomes, rejects recovery-invalidated or compensated apply, and derives exact original group/template provenance only for accepted update restoration. Failed compensation/cancellation and retained old origins do not create current-state authority. Parsers compare public/legacy identity, closed helper failures, frozen migration limits, exact different revisions of same group, complete sorted diff/source membership/action reuse, explicit false, path/Profile-only updates, required remove for replacement add and inclusive UTF8 plan byte bound. New real MySQL acceptance runs original Control composition and Forward/path owners on one original PoolConnection proxy. Every mutation of migration create/apply update/no-op/add/remove/accepted-add compensation/update restoration/cancel executes first and is then individually faulted with full row inventory rollback, including attempt/event/respond. Original accepted items remain committed across a separate partial refusal. Current-state origin inspection, restoration lineage, path history, revoked admission and quarantine-before-replay are tested; same-Tx functional evidence is pending Actions. Remaining: No missing assertion identified; exact-source execution still required. |
| 62 | covered | E189, E263, E264, E265, E266, E229 | Covered: Real MySQL mTLS negotiation rejects retired boot, credential revocation and capability spoofing, retains contract-only executionEnabled:false; unauthenticated HTTP refuses. NEW legacy original one-argument constructor/db own field/own async hello prototype/subclass and no constructor I/O; explicit two-argument owner requires reader and missing reader fails without fallback. Native reader literal SELECT/columns/joins/FOR UPDATE/argument order and executor receiver, exact first-row reference, nullable/raw undecoded facts and absent undefined plus original SQL failure pinned. RETAINED transit-legacy-bindings-complete.test.ts old method argument/result identities and lazy fresh owner/native reader/member transaction dispatch; public-contract-types-complete.test.ts structural owner aliases; http-native-boundaries-complete.test.ts wire parser aliases and mTLS native fingerprint identity. NEW request Node/session/invalid counters precede fingerprint and transaction; invalid lower/upper/empty fingerprint refuses before transaction. Missing rows and stale/null boot/session precede clock/credential/malformed JSON. Revoked numeric/null/false raw flags and missing/zero/equal/expired/retiring validity/credential cases precede malformed facts and retained history; nullable node flag preserved without normalization. One dynamic clock sample per post-session call. Malformed/nullable facts/capability missing/null/string/empty and each missing tuple member preserve ordered includes traversal/receiver and first failure before history. Nonzero retained generation refuses without writes. NEW JSON.parse observed exactly once only at original point after credentials; object driver values pass unchanged. Mutable ACK literal key order/node/boot/epoch/UTC/state contract-only/executionEnabled false and same original mutable wire capability tuple, tuple mutation visibility and late clock sampling. Direct owner ignores malformed incoming protocolVersion (no newly added parser), HTTP returns opaque owner output (no response parser). SQL/clock/JSON/formatter failures preserve original error and rollback prefix, one read/no write and no independent authority. NEW actual HTTP verified TLSSocket certificate -> normalized fingerprint -> server-side Node mapping -> strict request parse -> owner with frozen parsed payload and header epoch; forged client node retained separately from mapped Node so owner validates original mismatch. Unknown request property refuses before owner. RETAINED unauthenticated TLS HTTP refusal and actual MySQL retired boot/revoked credential/capability spoof/no-coordination-write tests. NEW production-migration MySQL temporary canonical database uses actual MySqlUnitOfWork and native Transit machine reader on supplied original Tx; every success/SQL/clock/JSON/formatter scenario is exactly one transaction/query with exact fingerprint/Node bind and FOR UPDATE, no write statements. Faulting clock is armed only after native reader completion for the single owner sample; mysql2 connection bookkeeping and snapshot clocks remain normal. Complete all-table snapshots remain identical after contract-only ACK and every injected failure; transaction completes or rolls back releasing locks. No Fence clearing, delivery confirmation, coordination advance, Snapshot publication, lease issuance or history mutation. No release/live/physical-host/foundation/parallel-product acceptance inferred. Remaining: No missing assertion identified; exact-source execution still required. |
| 63 | covered | E190, E189, E267, E268, E265, E269, E270, E179, E266, E271 | Covered: Delivery preview durable replay, actual mTLS identity, revoked credential/retired boot refusal, accepted+duplicate report and digest/sequence conflict, null poll, no coordinator advancement are asserted in real MySQL. NEW old one-argument constructor/own db/held coordination fields/own async enqueuePreview poll report prototype and inherited subclass remain lazy without constructor I/O. Public TransitPreviewDelivery requires3 explicit providers, structural methods satisfy old public delivery entry. RETAINED transit-legacy-bindings-complete.test.ts held original coordination journal, fresh canonical delivery service/native store per call, all argument/result/error identities and lazy original db member/planner method dispatch. RETAINED runtime-legacy-type-map-complete.test.ts all old preparation API type aliases and current modules/runtime paths, public-contract-types-complete.test.ts public Transit API consumers, control-composition-complete.test.ts canonical native composition. NEW64 coordination owner aliases prove old/public command proof phase verifier equivalence and step function identity; NEW63 original offline step terminal-null, prepare/activate and reversed withdrawal, assignment sort/output key order/digest/mutability and missing step/bindings errors without additional validation. NEW enqueue records planner peek before original separate transaction, then Scope-stage lock actor/state before retained JSON, journal revision/plan then body digest/current step, one clock/30s cap/5s margin, runtime boot/session and original per-node binding physical owner/Fence/generation order before outbox. Changed between-transactions absent step/stage, foreign actor, aborted malformed stage, malformed reserved JSON, missing/changed journal/revision/digest/step, exact5000 expired and5001 accepted, missing runtime/boot/stale epoch, missing/foreign/wrongFence/generation slot all cut off writes. Exact physical args preserve plan assignment order. Existing durable outbox decodes and checks only original boot/session; test retains old action/expiry rather than adding revalidation. All seven row/envelope identities are pinned through decode refusal matrix. NEW delivery requireMachine fingerprint/counter guard occurs inside Tx then raw session/boot precedes one dynamic clock. Delivery-specific node_revoked/credential_revoked/credential_until/valid_until/retire_after ordering retained, specifically credential_until getter short circuit before valid_until (unlike negotiation). Numeric/null/false raw flags/zero/equal time and malformed facts overlap preserves credential refusal before JSON. Nullable/malformed facts and capability array/includes receiver/tuple traversal retain original no-normalization decisions. RETAINED negotiation63 HTTP mTLS unauthenticated tests and original native DB retiredBoot/revoked credential cases; NEW62 native HTTP bind/parser precedence remains independent. NEW poll decodes every raw row before its one row clock; malformed body or any storage identity mismatch refuses before row clock. Mixed retired boot/expired/futureissued/eligible row list preserves original per-row traversal and skips status on short circuits; only sealed/quarantined excluded, compensating and unknown raw phases remain eligible. Missing/wrong-revision status skip. Poll status call omits lock, report explicitly passes true. No extra pending sort/filter/retry inserted; native adapter pins original LIMIT16 created_at,envelope_digest order and FOR UPDATE. NEW report input Node/session mismatch refuses before Tx. Current machine lock/credential/capabilities precedes digest/replay; identical duplicate returns strict disabled ACK before highwater/envelope/freshness/coordinator even if those later facts unavailable. Different-body sequence reuse retains integrity refusal; nonduplicate highwater raw undefined/null/zero and stale sequence before pending envelope, pending identity before decode/clock, current boot/observed invalid/future/old plus30000 equality and exactexpiry checks before locked journal. Missing/wrongRevision/sealed/quarantined refuse before receipt; compensating remains allowed. Receipt insert precedes pending-only acknowledgement CAS, numeric1 only succeeds;0/2/string1/undefined and all provider/afterwrite errors rollback original outbox+receipts. Invalid ACK parser output after receipt/ack also restores Tx. No confirm exposed by planner or invoked for ACK/duplicate. NEW native codec public/function aliases, original UTC issued then validity before envelope encode, original digest and strict parser closure, exact preview/ACK key order, literal executionEnabled false, parser null-prototype and deep freeze. Object decoding is encode then strict parse; string storage is native stored JSON parse then encode then strict parse (token-parser scalar JSON calls distinguished). Malformed JSON/digest/unknown fields/invalidtime/invalidACK retain original exception. Existing parser-only digest/time validation adds no authority or clock read. NEW all14 MySqlTransitDeliveryStore methods compare exact original SQL/columns/args/receiver/error and raw first-row/undefined/list/nullable highwater/opaque facts/body. Full locked enqueue journal differs from minimal poll/report status projection and lock option. Original machine join projection, pending16/order/lock, original receipt replay/highwater no extra locks pinned. Outbox getter order includes JSON encoding exactly at body before createdAt; receipt all6 getters precede executor; every getter and cyclic JSON failure cuts off SQL. Exact INSERT column/value order and pending-only acknowledged UPDATE preserve raw affectedRows without normalization. NEW canonical production-migration MySQL database uses real native coordination planner in its first completed Tx and original delivery boundary second Tx; actual outbox INSERT fault rolls back all tables. Actual receipt INSERT and subsequent acknowledgement UPDATE each postwrite fault restore full database, numeric0 CAS fault after actual update likewise restores both writes. Success accepted and identical duplicate replay leave coordinator/Fences/leases/Snapshots/all nondelivery tables identical. Duplicate performs no envelope/coordinator/highwater read. RETAINED transit-coordination.test.ts actual durable enqueue replay, concurrent accepted+duplicate report, digest/sequence denial, null poll, unchanged offline command through transport ACK and later separate authenticated offline proof lifecycle. RETAINED transit-staging.test.ts original malformed/digest/identity/topology/Fence validator, NEW64 full body/proof/freshness/recovery and NEW66/67 staging/abort resource ledger cases reused without duplicating owner algorithms. None of authored tests establish execution authority, authenticate execution proof, advance offline state on delivery, release port, listener readiness, foundation/public-example/physical-host/parallel-product/release acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 64 | covered | E190, E269, E272, E265, E271, E270 | Covered: Real MySQL tests exact creator/session/fence refusal, concurrent journal single writer, tail-first prepare/activate, verifier rejection, duplicate proof refusal, sealed/null completion and ingress-first recovery compensation; unchanged physical owner/fence is asserted. NEW old one-argument constructor, original own db field, inherited subclass and own async begin/peek/confirm/fail/quarantineRecovery prototype entries, no constructor I/O and lazy db member read. Explicit two-provider public owner and structural consumer over legacy public methods compile unchanged. Public/legacy phase/action/command/proof/verifier aliases compile equal and canonical offlineTransitStep function identity pinned. RETAINED transit-legacy-bindings-complete.test.ts held canonical service/native store and original method argument/result/error/member transaction receivers; control-composition-complete.test.ts actual current modules/runtime composition and native owner binding/module initialization. No second Runtime directory/ledger introduced. NEW generation guard runs inside original Tx before stage lookup; Scope-filtered stage provider receives exact caller args. Missing stage404, actor403 before malformed body, retained plan integrity before aborted state, aborted409 before fresh clock, fresh exact now+5000 refusal/5001 acceptance precedes ownership and previous journal. All sorted distinct Node session-only locks precede all physical Node/protocol/port sorted slots. Missing/stale/raw numeric-string sessions and missing/null/foreign owner, wrong/raw string Fence and generation preserve strict comparisons before prior journal. Existing journal conflict occurs only after freshness/ownership. NEW begin insert row literal identity/digest/empty highwater plus distinct dynamic created_at and updated_at samples pinned; insert before step projection and original command mutable result retained. Retained body uses original phase/revision/position/plan/Forward/generation validation, raw missing/null/array/scalar/malformed JSON and foreign/invalid highwater counters. Stage JSON precedes journal JSON; malformed highwater JSON retains SyntaxError even with invalid phase; first invalid phase skips journal digest. Object highwater stays same mutable reference, inherited nonenumerable data is not newly hardened. Terminal positions require full size; active positions less than size. NEW peek and confirm refresh only preparing/activating, including exact freshness boundary and original session/physical locks. Compensation and sealed/quarantined skip clock/fresh/ownership despite expired valid retained stage and invalid current sessions/slots. Fail has no fresh/ownership calls: quarantined returns null, compensating preserves exact current command, preparing/activating/sealed persist ingress-first compensation with original highwater. Terminal confirm refuses without proof clock or verifier. NEW explicit verifier must be a function before Tx even with invalid generation/actor. Pending proof checks Node/action/digest, invalid or stale sequence, future5001/old30001/fractional time, assignment count/duplicate/unknown id/session/Fence/generation/condition all precede verifier and writes. Exact future5000/old30000 are accepted. Real async verifier is awaited with original proof identity and undefined receiver before any state advance; false/error leave whole journal unchanged. Tail prepare->activate, activate->sealed and withdrawal->quarantined reset/complete positions and preserve/update per-Node highwater. RETAINED full native DB lifecycle verifies duplicate proofs and downstream-first prepare/activate plus ingress-first withdrawal. NEW persistence revision MAX refuses after authenticated proof but before update. Original highwater JSON encoding before digest before dynamic clock before store.update is observed and each stage exception leaves original caller journal. Update carries exact original Forward/generation plus previous revision AND original journal_digest; only numeric affectedRows1 succeeds, 0/2/string1/undefined reject and rollback. Post-insert, post-confirm-update and post-fail-update step projection faults are distinguished from pre-proof step and restore original state. Every provider access and real post-write fake exception preserves original error/whole Tx rollback. NEW all8 MySqlTransitCoordinationStore methods preserve exact original SQL, columns, Scope-only foreground stage versus Scope-less recovery stage, session_epoch-only projection, physical owner/Fence/generation projection, recovering phase set/order/locks and args. Driver first-row/list/undefined/raw mutable opaque highwater and raw affectedRows remain identical with no normalization/encoding/clock/extra query. Insert and update each10 field getters evaluate in original SQL argument order; every field exception occurs before execute, original executor receiver/error retained. NEW recovery uses supplied locked order, verifies every retained stage and body, persists compensation while preserving original highwater/created_at/planDigest and incrementing only revision. Aborted valid/expired/foreign-actor stage is accepted without Scope/actor/current ownership substitution. Missing stage, malformed stage/body, exhausted revision and update error roll back earlier work atomically; empty recovery returns0 without extra reads. No session/slot checks, partial commit or protected history reset. NEW production-migration canonical MySQL temporary database composes actual MySqlUnitOfWork and native store. Injected failure after real begin INSERT, confirm UPDATE, and post-write next-step projection restores complete all-table snapshots; verifier reject/error produce no writes. Real SQL separately refuses wrong previous revision and wrong previous digest with affectedRows0. Recovery injects after each real1/2/3 UPDATE, second dynamic clock, second retained stage corruption and second raw highwater corruption; all original rows restore. Successful ordered recovery compensates preparing/activating/sealed even with aborted/expired retained stage and changed sessions/owners/Fences; only coordination changes, every other table including retained stages/resources/history stays byte-equivalent in snapshot. RETAINED transit-coordination.test.ts actual preview/received transport ACK leaves same offline command and never calls authenticated confirmation; unchanged physical owner/Fence and isolated coordination migration asserted. Existing staging integrity and original functional lifecycle retained rather than copied. No default verifier/network/Snapshot/lease/port release, live execution, foundation/physical-host/public-example/parallel-product/release acceptance inferred. Remaining: No missing assertion identified; exact-source execution still required. |
| 65 | partial | E191, E270, E157, E273 | Covered: Preparation binds3 nodes/protocols/sessions/pins/fences and tail-first activation, deterministic immutable plan, invalid ownership/generation/credential/capability/CIDR/topology refusals and no active staging SQL. Remaining: Exhaustive competing-invalid first errors, native property/getter/JSON/ISO/hash call ordering and canonical/legacy function identity remain unmapped. |
| 66 | covered | E274, E275, E191, E276, E277, E278, E265 | Covered: Fake SQL tests same-owner/foreign-owner refusal before fence overwrite, fence+1/6locks/3writes; real MySQL proves whole reservation rollback, one concurrent winner, owner retention and monotone fence2 re-acquisition. Malformed logical sets refuse before I/O. NEW real TransitReservations over RuntimeExclusiveReservations uses one supplied Tx and original store receiver. Invalid empty/incomplete/duplicate resource set refuses before storage. All unique sorted Node locks precede all physical sorted ensure/slot/assign calls; raw zero/two rows and string length1 refuse by strict row-count, missing slot and same/foreign owner refuse without assign, fence negative/fraction/nonfinite/string/MAX refuses while0 and MAX-1 return original fence+1. Returned spread key order, detached unfrozen result array and unchanged reversed input preserved. Native SQL row is modeled as a detached read copy, so assignSlot mutates retained store without changing the already-read fence. NEW all allocations precede count reads and every late policy callback. Raw missing row/missing n/null/negative/non-numeric string and numeric string counts preserve original Number semantics; custom valueOf is logged before policy, thrown Number conversion skips policy. Capacity callback independently sampled per sorted Node after all assignments, first succeeds second fails and caller rollback restores every slot. Every lock/ensure/read/assign/count/policy ordinal failure preserves original error and rolls back fake caller state. NEW canonical production-migration MySQL same original MySqlRuntimeResourceStore/RuntimeExclusiveReservations/TransitReservations stores all6 ensures+6 assignments before capacity0 refusal; full database snapshot is unchanged. Stage injects failure at every13 real write ordinal including final retained journal insert; all original allocations/fences/generation/state/history restore. Two simultaneous first-stage writers serialize on actual Forward lock; one reserved stage wins and other refuses RESOURCE_CONFLICT. RETAINED transit-mysql-acceptance.test.ts tests physical contention/duplicate writers/same-owner refusal and fence monotonicity. RETAINED resource-sql-complete.test.ts pins original minimal exclusive owner/fence SELECT and every Runtime resource SQL/args/receiver, original assign without affected-row validation, Direct/Relay modes and exact release SQL. Do not duplicate or substitute another resource store. RETAINED transit-reservations-db.test.ts strict same-owner versus foreign and successful returned fences; transit-legacy-bindings-complete.test.ts old async reserve signature/one owner/dynamic default policy/canonical aliases; current source/type consumers remain required on frozen candidate. Remaining: No missing assertion identified; exact-source execution still required. |
| 67 | covered | E270, E190, E275, E276, E277, E265, E191, E278 | Covered: Staging pure immutable journal/refusal and isolated non-executable SQL, reservations rollback/exclusivity and abort refusal once coordination exists are asserted. NEW actual TransitStagingService uses original Runtime reservation/release owners in supplied Tx. Guard invalid revision/generation before transaction, Forward lock before revision/authorizer/topology/latest, newer target/reserved journal/generation exhaustion and session failure retain original errors/cutoff. Sessions sorted before locked Profile and one dynamic wall-clock sample; Node authorization/facts/currentOnly peers follow sorted Nodes, endpoint calls preserve hop order. Greatest peer validity then lexical fingerprint selection pinned. Original offline compiler/frozen plan/intent connection limit4096, original retained JSON/digest (strict-parser null-prototype Intent versus ordinary retained JSON objects are explicitly compared by full JSON plus separate prototype assertions) and one sampled created/updated/expiry time pinned; exact10s credentials deny,10s+1 accept and expiry min(authority,5minutes) retained. NEW endpoint candidate iteration respects original allowed port order and per-hop seen set, retries occupied first port for next protocol but skips selected physical port. Distinct candidate literal-TCP and parameterized physical owner reads occur before same-Tx exclusive reservations; any physical owner including same Forward refuses. Original raw missing candidate/physical rows remain adapter values. Every stage provider/final insert error restores allocations and no journal publication. NEW abort actor precedes retained plan check; malformed retained JSON denies even already-aborted state, valid aborted stage returns false without coordination/clock/Runtime reads. Unused nodes/Forward/Profile/endpoints/reservations may be null for abort. Any coordination row denies before Runtime/history; sorted locked Nodes require exactly1. One dynamic clock then nullable/missing raw max lease uses original +5000 margin; equal boundary succeeds and +1 denies. Snapshot query gets now-5000; lazy malformed JSON retains SyntaxError, absent assignments refuses, null assignment retains original TypeError, matching Forward denies and unrelated assignment allows. NEW RuntimeReservationRelease locks/checks all6 retained assignments in original order before any update, verifies exact owner/fence/generation. Missing or changed second slot refuses before first release; first/later release affectedRows0 and stage CAS0 preserve original INTEGRITY_FAILURE/message. Midrelease/provider/stage errors rollback all earlier releases and retained state. Exact release arguments include original Forward/fence/generation, then original reserved-only abort CAS uses same now. No broad release or protected history mutation. NEW independent all11 MySqlTransitStagingStore methods compare literal SQL/args/FOR UPDATE and exact projected/raw row/list/missing/null/opaque JSON values, original executor receiver and driver error identity. Insert getter evaluation pins all11 field order and original error before execute with no extra encoding. RETAINED resource-sql-complete.test.ts covers exact minimal resource SELECT/release SQL, avoiding duplication. NEW production-migration MySQL composes actual Forwarding and same native staging/resource/release stores with injected public upper facts/Profile/endpoint ports; no second authority or ledger. Real first-stage writer contention plus post-allocation capacity refusal and all13 stage writes rollback complete canonical database. Every6 release updates plus stage CAS faults and zero affectedRows first/later/CAS restore full retained journal/resources/fences/history. Changed second native slot fails before any UPDATE. Actual execution lease now-4999 denies and now-5000 permits; Snapshot valid_until>now-5000 exact strict query boundary denies +1 and ignores equality. Successful abort retains lease/Snapshot bytes, clears only exact owners while retaining fences/generation; repeat false. RETAINED transit-legacy-bindings-complete.test.ts verifies old five-argument coordinator/own stage-abort/held owner/native initialization/lazy callback receivers and aliases; transit-staging.test.ts verifies retained plan topology/digest/deep freeze; transit-preparation.test.ts verifies compiler resources/intents/peer pins/full identity limits and no mutation. Root current public type/canonical alias consumers and exact-source Actions required; no A1/A2/foundation/product/live-execution/physical/release acceptance inferred. Remaining: No missing assertion identified; exact-source execution still required. |
| 68 | covered | E209, E220, E279, E280, E281, E231, E215, E170, E244, E282 | Covered: AuditEvents/AuditReadModels: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors NEW all fifteen original native SQL families assert owner tables, source-bound scope, no locking or writes, stable descending occurredAt/source/key ordering, PK SHA projection, LIMIT plus one and recorded versus operation attribution. Access explicit node, security owning Scope, immutable template config/group revisions, binding expanded spec, batch plan sources/proposed specs and accepted compensation state remain in generated SQL. Binary identity/error filters and before-position argument order pinned. NEW projected native numbers accept safe decimal BIGINT strings zero and MAX_SAFE_INTEGER, reject coercive forms unsafe negatives fractions missing booleans; flags retain only null true false numeric0/1. Mapping happens after native decoding and preserves original unknown fields and mutability for later owner validation. SQL errors and mapper exceptions retain identity. Admission invalid source/limit/window precedes any executor and source mismatch/unsupported transport node filtering returns no SQL. NEW old application aliases, owner policy array identity/mutability, lazy unchecked AuditReadModels callback and Object.create(MySqlAuditEvents.prototype) seam preserved. Native HTTP adapter retains exactly ten query names, original iteration order/single-values/empty-value behavior; duplicate and unknown query refusal. Default wall-clock function captured without sampling then retains original function after Date.now replacement. NEW owner query guards canonical ISO UTC bounds max window/page size filters actor/scope plain closed input and invalid clocks before Tx. Closed row scalar and cross-field semantic matrix rejects malformed identities enums counters error/flag fields source mismatch explicit-node attribution actor attribution revision pair operation tuple and batch forward/operation/position. Exact filters and immutable association node behavior retained. Nonarray/oversized/duplicate/ascending rows before result are refused with rollback. NEW canonical cursor closed shape/version/digest/position/source/key/window/order checks, explicit bounds and query mutation rejection, cross-actor continuation, merged text tie ordering and before-position refusal. Frozen DTO flags/coverage/items preserve read-only execution-disabled latest-state semantics. Late invalid clock and native UTF8 byte-cap refusal rollback. Independent request slots, active actor slots, 128-key limit, cooldown exact expiry eviction and failure release retained. NEW gated actual MySQL test creates isolated database using production migrations, executes all fifteen native projection SQL families with and without immutable-node filter plus out-of-scope refusal, seeds an actual explicit-node access event with secret JSON, then passes native storage through actual owner query. Report redacts unprojected secrets and preserves every table byte-for-byte. This source test is authored but was not executed. RETAINED audit-owner-transactions.test.ts establishes authored authorization-before-read same-Tx sequential sources two-clock frozen result existing pagination duplicate refusal request capacity and reader failure cleanup scenarios. No production code or existing tests changed. Item69 diagnostics owner not extended by these two Audit files. NEW uses isolated MySQL database and production migrations without DDL substitutes. Populated same-name templates in two Scopes each have two immutable revisions while current heads point to archived revision2. Actual template-node query returns only corresponding revision1 old-node versus revision2 new-node; uppercase/foreign-node are excluded. Both Path candidates and Ingress members join exact template revision plus configDigest plus original Scope. Populated wrong-digest, nonexistent revision64, foreign-Scope-only template and null-member configurations remain visible unfiltered but never claim a filtered node. Foreign-Scope matching revisions return only when that Scope is selected. NEW actual Forward current spec, historical revision spec, Path expanded binding and Group expanded binding each use different nodes. Binding filters accept their expanded ingress and via nodes while excluding current Forward, historical Forward and current template nodes; provenance, sequence and forwardRevision pinned. Operation filters instead accept immutable target forward_revision history and exclude current spec; actual latest update/requester attribution retained. Known error string and actual JSON boolean retryable survive, lowercase unknown becomes OTHER_ERROR, numeric error and string or integer retryable become null. Native binary error and Scope filters are asserted on populated rows. NEW each of Path publication, Ingress deployment and Ingress migration has actual owner row, create and recovery events, populated item plans and actual attempt rows. Source/proposed Path nodes, deployment item spec, migration add spec and source-state nodes independently associate the batch. Accepted result-state node alone does not associate a batch. Recovery actor is null with unattributed-recovery although stored actor exists; events have no Forward/operation/position, retain true invalidation and still represent cancelled invalidated owner records without claiming execution. NEW all3 attempt families actual accepted apply/create project receipt Forward/revision/operation and result.state spec. Rejected publication apply projects original baseline, rejected deployment create has null Forward/revision but its planned spec node, rejected migration add source=null has null identity but add spec node, and migration update/remove retain source-state identity/spec. Rejected compensation projects accepted predecessor state rather than baseline; accepted compensation projects its own new receipt/state. Rejected compensation without an accepted predecessor state remains null-attributed. Node truth tuples explicitly distinguish original baseline, proposed/planned, accepted and compensated nodes. NEW actual JSON strict typing: accepted=true versus accepted='true' and missing accepted classify accepted versus invalid; nonstring receipt Forward/operation and string revision project null. Zero receipt revision is a lower native counter but rejected later by original owner integrity validation. Known, lowercased unknown, private unknown, numeric error codes project exact allowlist, OTHER_ERROR or null; errors never leak message/retryable provider details. Actor filters are case sensitive, Scope and foreign accepted-result nodes remain isolated, and operation/Forward/error filters select the real matching attempts. NEW real owner queries use canonical native storage through a proxied actual original transaction connection. Scope authorization is the first observable action on that same Tx, and every native executor call is guarded to SELECT audit.* with no FOR UPDATE or mutation. Actual accepted plus rejected compensation are reconstructed into safe closed DTOs; malformed accepted integer and zero revision rows cause INTEGRITY_FAILURE after actual SQL. Denied authority performs no source query. Every table is snapshot-compared unchanged after all success/refusal and HTTP scenarios. NEW actual createControlApp Audit route uses actual AuditEvents, AuditReadModels and populated native MySQL store. Bearer observation auth occurs after admission, then actual owner authority/native SELECT run and release returns no-store read-only disabled-execution sanitized JSON. Duplicate query and Cookie refusal perform no owner Tx. Missing authenticateObservation with installed Audit returns AUDIT_UNAVAILABLE before owner effects. Injecting native Buffer.byteLength result131073 for the actual owner report crosses original131072 response budget and routes INTEGRITY_FAILURE409 without persisted changes. This is response-byte boundary fault injection, not a claim of transmitting a physical oversize socket payload. RETAINED optional-http-services.test.ts Audit entry executes named and old positional createApp route wiring, missing Audit, admission429, observation authentication401, owner409, capacity release, Cookie denial and unknown query422; HTTP helper uses actual app.request dispatcher, not a physical socket. RETAINED http-query-family-complete.test.ts covers Audit native ten-key parser, original alias, duplicate/unknown and output behavior. Audit is GET with closed URL query; no declared request-body decoder is invoked on this route. The earlier generic request-body-size residual was therefore not an unimplemented Audit request contract; actual response budget is now connected to the route above. RETAINED observation-public-types-complete.test.ts independently enumerates Audit source/error literals, complete raw storage and owner record DTO shapes, nullable counters and mutability, filters, queries and generic storage/read ports. legacy-entrypoints.test.ts holds old Audit contract/service/read-model/policy export aliases; type-source-compatibility-complete.test.ts holds old application Audit public type declarations. server-composition-complete.test.ts retains full native server optional Audit installation and provider initialization graph assertions. Earlier frozen new tests retain original lazy constructor/prototype seams, per-query source SQL counter/flag decoding, query/cursor/ordering/admission and source-array identity coverage. No foundation contract, production implementation, frozen tests, shared docs or CI changed. No tests/static checks/builds/MySQL/server/network experiments/commits ran in this agent. Item69 diagnostics is a different owner and remains unchanged. Physical-host/public-example/foundation freeze/parallel-product/release acceptance are not established by this source assertion map. Remaining: No missing assertion identified; exact-source execution still required. |
| 69 | covered | E209, E283, E284 | Covered: ForwardDiagnostics: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Original public constructor, legacy policy/DTO/read-port aliases, exact native Probe wire type/parser identities One same-Tx sequential authorized bounded read and one captured optional wall-clock sample; exact failures and mutable provider input references Per-instance request and actor concurrency, 128 actor budget, inclusive cooldown and finally cleanup Original Node freshness reason precedence and clock/credential/session/Snapshot/report endpoint decisions Assignment driver physical protocol, report phase/context, reservation, path adjacent linkage and historical cleanup Retained v1 v2 v3 contexts, measurement, binding and digest/time/acceptance/withdrawal refusal; requestId and framing catch/body projection boundary Same-read support stable traversal aliases redaction exclusions nested projections, exact UTF8 digest and ordered inclusive byte ceilings Original native synthetic requestId parser and body dispatch including fallback, one selected JSON encoding and error identity Lazy module singleton native SELECT proxy, own async prototype, original argument/result/rejection identities SELECT-only lower SQL arguments order bounds lookahead, typed counters/flags/errors/JSON byte ceilings, nested Snapshot/report invalid flags, assignment observation/drain correlation and relay/hop digests Remaining: No missing assertion identified; exact-source execution still required. |
| 70 | covered | E209, E221, E285, E286, E211, E215, E231 | Covered: StationAlerts: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick Compile-time exact flat/product Config/State/Policy/Event/Store/API and producer enqueueIn(Tx,scope,policy,event,now) declarations; original public/application StationAlerts constructor+prototype identity, parser/evaluate/advance/empty-state/reasons/limits/storage providers identity. Original public Audit array identity and mutability retained; no frozen replacement invented. Direct actual parser corpus: forward threshold0,report30..3600,credential60..604800 exact boundaries; closed/plain/null-prototype/schema/bool/kind/target/id/integer/threshold refusals. Evidence four kinds exact closed/counters/time/Operation statuses/kinds/source and Audit error normalization. State condition/opening/last/episode/time consistency; policy configRevision<=revision,digest,target/evidence/time/suspension; event immutable config/evidence/opening/silence/ack/recovery rules; acknowledgement audit revision is event CAS and does not require current policy revision. Actual pure evaluation and advance: clock regression before disabled/missing/binding,administrative/recovery/evidence-invalid/unavailable/clock-uncertain branches. All allowed create/update/enable/retry failures fire; disable/delete/policy/revoke administrative; accepted/running unknown and superseded administrative. Same operation/older successor/no higher revision-or-source proof cannot recover; proven successor source or newer matching Forward revision does. First firing increments episode and emits once; repeat does not; unknown preserves existing firing; proven clear recovers and releases opening. Node report evidence rejects revoked/type/credential/report/clock/binding differences; fresh threshold equality and min(observed,received) semantics, stale requires an armed same-instance baseline. Boot or session change invalidates an existing incident instead of claiming recovery and resets arming; fresh same instance proves recovery. Credential expiry/threshold equality versus valid, renewal requires a later credential deadline. Episode safe-integer exhaustion refuses; backward advance retains old evaluatedAt/condition while last records clock-regression. Actual returned nested values frozen. Actual public command transaction trace: manager auth then replay before all storage/fact/clock; Scope then policy lock, CAS then disabled-inclusive64 quota, original target fact, configDigest, clock, policy write, audit, idempotency response, commit. Replay with missing target and invalid current clock remains replayable; corrupt receipt refuses before Scope lock. Noop publish avoids policy/audit; disabling the same known target skips facts, changed target still requires original fact. CAS/quota/corruption/backclock/revision exhaustion refuses before writes. Silence deadline syntax before admission but new future/max7day semantics AFTER replay; exact seven-day allowed, unchanged silence no write, configRevision retained. Acknowledge uses event lock/revision and audits resulting event revision independently of current policy; noop keeps history. Every policy/event write,audit,response failure rolls back original policy/event/audit/receipt together, not a replacement store. Actual public read distinctions: policy reads require manager=true; event/history use ordinary Scope read. Policy64+duplicate/corruption and detail16+1 audit. Summary projects condition/lastReason without state. Fixed canonical UTC query/cursor, explicit frozen window, exact filters/rule/kind/acknowledged/limit; descending timestamp/id keyset and filter/window corruption refuses, losses closed safe counters. No read asks facts or creates execution authority. Actual worker every due/candidate/auth/lock/latest/fact/append/enqueue/state-write failure rolls back policy/event/outbox and separately defers original latest candidate revision+cutoff for300000ms. Due-before-header failure invents no header; secondary deferral failure preserves original exception. Ticking resets and next tick succeeds; overlapping finite asynchronous fact read does not enter a second transaction.403/404 manager denial suspends without facts/event. Original supplied handoff sees same Tx and exact policy/event/time. Actual service source VM with declared native clock/byte collaborators preserves default Date.now function capture without clock reads, enabled=false/skew1000/optional handoff defaults, independent actors/ticking/request/active state; injected clock/skew0..300000 and invalid clocks. Per-instance2request and2active actor gates,128 retained keys, exact1000ms completion monotonic cooldown under wall rollback, finally after success/throw. Native response262144 versus262145 exact bound and nested freeze/refusal; every list/detail/history/command public response takes original byte guard. Actual parsers bridge only VM-created record prototypes via structuredClone, while parser refusal corpus calls original public validators directly. Eight actual lower source VM suites inject only declared mysql rows/write/json and native providers. Initialization has no SQL/row decoding. Strict original integer strings/max/positive flags/text/null/JSON1024/8192/4096 UTF8 refusal; original asserted policy/audit/event callbacks preserve invalid-but-bounded record timing so full owner parser still refuses later. Getter-driven config/state decode order, no invented eager full validation. Original SQL scope insert+FOR UPDATE, count64/list65/count override, policy row locks and upsert14args preserve immutable createdAt. Existing policy bypasses count; old zero-arg wrapper invokes this.policyCount override and shares prototype-bound implementation. Event body rule/target association then actual mutable denormalized id/policy/time/kind/episode/configRevision/revision/ack/recovery columns override immutable JSON body; corruption stops before value callback. Exact fixed SQL history equality filters/ack NULL/keyset/order/limit+1, due unlocked nextEvaluate/scope/policy order, losses defaults/max, ack revision+1 only unacknowledged below safe max with affected-row CAS, conditional revision/cutoff/enabled/suspension deferral. Retention strict30day cutoff/oldest16, fullness1024 evicts oldest1, audit256 evicts oldest1, all three loss increments guard max-amount and failed updates abort before insert; overfull1025/257 refused. Passive fact SQL projects only fixed JSON scalars and exact original scoped latest matching Forward revision; no FOR UPDATE or full Runtime/report/snapshot bodies. Operation kind/status/error/nullable state mapping and missing operation lazy handling. Node bounded1MiB report/4MiB snapshot shapes, exact boot/epoch/sequence/generation/node/deadline/digest association, canonical ISO time, invalid report projection falls back report:null/invalidReport:true without promoting authority; no-report skips every expensive report/snapshot getter. Unknown/lazy error normalization and legacy facts wrapper preserved. Actual original storage binding creates a single Set from exact supplied mutable Audit error array at module evaluation; later array additions do not mutate captured membership. Frozen parser provider identity callbacks remain assertion-only. AST source and type imports of lower stores restricted to Core/framework/mysql/native-storage leaves. Two real canonical MySQL suites use isolated migrated databases with actual MySqlStationAlertStore. Native quota64/update path,audit256+eviction,event1024+oldest eviction,ack CAS,history ack filter,original revision/cutoff defer,strict equality30day and bounded16 pruning with one expired survivor,original malformed-state assertion timing. Every successful native scope/policy/audit/event/ack/defer write followed by injected failure restores all four original table snapshots, including both prune/loss stages and full queue eviction. All three loss-counter saturation cases roll back prior deletion. These tests are authored but require Root native Actions route with database env. Existing direct producer owner trace manager auth before Scope then locked latest policy, append before original handoff before state commit; revoked manager does no facts; handoff/state failure rollback and original guarded revision deferral; latest revision/manager/enabled/recovery/deadline guard and overlapping ticking. Existing real canonical MySQL Station recovery changes only operational suspension/evaluation/state retaining definitions/event/audit/history and rollback. Real native Station event append precedes original Notification outbox insert on the same original transaction, without secret/Sender/new authority effects. Existing exact original Station Rule/Config/Reason/Evidence/State/Policy/Event/Audit/Store/Facts/Storage record/query/callback declarations, field mutability and public aliases. Original public/legacy Station event query helper identity and closed/duplicate fixed query parameter refusal. Original named/positional optional Station HTTP availability, admission-before-auth, owner await/error/finally release and no-store headers. Remaining: No missing assertion identified; exact-source execution still required. |
| 71 | covered | E209, E213, E214, E218, E216, E287, E288, E289, E290, E217 | Covered: Notification secret/vault/HTTPS sender: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Native sender test replaces original DNS and HTTPS functions only: cancel with pending DNS or guard retains admission until true completion; close joins drains. HTTP302/503 returns rejected,204 delivered; request error returns unknown; one DNS and one request per send with TLS1.3/rejectUnauthorized/agent:false. Worker acquires exact scope/endpoint/revision/authority secret binding only after claim commit, zeroes passed bytes after result and releases lease only after sender idle. Actual public endpoint command/read implementation: Scope manager authorization and replay before secret availability; CAS/quota/policy/clock/authority refusal before durable stage; exact stage binding then SQL/audit/response; injected late failure rolls back SQL but retains staged orphan; disable keeps credential revision/reference; no-op disable and redacted read16+1 audit/corruption boundaries. Original lower SQL retention/CAS/old override clauses shared by Notification endpoint and delivery requirements; engine effects remain unverified. Seven actual Linux filesystem/crypto tests build secure own-homedir temporary parents, separate Authority sentinel,700root/records600key and ciphertext files. Real AES256GCM decrypt with exact AAD plus HMAC reference recomputation, canonical material, immutable replay/no replacement, captured key zero on close/reopen and exclusive writer lock. Closed binding/request/reference/destination refusals; pre-open canonical path/ancestor/root/records/key type/mode/size/symlink/hardlink/unknown-entry refusal. Authenticated envelope duplicate/unknown/key/base64/AAD/version/time/size/inner-destination tamper corpus and serial recovery. Runtime inode/key/records/permission/link/unknown-root tamper and impostor lock preservation. Actual stable31 reference stage bound (two temporary names reserved), inventory32 permits transient authenticated two-link temp/final pair; one-day strict equality, oldest lexical16 prune, same-endpoint keep/pin/hardlink protection and startup acceptance of retained pair. Frozen leases2/idempotent release, same-reference two-pin retention and close awaiting final release before writer unlink/key scrub. Nine test registrations execute actual original notification-secrets.ts in VM with declared fs/path/process/crypto collaborators. Real native crypto complements controlled inode/stat/read effect races; no copied Vault implementation or production hook. Module init/platform/getuid/canonical-path refusal, exact O_EXCL\|O_NOFOLLOW modes and writer write/sync/root-sync ordering. Open failure scrubs captured key, closes lock and conditionally unlinks only captured same identity; pre-identity failure leaves unidentified lock; ordinary error details sanitized while original allowed RESOURCE_LIMIT preserved. Bounded native read asserts initial/fd-before/fd-after/named dev/ino/uid/mode/size/mtime/ctime/nlink equality, short/growing/oversize reads, close and scratch zeroing. Complete parent key-versus-lock identity semantics and ancestor UID/writable/symlink inventory guard. Stage write/fsync/close/exclusive-link/dir-sync/unlink/dir-sync failure boundaries, no overwrite of colliding final, encoded/plaintext zeroing even cipher/parser failure; authenticated crash-state orphan replay/reopen retains existing final bytes. Original inventory body checks4096/4097 global and32/33 endpoint counts; original stage body4094/4095 retained-slot boundary with controlled authenticated envelope collaborators, alongside real31-reference Linux corpus. File identity rechecked before prune without consuming pinned/kept/changed record. Original serial close waits queued publication and final lease, rejects new work, closes writer once and zeroes key. Reuse publish/replay-before-secrets and durable stage-before-SQL/audit/respond with rollback orphan; actual public endpoint get/list/disable redaction and bounded owner metadata, independent of actual native secret storage. Reuse exact bound credential lease scope/endpoint/revision/authority, commit-before-acquire/send, key-byte zeroing and idle-before-release worker integration. Reuse existing original sender DNS/guard cancellation and physical drain evidence; do not count these as complete DNS/HMAC/deadline/socket corpus. Actual sender module initializes without DNS/TLS/HMAC/timer effects. Destination/identity/JSON-object/body UTF8 16384 versus16385 and Unicode overflow/32byte Uint8Array/beforeDispatch refusal before effects; pre-abort and HMAC failure secret-copy clearing. Complete native IPv4 denied branch corpus includes 0/8,10/8,127/8,CGNAT100.64..127,linklocal169.254,172.16..31,Azure168.63.129.16,192.0/16,192.168,192.88.99,192.31.196,192.52.193,192.175.48,benchmark198.18..19,documentation198.51.100 and203.0.113,multicast/reserved224+. IPv6 denies mapped/translated/special/linklocal/multicast,2001 lower512 anddb8,2002,3ffe,3fff below1000,2620:4f:8000 and outside2000..3fff. Malformed IP/family mismatches, bad family, empty/nonarray/9answers and mixed-public/forbidden sets refuse before guard;8answers/public neighboring boundaries accepted. One native DNS all:true/verbatim:true request; first validated address pinned even a different host/all lookup invocation; HTTPS443 POST normalized path/hostname/SNI,agent:false,TLS1.3,certificate validation,8192header,autoSelectFamily:false. Exact headers and HMAC SHA256 of deliveryId LF plus immutable original UTF8 body, original ContentLength and payload despite caller body/key mutation, copied key zeroing. DNS synchronous throw/error/2000timeout retain pending native callback ownership and2attempt capacity. Total monotonic5000 budget before/after guard, timer late success/failure and guard-denied/failure never dispatch. Existing drain registration-race and guard cancellation tests reused separately. Cumulative response exact4096 versus4097, incomplete/undefined/out-of-range status and established request error/response error/aborted produce original unknown codes. Synchronous request creation throw leaves no request object and produces rejected NETWORK_UNKNOWN; the strict request count distinguishes this predispatch failure from the dispatched unknown cases. HTTP100..599 class boundaries including redirects408429503 preserve original delivered/rejected result and one DNS/request without redirect/retry. Independently delayed req-close and socket-close retain capacity/idle after HTTP settlement; close cancels second dispatched attempt and waits both actual controlled events. Postdispatch deadline/cancellation destroys incoming/request/socket, ignores late response while destroying it, clears all native timers and close rejects further dispatch. Existing native module test preserves registration-race listener identity, outstanding DNS and guard capacity after cancellation, real callback/guard drain, and no retries/redirects with original public outcomes. Compile-time exact lower NotificationSecretBinding/Destination/Lease/Secrets/SendCode/SendResult/Sender signatures, fields, mutability and optional signal; actual product/flat effects and API aliases. Public and application constructors are identical with identical prototypes and exact original method sets. Endpoint/delivery parsers, wire/constants/storage provider aliases retain identity. Actual original endpoint/delivery modules evaluated with declared native clock and byte collaborators. Constructor default captures one wall-clock function without reading it; later source mutation does not replace the captured function; injected clock bypasses capture. Retains exact supplied providers, independent actor maps and zero active/request/running/stopping state; enabled+missing secrets refusal and clockSkew0/300000 boundary. Invalid time refuses. No eager secret or send effects. Separate per-instance request2 gate holds two awaiters and releases success/rejection/synchronous throw in finally. Independent actor2active gate rejects duplicate active key and third actor while independent request gate and second instance remain usable. Cooldown is completion-time monotonic+1000 under wall rollback, exact equality expiry, finally on all failures.128 inactive retained keys refuse129 until equality purge; active key never expires; failures leave cooldown but release slot. Original bounded responseBytes131072 versus131073 and262144 versus262145 plus deep nested freeze/refusal-before-freeze. Every public endpoint list/get/publish replay/publish/disable replay/change/noop and delivery get/history invokes same original byte guard and redacts Authority digest, credentialRef, signing bytes and destination. Original source tested in VM; parser collaborator uses actual parser after structuredClone solely to bridge VM-created plain-record prototypes. Parser rejection corpus executes original public parsers directly outside that bridge. Actual in-memory native HTTP application publish8192 versus8193 and disable1024 versus1025 UTF8 bytes, closed wrapper/revision/query refusal, no owner invocation on refused request, request admission finally and no-store response header. Strict publish argument assertions preserve native bounded JSON null-prototype config/destination records with exact original fields and values. Original config exact10/3600 interval,16 sorted policies/three sorted kinds, closed/prototype/schema/bool/duplicate/unsorted/unknown/empty/oversize refusals; canonical HTTPS+32byte lowercase hex destination closed/key/URL refusals; invalid publish/disable identities/CAS/config precede actor admission and all effects. Seven real Linux filesystem+AES/HMAC immutable Vault corpus; detailed full assertion map in Ctmp tunex-b-notification-vault-complete-evidence.json. Separate Authority sentinel, protected paths/modes/inodes/symlink/hardlink/envelope authentication, immutable staging and orphan replay,31stable/32transient cap, strict-day16prune,2leases/pins/close wait/key zero. Nine actual-source effects Vault corpus: native lock/write/fsync/link/unlink ordering and every failure, captured-identity cleanup/refusal,4096inventory+32endpoint/stage slot bounds, buffer zero and serial physical close. Detailed map in previous Vault evidence; no copied implementation. Nine actual-source Sender corpus: all original IPv4/IPv6 denial branches and neighboring public addresses, malformed/family/mixed/count0/8/9 DNS, exact immutable UTF8/HMAC and key zero, pinned lookup/TLS/SNI/fresh-agent/no redirect/retry options,2000DNS/5000total monotonic deadline,guard capacity,4096response,HTTP status/unknown outcomes,actual controlled req/socketclose physical drain. Full map tunex-b-notification-sender-complete-evidence.json. Controlled effects do not claim real external network success. Original native imports registration-race listener identity plus pending DNS/guard physical cancellation drain, one request HTTP redirect/reject/unknown behavior. Actual public endpoint owner manager auth then replay BEFORE missing secrets; CAS/quota/policy/clock/authority refusal before stage; exact binding/revision/reference and durable stage-before-SQL/audit/respond; each SQL publication failure rolls back while orphan remains. Original disable/noop keeps credentials,16+1audit and corrupt/duplicate/redacted reads. Original lower endpoint/outbox SQL/order/args/closed values/old count and get override hooks/public wrapper singleton initialization and lower-only imports. Shared with35/72. Six canonical real MySQL assertion registrations for endpoint/outbox quota/CAS/retention/loss/JSON corruption and each native write rollback. Authored engine effects do not imply local or Actions execution pass. Remaining: No missing assertion identified; exact-source execution still required. |
| 72 | covered | E209, E213, E214, E218, E216, E217, E291, E290, E215 | Covered: NotificationDeliveries: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Worker tests verify claim commit-before-acquire/send, current dispatch manager reauthorization (revoked manager yields cancellation), missing lease yields nonnetwork credential refusal, unknown result preserves unknown and persisted30s retry-wait rather than immediate resend. Claim and finish failures roll back their transactions with retained fence; worker ticks coalesce and close waits actual idle then lease release. Read output contains no credentials/destinations/authority references. Actual public delivery owner: policy/event/time-before-routing, route-only integrity loss mapping, disabled/silenced/recovery accounting, deterministic same-Tx insertion; denial precedence, manager sorted auth and original lock order; active2/rate/equal/6attempt/expiry/claim fence/revision; preflight5second/backclock; stale finish no writes; retry codes + HTTP408/429/500 + strict lifetime + sixth attempt; readonly SHARE detail/canonical cursor/filter/order/duplicate validation; original header5minute deferral with rollback. Original lower SQL retention/CAS/old override clauses shared by Notification endpoint and delivery requirements; engine effects remain unverified. Complete storage SQL effects/CAS/retention/old get hooks/all native-write rollback package shared with35; exact-source Actions execution pending separately. Eight actual public owner lifecycle tests with supplied TransactionBoundary snapshot rollback (no copied owner). Every current policy/endpoint identity, enabled/config revision, manager, credential revision, subscription kind/policy, Authority, recovery/actor-not-authorized and silence branch cancels before claim without lease/send;403/404 authorization denies versus409 provider failure. Invalid Authority binding refuses rather than inventing a new outcome. Every route rotation after bound acquire is rechecked by beforeDispatch and yields original DISPATCH_DENIED, retaining original binding/ref. Credential-only revision case starts with valid matching endpoint revision. Nonconfig policy revision and opaque reference alone preserve original non-denial semantics. Additional fence/status/event expiry/backclock/5000margin races suppress physical dispatch. Acquire rejection and malformed closed material/URL/key distinguish CREDENTIAL_UNAVAILABLE from changed/revoked DISPATCH_DENIED after preflight; no sends; only acquired lease released and release follows physical idle. Exact original body field order and digest/wire body dispatched outside Tx with immutable deliveryId. Unknown DEADLINE recorded once with original retry; zero every sent key on success/send throw/finish throw/idle throw/release throw. Idle rejection still releases. Every post-header claim provider position due/candidate/auth sorted managers/Station/endpoint/outbox/active/rate/put/append and finish lock/get/finishAttempt/put failure restores original Tx row/fence/attempt/rate state and original header revision/cutoff+300000deferral. Due-before-header failure has no invented deferral; failed secondary deferral preserves original error and cleanup. No hidden resend. Post-send revision/fence/deadline/backclock/status races leave protected pending attempt untouched and still scrub/release. Tick coalesces during send and idle. Close sets stopping, closes Sender, rejects new dispatch through guard, joins running physical idle then lease release; sender-close error retains stopping, failed running is joined without replacing its earlier error; no-due run returns running=null. Actual three-route same-Tx handoff fails insertion1/2/3 and rolls back every earlier deterministic row; selected route filtering excludes disabled/recovery/other-policy/other-kind, retains exact wire body/digest and never sends during enqueue. Shared constructor/default-clock/Options skew/instance/request2/actor2/128key/monotonic cooldown/finally, exact byte bounds/public projections and original aliases/type contracts as mapped71; all read APIs keep no secret lease/send effects. Complete source handoff policy/event/time-before-route-lock and only route-integrity failure loss mapping, disabled/silence/recovery deterministic same-Tx insertion. Claim denial precedence/sorted manager and owner locks/active2/rate-equal/expiry/max6/expired claim/fence/candidate revision. Preflight exact5000 margin and finish stale guard. Complete retry code+HTTP408429500/sixth/lifetime strict boundary. Readonly SHARE head then attempts, closed/canonical history window/cursor/filter/order/duplicate/loss validation; original header five-minute deferral and rollback. Original integration claim commit BEFORE exact bound lease acquire, sorted manager authorization and original owner lock order; beforeDispatch reauthorization, unknown no immediate resend; revoked manager/missing secret refusal; append/finish rollback; key zero before physical idle and release, coalesced tick and close joining sender drain; GET projections never expose credentials. Shared original SQL/CAS/retention/order/callback bindings and old get override hook. Actual module parser/provider identity and lower imports covered without altering SQL or owners. Six real MySQL registrations cover canonical Notification engine effects, counts/retention/corruption/CAS/rate/due/defer/history and all native writes rollback with entire original seven-table snapshots; no duplicate authority or store. Original Notification owner/lower store records, mutable fields, exact query/callback/method declarations and public aliases used unchanged. Remaining: No missing assertion identified; exact-source execution still required. |
| 73 | covered | E209, E292, E293, E240, E208, E271, E282, E170 | Covered: ProbeRunHistoryRecorder/ProbeRuns: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Original constructor/class and own async method descriptors; lazy zero-argument SQL wrappers and singleton callback paths; exact public/legacy capture, permit, record, result, state, loss, query, store, recorder, view, envelope and combined-history API type aliases; policy object identity/frozen limits versus mutable original state array; all value/storage callbacks. Capture closed kind/permit/time/result checks before Scope or head lock, exact caller Tx, issue insertion and idempotent issue replay, immutable association mismatch, missing consumed/revoked/withdrawn/result head increments loss without backfilling, consumed/revoked transitions, withdrawal/result duplicate identity, conflicting result digest, recovery/time refusals and revision exhaustion. Existing probe-history-complete tests cover all five original/staged retained historical families, optional measurement/service/challenge keys, closed binding/instance/timeout/expiry/state/record rules, original TLS and Echo proof/invocation/request/response bytes/digests, detached freeze, original parser absence on staged public issuance, native family dispatch and actual permit-owner result/revoke/withdraw capture after mutation. New retained-echo formatter VM test checks exact source property access order, ISO input order, original binding/service references and nonce without live projection or proof changes. parseProbeServiceSelection equals the actual original contracts parser. Manager Scope authorization then captured clock/read/loss order, original provider errors and per-instance request and actor budgets (2/128), inclusive 1000ms cooldown, active collisions and finally cleanup. Detail and fixed/default history use exact now/capturedAt phases; canonical UTC bounds, retained window, cursor query identity/encoding, filters including current connected/unreachable/verified/unverified/echoed/missing allowlist, limit lookahead, descending issuedAt/binary-id keysets, duplicate/foreign/out-of-window rows and loss corruption all retain refusal phases. Historical/public unknown and nonauthorizing flags, captured result digest is not recomputed against current authority, current binding is not evaluated, immutable content digest, exact 262144-byte response ceiling before top-level freeze and constructor-captured optional native wall clock with invalid time matrix. No history read has any permit or Runtime provider. Native SQL projection bounds binding2048/service1024/TLS-challenge-proof512, exact31 insertion arguments and optional/result row mapping, strict string integers and SQL flags, cross-index binding checks, malformed metadata/results refusal, original get override before insert/put, immutable/revision CAS and conflict identity, bounded binary filters/cursor SQL, static sticky recovery and no constructor I/O. Actual canonical MySQL migration and full-database snapshots after every write failure cover native permit issuance/consumption/withdrawal followed by the exact same-Tx real recorder, scope creation, pruning, insert, head update, missing-head loss and recovery. Exact1024 capacity evicts oldest issuedAt/id tie and increments guarded loss; retention deletes at most16 expired rows; every-write rollback restores all tables including authoritative permits, history and counters; guarded loss overflow refuses without mutation; actual binary pages and foreign Scope reads remain isolated. Existing permit MySQL tests additionally execute the actual ProbePermits owner and delegated history with mutation/capture/guard failure rollback and independent connection locks. Existing Control composition tests retain one original MySqlProbeHistoryStore, exact shared ProbeRunHistoryRecorder passed to the original ProbePermits owner, and shared qualification provider; server composition retains ProbeRuns on original observation pool/store and original policy clock-skew arguments. Remaining: No missing assertion identified; exact-source execution still required. |
| 74 | covered | E209, E294, E293, E282, E271, E225, E208, E170 | Covered: ProbePlans: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Original ProbePlans constructor/options/class own method kinds and lazy initialization; exact public/legacy finite config/head/state/code/failure/decision/header/loss/query/issuer/store/view/envelope/preview/detail/history/receipt/combined API aliases; original public Forward Probe API version and legacy generic/ingress/service acceptance aliases. Immutable policy identity and mutable original state/rejection/transient/code arrays; combined execution/ingress/service flags, bounded clock skew and captured optional clock defaults. Three original Direct TCP plan kinds only, expected Forward revision, closed TLS selection/reference, timeout100..2000, maxRuns1..16, canonical UTC expiry, manual versus scheduled30..3600-second intervals and original disabled acceptance receipt. Closed head/decision/loss object keys, immutable/config/binding/digest association, exact counters/state/cancellation/recovery/time rules, original private time/hash/object/ISO helpers, frozen public views and content digests; exact head4096, decision2048 and response262144 byte boundaries. Preview manager authorization/window before original issuer then binding/kind/point/timeout/TLS checks and second-clock/window refusal. Create manager claim/replay/window/original issuer preview/digest/Scope lock/recheck/head/create/respond order and original request identity; scheduled first due slot and fresh immutable UUID head. Every provider failure and malformed replay refuses in the original phase. Manual command manager claim/replay, Scope/head lock, CAS/retention/clock/cancel-active versus no-op, active/manual/recovery predicates. Decide before-time/expiry and original creator authorization, original issueIn inside original savepoint, exact allowed code/status/retryable refusal mapping, rollback-to/release on recognized failure, full outer abort without local retry on unknown/uncertain failure, after-clock guard, append before head put/respond, accepted/count limit, completed versus permanent suspension versus expiry/next-run precedence. Late append/put/respond failures restore issuer mutations and decision/head/reply state. Scheduler retains exact running Promise identity, stop/feature checks, cutoff before Tx, due/header/current initial and locked head/creator/revision/mode/deadline/recovery order, expiry-before-revocation precedence and original creator issuance; stale/missing candidates never decide. Header/revision/cutoff-only bounded deferral occurs in a separate Tx after uncertain failure, cannot extend finite config expiry or duplicate/replace a decision; close joins original in-flight work even after failure. Detail uses original share lock, exact decision positions/tail counts/accepted totals/distinct permit IDs/actor/time ordering; history preserves manager auth, canonical/default fixed retained windows, binary cursor identity/keysets/filtering/lookahead/sorting/duplicate and malformed losses refusal, exact bytes/freezing, and unknown/current-binding-not-evaluated/read-only/non-authorizing worker/config flags. Independent request/actor 2/128 cooldown/finally state remains per instance. Original native lower SQL create/get/put/append hooks and subclass virtual dispatch on the caller Tx, exact20 insert parameters, bounded33 locked scope scan, original expired callback and put,16 retention batch,32 capacity with active-only refusal, closed-row eviction and decision cascade loss counts, guarded integer losses and immutable/revision/monotonic-time CAS; decision17 lookahead and bounded2048 JSON; binary history filters/cursor args; due ordering and conditional revision/cutoff defer with300000ms ceiling; exact native savepoint statements/failure identity; sticky static recovery. Actual canonical MySQL finite owner with original Identity and Idempotency plus native plan store executes create/run/cancel every-write failure rollback against complete database snapshots. Accepted delegated issuer uses actual native permit+same-Tx recorder; recognized refusal rolls back permit/history savepoint effects while persisting one rejected decision/head; unknown failure aborts everything. Replay does not add permits or decisions.32 active-capacity refusal, closed eviction with2-decision cascade/loss, expiry transition/removal and recovery are all authored against actual migrated SQL, with every native write fault checked. Actual MySQL two independent scheduled ProbePlans instances contend on one native header/Scope lock and must persist exactly one original-creator decision/permit/history; second tick changes nothing. A fault after actual decision insert rolls back all issuance/history/head effects and must perform conditional defer in a second transaction with unchanged revision/count/finite expiry. Due/defer wrong-revision and stale-cutoff no-ops remain original SQL behavior. Existing server composition test invokes the actual source root callbacks with original receiver, exact caller Tx and Forward/config fields, maps preview to original ForwardProbePlans.authorize and issuance to original ForwardProbes.issueIn with finite config.expiresAt, original flags/pool/store and worker tick/close binding. Existing Control composition and permit/preflight port tests retain actual original shared owner/qualification/store and no new issuer or staged Echo plan support. Remaining: No missing assertion identified; exact-source execution still required. |
| 75 | covered | E209, E224, E295, E296, E215 | Covered: NodeTelemetry/HostTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero Original public and legacy NodeTelemetry/HostTelemetry constructor identity and policies are retained. Existing observation-public-types-complete.test.ts TelemetryCompleteDeclarations39 covers exact API/sample/delta/read/store/policy and L2 wire aliases; new legacy identity test checks original application reexports at runtime. Actual owner source is loaded with only declared Core/framework/native-value dependencies to assert lazy one-time default-clock-source capture, no construction-time clock read, explicit-clock bypass, invalid-clock refusal, per-instance active/read maps, original active2 limit and same-key exclusion, plus finally release after success or failure. Existing telemetry-owner-transactions.test.ts retains disabled/parser/authentication/Node/session/head/epoch/replay and raw->real process/host observation->recorder->ACK same-Tx order. New raw owner cases cover clock-skew, backward/8999ms rate refusal, corrupt head/Scope/drop counters, stale session and fresh-session/new-epoch rollover versus reused epoch. Latest exact replay remains original receipt without append/rollup. New caller-transaction snapshots inject failures after raw mutation, after real projected rollup callback and at original private ACK dispatch, restoring head/raw/observations with no compensating call and releasing admission. New actual public Node/Host histories validate stored native body/digest/association/time/uptime/flags, repeated sample identity, history/latest ordering and retained-window clamping. Exact near-uint64 process CPU delta9 remains a decimal string; Host total/idle/iowait, unavailable CPU nulls, baseline/continuous/gap/reset/historical and stale freshness remain distinct. Unknown health and executionAuthorized=false persist. Reader128 capacity, clock rollback cooldown and exact1000ms cleanup are asserted. Existing request4/finally cases remain referenced. New actual lower Node/Host SQL tests assert bound Node and head lock queries, nullable runtime mapping, integer/boolean/drop corruption, strict256 expiry, original8640 quota/oldest1 eviction, complete insert/head args, inclusive history limit+1 and latest2 order, validated limit interpolation and prune. Original bounded observation pool options2/nonqueued, original Tx identity, session SQL, guard/begin/action/guard/commit/release order, request saturation,1500ms deadline, native error preservation, rollback and destroyed/missing stream paths are asserted. Authored canonical migrated MySQL test composes all four raw stores and original rollup recorder on one transaction. Every successful write position is faulted and all12 telemetry tables compared to baseline. Actual original Node/Host quota8640 plus expiry/eviction and raw/aggregate prune/recovery writes receive the same fault loop. Environment-absent skip is not a pass; no local functional execution occurred. Remaining: No missing assertion identified; exact-source execution still required. |
| 76 | covered | E209, E295, E296, E215, E297 | Covered: ForwardTelemetry/ProbeTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Original ForwardTelemetry/ProbeTelemetry public/application constructor identity and exact accepted/export/record/mapping/API/native wire aliases are covered by new identity/default-clock/private-state cases and existing observation-public-types-complete.test.ts. Native private mapped ACK dispatch receives original sample/time after accepted+rejected count-sum guard; projector cannot run on a mismatched sum. Original family-specific error/capacity/mapper signatures remain distinct, including Probe fingerprint and current observedAt. Actual owner ingest asserts credential->Node->clock/head->mapper->raw append->real accepted-only observation recorder->ACK on caller Tx; replay returns exact original receipt/counts without mapper/write/recorder. Session/clock/epoch/sequence/uptime/rate precedence and corrupt head guards are covered. Null, old and recovery-suspended points are filtered; malformed trusted identity/Scope/source/publishedUntil/instance windows/count arrays abort before append. Raw/store, recorder and private ACK failure after mutation restore full fixture state and release active key. Actual lower published mapper uses original native Direct compiler, Snapshot parser and supplied transaction SELECTs. Current Snapshot generation/session/validUntil/body/Scope and Forward provenance are validated; retired assignment plus execution lease maps retired-published and rejects duplicated/cross-scope/identity/time authority. Actual native Relay and Multihop compilers exercise published ingress Scope binding and reject cross-scope config, preserving original native execution authority. Probe actual immutable Snapshot binding and direct TCP candidate plus fingerprint/current registration generation/state/session/expiry/revocation checks produce current-registered or not-rechecked independently of reported observation. No mapper writes or execution/permit grants are introduced. Actual owner histories assert raw/exporter identity/digest/source/Scope/count/time checks, duplicate/order/latest and foreign-node refusal, canonical bounded windows and cooldown, immutable non-authoritative views and currentBinding=not-rechecked. Nanosecond point<=exporter provenance is checked even when SQL milliseconds match. Baseline/historical/unavailable/overflowed/terminal/reset/gap/continuous meanings and exact Forward payload delta7 versus Probe attempted delta1/inFlightBefore remain distinct. Actual raw Forward/Probe lower adapters assert native head lock and count-sum32, Node request deduplication and foreign rows, Forward flags, bound provenance JSON/digest/index/identity args,4096 quota and strict256 expiry, rejected-only checkpoint without point insert, duplicate/foreign/recovery mapping refusal, inclusive history limit+1, null-safe counter epoch and strict previous tuple, bounded prune and malformed row/JSON/source limits. Authored canonical MySQL every-write rollback includes both accepted mapped raw+real observation recorder same-Tx paths and original4096 expiry/eviction quota before successful committed state checks. Remaining: No missing assertion identified; exact-source execution still required. |
| 77 | covered | E209, E224, E298, E299, E295, E296, E215 | Covered: TelemetryRollups: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Node/Host ingestion calls original public real processObservation/hostObservation and same-Tx recorder; unsupported Host yields empty metric maps unavailable; absent process CPU omitted; recorder failure rolls back raw head and observation together Public fold and real processObservation; uint64-max gauge wide sum beyond64bit, exact9 counter increment near uint64 max, immutable prior bucket; receipt-end minute/hour boundary and monotonic elapsed rather than receipt delta; missing metrics omitted; sequence/drop/truncation gap, sequence/counter rollback reset, overflow before terminal, no interval/increments on noncontinuous; cross-bucket/cross-scope reuse refusal Public/legacy Rollups and fold/storage provider identity, existing exact DTO/query/series/record/store/target declarations, lazy default clock, independent active2/request4/reader128 and original finally/cooldown behavior are retained. Actual zero-argument MySqlTelemetryRollups module initializes one original lower provider with exact native values and no SQL; multiple stateless wrappers forward original caller Tx through all five methods. Original actual process observation/fold tests remain: immutable prior values, precise wide sums and delta9 near uint64 max, minute/hour receipt-end attribution, monotonic elapsed, no missing-metric zeros, reset/drop/truncation/overflow/terminal and cross-series/bucket refusal. New actual Host projection asserts all original metric membership and paired availability/CPU logical context; context switch/missing CPU keeps counters absent from interval increments, and inconsistent CPU delta resets. Paired memory/filesystem/network/load/availability corruption refuses. Forward/Probe projections retain accepted-only order/identity/markers, metric names, Probe inFlight gauge versus four counters and attempted conservation; precise native fold intervals remain separate from sample counts. Bucket reachable wide sums, count*uint64 constraints, decimal128 overflow, min/max/count/elapsed consistency are asserted. Actual Rollups node and Forward hour/minute history asserts manager Scope before target/history/losses in one Tx, default aligned windows, canonical UTC/resolution/family/cursor/Node/series limits, exclusive after tuple and stable lookahead pagination, exact nextAfter, recovery flags, closed row/bucket identity/order and wide loss corruption. Forward losses are scope-family while Node losses are node-family. Capacity remains inspectable above logical row budgets, reports exact BigInt JSON capacities and raw budget with physicalBytesMeasured=false and scopeRawHardCap=false. Actual lower SQL history uses exact target/series/after filters, exclusive bucket upper bound, order and limit+1; decoder validates digest/columns/flags. Losses use DECIMAL39 sums and exact128-bit strings. Capacity queries remain read-only and inspect over-budget counts. Append asserts original Scope INSERT+FOR UPDATE/head/count/cursor/bucket/write order, empty/duplicate/mixed corruption, node and Scope/head caps, exact minute/hour/cursor eviction queries excluding incoming keys, affected-count guards, sticky recovery suspension, saturating uint64 loss and strict cursor TTL baseline reset. Prune chooses oldest eligible Scope, locks it, expires128 cursors, records saturated grouped loss and spends remaining256 deletion budget. Authored migrated MySQL compares all12 telemetry tables after every successful native write fault for all four raw+original observation recorder intake families and all raw/rollup pruning. Original raw capacities8640/4096, expiry and eviction paths are included. Lower public injected one-row limits exercise actual canonical minute/hour/cursor eviction statements with every-write rollback and final exact loss/capacity assertions, while production limits remain independently asserted. Original ten-statement quarantine has exact SQL tests and every-write rollback. Existing source/runtime composition and type tests retain original owner instances and no competing Runtime/permit/billing authority. Remaining: No missing assertion identified; exact-source execution still required. |
| 78 | covered | E209, E234, E235, E226, E215, E244, E170, E231 | Covered: ObservationServices: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Original public/application constructor and prototype identity, exact original prototype method inventory, module/API versions, public/flat limit+ALPN identities, all original value parsers and storage provider aliases. Exact legacy DTO/API/store/read-port declarations reused and supplemented. Fresh actual contracts module proves limits start runtime-mutable with all eight original values, without mutating the shared module singleton. Actual metadata parser corpus: serviceId64/65 and exact end-anchor; time0/max and unsafe/negative/fraction/string; lowercase SHA256 end-anchor. Closed/plain/null-prototype head validation, positive safe head/config revisions and config<=64/head relation, booleans. Immutable revision digest/config/trust/creator/time validation. Audit closed shape/kind/counters/time; receipt identity/status-versus-changed/head/digest/closed body; exact current service reference alias and revision/config/hash bounds. Original full TLS/echo codec and native X509 trust corpus reused separately. Actual original service module with declared native clock/monotonic/byte providers only: default wall-clock function captured once per construction without reads; explicit clock bypasses factory; measurement/echo default false and explicit true; providers retained, independent actors/request/active state. Invalid wall times refuse. Original bounded helper accepts131072/rejects131073 and freezes nested results. Independent per-instance request2 and actor2 gates; request and actor capacities do not consume each other. Two pending request awaits, success/rejection/synchronous throw release in original finally. Active actor remains retained across arbitrary monotonic advance, same actor refused,128 retained keys, exact1000ms inactive cleanup and completion-time cooldown, all failure/success paths reset active state without wall-clock dependence. Direct actual public owner publication exact trace: begin, manager auth, claim, Scope lock, locked head/CAS, prior immutable revision when present, clock, new-ID count, immutable insertion, head, audit, original idempotent response, commit. Exact native request identity uses original method/path/config/CAS. Immutable revision creator/time and audit actor/kind/time retained. Same-config no-op writes only response200; recovery publication increments head only and clears recovery without new config; changed config increments both; archive preserves config and repeated archive responds200 without metadata writes. Authorization precedes replay. A valid original receipt replays with absent metadata, impossible current quota and invalid current clock before any Scope/head/prior reads or writes; corrupt receipt fails before Scope. CAS conflicts precede archive/prior/clock; archived identity reuse refuses; corrupt/wrong/missing prior values fail at original read point; clock-behind-immutable-history differs from invalid clock. Exact expiry and now+7day publication boundaries, config quota64 independent of head revision, service quota32 including archived identities and invalid counts, safe head revision exhaustion. Missing archival retains original public CAS conflict precedence. Failure injected at every original command provider position, including after immutable/head/audit/receipt mutations, restores the same original Scope/head/revision/audit/response snapshot. Create/update/archive rollback assertions require no compensating calls. Native real database suite independently tests actual write rollback. Read manager auth first; head FOR SHARE versus command FOR UPDATE remains storage-owned. Exact historical config lookup1..64/future-not-found/missing-corrupt immutable distinctions, head service association, malformed/oversize/duplicate/other-service audit refusals,16+1 history truncation retaining returned order, closed safe audit-loss counters and invalid clock refusals. List32/33, array/head/duplicate-ID validation preserves returned order. Trust is real original echo fingerprint projection. Lifecycle precedence archived, recovery-suspended, not-yet-valid, equality-at-start declared, equality-at-end expired. Original inert envelope/read-committed disclaimer, public availability, nested freezing and shared limits retained. Invalid identities, command config/CAS/Idempotency-Key and get revision refuse before actor admission or transaction effects. Every original list/get/publish/archive/replay response passes the actual bounded call with131072 versus131073 and finally cleanup. No read/command fixture provides a dial/sign/key/permit/Runtime authority collaborator. Actual original lower+wrapper modules run with only declared mysql rows/write/json and supplied values. Initialization captures exactly one module-local lower provider with no SQL or decoding; zero-arg wrapper instances share original methods/provider. Scope INSERT+FOR UPDATE, count, list ORDER BY service_id LIMIT33, head FOR SHARE/default versus FOR UPDATE and exact scope/id parameters retained. Original integer-string lexical/safe boundaries, positive counters, config revision1..64, boolean1/0/true/false versus string refusal, identity and timestamp bounds. Immutable SQL projects config only under16384bytes, accepts exact JSON bound and rejects null/array/scalar/malformed/UTF8 overflow. Actual supplied config assertion preserves bounded malformed schema and exact input identity, while full original owner parsing refuses later. Digest/creator/time binding, original INSERT arguments and deferred original storage-values provider remain unchanged. Head insertion permits only revision1/config1/live/nonrecovery and counts quota32 through original hooks. Existing IDs never count; revision+1 and config same-or+1, archive nonreuse and affected-row CAS retained. Legacy per-instance dynamic head and count overrides execute with original this/Tx/scope, despite one shared module-local lower store. No eager head/count capture or replaced authority. Audit256 count/overfull refusal; oldest(created_at,id) one-row DELETE then guarded safe audit_evicted increment then INSERT; failed deletion or saturated loss prevents insertion. Audit identity/kind/revision/time validation, exact17 descending history and losses default0/max/refusals. Static legacy quarantine delegates original single SQL updating only unarchived/nonrecovery heads, no parser/SQL initialization. AST imports preserve owner-independent lower Core/contracts/framework/mysql dependencies. Real canonical migrated MySQL suite:32 original heads including archived identity still count, sorted list, quota refusal, immutable revisions1..64 and65 refusal, audit257 retains256/oldest eviction/loss1/descending17. Bounded malformed config remains SQL assertion and original owner trust parser rejects afterward. Legacy dynamic count hook retained. Static recovery increments only eligible head revisions, preserves original immutable/audit/Scope rows and skips archived/already-suspended; repetition is idempotent. Saturated audit loss rolls back prior oldest deletion. Real canonical migrated MySQL failure after every successful native write compares all four original metadata tables plus original idempotency table. Covers new Scope, immutable INSERT, head INSERT/UPDATE, audit DELETE/loss/INSERT, static quarantine, and actual original public owner create/publish/archive composed with original IdempotencyHost+MySqlIdempotencyStore/nativeStoredValues on the same native transaction. Counting pass itself rolls back; every write-position failure restores baseline. Committed public publication then exact replay preserves all tables, and conflicting replay digest refuses without changes. Both native suites require TUNEX_TEST_DATABASE_URL and explicit native Actions routing; env-absent skips are not passes. Existing complete original native closed-object/IP/hostname/identity/base64 helpers, actual TLS certificate preflight and original X509 projection, exact SAN/EKU/key/time/DER acceptance policy, real staged echo config/trust and public reference resolver order. Retained tests distinguish declared inert trust from real network/service ownership. Existing exact original TLS/echo config union, readonly fields, metadata Head/Revision/Audit/Values/Store/ReadPort and service reference declarations. Existing exact source compatibility exports for ObservationServiceTrust/Envelope/List/Detail/API across application and owner. Existing original legacy value/constructor/storage-provider/API/ports/reference reexport entrypoints. Existing native HTTP named/positional optional observationServices availability, original admission-before-auth and awaited owner/release/no-store behavior. Existing exact observationServiceRevisionQuery public/legacy helper and fixed closed query refusal. Remaining: No missing assertion identified; exact-source execution still required. |
| 79 | covered | E202, E242, E201, E200, E238, E239, E243, E207, E215, E244, E170, E228, E271 | Covered: Direct owner tests assert immutable registration and non-renewing replay, generation CAS/revocation/capability withdrawal/time resample/current-evidence and rollback. Real MySQL covers concurrent replacements/recovery; registry covers native machine dispatch/ACK. New 79 canonical identities test asserts all three class identities, constructor arities, exact prototype methods and machine interface version 1. New native/legacy store test compares read/readCurrent/lock/replace SQL and values with the zero-argument legacy store and exact dynamic quarantine SQL/value projection. Existing observation-public-types-complete.test.ts covers Probe instance/evidence/current-reader/qualification declarations and L1 generic storage values; legacy-entrypoints.test.ts and type-source-compatibility-complete.test.ts cover original aliases. New pre/post-lock test has an exact events trace and replaces Date.now itself while inside the lock callback, proving the post-lock read is dynamic and rejects newly expired credentials before replace. Existing probe-instance-ports.test.ts closed typed input/detach, evidence clamp, counter and CAS cases are retained. New dynamic-time test replays with no replace and unchanged expiry; new real canonical MySQL races independent first-slot owners and replays winner without rotation. Existing generation/CAS, MAX_COUNTER, stale delayed installation, expiry and clock-rollback assertions remain in probe-instance-ports.test.ts and probe-instance-mysql-acceptance.test.ts. New revoke test removes all capabilities and still closes, asserts both dynamic time reads, mutates credentialRevoked during lock to prove post-lock refusal, preserves sticky replay, and proves stored prior boot/session/fingerprint are not added as revoke matching conditions. Existing mismatch and credential withdrawal MySQL cases remain. New inspect test asserts absent projection; each boot/epoch/fingerprint/future registration/expiry stale condition; exact read/time trace with no lock/replace; frozen nested DTO; quarantined state wins over stale; credential refusal precedes projection. New hello test installs Date.now after machine read, asserts machine -> dynamic time -> commit and exact server time; malformed parser input precedes identity, connection identity precedes fingerprint, invalid fingerprint refuses before any Tx. Existing negotiation mTLS/MySQL acceptance remains. New registry uses the real ProbeInstances owner, swaps Date.now only after register commits, asserts commit before ACK time, and proves an invalid post-commit clock cannot undo the accepted owner row. Existing probe-instance-registry.test.ts covers all register/inspect/revoke dispatch, current/absent view and mTLS refusal. Full L2 ACK field/codec projection is reused from probe-native-codec-complete.test.ts. New real canonical MySQL test races actual native stores, demonstrates readCurrent FOR SHARE blocking independent replacement through ER_LOCK_WAIT_TIMEOUT, and rolls back each absent seed/replacement/revoke SQL write. Recovery abort restores both owner tables; committed quarantine preserves generation. Production files remain unchanged. Existing complete mTLS/full-table digest and instance recovery tests are retained. Remaining: No missing assertion identified; exact-source execution still required. |
| 80 | covered | E203, E202, E238, E239, E243, E201, E242, E207, E215, E244, E170, E228, E271 | Covered: Current v1 instance identity/capability/expiry is tested; no v2/v3 qualification evidence located. New canonical registry test asserts class identity, constructor arity/private method shape, exact two/three/five measurement arrays, legacy object identity, unfrozen array behavior and a compile-time broad paired echo union consumer. Existing observation-public-types-complete.test.ts covers exact optional/mutable qualification and evidence/storage declarations; legacy-entrypoints and existing complete native codec/family suites supply public L2 aliases and byte projections without duplication. New captured default test swaps Date.now after constructing both registries and requires exactly four calls to the original captured function and zero to replacement. New exact precedence matrix covers all slot identity fields and absent slot before proof read, malformed proof before clock/evidence, proof lock=true for commands and false for inspect, onGet time advancement before expiry checks, and credential refusal before expired-slot handling. New proof creation/replay test asserts credential-bound expiry, exact events and original qualification times, no replay put, equal/newer mismatch refusal and older generation replacement. New revoke test covers absent/same/older tombstones and equal/newer mismatched generations. New inspect/capability matrices retain v2 ingress-only predicate versus v3 full six-capability predicate. New v3 upgrade preserves qualifiedAt/expiresAt and same instance generation while adding only servicesVersion=1. Revoke matrix verifies v2 retains a same-proof servicesVersion but does not inherit an older-generation marker; v3 always marks version1. New canonical MySQL concurrent v2/v3 registration converges on one original proof and unchanged slot, replays without row changes and retains marker through v2 revocation; no echoVersion is added. New parser precheck test rejects partial v2/v3 measurement sets before Tx. New inspect test proves v2 can report qualified for a proof slightly predating registration while v3 refuses; v2 inspect ignores withdrawn base/TLS capabilities except ingress, v3 requires every original capability; still-valid shorter current credentials do not silently tighten the original proof expiry predicate. Both register paths still require original direct capability and live proof. New first-error matrix covers future qualification CLOCK_UNCERTAIN, expired slot and credentials, expired/too-old/too-long/revoked/quarantined current proof, nonregistered slot, malformed dates/servicesVersion/extra echo marker/extra keys, invalid clock range and original provider error identity. ACK clock failure occurs after commit and does not erase proof. New Date.prototype.toISOString/clock trace records exact sequence: v2 decision clock -> ACK clock -> qualifiedAt ISO -> expiresAt ISO -> serverTime ISO; v3 decision clock -> both date ISOs -> ACK clock -> serverTime ISO. Each has exactly two time reads. Existing native codec complete suite independently retains callback-versus-argument field projection behavior. New lower store parser trace preserves seed -> select -> parse and parse -> put, empty seed bypass, original parser error identity and instance read -> closing -> write. Native/legacy SQL/value tests include optional marker projection/recovery. Real canonical MySQL explicitly holds absent/present qualification FOR UPDATE and original instance FOR SHARE while independent owners receive real lock timeout, then proceed after Tx ends. Injected errors after each actual seed and put cover v2/v3 register/revoke, same-live v3 upgrade, instance creation/replacement/revoke; snapshots prove rollback. Both static recoveries roll back on late failure and preserve generations/markers on commit. Remaining: No missing assertion identified; exact-source execution still required. |
| 81 | covered | E225, E232, E181, E203, E233, E237, E226, E215, E234, E235, E294, E293, E170, E244 | Covered: Plan preflight validates detached closed input, same-Tx manager+grant auth, active assignment/current binding, metadata refusal and no writes; permit owner/HTTP issuance replay/current checks covered. Public/legacy ForwardProbePlans/ForwardProbes/ProbeObservationServices and exact canonical plan/service/owner/permit/result declarations; original shallow mutable views and readonly/optional unions.: New public bridge constructor aliases; retained observation-public-types-complete.test.ts, type-source-compatibility-complete.test.ts, legacy-entrypoints.test.ts and the prior declaration maps pin exact original contracts, optional/readonly/mutable/null unions without changing them. Plan request defaults/closed shape and five-kind support distinct from three-kind command issuance.: New public plan runs all five kinds including UDP echo and exact protocol assignment. New command rejects both echo kinds before Tx, accepts the three original kinds and emits exact v1 base/v2 ingress/v3 parsed service-selection receipts. Retained preflight closed shape/coercion/null/prototype cases; new request getter access order and default1000. Manager authorization -> intent parse/CAS/state -> Direct/numeric target -> authorized Node/nonmetadata policy/capability -> published/time -> exact active assignment -> service resolution/target -> Snapshot/credential/service validity arithmetic.: New actual source plan VM tests record original callbacks and clock position, each competing first refusal, provider error identity, policy override false, exact assignment/binding and original final expiry minimum. Real preflight and canonical forward-probe MySQL retain actual parsers/compiler, every assignment binding refusal and SELECT-only/no-write evidence. Resolver reference -> Scope -> head/archive/recovery/revisions -> immutable config/digest -> captured clock/history/window -> digest -> TLS/echo parser, same caller Tx and original corruption catch.: Retained observation-native-values-complete tests40/44 real staged context and exact resolver source VM trace pin constructor capture, explicit override, every head/revision/time/version/transport/parser cutoff, raw error versus stored-corruption wrapping and context bytes. Observation-service-owner/store-complete retain original authoritative metadata reader, exact SQL/deferred trust and canonical MySQL rollback/history. Command framing before Tx; Scope/replay before flags/issueCurrentIn; finite same-Tx notAfter narrowing; receipt/response/inspect/revoke/missing TLS errors.: New actual ForwardProbes tests compare native request frame, manager/claim/issue/respond/commit trace, replay identity even when disabled, all dependent feature defaults, supplied Tx/deadline argument, exact missing TLS context, response write failure and direct inspect/revoke original Promise identity. New actual permit issueCurrentIn asserts finite minimum and no nested Tx; retained finite ProbePlans owner tests pin original real issuer callback and accepted receipt chain. Replay cannot recreate/renew; plan does not authorize Agent work; echo preview does not add echo issuance.: New replay returns original acceptance without issue/respond, every plan retains executablefalse/dispatchnotimplemented/independentfalse/healthunknown/maxAttempts1/payload0 and frozen detached binding; command echo refuses before Tx. Retained permit/finite-plan replay, canonical MySQL and no-write preflight evidence stay mapped. Remaining: No missing assertion identified; exact-source execution still required. |
| 82 | covered | E69, E70, E81, E77, E82, E83, E89, E80, E76 | Covered: Numeric address sentence: 24 vectors pin IPv4, IPv6, mapped unmap, IPv6 brackets, tcp and udp4/udp6 family, lower/upper port bounds, hostname/zone/bracketed literal refusal, unspecified/sensitive/link-local/multicast/reserved address policy, malformed/foreign/wrong-family/empty CIDR. Original Executor source order is asserted resolveEcho -> detached equality -> ParseDestination -> binding/measurement -> Allowed -> acquireWith -> single dial -> exchangeEcho. Original probe_test.go supplies runtime invalid-before-resolve, foreign/unsafe-before-dial, sanitized one-attempt and cancellation/close coverage. Constructors/defaults sentence: existing complete constructor tests cover all four native and explicit constructors, every missing resolver/effect nil error, original resolver hierarchy, no resolver invocation on construction, explicit effect identity, nil/zero package-local Schedule/Entropy fallback, custom private dial field, native constructor factory allocation boundary. Existing native default test pins fresh distinct zero-state native Dialer pointers, Schedule/Entropy exact native types and cancelled DialContext. New actual Echo Executor test proves process admission/cooldown crosses explicit and default constructors and still has only one admitted dial. Echo context/time/product sentence: complete signed context baseline is proved with RequestFrame/DecodeEchoRequest/SignEchoResponse/VerifyEchoResponse/VerifyProof before production use. Both TCP/UDP validateEchoExecution pass. 22 negative vectors pin original product denials for measurement/version/domain/binding/context/purpose/trust/selection/current-time/protocol/digest/nonce/timestamp order/window/duration/service bounds. Native two timestamp outputs are asserted when either individual parse fails; frame success/refusal and original product call order are pinned. Existing format tests and readiness97/112 pin nil/empty/detached reflect equality and context JSON encode/decode staging. Socket sentence: production lower ExchangeEcho runs scripted conn TCP/UDP matrices. Successful TCP ReadFull fragments use requested sizes256,239 then exactly1 tail byte; UDP performs exactly one read with257 capacity. Tests pin one exact signed256-byte write; no write for missing deadline/initial check/deadline-set failure/invalid request; no write/read retry. UDP257 oversize, zero/40-byte datagrams, EOF/error despite full payload; TCP EOF0, UnexpectedEOF40, arbitrary partial read errors, full-buffer+error ReadFull semantics, trailing byte with/without EOF, missing EOF, tail error; invalid proof returns256/256 unverified evidence. Every Check/context failure point returns exact lower denial with zero evidence. Synthetic past deadline with live context isolates native time refusal; source AST pins exactly five native Now sites with check -> ctx.Err -> Now order, one Write, two branch-specific Read calls, one ReadFull and no Dial. Cancellation/identity/bytes/caller-close sentence: real context cancellation during Write invokes original AfterFunc Close exactly once before legacy ErrDenied returns and before any Read. Noncancelled lower exchange never closes caller socket. Legacy bridge preserves short-response256/19 evidence and maps exact native errors to original ErrDenied; errTLSBudget identity and both256 constants asserted. Actual Echo Executor successful TCP/UDP uses only Echo resolver, one numeric tcp/udp4 dial, exact proof/status/code/point/binding/bytes/independent result and one caller deferred Close. Single owner sentence: existing Gate tests retain burn before attempt, failed-attempt nonrefund, independent authority and current-instance refusal, duplicate concurrency, Close cancellation and256 non-evicting IDs. Existing budget test pins4 active/128 keys/cooldown/in-flight underlying work; new Echo constructor test shares that one process budget. Existing complete counter suites retain epoch, attempted/outcome/unknown/inFlight/drain/seal/saturation/detached/concurrent ownership. readiness97/112 separately drives actual Runner current-instance and protected Journal checks; no Gate, budget, counter, authority or Journal owner was copied. All new assertions are authored only; no package compile/static/format/test/build or functional run was performed by this subtask. Root must validate saved source and record exact Actions SHA. Scripted conn exercises production bounded exchange without opening a socket. It is not native OS socket, long-run, independent physical-host, platform or release evidence. Check/context point assertions and initial expired native deadline run deterministically; all five native Now placements are additionally source-structure assertions. No injected fake clock was added to production ExchangeEcho. Current ServiceContext has only concrete serializable scalar/struct/string-slice fields, so json.Marshal defensive encode failure cannot be triggered by a legitimate typed value. readiness97/112 retains source-only branch evidence rather than fabricated runtime coverage. The final VerifyProof uses the same immutable proof/context already verified by VerifyEchoResponse; its positive proof and invalid-response rejection are exercised, and the final call stays source-pinned. No data race or forged hook is introduced to fabricate a separate redundant final-proof-false path. Remaining: No missing assertion identified; exact-source execution still required. |
| 83 | covered | E14, E90, E30, E91, E74 | Covered: Actual Runner.Run Hello literal protocol/node/boot/build/capability order/generation bytes and POST/path/epoch/session arguments before first fatal request; deferred idle close then Runner.stop on preexisting current+drain instances under lock; repeat stop does not reclose removed engines Current original Run with frozen scheduling collaborators receives nil or partial bytes plus local encoder error and still issues first request and preserves its fatal error/cleanup; no production DTO change or unreachable Marshal error claim Native Hello literal maximum uint64 and nil capabilities representation; native report literal field order, nil observations to[] and drains:null without mutating caller; existing native report projection tests retain complete timestamp/shape fields Actual three strict live native Hello/Snapshot/ACK parser baselines plus unknown/duplicate/malformed/trailing-body refusal; retained Journal Snapshot JSON-only duplicate/unknown permissiveness and typed error partial fields remain distinct Actual locally pending best-effort report duplicate/unknown/type-error partial fields versus syntax-zero result; real Runner.report with valid strict live ACK retires only removed drains from partial locally decoded report, strict unknown ACK leaves bytes/drains intact Actual Runner.poll with real initialized/protected native Journal acceptance and injected original public driver: replace-success; replace-error then old ticket authorization/Drain then fallback-start success/error; new start-error; same-owner authorization before phase error; removed-owner drain; exact lock scope, input/Host/check/error pointers and original observation classification Poll publishes exact accepted generation/new ticket/sequence/report sample; old drain stores old ticket/cutoff and Remaining values; partial callback error pointers are not silently closed by Runner; original owner remains responsible Actual retained corrupt JSON refuses before journal publication; retained unknown JSON is JSON-only; report sequence exhaustion remains after original snapshot acceptance/ticket publication and does not create pending report Native StartDirect/StartRelay/StartMultihop/Maximum plus original DirectAssignment/directPolicy/relayAssignment staged current declarations: direct assignment before policy before TCP/UDP dispatch, policy injected failure, unsupported protocol; preserved original engine partial result and authorization callback identity Native Relay actual peer callback precedes original strict assignment parse; original active/draining/prepared phase validated then converted to prepared for Prepare and original phase to finish; peer/strict/Prepare/finish failures short circuit, maximum4096 cap and peer identity/check/engine pointers preserved Native Multihop peer precedes PrepareMultihop with original assignment and UDP-specific maximum then original finish phase; original native Relay actual phase partial cleanup tests retained Retained prior source tests cover no retained offline execution, durable accept before bind/prepare, same-generation no lease extension, actual peer proof before activation, constructors/default/alias behavior, prior/current cutoff and duplicate drain, ACK-driven drain retirement, independent100ms guard, context/worker cancel+wait and cleanup Remaining: No missing assertion identified; exact-source execution still required. |
| 84 | covered | E57, E56, E62, E64 | Covered: Original compiled order/defaults/metadata/platform/flags/capability dedup and callbacks are covered by existing catalog complete. New private tests pin zero Registry and no native default projection, old header/duplicate/list/requirements/Probe errors before clones/strict public validation; preserves first error with representative multiple defects. Remaining: No missing assertion identified; exact-source execution still required. |
| 85 | covered | E183, E184, E185, E300, E182, E231, E229, E170 | Covered: Paging/filters before reads, candidate management/auth-before-SQL, scoped count/page/overview, bounded diagnostic sanitized no-health and actual SELECT-only composition are asserted. New exact public/legacy ConsoleQueries and ConsoleReadModels identity, rules function/object identity, original version, mixed three-class entry identity, required constructor lengths and own async/non-enumerable method descriptors; original filter-name object and every nested array remain mutable, and original DTOs/results/decoded JSON remain mutable. Existing application-query-ports, console-read, console-diagnostics and canonical MySQL tests retain pageWindow defaults/bounds, filters copied/frozen/validated before auth transaction, candidates manage=true versus other reads false, diagnostics identity prevalidation, original same transaction/store, auth before data SQL and original missing-node refusal. HTTP native/family and console-read cases retain duplicate/unknown/enum/ID refusal and order. New direct original synchronous projection callbacks trace count Number conversion, every raw Node getter, credential/report null versus exact ISO mapping, JSON read/reference identity, Boolean flags, session/snapshot nullish zero defaults; Forward null lastOperation and nullable kind/status, Operation created/updated ISO before last-error JSON and original flag truthiness. No replacement decoder or normalizer is used. Every direct/relay/multihop x absent/tcp/udp/both candidate combination asserts original direct default and exact ordered base/Relay/Multihop/protocol capability list, actor/Scope/paging/filter arguments and absence of extra clocks; retained owner projection flags and independent/reserved/full-plan claims remain original. Overview pauses before actual store callback to prove currentIso is sampled inside projection after Number count fields. Actual native-read-projection source is evaluated with a zero-argument Date constructor to prove original dynamic new Date().toISOString rather than Date.now substitution, no constructor sample and unwrapped final format error. Diagnostics directly validates/missing-refuses before clock, calls now once then JSON, projects only uppercase bounded error codes with fallback unknown strings and retryable===true, counts all observations while truncating projected errors to50, and preserves exact note. ISO getter trace and integer age/negative lease floor/clamped future age/null report cases preserve original timing and fields. Actual native now dynamically reads replacement Date.now while ISO uses one numeric Date argument at original return position. New actual-source VM loading of zero-argument MySqlConsoleReadModels proves one original ConsoleReadModels/store/values singleton, original effects.now/validateFilters identities, no constructor SQL/projection/clock, exact receiver/argument forwarding and direct awaited result/original rejection identities, all original own async method descriptors and consolePageSql alias. Existing canonical SELECT-only MySQL/HTTP scope/full totals and unchanged-database evidence remains required. Remaining: No missing assertion identified; exact-source execution still required. |
| 86 | covered | E203, E208, E237, E240, E241, E228, E215 | Covered: Extensive direct port+MySQL assertions cover budget/current evidence/claim/revoke/inspect/result/withdrawal replay, minimum expiry, corrupted histories and failed commit rollback. Public/legacy ProbePermits constructor/class/private helper/default and same original store/history/qualification instances.: New exact class identity, actual permits.ts VM with captured native clock function once/no sample/replacement ignored, runtime collaborator identity for db/auth/plans/machines/instances/store/history/types; original issue/machine getter order and trusted deadline guard before input access. Retained pure permit validator/native codec tests cover helper identity and source-only function boundaries. Manager Scope -> global budget lock/retained+withdrawal validation/time -> same-Tx plan -> selected/current instance and machine -> resampled clock -> qualification/capabilities -> counts/cooldown -> expiry/notAfter -> validate -> prune/clock/insert -> sanitized history.: New actual issueCurrentIn complete ordered trace and dual selected/current reads, no nested transaction, same supplied Tx/collaborator, finite minimum, sanitized copied/frozen view/history. Actual issue waits advance machine time before resample and reject stale plan without insert. Retained permit/history v1/v2/v3 owners pin actual qualification and current evidence; every original issue callback/write/commit failure has rollback assertions. 256 reservations/four live, actor/Node margin; consume/revoke/restart/new instance never refund issuance.: New exact255 success/256 limit/257 corrupt retained cases with distinct valid IDs and expired-but-retained reservations; three success/four refusal for each issued/consumed/revoked state proves closed reservations count. Retained actor-across-Scopes/Node-across-Actors, restart/new-instance, cooldown2999/3000, recovered/withdrawn sticky tests remain mapped. Exact issued/current/consumed/withdrawn/pin/service/measurement/current binding before auth; lock wait cannot reuse old clock; consume closes before history/view and commits before ACK; offer/check never reserve/renew.: New actual consume exact trace and pre-plan wrong state/Node/instance/fingerprint refusals, rollback at close/prune/clock/history/commit, no refund. Actual v1/v2/v3 owner-to-real-adapter tests retain consumed/history after late ACK rejection and refuse second claim. Retained full binding/withdrawal/measurement/service/qualification/current machine and empty/null/ambiguous offer/status no-write cases stay in permit/history/MySQL suites. Result parser/mTLS/budget/pin/auth -> result read -> resample -> measurement/permit expiry; persisted validation before digest replay/conflict; original acceptedAt/new checkedAt/write/history/clock/final freshness rollback.: Retained probe-permit-ports and probe-history-complete v1/v2/v3 exact result mutation/capture/clock/commit and duplicate no-write/failure/final-clock rollback tests. New actual v1/v2/v3 ingestion commits then late adapter ACK refuses; retry with different requestId returns original acceptedAt, one immutable result, no result/history/clock write and same consumed reservation. Inspect synthetic requestId and historical checks; revoke current manager after original Node grant withdrawn; consumed withdrawal replay and other-state no-write; staged echo branches do not broaden command/record/request union.: Retained permit management receipt corruption/window/body tests, grant-withdrawal revoke/consumed sticky withdrawal and canonical MySQL migration/recovery tests. Probe-history-complete directly runs staged echo revoke/withdraw capture, all-family inspect selection and refusal of public v4 ingestion before mutation. Native result dispatch/permit validator suites pin exact staged unions, requestId synthetic codec and absence of v4 ACK/issuer widening. Remaining: No missing assertion identified; exact-source execution still required. |
| 87 | covered | E204, E205, E206, E236, E237, E228, E208 | Covered: Commit-before-ACK, one owner call, exact Node/session input, post-commit freshness/staleness/malformed receipt, detached output and no Bearer substitute have tests. Public/legacy ProbeClaims/Delivery/Results and exact L2 helpers; JSON/parser before connection node/session and original consume commit before dynamic native clock/identity/closedAt/expiry/ACK.: New machine class aliases, all parse-before-identity-before-owner/clock phases and raw errors; exact minimized owner args, original ACK request/result/return object identities. Claims obtains native clock only after each commit, dynamically on repeated calls; Delivery/Results capture once without a sample. Every claim identity/state/closedAt/future/expiry branch rejects after owner completion; actual owner consumed state/history remains committed despite rejected ACK. Late/lost ACK never refunds/recreates; delivery safe observedAt/250ms/max Date/offer/consumed identity/state/flags/expiry; status not continued work authority.: New actual claim retries stay one spent record and one close; late result ACK retry stays one immutable result. Delivery VM exercises negative/fractional/future/251ms/nonfinite/maxDate+1 and inclusive250/maxDate, all original offer/status mismatch/state/nullClosed/expiry/flags and no added binding/closedAt-time guards absent from original status adapter. Retained real native codec schema/flags and read-only original offer/check suites remain mapped. Result commit before captured clock/acceptedAt/checkedAt/250ms/validUntil/digest/duplicate validation/ACK; stale ACK is not ingestion rollback; original errors/timing/fields with no extra authority/Tx.: New Results original source failures for malformed acceptedAt/checkedAt/clock/digest/duplicate/deadline and ACK callback raw error, after commit trace. Actual result owner commits/history remain after251ms ACK refusal, duplicate retry preserves acceptedAt and no extra writes. Native codec suite separately asserts exact ordered UTC fields/digest/flags, while real mTLS refusal/failed owner commit remains in original result/claim/HTTP suites. Remaining: No missing assertion identified; exact-source execution still required. |
| 88 | covered | E203, E236, E237, E228, E240, E215, E244 | Covered: Only underlying v1 permit owner current binding and instance checks are exercised; no v2/v3 adapter evidence located. Public/legacy ProbeTypes/Services poll/claim/status/result; parser/connection identity, same original owner and measurement/service selection args.: New both class identities, all eight method parser/identity/owner/clock failure cutoffs and exact original owner arguments. v2 passes true, v3 services plus request.service; absent measurement defaults to egress for claim/status. Real owner v2/v3 claim/result adapters use actual native closed parsers and actual qualification, same existing budget/store/history/transaction. v2 two-measurement set/partial descriptor/original time predicate; v3 service set/stricter timestamp cap/selection digest before identity comparison.: New all two/three supported measurement offers and unsupported/TLS-v2/echo refusals; original partial projection remains delegated. Explicit253402300800000 accepted by original v2 predicate and refused by v3; native codecs independently pin schema formatting. v3 context parser errors and two selection digest calls occur after clock and before wrong permit identity, preserving original exception/refusal. Poll measurement lazy in exact ACK callback, null offer null, absent measurement egress; per-version output fields/bounds/checks distinct, no missing legacy flag guards or common normalizer.: New ACK callback captured without invoking; measurement provider not called until callback runs; callback result and original failure identity retained. Null offers never run measurement callback. Both typed/service adapters deliberately accept original absent executionEnabled guard and original status unlisted binding/future closedAt fields; v1 rejects executionEnabledtrue. Native codec suite pins actual nullable offers/service contexts, all original fields and strict closed outputs rather than adding adapter guards. Claims/results commit before adapter freshness/refusal with no second issuer/budget/replay reset; constructors capture clock, raw digest/expiry/freshness/receipt identity original.: New constructor single capture/no sampling/replacement retained and explicit clock; all typed/status/result future/negative/unsafe250/251/deadline/digest/duplicate refusal; original returned ACK object identity. Actual v2/v3 real permit consume commits then251ms claim ACK refuses without refund; actual result commits then late ACK refuses, exact retry returns duplicate with original acceptedAt and no repeated history/result/persisted clock mutation. Staged echo remains unavailable in original public machine adapters. Remaining: No missing assertion identified; exact-source execution still required. |
| 89 | covered | E182, E180, E300, E178, E271, E170 | Covered: One supplied authorized transaction, provider errors/no projections after denial, detached query and operation JSON null/Boolean/unknown fields with Forward ID are asserted. Public/legacy ControlQueries, original version1 contracts and ExecutionCapabilities/ControlDetailApi/ForwardDetailView/OperationDetailView aliases retain constructor7 and original own async method descriptors. Required providers remain original read-only ports. Exact constructor feature spread getter order, frozen detached feature snapshot and lazy no-I/O construction are asserted. Mutating original features cannot change returned capabilities; each capability call returns a new mutable copy, and mutating an earlier returned copy cannot alter future responses. Authorization uses exact same Tx actor/Scope with omitted manage argument and invokes no unrelated provider. Exact Forward get(requested ID) -> observation.status(exact resolved Forward reference) -> Operation.latest(resolved Forward ID) -> Forward.record(Scope,resolved ID) order, exact provider receivers and same Tx are asserted. Original spec/status references, deleting=false, metadata recovery flag, nullable latest Operation and Boolean flag mappings remain unnormalized/mutable. Every auth/get/status/latest/metadata first failure propagates original error identity and stops at its exact prefix; invalid actor/Scope/ID refuses before Tx. Deployment and revision reads resolve Forward first and use exact Forward object/resolved ID; results retain provider reference identity. Operation detail uses original scoped get and preserves null sourceOperationId, unknown lastError reference and Boolean flags. Existing rule-commands-api exercises public HTTP detail behavior and errors; existing Forward SQL/read tests retain original not-found/identity and raw JSON projection semantics. Remaining: No missing assertion identified; exact-source execution still required. |
| 90 | covered | E175, E186, E301, E231, E170 | Covered: Scoped metadata-before-resolver/reference, granted exact revision, no-authority/immutable proposed spec, mutated caller input and corrupt persisted reference rejection are asserted in ports/SELECT-only MySQL. Public/legacy TransportQueries and mixed TransportReferenceReadModels class identity, exact old query/reference/reader/API/view/item/proposed-spec aliases, version1, required constructor4/2 and own async/non-enumerable methods remain original. Existing canonical alias/type-source cases remain reused. Original synchronous metadata callback returns raw current_revision without Number conversion, missing row is null. Original references callback reads spec JSON before ID/revision/config fallback/Boolean, uses spec transport configRevision nullish fallback0, then Number(count?.n??0) only after mapping all items. Full raw getter/Number traces, mutable DTO/decoded reference identity, raw null/missing config and original decode failure identity are asserted without copying projection code. Existing transport-query-ports retain closed owned query/paging copy/freeze, caller mutation across authorization, targetRevision presence manager flag, exact grant/revision resolver and original same-Tx metadata->resolver->references order. New direct cases add current metadata missing/zero/string integrity refusal before resolver, resolver identity/revision refusal before references, absent target undefined no-resolver listing, exact args/manage flag and nonauthorizing proposed spec frozen output. Page invalid total/overflow/duplicates refuse before any per-item spec getter/parser; existing malformed Profile/path/configRevision/spec/reference cases remain required. Original provider receiver/error identity and auth/metadata/resolve/reference refusal phases are explicit. Actual native-read-projection source with dynamic zero-argument Date is injected into actual TransportQueries source. Trace proves per-item parse -> new Date(0 arguments) -> toISOString -> deepFreeze at original return tail; no Date.now replacement/captured time. ISO failure escapes unchanged after reference reads and before freeze. Original source/previewOnly/reserved/fullPlanAuthorization/consistency and deep-frozen spec/proposed output are asserted. Actual zero-argument MySqlTransportReader source loads one original store/model/native-values instance, no constructor read/clock, and original own async profile/references forward exact args/revision/receiver/result/rejection. Existing real prepared SELECT-only canonical MySQL tests retain scoped count/page, precise revision filter, target grants, no execution authority and all-table unchanged inventory. Remaining: No missing assertion identified; exact-source execution still required. |
| 91 | covered | E187, E188, E302, E231, E170 | Covered: Same-Tx auth, bounded peer windows/current/revoked/expired/null endpoint, exact desired adjacency and malformed/cross-scope rows; real SELECT-only MySQL unchanged tables are asserted. Public/legacy TunnelQueries and old mixed TunnelReadModels identity/version1 plus exact original node/peer/reference/paging/read-port/API/status/peer-view/reference-view/item aliases; original constructor3 with fourth default/native clock and model constructor2, own async descriptors, mutable raw DTO fields remain original. Direct original synchronous raw callback getter traces cover node Boolean/raw credential/capabilities null[] versus JSON read/nullish epoch-generation0/raw reportAt; endpoint raw revision then JSON; peer Number total/window counts before field mapping and Boolean revoked; references ID/revision before JSON/Boolean then count Number after items. Exact Tx/scope/node/paging/now arguments, mutable result/JSON reference identity, missing rows/default counts and original decode error identity are retained without new clocks/formatting. Default constructor captures the original Date.now function with no early sample. Replacing Date.now later cannot change the captured query clock; explicit clock executes exactly once after auth and successful Node integrity validation and before endpoint/peers. References never sample it. Missing/mismatched/duplicate-capability Node refuses before clock; invalid Date timestamp bounds refuse after one sample before endpoint. Output capability copy freezes independently without freezing raw provider metadata. Actual original service VM trace pins peer fingerprint duplicate page check before per-window getter validation; exact peer timestamp/retire/revoked getter evaluation order and ISO conversion sequence, minimum peer/retire/machine credential intersection and single-now value passed to peers. Endpoint revision getter failure remains outside narrow parse catch, config getter/parser exceptions become exact original integrity error, while later ISO errors escape unchanged after peer read. Original provider receivers and failure identities stop at correct phase. Existing tunnel-query-ports and canonical MySQL cover four-peer/two-window caps, duplicate fingerprints, revoked/expired/null machine and peer windows, open-first ordering, ISO/age bounds, endpoint missing/config/revision, original unknown health/network/certificate flags, auth/Node before scoped references and copied bounded paging, every ingress/transit/egress adjacency/spec/path/recovery/disabled intent case and deletion-not-proven semantics. No extra reservation/authority/provider/time sample is introduced. Actual zero-argument MySqlTunnelReader source loading retains one original store/model/native-values singleton and no eager calls. All own async methods forward exact original same receiver/result/rejection, with raw peers now and original reference paging arguments. Existing real prepared SELECT-only MySQL canonical migration tests retain exact Scope isolation, bounded open-first peer order/current rule pages and complete unchanged-table digest. Remaining: No missing assertion identified; exact-source execution still required. |
| 92 | covered | E166, E145, E150, E303, E168, E169, E163, E271 | Covered: Owner-authorized one-Tx changes/replay/no-op/current records, token hash/detached snapshots/cross-scope refusal, effects and full response rollback are explicit; real MySQL proves whole member and Node grant rollback. Original five-argument class/API/legacy identity and exact effects getter refusal are compiled/observed. Actual original member snapshot getter order, own undefined token versus omission, revision-zero and token validation are retained; SHA256 is independently checked with crypto and request digest with contracts digest. Owner authorization precedes claim/replay; original member/grant raw references feed original effects even on no-change, status200/202 and operationIds identity remain. Explicit null/zero/negative/positive/NaN/infinite/max-Date cutoffs preserve truthy +5000/ISO failure and rollback. Original response identity replay and each owner/claim/writer/effects/receipt first failure preserve the supplied Tx and all-or-nothing writes. Retained access-command-ports executes actual Runtime reconciler/refusal/capacity/authorization/mutation snapshots; canonical Identity/Node and phase2 access execute real SQL. Remaining: No missing assertion identified; exact-source execution still required. |
| 93 | covered | E159, E145, E160, E303, E162, E163, E271, E150 | Covered: Management validates immutable policy before await, current-manager replay gate, original authorizer reconciliation, whole-Node revoke no capacity veto, audit/response failure whole rollback and revoked credentials. Original required arguments/public API/class/legacy aliases and effects prerequisite remain exact. Invalid Node ID precedes snapshot getters; original actual snapshot clones/freezes policy and arrays before manager auth, request identity and writer mutation. Same caller Tx retains manager scope->claim/replay->applyManagement->reconcile->audit->202 response->receipt; policy/revoke raw identity, request method/path/digest and original raw numeric cutoff audit differ intentionally from truthy +5000/null ISO response. Every later provider/format/receipt error aborts state, replay returns original reference before writes. Retained Node management port tests run actual Runtime reconciler/capacity/authorizer/credential withdrawal and full failure rollback; native Node SQL/Identity suites and access Actions provide real owner storage. Remaining: No missing assertion identified; exact-source execution still required. |
| 94 | covered | E175, E186, E303, E230, E266 | Covered: Catalog current scope and flags/default control-enabled distinctions remain separate from Node proof/authorization/platform acceptance; real MySQL contract included. Original class/API/version/catalog/digest/legacy identity, two required constructor args plus ordered false flag defaults, exact same Tx authorization and denial first error are asserted. All flag combinations preserve descriptor order/shallow spread, nested original declaration object/array identity, multihop-only controlEnabled predicate, independent probe process flag, exact unknown/non-authorizing evidence fields and recursive final freeze. Each read creates fresh outer view/array while retaining nested declaration identity. Retained actual HTTP and canonical MySQL read-only catalog tests prove the public composition. Remaining: No missing assertion identified; exact-source execution still required. |
| 95 | covered | E197, E193, E195, E194, E196, E304, E245, E248, E255, E230 | Covered: Native tunnel browser workflow and original Path/Forward transactional owner tests cover actual authoring/binding contracts. Public and legacy NativeTunnels/API/constants retain exact class/type identities and four required collaborator declarations. Runtime construction has no provider reads; actual ControlApplication binds original query/command/binding/Forward owners. All six forwarding methods retain exact argument count and identity, receiver, direct Promise identity, synchronous error identity and ordinary Function prototype. Original list/get spread creates fresh outer results while retaining config and arbitrary nested references before recursive freeze; shared singleton management, override IDs/topology, empty/one/two/four-node ingress/transit/egress order, prior endpoint revisions/null ingress and absent endpoint errors are asserted. Retained original Path/Forward transaction, digest, receipt, request identity, HTTP and browser matrices cover common owner semantics across both API names. Remaining: No missing assertion identified; exact-source execution still required. |
| 96 | covered | E56, E62, E60, E64 | Covered: Representative multi-defect pairs establish actual original native header and real nil callback presence -> private duplicate ID -> declaration/list -> requirements -> Probe agreement -> Probe capabilities -> strict public validation last, with literal old errors. Private public adapters retain optional nil hooks, copies, same host/current instance/check/error and do not create another registry owner. Remaining: No missing assertion identified; exact-source execution still required. |
| 97 | covered | E92, E93, E76, E35 | Covered: Both native TCP/UDP measurement paths start from a valid typed, digest-consistent, Ed25519 trust context and use the real Runner resolver/business binding/Guard/ticket/registry. Only compiled driver observation is supplied by a test seam; no socket is opened. Correct per-protocol hook is invoked with original stream while Runner mutex is held. Resolver releases mutex. Returned Check re-reads current observer and refuses revoked observation, changed actual port, validity boundary and changed stream before calling old observer. Context validity deadline shortens original ticket deadline; original caller protocol/challenge mutation cannot affect captured execution or subsequent successful Check. Protected Journal equality is retained. Refusal vectors cover feature flag, incompatible service, missing execution, changed binding, malformed native context, purpose, expired/future validity, selection, nonce, invocation digest, allowed protocol, business endpoint port, uncompiled driver, stale generation, nil observer Check, observed zone and incompatible configured resource protocol. Exact ErrDenied, Now count and callback count pin first-refusal stages. Existing pure native endpoint vectors separately pin numeric/public-policy/protocol/port rejection and mapped address unmapping; non-echo source owner and endpoint functions remain distinct. Existing source-order test and new codec test retain Encode/Decode/Now order. No production implementation changed. Source assertions do not establish live native sockets or physical-host execution. Gate/global budget/authority/Journal remain original owners and existing acceptance tests; no new competing mechanism or bypass is introduced. Encode failure before Now is a defensive source branch, not an injectable current typed input: ServiceContext contains only strings, uint64, structs and []string and has no custom MarshalJSON. No fabricated runtime encode-error evidence is claimed. Remaining: No missing assertion identified; exact-source execution still required. |
| 98 | covered | E171, E145, E305 | Covered: Changed-only grant reconciliation/no-op/replay owner gates, original resource lease retention, current authorization/capacity and response failure real-MySQL rollback are explicit. canonical/public/legacy class strict identity; interface version1; constructor arity5 and prototype change method; compile-only exact API method and legacy/public/canonical response/port types; missing/null/nonfunction/throwing reconcile fail without provider effects full command and request exact values and property order; Object.isFrozen both; request digest equals original four-field PUT frame; nativeValueDigest strict identity to contracts/shared digest; exact same request to claim/effects/respond; canonical source imports original alias and contains no generic request envelope helper all identifier, revision, Boolean and key invalid/boundary values; poison key coercion blocked by every preceding validation; no provider effects for invalid inputs; MAX_COUNTER and ASCII1/128 keys accepted; source asserts actual predicate order actor/scope/profile/subject/revision/Boolean/key (the wording lists fields, source keeps original evaluation order) exact begin/owner/claim/apply/reconcile/respond/commit sequence, original Tx at every callback and provider this receivers; changed202 with original operationIds array; unchanged200 empty operationIds and no reconcile; respond receives exact returned response unchanged has zero effect writes; replay returns exact response identity with only owner/claim/commit; denial still precedes replay and preserves error identity all failure boundaries original error strict identity; exact prefix then rollback; grant/effect/receipt state fully restored; same request can retry and commit; response is mutable original key order; compile-only alias equality checks current control.ts supplies db/identity/idempotency/transport and explicit reconciler; current api/routes.ts passes exact actor/scope/profile/member/key/revision/allowed positions; application/transport-grants is exact canonical reexport; no unknown external-consumer requirement invented Remaining: No missing assertion identified; exact-source execution still required. |
| 99 | covered | E177, E145, E194, E196, E255, E250 | Covered: Direct/Relay create/update/remove/retry preparation/owner writes/capacity/receipt transaction order, replay authorization, CAS/no-op and injected failures are asserted; real MySQL validates atomic rollback/history and retained resources. publicLegacyConstructorPrivateApi: Class identity, interface version 1, ten-argument constructor arity, exact prototype methods and bidirectional original preparation/operation type consumers; RuntimeLedger directly satisfies canonical Operation port by type consumer. requiredMethodsOptionalProviders: Each of eight missing preparation methods rejects construction; omitted path/group providers remain valid for ordinary commands; optional creation resolver failure/fallback covered under item 100. ordinaryReadReplayManage: Exact create/update/remove/retry replay event traces and first-error visible/claim/manage rejection; create replay additionally reads original record and preserves its failure. createEffects: Exact ID/preparation/insert/plan/Operation/capacity/respond sequence and exact accepted response; all preparation-through-response failures restore original state; ingress variant adds binding/provenance with no receipt. updateEffects: Preparation occurs for changed and no-op requests; changed branch alone writes spec/authorizer/plan/Operation/capacity; group preserve precedes path preserve; provider failures restore original state. sameRevisionProvenance: Path and Group selection may append provenance at unchanged revision without Operation; real full owner chain also proves unchanged exact selection does not append records or restart Runtime plan. metadataDetachAccept: Direct path apply detaches Group before Path acceptance; Group apply attaches Path then Group; exact changed flags, linked sequence, revision, status and body asserted. removal: Execution lock precedes CAS and counter exhaustion; stale CAS wins over exhaustion; deleting/Operation/capacity/receipt order and rollback at all late effects. authority: No production code, queue, ledger or table changes; Operation recording uses injected original public port. Remaining: No missing assertion identified; exact-source execution still required. |
| 100 | covered | E194, E196, E177, E199, E255, E250 | Covered: Path bindings and browser group/publication cover shared Forward CAS/provenance/idempotency, no-op attach, retained historical binding and late failure rollback. sameSuppliedTx: Every provider event asserts exact Tx object; all supplied-Tx methods have no nested begin/claim/respond, while outer caller transaction is explicitly counted. preview: Publication and ingress previews have exact read-only events, unchanged state, frozen returned values and exact digests; no execution reservation effects. currentMetadataDigest: Publication source state compares exact Forward revision/spec digest/path/group pointers; changed provenance rejects before Group resolution; corrupt original provenance yields integrity failure. ingressCreateInspectRemove: Exact preview/create/inspect/compensate and remove alias event traces; created state revision and bindings, deletion revision, no inner response, resolved-spec mismatch and each creation late-failure rollback. migration: Node, protocols, target, enabled and absent path cases refuse unsupported expansion; exact authorized resolved spec mismatch refuses before execution; Group detach and Path accept order and late rollback. restoration: No-path, path-only and group origins crossed with optional resolveCreateIn present/absent; restored exact spec at revision six, original immutable history prefix, original selection authorization preceding mismatch/refusal, and detach-before-replace at original points. lateRollback: Capacity/Path/Group/provenance and response failures restore Forward, authorizer, Operation recorder, plan recorder and binding pointers/history within the original transaction. Remaining: No missing assertion identified; exact-source execution still required. |
| 101 | covered | E177, E145, E180, E255, E250 | Covered: Retry ports assert reference->current Forward before locked source, reauthorization/recovery/stale/status refusal, source identity and unchanged intent; real MySQL response failure restores operation/deployment/idempotency; HTTP exact key/actor/scope/CAS. exactSequence: Operation reference/current Forward/execution lock/Operation reread/preparation/authorizer/source-linked Operation/capacity/receipt trace asserted. firstErrors: Recovery invalidation wins over revision and status; expected Forward revision and source target mismatch precede nonfailed status; successful retry at MAX_COUNTER proves no increment/exhaustion rejection introduced. sourceIdentity: Uses reread source id rather than requested id in accepted Operation and response; source previous_spec retained unchanged; Forward revision remains unchanged. replay: Ordinary retry replay bypasses manage/Operation/preparation after read authorization and idempotency claim; denied visible/claim/manage preserves original state and first error. rollback: Every reference/current/lock/reread/preparation/authorizer/Operation/capacity/receipt provider failure retains original error and restores original state. canonicalPort: RuntimeLedger type consumer directly satisfies ForwardOperationCommands<Transaction>; no duplicate Runtime implementation. Remaining: No missing assertion identified; exact-source execution still required. |
| 102 | covered | E222, E223, E210, E306, E230, E215 | Covered: Extensive direct and real MySQL passive observation assertions cover input/provenance/expiry/no-health, actor/Node/global admission/cooldown, cancellation retains capacity until work stops, dedicated connection destroy/rollback/pool race and real blocked auth deadline. Original public/legacy NodeObservations/rules/limits identity, constructor policy getter sequence, clamp/freeze/bound reader and no constructor IO are asserted. Native controller/timer/cancel/monotonic/wall/JSON/ISO functions resolve current globals with original callback/delay/handle and native encoding/error behavior. Actual source host with test-owned native effects pins monotonic->controller->wall->schedule->listener->reader->monotonic->wall->projection->bytes->release clock->clear->listener removal, immutable context deadline/signal and original bound reader. Inclusive4096 versus4097, closed-input before cancellation/admission, unknown/private-error sanitation, timeout Promise.race retaining Node/actor/global ownership until uncooperative work settles and no late projection are explicit. Actual pure rule source pins all reason precedence, stale/unknown, earliest expiry, exact ISO order, bounded detached/frozen provenance and malformed report refusal before formatting. Retained port/MySQL tests cover original all budgets/cooldown cancellation, dedicated observation connection authorization/guard/read/abort-destroy/rollback and HTTP raw signal forwarding. Remaining: No missing assertion identified; exact-source execution still required. |
| 103 | covered | E156, E155, E192, E304, E230 | Covered: Native Relay compiler/refusal/immutable prepared binding and production HTTP Relay path used by scenario script. Exact required RelayPlans constructor, API signatures and original response union declarations are compiled. Actual owner parses before Tx, refuses missing path/locked Profile before authorization/provider, propagates original input getter errors, performs one management authorization on same caller Tx, and calls the original preview provider with id preview, revision1 and forced enabled without mutating input. Both one-endpoint and multihop results return original references including broad boolean flags; begin/auth/preview/commit errors preserve identity and no later work. Actual ControlApplication owns one RelayPlans with original db/identity/RelayCoordinator and retains original async public delegation, argument references and receiver. Retained Relay compiler/resources tests pin physical reservations and immutable authorization; public HTTP Relay path and MySQL acceptance remain applicable exact-source execution. Remaining: No missing assertion identified; exact-source execution still required. |
| 104 | covered | E41, E38, E39, E40, E94, E35 | Remaining: No missing assertion identified; exact-source execution still required. |
| 105 | covered | E55, E95, E94, E35 | Remaining: No missing assertion identified; exact-source execution still required. |
| 106 | covered | E209, E181, E180, E307, E308, E204, E206, E230, E229, E231, E282 | Covered: HTTP scope/key/strict JSON/cookie/status, optional service named/positional middleware order and fixed console security asset serving are asserted; mTLS refuses Bearer/claimed fields. Actual Hono routes now exercise every explicit body limit and default1MiB at the inclusive boundary and limit+1, empty/malformed/fatal UTF8 management requests, native reader split-chunk/release/decode behavior and exact ControlError/native error framing. Four telemetry routes admit before fingerprint and never perform the initial Nodes lookup; ordinary machine routes bind fingerprint then Nodes then epoch/parser/owner, except original Hello omission and telemetry parse-before-epoch. Native TLS type/authorized/certificate/getter order remains in the helper suite. All Console asset registrations compare native names/security/media headers and the actual response bytes against their original web file; helper tests retain fresh URL/read/failure behavior. Original revocation ISO/null projection is after the successful owner, never after refusal. Global lifecycle/health/maintenance, UUID/no-store, optional admission/auth/cookie, all read and write arguments and positional createApp tests remain. Remaining: No missing assertion identified; exact-source execution still required. |
| 107 | covered | E193, E195, E194, E196, E199, E245, E246, E247, E170, E248, E249, E250, E251, E252, E253, E254, E219, E230 | Covered: Native template/binding owner ports+real MySQL test CAS/quota/archive/replay/immutable history/grants/shared Forward rollback; browser covers batch interactions. The retained complete Template, PathBinding, PathGroup and PathPublication owner/native/type/constructor/default/parser/history/reference suites and their actual Forward callers now close the formerly named Group/Publication raw-store, prototype, preview/apply/compensate/cancel and limit/digest obligations. NativePathReferences and original Node facts/references keep the same caller Tx and sorting/receiver/first-error behavior; API route matrices independently bind their read/default-query/command methods. This is reconciliation against completed original owner suites rather than duplicated application algorithms. Remaining: No missing assertion identified; exact-source execution still required. |
| 108 | covered | E219, E258, E259, E260, E247, E193, E250, E261, E230, E256, E262, E257, E212 | Covered: All three publication/deployment/migration store savepoint boundaries and refusal classification have new direct fake SQL tests. The original complete IngressGroup and new Deployment/Migration owner, lower SQL, legacy wrapper and canonical MySQL same-Tx suites now supply every previously named missing owner/route/raw-query/CAS/history/compensation obligation. Exact types remain in publication-public-types, original parser aliases/limits/default clock/IDs and cyclic historical origin callback remain in their original owners. Group sorting/restored input order and active/archive/digest/quota semantics, creator/recovery-before-replay, sorted origins/current Forward inspection, explicit add/update/remove and conditional restoration, rejected savepoint outcomes/receipts/cancellation/immutable lineage and non-authorizing/non-atomic/unknown flags are separately asserted. Actual routes preserve original body/field/query/default arguments. Remaining: No missing assertion identified; exact-source execution still required. |
| 109 | covered | E41, E96, E38, E97, E94, E35 | Remaining: No missing assertion identified; exact-source execution still required. |
| 110 | covered | E41, E22, E23, E14, E29, E98 | Covered: Existing strict audit anchors retained, with all identified residual time owner assertion groups supplied by this package. Covered is assertion inventory only, not functional/type/source acceptance. Machine request exact public fields excludes private key, expiry before renewal errors and omission, durable renewal retry and snapshot persistence Remaining: No missing assertion identified; exact-source execution still required. |
| 111 | covered | E55, E40, E95, E94, E35 | Remaining: No missing assertion identified; exact-source execution still required. |
| 112 | covered | E89, E93, E76 | Covered: Valid full typed context Encode+Decode equals native ParseEchoContext composition and original typed context. Existing empty invalid context compares identical Decode/Parse error semantics. Runner decoder refusal still samples exactly one Now; feature/service/missing/binding refusal precedes native context and samples none. Original parent pointer nil checks, detached-but-equal nonempty execution, changed protocol value and nil-versus-empty protocol slices use sameProbeEchoInput; existing lower native equality tests retain reflect.DeepEqual semantics for changed challenge and slices. Real Runner callback tests cover product validity/digest/protocol/business endpoint/driver/actual ingress/current-instance/Check/deadline at original points. Cancelled context exits before native context and scheduler work. Source Encode/Decode/Now order remains explicitly asserted; pure parser never gains a clock callback. Encode failure cannot be produced by the current concrete public ServiceContext shape; defensive branch remains source-reviewed rather than falsely reported runtime exercised. No new echo authority, protocol or feature is introduced; physical evidence remains a separate gate. Remaining: No missing assertion identified; exact-source execution still required. |
| 113 | covered | E183, E175, E187, E193, E231 | Covered: Native public query parsing preserves closed bounded fields, duplicate/unknown and canonical paging/ref filters with validated callback inputs. All15 old API query leaves/17 exact canonical/public functions; full inferred structural return declaration witnesses preserve mutable optional/undefined fields, names and fresh ordinary object/key insertion. All14 object query families empty/full/reverse/decoded insertion order, unknown/duplicate/encoded duplicate errors; exact pagination bounds only for paged families, raw query families unchanged empty strings. Profile/detail revision safe-counter no64 ceiling vs Path/Observation64; exact revision parser first-error; Group targetRevision presence before parsing and Ingress page before group identity. Aggregate own-property duplicate/nonempty/Object.assign semantics distinct from getAll family; all Probe resultStatus including echoed and unknown competing errors. Console exact owner map/validator native wrapper, same kind/filter ref, duplicate/unknown before callback before pageWindow, literal enum/filter/error/callback identity and fresh mutable returns. Business query transaction/auth untouched; original behavioral/HTTP composition suites retained. Functional exact-source Actions separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 114 | covered | E41, E23, E29, E98 | Covered: Existing strict audit anchors retained, with all identified residual time owner assertion groups supplied by this package. Covered is assertion inventory only, not functional/type/source acceptance. Shared and legacy time parses return raw RFC3339Nano values/errors for fraction/offset/zero/invalid, both qualification parses, Relay first mapped errors Remaining: No missing assertion identified; exact-source execution still required. |
| 115 | covered | E177, E145, E148, E261, E179 | Covered: Native Forward command preparation asserts Direct compile before and after reservation, sorted Relay authorization, ingress move revoked/recovery guard, retry/capacity/same-Tx rollback and immutable input. Static assignment registry validates source ownership/driver roles. Complete bounded original/public/legacy executor registry native factory and six-method adapter contracts; exact type aliases additionally in runtime-legacy-type-map/type-source suites. Real registry enforces catalog length then descriptor/version/duplicate and ordered six-method getters, binds/freeze captured callbacks with original receiver/promise/arguments. Exact native direct/relay/multihop selection; frozen fresh native factory triple/provider refs; original fifth-argument default omitted/undefined and explicit custom registry. Real Direct authorize/lock/fake-compile/reserve/real-compile, update equal/changed revision transition; both Path adapters sorted auth-lock/enabled canExecute and disabled create-vs-update planning; moved-Node state/recovery/revoked/sorted locks; retry authorize/lock/conditional transition and explicit capacity; injected owner failures original identity/stop at every existing callback. Existing full Forward command/real MySQL owner atomicity suites retained. Exact-source Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 116 | covered | E166, E171, E159, E145, E309, E244 | Covered: Member/Profile/Node reconciliation same-Tx/current authorizer/sorted references, disabled/no-op choices, withdrawal with retained leases and late failure rollback are asserted with ports+real MySQL. Original/public/legacy three reconciliation classes strict identity plus constructor/prototype/provider capture and no eager effects. Real Profile allowed short circuit lock/transition/accept/capacity and original reference order; member candidate scope-before-lock then latest record/reread scope/deleting/authorizer, original sourceActor and disabled allowed capacity, changed false and all nullable/zero/max cutoff cases. Node Grant unrelated path filter, same reference order, Set affected-Node insertion/dedup, transition/capacity only allowed enabled, unconditional validateNode including no-op and withdraw, original request/result order. Node facts validation before references, scope/lock/node collection/sourceActor, policy-only allowed/transition/deny-after-accept and whole-Node capacity before cutoff; revocation never invokes capacity or denial. Every provider called with exact original member receiver and caller Tx; fault at every reachable callback preserves original error and no following work, simulated caller rollback restores effects. Existing port+real MySQL Access/Profile/Node transaction suites retained for actual rollback. No hypothetical constructor/default/external gaps invented; exact-source Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 117 | covered | E159, E166, E266 | Covered: Canonical Node management/grant behavioral input/output/cutoff/rollback tested through explicit effects. NodeManagementGrantCompleteTypes117 compares independent complete management policy/command/change/audit/grant/writer declarations, facts legacy aliases and required mutable/readonly vocabularies. The 117 source test pins local leaf type imports for service commands policy API effects, actual old Runtime/Node tests and route public use. The canonical scan rejects duplicate declarations and current private-path augmentation. Constructor/default/L1-host-store behavior is inherited from existing owner-default, constructor-effects and runtime-host tests; this new package does not execute or independently re-audit those behaviors. No bridge is removed. Independent RuntimeHost time debt is not accepted by this package. Remaining: No missing assertion identified; exact-source execution still required. |
| 118 | covered | E148, E145, E310, E179 | Covered: Deterministic source ID execution, constructor snapshot capture/no reads, same-Tx callback/ownership/foreign roles/duplicate physical slots, full merge failure and real MySQL publication/capacity rollback are explicit. Canonical/public/legacy Snapshot registry and Relay source are exact class/prototype/constructor aliases; native clone exact alias and dynamic global lookup, exact native roles/frozen readonly catalog. Complete source/ID/driver/schema/role/ownership registration refusal messages and first-error precedence; original collect receiver bound/captured at constructor with no eager reads/clock/clone; declarations snapshot/freeze and source-ID order. Original direct clone/freeze before first await and every contribution before next source; context copy/freeze, dynamic native clone replacement and original exceptions at each stage stop later sources, native DataCloneError preserved. Assignment/logical/physical conflicts and ownership-before-conflict, final assignment-ID sort; owner objects remain mutable. Relay deferred reader captures original member receiver/current Tx/node/includeAccepted and returns original references without authorization/publication. Existing complete Snapshot compiler/ownership/conflict/merge suites retained, runtime-type-map supplies exact generic/readonly alias declaration symbols. Exact-source Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 119 | covered | E153, E312, E145, E311 | Covered: Missing clock/time methods refuse before samples/effects; host state/claim/report/authority order and pure deadline boundaries are directly asserted. NEW constructor rejects every missing or wrong-kind clock time and machine method in original getter order before Now policy or effects: each now/parseTime/formatTime and machine method gets undefined/null/false/0/1/string/object/array refusal; exact Error constructor and text; null/undefined codec; no Now/validation/provider calls; codec getter first-error identity and short-circuit lookup prefix; now getter error identity. NEW explicit Host clock is captured once while legacy RuntimeController looks up replacement Date.now dynamically; NEW native parse and ISO codecs preserve zero fractions offsets invalid NaN Infinity and Date coercion rather than introducing validation; NEW native policy time conversion retains one constructor sample and original RangeError for nonfinite values. RETAINED runtime-host-ports.test.ts construction refusal, validator receiver/error and policy parser cases; runtime-construction-complete.test.ts first RuntimeController construction test pins native runtimeCodec and nativeWallClockNow and exact original providers. The readiness phrase interface2 is historical FR-0002 scope; current RuntimeHost has interface3 after later family extraction, and these tests exercise the current native specialization rather than asserting the old version number. NEW explicit Host clock is captured once while legacy RuntimeController looks up replacement Date.now dynamically: real RuntimeController constructor samples the original replacement Date.now once; later replacements yield 123.75 and Infinity through its captured nativeWallClockNow function; explicit Host ignores later ports.now replacement. NEW custom machine time and digest methods retain receiver and original error identity at their original effect boundary: protocol/capability/helloResponse/formatTime/parseTime/reportAck/digest errors are the same object and have exact before-transaction or rollback boundary; no save/leases after failure. NEW fixture asserts codec receiver for validatePolicy/digest/parseTime/formatTime/protocol/capabilities/Hello/ACK/compile across actual RuntimeHost operations; retained runtime-host-ports.test.ts explicitly checks validatePolicy receiver and first error. NEW native parse and ISO codecs: epoch zero, negative epoch, positive and negative timezone offsets, long fractional seconds, fractional milliseconds and truncation, both finite Date limits, invalid text/empty/NaN/Infinity strings, nonfinite/out-of-range ISO RangeError with exact text, Date primitive coercion hints/receiver/error identity. Native methods are exactly nativeParseTime/nativeIsoTime. NEW explicit custom clocks retain zero fractional and nonfinite samples at the actual Hello projection without extra validation: 0/-0/positive and negative fraction/NaN/positive and negative Infinity, one constructor sample and one Hello sample/format each; NEW native policy time conversion contrasts existing native RangeError at the one constructor sample. NEW publication samples after original awaited state and snapshot reads and retains the publication sample through later awaits: distinct 11000/12000/13000 mutable clock phases establish exact sample locations and no late resampling. NEW Host publication retains every hold reuse deadline time sample and authority parse ordering including revoked short circuit: new/held/exact 5s boundary/reused/exact renewal boundary/own credential cap/Relay cap/revoked/expired credential/changed session/changed assignments; 1 versus 2 clock samples, digest short circuits, parse/format receiver/order, no compile or authority on hold/reuse, withdrawal bypasses assignment lookup and retains policy deadline, parse validUntil immediately before authority then save/lease/complete on same Tx. RETAINED runtime-publication.test.ts exact hold and reuse predicates including missing prior, session, credential, withdrawn, queued-claim and preserved-instance guards; publication deadline earliest bound and withdrawn policy branch. NEW Host report freshness preserves snapshot/current short circuits exact skew boundary nonfinite parse and one post-drain sample: absent snapshot and old generation skip parse; exact boundary/zero/NaN/negative Infinity refuse execution error; fresh/+Infinity retain native comparison result; one Now after drains and before saveReport, completion only for current snapshot. NEW worker claim guards retain original Now short circuits before publication and after compilation: status/token/null/zero/equal claimUntil/revision and valid before-publication paths, then missing/status/token/clock/deadline/valid after compile; exact 0/1/3/4/5 sample counts and no authority/save/leases on refusal. RETAINED runtime-status-ports.test.ts decoder/sample sequence, zero receive timestamp semantics and exact health freshness formula/boundary; runtime-ledger-ports.test.ts capacity early time sample, claim one sample, lease/drain timing and cleanup five-second threshold. NEW Hello keeps native protocol then foreign Node then capability refusal before transactions; NEW Host Hello boot getter/order includes related Node lock, credential, facts, boot read/history, new boot write/capability write or existing digest pair, then boot getter/Now/format/policy copy/projection; NEW custom error cases preserve rollback and refusal before writes. NEW ACK projection test pins duplicate replay digest/prior order, allocation and exact native ACK keys before integrity refusal; NEW publication test pins exact authority -> save -> leases order. RETAINED runtime-host-ports.test.ts retired boot/changed capabilities/lost history/session exhaustion; authority and save failure rollback; stale worker after compile; replay changed body; report foreign identity/boot/unpublished generation/fence/phase; current evidence drains/save/complete and expired publication refusal. RETAINED ledger-owner-complete.test.ts Runtime worker Node-before-operation and all before/after stale gates; real MySQL acceptance rollback and same-transaction claim/lease/retirement behavior. RETAINED multihop-runtime.test.ts Snapshot publication failure after lease recording rolls back MySQL but preserves independent protected authority high-water; source ownership/resource conflict rollback; replay and fenced old-generation report behavior. NEW native Hello/ACK projection test pins protocolVersion, exact property insertion order, every argument identity/value, fresh mutable objects, policy identity and invalid time/counter passthrough. No production wire/data serializer or database SQL was edited. NEW constructor matrix explicitly treats direct/custom Host codecs without clock/time/machine methods as intentional exact refusal, without fallback. SOURCE INVENTORY read in this task: current apps/control/src has RuntimeHost declaration in framework/runtime-host.ts and the sole production extends RuntimeHost consumer RuntimeController in modules/runtime/controller.ts. That wrapper supplies runtimeCodec/nativeWallClockNow in its real constructor, pinned by NEW dynamic clock test and retained runtime-construction-complete.test.ts provider-binding test; no production direct new RuntimeHost consumer exists in that source inventory. Existing explicit test consumers use required ports or deliberately test refusal. RETAINED runtime-legacy-type-map-complete.test.ts maps all runtime leaves/native aliases/generic defaults and actual legacy construction consumers; source API migration is covered by current wrapper/typed native family construction rather than a protocol-negotiation fallback. Candidate is not frozen in this agent turn; root must save the complete candidate and use that same SHA for these and retained suites. No current execution/acceptance claim is made. This is an execution-state requirement, not a missing source assertion disguised as pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 120 | covered | E148, E190, E189, E274 | Covered: Runtime Snapshot callback receiver and supplied transaction, Transit native wrapper operations/persistence and reservation same-Tx/no-reset behavior covered. Remaining: No missing assertion identified; exact-source execution still required. |
| 121 | covered | E370, E282, E371 | Covered: Explicit effects prove no overlap, first-tick scheduling, repeated start/close, active/onStop joins, one cancellation, completion-time backoff thresholds/cap/reset and sanitized all-settled shutdown. Existing explicit/native host suites cover validation/receivers/constructor timing/deferred work, active/backoff/success/failure/cancellation/drain semantics. New actual server.ts VM fixture replaces imported dependencies only and asserts five original declarations, exact flags and intervals, shared bounded backoff, authority maintenance guard, serial all-family pruning despite failures, tick/onStop/logger callbacks and HTTPS failure/normal drain-before-dependency order. Native legacy constructor defers work and resolves setInterval/clearInterval/performance.now dynamically. Aggregate/effects/declaration/backoff error priority and bounded inputs, frozen declaration/provider receivers, retryable cancellation after throw, twenty failures at the capped delay, no-delay sample counts and independent workers/all hooks draining are directly asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 122 | partial | E152, E153, E159, E145 | Covered: Ledger early capacity sample/claim/deadline/drain/complete boundaries, Host compile/publication and existing Node/multihop transactional paths are asserted. Remaining: Complete Ledger/Relay/Node invalid-time guards, constructor precedence/native receivers and provision-format-after-commit versus credential-format-before-commit fault matrix remain partial. |
| 123 | partial | E313, E325, E209 | Covered: Exact Error/helpers/lifecycle alias identity and failure-path drain, port-only preview authorization/Tx, HTTP failure release and closed-input behavior are asserted. Remaining: Socket disconnect drain and complete source-text/augmentation compatibility remain unproven; Current source/type/private import graph and existing compiled callers are checked by typecheck and check-boundaries; this does not prove every declaration-augmentation/reflection, default lifetime, getter or historical consumer case. |
| 124 | covered | E313, E330, E153, E331 | Covered: FR-0005 Runtime named Policy alias repaired. Compile-only exact equality pins all thirteen required mutable numeric fields through lower/framework/original/root/shared/runtime/legacy and Runtime Hello policy. Runtime namespace pins pure leaf version only; old defaults retain identity/frozen values/insertion order. Host default/explicit policy copy, validator receiver/error, one construction sample, response detachment and native invalid input/NaN refusal are directly tested. Current full source/type/private inventory finds one declaration and no former-location augmentations/tooling consumers; boundary scan rejects native/L2 lower-leaf dependencies. Remaining: No missing assertion identified; exact-source execution still required. |
| 125 | covered | E182, E187, E184, E266, E153, E311, E312, E151 | Covered: Read models keep non-authorizing/null/unknown diagnostics and mutable API response projections through explicit ports. ObservationDrainReportCompleteTypes125 pins every required/mutable Observation and Drain key, phase/absent/Condition unions, error nullability, legacy/native/root/report array aliases. Independent exact field types already occur in packages/core/test/public-source-closure.test.ts. The canonical scan pins one declaration owner per moved fact and rejects current augmentation consumers. Existing public-source-closure owns public version and export resolution assertions. Native validation, sequence/digest/fence/phase, lease/drain/removed and same-Tx rollback/replay are behavior obligations outside this type-only supplement; existing runtime-host/publication evidence must remain attached. Remaining: No missing assertion identified; exact-source execution still required. |
| 126 | partial | E155, E157, E145 | Covered: Native plan views consumed through actual compiler/Relay paths preserve sessions/pins/fences and deterministic immutable plan output, stale-generation isolation and rollback. Remaining: FR0007 required time->view guards before option getters and raw config/hop references with malformed/getter/throwing inputs lack direct RelayHost fake views. Exact conditional peer Now/skew samples and first-error nested traversal still unproven. |
| 127 | covered | E155, E191, E266 | Covered: Native prepared execution value records and nested resource/pin/session/phase data validated through compiler strict parsing. ExecutionValuesCompleteTypes127 compares independent complete common values and native/ADP2 shapes, required/mutable/optional fields, literal protocol2/3 envelopes, optional executionExtension, driver ID/schema/config and package/framework/legacy aliases. ExecutionFamilyCorrelationCompleteTypes127 uses two incompatible custom families and the native family to pin exact assignment/snapshot/report/hello/ACK/store/compiler/machine/ledger/source/collector/relay/evidence types, including rejection of interchangeability. Common default excludes native protocol/config/schema fields. The source scan pins unique common declarations and the lower common leaf imports only Core policy observation type entries; it rejects current augmentation consumers. Runtime JSON/codec refusal behavior remains separate existing evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 128 | covered | E153, E311 | Covered: Required machine methods refuse before clock/policy/provider calls; protocol/foreign identity/capability order, boot history, publication, replay ACK/fencing and failure rollback are directly asserted. NEW constructor matrix rejects all four required machine methods with every missing/wrong-kind value, pins time-method-before-machine getter lookup prefixes and exact plain Error text/constructor, getter thrown-object identity, and zero policy/Now/provider effects. NEW native protocol and capability includes getters short circuit with exact original ControlError class code status and text: versions 2/4/undefined/null/string3/fraction/Infinity/NaN skip capabilities entirely; ADP missing stops before Direct checks; tcp skips udp; udp fallback; no tcp/udp skips native driver check; missing native direct refuses. Per-access capabilities getter and includes call receiver/order are pinned; capability getter/includes getter/includes thrown object identity is retained. NEW Host Hello keeps native protocol then foreign Node then capability refusal before transactions pins protocol precedence over foreign Node and foreign Node precedence over capability refusal, exact ControlError constructor/code/status/message/retryable false. NEW Host Hello preserves boot getters operation order one format and Now codec receivers and detached policy compares both retained boot and fresh boot exact event traces. Boot getter access is pinned at boot lookup, retained-boot check or beginBoot, and projection argument evaluation. Policy lease getter pins policy spread after single Now then single format and before Hello projection; new boot write/capability write or retained digest comparisons precede projection. Returned object is exactly custom codec result; copied policy differs from host/default and mutation does not change next Hello. RETAINED runtime-host-ports.test.ts refuses lost history/retired boot/changed capabilities/session exhaustion before boot writes, copies both explicit and default validated policies and detaches every Hello response. NEW ACK projection retains digest prior boot sequence status and key order and allocates before duplicate integrity refusal compares accepted, duplicate, changed and empty prior string. Exact report identity/boot/sequence getter trace, digest -> prior -> boot/sequence -> projection status sequence, native key order and returned object identity are pinned. Both mismatching nonempty and empty prior allocate duplicate ACK then throw exact integrity ControlError; exact duplicate returns allocation without Now/drains/save. Accepted ACK allocation precedes drains and normal writes. NEW native Hello and ACK are fresh ordered mutable projections with no validation parsing cloning freezing or time sampling runs with throwing Date.now and Date.parse. Hello accepts NaN epoch/non-time server string and passes unread Proxy policy by identity; ACK accepts Infinity epoch/-0 sequence; ordered keys and values match literals, outputs are distinct/mutable and policy is not cloned or read. Native protocol/capability methods use only tested version/includes operations; they add no parser negotiation. NEW constructor matrix covers intentional direct/custom missing-machine refusal; NEW publication and worker matrix pins hold/reuse/claim short-circuit clocks and authority/save/lease sequence; NEW ACK replay and codec error-boundary matrices retain original result/error identity and same transaction rollback. RETAINED runtime-publication.test.ts complete pure predicate guards; runtime-host-ports.test.ts authority/save rollback, stale worker, replay/fence/drains/report cases; runtime-ledger-ports.test.ts supplied Tx, claim, drain and cleanup boundary cases; ledger-owner-complete.test.ts real MySQL accept rollback/claim/lock/leases; relay-owner-complete.test.ts execution-error first failure/successful-history/Tx/cleanup and real MySQL rollback; multihop-runtime.test.ts physical lease/slot cleanup and after-lease Snapshot rollback with protected authority retained. Root must execute the new and retained suites against one saved candidate SHA. This JSON records authored mapping only, not earlier-head green evidence or a current pass. Only a new test file and this external evidence file are authored. Native codec accepts only exact protocol 3/adp.3 and literal projections carry protocolVersion 3; current Host tests instantiate existing NativeRuntimeFamily. No production interface, generic family implementation or negotiation code changed. No local functional/database/static execution was performed by this agent; saved-SHA Actions remain required. Remaining: No missing assertion identified; exact-source execution still required. |
| 129 | partial | E148, E145, E155, E177, E207 | Covered: Actual native compiler/Snapshot/Forward/source/Probe/HTTP integration tested through explicit callbacks/real MySQL; current session/config/fence/current-auth and transaction rollback covered. Remaining: Every native specialization constructor/default capture, generic type correlation/old alias, function identity/module initialization/getter sorting and full SQL trace remains incomplete. Behavioral integration is narrower than exhaustive specialization compatibility. |
| 130 | covered | E175, E155, E191, E266 | Covered: Explicit native Profile revision/digest and Relay/Transit compiler consumers have assertions. OpaqueNativeProfileCompleteTypes130 independently compares all closed mutable required native Profile literals/fields and the opaque unknown default; three explicit families preserve exact profile payload across transport/compiler/input/codec/configuration slots. The witness compares native ResolvedProfile/View/Resolver, old transport and multihop aliases, Transit profile inputs and native transport/endpoint codec aliases. Existing public-source-closure pins public versions. The unique declaration and augmentation source scan covers the closed native schema declaration owner; this supplement does not claim complete repository boundary acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 131 | partial | E155, E156, E191, E161 | Covered: Profile parse/native config/no-op/CAS and compiler digest/resource/Relay/Multihop/Transit config bindings are exercised. Remaining: Complete native Profile JSON/digest/key getter/freeze/error-point equivalence and typed generic consumers lack direct pure contract cases. |
| 132 | covered | E161, E174 | Covered: Production Transport Profile commands and grants use formatter in real HTTP/MySQL flows. Constructor missing/noncallable formatter refuses before any provider property reads/effects, original error and getter exception preserved. Actual TransportService get captures exact receivers and original supplied Tx, authorization/current or explicit revision/record/decode/parse/digest before response-property formatter, original response key order. Zero/negative zero/fraction/NaN/infinity/out-of-range/invalid string and coercion-poison custom timestamps forwarded unchanged with exact opaque output, no clock. Native formatter strict identity, Date ISO time clipping/boundaries and RangeError; every reachable callback first-failure preserves exact error and transaction rollback with no later effects, missing resources/integrity/invalid input reject before format. Custom Error/RangeError/null/string thrown values preserved. Publish changed and unchanged/replay exact identity, grant changed/no-op, grants/resolve/list/default response retain no formatter and original clock counts. Legacy wrapper exercises original native MySQL SQL on same Tx, default ISO and RangeError rollback. Source coverage only; functional execution and actual acceptance remain Actions-owned. Remaining: No missing assertion identified; exact-source execution still required. |
| 133 | covered | E160, E161, E162, E164 | Covered: Production machine/Relay credential rotations/replays/current-only/overlap bounds are covered end-to-end. NEW constructor bounds including endpoints/fractional/nonfinite failures precede codec; time formatter then native enrollment/request/direct/fingerprint prerequisite getter sequence and missing methods refuse without clock or I/O. Required methods are distinct v3 prerequisites. NEW native token type/alphabet/31/32/128/129 boundaries and CSR type/size/prefix preserve permissive prefix-only validation, no new CSR parse. Enroll/rotate/Relay methods retain original three invalid messages, isId/token/CSR/digest/hash short circuits, provider receiver and first failure order. NEW intent tests reject Node/Scope/listener/port before codec, adp.3 before native.direct.v1 with separate capability getter reads, Forward protocols before target, receiver binding. Relay prefix preserves literal native template coercion/error and unnormalized input. Map field order is exact fingerprint/certificate/validUntil and rotation/Relay result field order. RETAINED legacy-owner-defaults.test.ts pins original Nodes captured clock and separate pool machine time samples; new constructor test repeats captured native clock plus owner chain without introducing an authority. Source assertions remain unexecuted until root exact-SHA Actions. Remaining: No missing assertion identified; exact-source execution still required. |
| 134 | covered | E160, E161, E159, E162, E163, E164 | Covered: Machine/Relay concurrent replay changed CSR rejection, credential overlap and policy/management transactional errors are checked. NEW complete host enrollment/digest/token/sign/expiry/replay and rotation/Relay current credential/replay/recheck/overlap/error matrices exercise real NodeService inherited NodeAuthorityHost and native codec, with exact original supplied Tx/provider receivers and ordered read/write/audit prefixes. NEW all-method literal SQL and evaluation-order matrix pins native Node persistence; canonical MySQL uses actual Identity and original RuntimeResources, captured one Tx and complete rollback snapshots at every credential/request/event/access write; post-grant SQL visibility/Runtime/Node lock order retained. Existing old request replay occurs before superseded source refusal and fresh signing always rechecks source credential. NEW native CA default control/explicit Relay P256 validation and certificates plus native constructors/default clock/static quarantine/aliases/token bytes/hash and v3 missing-method refusal. Network/grant/capability/refusal preserve original authority and lifetime bounds. No production change, no second ledger, no Journal/history clearing and no physical/release claim. RETAINED node-management-ports.test.ts and legacy-owner-defaults.test.ts cover native command reconciliation and default construction. All current-source functional/MySQL/OpenSSL cases remain unexecuted locally and require root exact-candidate Actions. Remaining: No missing assertion identified; exact-source execution still required. |
| 135 | covered | E209, E180, E181, E266 | Covered: Named and exact positional optional service wiring exercise original createControlApp/createApp behavior, HTTP auth/error/owner dispatch and request body status. NativeHonoAggregateCompleteTypes135 compares Hono Bindings/Variables/result, independent full ControlApi aggregate and service/options/admission types, required/optional/mutable/readonly keys, old type aliases and exact positional createApp optional order. The 135 factory test checks original/public factory reference identity and the dedicated native Hono import/export entry; routes and aggregate contracts contain no direct Hono named import. Original collaborators without extra app/service/state creation and default request wiring remain behavior obligations from server-composition and optional-http-services tests, not established by these type witnesses. Remaining: No missing assertion identified; exact-source execution still required. |
| 136 | covered | E204, E205, E206, E189, E229, E231 | Covered: Actual mTLS machine paths refuse unauthenticated Bearer/fingerprint/session header substitution. Actual native helpers pin complete decimal counter header grammar including empty/zero/sign/whitespace/fraction/overflow and three distinct primitive conversion stages/error identity. Four exact ordered Console header values and receiver/first throw; actual native asset function loaded with fs binding only records fresh URL/utf8 reads on every invocation and original rejection. Probe withdrawal pins property insertion/getter order, inherited/absent/null/non-number/finite/nonfinite/ISO values and repeated time getters; real original HTTP route asserts owner success before projection and owner/parse refusal before any result getter. Exact native query entry aliases retain fresh URL/params objects, duplicate/encoded/empty values, search versus params.size and original coercion/errors with no early normalization. Remaining: No missing assertion identified; exact-source execution still required. |
| 137 | covered | E209, E181, E180, E307, E230, E229, E282, E313 | Covered: Original routes status/body/header, optional admission-before-auth, cookie/duplicate/unknown/oversized and owner failure dispatch are asserted. The actual original route module is invoked through real Hono, with only external fingerprint/wire-parser effects rebound for the machine-dispatch matrix. Independent tables preserve all current management read/write registration paths, exact receiver/argument/default-query/status/body/field limits and first errors. Machine parser selection/type/body/session/Node/boot binding remains original: Service Probe query refusal precedes TLS; four telemetry exclusions preserve owner-side transactional identity; Transit boot refusal precedes epoch and owner. All Console route names/native bytes/security/media headers are checked. Global UUID occurs before requests.run, health skips only authority.allow, unknown/protocol/ControlError framing and no-store remain exact. Original RequestLifecycle stays active after raw client abort until the admitted owner settles, and refuses new work during drain. Retained original server startup/partial-failure/stop-admission/tasks/request-drain/HTTPS/dependency-close suites provide lifecycle closure. Remaining: No missing assertion identified; exact-source execution still required. |
| 138 | covered | E11, E12, E13, E16, E15 | Covered: Compile-time actual native Store/Codec/Input bindings plus independent exact public interface method signatures and version3. All compared native history fields and nil/empty/reference shape are pinned. Existing pure non-ADP host traces remain, plus explicit foreign-node/generation/digest/protocol short circuits and no prior decode at initial generation. Remaining: No missing assertion identified; exact-source execution still required. |
| 139 | covered | E12, E13, E19, E20, E14, E71, E72, E73, E99, E100, E16, E11, E91, E29, E101 | Covered: physical and literal TCP slots/drain tuple bytes, original protocols and opaque IDs, zero/max uint64 without escaping or clamping: TestNativeConstructionCompletePhysicalAndDrainKeysHaveNoNormalization native Runtime initialized/fallback field order/tags/reference envelope; loader/IJSON/Node/HMAC/fence/port/import/inspection: state/native_format_complete_test.go; state/native_loader_complete_test.go; state/runtime_history_complete_test.go; executionstate/runtime_acceptance_order_test.go guard/ticket/pending checks, single Journal persistence before first bind/replace, mutex/map/write/deadline clipping: control/runner_owner_complete_test.go; control/time_owner_complete_test.go: TestRunnerTimeOwnerCompleteBeginDrainCutoffAndDuplicate; control/transit_authority_lifecycle_complete_test.go duplicate drains/lost stale removed ACK preserve Ticket/tails/maps/pending and terminal-only tail/delete: control/time_owner_complete_test.go: TestRunnerTimeOwnerCompleteBeginDrainCutoffAndDuplicate; control/time_owner_complete_test.go: TestRunnerTimeOwnerCompleteAckRefusalRetainsPendingAndDrains; TestNativeConstructionCompleteAckRetainsTicketsTailsAndRetryMaps Remaining: No missing assertion identified; exact-source execution still required. |
| 140 | covered | E66, E25, E30, E71, E72, E73, E32, E91, E27, E26, E37, E85, E102, E101 | Covered: feature gates before exact lowercase URL prefix, empty/malformed/user/query/fragment raw text and original error; Bootstrap only afterward: TestNativeConstructionCompleteURLLiteralPrefixAndEffectPrecedence; control/bootstrap_owner_complete_test.go snapshot GET base10 full uint64 path/body/header/retry; old httpError type/As/text: TestNativeConstructionCompleteURLLiteralPrefixAndEffectPrecedence; control/runner_owner_complete_test.go: TestRunnerOwnerCompleteOriginalReplacementDrainFallbackAndPhase; controlchannel/identity_channel_complete_test.go; control/identity_channel_complete_test.go; control/scheduling_owner_complete_test.go default/explicit provider compatibility, independent Auxiliary URL checks, offline Transit historical active/drain guards and absence from Run/poll: control/platform_defaults_complete_test.go; controlchannel/identity_channel_complete_test.go; control/transit_authority_native_complete_test.go; control/transit_authority_lifecycle_complete_test.go Qualification: All exact-source/native/consumer/foundation/physical/longrun/example/backup/release gates remain separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 141 | covered | E103, E99, E100, E104, E16, E11, E15, E32, E105, E12, E13, E20, E19, E18, E17, E21, E24, E106 | Covered: TestJournalNativeFormatCompleteExactLowerAndNativeDeclarations independently enumerates every field name, type, order and exact tag for both lower and native Journal/RuntimeJournal. It distinguishes []byte from json.RawMessage, native versus lower type identity, native constructor defaults and unchanged physical-slot helpers. New exact declarations test verifies distinct reflect identities and no value or pointer methods that could add native serializer fallback. journal_provider_complete_test.go has actual compile-time Bootstrap[*x509.CertPool] binding and exact bound LoadRuntime/EnableRuntime lower-facts signatures, all five generic interface method types/counts and native provider method count, with platformruntime/runtimeplatform version2 and executionstate version3. Existing TestRuntimeFactsPreserveRawStorageAndReferences in runtime_facts_test.go explicitly covers nil, empty capacity8, invalid bytes capacity9, valid raw bytes, shared backing through extended empty slices, map mutation identity, extension pointer identity, nonzero metadata and complete zero roundtrip. Existing runtime_history_complete_test.go covers every native/history assignment, driver, resource and retirement field plus extension pointer and native input bytes. No duplicate converter implementation was added. The independent lower layout has no native tags, renamed format/import fields and no value/pointer serializer methods. New native literal-format tests use state.Journal/RuntimeJournal directly; existing runtime_history projection test requires serialized decision view to differ from original complete native wire bytes. Remaining: No missing assertion identified; exact-source execution still required. |
| 142 | covered | E103, E105, E12, E19, E20, E24, E99, E100, E104, E16, E11, E15, E32, E13, E18, E17, E21, E106 | Covered: TestJournalNativeFormatCompleteLiteralAuthenticatedPayloadEnvelopeAndRawMessages pins independent literal native payloads for nil/null/ordered raw object, complete envelope field order and lowercase hexadecimal HMAC over those fixed literal bytes, including absence of an added domain/prefix wrapper. The expected MAC is independently evaluated at test runtime with crypto/hmac+sha256 on literal payload, not copied from production marshaled bytes; no fixed precomputed MAC constant is claimed. Empty/invalid RawMessage must fail before creating the file. RuntimeOptionalFields test independently crosses nil/non-nil-zero/non-nil-one extension and empty/nonempty imported digest, pins native field order/omitempty and complete nested authenticated payload/envelope; Transit exact native nested format is pinned separately. native_loader_complete_test.go covers generic syntax -> MAC hex -> MAC comparison -> body validation, Runtime key before file access, nested duplicate-key I-JSON before authentication, strict unknown field before identity/binding, Node/version/outer-inner binding before extension/maps, unsupported extension before import, malformed import before fence, nil inner maps with nonnil equal empty outer maps, bad physical fence and invalid uint16 port before zero-generation history, and zero-generation history refusal. Stored Snapshot tests separately pin native parser/digest refusal before identity, then stored generation identity, physical high-water, retired fence, and missing durable extension before physical checks. New PreviousCodec test accepts null/empty prior JSON and unvalidated ADP2-shaped old history with unknown fields, retains json.SyntaxError type, preserves version3-only SupportsProtocol and native opaque slot formatting, and requires invalid incoming native validation to return no history/bytes. Nested duplicate JSON is explicitly expected at outer envelope I-JSON because recursive outer parsing sees it first; no unreachable inner-duplicate or post-IJSON unsafe-counter error is invented. Existing RuntimeStore/Codec/Input exact method-set tests and executionstate history/provider exception traces remain the authority. Reuse platformstate atomic_write_test.go and atomic_effects_complete_test.go, state lock_test.go, executionstate runtime_acceptance_order_test.go and persistence_outcome_complete_test.go for exact native effects, equal-generation no-save, error identity and uncertain persistence outcomes. Reuse multihop_journal_test.go explicit import/high-water/owner/fence tests and inspect_test.go no writes/migration/lock files, complete file digest, current identity/tamper/missing/imported history cases. New Bootstrap test checks real native lower-facts load and enable, retained authenticated current facts on failed old-Transit load and byte-identical current journal after failure. New RuntimeOptionalFieldsAndTransitRemainNative test pins exact Transit declaration output and original generic authenticated envelope, then loads via LoadTransitJournal. Existing adp3_transit_journal_test.go covers complete persistence/replay/retirement/corrupt history; existing agentidentity records_test.go and records_complete_test.go pin native protected Relay JSON, independent optional fields, facts identities and state.Load/Save envelope use plus MAC refusal. No production conversion, credentials, authority, protected history or reset logic changed. Only three new uniquely named Go test files and this evidence/checkpoint were authored. No local test, parser/type/static/syntax check, formatter, generator, build, CI, commit or production edit occurred. Existing auth/save-before-bind evidence is reused without duplicate fixtures. Remaining: No missing assertion identified; exact-source execution still required. |
| 143 | covered | E11, E12, E14, E30, E32, E103 | Covered: Existing executionstate RuntimeHost and state native journal tests retain lock/load/stale/input/extension/protocol/history/save/release and refusal current-value/raw-reference semantics New actual Runner constructor public-port traces explicitly prove feature/proof/root/key/load/extension/credential/enable/client order, success raw/maps/pointer projection, failure stops before later provider and preserves original error/history with no extra scheduler/state call Current original platformruntime Bootstrap.LoadRuntime/EnableRuntime bodies compiled in source-effect fixture: one native statecall followed by exactlyone RuntimeJournalFacts projection on both value+nil and value+sentinelerror; key/path/node/transit arguments and native output pointers/backing preserved Actual native default constructors and missing/corrupt Journal load/enable cases exercise current state owners without reset/init fallback or new instance lock; existing state.RuntimeJournalFacts tests pin complete native/lower fields and reference projections Remaining: No missing assertion identified; exact-source execution still required. |
| 144 | covered | E107, E30, E71, E72, E73, E108, E101 | Covered: prepared lifecycle/version1 and unchanged driver HostVersion1; native certificate/root/identity aliases and constructor signature: TestNativeConstructionCompleteTransitPrerequisiteLoadAuthAndCopies; native_construction_complete_test.go: compile-time original constructor signature and PreparedInstance method contract; nativeexecution/offline_transit.go: native aliases missing authorizer/reservation/identity/epoch/capability/load/auth multi-defect precedence and exact errors; no reserve/Now during construction: TestNativeConstructionCompleteTransitPrerequisiteLoadAuthAndCopies key/root/capability clone stages and retained certificate/Leaf/DER references: TestNativeConstructionCompleteTransitPrerequisiteLoadAuthAndCopies nil native engine => nil interface exact error; partial nonnil pointer retained for caller Close, no added Activate/Close/registration: nativeexecution/offline_adapter_complete_test.go: TestOfflineAdapterCompleteNilPartialAndSuccessIdentity; control/transit_authority_lifecycle_complete_test.go: TestOriginalPhasesPartialCleanupAndReturnShape Remaining: No missing assertion identified; exact-source execution still required. |
| 145 | covered | E30, E107, E101, E91 | Covered: Current original TransitController declarations are compiled in an isolated test module; only ParseWireTime, AcceptTransitSnapshot, EncodeOfflineTransitIntent and PrepareOfflineTransit call selectors are rebound. No controller algorithm is copied. The actual strict adp3transit parser, original instance/map fields, native time parser and authenticated durable Journal remain. Exact controller-mutex traces cover closed/capability/first authorization/strict parse/Node/epoch/new-generation rejection, issued-before-valid parse with unchanged injected error identities, Now after both parses, future one-second and exact deadline refusal, per-assignment authorization/reservation, final authorization and Journal save before old Close. All prepared/active/draining phases cover check failure, JSON return, nil or partial Prepare error, Activate error, partial cleanup, unchanged observation fields, same map publication/removal and idempotent Close/read behavior. The original Allow closure is invoked to prove authorization error precedes Now and exact deadline refusal follows authorization and Now. A two-assignment vector proves every authorization/reservation precedes final authorization/save, second JSON failure returns the first accumulated observation and leaves the first published engine while retaining the complete durable Journal. Engine-native time/TLS/frame/watch/budget authorization remains with original native owners and existing engine suites. Exact-source Actions execution is pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 146 | covered | E30, E13, E107, E109, E101, E102, E110 | Covered: The original controller effect suite uses the actual authenticated Journal on Prepare nil/partial and Activate errors: durable generation10, physical Fence9 and nonempty digest survive while no failed engine is published; a restarted original controller refuses cached generation before reservation or Now, and original Journal accepts the higher generation/fence. A second test runs unmodified NewTransitController/ApplyTransitSnapshot/native Engine Prepare/Activate: untrusted local roots cause native preparation refusal, a local downstream that closes TCP causes actual TLS activation failure, and both retain generation/Fence with no cached engine after New/replay and byte-identical retained Journal. Actual original physical guard rejects historical/retired/active/draining TCP ownership and retains original UDP/different-port distinction. Native tlsConfig VerifyConnection is called directly for both client and server configurations: trusted single leaf succeeds; chain lengths0/2/3, trusted root appended, nil leaf and nil intermediate vectors all return the exact first refusal before certificate/intermediate use. TLS version and ALPN first refusals are explicit. Existing original Journal persistence/retirement/replay/corrupt-file, independent Control authorizer/live ticket/capability/identity bridge and native TLS/engine authority evidence is reused. No intermediate support, driver, registry, Run/poll/Report, protocol or schema change was authored. Exact-source Actions and independent physical-host gates remain separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 147 | covered | E111, E93, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53 | Covered: Provider2 method-set exactly6 methods arbitrary opaque generic Host pointer and nil, no conversion or extra read Native Provider exact explicit observationwire.HostResources binding; all7 native/lower DTO field names/count/order/types/tags/owner identity/pointer/slice shapes Host resource pointer/slice identity through current Runner capture and onlyNow/Platform reads; complete unsupported literal JSON Existing Forward embedded promoted access/flattening and Control aliases remain credited Remaining: No missing assertion identified; exact-source execution still required. |
| 148 | covered | E55, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53, E112, E113 | Covered: Existing four observationwire literal encoder/ACK families retained New sender tests integrate four real CheckAck after original timeout/Post/read and transport refusal stages Process telemetry capture exact injected Memory/Process/Now/Platform/Goroutines values; Host capture onlyNow/Platform, UTC formatting and resource no-conversion Probe point clock/retention/local sort/cursor prior176 tests retained Retain original three native four-family literal wire/closed ACK/encoder identity and size tests; no redundant encoder or ACK value inventory was added Forward real point original UTC boundaries zero/epoch/negative/native offset, current/draining/terminal EndedAt detached copy, all nine uint64 maximum decimal counters and native optional pointers/unavailable explicit null Real Forward page Now-before-Runner-lock, frozen metadata/identities/references/loss/generation, PayloadCounters-after-unlock then point Now, terminal stored endedAt without Now, final envelope Now, no repeated retention at final time Real Forward 260-source sorted local256 versus remote2 independent cursor rotation, clamp 1..256, empty Items[] and selected cursor advances, exact overflow reset inequality, local coverage fields Real Forward serialized identity lexical key plus counter epoch ordering, quote escape ordering, original Node/Boot/Session tail filters, draining overrides current even unavailable and terminal overrides both, non-ingress not observed Entire original forward_counters.go excluding file output is staged with actual lower payload/wire types; only EncodeValue identity effect rebound; nil/error and partial bytes/error both ignored with original sort/cursor decisions Direct real four CheckAck compare Process suffix accepting comma fraction and >9 digits versus three regex refusals; epoch equality, one/nine digits, preepoch, empty fraction, offset, lowercase Z and invalid calendar Uint64 maximum/lowercase hex/nil hex; OptionalCounter nil/negative/zero/int64max detached text; plain versus UTC zero/epoch/preEpoch/native offset time projections Four original CheckAck bodies only rebind ParseJSON, json.Unmarshal and time.Parse; assert exact effect inventory and source ordered required-key lists; injected sentinel identity, actual malformed I-JSON and UnmarshalTypeError, count before null before decode, parse before correlation, parse failure folded to provenance, balanced final rejectedPoints and unbalanced count prior refusal Retain Probe unconditional native Now/UTC before terminal EndedAt plain offset Format and original Probe page/budget/retention tests; retained Process/Host observation read and native snapshot tests cover their separate source owners Remaining: No missing assertion identified; exact-source execution still required. |
| 149 | covered | E40, E55, E54, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53 | Covered: Four real senders encode->timeout2s->Post->bounded4097read->status/length->ACK->deferred close->cancel; valid/read-error/status/oversize/badACK/Post-error branches; original Post sentinel identity and ignored Close error Reachable Host/Forward/Probe encode failures occur before timeout/Post; scalar Process DTO has no reachable marshal-failure branch Four pool/entropy/tick/drop/sequence max and Host worker500ms/no overlap/late drain/cutoff/cancel covered by listed actual-owner and current-source effect tests UDP helper exact native *forward.UDP (lookalike/embedding refused), nil-interface vs typednil originalpanic, actual zero Stats; current original helper+UDP Stats/Remaining staged to assert one Stats, ignored ActiveSessions Remaining lock/unlock, five atomicLoads original order and nonzero/maxuint projection Probe CounterSet freeze/tails/retention/budget/generation/cursor prior176 and underlying file lifecycle other source tests retained Remaining: No missing assertion identified; exact-source execution still required. |
| 150 | covered | E66, E31, E25, E114 | Covered: original global registration order/help/default/parser, parsed capture and duplicate behavior: TestNativeOriginalGlobalFlagsOrderHelpDefaultsCaptureAndDuplicate pins all23 flags independent literal name/order/kind/help/default table; real global flag.Parsed/NFlag/Lookup; zero Options. TestNativeOriginalEveryPreexistingGlobalFlagStopsAtRegistrationPrefix covers each23 duplicate position, same native panic/diagnostic, exact registration prefix and no parse. TestNativeOriginalParsedValuesAreCapturedAndNativeParserStopsAtOperand pins every field with original strings/true booleans, independent value capture after flag.Set, last duplicate argument wins, bool=false, first operand and -- stop. TestNativeOriginalGlobalFlagHelpAndInvalidExitBehavior runs real child global flag parser and compares exact stderr help/defaults, stdout empty, help exit0 and unknown/missing-string/invalid-bool exit2. old run/enrollment signatures and actual main argv/stderr/exit composition: TestNativeOriginalMainRunEnrollmentSignaturesStderrAndExit assigns exact func()error and func(string,string,string,string,string,string,string,string)error signatures; actual main.run consumes parsed global values and supplied original NewRunner callback; native factory option reference/error preserved; private enrollment forwards all8 values to native owner; success no stderr/exit, original error stderr newline/exit1, stderr-write failure ignored without replacing exit1. echo/services/inspection/proof/required/prefix first-refusal and short circuits: TestAgentCLICompleteModeAndCompetingFirstRefusalOrder exercises competing invalid options exact first error and no effects; missing node/state/key/url/ca before trusted URL check; rejected prefix is sole URL call. TestAgentCLICompleteEachEchoAndServicesDependencyRefusesBeforeEffects independently removes each4echo/3services dependency with no effect. Retain existing TestInspectionRejectsEveryStateChangingFlagBeforeEffects for all14 mutating inspection flags and TestInspectionAllowsRelayAndPairedTimeProof for allowed readonly relay/proof pair. TestNativeOriginalAbsProofRelPredicateAndJoinOrder pins native literal lowercase https prefix including no extra validation/normalization. no missing trusted-provider fallback and later existing Runner feature dependency stage: TestAgentCLICompleteMissingExplicitProvidersNeverSelectNativeFallback observes missing Platform panic before effects, missing constructor only after lock/boot then deferred release without signals, typed nil Runner plus original constructor error returned before method/signals. TestAgentCLICompleteModeAndCompetingFirstRefusalOrder passes independently incomplete execution/ingress/multihop/import flags through lock/boot to original constructor stage rather than adding earlier command checks. Existing Runner feature-dependency tests retain native rejection credit; no alternate authority/default provider added. Remaining: No missing assertion identified; exact-source execution still required. |
| 151 | covered | E66, E65, E19, E114 | Covered: native Abs-state/proof/Abs-key/Rel/key predicate/path order including ignored Rel errors and lexical parent behavior: TestNativeOriginalAbsProofRelPredicateAndJoinOrder compiles actual Native.ResolvePaths and records Abs(directory)->proof(original raw proof/key,resolved root)->Abs(journalKey)->Rel(root,key)->node.pem/private.pem/journal.json Join order. Each first Abs/proof/second Abs error returns zero Paths/original sentinel/no later call. '.', '..', inside, empty, ..suffix and unnormalized a/.. relative values retain original refusal; only '..'+PathSeparator descendant prefix accepted. Rel error ignored even relative '.', then original three paths constructed. Join wrapper delegates native filepath.Join and retains exact filenames/order; no new normalization, lock or writes. inspection exactly32byte key mask/native inspector/stdout Encoder and no other modes/effects: TestNativeOriginalReadonlyKeyMasksAndStdoutEncoder runs actual InspectJournal source for read error plus returned bytes, zero/31/33 keys and inspector error; all exact JOURNAL_INSPECTION_FAILED mask rather than underlying error, no stdout on refusal; 32byte original backing slice passed once with exact journal/node. Native JSON encoder literal sorted output/newline once, encoding failure before write, stdout Writer sentinel returned unchanged. Complete trace only key read, inspector, stdout. Retain existing inspection Host no-enrollment/no-lock/no-entropy/no-Runner and state inspector MAC-tampering readonly tests for authenticated state semantics. enrollment mode priority/token timing/refusal/partial writes/completion/deferred cleanup with no new lock/reset/rollback: TestAgentCLICompleteModeAndCompetingFirstRefusalOrder demonstrates enrollment wins over rotate/multihop/import/diagnostics after existing validations, projects exact8 enrollment options, returns original enrollment failure and never locks/boots/constructs/signals. TestNativeOriginalBootLockDiagnosticsSignalsAndEnrollmentEffects actual Native.Enroll reads token only on invocation, constructs native Host then Enroll, exact token options, missing token stage, completion text only after successful host return, completion output return error ignored. Retain TestEnrollmentEveryFailurePreservesOrderAndCleanup: token before native effects; every refusal/preparation/roots/post/decode/validate/key/write/journal/certificate failure, partial successful writes retained, completion inside reply/client defers, CloseReply error ignored and idle close after reply for original success/failure. Retain existing native protected-state refusal and readonly tests; no duplicate workflow added. native imports no product command/control implementation: TestAgentCLICompleteOriginalNativeArgumentsAndMainEffects independently pins exact current14 agentcli/native.go imports to standard library plus agentenrollment/authorization/executionenrollment/state. No agentcommand or control implementation import; actual main remains the explicit public composition. Remaining: No missing assertion identified; exact-source execution still required. |
| 152 | covered | E31, E14, E115 | Covered: run instance lock/deferred release, one16byte entropy read ignoring n, diagnostics path, every original Runner option/default: TestAgentCLICompleteEveryRunnerOptionAndNativeCancelBeforeLockRelease pins current command/native InterfaceVersion1 and complete control.Options deep equality for all flags false/default and true/explicit, resolved paths, raw proof/import values, one supplied BootID, optional DiagnosticsPath only when enabled; exact URL/paths/lock/boot/optionalDiagnostics/construct/signals/run/release. TestNativeOriginalBootLockDiagnosticsSignalsAndEnrollmentEffects actual AcquireInstance native instance.lock Join->original lock/release/error; DiagnosticsPath original diagnostics/status.json; actual BootID uses one16byte read and fixed lowercase32hex for n0/1/15/16, returned count ignored, original entropy error preserved. Retain existing lock/boot/constructor/run failure lifecycle table for releases exactly once. construction error before signals, interrupt/SIGTERM context cancel before lock release, Run error propagation: TestAgentCLICompleteMissingExplicitProvidersNeverSelectNativeFallback adds typed nil Runner/original construction error before signals/method with deferred release. TestAgentCLICompleteEveryRunnerOptionAndNativeCancelBeforeLockRelease executes real Native.RunWithSignals on normal Runner error return and asserts live original context during Run, cancelled before lock release, same Run error. TestAgentCLICompleteActualNativeInterruptAndTermination launches isolated real public Host/Native child helper for os.Interrupt and syscall.SIGTERM; native signal cancels passed context, Runner returns same sentinel, context cancelled before outer release. Staged actual Native.RunWithSignals additionally pins Background parent and exact Interrupt then SIGTERM registration order and cancel once before return. Existing Runner stop/recovery/authority owners untouched. Control offline plan public imports and strict read/parse/Forward/compile/pretty stdout with no authority/reservation/deployment: agent-plan-cli-complete.test.ts pins exact runtime imports readFile/core parseForward/shared parseJson/public compileDirect+compileSnapshot and type-only SnapshotInput/public AuthorizedNodeFacts+ReservedSlot. Actual cli main argv2 only, missing/empty exact usage, extra args ignored, path unnormalized including --help; awaits read(path,utf8) before strict parser; exact Forward/nodeFacts/reservations refs to direct compiler; snapshot shallow spread/getter order after direct compile, original nested references and assignments/tombstones overrides; exact pretty(snapshot,null,2) UTF8/newline/stdout once, false write result ignored. Every read/parse/Forward/direct/snapshot/pretty/stdout error stops later effects and logs original Error message then exitCode1; non-Error rejection Plan failed; console failure precedes exitCode write. Forward errors stringify exact original array before command Error; strict duplicate/malformed inputs and actual invalid Forward refuse before compile. Actual public parser+compilers compare valid native Snapshot bytes and foreign-scope/missing-reservation/bad-lease refusals before output. Bounded require providers and pure public compiler calls add no Runtime authority/reservation/deployment effect. Remaining: No missing assertion identified; exact-source execution still required. |
| 153 | covered | E372, E373 | Covered: Raw status adapter exact SELECT strings/argument order and supplied Tx; report-before-current decode and second current decode; malformed report/current first errors and absent/zero paths. Existing raw status SQL suite and new absent-row/undefined-epoch/error suite pin all three original SELECT texts, parameter placeholders, supplied execute receiver, no pool or transaction surface and original driver error identity. Direct owner traces cover absent node/current/reported/report, falsey raw report and generation, report-first/current-first/filter-before-reported, separate current freshness decode and every first provider/decoder/parser/now/formatter failure. Malformed report observations fail after first current decode and before reported lookup. Remaining: No missing assertion identified; exact-source execution still required. |
| 154 | covered | E372, E145, E373 | Covered: Tuple generation/fence matching, applied spread fields, earliest freshness/cutoff, exact expiry and wrong epoch/missing evidence, permissive decode failure order are asserted. Tuple matching, observation order/spread override/reference identity and unvalidated protocol/identity compatibility; count/every-ready and policy shallow copy; received/window/current/reported/skew/session exact boundaries including null/zero/NaN/infinite invalid native date; non-null-only now and dynamic Date.now are direct. Path recursion removes path, preserves remaining object references, visits ingress/via serially through this.status override, stops on error and aggregates unknown/degraded/all-ready with original fresh-first/received-next parse and received-then-fresh format order and minimum/null behavior. Legacy one-argument own status wrapper and native codec permissive references/parse/date errors are explicitly asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 155 | covered | E372, E170, E367, E374, E375, E373, E282, E271 | Covered: Supplied-Tx status SELECTs and original lazy decoding are directly tested; old wrapper aliases/current composition compile and migrations are exercised by MySQL CI. Thirty provider-effect cases cover guard/acquire/isolation/begin/action/commit errors, three-attempt deadlock/lock-timeout retry, release/reacquire and rollback error precedence; migration legacy/lock ownership/mode/sorted names/partial DDL/backfill/marker/unlock errors and pool.close awaiting. Existing foundation-storage-effects tests pin original acquisition/guards/isolation/begin/action/commit/retry/rollback/release and every migration legacy/lock/sql-mode/sorted filename/read/split/backfill/marker/unlock/close error boundary. New native suite executes original constructor body with only dependency bindings and pins exact createPool options plus rows/write references/default args. Real MySQL asserts migration owns GET_LOCK while file work runs, contender refusal and post-return acquisition, partial DDL persists without a marker and repaired retry marks each sorted file once, and before-commit versus actual-committed-but-rejected driver outcomes return the identical error without retry while durable rows differ. Status projection and server/control construction suites separately pin legacy arity/own status/subclass method and shared production read compositions. No unknown-commit retry guarantee is added. Remaining: No missing assertion identified; exact-source execution still required. |
| 156 | covered | E160, E161, E314, E315 | Covered: Actual startControl configuration/feature flags used by real HTTP/Agent acceptance scripts with fail-closed feature defaults. startup1 structural options; port/features/env read/refusal order: public/canonical identity and interface1; fully structural generic Effects/Options; complete default options and exact env read list; invalid port and competing services/ingress/schedule/skew first errors; Number hex/exponent/whitespace and exact flag semantics production release short circuit/failure; required option evaluation: production/nonproduction gates; missing release path before revision; original verify error; deferred successful verifier blocks option evaluation; each of six required options refuses before later reads/start/log/signal repeated host/multihop/notification reads; policy identity/spread: multihop first1 second0 observes original reread; host bound then logged value; notification truthy first read then directory second read; disabled policy identity; enabled shallow spread/ref identity/maxSkew override; policy getter once after all option env reads and enumerable getter sequence only for spread server-start failure before log/signals; host log reread; SIGINT before SIGTERM; once-only close including rejection: start failure original error and no second host/log/signal; exact signal registration order; three signals while deferred close call close once; repeated signal after completion no extra close; child-process actual unhandled close rejection retains original identity and repeated signals never invoke close again native leaves import no L3; existing main binds original server/release: native leaf source has no modules import; DEFAULT_POLICY and release function exact native identity; main imports server.ts startControl and passes original native effects/start/release Remaining: No missing assertion identified; exact-source execution still required. |
| 157 | covered | E150, E160, E161, E316 | Covered: Real client CLI member/grant/policy/Profile/endpoint command outputs compare to HTTP native responses. opaque Url/Bytes providers; every original command/usage/file/parse/method/path/body/Number/encoding branch: 23 command/revision table cases using object Url and symbol-branded Bytes; exact method/path/body/key; Unicode/slash scope and IDs; update hex Number and node-policy/retry nonfinite stringify-null; all required positional omissions and exact per-command usage; six-destructuring ignores tail; source public/canonical identity and generic compile acceptance key precedence/create refusal; URL before CA read: all mutationKey/expectedOrFile/key selectors in table; create reads/parses/stringifies file before persistent-key refusal but never constructs URL; every command URL before opaque readBytes/request Bearer/JSON/optional headers/body length;10s timeout/destruction/error/end;chunks/2xx/status: native node:https.request replacement + syncBuiltinESMExports; original URL/CA refs; exact method/ca/timeout/headers only; Unicode body UTF8 length2 vs no headers for absent/empty; exact end body; split multibyte chunks;199/201/204/299/300/302/400/503/undefined statuses; timeout destroy original Error; request event/creation/end original failures;16 requests for16 scenarios with no retry final strict parse/pretty stdout; no new limit/retry/redirect/exit/catch: request then parse-response/pretty/log exact order; pretty literal; duplicate JSON final response rejects before output; every injected provider failure original identity/stops at stage; native strict parser identity; actual native argv/env/url/encoding/readText/readBytes/stringify/log; native source excludes redirect/process.exit/catch/extra timer and client.ts calls original effects Remaining: No missing assertion identified; exact-source execution still required. |
| 158 | covered | E116, E117, E109, E118, E58, E59, E119, E120, E121, E122, E123, E124, E125 | Covered: coverage map E47/E48/E45/E49/E28/E29 already maps actual multihop TCP/UDP lifecycle, shared budgets, cutoff/half-close/egress/framing; do not recast these as wholly absent Source assertions cover immutable native multihop projection for ingress/transit/egress x TCP/UDP; native validation/leaf/fingerprint/conversion/prepare order; original public egress detour; resolver/policy/callback/numeric dial/postdial partial-close; sole Forward TCP/UDP node budgets and failed-stage/repeated release; existing actual multihop lifecycle/drain/expiry/cutoff/half-close and UDP isolation; TLS13/ALPN/CA/pin ownership; partial control/frame IO, bounded validation, authorization/binding/FIN error order; same-package Snapshot identity, all fields, unavailable/nil/epoch entropy error/short/partial streams, atomic saturation/concurrent totals, successful prefix, actual ingress TCP payload and empty UDP datagrams excluding carrier/egress; Control native Snapshot consumer and copied terminal values. Covered means assertion inventory only, not accepted behavior. Remaining: No missing assertion identified; exact-source execution still required. |
| 159 | covered | E376, E160, E167, E282 | Covered: Actual server composition is exercised by lifecycle/security/restore scenarios including maintenance/read-only refusal, trusted authority and restart. Actual server.ts CommonJS transpilation runs with test-owned import bindings. Exact public ServerOptions/result keys, raw two-SQL native bootstrap store/rows, zero-vs-string-zero initialization, migrate/Authority/guard/default resources/native Date captures/optional recorders/readers/issuers, five tasks, mTLS options/listen timing, protected path getter/containment rules, partial-start sequential/error-close versus HTTPS allSettled, repeated close-promise and all six failure owners are asserted. Exact lazy repeated option getter trace through every default construction group plus all enabled feature constructor arguments and explicit empty host/zero overlap are now directly asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 160 | partial | E126, E127, E128, E129, E130, E131, E132, E133, E134, E135, E95 | Covered: Shared protocol positive/negative fixtures, schema matches repository, bounded/IJSON/JCS/time and typed bypass refusal Remaining: Native codec public alias binding and per-package schema lazy sync.Once/sticky compile error; validator CLI and standalone observationresponder actual config/TLS/budget/listen/lifetime fixtures. Keep generated asset parity already supplied197/198 separate and do not duplicate it. |
| 161 | covered | E209, E213, E214, E211, E212 | Covered: Only HTTP telemetry/Station availability/admission/dispatch is covered by new B test. The notification outbox claim/attempt/finish portions now have explicit transaction fault and ordering assertions, including late outcome failure preserving original claimed fence and no hidden sender retry. NEW observation-recovery-stores-complete.test.ts: Telemetry owner executes exactly ten literal SQL statements and empty argument arrays on one supplied executor; every ordinal failure stops exact prefix without retry; public owner returns supplied store promise by identity. Real MySQL case uses full production migrations, all four raw families with original JSON/counter/provenance and already-suspended rows, retained rollup buckets, heads/cursors and rollup loss heads; caller rollback restores all ten writes; committed quarantine only deletes operational heads/cursors and sets retained flags, repeated call is idempotent. NEW Station owner encoder receives exactly nine ordered fields with original literal JSON; each property remains writable/enumerable/configurable and object extensible/unfrozen; new state per invocation; custom encoder output remains opaque; encoder receiver/error and native two exact SQL writes/first failures pinned. Real MySQL policy case retains every definition/revision/silence/timestamp/audit/loss and event evidence column, only suspension/evaluation/state and event recovery flags change. NEW Notification case holds endpoint suspension behind an awaited gate and proves no Now until it resolves, exactly one Now then three exact delivery/attempt SQL writes; zero and fractional supplied samples preserved; every SQL first failure and clock failure preserves original error object and prevents later work. NEW exact Notification SQL pins last_status_code/last_outcome IF(status=claimed) assignments before status=cancelled; GREATEST updated/start times, pending-only attempt predicate, recovery flags, status filter and claim clearing. NEW real MySQL Notification test seeds all six delivery states and pending/finished attempts with before/after sample timestamps. It compares every row column: only nonterminal status/revision/claims/scheduling/code change; claimed outcome becomes unknown with null HTTP status; terminal HTTP outcome/status untouched; attempt finish is max(started,at), completed attempts unchanged. Maximum-safe-integer rate bound, opaque credential_ref/authority_digest/config and audit/loss rows stay identical; repeat recovery has no append/refund/requeue; caller rollback restores all four writes. NEW real native Station event SQL precedes original Notification outbox handoff test composes actual StationAlerts, MySqlStationAlertStore, NotificationDeliveries, MySqlNotificationEndpoints and MySqlNotificationDeliveries over migrated MySQL. One captured caller transaction contains Station event INSERT before outbox INSERT; linked event ID and original time preserved; queued delivery has zero attempt/fence and no attempt/rate rows. Secret acquisition, sender send/idle/close and authorityBinding all throw if touched. RETAINED station-alert-worker.test.ts event -> enqueue -> policy order and rollback/defer behavior; notification-delivery-worker.test.ts claim/attempt/fence/late failure and sender cases; recovery-quarantine-order.test.ts original full owner order and shared publication time; recovery-native-composition-complete.test.ts real native operator owner/provider construction and supplied Tx callbacks. SOURCE INVENTORY: mysql-telemetry-recovery-store.ts, mysql-station-alert-recovery-store.ts and mysql-notification-recovery-store.ts import only framework/public type contracts plus local mysql write/Transaction; all product state/encoding/Now lives in explicit owner constructors. Root foundation boundary checks must cover the actual saved revision. NEW explicit recovery owners/raw adapters constructor test uses throwing Date.now and provider Proxy; no constructor effect is allowed, missing providers fail instead of selecting defaults. Native SQL executor Proxy refuses any query/connection/transaction operation beyond the supplied execute. No functional/database/static run performed locally; this mapping requires saved-SHA Actions. Remaining: No missing assertion identified; exact-source execution still required. |
| 162 | covered | E219, E199, E211, E212 | Covered: Publication isolated item failure/success ordering and browser publication behavior available. NEW publication-recovery-stores-complete.test.ts table covers actual Path/Ingress deployment/Ingress migration adapters, literal event INSERT SELECT and invalidation UPDATE SQL, exact recovery_invalidated=FALSE predicates, revision+1 and created_by attribution, supplied parameter arrays; zero/fraction/NaN/positive/negative Infinity samples are forwarded without clock/validation; every first failure stops original prefix by identity. NEW real migrated MySQL fixture has active/cancelled/already-invalidated batches for each owner, distinct created_by and existing revisions/events. Actual owners receive one shared supplied at; exactly two eligible batches per family advance revision once and gain creator-attributed recovery events with that time; already-invalidated batch unchanged and cancelled flag preserved. NEW real MySQL test snapshots every column across template/group definitions and immutable revisions, original audits, Forward and Forward revisions, path application provenance, current_path_bindings and current_forward_path_group_bindings. Batches retain plan JSON including source/target revision lineage and original forward provenance; every attempt/outcome/request digest and prior event remains identical, only intended batch revision/recovery fields and added events differ. Shared transaction rollback after all six writes restores the entire snapshot; second call creates no event/revision/attempt or compensation. NEW exact two-statement allowlist on an execute-only Proxy excludes hidden reads/connections or application commands; no production replay/reconcile/apply/compensation hook or new transaction is introduced. RETAINED recovery-quarantine-order/native-composition suites pin actual operator callback order and original shared publication time. NEW public owner test pins all three distinct store receivers, exact original Tx/time arguments and original Promise identity; throwing Date.now/provider getter proves inert constructor/no implicit time; missing store refuses and original supplied store errors escape synchronously unchanged. NEW native final recovery event store pins one INSERT statement and original ID/opaque encoded details/fractional time argument order with error identity. SOURCE INVENTORY raw publication recovery adapters import only framework contracts and local mysql writer; no L3 source import. Root must run current-source boundary and Actions; no local verification is claimed. Remaining: No missing assertion identified; exact-source execution still required. |
| 163 | covered | E363, E152, E167, E365, E374, E375 | Covered: All quarantine owner callbacks, immediate accounts, shared publication timestamp, lazy trust and event encoding order plus fail-stop at each owner; actual recovery quarantines DB owners and preserves Agent journal. Existing real RecoveryQuarantine host tests pin all owner callbacks on identical Tx, accounts capture before credential callback, publication and event clock/encoding order and lazy trust getter. Native recovery composition tests load actual original operator body, assert module-load inertness, per-call Workflow construction, original static receivers/default native time and encoding functions, one empty-assignment Ledger, exactly two outer clock samples and failure short-circuit construction for every owner. Existing UoW effect tests plus new real-MySQL before/after commit rejection retain rollback/retry/release and uncertain commit outcome semantics without protected history reset. Remaining: No missing assertion identified; exact-source execution still required. |
| 164 | covered | E362, E167, E377, E364 | Covered: Output protection/recheck, metadata/binding, exclusive dump/sync, independent authority recheck/lease bound and signed manifest-last; failures close DB without accepted manifest. Actual native-recovery TypeScript body executes with controlled Node/MySQL imports. Exact backup sequence asserts original caller/options and metadata/authority/signature payload identities, output protection and vault recheck, mkdir/open/metadata/ID/exclusive dump/dump/sync/authority recheck/leases/time/hash/sign/pretty/durable/close. Every named stage failure preserves original error identity and admitted-database close, and prevents later manifest publication where applicable. Native dump preserves decoded IPv6/default-port MySQL argv, inherited command-local env/password, executable getter failure masking only inside its original try, exact 120000ms/1048576 limits and no accepted manifest on failed execution. Direct wx0600 durable target write/sync/finally-close and POSIX directory sync, write/sync/close/open fault precedence, Windows directory-sync omission, dump chmod/sync and streamed SHA errors are explicit. Lexical Authority exclusion and canonical vault separation cover existing/missing paths, symlink/file/ancestor/permission/realpath/overlap refusal. Remaining: No missing assertion identified; exact-source execution still required. |
| 165 | covered | E362, E167, E364 | Covered: Issuer stop, tampered SQL and exact historical lease boundary refuse before fresh target; restore order, partial target/migrate failure, committed quarantine versus later credential/rebind failure are distinct. Actual native restore source/client body preserves sourceURL repeated getter order, source-overwrite refusal before connect, original admin/UUID/fresh-target schema query/CREATE/path rewrite and direct end Promise identity, with distinct connect/UUID/DDL failure boundaries. Child spawn argv/env/stdio, stderr handler then original error/exit listeners, streamed pipeline and Promise.all settlement are asserted for successful exit blocked by pipeline, child error/nonzero, pipeline rejection and synchronous spawn/stderr/readstream/pipeline faults; no process kill, timeout, target deletion or implicit retry is introduced. Trusted clock retains original args/defaults/started clock/execute10000ms8192/actual bounded JSON parse/native date/skew1..5/inclusive boundaries/late-clock short circuit and raw failure identity. Strict manifest envelope/payload keys and bounded parse/duplicate/syntax/missing/type/date/hash/count/SQL-file rules retain original permissive MAC/ID/string coercion behavior. Restore owner full stage trace and each bounded effect failure cover stopped/target/maintenance/MAC/version/binding/trust/SQL/hash/exhaustion/output/source/DDL/process/migrate/restored-lease/transaction refusal ordering. Remaining: No missing assertion identified; exact-source execution still required. |
| 166 | covered | E362, E167, E170, E364, E365, E324 | Covered: One original DB transaction commits quarantine before binding/credentials/rebind; target DB finally precedes source close; errors retain committed versus rollback distinction. Legacy imports compile. Compile-only exact native Authority/public-envelope/operator result/one-argument and native database/source/effect compatibility witnesses accompany exact native public method keys, raw metadata/lease/binding row identities, resolve/UUID/trusted-clock alias identity and actual operator public-wrapper construction tests. Restore owner passes identical target DB, Tx, source, manifest and protected authority record; quarantine commits before binding/credential filtering/write/rebind, then closes target before source. Every bounded failure separates precommit rollback, unknown commit, postcommit binding/owner-filter/credential/rebind and finally-close precedence without inventing rollback, clearing or retry success. Root actual scripts/ops/recovery.ts composition tests bind every native public wrapper and original owner callback/instance/static/effect/same-Tx construction; native-to-product source boundaries remain enforced by existing whole-graph suite. Remaining: No missing assertion identified; exact-source execution still required. |
| 167 | covered | E361, E378, E379 | Covered: Schema/reader ceilings, closed plan parsing, immutable history/refusal and compatible-versus-runtimeReady/productionApproved distinctions are asserted by static and SELECT-only MySQL cases. Exact original scripts/ops aliases point to canonical public rules/inspection/native functions; compile-only public plan/profile/Journal/schema/database/inspection/Authority/connection aliases and single exact options object are retained, with source-only version1. Independent report, nested database/authority keys, complete ordered baseline checks, unchecked and responsibility owner inventories preserve original live reference identities and mutable report/checks while runtimeReady/productionApproved remain false. Independent literal26 profile-to-ceiling table asserts every Control ceiling12..37 including typed/service/services/Echo late additions, pending maintenance and both source/target reader refusal; all non-runtime/multihop Agent profiles refuse. Existing and new closed-key/missing-key/native JSON/build/counter/Journal cases retain duplicate/unknown/null/zero/MAX/1000/Transit rules. Every explicit multihop executor/withdrawal, source Journal/Agent extension, downgrade/migration, maintenance/recovery/rollback and missing/foreign/history/digest branch has original ordering and blocked-over-review precedence without granting readiness. Existing enum/history footprint tests remain. Remaining: No missing assertion identified; exact-source execution still required. |
| 168 | covered | E361, E378, E379 | Covered: Migration footprint/hash/partial DDL/unknown history and actual read-only database/Authority/journal preservation are asserted. Actual native-upgrade-inspection TypeScript body executes with controlled fs/MySQL imports and actual schema footprint functions. Bounded input preserves default1048576 allocation+1, exact stat and partial read/zero EOF offsets, fatal split UTF8, growth-over-limit, open/stat/read/close error identity and finally-close precedence. Catalog reads the actual new relative migrations root and all37 saved SQL files, exact0037 floor, SHA256 and actual markers; extra/nonSQL/unknown/unreviewed floor files are refused with no generator or rewrite. Native database inspection independently matches all original SQL statements and timeout10000, setup before try and rollback only after successful snapshot startup; every bounded query stage, rollback failure and schema-race path retain original errors. Optional-table absence/null/defaults, metadata/columns/foreign ORM/history/node-count/id/digest/counter/lease bounds and canonical numeric strings remain; no UnitOfWork/migration/write/DDL/Agent provider is available in the assertion VM. Existing real MySQL acceptance checks SELECT-only credentials, immutable database and protected Authority/authenticated Agent Journal inventory across actual inspection and interrupted DDL. Remaining: No missing assertion identified; exact-source execution still required. |
| 169 | covered | E378, E379, E361 | Covered: Real assessment verifies SELECT-only database, authenticated journals, protected Authority stability, unsafe restore and partial DDL refusal without mutation. Actual assessment orchestrator body uses original function with controlled native effects/rules imports. Exact plan-read->parse->catalog->Authority construct/read-before->CA-read65536/trust->open->inspect->read-after->report->awaited end trace, lazy options plan/state/CA/database getter order and original database/catalog/parsed plan/after-Authority object identities are asserted. Report receives source-only name/hash projection, sequence-before/after stability and trust-before/after comparison, and awaits CA and database end. Each setup-stage failure opens/closes no extra database; inspect/after/report errors end the successfully opened connection, end failure retains original finally precedence. Existing upgraded source assertions and actual read-only MySQL/Journal/Authority test remain; no pending execution or external consumers are counted as missing assertions. Remaining: No missing assertion identified; exact-source execution still required. |
| 170 | covered | E361, E380 | Covered: Public CLI dispatch is asserted read-only and never constructs/mutates Authority for assessment; original operators compile. Actual public runOperatorCommand is exercised for assess/status/maintenance/resume/backup/restore/unknown with original argv destructuring and ignored non-assessment extra arguments. Exact env and Authority-before-dispatch order, missing/empty required short circuits, nullish versus empty native executable/directory defaults and optional notification-field omission preserve original semantics. Restore awaits the identical CA certificate before digest and later env reads, reads clock-args env twice before native JSON parsing and forwards the original Authority/arguments to Recovery delegates; projection/serialization/log failures after accepted operations propagate without a replacement command, rollback or retry. Actual nativeOperatorCommandEffects body preserves lazy process argv/env/native Authority/file/JSON/console/exit bindings. Actual original cli.ts body spreads same native effects and same assessment/backup/restore functions, with original outer catch/failure effects. Remaining: No missing assertion identified; exact-source execution still required. |
| 171 | covered | E361, E380, E324 | Covered: Assessment decision exit codes and read-only public dispatch/source ownership are asserted. Assessment exact twelve-code whitelist, unknown/non-Error redaction, usage outside inspection catch, compact refusal versus pretty success output, exit0/1/2 and output-before-exit are explicit. First success stringify/log/exit failure enters original inspection catch; refusal-format/output/exit errors propagate unchanged, and outer failure logs original Error.message or bounded non-Error text before exit1. Release argv path/revision priority and nullish env fallback, original usage, same awaited verifier/pretty report/no catch and raw verify/format/output errors are asserted through public function plus actual top-level-await entry body. Actual native release verifier body reads all fifteen independent gate names in declared order even with reversed manifest list, bounds manifest and reports at8MiB, canonical containment/symlink escape and exact SHA, exact source/clean-tree/immutable images/unique gate set,3/4/8 cleanup+TCPUDP runtime evidence, isolated traffic,3..8 distinct node IDs/at least3 physical host IDs and matching containers/dev-images reports. Test provider map contains only fs/path/hash fakes and executes no release gate or external command; invoking validation does not approve or publish a release. Remaining: No missing assertion identified; exact-source execution still required. |
| 172 | covered | E330, E313, E322, E331, E332, E326, E324, E333, E64 | Covered: The eleven exact package exports and lower policy/observation/value leaves are checked independently against native eager dependency closure. Boundary mutations reject private and root-as-L1 imports. Exact native/generic/domain type witnesses and DEFAULT_POLICY identity remain; ADP3 native admission rejects ADP2 while every valid original internal ADP2 fixture still parses afterward. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 173 | covered | E330, E332, E327, E297, E334, E326, E244, E324 | Covered: Complete recursive actual native package asset dependency closures and fault staging, exact generator outputs/aliases, separate handwritten telemetry specification/parser/native Go fixtures, source role inventory and current consumer paths supplement existing parser/format/JCS/time/digest suites. Authored source inventory includes COPY/embed/manifests/locks/SQL/ops/example consumers; source coverage does not assert release or physical acceptance. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: No missing assertion identified; exact-source execution still required. |
| 174 | covered | E25, E136, E85 | Covered: Canonical native assembly declarations and lower specializations, old aliases, constructor defaults/nil/error sequence, private partial fixture fallback and no default effect sampling are directly pinned. Source-only no-effect assertions supplement behavioral poison providers, without introducing a production hook. Remaining: No missing assertion identified; exact-source execution still required. |
| 175 | covered | E97, E68, E70, E84, E82, E83, E96 | Covered: Actual Runner factory binds original four resolver method values with Echo/Services/Ingress/base priority and native effects, native fresh zero Dialer, old/explicit constructor nil hierarchy and partial-fixture helpers. Existing registration/negotiation lifecycle anchors retain credit. Remaining: No missing assertion identified; exact-source execution still required. |
| 176 | covered | E93, E88, E80, E137, E138 | Covered: Real Runner assembled through injected Bootstrap/Identity/Channel with operational clock count0 and explicit native probeCounterClock binding; nativeProbeCounterScheduler source only returns agentplatform.DefaultEffects().Schedule and performs no Now call. Actual Gate/CounterSet live reader and frozen-tail page call sites use dedicated point clock; page/retention clock calls remain separate. Free native helper and partial Runner fallback stay native; terminal time is CounterSet executor native time, not either Runner clock. Existing four-way terminal/current x available/unavailable point test samples Now once before decision, preserves UTC current versus EndedAt offset, epoch/overflow pointers and max uint64 decimals; no duplicate implementation of this matrix added. New CounterSet tests cover single16-byte entropy read/short count/error/no Now,available/unavailable,256-binding bound, detached snapshots,64 concurrent mutex-protected attempts/idempotent finish/leave,success/failed/unknown outcomes,count corruption overflow,saturating arithmetic,nil methods,seal-before-begin race,in-flight->unknown,late result refusal,zero-call/final-leave freeze and original executor clock. Runner tests cover sorted35-point pages/32limit/cursor rotation,2Snapshot bound,unavailable source,10minute inclusive retention/session expiry,128-tail oldest eviction+dedup,saturating loss;9 real blocked closed Gates retain only8 readers with one-loss eviction,reader dedup,final freeze->values-only tail,session change removes8 tails. Blocking work is released with cleanup and no socket dial occurs. Remaining: No missing assertion identified; exact-source execution still required. |
| 177 | covered | E322, E326, E335, E324, E332 | Covered: Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Explicit independent protected four-file / thirteen value / seventeen type public-surface expectations, consumer counters and lower/native/asset policy negatives now supplement existing Core behavioral suites. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 178 | covered | E313, E336, E325 | Covered: Native public1/effects1 function surface and exact database type alias are pinned. Native argv is a detached slice after index2, env resolves dynamically, and original console output is retained. Both env reads precede every missing argument/URL/token refusal; arguments/env/open failures preserve first error without cleanup. Constructor/open remains outside try. Original migrate/Identity callback/log stages retain receivers and exact arguments; all failure stages await one close and close errors supersede earlier failures. The actual bootstrap entry awaits the original callback-scoped Identity constructor with native alias. Real Identity bootstrap validates before beginning, inserts account then scope then owner on the same supplied Tx, stops and delegates rollback on each write error, and hashes the exact native bearer. No migration atomicity or new token/authority semantics are claimed. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Remaining: No missing assertion identified; exact-source execution still required. |
| 179 | covered | E337, E338, E339, E340 | Covered: All ten old model exports and function arities are pinned; seven pure exports keep exact public-owner identity. Fresh old entry import/factory initialization cannot sample native time. Complete Direct guards short circuit credential reads; the native Date.parse reference is looked up before the second credential getter, which may replace that property without replacing the captured call. Existing invalid parse still samples Date.now. Form property and String/Number coercion order, listener-before-target refusal, exact errors and mutable detached returned shape are asserted. Native URLSearchParams defaults, Object.entries eager getter order, subsequent String/primitive conversion, empty versus null/undefined/falsy values, key overwrite and encoding remain. Existing direct/Relay consumers plus bounded ports/CIDRs/candidates/protocols/tones/pages complete the clause without server authorization claims. Legacy model exports exercise scope/ports/CIDR rejection, capability/listener/protocol gates, canonical BOTH spec, bounded query encoding and candidate retention. These tests do not assert getter/clock/conversion evaluation ordering. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Remaining: No missing assertion identified; exact-source execution still required. |
| 180 | covered | E308, E341, E339, E324, E342, E343 | Covered: The existing real createApp route test recursively discovers production JS, serves each exact source byte sequence with literal registered path refusal, JavaScript MIME and security headers. Current model imports its real owner public/service and native public graph; actual direct Node model/Relay imports and the adapted recursive app VM loader exercise that graph without private production hooks. Recursive production syntax and actual source/type/private boundary inventory are already configured. Saved-source functional execution remains a separate pending state; no packaged-image or physical-host acceptance is inferred. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: No missing assertion identified; exact-source execution still required. |
| 181 | covered | E344, E345 | Covered: The public request surface/version/function arities and lazy connection reads are pinned. Scope refusal short-circuits token/version; successful connection and dispatch preserve getter/method receivers, version capture before dispatch and post-decode comparison. Default options are fresh per call and explicit options retain identity. Source-native send/readJson/response failures preserve error identity except the original bounded JSON refusal. Decode precedes stale version, then caller cancellation, then status; malformed native result and property/coercion failures retain their original behavior. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Remaining: No missing assertion identified; exact-source execution still required. |
| 182 | covered | E344, E345 | Covered: Native framing/escaped scope/headers/body/options/combined cancellation and status/errors retain source representation. Native send returns the exact fetch Promise without an async wrapper, preserves synchronous fetch errors, original timeout nullish default and options signal getter order. Original mutable input serializes first for signature and separately for native body, without clone/freeze. Same-signature simultaneous mutations share one key and independently dispatch; signature/key failures precede connection reads. Existing failure retention/success deletion/reset tests and explicit no-effects reset assertion cover pending-key lifecycle. No stronger concurrent-outcome guarantee or new retry/queue is claimed. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Remaining: No missing assertion identified; exact-source execution still required. |
| 183 | covered | E308, E341, E346, E347 | Covered: Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Public native mount tests cover lazy construction, all 24 initializers and main callback/reset/connection effects. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: No missing assertion identified; exact-source execution still required. |
| 184 | covered | E340, E308, E341, E324, E348, E338, E339 | Covered: Six exact legacy helper exports/names/arities and native factory key order, lazy capability short circuit, Profile coercion/bounds/first errors, Endpoint parser order, Relay form coercion/authorization order, mutable detached results and multihop bounds/path order. Actual legacy init tests preserve return/listener surface, fresh per-init Profile cache, pinned revision, edit/CAS and JSON-equal preview, unknown write outcome, stale plan invalidation, history restore CAS/confirmation, deployment clear and stale callback refusal; existing console VM tests retain eight-node/copy/grant-loss behavior. Legacy Relay helpers validate bounded Profile fields, peer/port inputs, immutable Profile revision, distinct Nodes, capability/grant refusal, multihop order/cycles/closed gate. These tests do not cover full DOM controller or native getter evaluation timing. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: No missing assertion identified; exact-source execution still required. |
| 185 | covered | E349 | Covered: Original issue/consent/replay/wait/revoke paths and stored TCP/UDP Echo pending/absent/consumed/revoked/quarantined outcomes are asserted. Closed-key, service/Scope/descriptor/machine/binding/time/byte/proof mutations refuse display claims and hidden requests. Historical display remains unknown health and false execution; browser cryptographic proof is not claimed or required by this display projection. Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: No missing assertion identified; exact-source execution still required. |
| 186 | covered | E203, E208, E240, E317, E318, E319, E320, E321 | Covered: Existing v1 non-Echo permit/result tests assert one shared owner transaction, current binding/digest duplicate/conflict, failed store/guard rollback and sticky consumption/withdrawal. Original: Compare old non-Echo and existing Echo native selection per family; same-Tx permit challenge/result proof/byte/TLS capture, old mutation/capture/clock/refusal/commit order, immutable head/revision/loss and MySQL0037 representation. New native dispatch test compares actual nativeProbeResultRequest to canonical v1 (legacy), v2 (legacy/ingress), v3 (legacy/ingress/TLS) and staged v4 (all five measurements) parser/body/digest outputs; persisted v4 digest refusal is exact. Existing v1/v2/v3 public parsers reject v4. New real ProbePermits inspect test compares non-Echo TLS selection through original probeServiceSelection and Echo TCP/UDP selection through probeEchoServiceSelection. Real ProbePermits revoke/withdraw test executes the existing authority owner, same Tx object, actual private capture, original recorder and immutable history for all five families: mutation then prune/clock then capture then commit; Echo challenge and service are retained without fingerprint/raw context/request data. New real ProbePermits receiveResult tests cover v1 legacy, v2 ingress and v3 TLS original plan/instance/machine/qualification/result locks, fresh clock samples, result write then real recorder write then store clock/final freshness/commit. Duplicate emits no write/capture; conflict and malformed binding identity reject. Late post-write clock, recorder error and commit failure all rollback history and result using the transaction boundary. New actual recorder tests capture all five families issued->consumed->result with revisions 1/2/3, original immutable digest, deep-frozen detached record/binding/result/challenge/proof/TLS and public historical content digest; Echo signed proof request digest and 256+256 bytes remain bound to original invocation. Closed proof/TLS/byte rejection includes TCP unreachable and UDP prohibition, null rejected evidence and non-Echo forbidden Echo fields. New conditional real MySQL test migrates through0037, invokes actual recorder/storage in MySqlUnitOfWork transactions, roundtrips all five family optional/NULL challenge/service/TLS/proof/count representations, verified and rejected TLS/TCP Echo/UDP Echo results, pins CHECK constraint refusals, immutable identity and revision refusals, unchanged duplicate head, post-capture transaction rollback, missing-head loss and sticky recovery provenance. Original: Exercise failure/rollback/duplicate/missing-head paths with no history reset, backfill or new authority. New recorder missing consumed/revoked/withdrawn/result updates only updatesWithoutHead and creates no head. Duplicate issued/result/withdrawn retains exact head object/revision; immutable changed identity/binding/instance/service/challenge, stale time, quarantined recovery, exhausted revision, conflicting result and result-after-withdraw refuse without replacing history. Real MySQL missing head remains absent, loss survives, recovery increments once and remains sticky, no permit or short-lived result row is created by history writes. Original: Public v1/v2/v3 input API remains separate from staged native v4 storage parsing; no new live Echo acceptance is inferred. FR-0021 final scope explicitly limits public receiveResult/machine APIs to v1/v2/v3 and native v4 to staged stored parsing/private projection. Tests preserve that scope: controlled v4 TLS/TCP Echo/UDP Echo parse natively but actual ProbePermits.receiveResult refuses at original authorize plan stage before instance/result mutation/capture; no private method mock, new v4 route, qualification or API union is added. Echo proof/byte historical capture is tested through actual original recorder and MySQL, not claimed as public live v4 owner success. Remaining: No missing assertion identified; exact-source execution still required. |
| 187 | covered | E350, E349, E231 | Covered: Exercise real initProbeRuns exported entry and actual list/detail/next/cancel/input/clear button listeners with a minimal DOM and independent Node SHA256 canonical fixtures; no private source extraction or production hooks. Legacy and TCP/UDP echoed runs verify full stored summary digest and separate canonical Echo invocation; mutations of stored actor/binding/resultDigest fail without reseal, while nonce/timeout/service changes fail even with a correctly resealed summary and stale invocation. Detail refuses foreign Scope/service Scope, retention cutoff, invalid lifecycle/expiry/status/proof/byte arithmetic/closed fields; valid detail preserves full content digest. List rejects invalid local window/limit/path/status before I/O, accepts exact echoed filter, checks filter/order/duplicates/query-bound cursor and response-byte refusal. Valid fixed cursor continuation loads one explicitly requested older page only. Historical display states unknown health/no execution/no independent proof and exact controlled request/response counts; loading an ID does not read detail. Cancellation, edited inputs, clear and Scope changes drop late responses without automatic requests. Exercise real initProbeRuns exported entry and actual list/detail/next/cancel/input/clear button listeners with a minimal DOM and independent Node SHA256 canonical fixtures; no private source extraction or production hooks. Legacy and TCP/UDP echoed runs verify full stored summary digest and separate canonical Echo invocation; mutations of stored actor/binding/resultDigest fail without reseal, while nonce/timeout/service changes fail even with a correctly resealed summary and stale invocation. Detail refuses foreign Scope/service Scope, retention cutoff, invalid lifecycle/expiry/status/proof/byte arithmetic/closed fields; valid detail preserves full content digest. List rejects invalid local window/limit/path/status before I/O, accepts exact echoed filter, checks filter/order/duplicates/query-bound cursor and response-byte refusal. Valid fixed cursor continuation loads one explicitly requested older page only. Historical display states unknown health/no execution/no independent proof and exact controlled request/response counts; loading an ID does not read detail. Cancellation, edited inputs, clear and Scope changes drop late responses without automatic requests. Server portion added to existing complete browser Echo/legacy matrix: actual Hono HTTP URL decoded resultStatus echoed -> real ProbeRuns owner/filter/window -> original MySqlProbeRuns/held lower store -> original supplied transaction execute. Assert exact native SELECT projection, byte limits, WHERE clauses, ORDER/LIMIT and bound original filter arguments including echoed; returned fixed-history/non-health envelope. Unknown status rejected by actual HTTP parser and direct owner before SQL, statement count remains unchanged. Remaining browser/full stored-content/time/retention/Scope/cursor/order/size/invocation/protocol/byte/abort/version/input/error/clear/no-hidden-request obligations are mapped in Assets completed browser evidence; this item is integrated assertion completeness, not a functional Actions pass or new live Echo acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 188 | covered | E322, E343, E351, E349, E324, E308 | Covered: New real-import source map assertions pin all 22 old browser leaves/23 initializer exports, their real app imports and exact per-file L2 classification, preserve import-free original native bodies and the real Rule L3 owner/L2 view split, and refuse a folder classification exemption. The manual default/callback/consumer/removal map is tied to those concrete source entries. Four native telemetry open actions really dispatch bounded GETs; initialization, changed filters and clear do not dispatch. Existing tunnel tests start both reads concurrently and cancellation owns both, original Probe revoke issues its follow-up receipt query, and new accepted template publication explicitly refreshes its bounded list. Existing actual graph/type/private mutations and recursive fixed asset test cover the source/asset boundary scope. No blanket no-automatic-read or live capability inference is made. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 189 | covered | E352, E347, E353 | Covered: Original real Rule command flow tests retain bounded detached selection/preparation, CAS/body/key identity, Profile/path preflight, no-write failures and exact uncertain replay without replacement checks, tail/abort/stop/generation/no-op/refusal behavior. Public Rule commands additionally pin finally consent/render order, awaited refresh, accepted/rejected/uncertain/no-op refresh failure retention, stale refresh suppression, original view/notify exception precedence and pre-write/effect/acceptance projection failure classification. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: No missing assertion identified; exact-source execution still required. |
| 190 | covered | E341, E352, E347 | Covered: The new native Rule public-factory tests pin lazy construction, exact destructuring/default global lookup order, old init name/arity, return key order and exact command callback references. DOM input tracking distinguishes unchecking retained inputs from dropping the Set; suspended rows, item/callback identities, listener wiring, selection state, show/consent/clear sequence and discard notification remain. Clone, ordered and JSON each evaluate getters independently in original key order, preserve native coercion/errors and mutable detached values. URI, UTC clock construction, lazy default UUID, explicit/default unbound confirm/newKey, cancellation reason/object, timeout options and exact bounded error text/refusal codes are pinned. Actual main composition is mounted through its public factory and proves all 24 initializers keep order, connection version remains lazy until initialization, and Profile/Path callbacks later dispatch the identical proposal to the existing Rule consumer. Existing actual Rule owner/legacy flows and recursive app/Relay VM coverage remain intact without a production hook. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: No missing assertion identified; exact-source execution still required. |
| 191 | covered | E308, E322, E352, E341, E347, E324, E326 | Covered: Actual Rule old/public/service/native imports execute in original Rule flows and adapted app/Relay VM, recursive Control route assertions cover exact bytes/MIME/CSP/security and missing literal paths, recursive syntax and current source inventory exist. Native-to-product source/type negative enforcement is a concrete separate checker defect: sourceViolations currently enforces lower direction only for L0/L1, so a browser-native L2 import of the L3 Rule public owner is not refused. Production currently has no such reverse import. No production/checker mutation was authorized in this test-only slice. Existing negative L2 native-to-L3 value/type import guards, recursive native Rule VM graph, exact source route/security assertions and distributed module graph tests cover the requirement; image publication is not an assertion obligation. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 192 | partial | E381, E330, E355 | Covered: Integrated commit inherits saved A5 candidate and includes classified additions; exact Actions checkout/tree and clean source status are captured outside self-referential file content. Remaining: Source closure is inherited, not acceptance; final same-source CI and remaining assertion obligations must close before a complete gate decision. |
| 193 | covered | E381, E330, E326 | Covered: Actual import/classification inventory plus public distribution/version checks and compiled current consumers cover declared graph/counter consistency within configured rules. Independent explicit tables pin all current 109 Control, 25 Agent, three contract, four browser and example public counters/aliases. Core four production files, thirteen runtime exports, seventeen public type shapes/private ipv4Bytes refusal, lower/native generic specialization, old ADP2 refusal/internal parser and direct/recursive package lock/embed/COPY/schema/SQL/support assets are tied to actual source consumers and existing configured graph checks. Remaining: No missing assertion identified; exact-source execution still required. |
| 194 | covered | E330, E308, E326, E332, E297, E354, E355 | Covered: Actual native asset stage uses distributed Control COPY layout with eleven real package entries and complete eager dependency faults. Core source closure asserts package/lock/sum manifests, SQL migration sequence, every explicit Go embed target, Control/Agent/Responder Dockerfile inputs, build --pull and offline inspect consumer wiring; recursive Web route bytes and graph tests retain fixed assets. Independent responder build/publication remains a separate gate and is not inferred from the two-image workflows. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: No missing assertion identified; exact-source execution still required. |
| 195 | covered | E342, E325, E341, E352, E356, E324, E308, E345, E346, E326 | Covered: Read-only review: root tsconfig already includes packages/apps/examples plus phase1/phase2/ops TypeScript. The existing test:web preflight recursively parses every production JS leaf, and actual public example behavior, recursive canonical app/Relay VM and Rule owner graphs retain original coverage. Current production source inventory recursively covers browser, example and operator value/type/private references with negative unclassified/private/source syntax cases; source/fixture/generated/ops/phase/manual roles are explicitly inventoried and their existing acceptance commands remain in ci.yml. The original residual text only requires running integrated checks on the saved revision, which belongs to execution status and is not a missing assertion. No duplicate checker/test is added for 195. Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: No missing assertion identified; exact-source execution still required. |
| 196 | covered | E2, E1, E139, E17, E18, E42, E43, E44, E45, E46, E47, E33, E48, E49, E34, E50, E51, E52, E53 | Covered: Native Linux/non-Linux process/host availability and retained Control default wrapper owner equivalence Native Host Linux current-source parser source bounds/effects; actual supported/unsupported resource sample values Clock/proof/OS provider aliases prior13/216/217 and platformstate actual atomic native+effects tests independently retained; these tests do not clear history or touch authority Remaining: No missing assertion identified; exact-source execution still required. |
| 197 | covered | E330, E332 | Covered: All21 schema source roles retain existing local-definition AJV compilation and18 normalized source/embed/generated copy comparisons. Independent real-generator suite stages10 exact Go schema/declaration target pairs, executes original multihop and Go --check tools, checks every staged byte unchanged, pins each adp3 execution alias to canonical adp3execution in schema definition order, and mutates canonical declaration/alias/unembedded execution output to prove actual checker refusal. Runtime schema remains separate from execution and native Relay separate from ADP3 Relay. Actual Transit checker runs against all3 LF/CRLF pairs; each byte drift and9 independent semantic mutations prove original Runtime Transit role/driver refusal, version/kind, negotiation contract-only and executionEnabled=false, delivery Command/Ack nonexecution and received Report assertions remain. Handwritten telemetry/native fixtures are covered separately and are never inferred from generator scope. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: No missing assertion identified; exact-source execution still required. |
| 198 | covered | E330, E332, E297, E334, E357 | Covered: Independent explicit11 public-export names and22 dependency rows (21 schemas+native catalog) stage actual contracts/core package targets in the Control distributed COPY layout and import actual @tunex/contracts package specifiers. Baseline all entries load. For every asset, fresh processes test missing, malformed JSON and valid-but-invalid schema/catalog; every one of11 entries must match its independent eager dependency closure, including shared ADP2 initialization, separate Runtime/execution and Relay resources, Probe families, staged Echo->Services and native catalog. Each of4 handwritten telemetry schema documents is independently absent from runtime loader closure; deleting all native assets together still loads3 common lower entries and observability.4 separate handwritten TS parser sample/ACK fixtures are validated by actual AJV specification documents and actual native parsers; exact closed keys, all missing keys, duplicate JSON, syntax and byte limits, detached recursive freeze, timestamp/provenance/version/binding, uint64 and host/point semantic mutations retain native behavior. Shared literal4 Go wire fixtures are compared byte-for-byte against actual4 EncodeSample outputs and independently fed to TS parser+AJV acceptance. Actual4 Go CheckAck functions require original sent identity, every closed required nonnull typed field, bounded JSON/duplicate refusal, stored/provenance/noauthorization and UTC time, Forward/Probe exact page accounting and rejected receipt refusal. Native encoder tests retain host8192/Forward65536/Probe65536, point4096, page32, original binding, Probe retiring/coverage and snapshot count limits; original nil collection representation is retained. Process TS stored=false acceptance and stricter Agent ack receipt behavior are explicitly distinct. No additional release/image publication or physical-host claim is inferred. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: No missing assertion identified; exact-source execution still required. |
| 199 | covered | E333, E64, E57, E56, E358, E359 | Covered: Original: Compare catalog1 closed fields/digest/order/schema/platform/role/phase/protocol/capability/flag/gate declarations with original Direct/Relay/Multihop compiled providers, typed/generic host wrappers and platform/feature selection. New TestCatalogCompleteCompiledFieldsAndHostSelection compares catalog1 fixed three-driver order, descriptorRevision/schemaID/version, every compiled platforms/roles/phases/protocols/capabilities, exact ordered agent flags and RequiresRelay/RequiresMultihop, controlGate and required capability closure. Both native Registry and specialized generic Registry descriptors match; every role/phase/protocol x four features x Linux/Windows/unsupported/empty platforms resolve only when permitted, native wrapper matches actual runtime.GOOS. Existing contracts native-drivers.test.ts asserts immutable catalog version/digest/order/carriers/security/usage/privileges, closed parser refusal for executable/unknown/duplicate/version/invalid metadata. Existing control TestExecutionCatalogMatchesBuiltins ties original Control private descriptors to catalog. Original: Keep existing duplicate suppression, Probe opt-in/hook conditions and actual Guard/Journal/authority before execution. New TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication covers 2 platform states x4 feature combinations x8 Probe opt-in combinations x4 TCP/UDP hook combinations. Repeated providers and repeated/base-overlapping capability names deduplicate in exact order; requires ingress+hook before probe, services before TLS, ingress+services+echo+both hooks before Echo. No Start/Replace/Phase/Classify/Probe hook called, descriptors unchanged and returned lists detached. Existing Guard/Journal/authority-before-bind tests retained without duplication: control/runner_test.go, control/execution_drivers_test.go, control/transit_runner_test.go, forward/authorization_test.go and state Journal suites. Original: Catalog metadata does not install a driver, load its schema automatically, measure usage or enable live Transit/Echo. New tests assert nil compiled provider list advertises only adp.3 despite all Probe flags; uncompiled native.transit.v1 Resolve refuses; usage remains not-reported; capability projection invokes no execution or observation hooks. Existing TS test rejects catalog as Runtime Hello. Catalog/source inventory contains only fixed compiled providers: no dynamic schema loader or usage collector or capability authority introduced. Feature metadata is not physical/live execution evidence. Original: Compare catalog1 closed fields/digest/order/schema/platform/role/phase/protocol/capability/flag/gate declarations with original Direct/Relay/Multihop compiled providers, typed/generic host wrappers and platform/feature selection. New TestCatalogCompleteCompiledFieldsAndHostSelection compares catalog1 fixed three-driver order, descriptorRevision/schemaID/version, every compiled platforms/roles/phases/protocols/capabilities, exact ordered agent flags and RequiresRelay/RequiresMultihop, controlGate and required capability closure. Both native Registry and specialized generic Registry descriptors match; every role/phase/protocol x four features x Linux/Windows/unsupported/empty platforms resolve only when permitted, native wrapper matches actual runtime.GOOS. Existing contracts native-drivers.test.ts asserts immutable catalog version/digest/order/carriers/security/usage/privileges, closed parser refusal for executable/unknown/duplicate/version/invalid metadata. Existing control TestExecutionCatalogMatchesBuiltins ties original Control private descriptors to catalog. Original: Keep existing duplicate suppression, Probe opt-in/hook conditions and actual Guard/Journal/authority before execution. New TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication covers 2 platform states x4 feature combinations x8 Probe opt-in combinations x4 TCP/UDP hook combinations. Repeated providers and repeated/base-overlapping capability names deduplicate in exact order; requires ingress+hook before probe, services before TLS, ingress+services+echo+both hooks before Echo. No Start/Replace/Phase/Classify/Probe hook called, descriptors unchanged and returned lists detached. Existing Guard/Journal/authority-before-bind tests retained without duplication: control/runner_test.go, control/execution_drivers_test.go, control/transit_runner_test.go, forward/authorization_test.go and state Journal suites. Original: Catalog metadata does not install a driver, load its schema automatically, measure usage or enable live Transit/Echo. New tests assert nil compiled provider list advertises only adp.3 despite all Probe flags; uncompiled native.transit.v1 Resolve refuses; usage remains not-reported; capability projection invokes no execution or observation hooks. Existing TS test rejects catalog as Runtime Hello. Catalog/source inventory contains only fixed compiled providers: no dynamic schema loader or usage collector or capability authority introduced. Feature metadata is not physical/live execution evidence. Catalog digest/order/deep freezing, physical UDP-to-TCP carrier distinction, flags and multihop gate. Closed-field/version/new-driver/duplicate/capability/privilege refusal; catalog rejected as Runtime Hello. Actual Go provider/Guard execution is not asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 200 | covered | E170, E382, E164, E323 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. The bounded59 top-level leaf map is accepted as an assertion inventory: all53 independent exact forwarding namespaces and their aliases/types remain tested, all six original construction entry namespaces and distinct inherited canonical classes are checked. The four remaining native construction defaults now have real same-executor SQL/effect tests, complementing Forwarding/Idempotency zero-argument matrices. Original frozen policies, token/parser aliases, public/type-erased exports and the native/composition classification remain intact. This row does not claim nested Runtime/owner or consumer removal acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 201 | covered | E170, E152, E176, E382, E164, E365, E363, E364 | Covered: Legacy constructor/import consumers compile and pure identities are checked; Ledger/idempotency acceptance retains supplied Tx and stable keys/monotonic clock order. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. Identity dynamic clock is replaced between real audit writes; its pool account lookup and supplied-Tx authenticateIn use different executors. Nodes captures the original Date.now function, samples machine twice, retains120/86400, creates fresh default resources and uses supplied resource identity, and provisions credentials before original runtime initialization. Transport captures the original UUID function and resolves time dynamically in native grant SQL on the same Tx. Endpoint management/claim/native save/audit/receipt retain one request/Tx with native error identity and outer rollback. Static Transport/Nodes quarantine SQL and fail-stop order are exact. Existing Forward/Idempotency constructor matrix remains retained. Native owner-default matrices already pin dynamic Identity and endpoint clocks, captured Nodes Date.now and120/86400/default-versus-supplied resources, Transport UUID/default clock, zero-argument Forward/Idempotency and static supplied-Tx quarantine. New actual scripts/ops/recovery.ts body tests keep module loading inert, construct one fresh native Workflow per operator invocation and defer owner closures. Actual RecoveryQuarantine invokes all original instance/static owners on the same Tx in exact order, accepts the exact account credentials immediately after Identity, shares one publication timestamp, retains native clock/encode functions and the sole empty-assignment RuntimeLedger, and stops further lazy construction on every callback failure. Existing real owner recovery and native Workflow tests retain protected credential/history and postcommit cleanup semantics. Remaining: No missing assertion identified; exact-source execution still required. |
| 202 | covered | E170, E382, E244 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. each exact current import module/local/remote name and final canonical Symbol; Accepted exported alias preserved; old forwarding-ports, node-execution-ports and identity-ports resolve to same final symbols poison all type-only module sources with nonexistent sentinel then transpile exact same JS for named leaves/consumers/retained ports; actual idempotency/nodes/control dynamic import; five erased runtime leaves exact empty/version namespace; actual server/bootstrap/control/phase1/test legacy source paths; existing legacy-entrypoints complete53/25/96 runtime export identity and full repo typecheck retain all current forwarding consumers Remaining: No missing assertion identified; exact-source execution still required. |
| 203 | covered | E170, E154, E265, E179 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Bounded 34-leaf inventory: eight real construction/callable bindings, one retained native RelayExecutionLedger interface, all 25 value/type forwarders. Exact uninstantiated canonical alias symbols preserve native family/generic/default declarations. Original production, Recovery, phase, fixture and test imports remain. Existing legacy-entrypoints.test.ts supplies all 25 value/runtime export identity checks; independent real construction suites cover the eight bindings. Source map coverage; exact-source Actions execution pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 204 | covered | E170, E244 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. independent fixed complete names across access/authorization/execution-adapter/forward-command/node-change; exact type-only source and final declaration Symbols, including all uninstantiated generic/default contracts three runtime Policy import type sources exact contracts/policy; old shared Policy resolves same declaration; DEFAULT_POLICY remains sole named value from shared for Ledger/Relay; EXECUTION_HOST_VERSION original execution-contracts leaf identity and only runtime export; emitted JS invariant after type-source poisoning Remaining: No missing assertion identified; exact-source execution still required. |
| 205 | covered | E153, E152, E170, E148, E190, E154, E265, E189, E191 | Covered: Host/Ledger same-Tx clocks/claims/retirement/publication and source merge, native Transit coordination/ports and legacy imports are exercised. Actual RuntimeController original state/status/codecs and all nine ledger callbacks with member receivers and original Forward arguments. Real Ledger policy copy, supplied-resource short circuit, default/native resource capacity, collector/authorization/native store/compiler/captured Date.now/randomUUID. Relay original providers/one ledger/fresh policy/false multihop, native stores/compiler, captured instance vs live static recovery Date.now and exact same-Tx quarantine SQL. Real Transit held coordination/staging versus per-call delivery/negotiation service/store/machine readers; held module-time reservations, late-default capacity source binding, eight original member callbacks/currentOnly and same transaction; original native lock SQL. Existing same-source Transit MySQL/coordination/negotiation/preparation suites retain current-only authorization, offline preview refusal, protected history/no slot release. Exact-source Actions execution pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 206 | covered | E170, E244, E271, E323 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. All99 application entries are accepted as assertion inventory: independent96 forwarding namespaces/type-star sets and the three exact MySQL reader consumers retain canonical alias identity; the management aggregate has its own version and exact native reader constructor identities. Actual original ControlApplication body now asserts every constructor group/default/native reader/resource/feature flag, deferred self and Relay callbacks, exact command delegates, same-owner receivers, and named six-argument request wrapper versus its native function identity/value/error behavior. Type-source suites retain original narrow type declarations, runtime emission and real phase/operator/fixture/test consumers; configured type/source/private graph checks remain execution obligations. Remaining: No missing assertion identified; exact-source execution still required. |
| 207 | covered | E170, E244 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. all57 type export occurrences in fixed complete nineteen-leaf list must be explicit named type-only exports from specified existing owner/public; each aliases exact same final declaration Symbol, not rebuilt structural lookalike; no expanded wildcard Control local Accepted still remote ForwardAccepted; direct Policy same old shared symbol; sole DEFAULT_POLICY import remains shared; Idempotency remains same value import/name; runtime emit byte-identical under changed erased source; existing legacy-entrypoints full explicit value/version/forwarding identity retained Remaining: No missing assertion identified; exact-source execution still required. |
| 208 | covered | E153, E152, E148, E177, E166, E159, E271, E309 | Covered: Direct hosts and original command/effect ports verify shared Tx and ordered callbacks; native composition and feature scopes are exercised by MySQL/browser scenarios. Actual ControlApplication production body is transpiled with test-owned import bindings, not reimplemented. Independently expected full initializer/constructor order, shared resources/Ledger/qualification stores, native readers, default/explicit policy and all four feature flags are checked. Deferred Relay and migration origin callbacks use late original receivers and supplied Tx. Four execution callbacks plus capacity select Path/direct owners correctly, retain failures and avoid later effects. Restoration reads Path before group and refuses unauthorized restoration, and sequential Node cleanup/capacity stops at each rejection. Existing command owner tests provide same-transaction rollback assertions. No named composition root exempts private source imports; whole-graph checks remain intact. Remaining: No missing assertion identified; exact-source execution still required. |
| 209 | partial | E381, E322, E170 | Covered: Actual classified source/type/private/native graph plus negative import mutations and canonical/legacy entrypoint loading are checked. Remaining: Those checks do not replace behavioral acceptance for all product owners or certify undeclared external/reflection consumers. |
| 210 | partial | E153, E152, E372, E370, E363, E177 | Covered: Raw/status host separation, task drain/backoff/allSettled, one supplied transaction, resources/ledger and ordered original recovery owners are directly asserted. Remaining: Full server preflight/partial-start/native dependency-close, all class prototype/override/static/lazy and real SQL fault sequences remain bounded. |
| 211 | covered | E210, E222, E213, E214, E360, E323 | Covered: Sender accepts common CancellationSignal without EventTarget members, preserves original reason and exact once callback identity/removal when cancellation races registration; no DNS starts. Native abort while DNS/guard outstanding returns rejected early but capacity/close remain held until actual callback settles, including late guard rejection. HTTPS request errors classified unknown rather than rejected, without retry. Native AbortSignal object/reason identity crosses both lower public ports and sender rejects pre-aborted attempts before dispatch. Minimal common provider without EventTarget extras is accepted for pre-admission refusal. Common signal adapter asserts exact callback identity and once option then removes it after normal/interrupted reads. Cancellation while query blocks destroys transport without dirty release/rollback; pool acquisition after abort destroys the acquired connection; failed rollback destroys instead of releasing. Version1 minimal CancellationSignal and version2 observation/sender ports retain native signal substitution, exact minimal key set without native EventTarget assignability, object/reason/throw identity and original once subscription/removal callbacks. Native and common already-cancelled signals and registration races are asserted for sender and dedicated observation connections. Observation pool wait and owned read cancellation destroy only the acquired connection and hold host admission until real completion. Sender admission, DNS, pending guard, active request and partial-response cancellation retain rejected-before-dispatch versus unknown-after-request classification. New request/response cases destroy each owned response/request/socket, hold capacity and close until both actual close events, reject late response effects and prevent old duplicate close callbacks releasing another attempt. Literal payload/HMAC/pinned-address/response-limit and end/error/aborted/incomplete/HTTP classifications are asserted without retry or redirect. Lower declarations retain existing boundary enforcement. Remaining: No missing assertion identified; exact-source execution still required. |
| 212 | covered | E330, E308, E326, E332, E297, E244, E324 | Covered: Complete native schema/catalog closure and failure semantics, exact generated and separate handwritten roles, fixtures/lock/sum/SQL/manifests/embed/COPY and retained phase/manual/ops/example inputs are explicitly asserted; recursive current source graph forbids missing/private/unclassified consumers and source replacement leaves retain public alias identity. Real Web route bytes/security and staged public package imports use the actual source distribution. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: No missing assertion identified; exact-source execution still required. |
| 213 | covered | E342, E308, E344, E322, E338, E341, E352, E349, E324, E346, E345, E339, E347, E343 | Covered: Existing canonical public request/model, recursive VM owner flows, recursive production syntax/routes/consumer/graph assertions and native main callback closure cover this consolidation row; independent real-browser layout is not an added obligation. Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: No missing assertion identified; exact-source execution still required. |
| 214 | covered | E325, E313, E361, E362, E363, E336, E326, E244, E354, E355, E364, E365 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Known migration catalog asserts 37 files through0037 and partial-table/migration history refusal, schema reader ceilings and downgrade gates. Source assertions follow real CLI/public command/native inspector paths, require consistent snapshot READ ONLY/rollback/final end and keep separate MySQL Actions command. Injected assessment dispatch forbids Authority construction/mutations, checks exact args and decision exit0/2/1; inspection error suppresses credential text and returns bounded public refusal report. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Known migration catalog asserts 37 files through0037 and partial-table/migration history refusal, schema reader ceilings and downgrade gates. Source assertions follow real CLI/public command/native inspector paths, require consistent snapshot READ ONLY/rollback/final end and keep separate MySQL Actions command. Injected assessment dispatch forbids Authority construction/mutations, checks exact args and decision exit0/2/1; inspection error suppresses credential text and returns bounded public refusal report. Public preview-only example authorization/error/immutable/log/drain assertions, native bootstrap failure/finally ordering, read-only upgrade inspection, RecoveryWorkflow injected transaction/quarantine/commit-before-rebind/close cases, native consumer/package/embed/COPY/phase/manual/ops inventory are mapped. Source consumer existence does not itself assert native process and filesystem effects. Existing preview-only example auth/error/immutable/log/drain, bootstrap exact native ordering/finally errors and read-only upgrade assessment remain. Current Core source closure explicitly retains all example/ops/phase/manual/fixtures/container inputs and actual build COPY/embed consumers; actual native Recovery adapters now assert dump/restore process, direct exclusive durable target write/sync/close/POSIX-directory-sync and protected-directory behavior, alongside same-transaction Recovery ordering and actual operator composition. These assertions supply the previously named native operator gaps. Independent Responder publication, physical hosts and live Echo remain separate execution/release gates, not additional missing source assertions for this item. Remaining: No missing assertion identified; exact-source execution still required. |
| 215 | partial | E56, E57, E25, E14, E90, E30, E69, E58, E59, E62, E60, E61, E136, E84 | Covered: This owner closes alias/default/zero/nil/private fixture, fixed HostVersion1 vocabulary, runtime.GOOS and representative metadata/actual platform/feature refusal clauses. Named-source crossmap below joins existing per-owner assertions; it deliberately does not invent another all-leaf suite. Whole215 cannot be called covered while other named bootstrap/channel/observation/identity/CLI/codec owner clauses remain partial. Remaining: Complete the remaining actual leaf-owner assertion groups already listed in Agent49 strict audit (bootstrap/channel/identity/observation/native wire+CLI/Transit); this cross-item inventory is not satisfied by only constructor/Registry tests. Do not add a second closure test suite or count pending Actions/physical gates as missing assertions. |
| 216 | covered | E139, E3, E2, E140, E141, E142 | Covered: Exact original requirement: For FR-0023 accept executiontime2 tagless parsed facts and platformclock2 SyncStatus/SynchronizationFacts, old authorization native aliases and exact proof JSON field/order/MAC/provider errors. Direct lower native literals or serializers must migrate explicitly; no native tag/parser fallback in L1. Both interface versions2, canonical native/lower named owner identity, every lower field/order/type/no-tag and every native field/order/type/tag explicitly asserted Old Sample/Clock/SyncStatus/ProofOptions exact reflect identity; public native proof/synchronization function signatures compile checked Lower direct JSON literal golden intentionally differs from native serialization; invalid native timestamp produces invalid facts rather than adapter rejection Proof literal payload and full envelope byte equality with independently computed SHA256 HMAC; native read roundtrip; zero/31/33-byte write keys refuse before existing proof changes; missing/short read keys exact errors Missing proof native os.PathError and ErrNotExist survive ReadProof and proof-selected SynchronizedClock wrapped provider error; configured proof selection proven by exact missing path Existing tests retain native SyncStatus exact golden JSON, valid/invalid projection, Windows text parser refusal, proof forged MAC/unknown fields/stale evidence and host/platform refusal Current explicit adaptation source is inspected; no hypothetical external literal/serializer consumer treated as a current gap. Root current-source compiler/boundary inventory remains execution evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 217 | covered | E3, E4, E139, E143, E8 | Covered: FR0023 parse-at-Evidence frequency: native text change is not reparsed before2s,exact refresh reparses invalid fact,uptime rollback reparses again,failed refresh error precedes second sample and does not commit cache timestamp,retry reparses. Both Linux/Windows native fact forms with invalid timestamp plus wrong host/source assert Sample->Evidence/parse->Sample->Host->Source->validation first-error order. Actual authenticated proof invalid timestamp with wrong host/source repeats the same old native wrapper precedence. Existing before/evidence/after error identity traces,blocked second sample,cache boundaries,30s future/stale/error500ppm edges and custom opaque lower fact sources retained; native parser returns invalid facts without early returned error. Actual current GOOS native provider choice: Linux source/host/native status query;Windows deliberately missing w32tm under test-only SystemRoot proves OS default error path; valid explicit proof then succeeds despite unavailable OS executable,missing proof never falls back. Unsupported platform branch checks exact native provider and suspend-aware sample refusal. Tests must execute on the corresponding OS Actions jobs; no same-host claim substitutes for physical gate. Remaining: No missing assertion identified; exact-source execution still required. |
| 218 | covered | E24, E106 | Covered: TestCredentialRecordCompleteLayoutAndEightProjections: both InterfaceVersion=2; native/lower owner PkgPath and distinct type identity; all four shapes and eight projections, per-field zero/nonzero inputs in both directions TestCredentialRecordCompleteLayoutAndEightProjections: independent pre-extraction layouts compare field count/name/order/type/tag; private aliases retain native identity; each field native serialization compared byte-for-byte to legacy layout; pointer identity in both projection directions, nil preservation TestRelayRecordOptionalFieldsAreIndependent: four independent omitempty combinations TestNativeCredentialRecordsKeepEncodingAndFacts: literal golden native JSON for all four records; nonnil and nil overlap JSON; full optional record JSON TestNativeProviderPersistsCredentialFactsUsingNativeRecords: SaveMachine literal bytes and protected SaveRelay snapshot bytes equal canonical native JSON TestCredentialRecordCompleteLayoutAndEightProjections: all four lower record fields have empty tags; all lower direct zero/per-field JSON encodings differ from native encoding; canonical native and lower PkgPath names and distinct named types pinned TestNativeCredentialRecordsKeepEncodingAndFacts: lower CredentialBundle JSON does not contain native lowercase properties Remaining: No missing assertion identified; exact-source execution still required. |
| 219 | covered | E24, E22, E23, E41, E28, E144 | Covered: TestPendingResponseCompletePermissiveMachineVersusStrictNativeRecords uses real Native.ValidateMachineRotation, PrepareRotation and LoadMachine: unknown response/pending/bundle fields accepted on original machine paths, duplicate and typed/incomplete persisted request rejected without rewrite; DecodeProtected typed equivalents refuse unknown while map destination remains permissive by native JSON semantics. TestPendingResponseCompleteProtectedOuterInnerAndMACErrors uses real Native.LoadRelay and independently HMAC-signed native envelopes: valid and unknown outer envelope fields retained, duplicate outer/bad JSON/bad key/MAC/unknown or duplicate inner/native envelope generation,digest,fences,retired refused; every existing-file error has missing=false and original bytes unchanged. Initial absent file with invalid key still reports missing=true and ErrNotExist before key validation. TestPendingResponseCompleteProtectedDecoderErrorMutationAndNativeMissingClassification pins strict first Parse preventing duplicate/syntax mutation, decoder partial mutation on unknown/type errors, exact unchanged input bytes, pending directory errors versus initial missing and Remove ignoreMissing semantics. AST of real Native.loadRelay pins state.Load second-read error returns false and original err; no production hook or nondeterministic filesystem race used. TestPendingResponseCompleteInitialMissingAndLaterStoreError injects missing=true versus false with the same wrapped ErrNotExist through the public provider port; only initial missing reaches online prepare; later missing-shaped store error retains identity and never issues. TestPendingResponseCompleteMachineDurableRetryAndPublication and RelaySaveRemoveAndCrashRecovery preserve identical actual persisted ID/CSR/key and online body through failures, atomic bundle bytes and no private key on wire. NativeResponse projection test pins original response/bundle and renewal value immutability. Existing time_owner_complete_test.go load/schedule/history/one-retry/overlap tests and relay_credentials_test.go existing certificate-purpose/pins/effective-expiry/expired protected-history/online-recovery tests retain coverage; no duplicate clock or protected-authority implementation introduced. TestPendingResponseCompleteMachineDurableRetryAndPublication wraps the real Native provider and injects prepare/I-O/validation/save/reload/remove failure: original error identity, pending survives every failed stage, durable bundle exists only after successful save, machine publishes only after reload, identical request replays succeed and remove pending after reload. Actual Runner Journal sentinel/maps remain unchanged. TestPendingResponseCompleteRelaySaveRemoveAndCrashRecovery proves original relay identity remains current on SaveRelay or Remove failure; saved MAC bundle survives successful save plus failed remove. ensureRelayCredential loads that exact durable bundle, publishes and cleans matching crash request with no further online issue. Save failure retry uses identical original request and only publishes after save/remove. TestPendingResponseCompleteRetainedPendingCleanupAndPublicationFailures exercises actual protected valid bundle plus matching, mismatched, absent requestId, unknown or duplicate pending, initial missing, read and remove failure. Retained identity publication precedes original pending cleanup errors, only matching pending is removed; mismatch/error bytes remain; no online requests and no Journal edits. Native helper projection/renewal test confirms exact original field selection, key inclusion only in durable bundle, prefix behavior, UTC renewal formatting and unchanged caller values. Existing time_owner Machine Guard/publication and Relay overlap/history tests retain original Guard/credential authorities. Remaining: No missing assertion identified; exact-source execution still required. |
| 220 | partial | E355, E354, E325, E381 | Covered: Save complete candidate then run all applicable exact-source Actions, retain per-item covered/partial/gap and independent physical/long-run/release gates; public example and complete compiled consumers are included. Remaining: Full B acceptance remains closed while any listed requirement lacks complete assertions or applicable exact-source execution. |

## Assertion Anchors

Test titles identify actual tests, not a promise that every nearby requirement is
covered. Scripts/configuration have scenario or command anchors rather than test
titles. Port fakes prove observable ordering/error behavior; real-MySQL suites
provide their separately asserted transactional behavior.

### E1: agent/internal/authorization/guard_test.go

[Source](../../agent/internal/authorization/guard_test.go)

- TestSuspendAndExpiryCannotRenewOldTicket
- TestRollbackJumpAndClockFailureLatchClosed
- TestCredentialAndDrainRespectEarliestCutoff
- TestServerSkewAndInvalidLeaseAreRejected
- TestSystemClockHasForwardUptime

### E2: agent/internal/authorization/synchronization_test.go

[Source](../../agent/internal/authorization/synchronization_test.go)

- TestWindowsSynchronizationUsesErrorBoundAndServiceState
- TestSyncProofRejectsForgeryUnknownFieldsAndStaleEvidence
- TestProofKeyStaysOutsideWritableBoundaries
- TestUnsynchronizedProofCannotInitializeGuard
- TestSynchronizationProofMustBelongToSameHostAndPlatform

### E3: agent/internal/executiontime/synchronization_test.go

[Source](../../agent/internal/executiontime/synchronization_test.go)

- TestSynchronizationMissingProvidersDoNotSample
- TestSynchronizationSampleHostSourceAndInvalidEvidenceOrder
- TestSynchronizationCachesUntilTwoSecondsAndRefreshesRollback
- TestSynchronizationFreshnessAndHoldoverEdges

### E4: agent/internal/executiontime/synchronization_failure_order_test.go

[Source](../../agent/internal/executiontime/synchronization_failure_order_test.go)

- TestSynchronizationProviderFailurePrecedence
- TestSynchronizationBlockedEvidenceUsesSecondSample
- TestSynchronizationFutureAndNegativeErrorBounds

### E5: agent/internal/authorization/guard_compatibility_test.go

[Source](../../agent/internal/authorization/guard_compatibility_test.go)

- TestLegacyGuardClockReplacementReachesEveryMethodAndExistingTicket
- TestLegacyClockFailureLatchPrecedesReplacementClockAndNewParameters
- TestLegacyGuardConstructorRefusesInvalidOptionsBeforeClockAndPreservesReadError
- TestLegacyNilTicketAllowKeepsLowerRefusal

### E6: agent/internal/executiontime/guard_complete_test.go

[Source](../../agent/internal/executiontime/guard_complete_test.go)

- TestGuardCompleteDeadlineBoundariesAndUptimeRollback
- TestGuardCompleteSkewEdgesInvalidSamplesAndSuspendDelta

### E7: agent/internal/platformclock/clock_native_complete_test.go

[Source](../../agent/internal/platformclock/clock_native_complete_test.go)

- TestClockCompleteActualNativeSampleBracketAndUnsupported

### E8: agent/internal/authorization/provider_selection_complete_test.go

[Source](../../agent/internal/authorization/provider_selection_complete_test.go)

- TestSynchronizationCompleteActualProviderSelection
- TestSynchronizationCompleteWindowsHostileStatusFields

### E9: agent/internal/platformclock/clock_linux.go

[Source](../../agent/internal/platformclock/clock_linux.go)

See the source scenario assertions or configured command steps.

### E10: agent/internal/platformclock/clock_windows.go

[Source](../../agent/internal/platformclock/clock_windows.go)

See the source scenario assertions or configured command steps.

### E11: agent/internal/executionstate/runtime_acceptance_order_test.go

[Source](../../agent/internal/executionstate/runtime_acceptance_order_test.go)

- TestRuntimeProviderOrderingAndRawAuthority
- TestRuntimeRefusalStagesAndNoNewAuthority
- TestRuntimeWithdrawalTombstoneMaximumAndNilProviders
- TestRuntimeEveryImmutableFieldRefusesWithoutSaving

### E12: agent/internal/state/adp3_journal_test.go

[Source](../../agent/internal/state/adp3_journal_test.go)

- TestRuntimeJournalPersistsPhysicalTCPForUDPAndRefusesHistoryReset
- TestRuntimeJournalInvalidJSONUsesStableIntegrityCode
- TestRuntimeJournalWriteFailureDoesNotAdvanceCallerHighWater
- TestRuntimeJournalCannotReinitializeOrUseCorruptState

### E13: agent/internal/state/adp3_transit_journal_test.go

[Source](../../agent/internal/state/adp3_transit_journal_test.go)

- TestTransitJournalPersistenceRetirementAndReplay
- TestTransitJournalFailsClosedOnCorruptDurableFile

### E14: agent/internal/control/runner_test.go

[Source](../../agent/internal/control/runner_test.go)

- TestSnapshotRenewalAndPersistenceBeforeBind

### E15: agent/internal/executionstate/persistence_outcome_complete_test.go

[Source](../../agent/internal/executionstate/persistence_outcome_complete_test.go)

- TestRuntimeCompleteUnknownPersistenceOutcomeCannotReturnNewAuthorityOrTrustStaleCaller
- TestRuntimeCompleteHistoryRefusalShortCircuitsAndInitialDecodeIsLazy

### E16: agent/internal/state/runtime_history_complete_test.go

[Source](../../agent/internal/state/runtime_history_complete_test.go)

- TestRuntimeCompleteNativeHistoryProjectionEveryComparedField
- TestRuntimeCompletePublicProviderMethodSets

### E17: agent/internal/platformstate/atomic_write_test.go

[Source](../../agent/internal/platformstate/atomic_write_test.go)

- TestAtomicWriteReplacesBytesAndLeavesNoTemporaryFiles
- TestAtomicWriteFailedRenameCleansTempAndPreservesProtectedTarget

### E18: agent/internal/state/lock_test.go

[Source](../../agent/internal/state/lock_test.go)

- TestExclusiveInstance

### E19: agent/internal/state/inspect_test.go

[Source](../../agent/internal/state/inspect_test.go)

- TestJournalInspectionDoesNotWriteOrMigrate
- TestJournalInspectionRejectsTamperingIdentityAndMissingState
- TestJournalInspectionRetainsImportedPhysicalHighWater

### E20: agent/internal/state/multihop_journal_test.go

[Source](../../agent/internal/state/multihop_journal_test.go)

- TestExecutionMigrationIsExplicitAndRetainsImportedHighWater
- TestMultihopJournalRequiresMigrationAndRejectsCrossRoleOwnerAtSameFence

### E21: agent/internal/platformstate/atomic_effects_complete_test.go

[Source](../../agent/internal/platformstate/atomic_effects_complete_test.go)

- TestAtomicWriteCompleteSourceEffectsAndUnsupportedLock
- TestEffects
- TestUnsupportedLockHasNoRelease

### E22: agent/internal/control/credentials_test.go

[Source](../../agent/internal/control/credentials_test.go)

- TestRotationRequestSurvivesRetryWithoutNewKeyOrCSR
- TestCorruptAtomicCredentialBundleNeverFallsBack

### E23: agent/internal/control/relay_credentials_test.go

[Source](../../agent/internal/control/relay_credentials_test.go)

- TestRelayCredentialPersistsRetryAndRejectsCorruptStoredBundle
- TestRelayCredentialChecksNodePurposeKeyPinsAndEffectiveExpiry
- TestRelayRenewalPreservesOldIdentityUntilDurableRetryAndCleansCrashRequest
- TestExpiredProtectedRelayBundleRequiresFreshOnlineAuthority
- TestRelayExpiredIssuanceReplayCannotTrapOnlineRecovery

### E24: agent/internal/agentidentity/records_test.go

[Source](../../agent/internal/agentidentity/records_test.go)

- TestNativeCredentialRecordsKeepEncodingAndFacts
- TestNativeProviderPersistsCredentialFactsUsingNativeRecords

### E25: agent/internal/control/platform_contract_test.go

[Source](../../agent/internal/control/platform_contract_test.go)

- TestExplicitProviderConstructorsRejectMissingBeforeBootstrap

### E26: agent/internal/control/identity_channel_complete_test.go

[Source](../../agent/internal/control/identity_channel_complete_test.go)

- TestIdentityChannelOwnerCompleteRunnerRequestSingleProjectionAndErrorIdentity
- TestIdentityChannelOwnerCompleteSaveReloadProbeInvalidationGuardIdleCleanup
- TestIdentityChannelOwnerCompleteHelloBackoffCapAndOriginalFatalRefusal

### E27: agent/internal/controlchannel/identity_channel_complete_test.go

[Source](../../agent/internal/controlchannel/identity_channel_complete_test.go)

- TestIdentityChannelCompleteNativeClientPolicyAndLiveCertificateCallback
- TestIdentityChannelCompleteRequestHeadersBoundsCloseAndErrors
- TestIdentityChannelCompleteRedirectNeverRetriesAndCancellationCloses
- TestIdentityChannelCompleteRealTLSUsesConfiguredTrustAndRotatingCertificate

### E28: agent/internal/control/pending_response_complete_test.go

[Source](../../agent/internal/control/pending_response_complete_test.go)

- TestPendingResponseCompleteMachineDurableRetryAndPublication
- TestPendingResponseCompleteRelaySaveRemoveAndCrashRecovery
- TestPendingResponseCompleteInitialMissingAndLaterStoreError
- TestPendingResponseCompleteProtectedOuterInnerAndMACErrors
- TestPendingResponseCompletePermissiveMachineVersusStrictNativeRecords
- TestPendingResponseCompleteRetainedPendingCleanupAndPublicationFailures
- TestPendingResponseCompleteProtectedDecoderErrorMutationAndNativeMissingClassification

### E29: agent/internal/control/time_owner_complete_test.go

[Source](../../agent/internal/control/time_owner_complete_test.go)

- TestRelayTimeOwnerCompleteLoadScheduleAndExpiredHistory
- TestRelayTimeOwnerCompleteRetainedPublicationAndPendingCleanup
- TestRelayTimeOwnerCompleteRetryFlagAndHistoricalFailureStages
- TestRelayTimeOwnerCompleteOverlapBoundsAndDurablePublication
- TestRunnerTimeOwnerCompleteHelloIdentityGuardDiagnosticsAndParse
- TestRunnerTimeOwnerCompletePollObservedAtDrainRemainingAndAck
- TestRunnerTimeOwnerCompleteMachineRotationReloadAndPublication
- TestRunnerTimeOwnerCompleteSnapshotIdentityHistoryBeforeSamplingAndRawValidity
- TestRunnerTimeOwnerCompleteBeginDrainCutoffAndDuplicate
- TestRelayTimeOwnerCompleteIdentityRenewalShortCircuits
- TestRunnerTimeOwnerCompleteAckRefusalRetainsPendingAndDrains
- TestRelayTimeOwnerCompleteExpiryReparseBeforeRetryShortCircuit

### E30: agent/internal/control/transit_runner_test.go

[Source](../../agent/internal/control/transit_runner_test.go)

- TestTransitRunnerOfflinePersistBeforeEngineAndNoReplay
- TestTransitRunnerBridgeRejectsUnnegotiatedLeaseAndLegacyPhysicalPort

### E31: agent/internal/agentcommand/command_run_lifecycle_test.go

[Source](../../agent/internal/agentcommand/command_run_lifecycle_test.go)

- TestCommandRunReleaseAndConstructionBeforeSignals
- TestInspectionAllowsRelayAndPairedTimeProof

### E32: agent/internal/control/bootstrap_owner_complete_test.go

[Source](../../agent/internal/control/bootstrap_owner_complete_test.go)

- TestBootstrapOwnerCompleteOrderedSuccessAndEveryFailure
- TestBootstrapOwnerCompleteFlagsAndURLRefuseBeforeAnyEffect
- TestBootstrapOwnerCompleteNativeKeyAndRootRefusal
- TestBootstrapOwnerCompleteActualDefaultConstructorsAndMissingCorruptHistory
- TestBootstrapOwnerCompleteOriginalNativeProjectionOnceOnSuccessAndError
- TestActualNativeProjection

### E33: agent/internal/control/telemetry_exporter_complete_test.go

[Source](../../agent/internal/control/telemetry_exporter_complete_test.go)

- TestTelemetryCompleteFourIndependentEpochsAndEntropyFailure
- TestTelemetryCompleteBlockedHostCutoffNoOverlapAndLateDrain

### E34: agent/internal/control/diagnostics_shutdown_complete_test.go

[Source](../../agent/internal/control/diagnostics_shutdown_complete_test.go)

- TestDiagnosticsCompletePeriodicWarningArgumentsAndFinalAfterExecutionShutdown

### E35: agent/internal/control/probe_wire_owner_complete_test.go

[Source](../../agent/internal/control/probe_wire_owner_complete_test.go)

- TestProbeWireOwnerCompleteDeliveryBoundsErrorsAndDeferredClose
- TestProbeWireOwnerCompleteInvalidLargePathAndRequestBeforeProvider
- TestProbeWireOwnerCompleteInstanceParseCheckBeforeCancellation
- TestProbeWireOwnerCompleteLegacyClaimLateCancellationAndCloseAfterUnlock
- TestProbeWireOwnerCompleteThreeQualificationAndPollCallsites
- TestProbeWireOwnerCompleteClaimStatusAndAllResultDispatch
- TestProbeWireOwnerCompleteNativeCallsiteEncodingParsingAndDispatchOrder
- TestProbeWireOwnerCompleteServiceContextTLSValidationAndNowStage
- TestProbeWireOwnerCompleteEchoProofNativeFieldsAndRefusals
- TestProbeWireOwnerCompleteTypedFirstRefusalsAndEchoTargetSampleBoundary

### E36: agent/internal/platformruntime/schedule_owner_complete_test.go

[Source](../../agent/internal/platformruntime/schedule_owner_complete_test.go)

- TestScheduleOwnerCompleteNativeTimersAndReadDomain
- TestScheduleOwnerCompleteNativeContextDeadlineAndAfterFunc

### E37: agent/internal/control/scheduling_owner_complete_test.go

[Source](../../agent/internal/control/scheduling_owner_complete_test.go)

- TestSchedulingOwnerCompleteOriginalRunAndProbeLoops
- TestRunOriginalHelloBackoffFatalAndEarlyFailures
- TestRunOriginalCredentialRenewalRetryReportAndRetirement
- TestRunOriginalWorkersCancelAndJoinBeforeReturning
- TestRunOriginalRetirementCancelsRegistrationBeforeExecution
- TestProbeOriginalRegistrationBackoffResetSessionEndAndCleanup
- TestProbeOriginalExecutionOneSecondPostCompletionNoOverlap
- TestProbeOriginalMonitorDeadlineTicksAndDeferredCloseOrder
- TestProbeOriginalSupervisorExactDeadlineRefreshChangedAndTicker
- TestProbeOriginalWatchFortyPostCompletionPollsAndReleaseJoin

### E38: agent/internal/control/probe_claim_test.go

[Source](../../agent/internal/control/probe_claim_test.go)

- TestProbeClaimReceiptChecksHostBindingWithoutExecutionOrJournalMutation
- TestProbeClaimRejectsEveryForeignBindingAndBurnsFailedClaims
- TestProbeClaimRechecksLocalAuthorityAfterRemoteWork
- TestProbeClaimUncertainHTTPOutcomesRemainBurnedWithoutRedirectOrRetry
- TestProbeClaimConcurrentBurnCapacityAndPreflight

### E39: agent/internal/control/probe_delivery_test.go

[Source](../../agent/internal/control/probe_delivery_test.go)

- TestProbeDeliveryPollBoundedEmptyAndCurrentOffers
- TestProbeDeliveryPollRejectsForeignStaleAndBurnedOffers
- TestProbeDeliveryStatusMatchesReceiptAndCannotRestart
- TestProbeDeliveryStatusRejectsEveryChangedBindingAndOriginalReceiptField
- TestProbeDeliveryWithdrawalStopsWithoutRetryOrResurrection
- TestProbeDeliveryLocalRevocationAndCancellationCloseWatch
- TestProbeDeliveryFreshnessAndImmutableDeadlineNeverRenewFromReceiptTime
- TestProbeDeliveryBudgetBoundsAndPollCooldownSurviveRotation
- TestProbeDeliveryCancelledTransportRetainsSlotUntilDrainAndLateSuccessCannotRevive
- TestProbeDeliveryPreflightRejectsForgedReceiptAndInvalidLocalAuthorityWithoutIO
- TestProbeDeliveryPollHTTPFailureAndCancellationNeverRetry

### E40: agent/internal/control/probe_workflow_test.go

[Source](../../agent/internal/control/probe_workflow_test.go)

- TestProbeWorkflowRequiresSeparateExplicitOptIns
- TestProbeWorkflowPollClaimWatchConnectAndReportOnce
- TestProbeWorkflowUncertainClaimNeverExecutesOrReclaims
- TestProbeWorkflowInitialWithdrawalPreventsAllSocketWork
- TestProbeWorkflowReportAttemptBurnsBeforeLostOrInvalidAcknowledgement
- TestProbeWorkflowCancellationDrainsReportAndWatchBeforeReturning

### E41: agent/internal/nativeexecution/probe_wire_boundaries_test.go

[Source](../../agent/internal/nativeexecution/probe_wire_boundaries_test.go)

- TestProbeBoundedBodyAndReaderError
- TestProbeEntropyKeepsOne32ByteReadAndShortCount
- TestNativeWireTimesAndRelayScheduleFirstError
- TestCredentialRotationNeverEncodesPrivateKey

### E42: agent/internal/platformobservation/host_linux_complete_test.go

[Source](../../agent/internal/platformobservation/host_linux_complete_test.go)

- TestHostLinuxCompleteBoundedSource
- TestHostLinuxCompleteNumericParsingAndOverflow

### E43: agent/internal/platformobservation/native_owner_complete_test.go

[Source](../../agent/internal/platformobservation/native_owner_complete_test.go)

- TestObservationCompleteGenericMethodSetAndNativeBinding
- TestObservationCompleteEveryHostNativeFieldAndLowerTag
- TestObservationCompleteActualNativeResources

### E44: agent/internal/platformobservation/host_sources_complete_test.go

[Source](../../agent/internal/platformobservation/host_sources_complete_test.go)

- TestHostCompleteCurrentLinuxSourceEffects
- TestCPUOriginalParserBranches
- TestMemoryOriginalParserBranches
- TestLoadOriginalParserBranches
- TestNetworkOriginalParserSortTruncateAndRefusal
- TestFilesystemOriginalValuesAndFailure
- TestOriginalSourceLimitsAndCaptureOrder

### E45: agent/internal/controlchannel/telemetry_pool_complete_test.go

[Source](../../agent/internal/controlchannel/telemetry_pool_complete_test.go)

- TestTelemetryCompleteFourNativePools
- TestTelemetryCompleteNativeRequestAndCallerBodyOwnership

### E46: agent/internal/control/telemetry_sender_complete_test.go

[Source](../../agent/internal/control/telemetry_sender_complete_test.go)

- TestTelemetryCompleteFourSenderResponseOrder
- TestTelemetryCompleteEncodeFailurePrecedesTimeoutAndPost

### E47: agent/internal/control/observation_reads_complete_test.go

[Source](../../agent/internal/control/observation_reads_complete_test.go)

- TestObservationCompleteOriginalReadOrderAndRunnerLockScope
- TestObservationCompleteDisabledAndDefaultWrappers

### E48: agent/internal/control/telemetry_cadence_complete_test.go

[Source](../../agent/internal/control/telemetry_cadence_complete_test.go)

- TestTelemetryCompleteFailuresDropUntilNextTickWithoutRetryQueue

### E49: agent/internal/control/host_sample_complete_test.go

[Source](../../agent/internal/control/host_sample_complete_test.go)

- TestHostCompleteNativeCaptureKeepsResourcesAndOnlyReadsNowPlatform
- TestHostCompleteResultExactlyAtCutoffIsDroppedBeforeCaptureSend

### E50: agent/internal/control/telemetry_sequence_complete_test.go

[Source](../../agent/internal/control/telemetry_sequence_complete_test.go)

- TestTelemetryCompleteOriginalExporterSequenceExhaustion
- TestOriginalFourSequenceBounds

### E51: agent/internal/platformruntime/local_measurement_complete_test.go

[Source](../../agent/internal/platformruntime/local_measurement_complete_test.go)

- TestLocalMeasurementCompleteConfiguredSiblingModesAndFailure
- TestLocalMeasurementCompleteWarningUsesOriginalStderrArguments

### E52: agent/internal/nativeexecution/udp_diagnostics_complete_test.go

[Source](../../agent/internal/nativeexecution/udp_diagnostics_complete_test.go)

- TestUDPDiagnosticsCompleteExactNativeTypeAndNilBehavior

### E53: agent/internal/nativeexecution/udp_diagnostics_effects_complete_test.go

[Source](../../agent/internal/nativeexecution/udp_diagnostics_effects_complete_test.go)

- TestUDPDiagnosticsCompleteOriginalStatsReadAndProjectionEffects
- TestOriginalStatsAndIgnoredActiveSessions

### E54: agent/internal/control/diagnostics_test.go

[Source](../../agent/internal/control/diagnostics_test.go)

- TestDiagnosticsIsAggregateLocalDataAndDoesNotReplaceAuthority

### E55: agent/internal/control/probe_execution_test.go

[Source](../../agent/internal/control/probe_execution_test.go)

- TestProbeExecutionOneUseConnectOnlyReportAndNoProtectedWrites
- TestProbeExecutionConcurrentReceiptOnlyOpensOneConnection
- TestProbeExecutionRequiresOriginalReceiptAndFreshInitialStatus
- TestProbeExecutionBusyAdmissionAndSocketCooldownNeverRefundReceipt
- TestProbeExecutionRevocationCancellationAndTimeoutDiscardInFlightWork
- TestProbeExecutionLateTransportKeepsAdmissionUntilDrainAndNeverReports
- TestProbeExecutionReportRequiresLiveAuthorityAndCannotRenewMeasurement
- TestProbeExecutionSerializationConservativeClockMappingRoundingAndBounds
- TestProbeExecutionSerializationRejectsUncertainAlteredAndExpiredEvidence

### E56: agent/internal/control/execution_drivers_test.go

[Source](../../agent/internal/control/execution_drivers_test.go)

- TestExecutionRegistryDeclarations
- TestExecutionRegistrySelection
- TestExecutionRegistryCapabilities
- TestExecutionDriverFactoryBoundaries
- TestExecutionDriverReplacementBoundary
- TestExecutionDriverAuthorizationContract
- TestExecutionDriverErrorAndPolicyContract

### E57: agent/internal/control/execution_catalog_test.go

[Source](../../agent/internal/control/execution_catalog_test.go)

- TestExecutionCatalogMatchesBuiltins

### E58: agent/internal/forward/tcp_lifecycle_test.go

[Source](../../agent/internal/forward/tcp_lifecycle_test.go)

- TestTCPSamePortReplacePreservesStreamsAndOwnership
- TestTCPDrainStopsAcceptingAndPreservesExistingStreams
- TestTCPReplacementKeepsConnectionBudgetAcrossInstances
- TestTCPReplaceValidationKeepsCurrentListener
- TestTCPConnectionConfigIsImmutable
- TestTCPFailedDialReclaimsStreamBudget
- TestTCPConcurrentAcceptReplaceDrainAndClose
- TestTCPConcurrentReplacementsHaveOneListenerOwner
- TestTCPFullCloseReleasesEveryGeneration
- TestTCPDrainCompletesAfterPeerClosure
- TestTCPNodeConnectionLimitIsSharedAcrossIndependentListeners
- TestTCPNodeConnectionLimitIncludesOldDrainingGenerations
- TestTCPNodePermitReleasedAfterFailedDial

### E59: agent/internal/forward/udp_test.go

[Source](../../agent/internal/forward/udp_test.go)

- TestUDPMultipleClientRepliesStayIsolated
- TestUDPIdleExpiryReclaimsAssociation
- TestUDPCanceledAssociationIsNotReusedForNextDatagram
- TestUDPNewAuthorizationAfterIdleReclaimsClientPort
- TestUDPCapacityDropPreservesExistingClient
- TestUDPNewAssociationsCheckResolvedTargetPolicy
- TestUDPOversizedDatagramsAreNotTruncatedAndForwarded
- TestUDPConnectedUpstreamRejectsDifferentPeer
- TestUDPReplacementResetsOldAssociationsAndKeepsListener
- TestUDPDrainClosesAllSessionsAndReleasesBinding
- TestUDPReplyAmplificationIsBounded
- TestUDPZeroLengthDatagramsArePreserved
- TestUDPCloseCancelsPendingDNSAndReclaimsSession
- TestUDPInvalidResourcesRejectedAndPolicyMaximumBounded
- TestUDPSharedNodeBudgetAppliesAcrossBindingsAndIsReturned
- TestUDPIPv6TargetWithIPv4Client
- TestUDPTargetMetadataOverrideStillRequiresCIDRAndOrdinaryIP

### E60: agent/internal/executionhost/registry_complete_test.go

[Source](../../agent/internal/executionhost/registry_complete_test.go)

- TestExecutionHostCompletePublicBindingsFieldsAndZeroRegistry
- TestExecutionHostCompleteBoundedDeclarationsFirstErrorsAndDetachedSlices

### E61: agent/internal/executiondriver/registry_complete_test.go

[Source](../../agent/internal/executiondriver/registry_complete_test.go)

- TestExecutionDriverCompletePublicNativeAliasesAndZeroBinding

### E62: agent/internal/control/execution_registry_complete_test.go

[Source](../../agent/internal/control/execution_registry_complete_test.go)

- TestControlCompleteLegacyRegistryFirstRefusalBeforePublicValidation
- TestControlCompletePrivatePublicDriverRoundtripCallbacksAndCopies

### E63: agent/internal/nativeexecution/phase_cleanup_complete_test.go

[Source](../../agent/internal/nativeexecution/phase_cleanup_complete_test.go)

- TestNativeExecutionCompleteRelayPhasePartialStartCleanupAndPointerIdentity

### E64: agent/internal/nativeexecution/catalog_complete_test.go

[Source](../../agent/internal/nativeexecution/catalog_complete_test.go)

- TestCatalogCompleteCompiledFieldsAndHostSelection
- TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication

### E65: agent/internal/executionenrollment/enrollment_failure_order_test.go

[Source](../../agent/internal/executionenrollment/enrollment_failure_order_test.go)

- TestEnrollmentEveryFailurePreservesOrderAndCleanup

### E66: agent/internal/agentcommand/inspection_test.go

[Source](../../agent/internal/agentcommand/inspection_test.go)

- TestInspectionReturnsWithoutEnrollmentLockOrRunner
- TestInspectionRejectsEveryStateChangingFlagBeforeEffects

### E67: agent/internal/agentenrollment/native_enrollment_complete_test.go

[Source](../../agent/internal/agentenrollment/native_enrollment_complete_test.go)

- TestEnrollmentNativeCompleteCSRGenerationReuseAndOriginalReadErrors
- TestEnrollmentNativeCompleteChannelConfigurationBoundedDecodeAndErrorOrder
- TestEnrollmentNativeCompleteConfiguredTrustAndCertificateRefusals
- TestEnrollmentNativeCompleteFinalWritesRetainPartialProtectedStateAndCleanup
- TestEnrollmentNativeCompleteEntropyFailureUsesActualGoFatalBoundary
- TestEnrollmentNativeCompleteActualHTTPSRootTLSNoRedirectOrRetry
- TestEnrollmentNativeCompleteOriginalFileFailureAndJournalDelegates

### E68: agent/internal/control/native_direct_probe_test.go

[Source](../../agent/internal/control/native_direct_probe_test.go)

- TestProbeHostReadsCurrentPhysicalBindingWithoutMutation
- TestProbeHostRejectsForeignStaleInactiveAndTamperedBindings
- TestProbeHostExecutionExpiryCannotBeReplacedByProbePermit

### E69: agent/internal/probe/probe_test.go

[Source](../../agent/internal/probe/probe_test.go)

- TestProbeConnectOnlyAndProvenance
- TestProbeRejectsInvalidRequestsBeforeResolution
- TestProbeRejectsDNSMetadataAndForeignBindingsWithoutDial
- TestProbeSingleAttemptAndSanitizedFailure
- TestProbeCancellationDeadlineAndRevocation
- TestProbePostConnectRevocationClosesConnection
- TestProbeBoundedAdmissionAndCooldown

### E70: agent/internal/probe/gate_test.go

[Source](../../agent/internal/probe/gate_test.go)

- TestProbeGateConsumesBeforeAttemptAndDoesNotResetOnFailure
- TestProbeGateRejectsForeignInstancesAndRequiresIndependentAuthority
- TestProbeGateConcurrentDuplicateHasOnlyOneAttempt
- TestProbeGateCloseCancelsInflightAndDeniesFurtherWork
- TestProbeGateCapacityNeverEvictsConsumedIDs

### E71: agent/internal/control/native_construction_complete_test.go

[Source](../../agent/internal/control/native_construction_complete_test.go)

- TestNativeConstructionCompleteURLLiteralPrefixAndEffectPrecedence
- TestNativeConstructionCompletePhysicalAndDrainKeysHaveNoNormalization
- TestNativeConstructionCompleteTransitPrerequisiteLoadAuthAndCopies
- TestNativeConstructionCompleteAckRetainsTicketsTailsAndRetryMaps
- TestNativeConstructionCompleteDirectProjectionRefusalAndNumericEndpointMatrix
- TestNativeConstructionCompleteExplicitProbeDeadlineWatchDeferAndEntropy

### E72: agent/internal/nativeexecution/offline_adapter_complete_test.go

[Source](../../agent/internal/nativeexecution/offline_adapter_complete_test.go)

- TestOfflineAdapterCompleteNilPartialAndSuccessIdentity
- TestOriginalAdapterReturnShapes

### E73: agent/internal/observationtrust/handshake_complete_test.go

[Source](../../agent/internal/observationtrust/handshake_complete_test.go)

- TestHandshakeCompleteWireExactCapsPartialIOAndIndependentBudgets
- TestHandshakeCompletePrerequisiteDeadlineAndUnknownErrorOrder
- TestHandshakeCompleteNativeTLS13SNIAlpnRevocationAndNoCallerClose
- TestHandshakeCompleteCancellationClosesRawAndTimeoutDenies
- TestHandshakeCompleteTrustNativeClockAndVerificationBoundaries
- TestHandshakeCompleteStrictNewAndLeafRefusalsHaveNoFallback

### E74: agent/internal/nativeexecution/runner_dispatch_complete_test.go

[Source](../../agent/internal/nativeexecution/runner_dispatch_complete_test.go)

- TestRunnerWireCompleteHelloReportLiteralBytesAndRecoveryDecodeKinds
- TestRunnerWireCompleteActualStrictHelloSnapshotAndAckParsers
- TestRunnerDispatchCompleteOriginalDirectRelayAndMultihopEffectOrder
- TestOriginalDirectAssignmentPolicyAndEngineOrder
- TestOriginalRelayPeerBeforeStrictPreparedAssignmentAndPrepare
- TestOriginalMultihopPeerThenOriginalAssignmentMaximumAndPhase

### E75: agent/internal/nativeexecution/probe.go

[Source](../../agent/internal/nativeexecution/probe.go)

See the source scenario assertions or configured command steps.

### E76: agent/internal/control/probe_echo_target_complete_test.go

[Source](../../agent/internal/control/probe_echo_target_complete_test.go)

- TestProbeEchoTargetCompleteTCPUDPCurrentLockDeadlineAndDetachedInput
- TestProbeEchoTargetCompleteRefusalStagesAndAuthority
- TestProbeEchoTargetCompleteCodecCompositionAndNilComparison

### E77: agent/internal/probe/echo_binding_complete_test.go

[Source](../../agent/internal/probe/echo_binding_complete_test.go)

- TestEchoBindingCompleteNativeNumericAddressAndPolicyProjection
- TestEchoBindingCompleteProductValidationAndTypedTimeWindow
- TestEchoBindingCompleteOwnerAndNativeSafetyPointSourceOrder

### E78: agent/internal/observationtrust/handshake.go

[Source](../../agent/internal/observationtrust/handshake.go)

See the source scenario assertions or configured command steps.

### E79: agent/internal/probe/service_tls.go

[Source](../../agent/internal/probe/service_tls.go)

See the source scenario assertions or configured command steps.

### E80: agent/internal/probe/counters_complete_test.go

[Source](../../agent/internal/probe/counters_complete_test.go)

- TestCounterCompleteEpochBoundsDetachedAndConcurrentCounts
- TestCounterCompleteSealRaceLossSaturationAndExecutorClock
- TestCounterCompleteOutcomeBranchesAndCountCorruption

### E81: agent/internal/probe/echo_exchange_complete_test.go

[Source](../../agent/internal/probe/echo_exchange_complete_test.go)

- TestEchoExchangeCompleteBoundedFramesProofAndEveryRefusalStage
- TestEchoExchangeCompleteCancellationCloseAndLegacyDenialIdentity
- TestEchoExchangeCompleteExecutorSingleAdmittedDialAndCallerClose

### E82: agent/internal/probe/constructors_complete_test.go

[Source](../../agent/internal/probe/constructors_complete_test.go)

- TestProbeCompleteFourConstructorsExplicitEffectsAndResolverHierarchy
- TestProbeCompleteLegacyFactoryAllocationAndNilPrerequisiteSourceBoundary

### E83: agent/internal/probe/native/defaults_complete_test.go

[Source](../../agent/internal/probe/native/defaults_complete_test.go)

- TestProbeNativeCompleteFreshZeroDialerAndNativeEffects

### E84: agent/internal/control/probe_factory_complete_test.go

[Source](../../agent/internal/control/probe_factory_complete_test.go)

- TestControlCompleteNativeProbeFactoryPriorityAndBoundResolvers
- TestControlCompleteGuardRefusesBeforeNativeProbeGateEntropy

### E85: agent/internal/control/platform_defaults_complete_test.go

[Source](../../agent/internal/control/platform_defaults_complete_test.go)

- TestControlCompletePlatformAliasesDefaultsAndPartialFixtureFallbacks
- TestControlCompleteConstructorsRetainNativeDefaultsAndNoSampling

### E86: agent/internal/probe/elapsed_complete_test.go

[Source](../../agent/internal/probe/elapsed_complete_test.go)

- TestProbeCompleteDeterministicElapsedIncludesZeroResolution

### E87: agent/internal/probe/platform.go

[Source](../../agent/internal/probe/platform.go)

See the source scenario assertions or configured command steps.

### E88: agent/internal/control/probe_counters_complete_test.go

[Source](../../agent/internal/control/probe_counters_complete_test.go)

- TestProbeCounterCompleteRunnerAssemblyAndFallbackClocks
- TestProbeCounterCompletePageSortCursorSnapshotLimitsAndRetention
- TestProbeCounterCompleteLiveReaderCloseAndFrozenTailCallsites
- TestProbeCounterCompleteRetiringReadersBoundDedupFreezeAndSession

### E89: agent/internal/probe/native/echo_format_test.go

[Source](../../agent/internal/probe/native/echo_format_test.go)

- TestEchoExecutionEqualityDistinguishesNilEmptyAndDetachedProtocols
- TestEchoContextRoundtripAndBothTimeParsesKeepFailureStages

### E90: agent/internal/control/relay_runner_test.go

[Source](../../agent/internal/control/relay_runner_test.go)

- TestRelayRunnerPersistsBeforePrepareAndActivatesAfterRealPeerProbe

### E91: agent/internal/control/runner_owner_complete_test.go

[Source](../../agent/internal/control/runner_owner_complete_test.go)

- TestRunnerOwnerCompleteActualHelloBytesAndPartialStartupStop
- TestRunnerOwnerCompleteOriginalReplacementDrainFallbackAndPhase
- TestRunnerOwnerCompleteRetainedJSONErrorsAndSequenceAfterLifecycle
- TestRunnerOwnerCompletePendingPartialDecodeAfterStrictLiveAck
- TestRunnerOwnerCompleteOriginalRunIgnoresLocalHelloMarshalError
- TestRunnerWireOriginalIgnoredHelloMarshal

### E92: agent/internal/nativeexecution/probe_echo_endpoint_test.go

[Source](../../agent/internal/nativeexecution/probe_echo_endpoint_test.go)

- TestEchoIngressEndpointKeepsNumericProtocolAndPolicyBounds

### E93: agent/internal/control/probe_counter_clock_test.go

[Source](../../agent/internal/control/probe_counter_clock_test.go)

- TestProbeCounterPointSamplesEveryPointAndPreservesTerminalOffset
- TestEchoContextDecodeRefusalStillSamplesOwnerClock
- TestForwardCounterEmbeddingKeepsPromotedNativeFields

### E94: agent/internal/nativeexecution/probe_family_wire_complete_test.go

[Source](../../agent/internal/nativeexecution/probe_family_wire_complete_test.go)

- TestProbeFamilyCompleteLiteralProjectionAndNoDowngrade
- TestProbeFamilyCompleteQualificationPollClaimStatusResultParseBeforeCheck
- TestProbeFamilyCompletePrevalidationErrorsKeepRequestProjection

### E95: agent/internal/proberesult/contract_test.go

[Source](../../agent/internal/proberesult/contract_test.go)

- TestProbeResultSharedVectors
- TestProbeResultDigestAndTypedEcho

### E96: agent/internal/control/probe_negotiation_test.go

[Source](../../agent/internal/control/probe_negotiation_test.go)

- TestProbeClientNegotiationDoesNotAuthorizeExecution
- TestProbeClientRejectsUnboundActiveOversizedOrSupersededAcknowledgements

### E97: agent/internal/control/probe_registration_test.go

[Source](../../agent/internal/control/probe_registration_test.go)

- TestProbeRegistrationOwnsRotatesAndRevokesCurrentGate
- TestProbeRegistrationRejectsUnsafeOrSupersededAcknowledgements
- TestProbeRegistrationStopCannotBeUndoneByLateAcknowledgement
- TestProbeRegistrationMonitorClosesOnContextIdentityAndGuardLoss
- TestProbeRegistrationMonotonicFreshnessDeadlineClosesGate
- TestProbeRegistrationSupervisorClosesAndRevokesOnShutdown
- TestProbeRegistrationRecoversOwnerAfterRejectedAcknowledgement

### E98: agent/internal/nativeexecution/runner_time_projection_complete_test.go

[Source](../../agent/internal/nativeexecution/runner_time_projection_complete_test.go)

- TestWireTimeCompleteRawResultsAndQualificationPairs
- TestRunnerSnapshotCompleteValidityFirstRawError
- TestRunnerDrainReportCompleteUTCFieldsAndNilShapes

### E99: agent/internal/state/native_format_complete_test.go

[Source](../../agent/internal/state/native_format_complete_test.go)

- TestJournalNativeFormatCompleteExactLowerAndNativeDeclarations
- TestJournalNativeFormatCompleteLiteralAuthenticatedPayloadEnvelopeAndRawMessages
- TestJournalNativeFormatCompleteRuntimeOptionalFieldsAndTransitRemainNative

### E100: agent/internal/state/native_loader_complete_test.go

[Source](../../agent/internal/state/native_loader_complete_test.go)

- TestJournalNativeLoaderCompleteEnvelopeAuthenticationAndRepresentativeFirstErrors
- TestJournalNativeLoaderCompleteStrictBindingExtensionFenceAndPortPrecedence
- TestJournalNativeLoaderCompleteStoredSnapshotDigestIdentityAndPhysicalHistory
- TestJournalNativeLoaderCompletePreviousCodecKeepsJSONOnlyHistoryAndNativeValidationBoundary

### E101: agent/internal/control/transit_authority_lifecycle_complete_test.go

[Source](../../agent/internal/control/transit_authority_lifecycle_complete_test.go)

- TestTransitAuthorityLifecycleCompleteOriginalControllerEffects
- TestOriginalPrechecksAndTimeOrder
- TestOriginalPhasesPartialCleanupAndReturnShape
- TestOriginalDurableFailureRestartRejectsReplay
- TestOriginalPerItemReservationAndAccumulatedJSONReturn

### E102: agent/internal/control/transit_authority_native_complete_test.go

[Source](../../agent/internal/control/transit_authority_native_complete_test.go)

- TestTransitAuthorityNativeCompleteFailedPreparationAndActivationRetainFence
- TestTransitAuthorityNativeCompleteActiveAndDrainingLegacyPortRefusal

### E103: agent/internal/state/runtime_facts_test.go

[Source](../../agent/internal/state/runtime_facts_test.go)

- TestRuntimeFactsPreserveRawStorageAndReferences
- TestRuntimeNativeFieldOrderAndRawJSONSemantics

### E104: agent/internal/platformruntime/journal_provider_complete_test.go

[Source](../../agent/internal/platformruntime/journal_provider_complete_test.go)

- TestJournalProviderCompleteBootstrapInterfaceTwoExactConsumerMethodSets
- TestJournalProviderCompleteBootstrapNativeLoadEnableAndOriginalErrorValues

### E105: agent/internal/state/journal_test.go

[Source](../../agent/internal/state/journal_test.go)

- TestJournalIntegrityAndPersistence

### E106: agent/internal/agentidentity/records_complete_test.go

[Source](../../agent/internal/agentidentity/records_complete_test.go)

- TestCredentialRecordCompleteLayoutAndEightProjections
- TestRelayRecordOptionalFieldsAreIndependent

### E107: agent/internal/transit/engine_test.go

[Source](../../agent/internal/transit/engine_test.go)

- TestThreeNodeTLSBoundTransitTCPHalfClose
- TestThreeNodeTLSBoundTransitUDPAssociationAndEmptyDatagram
- TestPreparedTransitRefusesMissingAuthorization
- TestTransitRejectsSpoofedOpenAndRevokedGrant

### E108: agent/internal/nativeexecution/offline_transit.go

[Source](../../agent/internal/nativeexecution/offline_transit.go)

See the source scenario assertions or configured command steps.

### E109: agent/internal/relay/tls_test.go

[Source](../../agent/internal/relay/tls_test.go)

- TestMutualTLSExactNodeIdentityAndNoDowngrade
- TestMutualTLSRefusesForeignNodeTrustPurposeExpiryAndPin

### E110: agent/internal/transit/authority_tls_chain_complete_test.go

[Source](../../agent/internal/transit/authority_tls_chain_complete_test.go)

- TestTransitAuthorityTLSChainCompleteNativeFirstRefusal

### E111: agent/internal/platformobservation/host_contract_test.go

[Source](../../agent/internal/platformobservation/host_contract_test.go)

- TestHostNativeAliasAndLowerFactsHaveDistinctSerialization

### E112: agent/internal/control/forward_counter_final_complete_test.go

[Source](../../agent/internal/control/forward_counter_final_complete_test.go)

- TestForwardFinalPointNativeUTCMaxValuesAndDetachedOptionalPointers
- TestForwardFinalPageSamplesBeforeLockAfterPayloadAndAfterFrozenMetadata
- TestForwardFinalLocalAndRemoteSortedCursorRotationsAreIndependent
- TestForwardFinalLocalKeyOrderDedupTerminalAndUnavailableSemantics
- TestForwardFinalOriginalPageIgnoresIdentityEncodeErrorAndUsesReturnedBytes
- TestOriginalPageIgnoredErrorAndPartialBytes

### E113: agent/internal/observationwire/time_guard_final_complete_test.go

[Source](../../agent/internal/observationwire/time_guard_final_complete_test.go)

- TestNativeAckFinalProcessSuffixAndOtherRegexTimeBoundaries
- TestNativeObservationFinalScalarAndTimeProjectionBoundaries
- TestNativeAckFinalOriginalFourBodiesKeepFirstFailureAndEffectOrder
- TestOriginalFourAckStageOrder

### E114: agent/internal/agentcommand/native_cli_complete_test.go

[Source](../../agent/internal/agentcommand/native_cli_complete_test.go)

- TestAgentCLICompleteEveryRunnerOptionAndNativeCancelBeforeLockRelease
- TestAgentCLICompleteModeAndCompetingFirstRefusalOrder
- TestAgentCLICompleteEachEchoAndServicesDependencyRefusesBeforeEffects
- TestAgentCLICompleteMissingExplicitProvidersNeverSelectNativeFallback
- TestAgentCLICompleteActualNativeInterruptAndTermination
- TestAgentCLICompleteSignalHelper
- TestAgentCLICompleteOriginalNativeArgumentsAndMainEffects
- TestNativeOriginalAbsProofRelPredicateAndJoinOrder
- TestNativeOriginalReadonlyKeyMasksAndStdoutEncoder
- TestNativeOriginalBootLockDiagnosticsSignalsAndEnrollmentEffects
- TestNativeOriginalGlobalFlagsOrderHelpDefaultsCaptureAndDuplicate
- TestNativeOriginalEveryPreexistingGlobalFlagStopsAtRegistrationPrefix
- TestNativeOriginalParsedValuesAreCapturedAndNativeParserStopsAtOperand
- TestNativeOriginalGlobalFlagHelpAndInvalidExitBehavior
- TestNativeOriginalParserProcessHelper
- TestNativeOriginalMainRunEnrollmentSignaturesStderrAndExit

### E115: apps/control/test/agent-plan-cli-complete.test.ts

[Source](../../apps/control/test/agent-plan-cli-complete.test.ts)

- 152 offline plan retains only public compiler and fact imports and original positional argv rule
- 152 actual offline plan awaits read then strict parse Forward direct snapshot pretty and stdout with original identities
- 152 offline plan preserves snapshot getter evaluation after direct compile and ignores inherited or overwritten assignment facts
- 152 every offline plan stage failure retains original catch message exit and stops later effects
- 152 Forward errors stringify exactly and strict JSON duplicate invalid root and compiler refusal precede output
- 152 actual public parser and offline compilers keep native Snapshot pretty bytes and independent authorization reservation refusals

### E116: agent/internal/relay/engine_test.go

[Source](../../agent/internal/relay/engine_test.go)

- TestEncryptedTCPPreparedGateHalfCloseAndHardCutoff
- TestEncryptedUDPIsolatedClientsIdleAndResourceReclamation
- TestOpenRejectsOldBindingOverActualTLS
- TestRelayNodeBudgetSharedAndReturnedAcrossProtocols
- TestRelayTargetPolicyRefusedOnActualNumericDial
- TestRelayDrainRetiresListenerWhileBoundedEstablishedTCPCanFinish
- TestRelayUDPHardCutoffClosesActiveAssociations
- TestRelayExpiredPeerStopsExistingCheckedFlow
- TestRelayRepeatedDrainAndAuthorizationCannotExtendRetiredFlow
- TestRelayPeerOutageAndCustomerTargetOutageRemainDistinct

### E117: agent/internal/relay/multihop_test.go

[Source](../../agent/internal/relay/multihop_test.go)

- TestMultihopTCPConsecutiveTransitHalfCloseRenewalAndCutoff
- TestMultihopUDPClientIsolationAndIntermediateFailure
- TestMultihopUDPRequestActivityPreservesAssociationBeforeDelayedReply

### E118: agent/internal/relay/wire_test.go

[Source](../../agent/internal/relay/wire_test.go)

- TestReplyKeepsPreparedFailureRetryableAndBindsAcceptance
- TestOpenAndFrameBoundsAndPreparedGate

### E119: agent/internal/relay/native_configuration_complete_test.go

[Source](../../agent/internal/relay/native_configuration_complete_test.go)

- TestMultihopCompleteImmutableNativeProjectionAllRolesAndProtocols
- TestMultihopCompleteValidationLeafFingerprintAndPrepareOrder
- TestRelayCompletePublicEgressPolicyEqualsOriginalAllowedDetour

### E120: agent/internal/relay/native_effects_complete_test.go

[Source](../../agent/internal/relay/native_effects_complete_test.go)

- TestRelayCompleteSharedUDPFailureReleasesTCPAndNodeAdmission
- TestRelayCompleteReadBeforeAfterAndWriteBeforeAuthority
- TestRelayCompleteDNSPolicyCallbackAndPostDialPartialClose
- TestRelayCompletePayloadWriterCountsSuccessfulPrefixOnly

### E121: agent/internal/relay/wire_complete_test.go

[Source](../../agent/internal/relay/wire_complete_test.go)

- TestRelayCompleteControlFramePartialIOAndValidationBeforeWrites
- TestRelayCompleteOpenValidationAuthorizationAndBindingFirstErrors
- TestRelayCompleteFramedBufferedFINAndAuthorityRefusalOrder

### E122: agent/internal/relay/tls_complete_test.go

[Source](../../agent/internal/relay/tls_complete_test.go)

- TestRelayCompleteTLSProtocolPinAndRootOwnership

### E123: agent/internal/payloadstats/counters_complete_test.go

[Source](../../agent/internal/payloadstats/counters_complete_test.go)

- TestPayloadStatsCompleteEntropyErrorShortAndPartialStreams
- TestPayloadStatsCompleteEpochSnapshotNilAndSuccessfulPayload
- TestPayloadStatsCompleteAtomicSaturationAndConcurrentSnapshots

### E124: agent/internal/relay/payload_read_complete_test.go

[Source](../../agent/internal/relay/payload_read_complete_test.go)

- TestRelayCompleteTCPIngressPayloadReadExcludesCarrierAndEgress
- TestRelayCompleteUDPIngressEmptyDatagramsAndPayloadRead

### E125: agent/internal/control/payload_counters_complete_test.go

[Source](../../agent/internal/control/payload_counters_complete_test.go)

- TestControlCompleteNativePayloadSnapshotConsumerAndTerminalCopy

### E126: agent/internal/adp3/validate_test.go

[Source](../../agent/internal/adp3/validate_test.go)

- TestSharedRuntimeFixture

### E127: agent/internal/adp3/multihop_test.go

[Source](../../agent/internal/adp3/multihop_test.go)

- TestMultihopSharedExecutionConformance

### E128: agent/internal/adp3relay/validate_test.go

[Source](../../agent/internal/adp3relay/validate_test.go)

- TestSharedFixture

### E129: agent/internal/adp3transit/validate_test.go

[Source](../../agent/internal/adp3transit/validate_test.go)

- TestOfflineTransitADP3Envelope
- TestTransitADP3RejectsVersionAndBindingDrift
- TestTransitADP3RejectsStaleAndConflictingSnapshots

### E130: agent/internal/contracts/validate_test.go

[Source](../../agent/internal/contracts/validate_test.go)

- TestAuthoritativeFixture
- TestSharedConformance
- TestRFC8785Vectors
- TestBoundedJSON
- TestPreciseTimes

### E131: agent/internal/transitcontracts/validate_test.go

[Source](../../agent/internal/transitcontracts/validate_test.go)

- TestSharedTransitVectors
- TestTransitEmbeddedSchemaMatchesRepositoryContract
- TestLegacyRelayAgentParserDeniesNewTransitRole

### E132: agent/internal/probeclaim/validate_test.go

[Source](../../agent/internal/probeclaim/validate_test.go)

- TestProbeClaimSharedVectorsAndTypedEcho

### E133: agent/internal/probeinstance/validate_test.go

[Source](../../agent/internal/probeinstance/validate_test.go)

- TestProbeInstanceSharedVectors
- TestProbeInstanceEchoAndTypedBypass

### E134: agent/internal/probedelivery/contract_test.go

[Source](../../agent/internal/probedelivery/contract_test.go)

- TestProbeDeliverySharedVectors
- TestProbeDeliveryTypedEcho

### E135: agent/internal/probenegotiation/validate_test.go

[Source](../../agent/internal/probenegotiation/validate_test.go)

- TestProbeNegotiationSharedVectors
- TestProbeNegotiationEchoAndTypedBypass

### E136: agent/internal/agentplatform/native_complete_test.go

[Source](../../agent/internal/agentplatform/native_complete_test.go)

- TestAgentPlatformCompleteCanonicalFieldsAndNativeDefaults
- TestAgentPlatformCompleteDefaultsCannotSampleTimeIOOrEntropy

### E137: agent/internal/control/platform.go

[Source](../../agent/internal/control/platform.go)

See the source scenario assertions or configured command steps.

### E138: agent/internal/control/runner.go

[Source](../../agent/internal/control/runner.go)

See the source scenario assertions or configured command steps.

### E139: agent/internal/platformclock/synchronization_values_test.go

[Source](../../agent/internal/platformclock/synchronization_values_test.go)

- TestNativeSynchronizationStatusEncodingAndFacts
- TestSynchronizationProjectionKeepsInvalidFactsForDecision

### E140: agent/internal/authorization/synchronization_complete_test.go

[Source](../../agent/internal/authorization/synchronization_complete_test.go)

- TestSynchronizationCompleteNativeAliasesAndTaglessFacts
- TestSynchronizationCompleteProofBytesMACAndProviderErrors

### E141: agent/internal/authorization/synchronization.go

[Source](../../agent/internal/authorization/synchronization.go)

See the source scenario assertions or configured command steps.

### E142: agent/internal/executiontime/clock.go

[Source](../../agent/internal/executiontime/clock.go)

See the source scenario assertions or configured command steps.

### E143: agent/internal/platformclock/synchronization_complete_test.go

[Source](../../agent/internal/platformclock/synchronization_complete_test.go)

- TestSynchronizationCompleteNativeFactsCompetingFailures
- TestSynchronizationCompleteParseCacheAndSampleFailures

### E144: agent/internal/nativeexecution/pending_response_complete_test.go

[Source](../../agent/internal/nativeexecution/pending_response_complete_test.go)

- TestPendingResponseCompleteNativeRelayProjectionAndRenewalAreDetachedValues

### E145: apps/control/test/multihop-runtime.test.ts

[Source](../../apps/control/test/multihop-runtime.test.ts)

- terminal failure after success records one incident and withdraws ingress despite unrelated queued work
- retryable downstream failure keeps the active generation recoverable
- grant withdrawal immediately clears deployment readiness while retaining fresh execution evidence
- Profile grant command revokes one shared operation stream without extending leases or releasing slots
- Profile revocation response failure rolls back authority, operation and idempotency on real MySQL
- Profile restore capacity failure rolls back every new deployment, Fence, operation and grant
- member demotion and restoration preserve shared leases, slots, replay and user revision on real MySQL
- intermediate Node Grant withdrawal and no-op retain cutoff and resources without a capacity veto
- member response failure rolls back membership, audit, operations and persisted replay together
- Node Grant restoration capacity failure rolls back grant audit, deployment, Fence and operation
- Node policy accepts a scope manager but recompiles with the original Forward authorizer and user revision
- denied Node policy records failed cleanup intent and restores only through a fresh deployment generation
- whole-Node revocation invalidates overlapping machine and Relay credentials without a Snapshot capacity veto
- Node policy path capacity failure rolls back policy, new deployment, Fence and operation
- Node policy persisted response failure rolls back owner, Runtime and security audit tables
- whole-Node audit failure restores credential authority, operation and idempotency state together
- Forward Direct command acceptance preserves CAS, no-op authorization, retry source and occupied resources
- Forward multi-hop edit and retry advance deployments without rewriting retry intent or extending old leases
- Forward Direct creation rolls back reservations, owner history and operations after response persistence fails
- Forward multi-hop update capacity failure rolls back intent, authorizer, plans, fences and replay together
- Forward removal retains its capacity veto and rolls back deleting history and cleanup work
- Forward retry persisted response failure restores source operation, deployment history and idempotency atomically
- Snapshot sources share capacity and publication collection across Direct and non-Direct-only Nodes
- Snapshot source failure during capacity rolls back accepted owner changes, reservations, operations and replay
- Snapshot source ownership and resource conflicts fail before publication and roll back preceding coordinator work
- Snapshot source registration remains present when multi-hop is disabled so withdrawal retains leases and physical ownership
- Snapshot publication failure after lease recording rolls back MySQL but preserves the independent authority high-water
- stale execution reports do not appear as fresh deployment observations
- a report for the old published generation cannot fail its running successor
- a terminal error during deployment fails the existing attempt
- retry rejects an oversized intermediate Snapshot and rolls back every new Fence and operation

### E146: scripts/phase2/relay-scenarios.ts

[Source](../../scripts/phase2/relay-scenarios.ts)

See the source scenario assertions or configured command steps.

### E147: apps/control/test/relay-owner-complete.test.ts

[Source](../../apps/control/test/relay-owner-complete.test.ts)

- 9 Relay ledger command providers sample original one one two one clock boundaries preserve receiver error and caller Tx
- 9 Relay execution error keeps detail retryability successful history exact operation request and no extra clock transaction or connection
- 9 Relay error refusals leave operation and deployment untouched and each provider failure stops exact subsequent work
- 9 Relay complete keeps exact running deadline status claim cleanup selection and separate clock boundaries
- 9 Relay advance preserves terminal eligibility touch before state refusal and stopped cleanup on the same supplied Tx
- 9 Relay native store command SQL keeps error JSON property order claim clearing exact status deadline and terminal predicates
- 9/11 Relay status retains terminal source error and fresh physical evidence while current pins differ from still-issued retiring authority
- 9 Relay ledger legacy Date.now is captured once and error success and cleanup use unchanged samples on caller executor
- 9 real MySQL Relay command predicates keep successful history claim boundaries cleanup selection and exact error detail
- 9 real MySQL failure after operation write before deployment withdrawal rolls back running failure and later incident without losing succeeded history

### E148: apps/control/test/snapshot-assignment-ports.test.ts

[Source](../../apps/control/test/snapshot-assignment-ports.test.ts)

- static registration rejects missing sources, duplicate IDs, unsupported declarations and overlapping driver/role ownership
- construction performs no source reads and the source set, declarations and callback references cannot be replaced later
- sources execute in deterministic ID order and merge Direct, Relay and multi-hop contributions into one sorted assignment set
- Relay adapter passes the same transaction, Node and capacity/publication flag without authorizing or publishing on its own
- foreign Nodes, malformed contributions, undeclared drivers/roles and attempts to contribute host-owned Direct assignments fail closed
- merging rejects duplicate assignment IDs, logical bindings and physical TCP/UDP slots rather than dropping one source
- source failure aborts the whole merge instead of silently publishing a partial Direct or earlier-source result
- request and each contribution detach before later awaits without freezing or modifying owner-owned plan objects
- an explicit empty source set supports Direct-only helpers and rejects invalid non-HTTP contexts
- valid mixed contributions still require the existing complete Snapshot compiler and its session/config/size checks

### E149: scripts/phase2/runtime-intent-lock.ts

[Source](../../scripts/phase2/runtime-intent-lock.ts)

See the source scenario assertions or configured command steps.

### E150: scripts/phase2/access.ts

[Source](../../scripts/phase2/access.ts)

See the source scenario assertions or configured command steps.

### E151: apps/control/test/ledger-owner-complete.test.ts

[Source](../../apps/control/test/ledger-owner-complete.test.ts)

- 10 Ledger quarantine decodes only after original writes and keeps duplicate instance retirement ownership generation and provider order
- 10 Ledger empty Relay-only unauthorized and succeeded work retain original laziness filtering and exact provider receivers
- 10 Ledger capacity observes current permission and operation changes during compile are refused before publication
- 10 Ledger malformed authoritative and retired bodies fail at original lazy decode point after pending and ownership guards
- 10 Ledger accept and retirement keep monotonic source ownership exact original clock UUID order and no unnecessary decode
- 10 Ledger claim and get preserve expiration selector token first-error order empty laziness and original lock flags
- 10 Ledger native quarantine preserves ordered authorization clearing observation clearing snapshot decode and duplicate retirement SQL
- 10 Runtime worker locks Node before operation and rejects every original stale claim gate before protected authority or persistence
- 10 real MySQL Ledger acceptance rollback restores insertion supersession retirement ownership and preserves monotonic source history
- 10 real MySQL Ledger claim expires first retains token attempt deadline and SKIP LOCKED competition does not double claim
- 10 real MySQL completion holds Node then Operation while original Forward intent remains unlocked
- 10 real MySQL leases preserve cross-session five-second boundary duplicate retirement ownership and absent versus zero maximum

### E152: apps/control/test/runtime-ledger-ports.test.ts

[Source](../../apps/control/test/runtime-ledger-ports.test.ts)

- Ledger filters stale/revoked intent before authorization and keeps accepted work opt-in
- Ledger requires the original authorizer/current permission and rechecks operation after compilation
- Ledger accept obtains ID then latest owner and uses monotonic creation/deadline without a new transaction
- Ledger claim expires first and retains one sample/token and the exact fifteen-second bound
- Ledger capacity retains its early time sample across provider awaits and includes old-instance tombstones
- Ledger tombstones preserve physical ordering and clamp each retirement generation
- Ledger drain refuses unaccepted generation and absent/null/zero authorization before parsing deadlines
- Ledger drain accepts the exact authorization deadline and records removal only with zero connections
- Ledger completion separates stopped, failed and ready claim/cleanup writes while keeping the Forward read unlocked
- Ledger completion retains cleanup and resources at the exact five-second boundary or while old leases remain

### E153: apps/control/test/runtime-host-ports.test.ts

[Source](../../apps/control/test/runtime-host-ports.test.ts)

- Runtime Hello keeps protocol and identity refusal before effects, then lock/credential/facts/boot ordering
- Runtime construction refuses missing clock/time/machine methods before sampling or provider effects
- Runtime Hello refuses retired boots, changed capabilities, lost history and session exhaustion before boot writes
- Runtime publication records protected authority before Snapshot and leases in one transaction
- Runtime publication stops on authority/save failures and never records leases or completion
- Runtime publication preserves queued same-instance multihop state and refuses exhausted counters before retirement
- FR0026 queued preserved multihop publications renew at the normal lead before Agent skew expiry
- Runtime stale worker claim after compilation refuses authority and Snapshot persistence
- Runtime report duplicate replay preserves ACK and rejects changed body before observation writes
- Runtime report refuses identity, boot, unpublished generation, fence and phase before drain/report writes
- Runtime report accepts current evidence after drains and never fails execution on expired publication
- Runtime copies default and explicit validated policies at construction then detaches every Hello response
- Runtime retains policy validator receiver error identity and refuses weakened authority before any transaction
- native Policy validation retains constructor sample timing and original parser refusal for malformed values

### E154: apps/control/test/runtime-construction-complete.test.ts

[Source](../../apps/control/test/runtime-construction-complete.test.ts)

- 203/205 RuntimeController constructs original state/status providers and preserves every ledger receiver and Forward argument
- 203/205 RuntimeLedger retains policy spread resource short circuit native stores collector authorization and captured clock/UUID
- 203/205 RelayCoordinator keeps same ledger/providers fresh policy false multihop captured instance clock and invocation-time static same-Tx quarantine
- 203 retained RelayExecutionLedger remains an interface extending original public native generic specialization

### E155: apps/control/test/relay-plan.test.ts

[Source](../../apps/control/test/relay-plan.test.ts)

- Control Relay plan binds both sessions and physical reservations in strict prepared assignments
- Relay plan is order stable and never mutates owner facts or reserved slots
- Relay compiler rejects missing, foreign, mixed-generation and unfenced reservations
- Relay compiler refuses expired or duplicated peer facts and bounds both Node credentials
- Relay pin refresh detects either endpoint change without mutating immutable intent or plan

### E156: apps/control/test/relay-planner.test.ts

[Source](../../apps/control/test/relay-planner.test.ts)

- relay resource plan distinguishes public UDP from independent internal TLS TCP socket
- relay plan refuses missing exact capability, wrong Profile revision and TLS resource conflict
- relay plan applies final target policy at egress and peer endpoint policy at ingress
- Relay reachable endpoints reject wildcard/multicast/mapped wildcard and duplicate internal ports
- current Relay resource allocator fails closed on a proposed Transit hop

### E157: apps/control/test/multihop-plan.test.ts

[Source](../../apps/control/test/multihop-plan.test.ts)

- ${count}-Node execution binds every role, session and physical Fence
- multi-hop compiler refuses absent capabilities, policy, exact ownership and peer authority

### E158: scripts/phase2/relay-capacity.ts

[Source](../../scripts/phase2/relay-capacity.ts)

See the source scenario assertions or configured command steps.

### E159: apps/control/test/node-management-ports.test.ts

[Source](../../apps/control/test/node-management-ports.test.ts)

- policy acceptance uses manager scope authorization and each original authorizer, not the management requester
- policy denial and missing authorizers create failed withdrawal intents; disabled allowed intents never transition
- whole-Node revocation invalidates both credential families and cannot be vetoed by Snapshot capacity or deny-intent handling
- both commands gate replay with current scope management permission and reuse the complete response without side effects
- new revocation keys retain acceptance semantics; empty reference and missing lease sets do not invent execution state
- policy stale CAS, revision increment errors and policy changes on revoked Nodes roll back idempotency claims
- policy and revocation failures roll back owner changes, prior operations, audit and replay together
- policy objects and nested arrays are detached before authorization so digest and mutation see one intent
- Node effect wiring and cross-scope owner references fail closed
- non-HTTP management callers cannot bypass identifiers, closed command shapes or bounded Node policy validation

### E160: scripts/phase2/security.ts

[Source](../../scripts/phase2/security.ts)

See the source scenario assertions or configured command steps.

### E161: scripts/phase2/transport.ts

[Source](../../scripts/phase2/transport.ts)

See the source scenario assertions or configured command steps.

### E162: apps/control/test/node-owner-complete.test.ts

[Source](../../apps/control/test/node-owner-complete.test.ts)

- 12/133 Node constructor validates bounds then formatter then all four native prerequisites before clock or IO
- 133 native token CSR predicates preserve exact boundaries and caller-specific short circuit errors
- 12/134 enrollment missing revoked expired replay conflict and expiry during signing preserve original transaction ordering
- 12/134 machine and Relay rotations replay before superseded source but require live source and post-sign credential recheck
- 12 Relay authority overlap is bounded by original machine certificate lifetime and active count
- 12 grant no-op change conflict revoked and exhaustion preserve visibility Runtime lock and scoped read before write and access audit
- 12 machine pool lookup credential bounds policy revision pending revocation and no-lease view retain native fields
- 133 intent refusal keeps Node Scope listener port native capability protocol target evaluation order and separate capability reads
- 12/134 native legacy constructor captures original clock defaults providers and token hash without duplicate owner
- 12 authorization grant and execution refusal retain scope/grant/state/network order without new authority
- 12 native policy closed fields snapshot deep immutability and exactly one revision remain original
- 12/134 native PKI default control and explicit Relay purpose retain P256 validation and cleanup after signing failure

### E163: apps/control/test/node-store-sql-complete.test.ts

[Source](../../apps/control/test/node-store-sql-complete.test.ts)

- 12/134 Node native SQL
- 12 native pool machine lookup uses separate time samples no transaction and original pool receiver errors
- 12 static legacy quarantine retains exact three-table order and first failure
- 12/134 native Node SQL preserves signed-field and native JSON evaluation before original execute errors
- 12/134 canonical MySQL original Node enrollment rotation Relay issuance replay revocation and quarantine rollback every real write

### E164: apps/control/test/legacy-owner-defaults.test.ts

[Source](../../apps/control/test/legacy-owner-defaults.test.ts)

- all six top-level legacy construction entries retain their exact runtime export names and erased type leaves
- legacy owner constructors retain distinct classes, public method inheritance and native initialization without clock sampling
- Identity audit resolves Date.now at each call and native account lookup keeps pool versus supplied-Tx ownership
- Nodes captures Date.now once, preserves separate machine samples and default resource initialization in the original transaction
- Nodes retains omitted versus supplied resources, credential defaults and original constructor refusal order
- Transport keeps native UUID captured at construction and dynamic time while grant callbacks and SQL share the original transaction
- RelayEndpoints dynamic clock, native store and original owner callbacks preserve request identity and transaction order
- legacy static recovery stores use the exact supplied executor and retain original failure identity and order

### E165: apps/control/test/identity-input.test.ts

[Source](../../apps/control/test/identity-input.test.ts)

- opaque bearer token input rejects trailing whitespace, Unicode and malformed lengths

### E166: apps/control/test/access-command-ports.test.ts

[Source](../../apps/control/test/access-command-ports.test.ts)

- member demotion re-reads the current owner after locking, revokes through one ledger and reports historical path cutoff
- member restoration uses the current record, rechecks authorization and retains disabled-intent cleanup capacity checks
- member reconciliation skips deleted or reassigned intents after locking
- Node Grant withdrawal includes intermediate and historical nodes without transition or capacity veto
- Node Grant restoration preserves host transition failures and never transitions disabled or unrelated intents
- member no-op has no execution work; Node Grant no-op still validates the node and reports its cutoff
- both access commands gate replay with current owner authorization and preserve operation IDs and digest conflict
- access failures roll back owner rows, audit, prior accepted effects and replay responses together
- member input is detached before awaiting authorization and only its original token hash enters the request digest
- access integration fails closed on cross-scope candidates/current records and incomplete effect wiring
- non-HTTP access calls cannot bypass IDs, counters, role, token, boolean or idempotency-key validation

### E167: scripts/phase2/recovery.ts

[Source](../../scripts/phase2/recovery.ts)

See the source scenario assertions or configured command steps.

### E168: apps/control/test/identity-owner-complete.test.ts

[Source](../../apps/control/test/identity-owner-complete.test.ts)

- 20 explicit access host preserves exact native Bearer grammar pool versus transaction lookup and 401 boundaries
- 20 native Identity codec retains ID counter token boundaries without additional normalization
- 20 membership scope owner and execution permission preserve missing404 management403 owner403 and raw query failures
- 20 bootstrap validates left to right and preserves raw account or scope duplicate with original transactional prefix
- 20 member full authority lock chain no-op and all active/role transitions preserve revisions mutable response and audit ordering
- 20 member invalid inputs protected owner stale zero missing account credential mismatch and exhaustion stop before mutation
- 20 member every authority secret mutation and audit failure preserves first original error and caller rollback
- 20 list retains native ordering mutable arrays role precedence truthiness and original owner checks
- 20 recovery rotates every account token in supplied sorted order before any non-owner deactivation with no private transaction
- 20 legacy Identity keeps native helpers explicit providers and dynamically reads original clock

### E169: apps/control/test/identity-store-sql-complete.test.ts

[Source](../../apps/control/test/identity-store-sql-complete.test.ts)

- 20 native Identity SQL
- 20 raw bootstrap insert duplicate and membership-only duplicate translation preserve code message receiver and original unrelated failure
- 20 pool bearer lookup retains original pool receiver native row and original error without transaction
- 20 real Identity audit evaluates UUID then supplied clock then native details JSON before execute
- 20 canonical MySQL bootstrap raw duplicate member account mapping exact locks and every account member audit failure roll back caller Runtime history
- 20 canonical MySQL recovery locks ID order rotates all tokens then deactivates only nonowners with every-write rollback and protected history retention

### E170: apps/control/test/legacy-entrypoints.test.ts

[Source](../../apps/control/test/legacy-entrypoints.test.ts)

- ${family} pure legacy entries load their exact mapped canonical values and preserve erased runtime surfaces
- legacy aggregate retains its own version and three exact reader constructors while frozen policies stay distinct

### E171: apps/control/test/transport-grant-ports.test.ts

[Source](../../apps/control/test/transport-grant-ports.test.ts)

- Profile revoke uses one owner-authorized transaction and never transitions or allocates
- Profile restore rechecks subject authority and capacity, but disabled intents never transition
- Profile replay is owner-gated before returning the same operation IDs without repeating effects
- Profile no-op, stale CAS and empty references do not invent deployment work
- Profile port failures roll back grant, audit, operations and replay response together
- Profile integration rejects cross-scope owner references and missing effect wiring
- non-HTTP Profile grant callers cannot bypass identifier, revision, boolean or key validation

### E172: apps/control/test/transport-owner-complete.test.ts

[Source](../../apps/control/test/transport-owner-complete.test.ts)

- 21 Transport publication validates native input before owner then claim insert and lock with initial owner grant response
- 21 Transport immutable old revision missing corrupt digest scope stale no-op and maximum bounds retain lazy reads
- 21 publication all providers encode clock pointer initial grant and response failures preserve original rollback prefix
- 21 locked resolve gets exact immutable revision after Scope management and grant while get list grants keep original read permissions order and shape
- 21 Profile grants use exact-one previous count and lock Forward references before mutations with UUID clock encoding event order
- 21 Endpoint owner claims before Node management then locked revision Forward references save audit response including active-reference noop
- 21 endpoint get retains Scope then Node cleanup then shared resolution false execution and original parse errors
- 21 native normalization closed Profile/endpoint/key grammar old imports defaults and prototype hooks remain native

### E173: apps/control/test/transport-store-sql-complete.test.ts

[Source](../../apps/control/test/transport-store-sql-complete.test.ts)

- 21 native Transport SQL
- 21 endpoint SQL locks and upsert retain raw config exact original args receiver and first error
- 21 Transport legacy static recovery deletes only grant table and preserves original error
- 21 canonical MySQL Transport publish grants endpoints use original Identity Node Forward locks and every write rolls back original request history

### E174: apps/control/test/transport-formatter-complete.test.ts

[Source](../../apps/control/test/transport-formatter-complete.test.ts)

- 132 Transport requires callable formatter before reading any provider and keeps original constructor refusal
- 132 Transport get preserves provider receivers authorization revision decode parse digest and response property evaluation inside original Tx
- 132 Transport forwards zero fractional invalid NaN infinite timestamps unchanged to custom formatter without clock or coercion
- 132 Transport native formatter retains Date ISO clipping boundaries and original RangeError with transaction rollback
- 132 Transport first failure stops later providers formatting and preserves exact thrown value and rollback
- 132 Transport publish changed unchanged replay grants resolve and list retain responses without formatter or extra clock
- 132 legacy Transport get uses unchanged native SQL supplied Tx default output and native formatter rollback

### E175: apps/control/test/transport-query-ports.test.ts

[Source](../../apps/control/test/transport-query-ports.test.ts)

- native catalog needs current scope access and separates process gates from Node proof or authorization
- reference listing is authorized first in the same transaction and does not require an execution grant
- impact preview requires manager and exact Profile revision grant but never mutates the source or authorizes deployment
- scope denial and invisible Profiles stop before projection/resolution
- query parameters are closed, bounded and canonical before any transaction
- owned query survives caller mutation across authorization and stale pages never widen the revision filter
- malformed persisted reference fails closed instead of suggesting an update to another Profile

### E176: apps/control/test/intent-store-ordering.test.ts

[Source](../../apps/control/test/intent-store-ordering.test.ts)

- idempotency snapshots keys before ensure but compares the live digest after the row lock
- recovery-invalidated idempotency refuses before digest conflict or stored response decoding
- pending idempotency never decodes response and completed replay preserves body identity and decoder failure
- idempotency response samples status and encodes body before reading request keys
- Forward insert encodes again after the current-row await rather than caching mutable spec bytes
- Forward replacement encodes after CAS await and refuses zero or multiple affected rows before history
- Forward storage failure preserves identity and prevents the subsequent immutable revision write

### E177: apps/control/test/forward-command-ports.test.ts

[Source](../../apps/control/test/forward-command-ports.test.ts)

- Direct creation reserves and compiles before owner writes and commits one complete response on the supplied transaction
- Relay creation authorizes sorted Nodes and plans after owner insertion even when the intent is disabled
- all replay paths require current visibility but not renewed management authority; create alone rechecks the owner record
- no-op updates still authorize and validate but do not reserve, change authorizer or create operations
- changed Direct disable, enable and update intents advance revision/generation and retain old resources and previous spec
- Relay disable skips execution authorization and planning but retains capacity checks; enabled changes reject denied paths
- ingress moves require both recovery suspension and a revoked old Node before sorted Node locking
- deletion retains separate Direct/Relay locks, CAS, exhaustion, capacity veto and occupied leases
- retry locks the current Forward before the source Operation, reauthorizes and preserves source identity without changing intent
- retry rejects recovered, stale and nonfailed sources before effects and checks full Relay authorization on transition
- all command failures roll back owner writes, resources, plans, operations and replay and permit a same-key retry
- canonical input detaches before the first await and uses the same frozen spec for request digest and persistence
- Direct compiler validation remains before and after resource allocation, including disabled intents
- non-HTTP callers cannot bypass input/identity/revision validation or required Runtime preparation

### E178: apps/control/test/forward-store-sql-complete.test.ts

[Source](../../apps/control/test/forward-store-sql-complete.test.ts)

- 22 Forward native store retains all seventeen literal SQL predicates lock modes argument order and undecoded driver results
- 22 native Idempotency SQL retains original full key identity and response status bytes with no implicit decode
- 22 Forward service preserves lazy raw revisions projection flags missing rows and original argument translations

### E179: apps/control/test/runtime-legacy-type-map-complete.test.ts

[Source](../../apps/control/test/runtime-legacy-type-map-complete.test.ts)

- 203 all 34 runtime leaves retain bounded eight construction one interface 25 forwarding classification
- 203 all legacy runtime native aliases and generic defaults resolve to the exact original uninstantiated public declarations
- 203 production Recovery phase fixture and original tests retain actual legacy construction and native compilation imports until migration

### E180: apps/control/test/rule-commands-api.test.ts

[Source](../../apps/control/test/rule-commands-api.test.ts)

- Operation detail exposes the scoped Forward identity for explicit retry without skipping same-transaction authorization
- explicit retry delegates the original actor/scope/key and rejects extra or duplicate intent fields

### E181: apps/control/test/forward-probes-api.test.ts

[Source](../../apps/control/test/forward-probes-api.test.ts)

- Probe management routes delegate verified actor, scope, strict JSON and idempotency key
- Probe management routes reject cookies, missing authentication, oversized/duplicate JSON and query injection before delegation

### E182: apps/control/test/application-query-ports.test.ts

[Source](../../apps/control/test/application-query-ports.test.ts)

- query ports preserve one authorized transaction without a concrete Control or SQL connection
- denied query authorization prevents every projection and propagates transaction failure
- non-HTTP query callers cannot bypass pagination, filter or identifier validation
- query inputs are detached before asynchronous authorization and adapter failures are not swallowed

### E183: apps/control/test/console-read.test.ts

[Source](../../apps/control/test/console-read.test.ts)

- console pagination is bounded and rejects malformed integers
- read models enforce scope before running any page SQL
- page queries are scope bound, return no enrollment secret and separate operation status
- all three scoped lists use bounded second-page literal offsets
- console filter contracts reject duplicate, unknown, unbounded and injection inputs
- filters are bound identically into count and page SQL; prefix underscore stays literal
- candidate and overview authorization precedes data SQL, including manager requirement
- overview counts are scoped, single-statement and independent of any page or filter

### E184: apps/control/test/console-diagnostics.test.ts

[Source](../../apps/control/test/console-diagnostics.test.ts)

- Node diagnostics authorizes scope before querying any Node state
- Node diagnostics is read-only, scoped, sanitized and never claims probe health
- Node diagnostics returns 404 for out-of-scope or missing Node

### E185: apps/control/test/console-mysql-acceptance.test.ts

[Source](../../apps/control/test/console-mysql-acceptance.test.ts)

- console queries preserve bounded pages, independent candidates, full-scope totals and read-only authorization

### E186: apps/control/test/transport-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/transport-query-mysql-acceptance.test.ts)

- native catalog and Profile references/impact use real prepared MySQL, scoped SELECT-only access and exact target grants

### E187: apps/control/test/tunnel-query-ports.test.ts

[Source](../../apps/control/test/tunnel-query-ports.test.ts)

- tunnel metadata authorizes inside one transaction, bounds peer windows, and never claims execution or network health
- revoked or expired Node/peer windows stay closed, and an absent Endpoint is metadata rather than fabricated readiness
- desired-rule references include disabled and recovery-suspended intent and derive exact ordered adjacency for all native roles
- scope denial and a missing scoped Node stop before any endpoint, peer or reference disclosure
- reference input is closed/canonical/bounded and detached before authorization awaits
- corrupt Node, Endpoint and credential metadata fail closed rather than emit partial authorization claims
- invalid, duplicate or unrelated desired references are rejected and do not become neighboring execution facts

### E188: apps/control/test/tunnel-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/tunnel-query-mysql-acceptance.test.ts)

- tunnel API uses real prepared SELECT-only MySQL: bounded windows, scoped exact adjacency, pagination and no persisted mutations

### E189: apps/control/test/transit-negotiation.test.ts

[Source](../../apps/control/test/transit-negotiation.test.ts)

- real MySQL TLS-bound Transit handshake rejects retired boot, credential revocation and capability spoofing
- transit negotiation HTTP path refuses client without a verified TLS machine certificate
- Transit preview poll and delivery report deny unauthenticated clients

### E190: apps/control/test/transit-coordination.test.ts

[Source](../../apps/control/test/transit-coordination.test.ts)

- offline Transit coordination plan remains downstream-first, ingress-first on withdrawal
- offline coordination database enforces ownership, receipt CAS, recovery and never releases ports
- offline rollout SQL creates only an isolated coordination journal

### E191: apps/control/test/transit-preparation.test.ts

[Source](../../apps/control/test/transit-preparation.test.ts)

- Transit v1 preparation binds 3 Nodes, both protocols, sessions, pins, fences and tail-first activation
- Multi-hop plan is deterministic across resource/facts order and does not mutate inputs
- Transit preparation refuses missing, foreign, mixed-generation, colliding and unfenced slots
- Transit preparation rejects expired credentials, wrong peer, unadvertised versions, scope mismatch and bad adjacent target
- Multi-hop logical planning still refuses one- and two-Node current paths
- transactional reserve primitive rejects malformed logical sets before touching MySQL

### E192: scripts/phase2/relay.ts

[Source](../../scripts/phase2/relay.ts)

See the source scenario assertions or configured command steps.

### E193: apps/control/test/path-template-ports.test.ts

[Source](../../apps/control/test/path-template-ports.test.ts)

- native template parser is closed, bounded, ordered and detached, with computed native requirements
- publication uses one authorization/owner transaction and preserves immutable versions, deduplication and audit
- scope denial precedes idempotency, reads and owner side effects; stale CAS and keys cannot mutate metadata
- archival is terminal, keeps immutable history and does not require or create new execution authority
- quota, reference denial and audit failure roll back head, immutable version, event and idempotent response together
- revision ceiling permits authorized no-op and archival, but cannot overwrite the last version
- reads detect stored corruption, detach pagination and retain archived rows without checking execution grants
- native authoring adapter checks sorted Node grants/capabilities, locked Profile and every current Endpoint in the supplied transaction

### E194: apps/control/test/path-binding-ports.test.ts

[Source](../../apps/control/test/path-binding-ports.test.ts)

- MySQL binding sequences accept exact numeric aggregate text and retain the immutable cap before either write
- selection is closed/detached, expansion changes only the fixed path/Profile and denies ingress/protocol moves
- binding and actual expanded Forward enter one original CAS/preparation/Operation/capacity/idempotency transaction
- identical replay returns the original receipt without re-expansion but requires current management; changed normalized key conflicts
- stale CAS, recovery isolation, archived/different digest and denied original grants fail before any provenance or execution commit
- original preparation, capacity and binding audit failures roll back the entire accepted revision, Operation, authorizer and key
- same expanded spec can attach/rebind provenance without an Operation; exact no-op does not consume history
- ordinary enabled/target/listener changes preserve historical binding; explicit topology changes detach current pointer without deleting history
- binding quota counts retained immutable records but allows exact no-op and ordinary disable/detach
- bounded references and impact are read-only, include suspended/archived history labels, and reject malformed or corrupt provenance

### E195: apps/control/test/path-template-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-template-mysql-acceptance.test.ts)

- path templates use real native reference authorization, transactional CAS/quotas, immutable history, archival and SELECT-only scoped queries

### E196: apps/control/test/path-binding-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-binding-mysql-acceptance.test.ts)

- path binding uses real original owner transactions: immutable expanded provenance, concurrent CAS, rollback, cap, archival and SELECT-only impact/history

### E197: scripts/phase2/path-template-console.ts

[Source](../../scripts/phase2/path-template-console.ts)

See the source scenario assertions or configured command steps.

### E198: scripts/phase2/path-switch-console.ts

[Source](../../scripts/phase2/path-switch-console.ts)

See the source scenario assertions or configured command steps.

### E199: scripts/phase2/path-batch-console.ts

[Source](../../scripts/phase2/path-batch-console.ts)

See the source scenario assertions or configured command steps.

### E200: apps/control/test/probe-negotiation-ports.test.ts

[Source](../../apps/control/test/probe-negotiation-ports.test.ts)

- Probe negotiation returns only immutable session-bound recognition on the supplied read transaction
- malformed declarations and session or fingerprint mismatches reject before transaction admission
- retired boots, foreign evidence, revoked, missing or expired credentials and unavailable TCP facts cannot negotiate
- machine reader binds the supplied fingerprint to its Node, fails closed on missing credentials and detaches facts
- the separate Probe hello endpoint cannot be reached with Bearer or spoofed session headers instead of mTLS

### E201: apps/control/test/probe-instance-registry.test.ts

[Source](../../apps/control/test/probe-instance-registry.test.ts)

- remote registry passes actual machine identity to the owner and emits a detached non-executable response
- typed bypass and verified machine/session mismatch reject before entering any owner operation
- Bearer or session headers do not substitute for verified mTLS on the instance endpoint

### E202: apps/control/test/probe-instance-ports.test.ts

[Source](../../apps/control/test/probe-instance-ports.test.ts)

- durable instance registration uses one transaction, immutable output and non-renewing retry across host reconstruction
- generation CAS rejects delayed installation and revocation without harming the current successor
- expiry or clock rollback cannot renew an instance; a fresh identity and current generation are required
- every registration and replay reauthorizes machine/session/credential/capability evidence and clamps overlap expiry
- revocation is sticky, repeatable and available after capability withdrawal and counter exhaustion
- a new boot reports the prior registration as stale rather than silently adopting it
- closed typed input validates before I/O and is detached before asynchronous acceptance
- write failure, commit guard failure and expiry while waiting for a lock leave no accepted ownership
- MySQL owner locks absent slots, binds updates, rejects corrupt projections and quarantines without resetting generation

### E203: apps/control/test/probe-permit-ports.test.ts

[Source](../../apps/control/test/probe-permit-ports.test.ts)

- management selects the locked current instance and records idempotent acceptance in the same owner transaction
- management defaults off, rejects injected targets and instance selection, and cannot refund or extend issuance
- management rolls back both permit and idempotency on authorization, instance, persistence or post-guard failure
- management receipts stay reported-only after expiry or revocation, are scoped and never restore current authority
- management receipts reject corrupt digest, binding, times and disguised request metadata without repairing storage
- result ingestion uses the original owner transaction, preserves consumption and never touches execution
- concurrent identical results across hosts deduplicate to the original acceptedAt without writes on replay
- a changed result cannot replace the single accepted observation even with a fresh correlation ID
- result ingestion compares every binding and original receipt field against the locked consumed permit
- result ingestion reauthorizes original actor, instance, credential and topology before duplicate lookup
- result withdrawal stays sticky after grants recover and does not erase the accepted result or consumption
- result writes, budget clock failures and maintenance guards roll back with no acknowledgement
- corrupt persisted results fail closed instead of being repaired or overwritten
- malformed and forged result identities reject before transactions, without consuming new permits
- permit requests reject unknown fields, unsafe identities and coercion before any transaction
- issuance locks current actor, plan, instance and machine in one transaction and returns no remote execution authority
- only one concurrent claim consumes; restart, repeated claim and replacement cannot refund or reuse it
- consumption reauthorizes the original actor and compares every topology binding dimension
- old certificate, session, instance, generation, revoked slot and credential retirement deny current consumption
- fresh issuance clips all deadline bounds and rejects withdrawn or foreign authorization before writing
- scope managers can revoke after grant withdrawal, without reopening, consuming or refunding the reservation
- Actor limits span Scopes and Node limits span Actors; cluster reservations survive early closure
- clock rollback, future history, corrupt records and oversized retained sets fail closed
- owner failures and post-acceptance maintenance roll back insertion, consumption, pruning and budget clock
- expired IDs are pruned only after cooldown and cannot become new issuance or executable replay
- delivery and consumed checks reject injected authority and unsafe machine commands before a transaction
- bounded delivery authenticates even an empty mailbox and returns one detached minimized offer without mutation
- delivery does not expose foreign or closed permits, mint IDs, consume, renew or choose an ambiguous candidate
- delivery and consumed status reauthorize the original Actor and every complete binding field
- consumed status is repeatable observation, not a new claim, deadline, execution lease or clock write
- explicit consumed withdrawal is sticky across owner restart and preserves consumption, scope isolation and reservations
- withdrawal insert, clock and post-acceptance failures roll back the flag without losing the original claim
- corrupt, orphaned, duplicate, over-capacity and future withdrawals fail closed without mutation
- expiry cleanup removes only withdrawn history past cooldown and cannot resurrect any old permit

### E204: apps/control/test/probe-claims.test.ts

[Source](../../apps/control/test/probe-claims.test.ts)

- closed claim adapter forwards only actual mTLS identity and emits a detached minimized receipt after owner completion
- typed contract bypass and verified Node/session mismatch reject before owner consumption
- owner denial, post-commit expiration and inconsistent owner result cannot manufacture a receipt or retry consumption
- Bearer, claimed fingerprint and session headers never substitute for actual mTLS on the claim endpoint

### E205: apps/control/test/probe-delivery.test.ts

[Source](../../apps/control/test/probe-delivery.test.ts)

- closed delivery adapter forwards actual machine identity and minimizes immutable empty/one/status replies after owner completion
- invalid typed commands, cross-protocol and verified identity mismatch reject before any owner call
- owner denial and pre-commit guard failures propagate without fallback, cached success or a second transaction
- post-commit stale or uncertain clocks and expired results cannot produce discovery or status acknowledgements
- inconsistent owner identity, instance, time or execution markers fail closed after exactly one call
- delivery endpoints never substitute Bearer or claimed headers for actual mTLS

### E206: apps/control/test/probe-results.test.ts

[Source](../../apps/control/test/probe-results.test.ts)

- result adapter delegates once to the owner, awaits commit and returns only a detached receipt
- typed result injection and claimed Node/session mismatch reject before the owner
- failed owner commits propagate without an acknowledgement, fallback or retry
- stale post-commit clocks and inconsistent saved receipts cannot manufacture a result acknowledgement
- result endpoint rejects Bearer and claimed fingerprint without actual mTLS

### E207: apps/control/test/probe-negotiation-mysql-acceptance.test.ts

[Source](../../apps/control/test/probe-negotiation-mysql-acceptance.test.ts)

- real mTLS result ingestion has INSERT-only result privileges, delegated history updates and no execution writes
- real mTLS concurrent conflicting results select one immutable winner without reconsumption or quota refunds
- real mTLS results reject forged credentials, malformed content and stale original authority without writes
- real mTLS result insertion rolls back at the commit guard and corrupt saved observations cannot be overwritten
- real MySQL recovery preserves reported results as non-authorizing history and bounded permit pruning cascades their deletion
- real HTTPS mTLS Probe negotiation uses SELECT-only production assembly and cannot enable execution or mutate state
- real mTLS registry persists only its owner table, serializes replacement and keeps read-only negotiation unchanged
- real mTLS registry rejects spoofed identity, invalid contracts and withdrawn evidence; explicit revoke is sticky
- current Node credential revocation, overlap retirement, expiry and session/capability withdrawal reject negotiation without writes
- real mTLS claim races commit one receipt with delegated history and no unrelated writes
- real mTLS claim rejects impersonation, cross-protocol and injected authority before writes; foreign known IDs stay unavailable
- real mTLS claim reauthorizes original Actor, Forward, instance and current machine without writing on denial
- real mTLS claim rolls back consumption and budget on pre-commit maintenance failure, without synthesizing an acknowledgement
- real mTLS poll/status use SELECT plus locking-only privileges and preserve every table for empty, offered and consumed observations
- real mTLS discovery/claim/status stays one-use and sticky withdrawal cannot be undone by restoring a grant or replaying a request
- real mTLS delivery rejects forged association and injected authority on empty mailboxes too, without writes
- real mTLS offer and consumed status reauthorize original grants, full Forward revision, instance and current credential
- real mTLS delivery withholds acknowledgements when the owner post-action maintenance guard fails before commit

### E208: apps/control/test/probe-permit-mysql-acceptance.test.ts

[Source](../../apps/control/test/probe-permit-mysql-acceptance.test.ts)

- real MySQL shares budgets and writes only permit state plus delegated same-transaction history
- real MySQL rechecks actor grants, topology, credentials, instance and expiry at consumption
- real MySQL owner/post-acceptance failures roll back permit insertion, claims and budget clock
- real MySQL keeps intent and instance read locks through durable claim commit
- real MySQL revocation and restored quarantine cannot reopen a permit or refund its budget
- real MySQL rejects backward budget clocks and oversized/corrupt stored bindings without modifying them
- real MySQL bounded offers and consumed checks are current read-only projections across independent hosts
- real MySQL consumed withdrawal is sticky, scoped, atomic and preserves the original one-use fact and budget
- real MySQL recovery withdraws consumed permits without changing consumption, existing flags, or the budget floor
- real MySQL 0016 upgrade backfill denies old consumed receipts and cascading cleanup cannot resurrect IDs
- real MySQL consumed status holds original authorization and budget locks through commit before withdrawal can win

### E209: apps/control/test/optional-http-services.test.ts

[Source](../../apps/control/test/optional-http-services.test.ts)

- ${name} named and positional HTTP wiring admit before authentication, await the owner and release
- ${name} omission, admission refusal, denied authentication and owner failure preserve dispatch boundaries

### E210: apps/control/test/foundation-cancellation.test.ts

[Source](../../apps/control/test/foundation-cancellation.test.ts)

- native signal identity crosses both public cancellation ports without wrappers or altered reason
- a common cancellation provider needs no native EventTarget members for sender pre-admission refusal

### E211: apps/control/test/observation-recovery-stores-complete.test.ts

[Source](../../apps/control/test/observation-recovery-stores-complete.test.ts)

- 161 Telemetry recovery executes exactly ten original writes in the supplied transaction and forwards the original promise
- 161 Station recovery passes a fresh exact nine-field mutable state to its explicit encoder before the native two writes
- 161 Notification recovery awaits endpoint suspension then samples once before history cancel and pending-attempt writes
- 161 explicit recovery owners and raw SQL adapters construct without hidden clock database or provider defaults
- 161 real MySQL telemetry quarantine retains all four raw families and rollup samples while only operational cursors reset and rollback restores all ten writes
- 161 real MySQL Station recovery resets exactly policy suspension evaluation and nine-field state while retaining events audit and definition history
- 161 real MySQL Notification recovery preserves terminal HTTP evidence opaque references and rate bounds while cancelling only nonterminal work without refund
- 31/161 real native Station event SQL precedes original Notification outbox handoff on one transaction without secret acquisition or sender effects

### E212: apps/control/test/publication-recovery-stores-complete.test.ts

[Source](../../apps/control/test/publication-recovery-stores-complete.test.ts)

- 162 ${entry.name} recovery preserves exact event-before-invalidation SQL predicate revision actor supplied time and first failure
- 162 public Path and Ingress recovery forward only their own store exact Tx time receiver and original promise without defaults
- 162 native final recovery event store retains supplied event identity time opaque encoding and original one-write error
- 162 real MySQL Path and Ingress recovery append creator-attributed next-revision events then invalidate only eligible batches and preserve all definitions lineage attempts audits cancel flags and current pointers

### E213: apps/control/test/notification-sender-drain.test.ts

[Source](../../apps/control/test/notification-sender-drain.test.ts)

- a common cancellation registration race removes the same once callback and never enters DNS
- cancelled DNS still owns sender capacity and close waits for the actual callbacks without another lookup or request
- cancelled authorization guards retain capacity until both real guards settle, including a late guard failure
- one pinned HTTPS attempt preserves HTTP rejection versus unknown network outcome without redirect or retry

### E214: apps/control/test/notification-delivery-worker.test.ts

[Source](../../apps/control/test/notification-delivery-worker.test.ts)

- delivery worker commits its bounded claim before leasing secrets, reauthorizes the dispatch and records an unknown result without immediate resend
- revoked manager after claim cancels dispatch and secret unavailability records refusal without using raw credentials or another sender
- failed claim and finish writes roll back their owner transaction without a hidden resend or resetting the existing fence
- worker retains its secret lease and coalesces ticks until sender physical drain, and close joins that drain

### E215: apps/control/test/observation-public-types-complete.test.ts

[Source](../../apps/control/test/observation-public-types-complete.test.ts)

See the source scenario assertions or configured command steps.

### E216: apps/control/test/notification-store-complete.test.ts

[Source](../../apps/control/test/notification-store-complete.test.ts)

- 35 endpoint native parse precedes SQL count stays lazy and exact original transaction upsert argument order survives
- 35 endpoint exact 16 list 128 audit loss saturation canonical integer and native JSON refusal boundaries
- 35 outbox insert duplicates compare immutable values before prune and exact 27-column insert remains in caller transaction
- 35 outbox terminal-only 7day pruning max16 queue1024 eviction and loss counters fail closed at exact native writes
- 35 outbox native get decode scope flag and payload checks remain synchronous before owner values and SQL CAS
- 35 outbox attempt256 retention zero-row finish never recreates history and rate16 uses strict live boundary
- 35 outbox due defer active exact bounds and parameterized readonly attempts history losses
- 35 old zeroarg wrappers keep prototype receiver count/get overrides and singleton original value providers
- 35 endpoint and outbox bindings initialize only their own synchronous parser pair and lower adapters contain no upper source or type dependency

### E217: apps/control/test/notification-native-complete.test.ts

[Source](../../apps/control/test/notification-native-complete.test.ts)

- 35 real canonical MySQL endpoint quotas audit eviction JSON/integer corruption and old count override retain exact original effects
- 35 real canonical MySQL outbox duplicate immutable JSON roundtrip claim CAS stale fence current override due defer rate and readonly history
- 35 real canonical MySQL seven-day strict terminal-only prune16 preserves live pending/history and loss accounting
- 35 real canonical MySQL outbox1024 evicts only oldest terminal attempts256 retain newest and saturated loss rolls every write back
- 35 real canonical MySQL every original write failure rolls back all seven notification tables in supplied transaction
- 35 real canonical MySQL loss maxima every loss family and sixteen rate identities remain bounded without mutating readonly losses

### E218: apps/control/test/notification-owner-complete.test.ts

[Source](../../apps/control/test/notification-owner-complete.test.ts)

- 71 endpoint publish authenticates replay before missing secrets and preserves durable stage before SQL audit response with rollback orphan
- 71 endpoint owner refuses quota CAS policy clock authority before staging and disable preserves credential revision/reference
- 71 endpoint reads redact native secret bindings retain 16+1 audit page and reject duplicate/corrupt or oversized owner rows
- 72 handoff validates policy event time before route lock maps only route corruption and preserves same-Tx disabled silence deterministic insertion
- 72 claim denial precedence recovery authorization policy endpoint silence authority never reaches capacity or rate
- 72 claim exact active2 rate equal expiry sixth expired-attempt and immutable candidate revision boundaries
- 72 preflight exact five-second margin and finish stale fences revision deadline backclock do not mutate protected attempt history
- 72 finish complete retry-code HTTP status sixth-attempt and strict lifetime boundary matrix
- 72 readonly history closed query canonical cursor filter ordering loss and head SHARE tail corruption matrix
- 72 failure-header defers original revision cutoff exactly five minutes with rollback preserved and no private send

### E219: apps/control/test/publication-savepoints.test.ts

[Source](../../apps/control/test/publication-savepoints.test.ts)

- ${name} success keeps result identity and releases after the original action
- ${name} classifies before rollback and projects only after release
- ${name} unknown errors and classifier faults escape without savepoint rollback
- ${name} every savepoint or late projection failure escapes by identity
- publication refusal classifier retains error identity, status bounds, retryable guard and shared mutable code Set

### E220: apps/control/test/audit-owner-transactions.test.ts

[Source](../../apps/control/test/audit-owner-transactions.test.ts)

- audit rejects invalid closed queries before clock and authorization before any source read
- audit sequential source reads share caller transaction and frozen read-only result
- audit pagination binds cursor to explicit query and rejects corrupt duplicate ordering
- audit request admission releases capacity after both rejection and successful drain
- audit store and malformed-row failures release active slots for later independent actors

### E221: apps/control/test/station-alert-worker.test.ts

[Source](../../apps/control/test/station-alert-worker.test.ts)

- station worker authorizes before locks and atomically appends handoff and state
- station revoked manager suspends without reading facts or producing events
- station handoff or state failure rolls back all event effects and defers with original guarded revision
- station worker rechecks latest revision and prevents overlapping ticks while a fact read drains

### E222: apps/control/test/node-observation-ports.test.ts

[Source](../../apps/control/test/node-observation-ports.test.ts)

- observation requests reject unknown sources, versions, targets, shapes and coercion before admission
- the passive host captures its reader and detaches immutable public evidence without raw reports or health claims
- report status separates missing, invalid, stale, revoked and incompatible evidence from fresh observations
- freshness expires at the earliest report, snapshot or credential bound and never extends from Agent clock skew
- malformed and foreign source results fail closed instead of widening the returned scope
- source failures are sanitized while missing resources and denied authorization retain their HTTP meaning
- already cancelled work never enters the reader and client cancellation aborts admitted work
- a deadline discards late evidence and holds the node budget until the reader actually stops
- per-actor and per-node concurrency budgets prevent cross-scope and cross-actor bypass
- cancelled uncooperative readers cannot release global admission early
- the per-process cooldown expires and policy cannot be weakened by mutating constructor inputs
- the raw-report projection guard distinguishes selected bodies from bounded JSON function arguments
- the MySQL observer authorizes before its scoped projection in one transaction and always rolls back reads
- MySQL cancellation destroys only the observation connection and never releases a dirty transaction
- the read adapter subscribes and removes the same callback using only the common cancellation port
- pool acquisition after cancellation is destroyed and failed rollback is never returned to the pool

### E223: apps/control/test/node-observation-mysql-acceptance.test.ts

[Source](../../apps/control/test/node-observation-mysql-acceptance.test.ts)

- observation production assembly uses SELECT-only MySQL and preserves scope authorization and database contents
- persisted report provenance and expiry never become independent health or applied-state claims
- a real MySQL authorization lock is stopped by the observation deadline without changing grants or execution state

### E224: apps/control/test/telemetry-owner-transactions.test.ts

[Source](../../apps/control/test/telemetry-owner-transactions.test.ts)

- ${family} telemetry intake authorizes before stored reads and preserves exact replay receipt without append
- ${family} telemetry rollup failure rolls back raw head and releases node admission
- ${family} telemetry parser and credential refusal cannot touch persisted head
- ${family} telemetry changed replay, epoch and uptime preserve original refusal precedence
- ${family} telemetry refuses revoked expired or superseded sessions before locking head
- ${family} telemetry history authorizes Scope before Node reads and keeps response non-authoritative
- ${family} telemetry request capacity drains and callback errors release capacity

### E225: apps/control/test/forward-probe-plan-ports.test.ts

[Source](../../apps/control/test/forward-probe-plan-ports.test.ts)

- probe preflight rejects open inputs, coercions and invalid identities before starting a transaction
- preflight uses one authorized read transaction, returns immutable binding and never issues executable authority
- manager and explicit Node Grant checks occur before reading any published execution
- trusted authorization port joins the supplied transaction without starting a nested one or granting execution
- stale revisions and disabled, deleting, recovery-suspended, DNS, UDP-only and Relay intents cannot plan
- metadata remains forbidden even when Forward policy allows it; foreign facts and denied CIDRs fail closed
- missing, expired and incompatible published bindings cannot become a plan
- MySQL projection is scoped, supplied-transaction-only and binds body generation/session/expiry to database rows

### E226: apps/control/test/observation-native-values-complete.test.ts

[Source](../../apps/control/test/observation-native-values-complete.test.ts)

- 40/41/42 native helper aliases preserve public parser digest and original clock function capture without eager sampling
- 40 native closed objects IP hostname identity and base64 helpers retain complete refusal boundaries and null prototype identity
- 40 real certificate preflight rejects lexical size canonical DER and parse failures before either outer callback
- 40 actual native X509 projection preserves date usage SAN expected-key policy hash order and all strong-key boundaries
- 40 actual outer TLS trust keeps native short-circuit getters exact SAN EKU validity policy and frozen projection
- 40/44 real staged echo config trust stays inert detached frozen and resolver preserves exact authorized context digest
- 44 actual resolver captures default clock once and retains reference auth head revision clock version parser refusal precedence
- 41/42 native JSON UTF8 base64 cursor fingerprint hex clone and time helpers keep exact native coercion and evaluation order

### E227: apps/control/test/notification-destination.test.ts

[Source](../../apps/control/test/notification-destination.test.ts)

- notification destinations share the native parser and return canonical HTTPS without credentials or query
- notification destination rejects alternate trust/address channels with the original public error
- notification destination bounds both supplied and canonical URL bytes

### E228: apps/control/test/probe-native-codec-complete.test.ts

[Source](../../apps/control/test/probe-native-codec-complete.test.ts)

- 45/46/52 original restored public parsers helpers and ACKs are the same canonical functions with no new value exports
- 52 actual dispatch source preserves inherited discriminant read count v4 v3 v2 v1 and exactly one JSON phase before parser body digest
- 46/52 real four-family request envelope keeps canonical body digest and no v4 ACK projection
- 52 actual stored guard reads v4 before v3 keeps own requestId refusal zero temporary identity and exact corruption mapping
- 45/52 real v1 v2 v3 ACKs retain independent ordered keys UTC receipt duplicate and disabled unknown fields
- 53 actual machine codecs initialize without effects and preserve every request-spread response order and lazy callback boundary
- 45/53 real typed/service nullable offers and every supported measurement retain schema checks disabled state and exact 250ms boundary
- 42/46 staged native and retained history echo invocation keep exact ISO service nonce bytes frame hash and Ed25519 proof

### E229: apps/control/test/http-native-boundaries-complete.test.ts

[Source](../../apps/control/test/http-native-boundaries-complete.test.ts)

- 136 native session header keeps exact decimal counter grammar and original conversion errors
- 136 native body reader accumulates bytes across split UTF8 then releases before fatal decoding without parsing JSON
- 136 native body limit counts bytes and stops before another read while release errors keep original finally precedence
- 43 native HTTP parser aliases preserve every canonical version-family implementation identity
- 136 native HTTP request error mapping retains ControlError identity and exact status/code boundaries
- 136 Console headers preserve exact ordered values receiver and first throw without later header calls
- 136 Probe withdrawal preserves result getter order nullability false literal and original ISO failures
- 136 native query helpers reevaluate original URL each call and preserve search params duplicates empty values and exceptions
- 136 original Console asset helper performs fresh per-request UTF8 reads at the exact URL and preserves read failure
- 137 native fingerprint checks actual authorized TLSSocket before peer certificate and retains original peer getter error
- 136 actual Probe revoke route projects withdrawal only after successful original owner and never after refusal

### E230: apps/control/test/http-route-matrix-complete.test.ts

[Source](../../apps/control/test/http-route-matrix-complete.test.ts)

- 137 original HTTP ${route.method} ${route.path} exact dispatch byte bound and first refusal
- 137 original HTTP GET ${path} exact read owner receiver scope and omitted query arguments
- 137 item position grammar is checked after body read but before owner; closed wrappers reject unknown fields
- 137 global request lifecycle surrounds authority and complete response while health bypasses allow only
- 137 machine ${path} original middleware receiver session parser and body-bound ordering
- 137 machine ${path} admits before certificate excludes initial Nodes lookup and parses before epoch
- 137 Transit boot header precedes epoch and owner; snapshot keeps epoch before owner and enrollment preserves closed bound
- 137 both credential machine routes preserve body before epoch field errors and exact rotation arguments
- 137 Node provisioning observation and Probe withdrawal preserve original status signal and projection
- 137 every registered Console asset dispatches its exact native name with original security and media headers
- 137 request ID precedes lifecycle admission and native request abort does not release the actual admitted action

### E231: apps/control/test/http-query-family-complete.test.ts

[Source](../../apps/control/test/http-query-family-complete.test.ts)

- 113 all fifteen old query entry modules retain the exact seventeen public canonical functions and no expanded exports
- 113 every object query family returns fresh mutable ordinary objects preserving decoded insertion order and original value types
- 113 every family rejects unknown duplicate and encoded-duplicate keys with the original exact message
- 113 original pagination bounds apply only to paged families while raw history and cursor families keep their strings and empty values
- 113 Profile and template detail revisions retain safe-counter range without a new64 ceiling while Path and observation remain capped64
- 113 exact detail revision first rejects all unknown or duplicate keys before validating the revision value
- 113 group targetRevision presence refuses before iteration parsing and pagination; Ingress validates pagination before group identity
- 113 aggregate parser uses own-property duplicate nonempty guards and Object.assign rather than getAll family behavior
- 113 Probe history retains every resultStatus including staged recorded Echo and its original competing-error precedence
- 113 native Console query keeps original map kind filters reference mutable returns and callback-before-pagination order
- 113 Console wrapper uses exact owner table and validator with all existing kind filters and original refusal ordering
- 113/187 actual HTTP decoded echoed filter crosses original ProbeRuns owner and parameterized native SQL while unknown status refuses before SQL

### E232: apps/control/test/forward-probe-mysql-acceptance.test.ts

[Source](../../apps/control/test/forward-probe-mysql-acceptance.test.ts)

- probe preflight production API is SELECT-only, manager-plus-grant authorized and never creates commands or execution work
- probe preflight rejects current database/body mismatches, revoked nodes and quarantined intents without writes

### E233: apps/control/test/probe-public-bridge-owner-complete.test.ts

[Source](../../apps/control/test/probe-public-bridge-owner-complete.test.ts)

- 81 public command/plan/service constructors are original aliases; command flags retain dependent defaults
- 81 command framing/defaults precede transaction, manager and replay precede flags, original owner receives same Tx and finite deadline
- 81 successful command receipts keep v1 base v2 ingress and v3 parsed TLS selection fields without projecting private context
- 81 preflight keeps five-kind versus command three-kind distinction, same Tx, exact binding and bounded time without issuing authority
- 81 plan validation preserves first refusal through manager intent CAS state numeric policy capability publication binding service and final window

### E234: apps/control/test/observation-service-owner-complete.test.ts

[Source](../../apps/control/test/observation-service-owner-complete.test.ts)

- 78 original public and legacy aliases metadata parsers receipts references and runtime-mutable limit identity remain exact
- 78 constructor captures default wall clock without reading it retains original flags and starts independent empty gates
- 78 request and actor admission are independent per-instance gates with two active slots exact monotonic cooldown and finally cleanup
- 78 original publication trace manager replay Scope head CAS prior clock quotas immutable revision head audit respond remains one transaction
- 78 authorized replay precedes every metadata lock current clock quota and immutable read while corrupt receipts fail before Scope
- 78 conflicts archive reuse corrupt prior history clock expiry seven-day quotas and safe exhaustion keep original refusal precedence
- 78 every command provider failure restores original immutable head audit receipt and Scope state without compensating writes
- 78 reads preserve manager authorization native immutable trust lifecycle precedence history truncation order and inert envelope
- 78 original read integrity refusals occur at their existing head revision audit clock and loss boundaries
- 78 invalid command identities config keys CAS and idempotency inputs refuse before admission and every public response retains native byte guard

### E235: apps/control/test/observation-service-store-complete.test.ts

[Source](../../apps/control/test/observation-service-store-complete.test.ts)

- 78 actual lower scope count head list SQL preserves exact lock choices bounds row projections and safe primitive refusal
- 78 lower immutable config decoding stays an assertion with original JSON byte digest time and revision gates rather than early full trust validation
- 78 lower head creation transition CAS lazy hooks and legacy zero-argument singleton preserve dynamic head and count overrides
- 78 lower audit eviction loss saturation history order bounds and recovery retain exact fixed SQL and transaction identity
- 78 real canonical MySQL quota includes archived IDs immutable64 audit256 loss retention scope ordering deferred config and static recovery preserve original tables
- 78 real canonical MySQL failure after every original native write rolls back Scope revisions heads audit pruning losses and original idempotency response

### E236: apps/control/test/probe-machine-bridge-owner-complete.test.ts

[Source](../../apps/control/test/probe-machine-bridge-owner-complete.test.ts)

- 87/88 public and legacy machine classes retain exact constructor identity and captured defaults versus dynamic claim clock
- 87/88 every bridge parses before connection identity and defers original owner and clock until successful identity
- 87 v1 projections retain exact owner arguments, original ACK identity and late receipt rejection after commit
- 88 v2 and v3 keep owner selection args, absent egress default, lazy descriptors and original missing flag guards
- 88 service selection parses and digests before receipt identity; v2 and v3 retain distinct timestamp caps and first refusal
- 87/88 status and typed receipts check each original identity time field without broadening binding or flag guards

### E237: apps/control/test/probe-permit-owner-complete.test.ts

[Source](../../apps/control/test/probe-permit-owner-complete.test.ts)

- 86 original public permit class preserves collaborator identity and captures default wall clock once without reading it
- 86 issue and machine input access order stay original; trusted deadline validates before touching input or transaction
- 86 actual issue chain retains manager budget plan selected/current machine resample minimum deadline writes history and sanitized views
- 86 actual consume validates before authorization, closes then persists history, preserves spent budget and rolls back every owner write fault
- 86 exact255/256 retained and three/four live issuance edges are distinct from257 persisted corruption and never refund closed reservations
- 86/87 actual permit consume commits before real claim adapter freshness rejection and retries cannot refund or recreate it
- 86/87 actual result ingestion commits before late result ACK rejection and exact retry returns original acceptedAt without another result/history write
- 86/88 real v2 and v3 permit owners stay committed after late claim/result ACK refusal and duplicate result retry never recreates authority

### E238: apps/control/test/probe-instance-owner-complete.test.ts

[Source](../../apps/control/test/probe-instance-owner-complete.test.ts)

- 79 canonical instances/registry/negotiator identities and dynamic pre/post-lock machine time remain exact
- 79 revoke performs both credential checks without direct capability and uses only original generation/instance match
- 79 inspect stale precedence and original frozen projection never reserve or replace
- 79 registry samples a newly installed clock only after owner return and retains committed ownership on ACK failure
- 79 hello preserves parser/identity/fingerprint order and dynamic time inside the original transaction

### E239: apps/control/test/probe-registry-owner-complete.test.ts

[Source](../../apps/control/test/probe-registry-owner-complete.test.ts)

- 80 canonical registry identities and original measurement array/type contracts stay unchanged
- 80 new proof clamps credentials and replays without renewal, while replacement accepts only older proof generation
- 80 v3 upgrades only the same live original proof and revoke preserves original marker spread and tombstones
- 80 inspect preserves v2 historical qualification predicate and v3 registeredAt plus all-three-capabilities predicate
- 80 exact slot/proof/time/evidence first-error precedence remains inside the original transaction
- 80 v2 eagerly samples ACK time before projection, v3 lazily samples after both date projections, with no extra read
- 80 default clocks stay captured at construction while parser and connection refusal stay before transactions

### E240: apps/control/test/probe-history-complete.test.ts

[Source](../../apps/control/test/probe-history-complete.test.ts)

- 186 native result dispatch retains every legacy family and staged v4 body/digest, with no public v4 parser widening
- 186 recorder preserves all five families with detached immutable challenge/proof/TLS/bytes and historical digest
- 186 recorder never backfills missing heads; duplicate, immutable identity, refusal and revision paths preserve history
- 186 Echo proof, request binding and rejected byte semantics remain closed without changing non-Echo history
- 186 real permit owner preserves result mutation/capture/clock/commit order and duplicate no-write for public v1/v2/v3
- 186 real permit owner failure/late clock/commit rollback retains original head and no partial result
- 186 inspect keeps original native service selection per family; staged v4 controlled ingestion remains unavailable before mutation
- 186 original permit revoke/withdraw owner actually captures Echo challenge and family selection in the same transaction after mutation
- 186 real MySQL0037 roundtrips family optional fields, immutable revisions, rollback, missing-head loss and sticky recovery

### E241: apps/control/test/probe-permit-validator-complete.test.ts

[Source](../../apps/control/test/probe-permit-validator-complete.test.ts)

- readiness47 public, legacy, canonical validator and L2 parser/digest aliases are exact objects
- binding closed sorted keys and equality preserve order independence and exact values
- binding validates every ID, counter and digest bound
- permit accepts exactly legacy, ingress, TLS and both staged echo key unions
- permit scalar bounds, state and closedAt retain exact original boolean rules
- TLS scope and validity window are inclusive and parser exceptions become false
- echo requires scope, v2, selected protocol, inclusive window and matching invocation challenge
- native invocation uses canonical ISO bytes and original key order before exact wire digest
- refusal order is synchronous: keys before values, context/challenge before common scalar reads
- echo context then challenge parsing precedes scope/window/digest and common-field evaluation
- validation samples no ambient clock, mutates no facts and creates no authority fields
- pure validator source imports only Core predicates, synchronous L2 codec and erased owner types

### E242: apps/control/test/probe-instance-mysql-acceptance.test.ts

[Source](../../apps/control/test/probe-instance-mysql-acceptance.test.ts)

- real MySQL serializes absent-slot races, replacement and repeated registration across independent application instances
- real MySQL rolls back first-slot seeds and replacement on downstream or maintenance failure; expired retries cannot renew
- real MySQL rechecks credential, session and capabilities before replay, while revocation remains possible after TCP withdrawal
- real MySQL quarantine preserves the stored generation, rejects resurrection and keeps non-instance state unchanged

### E243: apps/control/test/probe-registry-store-complete.test.ts

[Source](../../apps/control/test/probe-registry-store-complete.test.ts)

- 79/80 native/legacy stores keep identical SQL values, constructor defaults and recovery projection
- 79/80 lower native storage validation stays after locked row reads and before each write without moving seed timing
- 79/80 real canonical MySQL serializes first-slot allocation and shared qualification seed/upgrade without rotating a live instance
- 79/80 real canonical MySQL current-slot share lock and qualification update lock block independent owner writes until original transaction ends
- 79/80 real canonical MySQL rolls back each absent seed/replacement/proof/upgraded marker/revoke write and static recovery

### E244: apps/control/test/type-source-compatibility-complete.test.ts

[Source](../../apps/control/test/type-source-compatibility-complete.test.ts)

- 207 all nineteen named application leaves forward every exact type to the same canonical uninstantiated declaration
- 204 five runtime port groups retain every exact public canonical type declaration and original version leaf
- 202 direct public consumer imports/aliases use the same Accepted, Forward reference, Node authority and Member declarations
- 204/207 Policy imports and original DEFAULT_POLICY/Idempotency value imports retain exact leaves and declarations
- 202/204/207 changing erased import/export sources cannot change emitted runtime body, value imports or introduce a loading cycle
- 202/204/207 actual legacy runtime imports initialize and old server/bootstrap/phase/test paths remain resolvable

### E245: apps/control/test/path-template-owner-complete.test.ts

[Source](../../apps/control/test/path-template-owner-complete.test.ts)

- 54 original public legacy parser classes validators and mutable limits retain identity without construction time I/O
- 54 parser and stored hash keep terminal newline behavior canonical key order prototype and exception wrapping
- 54 current state and command digest helpers preserve independent input property order and original provider failures
- 54 complete command auth replay lock CAS prior-validation clock reference quota publication audit response prefix and failures
- 54 query first-refusal order bounded page corruption and archived immutable metadata without reference authorization
- 54 archival validates prior revision and clock then writes only changed archive audit response and preserves every original failure
- 54 native references sort every Node and Endpoint retain provider receiver original identity and first refusal prefix

### E246: apps/control/test/path-template-store-sql-complete.test.ts

[Source](../../apps/control/test/path-template-store-sql-complete.test.ts)

- 55 Path lower and zeroarg legacy
- 55 nullable reads Boolean archive raw JSON malformed decode and pagination retain original boundary without product validation
- 55 lower native module initialization audit UUID timing lazy publication encoding and legacy singleton dispatch preserve original async prototypes
- 54/55 real canonical MySQL original command atomicity preserves every table after each publication archival audit and idempotency write failure
- 55 real MySQL lower reads retain archived metadata literal prefix corrupt product JSON and read committed count then later page

### E247: apps/control/test/publication-public-types-complete.test.ts

[Source](../../apps/control/test/publication-public-types-complete.test.ts)

See the source scenario assertions or configured command steps.

### E248: apps/control/test/path-binding-owner-complete.test.ts

[Source](../../apps/control/test/path-binding-owner-complete.test.ts)

- 56 public and legacy parser expansion and owner retain identities closed input exact bounds and async public shape
- 56 original resolve and creation validate existing provenance then immutable template then caller reference without new authorization or transaction
- 56 every persisted provenance shape digest counter time template and current topology refusal precedes receipt or detach
- 56 accept preserves no-op before clock and bounds new time before append while original preserve/detach changes only pointer
- 56 original read and preview authorize in one transaction preserve failure prefix frozen flags and bounded contiguous history
- 56 reference query closed inputs page integrity and unavailable reasons retain original read-only owner sequencing
- 56 actual native default captures original Date.now without reading and final reference projection constructs fresh zeroarg Date after all reads

### E249: apps/control/test/path-binding-store-sql-complete.test.ts

[Source](../../apps/control/test/path-binding-store-sql-complete.test.ts)

- 56 PathBinding lower and legacy
- 56 original nullable JSON Boolean count-before-page and zeroarg async wrapper semantics remain unchanged
- 56 original sequence conversion refuses corruption before encoding and serializes before pointer write with original getter/spread order
- 56 real MySQL original Forward lock append and detach retain every immutable row and roll back each original write failure

### E250: apps/control/test/forward-metadata-owner-complete.test.ts

[Source](../../apps/control/test/forward-metadata-owner-complete.test.ts)

- Forward metadata complete real Forward/native execution/Path/Group owner chain shares one transaction and rolls back every late owner effect
- Forward metadata complete Path/Group apply manage-before-replay, same revision provenance and exact update order
- Forward metadata complete publication preview is read-only and supplied-Tx apply has no nested claim or receipt
- Forward metadata complete ingress preview/create/inspect/remove share original transaction and suppress inner receipts
- Forward metadata complete ingress migration allows only exact path/Profile and freezes expansion before acceptance
- Forward metadata complete restoration authorization precedes exact selection checks and keeps optional create resolver fallback

### E251: apps/control/test/path-group-owner-complete.test.ts

[Source](../../apps/control/test/path-group-owner-complete.test.ts)

- 57 canonical legacy parsers limits types and async owner methods retain exact public shape and closed selection semantics
- 57 commands preserve authorization replay locks clock sorted candidate validation quota writes receipt and rollback prefixes
- 57 candidate ordering restores priority and distinguishes historical archived and actor dependent live reference errors
- 57 original exact Path current and at provenance retain binding history no-op attachment business preserve topology detach and preview delegation
- 57 corrupt current history receipt and query records refuse without provenance writes or new authorization promises
- 57 exact persisted head revision clock CAS archival and bounded group history refusals precede further effects
- 57 actual owner module captures default clock and retains request digest property order without constructor effects

### E252: apps/control/test/path-group-store-sql-complete.test.ts

[Source](../../apps/control/test/path-group-store-sql-complete.test.ts)

- 57
- 57 raw null JSON Boolean pagination sequence and archived CAS edges refuse before later statements
- 57 zeroarg singleton wrappers retain async prototypes and revision-one dynamic count override while native effects remain lazy
- 57 publication config and provenance encoding retain exact lazy failure phases before immutable and pointer writes
- 57 canonical MySQL command locks quotas CAS original idempotency and every write rollback preserve all tables
- 57 canonical MySQL group provenance original Forward lock serialized sequences rollback pointer-only detach and read committed page

### E253: apps/control/test/path-publication-owner-complete.test.ts

[Source](../../apps/control/test/path-publication-owner-complete.test.ts)

- 58 original public aliases mutable limits hash rejection Set and strict plan parsers retain exact shape and digest rules
- 58 preview sorts native Forward lock traversal restores user positions and freezes only non-authorizing manual evidence
- 58 create retains manager replay scope quota replan digest id clock write response order and exact native request bytes
- 58 apply durable decision permits lost reply replay while original creator and recovery checks precede claim and CAS
- 58 apply refusal is durable after isolated rollback while unknown and every late attempt or receipt failure rolls back Forward changes
- 58 conditional compensation restores exact original source after cancel and leaves both immutable attempts and operation references
- 58 cancel and no-op preserve creator recovery replay CAS precedence and sample clock only for a new decision
- 58 unchanged Forward results require status200 null operation exact receipt provenance and keep a durable outer attempt
- 58 persisted attempts bound actor position kind request key digest time outcome uniqueness and compensation ancestry independently
- 58 read head plan attempt and operation validation rejects corruption before returning persisted-only flags or sampling a clock
- 58 native constructor captures original wall clock once defers UUID and retains six async prototype methods and request property order
- 58 actual Publication Forward native adapter Path and Group owners share one transaction grant checks immutable provenance and late rollback

### E254: apps/control/test/path-publication-store-sql-complete.test.ts

[Source](../../apps/control/test/path-publication-store-sql-complete.test.ts)

- 58 lower and zero-argument native stores retain literal SQL transaction receivers raw counts JSON and boolean projection
- 58 original create append cancel event SQL and quotas CAS each statement fault retain exact mutation order
- 58 legacy singleton preserves async subclass methods deferred dynamic count event hooks and exact lower result/error identity
- 58 canonical MySQL original owner and savepoint preserve every write rollback durable refusal reply replay and all immutable history
- 58 canonical MySQL batch head locks serialize CAS and retain cancel/recovery/revision predicates with a second quota check

### E255: apps/control/test/forward-command-owner-complete.test.ts

[Source](../../apps/control/test/forward-command-owner-complete.test.ts)

- Forward command complete canonical/legacy API, private compatibility shape and each required preparation method
- Forward command complete create and changed/no-op metadata preserve ordering keeps exact responses
- Forward command complete original authorization and provider failures retain first error and atomic owner state
- Forward removal complete execution lock wins over CAS/exhaustion and all later owner writes roll back
- Forward retry complete reread authority and multi-defect first errors precede preparation and preserve source identity

### E256: apps/control/test/ingress-batch-owner-complete.test.ts

[Source](../../apps/control/test/ingress-batch-owner-complete.test.ts)

- 60/61 canonical legacy classes parsers limits and async prototypes preserve original identity and frozen migration limits
- ${number} actual preview create retain owner authorization replay replan quota exact digest ID clock and public nonauthorization flags
- ${number} actual item command enforces manager recovery before replay CAS duplicates cancel eligibility and savepoint result validation
- ${number} cancellation no-op avoids time mutation origin historical state stays nonauthorizing get/list associate exact Operations
- 60 creation compensation conditionally deletes exact accepted snapshot and keeps rejected compensation eligible historical origin
- 61 action dispatch removes without target resolution compensates add/update only and derives exact update restoration lineage
- 60/61 parsers enforce origin provenance closed input immutable complete diff explicit false update-only path source reuse replacement and UTF8 bound
- 61 preview sorts exact origin and Forward locks separately retains source input order complete sorted diff and action order
- 60/61 immutable record validation refuses duplicate accepted Forward IDs attempt identity head counters hashes and invalid receipts
- 60/61 default clocks capture constructor Date.now without sampling and cancellation samples only after replay CAS and changed decision
- 60/61 original immutable parsers retain inclusive UTF8 storage bound and private closed-object error projections

### E257: apps/control/test/ingress-batch-mysql-acceptance.test.ts

[Source](../../apps/control/test/ingress-batch-mysql-acceptance.test.ts)

- 60/61 original MySQL owners and Forward path admission retain same-Tx every-write rollback durable partial refusal exact lineage conditional compensation recovery replay and independent accepted work

### E258: apps/control/test/ingress-group-ports.test.ts

[Source](../../apps/control/test/ingress-group-ports.test.ts)

- ingress publication authorizes before replay and rechecks sorted live template grants even for an unchanged definition
- a response persistence failure rolls back ingress head, immutable revision, audit and replay before a same-key retry
- historical ingress descriptions use persisted references but active resolution refuses archived groups before template disclosure
- ingress requires distinct ingress Nodes and common protocols before committing definition state

### E259: apps/control/test/ingress-group-owner-complete.test.ts

[Source](../../apps/control/test/ingress-group-owner-complete.test.ts)

- 59 original public and legacy parser limit class identities mutable limit descriptors and lazy own prototype methods
- 59 closed ingress config selection exact hash member ordering uniqueness and null prototype reject at original first boundary
- 59 explicit enabled input preserves dummy listener target parse order including extra final target parse and no omission default
- 59 immutable plan uses ordered distinct ingress Nodes common target protocols and enabled intent with inclusive UTF8 storage boundary
- 59 manager auth claim Scope head clock sorted template live references quota immutable audit response order preserve one original Tx
- 59 no-op publish revalidates sorted live references after clock and archive no-op samples clock but skips write audit
- 59 original parse identity CAS request conflicts time and both quotas preserve first refusal phase
- 59 persisted get describe resolve preserve default inactive history manager lock distinction missing digest outcomes and requested member snapshot order
- 59 live template lock versus persisted-only reference failures preserve missing archived digest profile and distinct ingress error differences
- 59 bounded pagination input and returned head integrity preserve validation before auth and no template or clock reads
- 59 constructor captures original optional wall-clock once and native request ISO digest preserve source timing and identities
- 59 original immutable head revision malformed fields missing current records future revision and bounded get reject at owner boundary
- 59 live group publication invokes actual sorted Node Profile Endpoint reference owner and preserves original refusal before write

### E260: apps/control/test/ingress-group-storage-complete.test.ts

[Source](../../apps/control/test/ingress-group-storage-complete.test.ts)

- 59 both lower and original wrapper SQL head locks raw generic JSON Boolean mapping pagination archived counts and audit UUID parameters
- 59 first immutable insert versus revision CAS quota affected row conflict encoding and original SQL failure phases
- 59 zero argument async singleton proxy preserves receivers dynamic lazy count overrides only for revision one and UUID initialization
- 59 canonical MySQL manager Scope head order double initial quota immutable revisions CAS archived counts and every successful write rollback

### E261: apps/control/test/forward-execution-registry-complete.test.ts

[Source](../../apps/control/test/forward-execution-registry-complete.test.ts)

- 115 public canonical and legacy registry/factory/executor are the same constructors and six-method contract values
- 115 registry rejects incomplete declaration before getters and preserves descriptor version duplicate then six-method refusal order
- 115 registry binds all six methods to each original owner and freezes captured registration without copying promise or argument values
- 115 native classifier keeps direct Relay multihop intent selection and original invalid-intent error before registry lookup
- 115 factory is a fresh frozen ordered triple holding exact supplied collaborators and executor fifth default stays original
- 115 real Direct adapter authorizes locks validates before allocation recompiles returned slots and retains no-op planning
- 115 Direct adapter preserves the original error and stops without retry at each authorize lock reserve transition callback
- 115 both Path adapters keep sorted authorize-lock order plan creation while disabled and conditional update authorization and planning
- 115 Path adapters propagate each owner failure at its original call and skip all following Node or plan work
- 115 executor preserves moved-Node state first recovery/revoked refusal sorted locks selected adapter and retry lock transition capacity receivers

### E262: apps/control/test/ingress-batch-store-complete.test.ts

[Source](../../apps/control/test/ingress-batch-store-complete.test.ts)

- ${c.number} actual lower and legacy stores retain exact SQL arguments lock choices raw JSON Boolean and bounded operations
- ${c.number} original create append cancel event dispatch preserves lazy indexes CAS predicates quota and affected row refusal
- ${c.number} named savepoint invokes classifier before rollback projection after release and propagates every provider failure
- 60/61 legacy async subclasses keep virtual quota dispatch without eager SQL or event side effects

### E263: apps/control/test/transit-negotiation-complete.test.ts

[Source](../../apps/control/test/transit-negotiation-complete.test.ts)

- 62 negotiation keeps legacy construction subclass lazy database access and exact native lock raw row query without I/O
- 62 owner preserves ordered session credential raw JSON capability history refusals one dynamic clock mutable ACK and rollback
- 62 HTTP binds verified TLS fingerprint to server Node before strict Transit request parsing and owner invocation

### E264: apps/control/test/transit-negotiation-sql-complete.test.ts

[Source](../../apps/control/test/transit-negotiation-sql-complete.test.ts)

- 62 real MySQL read-only negotiation locks raw machine in one Tx and releases on SQL clock JSON formatter failure without authority changes

### E265: apps/control/test/transit-legacy-bindings-complete.test.ts

[Source](../../apps/control/test/transit-legacy-bindings-complete.test.ts)

- 203/205 journal holds one real coordinator/store and forwards all arguments result failure and original database member transaction
- 203/205 delivery retains held offline journal but creates preview service/store at each original call and exposes only peek
- 203/205 negotiation constructs original machine reader per hello and retains member transaction and complete argument identities
- 203/205 module-time reservations keep one real owner exclusive resource/store and exact arguments with late default capacity
- 203/205 staging holds service original native resource/release/store and all member receivers currentOnly arguments and one database transaction
- 205 native Transit store adapters issue original locks on caller transaction without opening or replacing it

### E266: apps/control/test/public-contract-types-complete.test.ts

[Source](../../apps/control/test/public-contract-types-complete.test.ts)

- 117 actual Node canonical service command policy API effects and retained old test consumers keep their explicit local/public type sources
- 117/125/127/130/135 moved public facts each have one canonical declaration and no current private-path declaration augmentation
- 135 public and original HTTP factories remain identical with Hono available only from the explicit native transport entry

### E267: apps/control/test/transit-delivery-owner-complete.test.ts

[Source](../../apps/control/test/transit-delivery-owner-complete.test.ts)

- 63 legacy async entries original db coordination fields and lazy held planner retain one canonical public step implementation
- 63 enqueue rechecks mutable second-transaction state original stage actor order journal digest step clock bindings runtime and physical order before outbox
- 63 delivery machine differs from negotiation in credential ordering retains raw values and deferred JSON capability traversal
- 63 poll decodes before each row clock boot expiry issued short circuits and only sealed quarantined statuses exclude
- 63 report replay precedes highwater envelope freshness and locked coordinator then insertReceipt precedes strict acknowledge CAS
- 63 original offline step public projection retains terminal null action ordering sorted fields and errors without hardening
- 63 every delivery provider write and formatter failure restores original caller outbox receipts without calling coordination confirmation

### E268: apps/control/test/transit-delivery-store-complete.test.ts

[Source](../../apps/control/test/transit-delivery-store-complete.test.ts)

- 63 native codec aliases preserve JSON UTC digest parser order closed frozen preview and ACK key shapes without clock reads
- 63 canonical MySQL delivery keeps separate planner Tx and rolls back every real outbox receipt acknowledgement write retaining coordination and physical history
- 63 native delivery store all reads retain exact SQL column projections predicates lock differences arguments raw mutable rows and undefined
- 63 native outbox receipt and pending-only acknowledgement SQL preserve argument getter JSON timing and raw affected rows

### E269: apps/control/test/transit-coordination-owner-complete.test.ts

[Source](../../apps/control/test/transit-coordination-owner-complete.test.ts)

- 64 legacy journal owns original async entries db lazy dispatch subclass and canonical step identity without constructor I/O
- 64 begin preserves guard actor plan state freshness sorted unique sessions all physical locks prior journal and two independent insert clocks
- 64 journal raw highwater JSON and phase revision position identity membership digest short circuits precede freshness
- 64 peek confirm and fail retain phase-specific fresh ownership terminal and compensation rules
- 64 proof explicit verifier precedes Tx and all binding time sequence assignment condition checks precede verifier
- 64 authenticated proof is awaited before write and tail transitions preserve highwater exact previous digest revision CAS and strict affected row1
- 64 persist encode digest clock ordering and post-write step failures roll back original journal without history mutation
- 64 recovery follows supplied locked order validates each retained stage/body and atomically compensates without actor scope ownership freshness or reset

### E270: apps/control/test/transit-staging.test.ts

[Source](../../apps/control/test/transit-staging.test.ts)

- staging journal is detached immutable and retains independent Scope, generation, digest and Fence proof
- multi-hop MySQL state stores no executable or active states

### E271: apps/control/test/control-composition-complete.test.ts

[Source](../../apps/control/test/control-composition-complete.test.ts)

- 208 actual Control composition preserves field initializer and every original constructor group before deferred callbacks
- 208 explicit feature policy and resource bindings reach only their original consumers
- 208 deferred Relay and migration origin callbacks select the original late owner receiver and supplied transaction
- 208 shared execution callbacks retain exact path/direct routing and propagate owner failures without advancing
- 208 restoration reads current Path then group and refuses authorization before unrelated effects
- 208 capacity retains sequential Node cleanup and same-Tx supplied Forward owner and stops after each rejection
- 206 original command delegates retain owner receiver arguments return identity and request wrapper function identity

### E272: apps/control/test/transit-coordination-store-complete.test.ts

[Source](../../apps/control/test/transit-coordination-store-complete.test.ts)

- 64 native coordination adapter retains all exact original SQL projections argument order mutable raw first-row undefined list and result values
- 64 insert and dual-CAS update keep original field getter evaluation order and first exception before executor without encoding or clock
- 64 canonical MySQL rolls back insert update post-write step verifier dual-CAS refusals and every ordered multi-row recovery write while retaining all history

### E273: apps/control/test/path-topology.test.ts

[Source](../../apps/control/test/path-topology.test.ts)

- Direct path gives the same unique Agent identity a local direct role without a peer
- Current two-node Relay stays ingress then egress; activation remains downstream first
- Three- and four-Node paths derive transient transit roles and exact adjacent peers
- Roles belong to each Forward; an Agent can be ingress, transit and egress simultaneously
- Bounded path allows exactly the maximum without arbitrary cycles
- Invalid, repeated and missing Profile paths refuse planning
- Multi-hop planning does not bypass existing ADP/3 two-node execution boundary
- Topology compiler is detached, deterministic and never mutates the caller

### E274: apps/control/test/transit-reservations-db.test.ts

[Source](../../apps/control/test/transit-reservations-db.test.ts)

- strict reservation refuses same-Forward or foreign physical owner before overwriting fences
- new exclusively free ports acquire monotonically increasing Fences under locks

### E275: apps/control/test/transit-mysql-acceptance.test.ts

[Source](../../apps/control/test/transit-mysql-acceptance.test.ts)

- Transit real MySQL: atomic rollback, concurrent exclusivity and monotonic fences

### E276: apps/control/test/transit-owner-complete.test.ts

[Source](../../apps/control/test/transit-owner-complete.test.ts)

- 66 exclusive reservation sorted all Node locks then physical slots then raw count Number coercion and each late per-Node policy read
- 66 invalid Transit set precedes store raw Node row counts owner and safe fence limits retain original errors and each provider fault rollback
- 67 stage locks Forward authorizer latest sorted sessions before one dynamic clock authorization peers endpoint hop resources and insert
- 67 stage guards first-stage state generation session exact ten-second peer and authority boundaries reject before writes
- 67 stage every provider and final insert error rolls back original allocations without resource or journal publication
- 67 stage current peers choose greatest authority then lexical fingerprint and stored plan remains original offline compiler output
- 67 stage endpoint port iteration skips occupied candidates and already selected ports separately for each hop and protocol
- 67 abort verifies actor retained plan before terminal state coordination and shared release locks entire assignment set before any write
- 67 abort unused outer collaborators stay lazy null and every retained assignment is checked before release
- 67 abort lease plus5000 Snapshot lazy JSON and assignments retained proof preserve exact boundaries and refusal cutoff
- 67 abort missing changed second slot fence generation release race midrelease and stage CAS roll back all prior releases

### E277: apps/control/test/transit-store-sql-complete.test.ts

[Source](../../apps/control/test/transit-store-sql-complete.test.ts)

- 67 native staging
- 67 insert evaluates raw stage getters in original SQL property order before execution without encoding again
- 66/67 canonical MySQL same ledger capacity after allocation stage every write and abort every release CAS fault roll back exact original transaction

### E278: apps/control/test/resource-sql-complete.test.ts

[Source](../../apps/control/test/resource-sql-complete.test.ts)

- 8 original resource store SQL keeps every supplied receiver argument result absence and owner fence generation predicate
- 8 resource native constructors keep supplied explicit zero/default capacity no connection and original missing node/epoch semantics
- 8 real MySQL resource capacity failures roll back all reservations and preserve physical owner fence and old generation drain slots

### E279: apps/control/test/audit-store-complete.test.ts

[Source](../../apps/control/test/audit-store-complete.test.ts)

- 68 SQL projection retains every source owner immutable attribution and stable bounded ordering on supplied Tx
- 68 SQL node association follows immutable plans template revisions and accepted compensation rather than current routes
- 68 SQL admission decimal counters flags mapper timing and original failures retain the native projection seam
- 68 owner projection aliases policy array identity and zero constructor prototype compatibility preserve lazy decoding
- 68 migrated MySQL executes all fifteen audit SQL families and immutable node filters while access projection redacts raw JSON and preserves every table

### E280: apps/control/test/audit-service-complete.test.ts

[Source](../../apps/control/test/audit-service-complete.test.ts)

- 68 audit aliases native HTTP closed single values and constructor clock capture retain original evaluation
- 68 query validation priority covers canonical time window page filters clock failures and no transaction effects
- 68 audit row closure all scalar and semantic guards reject before result construction and roll back
- 68 merged ordering cursor digest closed canonical scope binding and one extra row preserve bounded frozen DTO
- 68 admission independent request and actor budgets cooldown eviction and original failures release every slot

### E281: apps/control/test/audit-attribution-native-complete.test.ts

[Source](../../apps/control/test/audit-attribution-native-complete.test.ts)

- 68 populated MySQL template and group attribution uses exact historical revision digest and Scope while binding and operation use immutable specs
- 68 populated MySQL batches attribute plan source proposed and add nodes while attempts distinguish accepted state rejected baseline compensation and strict error JSON types
- 68 actual owner and HTTP route populated native SQL share read-only caller Tx sanitize secrets enforce response bytes and refuse malformed raw rows without changing history
- 68 multi-row MySQL group and batch node attribution matches independent canonical JSON containment without correlated JSON_TABLE semijoins

### E282: apps/control/test/server-composition-complete.test.ts

[Source](../../apps/control/test/server-composition-complete.test.ts)

- 159 server preflight preserves feature-first and native lifetime/default/getter behavior before any dependency
- 159 server startup reads exact pool SQL, binds original resources and defers work until HTTPS listens
- 121/159 five original worker declarations retain feature flags, maintenance guard, serial retention and stop hooks
- 159 early failure and protected store-open retain original partial-start cleanup and exact error identity
- 159 HTTPS partial failures drain all admitted owners before closing dependencies and retain first startup error
- 159 close returns one promise and joins tasks requests server then every dependency even after a failure
- 159 native protected notification root preserves exact absolute and ancestor exclusion without touching files
- 159 early cleanup remains sequential and retains its original close-error precedence
- 159 all original option reads remain lazy repeated and ordered across assembly with exact optional feature arguments

### E283: apps/control/test/diagnostics-owner-complete.test.ts

[Source](../../apps/control/test/diagnostics-owner-complete.test.ts)

- 69 original public aliases timing bounds own async methods and captured optional native wall clock preserve lazy construction
- 69 operations deployment drains retirements and leases preserve original historical flags independent cleanup bounds and error advice
- 69 retained Probe v1 v2 v3 measurements current binding and result windows preserve original no staged echo support
- 69 retained Probe state context result binding digest time and TLS pin refusal matrices keep original scalar and acceptance precedence
- 69 actual retained framing catch wraps only parser errors while body projection stays outside catch and raw requestId rejects before framing
- 69 same-read support preserves stable traversal aliases nested safe fields exclusions shared projections and exact digest UTF8 bytes
- 69 actual source guards support bytes before bundle digest and final freeze then full response bytes at exact inclusive ceilings
- 69 request and actor admission enforce independent per-instance two128 cooldown budgets and release after original failure and completion
- 69 relay multihop paths adjacent protocol correlation target intent and missing evidence preserve configured order and eight-node boundary
- 69 exact full bounded pages keep truncated partial evidence flags and are never promoted to complete health
- 69 get authorizes then reads nine bounded families sequentially on one Tx samples one clock only after reads and preserves original failures
- 69 bounded family page and raw node guards retain validation point and duplicate row tuple refusal without extra reads
- 69 Node freshness all original reason precedence and exact credential Snapshot report session and clock endpoints remain passive
- 69 assignments preserve driver physical protocol tuple correlation phase absent freshness and owned reservation distinctions
- 69 original parse Forward projection preserves only owner input fields and clock range failures occur after every bounded read

### E284: apps/control/test/diagnostics-native-complete.test.ts

[Source](../../apps/control/test/diagnostics-native-complete.test.ts)

- 69 native retained framing dispatches v3 v2 fallback with one JSON encoding and original synthetic request ID then independent body projection
- 69 original zero argument async prototype proxy captures exactly one lazy lower store and preserves every argument reference return rejection
- 69 lower sequential SELECT families retain exact scope parameters ordering bounded lookahead and first original SQL failure without writes
- 69 lower original numeric flag error and bounded stored JSON projections reject malformed data before later decoding
- 69 lower Node optional runtime facts distinguish corrupt nested Snapshot report from fatal scalar flags and original digest-time mismatch
- 69 lower assignments read selected original identities then observations then drains and correlate exact tuple with bounded JSON typed fields

### E285: apps/control/test/station-owner-complete.test.ts

[Source](../../apps/control/test/station-owner-complete.test.ts)

- 70 original class value reason limit and storage-provider aliases preserve exact identity and frozen closed config/evidence/state shapes
- 70 operation evaluation original unknown firing clear precedence and successor recovery proof are preserved without execution authority
- 70 Node fresh baseline instance invalidation and credential renewal require original bounded evidence and never mistake unknown for recovery
- 70 policy event and audit validators preserve immutable binding mutable acknowledgement and refusal order
- 70 command auth replay lock CAS quota fact digest clock audit response sequence preserves disable shortcut and immutable replay
- 70 silence validates new deadline only after replay and acknowledgement CAS audit remains event revision rather than policy revision
- 70 each public command late write failure rolls back policy event audit and receipt on the original transaction
- 70 read authorization distinctions policy64 audit16plus1 history fixed cursor filters sorting loss and closed result refusal remain original
- 70 tick failures preserve latest candidate revision cutoff atomic append enqueue policy and guarded separate deferral while resetting ticking
- 70 actual service constructor captures clock per instance has independent admission state and monotonic2active128key finally cooldown with byte-bound refusal

### E286: apps/control/test/station-storage-complete.test.ts

[Source](../../apps/control/test/station-storage-complete.test.ts)

- 70 lower native exact counters flags JSON byte bounds and asserted projections preserve delayed full application validation
- 70 lower policy scope/count/list/get and legacy policyCount override keep original SQL limits order quota and one shared wrapper provider
- 70 lower event body association uses original denormalized mutable columns only after bounded body parse and callbacks never authorize raw body ack
- 70 lower history all fixed clauses keyset order limit+1 and audit/due/loss/ack projections preserve exact scope and CAS semantics
- 70 lower retained event and audit eviction preserve strict cutoff16 oldest1 guarded safe loss arithmetic and reject overfull states
- 70 passive forward facts select scoped latest matching revision fixed JSON scalar projections and delayed application binding without Runtime or full-body reads
- 70 passive Node report projections enforce exact runtime snapshot association canonical instants shape bounds and lazy no-report reads
- 70 actual storage binding preserves original assertion-only parser timing and captures one Audit error Set from supplied public array at module evaluation
- 70 real canonical MySQL policy64 audit256 event1024 retention16 strict cutoff CAS guarded deferral and lazy storage corruption retain original contracts
- 70 real canonical MySQL every successful native write followed by failure rolls back all four original tables including prunes losses CAS and state

### E287: apps/control/test/notification-vault-native-complete.test.ts

[Source](../../apps/control/test/notification-vault-native-complete.test.ts)

- 71 native vault stages immutable exclusive AES256GCM records with keyed deterministic reference and canonical AAD independent of Authority
- 71 native vault refuses every binding request reference and destination mismatch before publishing or replacing protected bytes
- 71 native open fails closed for noncanonical paths insecure ancestors root records key size mode symlinks links and unknown root entries
- 71 native envelope corruption duplicate keys canonical base64 AAD authentication and decrypted destination schema never return material
- 71 native parent identity permissions key replacement and record type/link tampering preserve impostor lock and sanitize failure
- 71 native stage exact one-day prune boundary maximum16 and endpoint reserved-slot quota preserve authenticated old files
- 71 native leases cap2 freeze data pin both references through pruning and close waits final idempotent release before scrubbing key

### E288: apps/control/test/notification-vault-effects-complete.test.ts

[Source](../../apps/control/test/notification-vault-effects-complete.test.ts)

- 71 actual vault module has no eager I/O refuses platform getuid relative/canonical path before effects and owns exact exclusive writer lifecycle
- 71 open failures scrub captured key close owned handle unlink only matching lock identity and preserve allowed resource refusal
- 71 actual bounded read pins original inode device owner mode size timestamp links across initial fd and named views and scrubs every failure buffer
- 71 parent guards distinguish key complete identity from lock identity and enforce uid ancestor modes type links and exact root inventory
- 71 actual stage durable write close exclusive link directory sync unlink directory sync order and all failed publication boundaries scrub bytes
- 71 actual cipher and decrypted parser failures zero plaintext read buffers and encoded bytes while serial failures remain recoverable
- 71 actual inventory counts every authenticated final/temp name caps4096 globally32 per endpoint and stage reserves two temporary slots
- 71 actual pruning rechecks captured file identity before unlink and never consumes leased kept or concurrently changed records
- 71 close waits original pending publication and final pin before unlink/key zeroing rejects new work and closes writer once

### E289: apps/control/test/notification-sender-effects-complete.test.ts

[Source](../../apps/control/test/notification-sender-effects-complete.test.ts)

- 71 native sender validates destination identity JSON object exact UTF8 bytes and signing key before capacity DNS or HMAC
- 71 native DNS refuses every forbidden IPv4 and IPv6 class malformed family empty overflow and mixed answers before authorization
- 71 native sender accepts public policy boundary neighbors resolves once pins first answer and signs exact immutable UTF8 payload
- 71 DNS error throw timeout and late callbacks retain exact pending capacity until native callback drains
- 71 monotonic total deadline covers DNS and authorization and suppresses late guard success or failure dispatch
- 71 response cap counts cumulative bytes accepts exact4096 denies4097 and distinguishes request creation refusal from dispatched unknown errors
- 71 all HTTP class boundaries redirect and retry statuses retain one request and original public outcome
- 71 dispatched settlement waits independently for real request and socket close before idle releases capacity
- 71 post-dispatch deadline and cancellation destroy owned response request socket and late response is destroyed

### E290: apps/control/test/notification-admission-complete.test.ts

[Source](../../apps/control/test/notification-admission-complete.test.ts)

- 71/72 original public and flat constructors prototypes parsers constants and storage providers are identical aliases
- 71/72 constructors capture default clock once retain injected providers and independent empty state without eager read or send
- 71/72 per-instance request admission holds two independent awaits releases on success rejection and synchronous throw in original finally
- 71/72 actor admission has independent two-active capacity key exclusion and monotonic completion-based cooldown despite wall rollback
- 71/72 actor key128 limit retains unexpired inactive keys purges at exact equality and never expires a still-active actor
- 71/72 public identity refusal precedes admission while transaction authorization storage and clock failures each leave cooldown and release active slots
- 71/72 original response-byte guards accept exact bound freeze nested values and refuse one extra byte before freeze
- 71/72 every public read and endpoint replay or mutation receipt passes the original byte guard and exposes no protected binding
- 71 native HTTP endpoint publish8192 and disable1024 UTF8 body bounds closed wrappers and query refusal retain admission and response headers
- 71 original endpoint config destination and pre-admission command bounds preserve closed sorted selections and lowercase32byte material

### E291: apps/control/test/notification-lifecycle-complete.test.ts

[Source](../../apps/control/test/notification-lifecycle-complete.test.ts)

- 72 every policy endpoint manager credential authority and recovery branch cancels before claim and never leases or dispatches
- 72 dispatch preflight rechecks every route rotation and uses dispatch-denied after immutable bound lease rather than stale authorization
- 72 acquisition and material refusal distinguish credential-unavailable from revoked dispatch and always physically drain before releasing an acquired lease
- 72 worker signs canonical payload order outside transactions records one unknown outcome and cleans bytes even send finish idle and release failures
- 72 every post-header claim and finish failure rolls back the original owner transaction and defers original header cutoff without resend
- 72 post-send stale completion preserves pending attempt and physical lease cleanup while backwards clock cannot write a result
- 72 run gate coalesces during send and physical idle and close stops new dispatch then joins running finally before returning
- 72 same-Tx route selection and every selected insertion failure roll back all earlier deterministic outbox rows without partial publication

### E292: apps/control/test/probe-runs-owner-complete.test.ts

[Source](../../apps/control/test/probe-runs-owner-complete.test.ts)

- 73 original recorder runs value storage aliases mutable state array frozen policy and lazy defaults preserve public prototypes
- 73 retained echo invocation keeps exact property reads references native ISO inputs and nonce without a new context or proof decision
- 73 recorder closed capture validates before history Scope and head locks and preserves missing nonissue loss without recreation
- 73 recorder original issue replay immutable association duplicate result and withdrawal recovery revision and time rules
- 73 history detail authorizes manager then captures one time before immutable row and loss reads with passive digest flags and inclusive retention
- 73 fixed history default and canonical windows filters order lookahead cursor query digest and second page retain captured time before auth
- 73 query first refusal canonical cursor validation cross-filter identity and bounded result rows never consult execution state
- 73 independent per-instance request and actor budgets release original errors use 128 keys and exact inclusive monotonic cooldown
- 73 captured optional native Date clock lazy defaults exact bounded bytes before freeze and every invalid time retain original helper phase

### E293: apps/control/test/probe-history-plan-native-complete.test.ts

[Source](../../apps/control/test/probe-history-plan-native-complete.test.ts)

- 73 native original scope losses lazy current override retention quota insert CAS binary filters and sticky recovery
- 73 native row projection closed metadata integer flags binding and result mapping refuse corruption before public values escape
- 74 native lock create expiry callbacks retention eviction loss capacity override CAS append and bounded projections
- 74 native loss integer bounds decision parser binary history due conditional defer savepoint classification and static recovery
- 73/74 legacy native prototypes lazy callbacks and original failures keep current read hooks same Tx and guarded capacity loss refusal
- 73 actual MySQL permit mutation plus same-Tx recorder every-write fault restores full database including scope locks losses revision and authority
- 74 actual MySQL finite owner create run cancel savepoint durable refusal replay and every native write rollback preserve unrelated authority history
- 73 actual MySQL exact1024 quota oldest tie eviction bounded16 expiry guarded losses and scoped keysets roll back every write
- 74 actual MySQL32 finite capacity all active refusal bounded expiry eviction decision cascade guarded loss and due header CAS preserve finite authority
- 74 actual MySQL competing scheduled owners serialize locked headers and uncertain later write defers in a separate Tx without surviving permit history or decision

### E294: apps/control/test/probe-plans-owner-complete.test.ts

[Source](../../apps/control/test/probe-plans-owner-complete.test.ts)

- 74 original class config state arrays storage callbacks and Probe acceptance APIs preserve alias mutability lazy flags clocks and own methods
- 74 exact finite Direct kinds config input canonical ISO interval expiry closed TLS service no staged echo and original disabled acceptance receipt
- 74 finite head decision loss private helpers and view bytes preserve closed records counters cancellation recovery times and digest associations
- 74 preview authorizes manager first validates finite window before issuer then checks binding kind point timeout TLS and second clock
- 74 create manager replay window original preview digest Scope lock resample UUID immutable head store response order
- 74 manual run keeps manager CAS retention before time then creator authorization and original issuer in savepoint before append head and response
- 74 recognized refusal mapping rollback release transient retryable limitation creator revocation and count completion precedence preserve original decisions
- 74 manual cancel no-op run CAS retention recovery clock and after-decision expiry precedence retain original deadlines
- 74 scheduler one running Promise cutoff initial creator before Scope locked revision and due state checks then issues as original creator
- 74 scheduled expiry precedes revoked creator and stale mode revision cutoff recovery candidates do not decide or renew finite expiry
- 74 scheduler uncertain outer failure conditional deferral uses original header cutoff separate Tx no duplicated decisions and close waits failures
- 74 detail share lock validates ordered exact decision count accepted counters unique permits actor time and nonauthorizing historical envelopes
- 74 finite history canonical fixed windows original manager filters lookahead cursor keysets sorting duplicates retention losses and byte freezing
- 74 independent request actor two128 budgets exact cooldown original finally and captured optional Date clock byte guard retain phases

### E295: apps/control/test/telemetry-service-owner-complete.test.ts

[Source](../../apps/control/test/telemetry-service-owner-complete.test.ts)

- 75 77 legacy application and rollup value entrypoints retain exact owner identity without a competing implementation
- 75 76 77 each original owner captures one default clock source lazily and preserves explicit clocks independent admission and native ACK dispatch
- 77 original mapped observations preserve exact accepted order membership markers and Probe attempted conservation
- 75 ${family} intake preserves same-transaction authentication mapping append rollup order and exact replay receipt
- 75 ${family} machine identity session clock rate epoch sequence and persisted-head guards precede mapping
- 75 ${family} missing suspended and aged mappings reject points while malformed trusted provenance aborts the batch
- 75 ${family} history verifies stored digest and provenance then computes exact continuous deltas without current-binding authority
- 75 ${family} history quality separates resets gaps terminal unavailable and historical sessions
- 75 ${family} history rejects corrupt row duplicates foreign nodes invalid window and cooldown before unsafe reads
- 76 ${family} original private ACK failure after raw and accepted rollup callbacks restores caller transaction and releases active key
- 76 ${family} stored nanosecond provenance forbids a point after exporter even when both truncate to the same SQL millisecond
- 75 ${family} history validates native body and wide arithmetic while preserving gap reset historical freshness and CPU unavailable meaning
- 75 ${family} history rejects persisted digest association duplicated epoch sequence and out of order latest rows
- 75 ${family} raw intake retains exact clock rate head and epoch guard precedence with old-session rollover
- 75 ${family} reader map has128 slots rejects clock rollback cooldown and frees expired slots at exactly1000ms
- 75 ${family} append rollup and private ACK faults restore same-transaction head raw rows and accepted observations with no compensating write

### E296: apps/control/test/telemetry-store-complete.test.ts

[Source](../../apps/control/test/telemetry-store-complete.test.ts)

- 75 76 77 lower recovery quarantines only observation cursors and retained history flags in the original ten-statement order
- 76 ${family} raw store maps node nullable runtime state and head lock with exact bound SQL
- 76 ${family} raw append strictly expires 256 evicts oldest at quota inserts complete body then advances head
- 76 ${family} raw history latest pruning retain inclusive window deterministic order and reject limit interpolation
- 76 observation pool has two nonqueued slots uses original transaction commits releases and runs guards before begin and commit
- 76 observation pool rolls back begun failures preserves domain errors destroys broken rollback and rejects missing transport
- 75 actual Forward mapper validates current immutable native Snapshot provenance and uses only supplied transaction SELECTs
- 75 actual Forward mapper resolves retired published lease provenance and prevents duplicate retirement authority
- 75 actual Probe mapper validates native snapshot binding and current registered instance independently from reported observation
- 75 actual Forward mapper preserves native Relay and Multihop ingress provenance plus rejects cross-scope config binding
- 76 ${family} mapped raw append binds provenance and digest evicts bounded oldest surplus then advances accepted rejected head
- 76 ${family} mapped node collection deduplicates requests rejects foreign rows and locks bounded accepted rejected counters
- 76 ${family} mapped history and latest pair use inclusive retention stable order null-safe counter epoch and strict previous tuple
- 76 77 real canonical MySQL raw and rollup every successful native write followed by failure restores all twelve telemetry tables

### E297: packages/contracts/test/telemetry-specification-complete.test.ts

[Source](../../packages/contracts/test/telemetry-specification-complete.test.ts)

- four handwritten telemetry parsers independently agree with their specification samples and ACK fixtures and preserve immutable detached data
- the exact four Agent native encoder fixtures satisfy the separate TS handwritten parsers and specification schemas
- handwritten telemetry keeps native uint64, host arithmetic and point provenance beyond specification-only checks

### E298: apps/control/test/telemetry-rollup-values.test.ts

[Source](../../apps/control/test/telemetry-rollup-values.test.ts)

- rollup wide sums and precise counter increments preserve immutable prior bucket
- rollup attribution uses receipt interval end across minute and hour boundaries
- rollup reset gap overflow and terminal precedence never invents an increment interval
- rollup rejects cross-bucket or cross-series reuse before mutating existing values

### E299: apps/control/test/telemetry-rollup-owner-complete.test.ts

[Source](../../apps/control/test/telemetry-rollup-owner-complete.test.ts)

- 77 native Host projection pairs metrics and CPU context while missing CPU never invents an increment interval
- 77 bucket parser preserves reachable wide sums and rejects decimal128 maximum when count and metric extrema cannot explain it
- 77 aggregate history authorizes in its transaction and returns canonical exclusive pagination without issuing authority
- 77 aggregate Forward hourly queries keep scope-family loss attribution and original default aligned minute windows
- 77 aggregate query rejects incompatible families unaligned UTC windows malformed cursors unknown keys and oversized limits before storage
- 77 aggregate history detects persisted scope family target ordering duplicates suspension and loss corruption
- 77 aggregate capacity preserves over-budget inspection and exact wide logical budgets plus reader cooldown
- 77 aggregate four request slots reject the fifth and release slots after success and failure
- 77 aggregate reader keys retain128 cooldown entries use exact1000ms cleanup and reject canonical cursor target mismatches
- 77 original zero-argument SQL wrapper initializes one native values provider lazily and all instances delegate caller transaction to it
- 77 lower aggregate history uses exact target series cursor filters exclusive bounds deterministic ordering and limit plus one
- 77 lower aggregate loss sums are decimal128 and capacity inspection accepts over budget data but rejects corrupt counts
- 77 lower aggregate append validates empty duplicate mixed-owner batches before SQL and persists head buckets cursor markers in order
- 77 lower aggregate prune chooses oldest scope serializes it expires 128 cursors with saturated grouped loss and spends remaining 256 budget
- 77 lower aggregate append evicts minute hour and cursor oldest rows excludes incoming keys saturates losses and binds deletions
- 77 lower aggregate Scope row and head caps fail before persistence and exact-count eviction guards abort corrupt selection
- 77 lower aggregate cursor expiry resets baseline only after strict TTL while existing bucket recovery suspension stays sticky

### E300: apps/control/test/console-read-owners-complete.test.ts

[Source](../../apps/control/test/console-read-owners-complete.test.ts)

- 85/89 public legacy mixed entry class rules version and mutable defaults retain original identities
- 85 synchronous callback exact node null ISO JSON Boolean Number mappings return mutable original DTOs
- 85 original Forward Operation and candidate callback conversions and capability order stay synchronous and clock-free
- 85 overview dynamic currentIso and diagnostics single now remain inside original synchronous callbacks with exact age lease failures and maximum50
- 85 native overview uses late zero-argument Date while diagnostics dynamically reads Date.now once and preserves source time formatting order
- 89 feature constructor spread freeze and fresh mutable capability copies retain original exact auth and no providers
- 89 Forward status latest Operation metadata order resolved Forward identity and error prefixes stay exact with no replacement state validation
- 85 legacy zero-argument SQL facade loads one original reader/store and forwards exact synchronous collaborators without eager projections

### E301: apps/control/test/transport-query-owner-complete.test.ts

[Source](../../apps/control/test/transport-query-owner-complete.test.ts)

- 90 original class contracts version mixed projection identity required dependencies and async descriptors remain unchanged
- 90 original synchronous profile and reference callbacks preserve raw revision JSON Boolean null fallback and Number after item mapping
- 90 metadata and resolver refusals precede reference projection and page-wide count duplicates precede each spec parse
- 90 final native currentIso retains dynamic zero-argument new Date after all mapping before output freeze and propagates final format failures
- 90 zero-argument SQL reader loads only original store/model/values once and preserves lazy receiver arguments results and failures

### E302: apps/control/test/tunnel-query-owner-complete.test.ts

[Source](../../apps/control/test/tunnel-query-owner-complete.test.ts)

- 91 public legacy old mixed entry version type aliases required constructors and original async methods are identical
- 91 original raw node endpoint peer and reference callbacks preserve synchronous getter conversion order null Number Boolean JSON and mutable DTOs
- 91 constructor captures default Date.now function while explicit clock samples once after Node validation and never for references
- 91 exact peer getter and ISO order keeps endpoint parse narrow catch and formats original intersections after one now
- 91 zero-argument native SQL facade lazily forwards exact raw timestamps same receiver callbacks and original error identity

### E303: apps/control/test/access-node-catalog-owner-complete.test.ts

[Source](../../apps/control/test/access-node-catalog-owner-complete.test.ts)

- 92/93/94 canonical and legacy class/version/constructor/method contracts retain exact public identities and effects getter refusal order
- 92 member snapshots token omission and exact native hash/request identity before owner authorization while no-change still runs effects
- 92/93 exact truthy authorization cutoff projection preserves zero null negative invalid and post-mutation rollback semantics
- 92 Node grant response uses original command subject and allowed while effects receive exact raw owner grant
- 92/93 replay is gated by current authorization and returns original response identity without writers effects or audit; each later error aborts all owner state
- 93 Node ID refusal precedes snapshot getters and original policy/revoke request identity audit and receipt retain one detached frozen intent
- 94 native catalog keeps every descriptor order shallow spread nested identity process flag defaults and deep freeze on the caller authorization transaction

### E304: apps/control/test/tunnel-relay-facades-complete.test.ts

[Source](../../apps/control/test/tunnel-relay-facades-complete.test.ts)

- 95 NativeTunnels retains original public legacy API four required collaborators and singleton management without constructor work
- 95 six NativeTunnels forwarding methods preserve exact argument count references receiver synchronous error and direct promise identity
- 95 NativeTunnels list uses call then spread overrides tunnel ID and preserves metadata references before recursive freeze
- 95 NativeTunnels get retains config identity ordered topology ingress null and prior endpoint revisions for zero one two and four nodes
- 103 RelayPlans parses before any transaction then refuses absent path or locked Profile without authorization or reservation
- 103 RelayPlans uses management authorization in one Tx and the original preview ID revision enabled projection for both result unions
- 95/103 actual ControlApplication assembles original four tunnel owners and one required RelayPlans without native construction IO

### E305: apps/control/test/native-codec-complete.test.ts

[Source](../../apps/control/test/native-codec-complete.test.ts)

- readiness98 exact public/legacy class, API response/port aliases and constructor method surface
- required reconcile effects refuse construction without touching any provider
- native digest frame, command/request key order, frozen identity and original provider receivers
- unchanged grant returns 200, persists receipt and never reconciles; replay keeps exact response identity
- original ${failed} failure stops the sequence and rolls back all original transaction effects
- validation preserves actual actor/scope/profile/subject/revision/Boolean/key order before digest or transaction
- canonical command imports original digest and actual current consumer wires exact supplied owners

### E306: apps/control/test/node-observation-native-complete.test.ts

[Source](../../apps/control/test/node-observation-native-complete.test.ts)

- 102 public legacy passive host rules frozen limits and raw contracts retain exact identities
- 102 native lifecycle clock encoder and ISO adapters resolve current globals and preserve exact callback delay handle and receiver
- 102 actual host records one bound reader and original monotonic controller wall timer projection bytes release clear listener order
- 102 input and already-cancelled refusal precede clocks while timeout retains the owned reader slot until its real settlement
- 102 original error masking sanitizes known source errors preserves cancellation reason and releases on projection encoder or source failures
- 102 original report rules retain reason precedence distinct stale status and exact ISO order with bounded public provenance copies

### E307: apps/control/test/console-serving.test.ts

[Source](../../apps/control/test/console-serving.test.ts)

- same-origin console assets retain content types, no-store and strict CSP
- console API refuses anonymous scoped list access

### E308: apps/control/test/console-module-assets.test.ts

[Source](../../apps/control/test/console-module-assets.test.ts)

- every distributed Web JavaScript leaf is served byte-exactly with security headers and fixed-path refusal

### E309: apps/control/test/reconciliation-complete.test.ts

[Source](../../apps/control/test/reconciliation-complete.test.ts)

- 116 canonical public legacy reconciliation classes remain exact constructors without clocks defaults or eager provider calls
- 116 Profile keeps original reference order allowed short circuit enabled transition accept capacity and exact owner receivers
- 116 member lock reread uses latest Forward skips deleting or reassigned state and keeps disabled allowed capacity plus exact cutoff iteration
- 116 member rejects candidate Scope before lock and latest reread Scope before authorizer while every provider error stops and rolls back supplied transaction
- 116 Node Grant filters unrelated paths preserves reference and affected-Node insertion order unconditional validation no-op and nullable maximum
- 116 Node facts refuse before references then policy uses original source actor and deny after accept with whole-Node capacity before cutoff
- 116 whole-Node revocation never calls allowed transition per-Forward capacity denial or whole-Node capacity and retains exact authorizer cutoff result order
- 116 Profile Grant and Node policy and revocation propagate every callback failure and retain rollback in the original caller transaction

### E310: apps/control/test/snapshot-source-complete.test.ts

[Source](../../apps/control/test/snapshot-source-complete.test.ts)

- 118 original public legacy classes constructor prototypes readonly source contracts and native clone remain exact aliases
- 118 registration preserves complete declaration ID driver role ownership refusal messages and first-error precedence
- 118 registry binds original source receiver at construction snapshots declarations freezes registrations and performs no eager collect clone or clock reads
- 118 direct and every contribution clone freeze before the next await with source-ID order context copy dynamic clone lookup and final ID sort
- 118 dynamic native clone failures retain original identity at direct or contribution boundary and stop subsequent owners
- 118 contribution shape and ownership refuse before conflicts and each assignment logical physical conflict stops the next source
- 118 Relay source captures original member callback without reading plans until collection and retains literal frozen role catalog and original contribution references

### E311: apps/control/test/machine-codec-complete.test.ts

[Source](../../apps/control/test/machine-codec-complete.test.ts)

- 119/128 constructor rejects every missing or wrong-kind clock time and machine method in original getter order before Now policy or effects
- 128 native protocol and capability includes getters short circuit with exact original ControlError class code status and text
- 128 Host Hello keeps native protocol then foreign Node then capability refusal before transactions
- 128 native Hello and ACK are fresh ordered mutable projections with no validation parsing cloning freezing or time sampling
- 119/128 Host Hello preserves boot getters operation order one format and Now codec receivers and detached policy
- 119/128 custom machine time and digest methods retain receiver and original error identity at their original effect boundary
- 128 ACK projection retains digest prior boot sequence status and key order and allocates before duplicate integrity refusal
- 119 native parse and ISO codecs preserve zero fractions offsets invalid NaN Infinity and Date coercion rather than introducing validation
- 119 explicit Host clock is captured once while legacy RuntimeController looks up replacement Date.now dynamically
- 119 explicit custom clocks retain zero fractional and nonfinite samples at the actual Hello projection without extra validation
- 119 native policy time conversion retains one constructor sample and original RangeError for nonfinite values
- 119 publication samples after original awaited state and snapshot reads and retains the publication sample through later awaits
- 119 Host publication retains every hold reuse deadline time sample and authority parse ordering including revoked short circuit
- 119 Host report freshness preserves snapshot/current short circuits exact skew boundary nonfinite parse and one post-drain sample
- 119 worker claim guards retain original Now short circuits before publication and after compilation

### E312: apps/control/test/runtime-publication.test.ts

[Source](../../apps/control/test/runtime-publication.test.ts)

- publication hold requires a live same-session lease beyond the exact five-second boundary
- publication reuse retains exact renewal and credential/Relay caps without importing host authority
- publication deadline chooses the earliest authority and keeps the empty withdrawal policy deadline

### E313: apps/control/test/foundation-compatibility.test.ts

[Source](../../apps/control/test/foundation-compatibility.test.ts)

- legacy and public errors, request lifecycle and native policy retain exact object identity
- public request lifecycle drains after a rejected application action and preserves its error identity
- bootstrap reads both environment values before validation and closes only an opened database
- bootstrap awaits cleanup and a cleanup failure retains finally error precedence

### E314: scripts/phase2/probe.ts

[Source](../../scripts/phase2/probe.ts)

See the source scenario assertions or configured command steps.

### E315: apps/control/test/control-startup-complete.test.ts

[Source](../../apps/control/test/control-startup-complete.test.ts)

- 156 structural/public/native bindings and default startup option values preserve identity and order
- 156 port and competing feature refusals occur at original read stage
- 156 production release gate short circuits, required arguments evaluate left to right and release errors stop startup
- 156 successful release remains awaited and rereads multihop rather than capturing its first value
- 156 native Number/default and exact flag values retain permissive original conversions
- 156 every required server option fails before later option reads/start/log/signals
- 156 repeated environment reads, explicit feature flags and shallow policy spread remain observable
- 156 SIGINT before SIGTERM and close admission guard precedes await
- 156 policy getter and enumerable spread run after option evaluation without eager policy access
- 156 rejected close stays once-only and retains the original uncaught rejection
- 156 native leaves have no product import and main binds original server/release

### E316: apps/control/test/control-client-complete.test.ts

[Source](../../apps/control/test/control-client-complete.test.ts)

- 157 ${entry.args[0]} ${entry.args[3] ?? ''} exact command method/path/body/key and opaque providers
- 157 public generic signature and native identity preserve strict parse binding
- 157 required env/scope precede command dispatch; every required positional argument preserves original usage refusal
- 157 provider failures preserve identity and stop without catch, retry or later output
- 157 native HTTPS exact headers, UTF8 body length, end, chunks, statuses, timeout destruction and original errors
- 157 native argv/env/URL/encoding/strict JSON/files and main composition retain original implementations

### E317: docs/changes/FR-0021-echo-receipt-history-completion.md

[Source](../../docs/changes/FR-0021-echo-receipt-history-completion.md)

See the source scenario assertions or configured command steps.

### E318: apps/control/src/modules/probe-owner/permits.ts

[Source](../../apps/control/src/modules/probe-owner/permits.ts)

See the source scenario assertions or configured command steps.

### E319: apps/control/src/modules/probe-history-owner/service.ts

[Source](../../apps/control/src/modules/probe-history-owner/service.ts)

See the source scenario assertions or configured command steps.

### E320: apps/control/src/infrastructure/mysql-probe-history-store.ts

[Source](../../apps/control/src/infrastructure/mysql-probe-history-store.ts)

See the source scenario assertions or configured command steps.

### E321: apps/control/migrations/0037-probe-echo.sql

[Source](../../apps/control/migrations/0037-probe-echo.sql)

See the source scenario assertions or configured command steps.

### E322: scripts/test/foundation-boundary-policy.test.mjs

[Source](../../scripts/test/foundation-boundary-policy.test.mjs)

- L0/L1 reject value, type-only, inline import type and re-export dependencies on outer owners
- dynamic import, require, triple slash native types and computed references cannot bypass lower boundaries
- package private paths and direct private Core leaves remain closed
- unclassified production paths are refused instead of inheriting a module-directory exemption
- cross-owner private value/type/re-export paths and example private imports are rejected
- framework private implementations and direct storage are not product extension points
- lower platform globals/types and native date/parser operations are rejected
- Go lower contracts refuse native tags, parser imports and platform clock reads
- independent browser owners require explicit effects instead of native globals or private sibling services
- named operator bindings remain classified but cannot reach product-private implementation leaves
- classification and binding records cannot exempt lower native dependencies or historical imports

### E323: scripts/check-foundation.mjs

[Source](../../scripts/check-foundation.mjs)

See the source scenario assertions or configured command steps.

### E324: scripts/test/foundation-boundary-completeness.test.mjs

[Source](../../scripts/test/foundation-boundary-completeness.test.mjs)

- the actual production source graph obeys the declared inventory including Web example operator and Go roots
- all static type and value reference syntaxes retain lower direction and concrete-provider refusal
- L0 infrastructure globals and L1 root or private package subpaths cannot become injected contracts
- L2 native adapters refuse reverse product value and type references while retaining lower contracts
- Control and browser product owners reject native platform branches including computed and aliased reads
- Go product owners reject native OS and architecture selection through imports aliases dot imports and build files
- only explicitly named bindings retain native selection and lower classifications cannot be exempted by a binding label

### E325: apps/control/test/foundation-extension.test.ts

[Source](../../apps/control/test/foundation-extension.test.ts)

- the public extension authorizes the caller transaction and returns detached immutable native-format intent
- the public extension refuses invalid identities and closed-format input before transactions and never logs denied intent
- the public extension completes despite logger failure and request draining waits for its actual transaction

### E326: packages/core/test/public-source-closure.test.ts

[Source](../../packages/core/test/public-source-closure.test.ts)

- protected Core has exactly four implementation files one package entry complete public names and no private ipv4Bytes subpath
- every independently versioned Control framework storage product native and browser public declaration matches its own source and runtime export
- all independently versioned Agent declarations preserve their exact native or lower public constant and typed Host alias
- native ADP3 admission refuses legacy input while the original internal ADP2 projection and lower generic shapes remain available
- saved package support assets and actual deployment COPY embed fs and source replacement inputs retain their declared consumers

### E327: packages/contracts/test/contracts.test.ts

[Source](../../packages/contracts/test/contracts.test.ts)

- authoritative valid: ${item.name}
- authoritative invalid: ${item.name}
- shared conformance: ${item.name}
- RFC 8785 number and Unicode sorting vectors
- bounded JSON fails closed before any domain state is used
- precise timestamp comparison and lease upper bound
- CIDR requires a network, proper prefix, and IP family

### E328: packages/contracts/test/adp3.test.ts

[Source](../../packages/contracts/test/adp3.test.ts)

- shared complete ADP/3: ${item.name}

### E329: packages/contracts/test/relay.test.ts

[Source](../../packages/contracts/test/relay.test.ts)

- relay profile and open are strict, bounded and immutable values
- relay rejects downgrade, malformed limits and same endpoint identities
- relay rejects duplicate keys and unknown control fields
- shared Relay contract: ${item.name}
- shared ADP/3 resource: ${item.name}

### E330: packages/contracts/test/distribution-assets.test.ts

[Source](../../packages/contracts/test/distribution-assets.test.ts)

- all native schema copies preserve source bytes modulo checkout line endings, including the separate execution generator output
- all twenty-one schema resources compile every local definition without remote resolution
- all eleven declared package entries initialize through their actual public export targets
- staged native package initialization refuses missing or malformed schema/catalog while lower common entries remain loadable

### E331: packages/contracts/test/policy-entrypoints.test.ts

[Source](../../packages/contracts/test/policy-entrypoints.test.ts)

- the pure Policy entry has its own version and preserves thirteen required mutable numeric fields
- old package entries retain the original frozen Policy default identity values and insertion order

### E332: packages/contracts/test/native-assets-complete.test.ts

[Source](../../packages/contracts/test/native-assets-complete.test.ts)

- the real schema generators check all ten exact schema/declaration targets and execution aliases without rewriting other source roles
- the actual Transit comparator accepts uniform checkout CRLF and rejects each parity and contract-only Runtime mutation
- all eleven actual package entries preserve complete eager dependency failure and telemetry specification independence in the distributed COPY tree

### E333: packages/contracts/test/native-drivers.test.ts

[Source](../../packages/contracts/test/native-drivers.test.ts)

- native catalog is immutable, versioned, and distinguishes business from physical carrier protocols
- catalog parser refuses new drivers, executable fields, duplicate keys, versions and unbounded metadata

### E334: agent/internal/observationwire/native_wire_complete_test.go

[Source](../../agent/internal/observationwire/native_wire_complete_test.go)

- TestFourNativeTelemetryEncodersPreserveLiteralWireFixtures
- TestFourNativeTelemetryAcknowledgementsRequireOriginalSentIdentityAndClosedReceipts
- TestNativeTelemetryEncodersPreserveOriginalPageIdentityAndSizeLimits

### E335: packages/core/test/forward.test.ts

[Source](../../packages/core/test/forward.test.ts)

- canonical intent normalizes protocol order, hostnames, IPv6 and empty direct paths
- parser returns deeply immutable values detached from caller-owned objects
- path and locked Transport reference form one valid relay intent
- rejects empty, duplicate or unsupported protocol sets and malformed object shapes
- validates endpoint ports at boundaries and rejects coercion or ranges
- target hostname and IP validation leaves network access policy to outer modules
- non-ASCII hostname input is rejected before case folding can convert Unicode into ASCII
- rejects unmanaged fields at every intent boundary
- Node and Forward identities and revisions obey the shared primitive bounds
- CAS decisions advance changed intent, preserve identity and leave the current object intact
- canonical no-op preserves revision, including at counter exhaustion
- controlled change rejects server-managed fields and invalid replacements
- replacing intent parses and detaches the new spec before returning a decision

### E336: apps/control/test/control-bootstrap-complete.test.ts

[Source](../../apps/control/test/control-bootstrap-complete.test.ts)

- bootstrap retains exact public/native surfaces and original argv/env lookup defaults
- bootstrap destructuring ignores extra values and keeps arguments/env/provider receiver and exact refusal order
- bootstrap async stage failures retain exact identity while awaited close can supersede each original failure
- original Identity bootstrap validates before transaction and inserts account scope and owner in the same supplied transaction
- actual bootstrap entry keeps the native database alias and original Identity construction at callback invocation

### E337: apps/web/test/model.test.mjs

[Source](../../apps/web/test/model.test.mjs)

- scope IDs, ports and CIDRs reject invalid local form inputs
- Direct form only offers authenticated capabilities and authorized listener slots
- Operation state never derives healthy from accepted deployment
- list query encoding preserves server-side filters across bounded pages
- candidate pages keep only bounded current rows and freshly revalidated selections

### E338: apps/web/test/model-effects.test.mjs

[Source](../../apps/web/test/model-effects.test.mjs)

- model aliases preserve function identity and factory initialization does not read native time or effects
- native model credential evaluation preserves getter and parser lookup order even for invalid dates

### E339: apps/web/test/native-model-complete.test.mjs

[Source](../../apps/web/test/native-model-complete.test.mjs)

- all ten legacy model exports retain signatures and pure alias identity without eager native clock reads
- native credential expression captures Date.parse before the second getter even when that getter replaces it
- Direct capability keeps the original guard order and reads credentials only after every authorization fact
- Direct form preserves property and String Number coercion order before listener then target authorization
- native query preserves URLSearchParams defaults Object.entries getter and String coercion ordering
- pure model helpers retain bounded ports CIDRs protocol ordering candidate replacement tones and pagination

### E340: apps/web/test/relay-model.test.mjs

[Source](../../apps/web/test/relay-model.test.mjs)

- Relay Profile builder follows bounded native-relay contract
- Relay Endpoint accepts distinct TLS/TCP ports and bounded peer host facts
- Relay spec binds two distinct authorized nodes and immutable Profile revision
- multi-hop editor preserves route order and refuses cycles, missing capabilities and a closed gate

### E341: apps/web/test/console-flow.test.mjs

[Source](../../apps/web/test/console-flow.test.mjs)

- scope-wide overview and candidate selectors do not depend on filtered list pages
- Direct copy is a detached, disabled new spec requiring an explicit listen port, never a source update
- Relay copy keeps the immutable Profile lock and path but requires fresh preview and creates disabled intent
- eight-Node copy preserves six ordered transits and invalidates its frozen preview after local reordering
- a retained eight-Node copy is not converted into Relay when the Control multi-hop gate is off
- late responses cannot cross connections or overwrite a newer page
- Direct candidate refresh never silently changes a revoked selection to a different node
- Relay selections survive independent candidate searches and fail closed after grant loss
- disconnect discards a late deployment view without opening a dialog or creating historical restore actions
- a changed Relay form cannot enable submit from a late previous plan response

### E342: scripts/check-web.mjs

[Source](../../scripts/check-web.mjs)

See the source scenario assertions or configured command steps.

### E343: apps/web/test/browser-leaf-map-complete.test.mjs

[Source](../../apps/web/test/browser-leaf-map-complete.test.mjs)

- all twenty-two documented browser leaves retain exact old exports real consumers and explicit per-file roles
- four telemetry opens really reload bounded histories while initialization edits and clear perform no requests
- accepted template metadata publication really refreshes its bounded list after the original command

### E344: apps/web/test/request-effects.test.mjs

[Source](../../apps/web/test/request-effects.test.mjs)

- canonical request factory gives JSON decoding precedence over stale connection and abort/status checks
- canonical mutation factory retains keys after failure, deletes on success, and resets explicitly
- canonical request succeeds only after decode, cancellation, and response checks in order
- canonical request construction is lazy and disconnected mutations prepare a stable key before connection refusal
- native request effects preserve exact fetch framing and caller cancellation reason
- native response checking preserves server code and status with bounded fallback semantics

### E345: apps/web/test/native-request-complete.test.mjs

[Source](../../apps/web/test/native-request-complete.test.mjs)

- request public signatures and lazy connection getters retain short circuit and exact errors
- request captures version before dispatch and preserves default options and effect receiver lookup order
- request native failure precedence preserves identity except the exact JSON refusal boundary
- native send returns the exact fetch promise and preserves native option defaults and getter order
- mutation retains original input for separate signature and body serialization without clone or freeze
- same-signature concurrent mutations share a key and dispatch independently without an added queue
- mutation signature and key failures precede connection and clearing pending performs no effects
- native response errors preserve property and primitive coercion order including falsy nonnull values

### E346: apps/web/test/native-main-complete.test.mjs

[Source](../../apps/web/test/native-main-complete.test.mjs)

- native main module import has no eager DOM clock fetch or credentials effect
- main connect keeps validation first then original clear auth secret input and four reads; disconnect clears every owner in order
- main one-time registration secret flows through real node submit copy dialog close failure and disconnect callbacks
- main clipboard failure and node mutation failure stay bounded and do not fabricate credentials or refresh
- main native listeners keep lazy cross-owner callbacks filters navigation paging refresh and clear behavior

### E347: apps/web/test/native-rule-complete.test.mjs

[Source](../../apps/web/test/native-rule-complete.test.mjs)

- native Rule factory is lazy and keeps initializer defaults destructuring return names and callback wiring
- native Rule input Set preserves reset versus drop and callbacks retain original item and listener order
- native Rule clone ordered and JSON remain separate evaluations with original getters and errors
- native Rule show consent and clear callbacks preserve the original view operation order
- native Rule effects preserve encoding UTC UUID confirm binding cancellation options and bounded error representation
- actual main composition keeps Profile and Path handoffs lazy until the initialized Rule consumer exists

### E348: apps/web/test/native-relay-complete.test.mjs

[Source](../../apps/web/test/native-relay-complete.test.mjs)

- Relay six helper legacy exports and factory retain names arities mutable results and lazy base capability
- Relay native forms retain coercion order bounds first errors and detached endpoint/path values
- Relay legacy init retains signature listener surface fresh per-init profile caches pinned edit preview equality and clear
- Relay init isolates unknown write outcomes stale plans and deployment history restore CAS across clear

### E349: apps/web/test/probe-flow.test.mjs

[Source](../../apps/web/test/probe-flow.test.mjs)

- Probe console defaults off, rejects unsupported selections and requires explicit consent
- uncertain issue replays the same immutable key/body, double clicks and successful replays never issue new tasks
- abandoning an uncertain command is explicit; no new key appears without a new submit
- historical connected result stays unknown and query failures never become zero-latency success
- invalid source, payload, identity and current-health assertions fail closed in display projection
- receipt wait makes at most eight GETs, never a hidden POST, and stops at expiry
- stop, edited IDs and disconnect discard in-flight responses even when the transport ignores abort
- newer queries win and invalid ID characters cannot expand the request path
- revoke uses the queried ID, exact empty body, no idempotency task and a confirmation
- late acceptance cannot restore keys, receipt IDs or selection after connection reset
- TCP and UDP Echo receipts display stored evidence with unknown health across terminal and pending states
- Echo display rejects malformed scope, descriptor, binding, timing, proof and byte relationships without hidden requests

### E350: apps/web/test/probe-run-history-flow.test.mjs

[Source](../../apps/web/test/probe-run-history-flow.test.mjs)

- manual historical run reads validate legacy and TCP/UDP Echo summaries and display stored evidence without commands
- full stored digest and independent Echo invocation digest reject tampering even when outer summary is resealed
- run detail refuses retention, lifecycle, Scope, status, proof and byte inconsistencies after valid content resealing
- history query rejects invalid windows, limits and status before I/O and preserves the echoed exact filter
- history pages reject mismatched filters, order, duplicate IDs, cursor binding and excessive response size
- next page requires the same frozen query and cursor position and never paginates automatically
- cancel, input edits, clear and Scope changes discard late history without automatic follow-up

### E351: apps/web/test/tunnel-flow.test.mjs

[Source](../../apps/web/test/tunnel-flow.test.mjs)

- tunnel Console uses only bounded read-only GETs and distinguishes recorded windows from network or certificate evidence
- pagination is bounded, read-only, and a deployment view delegates to the original management entrypoint exactly once
- dialog close and disconnect abort both reads and discard late responses without recreating actions
- replacing the selected Node ignores all stale metadata and references
- unavailable and malformed metadata clears previous output instead of retaining a readiness claim
- unrelated adjacency, incorrect authorization and invalid paging fail closed without actions
- unknown extra metadata fields never flow into the rendered credential projection

### E352: apps/web/test/rule-flow.test.mjs

[Source](../../apps/web/test/rule-flow.test.mjs)

- batch selection is bounded to 10 current-page detached configurations and preview sends nothing
- page changes clear selection rather than silently accumulating a scope-wide batch
- recovery-suspended rows are not selected and repeated preview/cancel keeps the current checkbox state consistent
- definite CAS rejection is retained per rule while independent later rules continue
- uncertain committed response stops the tail and only explicit same-key same-body replay can resolve it
- server errors and malformed acceptances remain uncertain and never turn into replacement commands
- no-op accepts current revision without inventing an Operation or new desired revision
- batch requests are serial, cannot double-submit, and stop aborts current without sending the tail
- disconnect clears local commands and discards late acceptance and refresh work
- unresolved discard requires acknowledgement and never sends remote cancellation or rollback
- retry requires fresh current failed Operation, exact desired revision and latest-source identity
- late retry reads cannot reopen a dialog after connection changes
- Profile batch freezes at most ten independent CAS proposals, preserves enabled/path/target and checks each before its first write
- invalid/mixed/recovered Profile impacts cannot prepare commands or smuggle target/path/enabled changes
- fresh plan authorization rejection sends no intent for that row but independent later rows can still publish
- fresh preview is not a CAS lease: a changed rule rejects independently after its successful check
- unknown, disabled or mismatched preflight stops unsent tail and needs explicit same-proposal recheck, never write replay
- stop or disconnect during Profile check cannot send an intent after the late read completes
- unknown Profile write replays only the original key/body without another plan or automatic tail
- a rejected replay cannot erase uncertainty about the original committed-or-not command
- ten exact path commands freeze source/target/CAS and use serial proposal + Relay plan + original binding, never ordinary PUT or a bulk API
- path batch rejects mixed/unavailable/duplicate targets and any expansion changing listener, target, enabled or protocols
- new path provenance with equivalent expansion returns unchanged spec and retains the original no-Operation receipt
- stale CAS or withdrawn authority rejects one fresh path proposal without a binding write and permits independent later rows
- unknown or mismatched path proposals stop before Relay planning/writing and need explicit same-proposal recheck without changing keys
- unknown Relay plan after a valid path proposal still writes nothing and a recheck repeats both frozen reads
- lost path write and current replay denial keep uncertainty; only the exact original binding request replays without either preview
- malformed path binding receipts, wrong target or unexpected Operation stay uncertain rather than becoming a substitute update
- stop/disconnect during either path preflight cannot dispatch late writes; stop during binding retains uncertainty and blocks tail

### E353: apps/web/test/rule-finally-complete.test.mjs

[Source](../../apps/web/test/rule-finally-complete.test.mjs)

- Rule dispatch finally clears consent renders and awaits refresh while retaining exact accepted result
- Rule failed list refresh keeps accepted rejected and uncertain results and issues only bounded manual-refresh notice
- Rule generation changes suppress stale finally and late refresh rejection notifications
- Rule original view and notify exceptions preserve finally precedence without replacing commands
- Rule effect failures before write and while projecting acceptance keep original uncertain classification

### E354: .github/workflows/container.yml

[Source](../../.github/workflows/container.yml)

See the source scenario assertions or configured command steps.

### E355: .github/workflows/ci.yml

[Source](../../.github/workflows/ci.yml)

See the source scenario assertions or configured command steps.

### E356: tsconfig.json

[Source](../../tsconfig.json)

See the source scenario assertions or configured command steps.

### E357: agent/internal/observationwire/testdata/native-telemetry-fixtures.json

[Source](../../agent/internal/observationwire/testdata/native-telemetry-fixtures.json)

See the source scenario assertions or configured command steps.

### E358: agent/internal/nativeexecution/catalog.go

[Source](../../agent/internal/nativeexecution/catalog.go)

See the source scenario assertions or configured command steps.

### E359: agent/internal/executiondriver/registry.go

[Source](../../agent/internal/executiondriver/registry.go)

See the source scenario assertions or configured command steps.

### E360: apps/control/test/cancellation-drain-complete.test.ts

[Source](../../apps/control/test/cancellation-drain-complete.test.ts)

- 211 lower cancellation has its exact minimal keys and observation registration races preserve the original reason and callback
- 211 request cancellation stays unknown and holds capacity until both native close events, with late callbacks unable to release another attempt
- 211 response cancellation destroys the partial response request and socket, removes the identical once callback and waits for actual drain
- 211 pinned dispatch keeps literal signing bytes and response bounds while end error abort and incomplete bodies retain original classifications

### E361: apps/control/test/upgrade-assessment.test.ts

[Source](../../apps/control/test/upgrade-assessment.test.ts)

- compatible static assessment is not execution, recovery, backup or production approval
- new Control supports unmigrated old Agents when multihop remains off
- old schema upgrade requires reviewed DDL and explicit journal migration
- old Control and Agent are compatible only with their old schema/journal boundary
- turning off Control multihop never permits downgrading an extended journal
- old Control cannot read new schema, even for a rollback or recovery
- same identity old database and same-generation conflicting history are blocked
- missing journals and changing Authority demand review; foreign journals are blocked
- invalid schema history, trust, protocol, SQL baseline and partial DDL fail closed
- multihop admission and withdrawal require matching execution support and state
- recovery always requires the existing reviewed workflow, regardless of wall time
- plan parsing rejects duplicates, unknown fields, unsafe counters, legacy protocols and tags
- known migration footprints cover tables, multi-column DDL and superseded enums
- Probe registry DDL has an explicit Control-only reader ceiling and cannot silently downgrade
- Probe permit DDL has a distinct Control-only ceiling and detects partial ownership tables
- Probe withdrawals have an independent Control-only ceiling and partial migration/backfill requires review
- short-lived Probe results require a new Control-only reader ceiling and reject partial DDL
- immutable path metadata requires a Control-only reader ceiling and rejects all partial three-table footprints
- immutable path provenance requires its own Control-only ceiling and detects partial two-table DDL
- CLI dispatch and CI wiring keep assessment read-only and separate real MySQL acceptance
- public assessment dispatch never constructs or mutates Authority and preserves decision exit codes

### E362: apps/control/test/recovery-workflow-ports.test.ts

[Source](../../apps/control/test/recovery-workflow-ports.test.ts)

- backup protects output, rechecks authority after synchronized dump and publishes signed manifest last
- backup partial failures close the database and never publish a manifest after failed dump or authority recheck
- restore refuses issuers, SQL tamper and unexhausted authority before creating a fresh target
- restore commits quarantine before credentials and authority rebind then closes target before source
- restore distinguishes pre-commit rollback from credential/rebind failure after committed quarantine
- restore preserves partial-target and migrate failures without fabricating rollback or deleting history

### E363: apps/control/test/recovery-quarantine-order.test.ts

[Source](../../apps/control/test/recovery-quarantine-order.test.ts)

- recovery quarantine preserves one transaction, immediate accounts and shared publication time before final event encoding
- recovery quarantine propagates every owner failure and stops subsequent owners/event without retries

### E364: apps/control/test/native-recovery-complete.test.ts

[Source](../../apps/control/test/native-recovery-complete.test.ts)

- native Recovery keeps exact public effect methods aliases construction and raw query result identities
- native mysqldump retains exact decoded IPv6 argv env limits and pre-execute versus masked failure boundary
- native durable output uses direct exclusive target write sync finally close and POSIX directory sync with original error precedence
- native operator directory identity preserves lexical authority and realpath missing-ancestor vault exclusions
- native manifest parser retains exact bounded closed keys native date and count coercion refusal without adding MAC validation
- trusted Recovery time keeps original argument defaults started exec bounded parse and short-circuit late clock order
- native restore source fresh-target DDL and original direct admin close retain distinct failure boundaries
- native restore child preserves stderr error exit pipeline Promise.all and original uncancelled partial process behavior
- Recovery backup owner retains full preparation signed manifest sequence lazy options and every bounded partial-effect failure
- Recovery restore owner retains full no-side-effect refusals trusted exhaustion and same transaction commit before credentials binding and closes

### E365: apps/control/test/recovery-native-composition-complete.test.ts

[Source](../../apps/control/test/recovery-native-composition-complete.test.ts)

- 201 original Recovery operator keeps module load inert, constructs a fresh Workflow per invocation and passes options unchanged
- 201 real quarantine host invokes original lazy owners, static bindings and one empty-assignment Ledger in the supplied transaction
- 201 every native Recovery callback failure stops later owner construction, credential acceptance and final event without another transaction

### E366: docs/changes/FR-0026-runtime-queued-publication-renewal.md

[Source](../../docs/changes/FR-0026-runtime-queued-publication-renewal.md)

See the source scenario assertions or configured command steps.

### E367: apps/control/test/mysql-migration-statements.test.ts

[Source](../../apps/control/test/mysql-migration-statements.test.ts)

- migration splitting preserves comments and quoted semicolons without joining SQL tokens
- migration splitting respects doubled quotes and native string backslash escapes
- migration splitting follows NO_BACKSLASH_ESCAPES and ANSI_QUOTES without changing SQL text
- executable MySQL comments remain statements and unterminated or client-delimited scripts fail closed
- the four production migrations with semicolons in introductory comments retain complete ordered DDL

### E368: apps/control/test/runtime-resource-ports.test.ts

[Source](../../apps/control/test/runtime-resource-ports.test.ts)

- resource ports retain the caller transaction, Node session refusal and null versus zero authorization
- Direct reservation sorts physical protocols and refuses even the same existing owner
- Relay reservation orders physical resources while preserving forward protocol and allowing same-owner renewal
- resource capacity failure follows all reservations and propagates for caller rollback
- transition locks prior ownership first and keeps old slots through the drain window
- fence and generation exhaustion refuse writes at the original resource lock boundary
- slot removal preserves enumeration order and exact owner and physical protocol predicates

### E369: scripts/phase2/capacity.ts

[Source](../../scripts/phase2/capacity.ts)

See the source scenario assertions or configured command steps.

### E370: apps/control/test/background-task-effects.test.ts

[Source](../../apps/control/test/background-task-effects.test.ts)

- background effects prevent overlapping work and close joins the active task and stop hook exactly once
- background failure backoff uses completion time, exact thresholds and caps, then resets on success
- background shutdown waits for all independent hooks even when one fails

### E371: apps/control/test/background-native-effects.test.ts

[Source](../../apps/control/test/background-native-effects.test.ts)

- aggregate registration errors precede missing effects and declaration errors retain their own order without effects
- native construction inherits the host, defers first work and dynamically resolves timers and monotonic time
- provider and declaration receivers retain copied frozen configuration and cancellation is retryable after a throw
- failure delays stay capped beyond sixteen failures and no-delay failures use only admission samples
- independent tasks retain registration order, own active slots and sanitize errors only after all hooks settle

### E372: apps/control/test/runtime-status-ports.test.ts

[Source](../../apps/control/test/runtime-status-ports.test.ts)

- runtime status decodes report before current and preserves separate current freshness decode in the caller transaction
- runtime status retains lazy malformed-body failure order and absent body/zero timestamp semantics
- runtime status matches generation/fence tuples and marks exact expiry, wrong epoch and missing evidence unknown
- runtime raw status adapter uses only supplied execute and exact original query arguments

### E373: apps/control/test/status-projection-complete.test.ts

[Source](../../apps/control/test/status-projection-complete.test.ts)

- 153 status optional storage and malformed epoch preserve lazy current and reported query boundaries
- 153 status first provider decoder time and formatter errors retain identity and stop later effects
- 153 raw status adapter returns absent rows uses an undefined epoch placeholder and preserves execute errors
- 154 status retains tuple order spread references policy copy and permissive identities without protocol matching
- 154 status earliest window equality null zero NaN and unknown epoch keep native truthy formatting and clock sampling
- 154 path projection dispatches serial overrides removes path and preserves unknown null minimum and parse order
- 154 legacy native status wrapper retains one-argument own method dynamic clock permissive references and native invalid dates

### E374: apps/control/test/foundation-storage-effects.test.ts

[Source](../../apps/control/test/foundation-storage-effects.test.ts)

- UoW preserves transaction identity, guards, result identity and commit/release order
- UoW ${failed} failure preserves unknown error identity and exact cleanup
- UoW ${code} retries twice using release before reacquire and stops on third failure
- UoW retry succeeds with only the final action value committed
- UoW rollback failure supersedes the original retryable error without retrying and still releases
- migration refuses legacy schema before acquiring a session
- migration ${failed} fault has no unlock before lock ownership
- migration unavailable session mode releases lock before session without creating marker table
- migration lock refusal (${String(acquired)}) releases without SQL mode, DDL or unlock
- migration inspects sorted SQL names under the acquired lock and skips applied migrations
- migration ${failed} failure preserves identity and releases after lock cleanup
- migration lifecycle backfill retains every lease value and writes marker after leases
- migration lease backfill failure prevents marker and later migration lookups
- migration unlock failure supersedes earlier failure and connection still releases
- close awaits native pool end${failure ? ' and preserves rejection identity' : ''}

### E375: apps/control/test/mysql-native-complete.test.ts

[Source](../../apps/control/test/mysql-native-complete.test.ts)

- 155 original MySQL constructor passes exactly five native pool options and helpers retain results receivers and default args
- 155 real MySQL migration owns the database advisory lock through file work and releases it before returning
- 155 real MySQL partial DDL persists without a migration marker and retry resumes under the same migration lock
- 155 real MySQL commit outcomes remain distinct when the driver rejects before commit or loses its successful reply

### E376: scripts/phase1/acceptance.ts

[Source](../../scripts/phase1/acceptance.ts)

See the source scenario assertions or configured command steps.

### E377: apps/control/test/authority.test.ts

[Source](../../apps/control/test/authority.test.ts)

- authority upper bound is durable and monotonically includes concurrent publishers
- recovery trust/database binding stays quarantined until the exact review ID
- missing or corrupted protected state cannot be initialized from zero
- artifact verification rejects changed data and publication rejects unsafe bounds
- offline recovery refuses stale or future clock observations even when marked synchronized

### E378: apps/control/test/upgrade-mysql-acceptance.test.ts

[Source](../../apps/control/test/upgrade-mysql-acceptance.test.ts)

- upgrade assessment preserves MySQL, authenticated journals and Authority; rejects unsafe restores and interrupted DDL

### E379: apps/control/test/upgrade-inspection-complete.test.ts

[Source](../../apps/control/test/upgrade-inspection-complete.test.ts)

- upgrade public aliases exact source-only version and mutable report retain independent key check and safety inventories
- all twenty-six independent Control profile ceilings including four late additions preserve agent restrictions reader pending and report precedence
- upgrade original closed JSON build Journal counters zero generations imported Transit and distinct native format rules remain exact
- upgrade remaining explicit multihop Journal migration maintenance and recovery branches retain ordered checks and blocked over review precedence
- native bounded upgrade input preserves default allocation partial reads zero-byte UTF8 stat limits and every finally close precedence
- native migration catalog resolves real new relative root all thirty-seven hashes markers and deliberate floor unknown-file refusals
- native upgrade inspection issues exact bounded read-only SQL in original order optional-table defaults and rollback only after successful setup
- native upgrade inspection retains metadata table history node counter lease bounds and visible schema-race refusals
- actual assessment orchestrator preserves awaited plan catalog authority CA connection database after report end and lazy options identity
- actual assessment orchestrator preserves setup-before-try no database close and original inspect report after/end failure precedence

### E380: apps/control/test/operator-command-complete.test.ts

[Source](../../apps/control/test/operator-command-complete.test.ts)

- operator argv usage required env and original authority construction preserve assess versus status maintenance resume and unknown order
- operator backup keeps nullable versus empty defaults original authority optional vault field and output after delegated result
- operator restore preserves stopped short circuits awaited CA digest repeated clock env native defaults and bounded result projection
- operator assessment retains ordered required env no Authority exact twelve-code redaction and pretty versus compact exit0 1 2 output
- operator output stringify log and exit exceptions retain inspection catch versus outer failure and output-before-exit precedence
- native operator effects preserve original process getters argv slice certificate Promise and formatting bindings without eager effects
- actual ops CLI keeps same spread delegates original native failure effects and release top-level awaited verifier without catch
- release command preserves argv-before-env nullish revision priority same verifier and pretty output with raw failures
- actual native release verifier checks fifteen independent gates in declared order through bounded reads and SHA without executing any gate
- actual release verifier rejects source images unique gate set containment bounded files and digest before later gate reads
- actual release verifier retains 3 4 8 runtime isolation distinct physical hosts and matching immutable image report requirements

### E381: scripts/check-boundaries.mjs

[Source](../../scripts/check-boundaries.mjs)

See the source scenario assertions or configured command steps.

### E382: apps/control/test/legacy-constructor-effects.test.ts

[Source](../../apps/control/test/legacy-constructor-effects.test.ts)

- zero-argument legacy bindings retain subclass identity and construct without sampling a clock
- legacy Forward reads bind actual native SQL on the supplied transaction and decode only projected values
- legacy Forward references preserve explicit selector precedence, null authorizers and owner-only quarantine
- legacy Forward writes bind native JSON at each await and preserve CAS and exact failure identities
- legacy Idempotency zero-argument binding keeps native ensure-lock JSON replay and refusal priority
- legacy Idempotency snapshots keys across native SQL awaits but compares the live digest
- legacy Idempotency response serializes before key reads and propagates encode, SQL and quarantine failures

## Acceptance Decision

Do not freeze the foundation public interfaces or open product parallel work from
CI totals alone. Close the concrete remaining obligations above, record applicable
exact-source execution and consciously define the accepted public-interface scope.
The current evidence map is a completed audit artifact; B acceptance is unfinished.

Only durable regression tests and this final map are retained. Temporary per-agent
JSON, PR body scratch and downloaded logs are removed after integration. Historical
Actions runs remain the immutable execution record.

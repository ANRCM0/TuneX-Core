# Foundation B Assertion Coverage

Updated: 2026-10-20 (Asia/Shanghai).

This is the maintained acceptance map for readiness 1–220, replacing temporary
per-agent JSON and scratch extracts. It identifies actual assertion anchors and
remaining obligations. It is not a pass certificate.

## Status And Source Identity

The latest saved candidate at this map update is `4bb399f34600fca3e16613ef8a1d09fc93c06330` in PR #112.
Additional working-tree suites listed below require their next saved candidate's
own Actions. The functional/MySQL/network/container/browser runs occur only in GitHub Actions.
A workflow's exact tested checkout/tree and its conclusion must be recorded with
the source revision; old passing revisions do not validate later tests.

| Assertion identification | Items | Meaning |
| --- | ---: | --- |
| covered | 49 | Identified assertions cover the whole listed requirement; execution is separate |
| partial | 171 | Identified assertions cover only the stated subset |
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
| 1 | covered | E174, E175, E176 | Covered: Every explicit item1 obligation has actual graph enforcement plus named negative and positive assertions. covered is assertion completeness, not an Actions pass or foundation acceptance. Recursively scans current TS/JS/Go production leaves under Core/contracts/Control/Web/Agent internal+cmd/public examples/operator scripts; each source goes through sourceViolations using the actual foundation-boundaries-v1 inventory; missing mapped local dependency targets refuse. Invokes the canonical full graph checker against the real checkout; no saved path-count fixture or handpicked file list. Value/import type/inline type specifier, named/type/inline type/star/namespace reexports, import type expressions, dynamic import, require/import-equals and triple-slash path all reject real lower->native adapter target; computed import and require also reject. Includes triple-slash native Node type reference and comment/string non-reference control. Rejects private Core/contracts package subpaths, relative private Core leaves and cross-owner/example private imports; public Core and owner entry positive controls remain. Adds type-only private package reexports and L1 root/runtime/shared native-barrel refusal. Direct Core mutation leaves reject fetch/process/Buffer/WebSocket/URL/globalThis.fetch/native Date now/parse. Retains parser/JSON/new Date/AbortSignal/Buffer type checks and precise original Core stringify positive; Go lower tags/clock/parser/runtime aliases reject. All reference syntaxes target actual infrastructure/mysql-intent-store.ts; no fake target classification or broad composition exemption. Binding label does not exempt classified lower source native imports. Real nonbinding Control and Web owner classification rejects if/switch/ternary process.platform/arch including globalThis/computed member/native alias/destructuring, navigator facts and Deno build selection. Go L3 native runtime.GOOS/GOARCH reads reject normal/aliased/block/dot imports, OS go:build/+build constraints and OS-specific filename selection. Injected platform facts and Go comment/string controls remain allowed. A specific existing named binding is separately identified; arbitrary new owners remain unclassified. No directory-wide binding exemption added. Unknown Control/Web/Agent/operator source paths reject; a classified Control L3 cross-owner private type reexport rejects. Existing unknown product/Web/operator paths and framework/native-private/direct-store/external native imports reject. Every explicit item1 obligation has actual graph enforcement plus named negative and positive assertions. covered is assertion completeness, not an Actions pass or foundation acceptance. Recursively scans current TS/JS/Go production leaves under Core/contracts/Control/Web/Agent internal+cmd/public examples/operator scripts; each source goes through sourceViolations using the actual foundation-boundaries-v1 inventory; missing mapped local dependency targets refuse. Invokes the canonical full graph checker against the real checkout; no saved path-count fixture or handpicked file list. Value/import type/inline type specifier, named/type/inline type/star/namespace reexports, import type expressions, dynamic import, require/import-equals and triple-slash path all reject real lower->native adapter target; computed import and require also reject. Includes triple-slash native Node type reference and comment/string non-reference control. Rejects private Core/contracts package subpaths, relative private Core leaves and cross-owner/example private imports; public Core and owner entry positive controls remain. Adds type-only private package reexports and L1 root/runtime/shared native-barrel refusal. Direct Core mutation leaves reject fetch/process/Buffer/WebSocket/URL/globalThis.fetch/native Date now/parse. Retains parser/JSON/new Date/AbortSignal/Buffer type checks and precise original Core stringify positive; Go lower tags/clock/parser/runtime aliases reject. All reference syntaxes target actual infrastructure/mysql-intent-store.ts; no fake target classification or broad composition exemption. Binding label does not exempt classified lower source native imports. Real nonbinding Control and Web owner classification rejects if/switch/ternary process.platform/arch including globalThis/computed member/native alias/destructuring, navigator facts and Deno build selection. Go L3 native runtime.GOOS/GOARCH reads reject normal/aliased/block/dot imports, OS go:build/+build constraints and OS-specific filename selection. Injected platform facts and Go comment/string controls remain allowed. A specific existing named binding is separately identified; arbitrary new owners remain unclassified. No directory-wide binding exemption added. Unknown Control/Web/Agent/operator source paths reject; a classified Control L3 cross-owner private type reexport rejects. Existing unknown product/Web/operator paths and framework/native-private/direct-store/external native imports reject. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 2 | partial | E177, E178, E179, E180, E181, E182, E183, E184 | Covered: Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: Exhaustive Core/API/generic/export compatibility and all closed families/tool callers are not proved by the named identity/example cases. |
| 3 | covered | E217, E218 | Covered: Exact 5000ms hold boundary, renewal equality, absent/same/different sessions, queued multihop preservation, withdrawal and credential/Relay caps; host counters refuse before retirement/publication. Remaining: No missing assertion identified; exact-source execution still required. |
| 4 | partial | E218, E95 | Covered: Host fake traces cover Hello/boot history, capabilities, one Tx, authority/save/lease order and failures, stale claim after compile, report duplicate/body/fence/phase refusal and expiry. MySQL tests cover existing multihop lifecycle/withdrawal. Remaining: Full related-Node closure/lock/cleanup/drain traces and statement-level transaction fault comparison remain bounded to listed cases. |
| 5 | partial | E219, E95, E44 | Covered: SQL splitter refusal/quoting/comments and MySQL Runtime cases plus Agent read-only inspection refusal are exercised; CI supplies native build/vet/race. Remaining: No exhaustive adapter pre/post SQL/claim-competition differential; independent Windows functional execution and exact absent-field projection matrix are not supplied by Linux CI. |
| 6 | covered | E178 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: No missing assertion identified; exact-source execution still required. |
| 7 | partial | E95, E209, E208 | Covered: The configured full Actions matrix includes lifecycle, contracts, Go vet/race, MySQL, recovery, browser, namespace/multihop and container gates on each PR candidate. Remaining: Bind final exact checkout revision and all job conclusions after execution; conditional skips remain separate and physical hosts are not included. |
| 8 | partial | E220, E221, E95 | Covered: Caller-Tx Node/epoch/null/zero access, Direct same-owner refusal, protocol sort, Relay physical order/same-owner renewal, capacity after reservations, initial-owned transition lock, generation/fence exhaustion, drain retention and exact ordered removals. Remaining: Full original SQL rollback/competition and shared constructor/default wiring need additional targeted acceptance beyond the port traces and existing capacity/MySQL scenario. |
| 9 | partial | E95, E96 | Covered: Real-MySQL tests preserve succeeded history after terminal failure, fail existing deploying attempt, keep retryable active generation, reject stale reports and roll back owner/effect/response failures. Relay scenario exercises scanner terminal cleanup and duplicate delayed Report. Remaining: No direct RelayHost provider trace samples every Date.now boundary, claim clearing predicate, or failure precisely between operation write and deployment withdrawal. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 10 | partial | E95, E97, E98, E99, E100 | Covered: Snapshot source ownership/conflicts, late publication rollback with durable independent high-water, stale-report isolation, capacity rollback, authorizer withdrawal and genuine Reports while Forward row locked have explicit assertions. Direct LedgerHost traces now assert quarantine/duplicate retirement, accepted/running/succeeded intent and authority filtering, monotone timestamps, expire-before-claim with deadline/attempt/token, generation-limited tombstones and absent/null/zero/exact-boundary drains and distinct completion cleanup. Remaining: Every original SQL statement/argument, malformed persisted body lazy-decode precedence and mid-write real-MySQL rollback/competition are not exhaustively compared by fake-store traces or the mapped integration scenarios. |
| 11 | partial | E95, E101, E102, E103, E96, E104 | Covered: Compiler tests assert peer/session/credential/generation/fence binding, deterministic immutable digests, physical TCP/UDP separation and target policy. Real-MySQL tests cover activation, grant withdrawal, stale generation reports, late failure retention and capacity rollback; real Relay scenarios include deadline/partial-protocol/retry. Remaining: No full direct host/store/observations call trace verifies transitive Node closure locks, every phase pin/retiring overlap boundary or pending-query 100 ordering. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 12 | partial | E105, E95, E106, E107 | Covered: Node policy management/revocation replays, scope rejection, immutable policy and transaction rollback are asserted. Security script checks concurrent rotation same-CSR replay/conflict, exactly two credential records, old/current overlap cutoffs and unchanged session/revision. Transport script tests Relay credentials and caps. Remaining: Enrollment expiry while signing, signer failure/post-sign races, every grant/token/exhaustion branch and exact three-table write/lock order lack direct port-fake differential assertions. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 13 | covered | E1, E2, E3, E4, E5, E6, E7, E8, E9, E10 | Covered: Old Sample/Clock/Ticket names compile in both directions as lower aliases Replacing old private Guard.clock is observed exactly once by Check/ValidateServerTime/Credential/Accept and already-issued Ticket.Allow/Drain; original clock not sampled, same single lower Guard retained Read failure triggered by pre-existing Ticket maps to stable CLOCK_UNCERTAIN; subsequent API calls preserve same error identity before resampling healthy replacement or validating invalid server/credential/snapshot arguments; failed Drain remains nonauthoritative Nil old/lower Ticket.Allow returns exact LEASE_EXPIRED refusal Nil clock, zero/negative skew and maximum<=skew refuse before clock; initial provider failure returned once with original identity Old authorization entrypoints/types and private clock compatibility, one lower Guard, read-error latch, nil Ticket and nil-provider refusal are covered by existing guard_compatibility_test and executiontime synchronization tests; no duplication added. Sample/Evidence/second-sample traces, blocked provider,2s cache/rollback,30s freshness,500ppm and native host/platform/parsing order are covered by existing executiontime suites plus new native fact projection/cache tests. Actual native counters are exercised with uptime-before/SystemClock/uptime-after and wall brackets, UTC and unsupported platform exact errors. Current source inventory confirms Linux CLOCK_BOOTTIME syscall clock ID7 and Windows QueryInterruptTimePrecise100ns conversion; neither was changed. Runtime branch tests belong on their respective OS Actions jobs. Windows parser adds invalid/fractional leap/stratum/state, negative/overbound delay/dispersion/offset/holdover, local reference, empty source,NaN/Inf,extra layout and decimal-comma cases; existing forgery/unknown/stale/missing proof tests retained. Existing old-ticket/no-renewal/expiry/server-skew/jump/read-latch tests plus new exact skew edges, negative uptime/zero-wall initial refusal, uptime rollback stable latch, coherent suspend delta with expired ticket/no session revival, duration0/negative/short/long drains x no/earlier/later credential cutoffs and exact deadline boundaries. Covered describes authored assertions and actual current source inventory. No claim of executed suspend/resume physical-host acceptance; this remains an independent execution gate rather than an invented missing API consumer. Remaining: No missing assertion identified; exact-source execution still required. |
| 14 | covered | E11, E12, E13, E14, E15, E16 | Covered: Durable-before-error and not-durable Save outcomes preserve original authority with wrapped original cause. Authenticated reload refuses old caller before input and admits equal durable generation without Save. All native history compared fields, exact encoded native bytes versus decision-only projection, foreign node, generation rollback/digest conflict, active-to-prepared refusal and initial lazy prior are explicit; existing authenticated MAC/history/Runner save-before-bind cases retained. Remaining: No missing assertion identified; exact-source execution still required. |
| 15 | covered | E17, E18, E19, E20, E21 | Covered: Actual AtomicWrite function body is parsed and staged with only OS selectors replaced by test-owned effects; no production hook or copied implementation. Eleven vectors run with POSIX and Windows path-separator semantics: create/chmod/write/file-sync/close/rename/directory-open/directory-sync/directory-close/remove, simultaneous first/cleanup failures, exact paths/raw bytes/0600/order, protected target outcome and best-effort cleanup. Actual unsupported lock body is compiled without its platform build tag and must refuse with no release. Existing native atomic/lock/Journal/proof/inspect/migration tests remain complementary native evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 16 | partial | E22, E23, E24, E25 | Covered: Stable CSR/key retry, corrupt machine no fallback, Relay trust/key/purpose/expiry, protected MAC missing distinction, renewal replay, nil providers Remaining: Machine fake-provider trace for SaveMachine -> reload -> Probe invalidation -> Guard update -> idle close -> request cleanup; inject failures at actual existing fallible stages and assert later calls absent. Main channel request/TLS rotation contract: request method/path/headers/epoch, configured CA rather than returned CA, response bounds/body close/status/error mapping, redirect refusal/cancel/idle close. Do not require arbitrary malformed-field cross products. |
| 17 | partial | E25, E14, E26, E27 | Covered: Missing explicit providers refuse before bootstrap, persisted Journal precedes socket bind, offline replay and run release ordering Remaining: One ordered injected bootstrap success trace and failure table for proof boundary, roots, key, authenticated load, extension/credential/migration then client; assert no later effect/history reset. Existing provider nil cases do not exercise this sequence. Operational scheduling tests at existing timer/ticker/cancellation/deadline/AfterFunc/backoff callsites; blocked host provider must remain one worker, time out at 500ms and drop late result. No arbitrary scheduler API cross product. |
| 18 | partial | E28, E29, E30, E31 | Covered: Claim burn before I/O, bounded response read/error, cancellation/admission cooldown, report once and watch drain Remaining: Four native telemetry transport constructors: distinct pools, declared limits and exact redirect refusal; auxiliary URL gates/request/header/close ownership retain their distinct shapes. Linux host parsing: bounded/truncated source and overflow/refusal plus non-Linux unsupported values. Existing alias test only checks nil/empty network and unsupported CPU JSON shape. |
| 19 | partial | E32, E25, E31, E33 | Covered: Diagnostics aggregate/final authority false and no secret, missing local providers, one32-byte entropy read and ignored short count, result deadline/uncertainty Remaining: Native process/memory/time/PID/platform/goroutine read order, Runner lock scope; blocked host worker no overlap/500ms/late result and drain. Diagnostics disabled/configured/sibling paths, mkdir/write/sync/rename failures, permission modes and final-after-execution-close; warning function receives identical format/arguments/stderr placement. Four independent exporter 16-byte entropy requests and lowercase epochs, error before HTTP with no reuse; retain existing 32-byte Probe request-ID assertion rather than duplicate it. |
| 20 | partial | E108, E109, E95, E99, E110 | Covered: Token grammar rejects whitespace/Unicode/lengths. Access port tests assert same-Tx current owner rechecks/replay/no-op/immutable token digest and rollback. Real MySQL/script assertions cover owner protection, member CAS/account conflict, orphan-account/replay rollback, scoped permissions, recovery token invalidation and retained Journal generation. Remaining: Direct IdentityService/IdentityAccessHost store traces for full FOR SHARE/FOR UPDATE lock chain, UUID-clock-audit encoding order, raw bootstrap failures and sorted recovery token rotation are not established. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 21 | partial | E111, E95, E107, E102 | Covered: Profile grant tests cover authorization before replay, revoked/restored/no-op/stale/cross-scope references and failure rollback. Transport script asserts Profile concurrent CAS/history/no-op/changed-key conflict, Endpoint reference refusal and credential issuance. Compiler tests cover normalization/refusal. Remaining: No complete explicit Transport/Endpoint store traces for native formatter capture, corrupt immutable old revisions, owner/grant/Node/Forward exact lock order and failure after each endpoint/audit write. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 22 | partial | E112, E113, E95 | Covered: B direct fake stores assert key snapshot across ensure/lock awaits with live digest, recovery refusal before decoding, pending/completed decode identity/fault, response evaluation order, separate Forward encodes across awaits, CAS affected rows 0/2 and no history after failed current write. Command ports/real MySQL assert one caller transaction and atomic rollback. Remaining: Raw Forward SELECT predicates/filter ordering/newest25/raw-spec and every quarantine/authorizer read/write SQL branch lack direct adapter assertions. Existing command rollback tests do not independently prove each lower-store query. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 23 | partial | E114, E115, E113, E109, E105, E106, E99 | Covered: HTTP structural fakes assert original actor/scope/key/operation args, body/status/no-store, strict duplicate/unknown-body rejection, cookie/anonymous refusal, scoped operation reads. Owner port and real HTTP scripts exercise mutations, policy/revocation and membership. Remaining: Not every management HTTP method has an independently typed complete structural fake; all inherited NodeApi/nullable/readonly signatures and every machine CSR/rotation error status need explicit contract tests. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 24 | partial | E116, E117, E118, E119, E120, E121, E122, E123 | Covered: Authorized same-Tx query fakes/SELECT-only real MySQL assert scope-before-read, bounded detached paging, exact native grants/reference revisions, non-authorizing metadata, four-peer windows and denial/corrupt rows. Remaining: Full old/new declaration identities and every optional/default HTTP argument are not established; exact callback/conversion clock boundaries need direct traces. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 25 | partial | E124, E125, E126, E127 | Covered: Transit mTLS machine path rejects missing verified TLS, retired boot/revoked credentials/capability spoofing; delivery offline MySQL asserts commit/replay/status/current identity without advancing execution. Relay production HTTP planning is exercised by relay script. Remaining: No dedicated complete structural RelayPlanApi/Transit API substitution test or full route argument/error-precedence matrix. Real Relay reservation-free preview path needs explicit no-write assertion. |
| 26 | partial | E128, E129, E130, E131, E132, E133, E134 | Covered: Path template/binding tests assert closed inputs, scoped manager/grant reads, CAS, quotas, immutable history, shared Forward rollback and SELECT-only impact. Browser scripts exercise template/binding and publication workflows. Remaining: All five Path/Ingress HTTP APIs are not covered by structural fake route tests; IngressGroup resolution/migration/deployment has no dedicated owner MySQL suite. Browser publication coverage is narrower than exhaustive Ingress semantics. |
| 27 | partial | E115, E135, E136, E137, E138, E139, E140, E141, E142, E143 | Covered: HTTP/owner tests check mTLS identity rather than Bearer/header substitutes, detached minimized receipts, owner commit before ACK, spent claims and bounded delivery/status, replay/conflicts/current grants and exact-Tx result rollback; machine/permit real MySQL is covered. Remaining: Typed v2/service v3 qualification/poll/claim/status/result APIs lack full dedicated adapter tests; all eleven independently typed HTTP fakes and staged v4 behavior are not proven. No new Echo acceptance is inferred. |
| 28 | partial | E117, E118, E119, E120, E121, E122, E123 | Covered: SQL-fake tests assert scope before projection, bound scoped count/page filters/literal bounded offsets, candidate/overview gates, count independence and diagnostics sanitized reads. SELECT-only MySQL suites assert real raw projections and unchanged persisted tables. Remaining: Full seven-consumer synchronous callback-after-final-read traces, conversion/getter/error/clock ordering, native iso(undefined) refusal and count-vs-page live-reference changes lack dedicated assertions. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 29 | covered | E34, E35, E14, E36, E37, E38, E39, E40, E41, E42 | Covered: Public aliases, generic/native bindings, fields/method sets and descriptor literal serialization; bounded declaration validation/first errors/zero/nil behavior and detached slices; runtime.GOOS native selection; unchanged native callbacks/default catalog/identity/error/max conversion; real Relay phase partial cleanup and exact successful pointer identity. Existing original engine/Runner/current-instance and boundary anchors remain necessary evidence rather than new duplicate suites. Remaining: No missing assertion identified; exact-source execution still required. |
| 30 | partial | E144, E145 | Covered: New B table checks all five optional telemetry HTTP families via named/positional construction, absence status, admit-before-auth, release on auth/owner errors, cookie/unknown-query refusal and body passthrough. Cancellation identity crosses public ports. Remaining: Owner ingestion replay/delta/history/rollup retention, uint64 overflow/bucket quality, independent family quotas/cooldown, observation-pool refusal and live disabled machine collection are not tested by these HTTP doubles. No telemetry owner-specific tests located in apps/control/test. |
| 31 | partial | E144 | Covered: New B table checks eight remaining optional HTTP families named/positional availability, admission/auth/owner ordering and release/error mapping, and rejects unknown query/cookies before owner calls. Remaining: Diagnostics/audit/station/notification/history/finite-plan/service owner-specific SQL, worker, vault/send/claim/fence/retention/CAS/recovery behavior is untested here; no dedicated suites for those owners located. HTTP doubles cannot establish those semantics. |
| 32 | partial | E43, E44, E27 | Covered: All enrollment failure stages preserve original errors and deferred reply/idle cleanup, configured trust, key-Journal-certificate order and completion only success Remaining: Native enrollment PKCS8/CSR reuse versus other-read-error, configured CA-before-HTTP, response 32769 read/32768 parse and read/status/strict-JSON/decode order; final MAC/Journal/certificate write failures retain partial-state refusal. Existing fake-port every-stage failure trace is already coverage, not a gap. |
| 33 | partial | E45, E46, E47 | Covered: Current physical binding/digest/expiry, forbidden DNS/address/policy before dial, revocation/cancel and Gate one-use Remaining: Native handshake missing deadline and SetDeadline error, exact RX/TX caps/partial IO/budget, cancellation close and revoke-before/after-handshake; assert old native defer/clock/error points without a new TLS feature. |
| 34 | partial | E46, E47, E31 | Covered: Legacy nil resolver refusal, one admitted dial, process cooldown survives new Executor, cancellation and Gate 256-id burn Remaining: Four legacy/explicit Effects constructor traces, fresh zero-config Dialer and private/zero fixture fallback. Counter complete suite now covers epoch/Seal/Close/saturation; do not list these again. Trace original deadline/watch/ticker/native clock-domain boundary at existing callsites; no exhaustive arbitrary clock cross product. |
| 35 | partial | E144, E146, E147 | Covered: Notification read endpoints receive correct actor/scope/ID and opaque owner response under optional-service admission/error boundaries. Worker explicit stores check one owner transaction per claim/preflight/finish, sorted manager authorization and policy->endpoint->outbox locks with callback transaction identity. Failed claim append rolls back row/fence/rate/attempt; failed finish preserves existing claimed fence/pending attempt and defers only once without another sender. Public read excludes reference/authority/destination/signing key. Remaining: No real MySQL statement/retention/eviction/CAS/override suite;16 endpoint/128 audit/256 attempt/1024 outbox quotas, pruning and exact native SQL/parser-order still open. |
| 36 | partial | E148, E138, E144 | Covered: Related publication savepoint tests assert success/known-refusal/unknown-error/fault order; Probe permits test original transaction failures; HTTP covers history/plan admission only. Remaining: Publication savepoint coverage does not cover Probe-plan-specific savepoints or retryable quota exceptions. No run/plan store suites located for history1024/7day/16prune, heads32/decisions16, parser family initialization, override hooks, exact SQL and sticky recovery. |
| 37 | partial | E144, E149 | Covered: Audit query and observation-service list optional HTTP dispatch/auth/admission are checked only. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors Remaining: Per-family raw SQL/node-association/attribution/numeric projection golden cases, complete source/kind/error alias/default/reflection/mutability contracts, all cursor/property/byte-limit/error permutations and physical SQL plan/pool evidence |
| 38 | partial | E118, E144, E150 | Covered: Console Node diagnostics asserts scoped read-only sanitized evidence/no health. Separate Forward diagnostics and station HTTP admission/dispatch has B tests. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick Remaining: Public command replay/CAS/quota/silence/ack sequence, policyCount legacy overrides, pure rules/recovery/episode matrix, storage retention/loss/SQL pruning, diagnostic owner and existing native store row mapping |
| 39 | partial | E151, E152, E144, E153 | Covered: Observation dedicated connection tests assert cancel destroy, failed rollback never returned, delayed pool acquisition cancellation and actual MySQL blocked authorization deadline. HTTP covers telemetry family dispatch only. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero Remaining: Forward/Probe mapped-family provenance/counter matrices; latest/history actual point ordering/digests/deltas/cooldown/rate/clock bounds; adapter SQL/observation pool deadlines/destruction; raw quotas/pruning and real MySQL rollback |
| 40 | partial | E112, E154, E138, E144 | Covered: Request keys/encode timing and non-metadata/native target guards are covered in related Forward/Probe tests; B HTTP covers observation-service availability/auth only. Remaining: Exact observation-service X509/base64/DER/trust/date/EKU/digest/error-order parser cases, cursor framing/UUID point/monotone quota, metadata CAS/history/archive/recovery lack direct assertions. Related guards are not full helper equality. |
| 41 | partial | E141, E140, E139, E144 | Covered: Probe adapters assert receipt identity/freshness and no ACK after failed commit; optional observation HTTP mapping is covered. Remaining: No complete native helper identity/capture/initialization trace; telemetry sample/ACK, cursor/signing hex/key zeroing, diagnostic DER, native UUID/digest and every SQL callback refusal remain untested here. |
| 42 | partial | E155 | Covered: Authored native URL tests establish canonical HTTPS/default-port/path output and exact legacy function identity; refuse alternate schemes, credentials, empty query/hash, control/Unicode/backslash, IP numeric/IPv6 forms, private name families, malformed labels/TLD, and supplied/canonical2048-byte and hostname253 bounds. Remaining: Notification signing/payload digests, Probe plan/run staged Echo bytes and rollup native helper/callback ordering remain uncovered. Tests authored, not functionally executed; this does not prove DNS/sender safety. |
| 43 | partial | E115, E114, E117, E120, E144 | Covered: HTTP tests reject duplicate/oversized/unknown JSON/query and preserve auth/status; console paging validates integer/default/duplicate/injection and scoped filter binding; optional APIs reject unknown query before owner. Remaining: Fatal UTF8 split/read/release failure order and every route limit+1, exact UUID/parser alias identity and all Runtime/Transit/observability native version paths are not covered by these tests. |
| 44 | partial | E154, E156 | Covered: Plan tests enforce exact active published binding, numeric destination, policy/grants, expired/missing source, no SQL writes and preview non-authorization. Remaining: Observation service TLS/Echo resolver native parser alias/captured clock and competing malformed/archive/recovery/digest/window refusal order lacks dedicated tests. |
| 45 | partial | E139, E140, E141, E135, E136 | Covered: Adapters check same input identity/session, one owner call, commit before detached ACK, 250ms freshness/post-commit expiry, no retry and executionEnabled:false. Remaining: Exact native parser function identity, JSON key order and all v2/v3 measurement/service branches/alias capture remain unproven by v1 adapter cases. |
| 46 | partial | E138, E143 | Covered: Permit suite checks budget/actor/plan/instance/machine authorization, consumed single use, across-host replay, current tuple/grants, deadline minima/cooldown, corruption, sticky withdrawals, result digest/replay/history rollback and no new authority. Remaining: Native codec/function alias equality, exact JSON/ISO/fingerprint/challenge/proof byte ordering and all staged v4 helper branches lack direct lower codec assertions. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 47 | covered | E138, E139, E140, E141, E157 | Covered: Malformed binding/session/version/measurement/current authorization and receipt invariants have explicit refusal tests. all three validators public/legacy/canonical strict identity; native TLS/echo context/challenge/digest equal original wire exports; exact runtime and erased import lists reverse key order/null prototypes; every missing/extra key; every binding equality field in both directions; malformed values; all original scalar limits; all four closed union shapes and both echo protocols; removing ingress measurement intentionally gives valid legacy permit valid TLS and both echo; independently redigested scope mismatch; echo v1 refusal; selected TCP/UDP mismatch; inclusive boundaries and out-of-window values; malformed context/challenge and parser-caught false nonce/challenge shape and mismatching digest; mutation of every invocation-relevant permit field; literal ISO strings; exact invocation keys and binding reference; digest equals JCS digest and challenge digest; noncanonical ISO rejected getter bombs prove closed-key-before-values and caught parser errors before scalar access; traced context then challenge before scope/window; synchronous boolean and uncaught original common-getter identity; Date.now forbidden dynamically; facts unchanged/no authority fields; source imports and forbidden async/native/SQL effect calls asserted No local functional execution. Parent integrates suite into exact-head GitHub Actions. This does not assert full permit owner or Agent acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 48 | partial | E137, E158 | Covered: Registration/replacement/replay/revocation/current-evidence validation, resampling after lock, exhaustion, transactional rollback and sticky recovery are tested with direct ports and real MySQL. Remaining: Qualification marker v3/v4 persistence/parser-projection order and all raw SQL/zero-default/null sentinel/alias prototype behaviors require further direct tests. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 49 | partial | E154, E156, E135 | Covered: Current published/intent/machine reads enforce scoped JOIN identity/session/generation/expiry; planner denies metadata/foreign/corrupt/current mismatch and proves SELECT-only. Remaining: Every exact JOIN text/args/lazy JSON/capability filtering/null-default projection and native codec aliases need direct storage comparison. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 50 | partial | E138, E143 | Covered: Permit and withdrawal storage real MySQL exercises atomic claims/budgets/expiry/replay/current grants/sticky revocation, result unique ingestion/conflict and rollback. Remaining: All LIMIT257/UTF8-before-decoder errors, deliberately unchecked v1/v2 versus v4/v3 result order, two separate recovery clock reads and zero-default/prototype override behavior lack direct adapter traces. |
| 51 | partial | E137, E136, E135, E138 | Covered: Instance evidence and machine/session/capability refusals, owner register/revoke/inspect and permit ACK transaction boundaries have tests. Remaining: Qualification v3/v4 optional-marker semantics and all readonly/type-only aliases/init-no-I/O identity are not demonstrated by these runtime tests. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 52 | partial | E141, E138 | Covered: Result adapters and owners assert failed commit no ACK, post-commit freshness and identity/digest replay refusal. Remaining: No direct v4->v3->v2->v1 dispatch/inherited-discriminant/JSON-count/key-order matrix or native codec alias initialization test. No v4 ACK acceptance implied. |
| 53 | partial | E135, E136, E139, E140, E141 | Covered: Negotiation/instance/v1 claim/delivery/result compare returned immutable receipt/status flags, current identity and post-owner clock refusals; null offers/status behavior covered. Remaining: v2 typed and v3 service lazy descriptor callbacks, response key ordering/nullability and exact alias function identity lack full direct cases. |
| 54 | partial | E128, E130 | Covered: Native template parser closed/bounded/ordered/detached, immutable versions, CAS/no-op/archive/quota/reference grants and real transaction rollback are tested. Remaining: Exact terminal-newline hash regex, native parser/limits object identity/mutability, module initialization and every clock/getter/error-order boundary remain unmapped. |
| 55 | partial | E128, E130 | Covered: Real native authorization, concurrent publication CAS/quota, immutable archive/history and SELECT-only scoped query behavior have assertions. Remaining: Legacy subclass prototype overrides, exact count-before-list text/args/null JSON mappings and malformed driver JSON versus business validator timing require direct raw-store tests. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 56 | partial | E129, E131 | Covered: Numeric/DECIMAL sequence and limit-before-write, immutable cap, closed detached selection, same-Tx original Forward/CAS/capacity/provenance/replay, no-op metadata attach and retained history are asserted. Remaining: Full old/new aliases, exact raw SELECT b.*/double-scope/current-at SQL and final zero-arg new Date versus captured Date.now evaluation need direct comparison. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 57 | partial | E134, E129, E131 | Covered: Existing browser batch workflow covers group selection, stale CAS/lost-reply/publication and immutable path binding behavior; binding suite covers owner shared transaction. Remaining: No dedicated PathGroup raw-store suite for count override/revision-only quota,63/64 history, priority restoration, archived reference error order, exact SQL/prototype/static and all CAS/rollback branches. |
| 58 | partial | E148, E134 | Covered: New B savepoint suite checks success result identity, classify-before-rollback/project-after-release, unknown/refused/classifier/projection errors and create/rollback/release faults; classifier status/retryable/error identity/shared mutable Set tested. Browser tests cover publication workflow. Remaining: No full publication store create/count/event override,24-revision/LIMIT20/quota/digest/compensation/CAS/late transaction failure matrix. Browser behavior cannot prove each SQL predicate. |
| 59 | partial | E159 | Covered: Authored explicit-port tests assert manager auth before replay; template grants sorted before write and no-op revalidation; supplied Tx across all collaborators; response persistence failure rolls back head/revision/audit/replay and same-key retry succeeds; historical describe permits archived metadata without live grants but active resolve refuses before template disclosure; returned members preserve requested/input order and distinct ingress/common protocol refusals precede writes. Remaining: Raw MySQL SQL/count/head locking/CAS/quota archived inclusion, complete pagination/archive/error clock boundary and constructor/prototype alias compatibility remain uncovered. Fake transaction rollback is not real-MySQL evidence; run in Actions. |
| 60 | partial | E148 | Covered: Ingress deployment isolation shares tested success/refusal/fault ordering and same supplied SQL transaction object. Remaining: No IngressDeployment create/count/event hooks,64-batch/20-revision/LIMIT16, result association/origin/partial refusal/compensation or full rollback tests. Related Path browser coverage is insufficient. |
| 61 | partial | E148 | Covered: Ingress migration savepoint success, classified refusal and every create/rollback/release/projection failure preserve identity/order. Remaining: No IngressMigration early unequal group guard, sorted diff/apply/remove/restore lineage, same-Tx accepted Forward rollback, quotas/events/operations or raw SQL/CAS/prototype matrix. |
| 62 | partial | E124 | Covered: Real MySQL mTLS negotiation rejects retired boot, credential revocation and capability spoofing, retains contract-only executionEnabled:false; unauthenticated HTTP refuses. Remaining: Competing invalid inputs/raw NULL facts/capability traversal/time/error precedence, no-write exact SQL and direct reader/constructor override/alias identity need separate tests. |
| 63 | partial | E125, E124 | Covered: Delivery preview durable replay, actual mTLS identity, revoked credential/retired boot refusal, accepted+duplicate report and digest/sequence conflict, null poll, no coordinator advancement are asserted in real MySQL. Remaining: Complete delivery fake-reader/encoder/clock traces and all statement-failure/retained-plan/stale-between-transactions branches, exact response key order and legacy async prototype dispatch remain uncovered. |
| 64 | partial | E125 | Covered: Real MySQL tests exact creator/session/fence refusal, concurrent journal single writer, tail-first prepare/activate, verifier rejection, duplicate proof refusal, sealed/null completion and ingress-first recovery compensation; unchanged physical owner/fence is asserted. Remaining: Generation/revision exhaustion, malformed retained JSON/high-water, future/expiry boundaries, failure injected after each write/step/verifier and direct legacy/provider order traces remain. |
| 65 | partial | E126, E160, E103, E161 | Covered: Preparation binds3 nodes/protocols/sessions/pins/fences and tail-first activation, deterministic immutable plan, invalid ownership/generation/credential/capability/CIDR/topology refusals and no active staging SQL. Remaining: Exhaustive competing-invalid first errors, native property/getter/JSON/ISO/hash call ordering and canonical/legacy function identity remain unmapped. |
| 66 | partial | E162, E163, E126 | Covered: Fake SQL tests same-owner/foreign-owner refusal before fence overwrite, fence+1/6locks/3writes; real MySQL proves whole reservation rollback, one concurrent winner, owner retention and monotone fence2 re-acquisition. Malformed logical sets refuse before I/O. Remaining: No direct test post-allocation capacity failure, exact late per-node policy getter timing, malformed raw row count/Number coercion/fence maxima or failure at every lock/assign/count; Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 67 | partial | E160, E125, E163 | Covered: Staging pure immutable journal/refusal and isolated non-executable SQL, reservations rollback/exclusivity and abort refusal once coordination exists are asserted. Remaining: Complete stage/abort owned-slot/all-before-write release traces, lease+5000/Snapshot boundaries, exact-ten-second authority, changed second slot before first release and stage CAS/mid-release rollback are not covered by these narrower tests. |
| 68 | partial | E144, E149 | Covered: AuditEvents/AuditReadModels: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors Remaining: Per-family raw SQL/node-association/attribution/numeric projection golden cases, complete source/kind/error alias/default/reflection/mutability contracts, all cursor/property/byte-limit/error permutations and physical SQL plan/pool evidence |
| 69 | partial | E144 | Covered: ForwardDiagnostics: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for admission/bounded same-read provenance and diagnostic snapshot/plan/config/session refusal. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 70 | partial | E144, E150 | Covered: StationAlerts: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick Remaining: Public command replay/CAS/quota/silence/ack sequence, policyCount legacy overrides, pure rules/recovery/episode matrix, storage retention/loss/SQL pruning, diagnostic owner and existing native store row mapping |
| 71 | partial | E144, E146, E147 | Covered: Notification secret/vault/HTTPS sender: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Native sender test replaces original DNS and HTTPS functions only: cancel with pending DNS or guard retains admission until true completion; close joins drains. HTTP302/503 returns rejected,204 delivered; request error returns unknown; one DNS and one request per send with TLS1.3/rejectUnauthorized/agent:false. Worker acquires exact scope/endpoint/revision/authority secret binding only after claim commit, zeroes passed bytes after result and releases lease only after sender idle. Remaining: Actual FileNotificationSecrets filesystem encryption/exclusive stage/link/read identity/32ref quota/pin pruning and Linux permission/tamper behavior untested by this fake lease. DNS address policy full range, HMAC exact signature, oversized response/overall deadlines/socket-close faults remain uncovered. |
| 72 | partial | E144, E146, E147 | Covered: NotificationDeliveries: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Worker tests verify claim commit-before-acquire/send, current dispatch manager reauthorization (revoked manager yields cancellation), missing lease yields nonnetwork credential refusal, unknown result preserves unknown and persisted30s retry-wait rather than immediate resend. Claim and finish failures roll back their transactions with retained fence; worker ticks coalesce and close waits actual idle then lease release. Read output contains no credentials/destinations/authority references. Remaining: No exhaustive6-attempt/expiry/rate/capacity/recovery/silence/changed policy or endpoint/history/query/cursor/loss state matrix, actual MySQL or full enqueue handoff. |
| 73 | partial | E144 | Covered: ProbeRunHistoryRecorder/ProbeRuns: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for same-Tx capture/immutable result/retention/eviction/loss/corruption and bounded historical queries. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 74 | partial | E144 | Covered: ProbePlans: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for creator delegation/current preview/CAS/replay/run/stop/recovery/default-off scheduling and original issuer/no deadline renewal. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 75 | partial | E144, E153 | Covered: NodeTelemetry/HostTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero Remaining: Forward/Probe mapped-family provenance/counter matrices; latest/history actual point ordering/digests/deltas/cooldown/rate/clock bounds; adapter SQL/observation pool deadlines/destruction; raw quotas/pruning and real MySQL rollback |
| 76 | partial | E144 | Covered: ForwardTelemetry/ProbeTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for current assignment/direct TCP/current instance/provenance and counter/reset/gap/history/rollup semantics. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 77 | partial | E144, E153, E164 | Covered: TelemetryRollups: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Node/Host ingestion calls original public real processObservation/hostObservation and same-Tx recorder; unsupported Host yields empty metric maps unavailable; absent process CPU omitted; recorder failure rolls back raw head and observation together Public fold and real processObservation; uint64-max gauge wide sum beyond64bit, exact9 counter increment near uint64 max, immutable prior bucket; receipt-end minute/hour boundary and monotonic elapsed rather than receipt delta; missing metrics omitted; sequence/drop/truncation gap, sequence/counter rollback reset, overflow before terminal, no interval/increments on noncontinuous; cross-bucket/cross-scope reuse refusal Remaining: TelemetryRollups public query/capacity and real rollup storage cursor/bucket/loss atomicity; complete Host CPU/context/missing and Forward/Probe conservation matrices; quotas/pruning/128-bit maximum and real MySQL equivalence |
| 78 | partial | E144 | Covered: ObservationServices: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for config/TLS/Echo parser/window/pin/CAS/archive/immutable digest metadata and no-live-health projection. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 79 | partial | E137, E158, E136, E135 | Covered: Direct owner tests assert immutable registration and non-renewing replay, generation CAS/revocation/capability withdrawal/time resample/current-evidence and rollback. Real MySQL covers concurrent replacements/recovery; registry covers native machine dispatch/ACK. Remaining: Exact every dynamic Date.now call, qualification fields v3/v4, complete old/native constructor/function/type identity require additional evidence. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 80 | partial | E138, E137 | Covered: Current v1 instance identity/capability/expiry is tested; no v2/v3 qualification evidence located. Remaining: No dedicated ProbeTypeRegistry/ProbeServiceRegistry qualification suites for two-vs-three measurements, servicesVersion spread/proof marker, equal-generation mismatches and v2 eager-v3 lazy ACK clock/error precedence. |
| 81 | partial | E154, E156, E115, E138 | Covered: Plan preflight validates detached closed input, same-Tx manager+grant auth, active assignment/current binding, metadata refusal and no writes; permit owner/HTTP issuance replay/current checks covered. Remaining: Service resolver TLS/Echo context/digest clock chain, finite-plan notAfter and all five preview-vs-three issue kind distinctions need direct dedicated cases; no staged Echo enablement inferred. |
| 82 | partial | E46, E47 | Covered: Numeric endpoint/security refusal before dial, no application bytes, one attempt, provenance, replay/cancellation/global cooldown Remaining: Native Echo exchange exact256-byte write; UDP single257-byte read; TCP ReadFull/short read/EOF/trailing byte, context marshal versus two time parses and original Check/Now order. Fresh default dialer and constructor coverage may be shared with34/175. |
| 83 | partial | E14, E48, E26 | Covered: Persistence before bind/prepare, offline no replay, activation only after real peer proof Remaining: Runner exact Hello/report fields/bytes including ignored local marshal failure and pending best-effort partial decode versus strict live ACK; replacement/drain/fallback and partial-start stop trace. Existing persist-before-bind and live workflow tests retain credit. |
| 84 | covered | E35, E34, E40, E42 | Covered: Original compiled order/defaults/metadata/platform/flags/capability dedup and callbacks are covered by existing catalog complete. New private tests pin zero Registry and no native default projection, old header/duplicate/list/requirements/Probe errors before clones/strict public validation; preserves first error with representative multiple defects. Remaining: No missing assertion identified; exact-source execution still required. |
| 85 | partial | E117, E118, E119 | Covered: Paging/filters before reads, candidate management/auth-before-SQL, scoped count/page/overview, bounded diagnostic sanitized no-health and actual SELECT-only composition are asserted. Remaining: Exact callback conversion order/time source/new Date defaults,50-failure cap, mutable alias object and zero-default prototype behavior remain. Use integrated legacy-entrypoints and type-source/runtime-type-map canonical alias evidence; do not treat missing duplication in this behavioral suite as a gap. |
| 86 | partial | E138, E143 | Covered: Extensive direct port+MySQL assertions cover budget/current evidence/claim/revoke/inspect/result/withdrawal replay, minimum expiry, corrupted histories and failed commit rollback. Remaining: Full ordered clock/JSON/codec call trace, every256/four-active actor/Node edge, private alias/default constructors and all staged v4 branches remain unmapped. |
| 87 | partial | E139, E140, E141 | Covered: Commit-before-ACK, one owner call, exact Node/session input, post-commit freshness/staleness/malformed receipt, detached output and no Bearer substitute have tests. Remaining: Exact helper alias/key order/default captured-vs-dynamic native clock and all max Date/future boundaries remain outside those assertions. |
| 88 | partial | E138 | Covered: Only underlying v1 permit owner current binding and instance checks are exercised; no v2/v3 adapter evidence located. Remaining: No dedicated ProbeTypes/ProbeServices adapter poll/claim/status/result suite for version-specific descriptor lazy callbacks, service selection before identity, exact time caps and committed-late ACK handling. |
| 89 | partial | E116, E114 | Covered: One supplied authorized transaction, provider errors/no projections after denial, detached query and operation JSON null/Boolean/unknown fields with Forward ID are asserted. Remaining: Exact frozen feature copy/new-return-copy and all Forward->status->operation->metadata call sequences/default alias identities need direct cases. |
| 90 | partial | E120, E121 | Covered: Scoped metadata-before-resolver/reference, granted exact revision, no-authority/immutable proposed spec, mutated caller input and corrupt persisted reference rejection are asserted in ports/SELECT-only MySQL. Remaining: Exact raw callback conversion and final zero-arg new Date clock/alias identity/loading traces remain. |
| 91 | partial | E122, E123 | Covered: Same-Tx auth, bounded peer windows/current/revoked/expired/null endpoint, exact desired adjacency and malformed/cross-scope rows; real SELECT-only MySQL unchanged tables are asserted. Remaining: Native clock capture/single sample/conversion getter ordering and full old mixed entry identities need direct traces. |
| 92 | partial | E109, E95, E99 | Covered: Owner-authorized one-Tx changes/replay/no-op/current records, token hash/detached snapshots/cross-scope refusal, effects and full response rollback are explicit; real MySQL proves whole member and Node grant rollback. Remaining: Constructor arity/type alias/default identity and exact SHA frame/time/ISO truthy zero-vs-negative max bounds remain unproven. |
| 93 | partial | E105, E95, E106 | Covered: Management validates immutable policy before await, current-manager replay gate, original authorizer reconciliation, whole-Node revoke no capacity veto, audit/response failure whole rollback and revoked credentials. Remaining: Exact every request-digest field/evaluation order, native ISO truthy cutoff and legacy/prototype/type identity need direct tests. |
| 94 | partial | E120, E121 | Covered: Catalog current scope and flags/default control-enabled distinctions remain separate from Node proof/authorization/platform acceptance; real MySQL contract included. Remaining: Native catalog nested object identity, constructor flag getter timing and all descriptor function aliases/loading remain outside behavioral assertions. |
| 95 | partial | E132, E128, E130, E129, E131 | Covered: Native tunnel browser workflow and original Path/Forward transactional owner tests cover actual authoring/binding contracts. Remaining: No direct NativeTunnels six-forward-method receiver/result identity, constructor collaborator order/single management object and topology-spread-specific tests. |
| 96 | covered | E34, E40, E38, E42 | Covered: Representative multi-defect pairs establish actual original native header and real nil callback presence -> private duplicate ID -> declaration/list -> requirements -> Probe agreement -> Probe capabilities -> strict public validation last, with literal old errors. Private public adapters retain optional nil hooks, copies, same host/current instance/check/error and do not create another registry owner. Remaining: No missing assertion identified; exact-source execution still required. |
| 97 | partial | E49, E50 | Covered: Echo endpoint numeric/mapped/zone/hostname/address/port/protocol/CIDR/metadata boundaries and unchanged permitted loopback; context decode refusal still samples owner Now Remaining: Valid complete typed Echo context driving original current-instance callback/lock/deadline checks; malformed encode must return before clock while decode refusal samples clock (existing decode test already pins latter). |
| 98 | covered | E111, E95, E165 | Covered: Changed-only grant reconciliation/no-op/replay owner gates, original resource lease retention, current authorization/capacity and response failure real-MySQL rollback are explicit. canonical/public/legacy class strict identity; interface version1; constructor arity5 and prototype change method; compile-only exact API method and legacy/public/canonical response/port types; missing/null/nonfunction/throwing reconcile fail without provider effects full command and request exact values and property order; Object.isFrozen both; request digest equals original four-field PUT frame; nativeValueDigest strict identity to contracts/shared digest; exact same request to claim/effects/respond; canonical source imports original alias and contains no generic request envelope helper all identifier, revision, Boolean and key invalid/boundary values; poison key coercion blocked by every preceding validation; no provider effects for invalid inputs; MAX_COUNTER and ASCII1/128 keys accepted; source asserts actual predicate order actor/scope/profile/subject/revision/Boolean/key (the wording lists fields, source keeps original evaluation order) exact begin/owner/claim/apply/reconcile/respond/commit sequence, original Tx at every callback and provider this receivers; changed202 with original operationIds array; unchanged200 empty operationIds and no reconcile; respond receives exact returned response unchanged has zero effect writes; replay returns exact response identity with only owner/claim/commit; denial still precedes replay and preserves error identity all failure boundaries original error strict identity; exact prefix then rollback; grant/effect/receipt state fully restored; same request can retry and commit; response is mutable original key order; compile-only alias equality checks current control.ts supplies db/identity/idempotency/transport and explicit reconciler; current api/routes.ts passes exact actor/scope/profile/member/key/revision/allowed positions; application/transport-grants is exact canonical reexport; no unknown external-consumer requirement invented Remaining: No missing assertion identified; exact-source execution still required. |
| 99 | partial | E113, E95, E129, E131 | Covered: Direct/Relay create/update/remove/retry preparation/owner writes/capacity/receipt transaction order, replay authorization, CAS/no-op and injected failures are asserted; real MySQL validates atomic rollback/history and retained resources. Remaining: All path/group/ingress/publication variants and complete old aliases/method checks/default capture are not proven by ordinary Forward command cases. |
| 100 | partial | E129, E131, E113, E134 | Covered: Path bindings and browser group/publication cover shared Forward CAS/provenance/idempotency, no-op attach, retained historical binding and late failure rollback. Remaining: Ingress deployment/migration restoration/compensation and optional resolveCreateIn fallback paths have no full direct owner suite; batch browser flow cannot prove every same-Tx subcommand/provider branch. |
| 101 | partial | E113, E95, E114 | Covered: Retry ports assert reference->current Forward before locked source, reauthorization/recovery/stale/status refusal, source identity and unchanged intent; real MySQL response failure restores operation/deployment/idempotency; HTTP exact key/actor/scope/CAS. Remaining: Every competing-invalid first-error combination and exact previous_spec/source alias identity not independently mapped. |
| 102 | partial | E151, E152, E145 | Covered: Extensive direct and real MySQL passive observation assertions cover input/provenance/expiry/no-health, actor/Node/global admission/cooldown, cancellation retains capacity until work stops, dedicated connection destroy/rollback/pool race and real blocked auth deadline. Remaining: Exact all dynamic timer/native controller/getter invocation order and each report note/conversion byte-boundary remain unmapped; no physical/live-health claim. |
| 103 | partial | E102, E101, E127 | Covered: Native Relay compiler/refusal/immutable prepared binding and production HTTP Relay path used by scenario script. Remaining: No dedicated RelayPlans structural fake verifies parse-before-Tx/manage/error/preview-ID/forced-enabled and exact required provider receiver/result union. |
| 104 | partial | E31, E28, E29, E30 | Covered: 4096/32768 boundary+1 reads, reader original error, partial error Code, claim burned through HTTP failures/cancel and no retry Remaining: Actual v2/v3/v4 request projection -> encoding -> response Parse/Check traces, close/cancel behavior and invalid path before providers; retain existing bounded native body and HTTP workflow anchors. |
| 105 | partial | E33, E51 | Covered: Result provenance/quantization/uncertainty refusal, strict shared result fixtures/digest/typed echo Remaining: Literal v2/v3/v4 native projections with descriptor/service/echo fields and original service/TLS/context Check/Now/error order; no unrequested protocol expansion. |
| 106 | partial | E144, E115, E114, E166, E167, E139, E141 | Covered: HTTP scope/key/strict JSON/cookie/status, optional service named/positional middleware order and fixed console security asset serving are asserted; mTLS refuses Bearer/claimed fields. Remaining: Fatal UTF8/chunk-release/read failure/limit+1 on every route, exact native TLS fingerprint refusal order and telemetry machine-lookup bypass need dedicated native HTTP helper cases. |
| 107 | partial | E128, E130, E129, E131, E134 | Covered: Native template/binding owner ports+real MySQL test CAS/quota/archive/replay/immutable history/grants/shared Forward rollback; browser covers batch interactions. Remaining: Complete PathGroup/Publication raw stores, prototypes, every preview/apply/compensate/cancel alias branch and source-specific limits/digest evaluation remain partial. |
| 108 | partial | E148 | Covered: All three publication/deployment/migration store savepoint boundaries and refusal classification have new direct fake SQL tests. Remaining: Complete IngressGroup/Deployment/Migration owners/routes/raw query/CAS/history/compensation need suites; savepoint isolation alone is a narrow subset. |
| 109 | partial | E31, E52, E28, E53 | Covered: Exactly32-byte entropy including short read, both qualification timestamps parsed, negotiation nonauthority, claim burn and current gate Remaining: Native v2/v3/v4 projection fields/bytes and service context time/construction sequence at actual callsites; share105 fixtures. |
| 110 | partial | E31, E22, E23, E14 | Covered: Machine request exact public fields excludes private key, expiry before renewal errors and omission, durable renewal retry and snapshot persistence Remaining: Drain/report literal UTC offset/nanosecond/zero and nil observations/empty drain bytes; Snapshot dual-invalid ValidUntil-before-IssuedAt; renewal provider/conditional clock/overlap traces. Do not demand deterministic Go map iteration beyond original semantics. |
| 111 | partial | E33, E30, E51 | Covered: Report once, ACK failure burns and cannot retry, safe uncertainty/rounding/deadline serialization Remaining: v2/v3/v4 status projection/Marshal/strict Parse then exchange second encode; all four result ACK dispatch and final clock/error/report-once stage traces. Existing serialization uncertainty/rounding assertions remain coverage. |
| 112 | partial | E54, E50 | Covered: Nil/empty protocols differ, detached equality and changed protocol/challenge refuse; typed context encode then same parse error; both dates parse; owner decode error still samples Now and parent nil equality Remaining: Complete valid Echo typed context, nil/empty comparison and product endpoint/driver/current-instance/deadline checks. Existing decode-error samples-clock test already satisfies that clause. |
| 113 | partial | E117, E120, E122, E128 | Covered: Native public query parsing preserves closed bounded fields, duplicate/unknown and canonical paging/ref filters with validated callback inputs. Remaining: Every old/public query alias function identity/init graph and all optional observability cursor/default query helpers not covered by these cases. |
| 114 | partial | E31, E23 | Covered: Shared and legacy time parses return raw RFC3339Nano values/errors for fraction/offset/zero/invalid, both qualification parses, Relay first mapped errors Remaining: Hello setup/identity/Guard-init/diagnostics-before-parse; Snapshot invalid validity skips issued; post-provider expiry reparse and overlap parse-error-before-conditional Now. Existing wire time/schedule invalid/offset vectors retain credit. |
| 115 | covered | E113, E95, E97, E168, E169 | Covered: Native Forward command preparation asserts Direct compile before and after reservation, sorted Relay authorization, ingress move revoked/recovery guard, retry/capacity/same-Tx rollback and immutable input. Static assignment registry validates source ownership/driver roles. Complete bounded original/public/legacy executor registry native factory and six-method adapter contracts; exact type aliases additionally in runtime-legacy-type-map/type-source suites. Real registry enforces catalog length then descriptor/version/duplicate and ordered six-method getters, binds/freeze captured callbacks with original receiver/promise/arguments. Exact native direct/relay/multihop selection; frozen fresh native factory triple/provider refs; original fifth-argument default omitted/undefined and explicit custom registry. Real Direct authorize/lock/fake-compile/reserve/real-compile, update equal/changed revision transition; both Path adapters sorted auth-lock/enabled canExecute and disabled create-vs-update planning; moved-Node state/recovery/revoked/sorted locks; retry authorize/lock/conditional transition and explicit capacity; injected owner failures original identity/stop at every existing callback. Existing full Forward command/real MySQL owner atomicity suites retained. Exact-source Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 116 | partial | E109, E111, E105, E95 | Covered: Member/Profile/Node reconciliation same-Tx/current authorizer/sorted references, disabled/no-op choices, withdrawal with retained leases and late failure rollback are asserted with ports+real MySQL. Remaining: Explicit member receiver and complete ordered callback vectors for Profile/Access/Node reconciliation using the original supplied transaction; existing public/canonical/legacy strict identities already prove constructor/prototype alias identity. Do not require unrelated native default or unknown external consumers. |
| 117 | partial | E105, E109 | Covered: Canonical Node management/grant behavioral input/output/cutoff/rollback tested through explicit effects. Remaining: Complete readonly/mutable public declaration and legacy type export identity is type/static coverage, not established by these tests. |
| 118 | covered | E97, E95, E170, E169 | Covered: Deterministic source ID execution, constructor snapshot capture/no reads, same-Tx callback/ownership/foreign roles/duplicate physical slots, full merge failure and real MySQL publication/capacity rollback are explicit. Canonical/public/legacy Snapshot registry and Relay source are exact class/prototype/constructor aliases; native clone exact alias and dynamic global lookup, exact native roles/frozen readonly catalog. Complete source/ID/driver/schema/role/ownership registration refusal messages and first-error precedence; original collect receiver bound/captured at constructor with no eager reads/clock/clone; declarations snapshot/freeze and source-ID order. Original direct clone/freeze before first await and every contribution before next source; context copy/freeze, dynamic native clone replacement and original exceptions at each stage stop later sources, native DataCloneError preserved. Assignment/logical/physical conflicts and ownership-before-conflict, final assignment-ID sort; owner objects remain mutable. Relay deferred reader captures original member receiver/current Tx/node/includeAccepted and returns original references without authorization/publication. Existing complete Snapshot compiler/ownership/conflict/merge suites retained, runtime-type-map supplies exact generic/readonly alias declaration symbols. Exact-source Actions execution separate. Remaining: No missing assertion identified; exact-source execution still required. |
| 119 | partial | E218, E217, E95 | Covered: Missing clock/time methods refuse before samples/effects; host state/claim/report/authority order and pure deadline boundaries are directly asserted. Remaining: Native/custom codec receiver failures and all NaN/infinity/zero/fraction/offset/error/short-circuit sample combinations, including every captured legacy default, are not exhaustive. |
| 120 | covered | E97, E125, E124, E162 | Covered: Runtime Snapshot callback receiver and supplied transaction, Transit native wrapper operations/persistence and reservation same-Tx/no-reset behavior covered. Remaining: No missing assertion identified; exact-source execution still required. |
| 121 | covered | E222, E223, E224 | Covered: Explicit effects prove no overlap, first-tick scheduling, repeated start/close, active/onStop joins, one cancellation, completion-time backoff thresholds/cap/reset and sanitized all-settled shutdown. Existing explicit/native host suites cover validation/receivers/constructor timing/deferred work, active/backoff/success/failure/cancellation/drain semantics. New actual server.ts VM fixture replaces imported dependencies only and asserts five original declarations, exact flags and intervals, shared bounded backoff, authority maintenance guard, serial all-family pruning despite failures, tick/onStop/logger callbacks and HTTPS failure/normal drain-before-dependency order. Native legacy constructor defers work and resolves setInterval/clearInterval/performance.now dynamically. Aggregate/effects/declaration/backoff error priority and bounded inputs, frozen declaration/provider receivers, retryable cancellation after throw, twenty failures at the capped delay, no-delay sample counts and independent workers/all hooks draining are directly asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 122 | partial | E100, E218, E105, E95 | Covered: Ledger early capacity sample/claim/deadline/drain/complete boundaries, Host compile/publication and existing Node/multihop transactional paths are asserted. Remaining: Complete Ledger/Relay/Node invalid-time guards, constructor precedence/native receivers and provision-format-after-commit versus credential-format-before-commit fault matrix remain partial. |
| 123 | partial | E177, E178, E144 | Covered: Exact Error/helpers/lifecycle alias identity and failure-path drain, port-only preview authorization/Tx, HTTP failure release and closed-input behavior are asserted. Remaining: Socket disconnect drain and complete source-text/augmentation compatibility remain unproven; Current source/type/private import graph and existing compiled callers are checked by typecheck and check-boundaries; this does not prove every declaration-augmentation/reflection, default lifetime, getter or historical consumer case. |
| 124 | covered | E177, E185, E218, E186 | Covered: FR-0005 Runtime named Policy alias repaired. Compile-only exact equality pins all thirteen required mutable numeric fields through lower/framework/original/root/shared/runtime/legacy and Runtime Hello policy. Runtime namespace pins pure leaf version only; old defaults retain identity/frozen values/insertion order. Host default/explicit policy copy, validator receiver/error, one construction sample, response detachment and native invalid input/NaN refusal are directly tested. Current full source/type/private inventory finds one declaration and no former-location augmentations/tooling consumers; boundary scan rejects native/L2 lower-leaf dependencies. Remaining: No missing assertion identified; exact-source execution still required. |
| 125 | partial | E116, E122, E118 | Covered: Read models keep non-authorizing/null/unknown diagnostics and mutable API response projections through explicit ports. Remaining: Full Observation/Drain/Condition declaration required/mutable fields and canonical native alias identities are type compatibility work; runtime cases do not prove complete shapes. |
| 126 | partial | E101, E103, E95 | Covered: Native plan views consumed through actual compiler/Relay paths preserve sessions/pins/fences and deterministic immutable plan output, stale-generation isolation and rollback. Remaining: FR0007 required time->view guards before option getters and raw config/hop references with malformed/getter/throwing inputs lack direct RelayHost fake views. Exact conditional peer Now/skew samples and first-error nested traversal still unproven. |
| 127 | partial | E101, E126 | Covered: Native prepared execution value records and nested resource/pin/session/phase data validated through compiler strict parsing. Remaining: Complete common execution value declaration/generic aliases/canonical native method sets and direct JSON distinction need contract/static evidence. |
| 128 | partial | E218 | Covered: Required machine methods refuse before clock/policy/provider calls; protocol/foreign identity/capability order, boot history, publication, replay ACK/fencing and failure rollback are directly asserted. Remaining: All native getter/includes/receiver/error-text and allocation-before-integrity edge cases require additional vectors. |
| 129 | partial | E97, E95, E101, E113, E142 | Covered: Actual native compiler/Snapshot/Forward/source/Probe/HTTP integration tested through explicit callbacks/real MySQL; current session/config/fence/current-auth and transaction rollback covered. Remaining: Every native specialization constructor/default capture, generic type correlation/old alias, function identity/module initialization/getter sorting and full SQL trace remains incomplete. Behavioral integration is narrower than exhaustive specialization compatibility. |
| 130 | partial | E120, E101, E126 | Covered: Explicit native Profile revision/digest and Relay/Transit compiler consumers have assertions. Remaining: FR0009 opaque Profile default versus native family declaration/generic structural compatibility requires type tests; these runtime paths are not full public semantic equivalence. |
| 131 | partial | E101, E102, E126, E107 | Covered: Profile parse/native config/no-op/CAS and compiler digest/resource/Relay/Multihop/Transit config bindings are exercised. Remaining: Complete native Profile JSON/digest/key getter/freeze/error-point equivalence and typed generic consumers lack direct pure contract cases. |
| 132 | partial | E107 | Covered: Production Transport Profile commands and grants use formatter in real HTTP/MySQL flows. Remaining: Missing required formatter construction refusal before any provider effects and explicit formatter output/failure call ordering have no direct host tests. |
| 133 | partial | E106, E107 | Covered: Production machine/Relay credential rotations/replays/current-only/overlap bounds are covered end-to-end. Remaining: Constructor overlap/lifetime->formatter->four codecs prerequisite ordering and malformed provider rejection before effects lack direct explicit host tests. |
| 134 | partial | E106, E107, E105 | Covered: Machine/Relay concurrent replay changed CSR rejection, credential overlap and policy/management transactional errors are checked. Remaining: Native enrollment expiry/sign/post-sign/ordered token digest/sign errors and complete codec aliases/private handler semantics still need direct tests. |
| 135 | partial | E144, E114, E115 | Covered: Named and exact positional optional service wiring exercise original createControlApp/createApp behavior, HTTP auth/error/owner dispatch and request body status. Remaining: Hono generic Bindings/Variables/result types and every aggregate type signature/legacy reexport remain declaration/static compatibility coverage. |
| 136 | partial | E139, E140, E141, E124 | Covered: Actual mTLS machine paths refuse unauthenticated Bearer/fingerprint/session header substitution. Remaining: Exact session header empty/zero/sign/space/decimal/overflow grammar and native body reader chunk/limit/error cases lack direct helper tests. |
| 137 | partial | E144, E115, E114, E166 | Covered: Original routes status/body/header, optional admission-before-auth, cookie/duplicate/unknown/oversized and owner failure dispatch are asserted. Remaining: Full every route registration path/body limit/error precedence, native TLS failure fields and support all query/response versions remain outside these selected tests. |
| 138 | covered | E11, E12, E13, E16, E15 | Covered: Compile-time actual native Store/Codec/Input bindings plus independent exact public interface method signatures and version3. All compared native history fields and nil/empty/reference shape are pinned. Existing pure non-ADP host traces remain, plus explicit foreign-node/generation/digest/protocol short circuits and no prior decode at initial generation. Remaining: No missing assertion identified; exact-source execution still required. |
| 139 | partial | E12, E13, E19, E20, E14 | Covered: PhysicalTCP Journal for UDP, protected history reset refusal, tampered inspector no writes, imported highwater, persist before first bind Remaining: Canonical physical/literal-TCP slot and drain tuple bytes at zero/max uint64 plus duplicate/lost/stale/removed ACK effects on tails/pending/Ticket maps. Existing migration/high-water/inspection/persist-before-bind cases retain credit. |
| 140 | partial | E44, E25, E26 | Covered: Feature/inspection refusal before effects, nil providers before bootstrap, unnegotiated offline Transit refusal Remaining: Native URL prefix literal case/empty/malformed text vectors and snapshot GET uint64/header/retry plus legacy httpError As/text identity; do not require URI parser normalization. |
| 141 | partial | E55 | Covered: Lower/native identity differs and lower tagless, nil/empty/invalid raw len/cap/backing, maps/extension pointer identity, zero and nonzero metadata roundtrip Remaining: Compile-only exact Bootstrap/provider interface2 consumer binding. Existing runtime_facts tests already pin native layout/order/raw/nil/backing/map/pointer conversion; no serializer fallback requirement. |
| 142 | partial | E55, E56, E12, E19, E20, E24 | Covered: Native Runtime JSON order/null/empty/invalid, authenticated persistence/MAC refusal, imported highwater, inspect readonly, protected Relay native record Remaining: Original authenticated native payload/envelope/MAC literal bytes and representative loader multi-defect first errors, RawMessage empty/null/invalid and omitempty. Do not require every mutation cross product. |
| 143 | partial | E11, E12, E14, E26 | Covered: Host failure sequence returns unchanged authority, raw references, native write failure highwater, Runner persist before bind Remaining: Native Bootstrap/Runner proof/root/key/load/extension/credential/enable/client ordered fake-port trace and single projection/error identity; existing pure host already pins lock/load/input/history/save/release. |
| 144 | partial | E57, E26 | Covered: Prepared Transit requires explicit authorizer and independent grant/identity, offline bridge refusal Remaining: Prepared constructor multi-defect missing argument precedence/no Now and certificate/root/capability copy; adapter nil engine exact error versus nonnil partial engine retained for Close. |
| 145 | partial | E26, E57 | Covered: Offline Journal persisted before engine, no replay, forged grant/binding fails, prepared authorization Remaining: Controller issued-before-valid parse/Now/reserve/final authorization/save-before-old-close trace; Prepare/Activate nil/partial failures by existing phase with original cleanup/publication. |
| 146 | partial | E26, E13, E57, E58 | Covered: Offline no replay and saved highwater, missing execution auth, forged grant refused, native mutual TLS identity/purpose/pin expiry Remaining: Explicit peer certificate chain length !=1 refusal before intermediate iteration; failed Prepare/Activate preserves original durable generation/Fence and no cached restart. Existing offline replay/refusal tests already cover broad lifecycle. |
| 147 | partial | E59, E50 | Covered: Native Host alias vs tagless lower identity, Provider2 native method-set compilation, absent CPU null and nil/empty interfaces preserved; embedded Forward snapshot promoted fields and flattened JSON Remaining: Provider2 Host generic method binding, all native DTO field/type/order/tag/pointer/slice shape and arbitrary generic Host no-extra-read passthrough. Existing forward embedding and host nil/empty aliases are credited. |
| 148 | partial | E33 | Covered: Probe result serialization preserves rounding/provenance/safe expiry and rejects uncertain altered evidence Remaining: Four literal sample/ACK families now covered by new observationwire native wire tests. Residual Runner point timing: native unconditional Now before terminal/unavailable and Process-Z versus other time guard, ignored identity-Marshal error/local sort/cursor. Counter176 new tests close Probe point clock/retention/cursor portions. |
| 149 | partial | E30, E33, E32 | Covered: Report burn-once/cancel drain and no retries, late transport cannot revive, aggregate final diagnostics Remaining: Native exporters encode-before-timeout/Post -> deferred close ->4097 read/error/status/length/ACK/cancel ordering; four pools/epoch/tick/drop and Host blocked worker lifecycle. Probe CounterSet freeze/tail/retention/cursor now covered by176 and should not be repeated. UDP diagnostic helper exact *forward.UDP/single Stats including ignored ActiveSessions read, non-TCP Remaining/mutex and native nil semantics. |
| 150 | partial | E44, E27, E25 | Covered: All statechanging inspection flags refused before native effects, Relay/paired proof permitted, missing providers no native fallback Remaining: Global flag registration order/help/default/parser/value capture and duplicate-registration behavior, retaining existing command host option first-refusal tests. |
| 151 | partial | E44, E43, E19 | Covered: Inspection routes only resolve/inspect, token timing, enroll protected refusal/partial writes/cleanup, MAC tampering readonly Remaining: Native Abs-state/proof/Abs-key/Rel/key predicate ordering including ignored Rel errors; exact32-byte key error mask and stdout Encoder failure. Existing no-lock/no-enrollment inspection tests retain credit. |
| 152 | partial | E27, E14 | Covered: Lock/boot/constructor/run failure releases once, Runner options sampled subset, constructor before signals, same run error Remaining: Native BootID one16-byte read ignoring n; every Runner option/default propagated; actual interrupt/SIGTERM context cancellation before release and Control plan read/parse/compile/pretty stdout errors. Existing command fake-host release/construct-before-signals is coverage. |
| 153 | partial | E225 | Covered: Raw status adapter exact SELECT strings/argument order and supplied Tx; report-before-current decode and second current decode; malformed report/current first errors and absent/zero paths. Remaining: Complete malformed/undefined report epoch and all optional query/error precedence vectors are not exhaustively asserted. |
| 154 | partial | E225, E95 | Covered: Tuple generation/fence matching, applied spread fields, earliest freshness/cutoff, exact expiry and wrong epoch/missing evidence, permissive decode failure order are asserted. Remaining: Path recursion/subclass dispatch, every truthy0/NaN/invalid-time combination and aggregation ordering need more direct cases. |
| 155 | partial | E225, E180, E219, E226 | Covered: Supplied-Tx status SELECTs and original lazy decoding are directly tested; old wrapper aliases/current composition compile and migrations are exercised by MySQL CI. Thirty provider-effect cases cover guard/acquire/isolation/begin/action/commit errors, three-attempt deadlock/lock-timeout retry, release/reacquire and rollback error precedence; migration legacy/lock ownership/mode/sorted names/partial DDL/backfill/marker/unlock errors and pool.close awaiting. Remaining: Real MySQL advisory-lock competition, implicit DDL persistence and uncertain commit outcome require server/driver evidence. Constructor createPool options and full production composition/Runtime read compatibility remain outside the provider-effect suite. |
| 156 | covered | E106, E107, E171, E172 | Covered: Actual startControl configuration/feature flags used by real HTTP/Agent acceptance scripts with fail-closed feature defaults. startup1 structural options; port/features/env read/refusal order: public/canonical identity and interface1; fully structural generic Effects/Options; complete default options and exact env read list; invalid port and competing services/ingress/schedule/skew first errors; Number hex/exponent/whitespace and exact flag semantics production release short circuit/failure; required option evaluation: production/nonproduction gates; missing release path before revision; original verify error; deferred successful verifier blocks option evaluation; each of six required options refuses before later reads/start/log/signal repeated host/multihop/notification reads; policy identity/spread: multihop first1 second0 observes original reread; host bound then logged value; notification truthy first read then directory second read; disabled policy identity; enabled shallow spread/ref identity/maxSkew override; policy getter once after all option env reads and enumerable getter sequence only for spread server-start failure before log/signals; host log reread; SIGINT before SIGTERM; once-only close including rejection: start failure original error and no second host/log/signal; exact signal registration order; three signals while deferred close call close once; repeated signal after completion no extra close; child-process actual unhandled close rejection retains original identity and repeated signals never invoke close again native leaves import no L3; existing main binds original server/release: native leaf source has no modules import; DEFAULT_POLICY and release function exact native identity; main imports server.ts startControl and passes original native effects/start/release Remaining: No missing assertion identified; exact-source execution still required. |
| 157 | covered | E99, E106, E107, E173 | Covered: Real client CLI member/grant/policy/Profile/endpoint command outputs compare to HTTP native responses. opaque Url/Bytes providers; every original command/usage/file/parse/method/path/body/Number/encoding branch: 23 command/revision table cases using object Url and symbol-branded Bytes; exact method/path/body/key; Unicode/slash scope and IDs; update hex Number and node-policy/retry nonfinite stringify-null; all required positional omissions and exact per-command usage; six-destructuring ignores tail; source public/canonical identity and generic compile acceptance key precedence/create refusal; URL before CA read: all mutationKey/expectedOrFile/key selectors in table; create reads/parses/stringifies file before persistent-key refusal but never constructs URL; every command URL before opaque readBytes/request Bearer/JSON/optional headers/body length;10s timeout/destruction/error/end;chunks/2xx/status: native node:https.request replacement + syncBuiltinESMExports; original URL/CA refs; exact method/ca/timeout/headers only; Unicode body UTF8 length2 vs no headers for absent/empty; exact end body; split multibyte chunks;199/201/204/299/300/302/400/503/undefined statuses; timeout destroy original Error; request event/creation/end original failures;16 requests for16 scenarios with no retry final strict parse/pretty stdout; no new limit/retry/redirect/exit/catch: request then parse-response/pretty/log exact order; pretty literal; duplicate JSON final response rejects before output; every injected provider failure original identity/stops at stage; native strict parser identity; actual native argv/env/url/encoding/readText/readBytes/stringify/log; native source excludes redirect/process.exit/catch/extra timer and client.ts calls original effects Remaining: No missing assertion identified; exact-source execution still required. |
| 158 | covered | E60, E61, E58, E62, E36, E37, E63, E64, E65, E66, E67, E68, E69 | Covered: coverage map E47/E48/E45/E49/E28/E29 already maps actual multihop TCP/UDP lifecycle, shared budgets, cutoff/half-close/egress/framing; do not recast these as wholly absent Source assertions cover immutable native multihop projection for ingress/transit/egress x TCP/UDP; native validation/leaf/fingerprint/conversion/prepare order; original public egress detour; resolver/policy/callback/numeric dial/postdial partial-close; sole Forward TCP/UDP node budgets and failed-stage/repeated release; existing actual multihop lifecycle/drain/expiry/cutoff/half-close and UDP isolation; TLS13/ALPN/CA/pin ownership; partial control/frame IO, bounded validation, authorization/binding/FIN error order; same-package Snapshot identity, all fields, unavailable/nil/epoch entropy error/short/partial streams, atomic saturation/concurrent totals, successful prefix, actual ingress TCP payload and empty UDP datagrams excluding carrier/egress; Control native Snapshot consumer and copied terminal values. Covered means assertion inventory only, not accepted behavior. Remaining: No missing assertion identified; exact-source execution still required. |
| 159 | covered | E227, E106, E110, E223 | Covered: Actual server composition is exercised by lifecycle/security/restore scenarios including maintenance/read-only refusal, trusted authority and restart. Actual server.ts CommonJS transpilation runs with test-owned import bindings. Exact public ServerOptions/result keys, raw two-SQL native bootstrap store/rows, zero-vs-string-zero initialization, migrate/Authority/guard/default resources/native Date captures/optional recorders/readers/issuers, five tasks, mTLS options/listen timing, protected path getter/containment rules, partial-start sequential/error-close versus HTTPS allSettled, repeated close-promise and all six failure owners are asserted. Exact lazy repeated option getter trace through every default construction group plus all enabled feature constructor arguments and explicit empty host/zero overlap are now directly asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 160 | partial | E70, E71, E72, E73, E74, E75, E76, E77, E78, E79, E51 | Covered: Shared protocol positive/negative fixtures, schema matches repository, bounded/IJSON/JCS/time and typed bypass refusal Remaining: Native codec public alias binding and per-package schema lazy sync.Once/sticky compile error; validator CLI and standalone observationresponder actual config/TLS/budget/listen/lifetime fixtures. Keep generated asset parity already supplied197/198 separate and do not duplicate it. |
| 161 | partial | E144, E146, E147 | Covered: Only HTTP telemetry/Station availability/admission/dispatch is covered by new B test. The notification outbox claim/attempt/finish portions now have explicit transaction fault and ordering assertions, including late outcome failure preserving original claimed fence and no hidden sender retry. Remaining: This does not test FR0017 telemetry10 raw writes, Station event-before-outbox enqueue, notification insert duplicate/history/eviction/loss or exact SQL/native callback mappings; those remain separate. |
| 162 | partial | E148, E134 | Covered: Publication isolated item failure/success ordering and browser publication behavior available. Remaining: Exact Path/Ingress event-before-invalidation SQL statements/arguments and every history/provenance/current pointer mutation order has no direct adapter test. |
| 163 | partial | E216, E100, E110 | Covered: All quarantine owner callbacks, immediate accounts, shared publication timestamp, lazy trust and event encoding order plus fail-stop at each owner; actual recovery quarantines DB owners and preserves Agent journal. Remaining: Static legacy wrapper/default clock receiver traces and all UoW uncertain commit outcomes remain separate. |
| 164 | partial | E215, E110, E228 | Covered: Output protection/recheck, metadata/binding, exclusive dump/sync, independent authority recheck/lease bound and signed manifest-last; failures close DB without accepted manifest. Remaining: Native filesystem symlink/ancestor/vault and process args/env/getter/stdio/close fault matrix is not complete. |
| 165 | partial | E215, E110 | Covered: Issuer stop, tampered SQL and exact historical lease boundary refuse before fresh target; restore order, partial target/migrate failure, committed quarantine versus later credential/rebind failure are distinct. Remaining: All native SQL-name/hash coercion, trusted-time process/parser/skew/output and child pipeline failure/close precedence combinations remain unproved. |
| 166 | partial | E215, E110, E180 | Covered: One original DB transaction commits quarantine before binding/credentials/rebind; target DB finally precedes source close; errors retain committed versus rollback distinction. Legacy imports compile. Remaining: Native Authority reflection/identity and complete shell child-process error/unknown commit matrix are not exhaustively exercised. |
| 167 | partial | E214, E229 | Covered: Schema/reader ceilings, closed plan parsing, immutable history/refusal and compatible-versus-runtimeReady/productionApproved distinctions are asserted by static and SELECT-only MySQL cases. Remaining: Exhaustive exact public source/type aliases and all report key-order/counter/Journal combinations still need compatibility assertions. |
| 168 | partial | E214, E229 | Covered: Migration footprint/hash/partial DDL/unknown history and actual read-only database/Authority/journal preservation are asserted. Remaining: Native bounded-read stat/read/finally/UTF8 maximum and every read-only timeout/close/race/rollback error boundary remain partial. |
| 169 | partial | E229 | Covered: Real assessment verifies SELECT-only database, authenticated journals, protected Authority stability, unsafe restore and partial DDL refusal without mutation. Remaining: Exact fake plan/catalog/Authority-before/CA/open/inspect/Authority-after/report/end getter and exception order have no direct injection surface/test. |
| 170 | partial | E214 | Covered: Public CLI dispatch is asserted read-only and never constructs/mutates Authority for assessment; original operators compile. Remaining: Full argv/env/getter order for every maintenance/backup/restore/unknown branch and postcommit failure still need operator effect fakes. |
| 171 | partial | E214 | Covered: Assessment decision exit codes and read-only public dispatch/source ownership are asserted. Remaining: Complete output serialization/usage/whitelist/redaction/outer non-Error failure and release verifier fifteen-gate invocation sequence are not directly tested. |
| 172 | partial | E185, E177, E174, E186, E187, E179, E176, E188, E42 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Source entry imports and native policy identity do not establish all precise L1/L2 negative import cases, native generic/type aliases or ADP2-after-live-ADP3 refusal. |
| 173 | partial | E185, E187, E182, E189, E190, E179, E181, E176 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: Schema/entry staging is narrow; full recursive production asset/default/parser/JCS/time initialization and handwritten telemetry/spec behavior, generated declarations, ops consumers and actual image distribution remain. |
| 174 | covered | E25, E80, E81 | Covered: Canonical native assembly declarations and lower specializations, old aliases, constructor defaults/nil/error sequence, private partial fixture fallback and no default effect sampling are directly pinned. Source-only no-effect assertions supplement behavioral poison providers, without introducing a production hook. Remaining: No missing assertion identified; exact-source execution still required. |
| 175 | covered | E53, E45, E47, E82, E83, E84, E52 | Covered: Actual Runner factory binds original four resolver method values with Echo/Services/Ingress/base priority and native effects, native fresh zero Dialer, old/explicit constructor nil hierarchy and partial-fixture helpers. Existing registration/negotiation lifecycle anchors retain credit. Remaining: No missing assertion identified; exact-source execution still required. |
| 176 | covered | E50, E85, E86, E87, E88 | Covered: Real Runner assembled through injected Bootstrap/Identity/Channel with operational clock count0 and explicit native probeCounterClock binding; nativeProbeCounterScheduler source only returns agentplatform.DefaultEffects().Schedule and performs no Now call. Actual Gate/CounterSet live reader and frozen-tail page call sites use dedicated point clock; page/retention clock calls remain separate. Free native helper and partial Runner fallback stay native; terminal time is CounterSet executor native time, not either Runner clock. Existing four-way terminal/current x available/unavailable point test samples Now once before decision, preserves UTC current versus EndedAt offset, epoch/overflow pointers and max uint64 decimals; no duplicate implementation of this matrix added. New CounterSet tests cover single16-byte entropy read/short count/error/no Now,available/unavailable,256-binding bound, detached snapshots,64 concurrent mutex-protected attempts/idempotent finish/leave,success/failed/unknown outcomes,count corruption overflow,saturating arithmetic,nil methods,seal-before-begin race,in-flight->unknown,late result refusal,zero-call/final-leave freeze and original executor clock. Runner tests cover sorted35-point pages/32limit/cursor rotation,2Snapshot bound,unavailable source,10minute inclusive retention/session expiry,128-tail oldest eviction+dedup,saturating loss;9 real blocked closed Gates retain only8 readers with one-loss eviction,reader dedup,final freeze->values-only tail,session change removes8 tails. Blocking work is released with cleanup and no socket dial occurs. Remaining: No missing assertion identified; exact-source execution still required. |
| 177 | covered | E174, E179, E191, E176, E187 | Covered: Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Explicit independent protected four-file / thirteen value / seventeen type public-surface expectations, consumer counters and lower/native/asset policy negatives now supplement existing Core behavioral suites. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 178 | covered | E177, E192, E178 | Covered: Native public1/effects1 function surface and exact database type alias are pinned. Native argv is a detached slice after index2, env resolves dynamically, and original console output is retained. Both env reads precede every missing argument/URL/token refusal; arguments/env/open failures preserve first error without cleanup. Constructor/open remains outside try. Original migrate/Identity callback/log stages retain receivers and exact arguments; all failure stages await one close and close errors supersede earlier failures. The actual bootstrap entry awaits the original callback-scoped Identity constructor with native alias. Real Identity bootstrap validates before beginning, inserts account then scope then owner on the same supplied Tx, stops and delegates rollback on each write error, and hashes the exact native bearer. No migration atomicity or new token/authority semantics are claimed. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Remaining: No missing assertion identified; exact-source execution still required. |
| 179 | covered | E193, E194, E195, E196 | Covered: All ten old model exports and function arities are pinned; seven pure exports keep exact public-owner identity. Fresh old entry import/factory initialization cannot sample native time. Complete Direct guards short circuit credential reads; the native Date.parse reference is looked up before the second credential getter, which may replace that property without replacing the captured call. Existing invalid parse still samples Date.now. Form property and String/Number coercion order, listener-before-target refusal, exact errors and mutable detached returned shape are asserted. Native URLSearchParams defaults, Object.entries eager getter order, subsequent String/primitive conversion, empty versus null/undefined/falsy values, key overwrite and encoding remain. Existing direct/Relay consumers plus bounded ports/CIDRs/candidates/protocols/tones/pages complete the clause without server authorization claims. Legacy model exports exercise scope/ports/CIDR rejection, capability/listener/protocol gates, canonical BOTH spec, bounded query encoding and candidate retention. These tests do not assert getter/clock/conversion evaluation ordering. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Remaining: No missing assertion identified; exact-source execution still required. |
| 180 | covered | E167, E197, E195, E176, E198, E199 | Covered: The existing real createApp route test recursively discovers production JS, serves each exact source byte sequence with literal registered path refusal, JavaScript MIME and security headers. Current model imports its real owner public/service and native public graph; actual direct Node model/Relay imports and the adapted recursive app VM loader exercise that graph without private production hooks. Recursive production syntax and actual source/type/private boundary inventory are already configured. Saved-source functional execution remains a separate pending state; no packaged-image or physical-host acceptance is inferred. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: No missing assertion identified; exact-source execution still required. |
| 181 | covered | E200, E201 | Covered: The public request surface/version/function arities and lazy connection reads are pinned. Scope refusal short-circuits token/version; successful connection and dispatch preserve getter/method receivers, version capture before dispatch and post-decode comparison. Default options are fresh per call and explicit options retain identity. Source-native send/readJson/response failures preserve error identity except the original bounded JSON refusal. Decode precedes stale version, then caller cancellation, then status; malformed native result and property/coercion failures retain their original behavior. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Remaining: No missing assertion identified; exact-source execution still required. |
| 182 | covered | E200, E201 | Covered: Native framing/escaped scope/headers/body/options/combined cancellation and status/errors retain source representation. Native send returns the exact fetch Promise without an async wrapper, preserves synchronous fetch errors, original timeout nullish default and options signal getter order. Original mutable input serializes first for signature and separately for native body, without clone/freeze. Same-signature simultaneous mutations share one key and independently dispatch; signature/key failures precede connection reads. Existing failure retention/success deletion/reset tests and explicit no-effects reset assertion cover pending-key lifecycle. No stronger concurrent-outcome guarantee or new retry/queue is claimed. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Remaining: No missing assertion identified; exact-source execution still required. |
| 183 | covered | E167, E197, E202, E203 | Covered: Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Public native mount tests cover lazy construction, all 24 initializers and main callback/reset/connection effects. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: No missing assertion identified; exact-source execution still required. |
| 184 | partial | E196, E167, E197, E176 | Covered: Legacy Relay helpers validate bounded Profile fields, peer/port inputs, immutable Profile revision, distinct Nodes, capability/grant refusal, multihop order/cycles/closed gate. These tests do not cover full DOM controller or native getter evaluation timing. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Legacy Relay helpers validate bounded Profile fields, peer/port inputs, immutable Profile revision, distinct Nodes, capability/grant refusal, multihop order/cycles/closed gate. These tests do not cover full DOM controller or native getter evaluation timing. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: Relay pure form validation and source assets are covered; six helper exact identity/order/time plus per-init DOM caches/edit/pinned-plan/CAS/unknown/history/deployment sequences remain. |
| 185 | partial | E204 | Covered: Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: Echo display tests validate recorded shape/relationships without browser cryptographic verification. Complete machine-context and all timing/service identity permutations and native receipt-owner correspondence remain. |
| 186 | partial | E138, E143 | Covered: Existing v1 non-Echo permit/result tests assert one shared owner transaction, current binding/digest duplicate/conflict, failed store/guard rollback and sticky consumption/withdrawal. Remaining: These fixtures are tcp-connect v1. No Control owner suite located for v4 Echo challenge/proof/byte/TLS historical capture, MySQL0037 optional representation, missing head/loss/immutable history or non-Echo-vs-Echo native family selection. Schema/Agent evidence covers different narrower contracts; no live Echo acceptance. |
| 187 | partial | E205, E204 | Covered: Exercise real initProbeRuns exported entry and actual list/detail/next/cancel/input/clear button listeners with a minimal DOM and independent Node SHA256 canonical fixtures; no private source extraction or production hooks. Legacy and TCP/UDP echoed runs verify full stored summary digest and separate canonical Echo invocation; mutations of stored actor/binding/resultDigest fail without reseal, while nonce/timeout/service changes fail even with a correctly resealed summary and stale invocation. Detail refuses foreign Scope/service Scope, retention cutoff, invalid lifecycle/expiry/status/proof/byte arithmetic/closed fields; valid detail preserves full content digest. List rejects invalid local window/limit/path/status before I/O, accepts exact echoed filter, checks filter/order/duplicates/query-bound cursor and response-byte refusal. Valid fixed cursor continuation loads one explicitly requested older page only. Historical display states unknown health/no execution/no independent proof and exact controlled request/response counts; loading an ID does not read detail. Cancellation, edited inputs, clear and Scope changes drop late responses without automatic requests. Exercise real initProbeRuns exported entry and actual list/detail/next/cancel/input/clear button listeners with a minimal DOM and independent Node SHA256 canonical fixtures; no private source extraction or production hooks. Legacy and TCP/UDP echoed runs verify full stored summary digest and separate canonical Echo invocation; mutations of stored actor/binding/resultDigest fail without reseal, while nonce/timeout/service changes fail even with a correctly resealed summary and stale invocation. Detail refuses foreign Scope/service Scope, retention cutoff, invalid lifecycle/expiry/status/proof/byte arithmetic/closed fields; valid detail preserves full content digest. List rejects invalid local window/limit/path/status before I/O, accepts exact echoed filter, checks filter/order/duplicates/query-bound cursor and response-byte refusal. Valid fixed cursor continuation loads one explicitly requested older page only. Historical display states unknown health/no execution/no independent proof and exact controlled request/response counts; loading an ID does not read detail. Cancellation, edited inputs, clear and Scope changes drop late responses without automatic requests. Remaining: New functional cases authored but unexecuted locally; exact next integrated SHA Actions pending. Real HTTP owner/parameterized SQL and server retention/history capture remain in Control evidence. Browser run UI validation covers invoked TCP/UDP Echo and legacy summaries; real browser layout, all cryptographic/retention/record-size edge permutations, typed/TLS family matrix and native stored-history correspondence are not exhausted. |
| 188 | covered | E174, E199, E206, E204, E176, E167 | Covered: New real-import source map assertions pin all 22 old browser leaves/23 initializer exports, their real app imports and exact per-file L2 classification, preserve import-free original native bodies and the real Rule L3 owner/L2 view split, and refuse a folder classification exemption. The manual default/callback/consumer/removal map is tied to those concrete source entries. Four native telemetry open actions really dispatch bounded GETs; initialization, changed filters and clear do not dispatch. Existing tunnel tests start both reads concurrently and cancellation owns both, original Probe revoke issues its follow-up receipt query, and new accepted template publication explicitly refreshes its bounded list. Existing actual graph/type/private mutations and recursive fixed asset test cover the source/asset boundary scope. No blanket no-automatic-read or live capability inference is made. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 189 | partial | E207, E203 | Covered: Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: Existing detailed Rule flow assertions cover success/CAS/replay/preflight/abort/tail/path/Profile behavior; full effect getter ordering and every callback/refresh/finally exception path remain unasserted. |
| 190 | covered | E197, E207, E203 | Covered: The new native Rule public-factory tests pin lazy construction, exact destructuring/default global lookup order, old init name/arity, return key order and exact command callback references. DOM input tracking distinguishes unchecking retained inputs from dropping the Set; suspended rows, item/callback identities, listener wiring, selection state, show/consent/clear sequence and discard notification remain. Clone, ordered and JSON each evaluate getters independently in original key order, preserve native coercion/errors and mutable detached values. URI, UTC clock construction, lazy default UUID, explicit/default unbound confirm/newKey, cancellation reason/object, timeout options and exact bounded error text/refusal codes are pinned. Actual main composition is mounted through its public factory and proves all 24 initializers keep order, connection version remains lazy until initialization, and Profile/Path callbacks later dispatch the identical proposal to the existing Rule consumer. Existing actual Rule owner/legacy flows and recursive app/Relay VM coverage remain intact without a production hook. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: No missing assertion identified; exact-source execution still required. |
| 191 | covered | E167, E174, E207, E197, E203, E176, E179 | Covered: Actual Rule old/public/service/native imports execute in original Rule flows and adapted app/Relay VM, recursive Control route assertions cover exact bytes/MIME/CSP/security and missing literal paths, recursive syntax and current source inventory exist. Native-to-product source/type negative enforcement is a concrete separate checker defect: sourceViolations currently enforces lower direction only for L0/L1, so a browser-native L2 import of the L3 Rule public owner is not refused. Production currently has no such reverse import. No production/checker mutation was authorized in this test-only slice. Existing negative L2 native-to-L3 value/type import guards, recursive native Rule VM graph, exact source route/security assertions and distributed module graph tests cover the requirement; image publication is not an assertion obligation. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: No missing assertion identified; exact-source execution still required. |
| 192 | partial | E230, E185, E209 | Covered: Integrated commit inherits saved A5 candidate and includes classified additions; exact Actions checkout/tree and clean source status are captured outside self-referential file content. Remaining: Source closure is inherited, not acceptance; final same-source CI and remaining assertion obligations must close before a complete gate decision. |
| 193 | covered | E230, E185, E179 | Covered: Actual import/classification inventory plus public distribution/version checks and compiled current consumers cover declared graph/counter consistency within configured rules. Independent explicit tables pin all current 109 Control, 25 Agent, three contract, four browser and example public counters/aliases. Core four production files, thirteen runtime exports, seventeen public type shapes/private ipv4Bytes refusal, lower/native generic specialization, old ADP2 refusal/internal parser and direct/recursive package lock/embed/COPY/schema/SQL/support assets are tied to actual source consumers and existing configured graph checks. Remaining: No missing assertion identified; exact-source execution still required. |
| 194 | partial | E185, E167, E179, E187, E189, E208, E209 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: Source schema/Web parity does not prove image COPY/import graph, Go embed/generated declarations, lock/SQL/fs inputs, moving base image resolution or independent responder build/scan/publication. |
| 195 | covered | E198, E178, E197, E207, E210, E176, E167, E201, E202, E179 | Covered: Read-only review: root tsconfig already includes packages/apps/examples plus phase1/phase2/ops TypeScript. The existing test:web preflight recursively parses every production JS leaf, and actual public example behavior, recursive canonical app/Relay VM and Rule owner graphs retain original coverage. Current production source inventory recursively covers browser, example and operator value/type/private references with negative unclassified/private/source syntax cases; source/fixture/generated/ops/phase/manual roles are explicitly inventoried and their existing acceptance commands remain in ci.yml. The original residual text only requires running integrated checks on the saved revision, which belongs to execution status and is not a missing assertion. No duplicate checker/test is added for 195. Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: No missing assertion identified; exact-source execution still required. |
| 196 | partial | E2, E1, E89, E17, E18 | Covered: Native sync proof/Windows parser, forward uptime, protected lock/atomic replacement and native facts conversion Remaining: Clock selection/proof/error aliases now covered by13/216/217. Residual native status resource availability plus old Control observation wrapper equivalence and platformstate fsync/error behavior share18/19/15 cases. OS build execution is an execution obligation, not an assertion gap by itself. |
| 197 | covered | E185, E187 | Covered: All21 schema source roles retain existing local-definition AJV compilation and18 normalized source/embed/generated copy comparisons. Independent real-generator suite stages10 exact Go schema/declaration target pairs, executes original multihop and Go --check tools, checks every staged byte unchanged, pins each adp3 execution alias to canonical adp3execution in schema definition order, and mutates canonical declaration/alias/unembedded execution output to prove actual checker refusal. Runtime schema remains separate from execution and native Relay separate from ADP3 Relay. Actual Transit checker runs against all3 LF/CRLF pairs; each byte drift and9 independent semantic mutations prove original Runtime Transit role/driver refusal, version/kind, negotiation contract-only and executionEnabled=false, delivery Command/Ack nonexecution and received Report assertions remain. Handwritten telemetry/native fixtures are covered separately and are never inferred from generator scope. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: No missing assertion identified; exact-source execution still required. |
| 198 | covered | E185, E187, E189, E190, E211 | Covered: Independent explicit11 public-export names and22 dependency rows (21 schemas+native catalog) stage actual contracts/core package targets in the Control distributed COPY layout and import actual @tunex/contracts package specifiers. Baseline all entries load. For every asset, fresh processes test missing, malformed JSON and valid-but-invalid schema/catalog; every one of11 entries must match its independent eager dependency closure, including shared ADP2 initialization, separate Runtime/execution and Relay resources, Probe families, staged Echo->Services and native catalog. Each of4 handwritten telemetry schema documents is independently absent from runtime loader closure; deleting all native assets together still loads3 common lower entries and observability.4 separate handwritten TS parser sample/ACK fixtures are validated by actual AJV specification documents and actual native parsers; exact closed keys, all missing keys, duplicate JSON, syntax and byte limits, detached recursive freeze, timestamp/provenance/version/binding, uint64 and host/point semantic mutations retain native behavior. Shared literal4 Go wire fixtures are compared byte-for-byte against actual4 EncodeSample outputs and independently fed to TS parser+AJV acceptance. Actual4 Go CheckAck functions require original sent identity, every closed required nonnull typed field, bounded JSON/duplicate refusal, stored/provenance/noauthorization and UTC time, Forward/Probe exact page accounting and rejected receipt refusal. Native encoder tests retain host8192/Forward65536/Probe65536, point4096, page32, original binding, Probe retiring/coverage and snapshot count limits; original nil collection representation is retained. Process TS stored=false acceptance and stricter Agent ack receipt behavior are explicitly distinct. No additional release/image publication or physical-host claim is inferred. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: No missing assertion identified; exact-source execution still required. |
| 199 | covered | E188, E42, E35, E34, E212, E213 | Covered: Original: Compare catalog1 closed fields/digest/order/schema/platform/role/phase/protocol/capability/flag/gate declarations with original Direct/Relay/Multihop compiled providers, typed/generic host wrappers and platform/feature selection. New TestCatalogCompleteCompiledFieldsAndHostSelection compares catalog1 fixed three-driver order, descriptorRevision/schemaID/version, every compiled platforms/roles/phases/protocols/capabilities, exact ordered agent flags and RequiresRelay/RequiresMultihop, controlGate and required capability closure. Both native Registry and specialized generic Registry descriptors match; every role/phase/protocol x four features x Linux/Windows/unsupported/empty platforms resolve only when permitted, native wrapper matches actual runtime.GOOS. Existing contracts native-drivers.test.ts asserts immutable catalog version/digest/order/carriers/security/usage/privileges, closed parser refusal for executable/unknown/duplicate/version/invalid metadata. Existing control TestExecutionCatalogMatchesBuiltins ties original Control private descriptors to catalog. Original: Keep existing duplicate suppression, Probe opt-in/hook conditions and actual Guard/Journal/authority before execution. New TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication covers 2 platform states x4 feature combinations x8 Probe opt-in combinations x4 TCP/UDP hook combinations. Repeated providers and repeated/base-overlapping capability names deduplicate in exact order; requires ingress+hook before probe, services before TLS, ingress+services+echo+both hooks before Echo. No Start/Replace/Phase/Classify/Probe hook called, descriptors unchanged and returned lists detached. Existing Guard/Journal/authority-before-bind tests retained without duplication: control/runner_test.go, control/execution_drivers_test.go, control/transit_runner_test.go, forward/authorization_test.go and state Journal suites. Original: Catalog metadata does not install a driver, load its schema automatically, measure usage or enable live Transit/Echo. New tests assert nil compiled provider list advertises only adp.3 despite all Probe flags; uncompiled native.transit.v1 Resolve refuses; usage remains not-reported; capability projection invokes no execution or observation hooks. Existing TS test rejects catalog as Runtime Hello. Catalog/source inventory contains only fixed compiled providers: no dynamic schema loader or usage collector or capability authority introduced. Feature metadata is not physical/live execution evidence. Original: Compare catalog1 closed fields/digest/order/schema/platform/role/phase/protocol/capability/flag/gate declarations with original Direct/Relay/Multihop compiled providers, typed/generic host wrappers and platform/feature selection. New TestCatalogCompleteCompiledFieldsAndHostSelection compares catalog1 fixed three-driver order, descriptorRevision/schemaID/version, every compiled platforms/roles/phases/protocols/capabilities, exact ordered agent flags and RequiresRelay/RequiresMultihop, controlGate and required capability closure. Both native Registry and specialized generic Registry descriptors match; every role/phase/protocol x four features x Linux/Windows/unsupported/empty platforms resolve only when permitted, native wrapper matches actual runtime.GOOS. Existing contracts native-drivers.test.ts asserts immutable catalog version/digest/order/carriers/security/usage/privileges, closed parser refusal for executable/unknown/duplicate/version/invalid metadata. Existing control TestExecutionCatalogMatchesBuiltins ties original Control private descriptors to catalog. Original: Keep existing duplicate suppression, Probe opt-in/hook conditions and actual Guard/Journal/authority before execution. New TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication covers 2 platform states x4 feature combinations x8 Probe opt-in combinations x4 TCP/UDP hook combinations. Repeated providers and repeated/base-overlapping capability names deduplicate in exact order; requires ingress+hook before probe, services before TLS, ingress+services+echo+both hooks before Echo. No Start/Replace/Phase/Classify/Probe hook called, descriptors unchanged and returned lists detached. Existing Guard/Journal/authority-before-bind tests retained without duplication: control/runner_test.go, control/execution_drivers_test.go, control/transit_runner_test.go, forward/authorization_test.go and state Journal suites. Original: Catalog metadata does not install a driver, load its schema automatically, measure usage or enable live Transit/Echo. New tests assert nil compiled provider list advertises only adp.3 despite all Probe flags; uncompiled native.transit.v1 Resolve refuses; usage remains not-reported; capability projection invokes no execution or observation hooks. Existing TS test rejects catalog as Runtime Hello. Catalog/source inventory contains only fixed compiled providers: no dynamic schema loader or usage collector or capability authority introduced. Feature metadata is not physical/live execution evidence. Catalog digest/order/deep freezing, physical UDP-to-TCP carrier distinction, flags and multihop gate. Closed-field/version/new-driver/duplicate/capability/privilege refusal; catalog rejected as Runtime Hello. Actual Go provider/Guard execution is not asserted. Remaining: No missing assertion identified; exact-source execution still required. |
| 200 | covered | E180, E231, E232, E175 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. The bounded59 top-level leaf map is accepted as an assertion inventory: all53 independent exact forwarding namespaces and their aliases/types remain tested, all six original construction entry namespaces and distinct inherited canonical classes are checked. The four remaining native construction defaults now have real same-executor SQL/effect tests, complementing Forwarding/Idempotency zero-argument matrices. Original frozen policies, token/parser aliases, public/type-erased exports and the native/composition classification remain intact. This row does not claim nested Runtime/owner or consumer removal acceptance. Remaining: No missing assertion identified; exact-source execution still required. |
| 201 | partial | E180, E100, E112, E231, E232 | Covered: Legacy constructor/import consumers compile and pure identities are checked; Ledger/idempotency acceptance retains supplied Tx and stable keys/monotonic clock order. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. Identity dynamic clock is replaced between real audit writes; its pool account lookup and supplied-Tx authenticateIn use different executors. Nodes captures the original Date.now function, samples machine twice, retains120/86400, creates fresh default resources and uses supplied resource identity, and provisions credentials before original runtime initialization. Transport captures the original UUID function and resolves time dynamically in native grant SQL on the same Tx. Endpoint management/claim/native save/audit/receipt retain one request/Tx with native error identity and outer rollback. Static Transport/Nodes quarantine SQL and fail-stop order are exact. Existing Forward/Idempotency constructor matrix remains retained. Remaining: Actual lazy Recovery composition callback construction and shared Ledger/provider ordering still require whole-composition assertions; native executor tests do not replace real MySQL rollback/competition evidence. |
| 202 | covered | E180, E231, E181 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Instantiate only legacy public Forwarding()/Idempotency() with zero arguments. Assert distinct legacy subclass constructors of public canonical owner hosts and no construction Date.now sample. Strict supplied Transaction execute receiver/script refuses every other property, extra SQL or implicit pool/transaction access. This is actual native SQL/JSON adapter binding through old constructors with fake transport; not real MySQL or transaction rollback evidence. Forward read matrix covers get/currentForUpdate/record/forNode/forReferencedNode/forProfileActor/forActor exact predicates/order/args, string JSON projection versus original object identity, raw undecoded revisions, missing404/malformedJSON/SQL error identity. Forward reference selection covers Profile precedence over Node, share locks and both node arguments, empty/nonempty booleans, no-selector preSQL error, null/missing authorizer and same-owner authorizer/quarantine updates. Forward insert/replace/delete bind repeated native JSON serialization across actual SQL await; revision argument identity, CAS0/2 refusal and failed first/second write stop at original count. Cyclic JSON refuses before initial write. These do not claim DB rollback. Idempotency covers ensure/lock actual SQL and args, pending malformed body not decoded, string/object completed replay and object identity, malformedJSON, conflict, recovery-invalidated-before-conflict/decode, ensure/lock failures. Idempotency keeps original scope/actor/key snapshot across actual SQL awaits while comparing later digest; response status/native toJSON before request getters and exact write args; native encode/SQL/quarantine errors retain identity. each exact current import module/local/remote name and final canonical Symbol; Accepted exported alias preserved; old forwarding-ports, node-execution-ports and identity-ports resolve to same final symbols poison all type-only module sources with nonexistent sentinel then transpile exact same JS for named leaves/consumers/retained ports; actual idempotency/nodes/control dynamic import; five erased runtime leaves exact empty/version namespace; actual server/bootstrap/control/phase1/test legacy source paths; existing legacy-entrypoints complete53/25/96 runtime export identity and full repo typecheck retain all current forwarding consumers Remaining: No missing assertion identified; exact-source execution still required. |
| 203 | covered | E180, E233, E234, E169 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Bounded 34-leaf inventory: eight real construction/callable bindings, one retained native RelayExecutionLedger interface, all 25 value/type forwarders. Exact uninstantiated canonical alias symbols preserve native family/generic/default declarations. Original production, Recovery, phase, fixture and test imports remain. Existing legacy-entrypoints.test.ts supplies all 25 value/runtime export identity checks; independent real construction suites cover the eight bindings. Source map coverage; exact-source Actions execution pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 204 | covered | E180, E181 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. independent fixed complete names across access/authorization/execution-adapter/forward-command/node-change; exact type-only source and final declaration Symbols, including all uninstantiated generic/default contracts three runtime Policy import type sources exact contracts/policy; old shared Policy resolves same declaration; DEFAULT_POLICY remains sole named value from shared for Ledger/Relay; EXECUTION_HOST_VERSION original execution-contracts leaf identity and only runtime export; emitted JS invariant after type-source poisoning Remaining: No missing assertion identified; exact-source execution still required. |
| 205 | covered | E218, E100, E180, E97, E125, E233, E234, E124, E126 | Covered: Host/Ledger same-Tx clocks/claims/retirement/publication and source merge, native Transit coordination/ports and legacy imports are exercised. Actual RuntimeController original state/status/codecs and all nine ledger callbacks with member receivers and original Forward arguments. Real Ledger policy copy, supplied-resource short circuit, default/native resource capacity, collector/authorization/native store/compiler/captured Date.now/randomUUID. Relay original providers/one ledger/fresh policy/false multihop, native stores/compiler, captured instance vs live static recovery Date.now and exact same-Tx quarantine SQL. Real Transit held coordination/staging versus per-call delivery/negotiation service/store/machine readers; held module-time reservations, late-default capacity source binding, eight original member callbacks/currentOnly and same transaction; original native lock SQL. Existing same-source Transit MySQL/coordination/negotiation/preparation suites retain current-only authorization, offline preview refusal, protected history/no slot release. Exact-source Actions execution pending. Remaining: No missing assertion identified; exact-source execution still required. |
| 206 | partial | E180 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: All96 application pure aliases plus management aggregate are covered. Control composition/field/deferred callback sequence and command-request named wrapper are intentionally not declared identical to canonical implementations. |
| 207 | covered | E180, E181 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. all57 type export occurrences in fixed complete nineteen-leaf list must be explicit named type-only exports from specified existing owner/public; each aliases exact same final declaration Symbol, not rebuilt structural lookalike; no expanded wildcard Control local Accepted still remote ForwardAccepted; direct Policy same old shared symbol; sole DEFAULT_POLICY import remains shared; Idempotency remains same value import/name; runtime emit byte-identical under changed erased source; existing legacy-entrypoints full explicit value/version/forwarding identity retained Remaining: No missing assertion identified; exact-source execution still required. |
| 208 | partial | E218, E100, E97, E113, E109, E105 | Covered: Direct hosts and original command/effect ports verify shared Tx and ordered callbacks; native composition and feature scopes are exercised by MySQL/browser scenarios. Remaining: Complete original Control initializer/deferred callback/getter/options group, restoration and every rejection rollback sequence still need construction-level traces. |
| 209 | partial | E230, E174, E180 | Covered: Actual classified source/type/private/native graph plus negative import mutations and canonical/legacy entrypoint loading are checked. Remaining: Those checks do not replace behavioral acceptance for all product owners or certify undeclared external/reflection consumers. |
| 210 | partial | E218, E100, E225, E222, E216, E113 | Covered: Raw/status host separation, task drain/backoff/allSettled, one supplied transaction, resources/ledger and ordered original recovery owners are directly asserted. Remaining: Full server preflight/partial-start/native dependency-close, all class prototype/override/static/lazy and real SQL fault sequences remain bounded. |
| 211 | partial | E145, E151, E146, E147 | Covered: Sender accepts common CancellationSignal without EventTarget members, preserves original reason and exact once callback identity/removal when cancellation races registration; no DNS starts. Native abort while DNS/guard outstanding returns rejected early but capacity/close remain held until actual callback settles, including late guard rejection. HTTPS request errors classified unknown rather than rejected, without retry. Native AbortSignal object/reason identity crosses both lower public ports and sender rejects pre-aborted attempts before dispatch. Minimal common provider without EventTarget extras is accepted for pre-admission refusal. Common signal adapter asserts exact callback identity and once option then removes it after normal/interrupted reads. Cancellation while query blocks destroys transport without dirty release/rollback; pool acquisition after abort destroys the acquired connection; failed rollback destroys instead of releasing. Remaining: Observation pool cancellation is covered separately. Full response/socket cancellation, listener-removal exceptions, all native-API assignability and actual FileNotificationSecrets close/pin ownership remain outside these tests. |
| 212 | partial | E185, E167, E179, E187, E189, E181, E176 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: Source resource/entry/Web route tests are narrow; complete assets consumer closure including native generated/handwritten/embed roles, fixtures/locks/SQL/COPY/deletions and actual distribution fault semantics remain. |
| 213 | covered | E198, E167, E200, E174, E194, E197, E207, E204, E176, E202, E201, E195, E203, E199 | Covered: Existing canonical public request/model, recursive VM owner flows, recursive production syntax/routes/consumer/graph assertions and native main callback closure cover this consolidation row; independent real-browser layout is not an added obligation. Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: No missing assertion identified; exact-source execution still required. |
| 214 | partial | E178, E177, E214, E215, E216, E192, E179, E181, E208, E209 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Known migration catalog asserts 37 files through0037 and partial-table/migration history refusal, schema reader ceilings and downgrade gates. Source assertions follow real CLI/public command/native inspector paths, require consistent snapshot READ ONLY/rollback/final end and keep separate MySQL Actions command. Injected assessment dispatch forbids Authority construction/mutations, checks exact args and decision exit0/2/1; inspection error suppresses credential text and returns bounded public refusal report. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Known migration catalog asserts 37 files through0037 and partial-table/migration history refusal, schema reader ceilings and downgrade gates. Source assertions follow real CLI/public command/native inspector paths, require consistent snapshot READ ONLY/rollback/final end and keep separate MySQL Actions command. Injected assessment dispatch forbids Authority construction/mutations, checks exact args and decision exit0/2/1; inspection error suppresses credential text and returns bounded public refusal report. Remaining: Example preview/bootstrap/assessment evidence is mapped; actual backup/restore native process/atomicity, all phase/manual/container consumers, independent Responder and live Echo remain separate requirements. |
| 215 | partial | E34, E35, E25, E14, E48, E26, E46, E36, E37, E40, E38, E39, E80, E82 | Covered: This owner closes alias/default/zero/nil/private fixture, fixed HostVersion1 vocabulary, runtime.GOOS and representative metadata/actual platform/feature refusal clauses. Named-source crossmap below joins existing per-owner assertions; it deliberately does not invent another all-leaf suite. Whole215 cannot be called covered while other named bootstrap/channel/observation/identity/CLI/codec owner clauses remain partial. Remaining: Complete the remaining actual leaf-owner assertion groups already listed in Agent49 strict audit (bootstrap/channel/identity/observation/native wire+CLI/Transit); this cross-item inventory is not satisfied by only constructor/Registry tests. Do not add a second closure test suite or count pending Actions/physical gates as missing assertions. |
| 216 | covered | E89, E3, E2, E90, E91, E92 | Covered: Exact original requirement: For FR-0023 accept executiontime2 tagless parsed facts and platformclock2 SyncStatus/SynchronizationFacts, old authorization native aliases and exact proof JSON field/order/MAC/provider errors. Direct lower native literals or serializers must migrate explicitly; no native tag/parser fallback in L1. Both interface versions2, canonical native/lower named owner identity, every lower field/order/type/no-tag and every native field/order/type/tag explicitly asserted Old Sample/Clock/SyncStatus/ProofOptions exact reflect identity; public native proof/synchronization function signatures compile checked Lower direct JSON literal golden intentionally differs from native serialization; invalid native timestamp produces invalid facts rather than adapter rejection Proof literal payload and full envelope byte equality with independently computed SHA256 HMAC; native read roundtrip; zero/31/33-byte write keys refuse before existing proof changes; missing/short read keys exact errors Missing proof native os.PathError and ErrNotExist survive ReadProof and proof-selected SynchronizedClock wrapped provider error; configured proof selection proven by exact missing path Existing tests retain native SyncStatus exact golden JSON, valid/invalid projection, Windows text parser refusal, proof forged MAC/unknown fields/stale evidence and host/platform refusal Current explicit adaptation source is inspected; no hypothetical external literal/serializer consumer treated as a current gap. Root current-source compiler/boundary inventory remains execution evidence. Remaining: No missing assertion identified; exact-source execution still required. |
| 217 | covered | E3, E4, E89, E93, E8 | Covered: FR0023 parse-at-Evidence frequency: native text change is not reparsed before2s,exact refresh reparses invalid fact,uptime rollback reparses again,failed refresh error precedes second sample and does not commit cache timestamp,retry reparses. Both Linux/Windows native fact forms with invalid timestamp plus wrong host/source assert Sample->Evidence/parse->Sample->Host->Source->validation first-error order. Actual authenticated proof invalid timestamp with wrong host/source repeats the same old native wrapper precedence. Existing before/evidence/after error identity traces,blocked second sample,cache boundaries,30s future/stale/error500ppm edges and custom opaque lower fact sources retained; native parser returns invalid facts without early returned error. Actual current GOOS native provider choice: Linux source/host/native status query;Windows deliberately missing w32tm under test-only SystemRoot proves OS default error path; valid explicit proof then succeeds despite unavailable OS executable,missing proof never falls back. Unsupported platform branch checks exact native provider and suspend-aware sample refusal. Tests must execute on the corresponding OS Actions jobs; no same-host claim substitutes for physical gate. Remaining: No missing assertion identified; exact-source execution still required. |
| 218 | covered | E24, E94 | Covered: TestCredentialRecordCompleteLayoutAndEightProjections: both InterfaceVersion=2; native/lower owner PkgPath and distinct type identity; all four shapes and eight projections, per-field zero/nonzero inputs in both directions TestCredentialRecordCompleteLayoutAndEightProjections: independent pre-extraction layouts compare field count/name/order/type/tag; private aliases retain native identity; each field native serialization compared byte-for-byte to legacy layout; pointer identity in both projection directions, nil preservation TestRelayRecordOptionalFieldsAreIndependent: four independent omitempty combinations TestNativeCredentialRecordsKeepEncodingAndFacts: literal golden native JSON for all four records; nonnil and nil overlap JSON; full optional record JSON TestNativeProviderPersistsCredentialFactsUsingNativeRecords: SaveMachine literal bytes and protected SaveRelay snapshot bytes equal canonical native JSON TestCredentialRecordCompleteLayoutAndEightProjections: all four lower record fields have empty tags; all lower direct zero/per-field JSON encodings differ from native encoding; canonical native and lower PkgPath names and distinct named types pinned TestNativeCredentialRecordsKeepEncodingAndFacts: lower CredentialBundle JSON does not contain native lowercase properties Remaining: No missing assertion identified; exact-source execution still required. |
| 219 | partial | E24, E22, E23, E31 | Covered: Machine corruption no fallback, protected initial missing vs MAC/malformed, stable request CSR/key replay, expired protected online-only replay recovery, native request excludes key Remaining: Machine permissive unknown-field JSON versus protected strict unknown/duplicate/outer-inner/MAC representative contrast; not every malformed-field permutation. Provider fake-port SaveMachine -> reload -> Remove and Relay Save -> Remove -> publish failure cases, initial not-exist versus second read/MAC/store error; existing CSR/key replay, overlap, effective expiry and expired committed replay tests already cover those behaviors. |
| 220 | partial | E209, E208, E178, E230 | Covered: Save complete candidate then run all applicable exact-source Actions, retain per-item covered/partial/gap and independent physical/long-run/release gates; public example and complete compiled consumers are included. Remaining: Full B acceptance remains closed while any listed requirement lacks complete assertions or applicable exact-source execution. |

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

### E26: agent/internal/control/transit_runner_test.go

[Source](../../agent/internal/control/transit_runner_test.go)

- TestTransitRunnerOfflinePersistBeforeEngineAndNoReplay
- TestTransitRunnerBridgeRejectsUnnegotiatedLeaseAndLegacyPhysicalPort

### E27: agent/internal/agentcommand/command_run_lifecycle_test.go

[Source](../../agent/internal/agentcommand/command_run_lifecycle_test.go)

- TestCommandRunReleaseAndConstructionBeforeSignals
- TestInspectionAllowsRelayAndPairedTimeProof

### E28: agent/internal/control/probe_claim_test.go

[Source](../../agent/internal/control/probe_claim_test.go)

- TestProbeClaimReceiptChecksHostBindingWithoutExecutionOrJournalMutation
- TestProbeClaimRejectsEveryForeignBindingAndBurnsFailedClaims
- TestProbeClaimRechecksLocalAuthorityAfterRemoteWork
- TestProbeClaimUncertainHTTPOutcomesRemainBurnedWithoutRedirectOrRetry
- TestProbeClaimConcurrentBurnCapacityAndPreflight

### E29: agent/internal/control/probe_delivery_test.go

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

### E30: agent/internal/control/probe_workflow_test.go

[Source](../../agent/internal/control/probe_workflow_test.go)

- TestProbeWorkflowRequiresSeparateExplicitOptIns
- TestProbeWorkflowPollClaimWatchConnectAndReportOnce
- TestProbeWorkflowUncertainClaimNeverExecutesOrReclaims
- TestProbeWorkflowInitialWithdrawalPreventsAllSocketWork
- TestProbeWorkflowReportAttemptBurnsBeforeLostOrInvalidAcknowledgement
- TestProbeWorkflowCancellationDrainsReportAndWatchBeforeReturning

### E31: agent/internal/nativeexecution/probe_wire_boundaries_test.go

[Source](../../agent/internal/nativeexecution/probe_wire_boundaries_test.go)

- TestProbeBoundedBodyAndReaderError
- TestProbeEntropyKeepsOne32ByteReadAndShortCount
- TestNativeWireTimesAndRelayScheduleFirstError
- TestCredentialRotationNeverEncodesPrivateKey

### E32: agent/internal/control/diagnostics_test.go

[Source](../../agent/internal/control/diagnostics_test.go)

- TestDiagnosticsIsAggregateLocalDataAndDoesNotReplaceAuthority

### E33: agent/internal/control/probe_execution_test.go

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

### E34: agent/internal/control/execution_drivers_test.go

[Source](../../agent/internal/control/execution_drivers_test.go)

- TestExecutionRegistryDeclarations
- TestExecutionRegistrySelection
- TestExecutionRegistryCapabilities
- TestExecutionDriverFactoryBoundaries
- TestExecutionDriverReplacementBoundary
- TestExecutionDriverAuthorizationContract
- TestExecutionDriverErrorAndPolicyContract

### E35: agent/internal/control/execution_catalog_test.go

[Source](../../agent/internal/control/execution_catalog_test.go)

- TestExecutionCatalogMatchesBuiltins

### E36: agent/internal/forward/tcp_lifecycle_test.go

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

### E37: agent/internal/forward/udp_test.go

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

### E38: agent/internal/executionhost/registry_complete_test.go

[Source](../../agent/internal/executionhost/registry_complete_test.go)

- TestExecutionHostCompletePublicBindingsFieldsAndZeroRegistry
- TestExecutionHostCompleteBoundedDeclarationsFirstErrorsAndDetachedSlices

### E39: agent/internal/executiondriver/registry_complete_test.go

[Source](../../agent/internal/executiondriver/registry_complete_test.go)

- TestExecutionDriverCompletePublicNativeAliasesAndZeroBinding

### E40: agent/internal/control/execution_registry_complete_test.go

[Source](../../agent/internal/control/execution_registry_complete_test.go)

- TestControlCompleteLegacyRegistryFirstRefusalBeforePublicValidation
- TestControlCompletePrivatePublicDriverRoundtripCallbacksAndCopies

### E41: agent/internal/nativeexecution/phase_cleanup_complete_test.go

[Source](../../agent/internal/nativeexecution/phase_cleanup_complete_test.go)

- TestNativeExecutionCompleteRelayPhasePartialStartCleanupAndPointerIdentity

### E42: agent/internal/nativeexecution/catalog_complete_test.go

[Source](../../agent/internal/nativeexecution/catalog_complete_test.go)

- TestCatalogCompleteCompiledFieldsAndHostSelection
- TestCatalogCompleteCapabilitiesFlagsHooksPlatformAndDeduplication

### E43: agent/internal/executionenrollment/enrollment_failure_order_test.go

[Source](../../agent/internal/executionenrollment/enrollment_failure_order_test.go)

- TestEnrollmentEveryFailurePreservesOrderAndCleanup

### E44: agent/internal/agentcommand/inspection_test.go

[Source](../../agent/internal/agentcommand/inspection_test.go)

- TestInspectionReturnsWithoutEnrollmentLockOrRunner
- TestInspectionRejectsEveryStateChangingFlagBeforeEffects

### E45: agent/internal/control/native_direct_probe_test.go

[Source](../../agent/internal/control/native_direct_probe_test.go)

- TestProbeHostReadsCurrentPhysicalBindingWithoutMutation
- TestProbeHostRejectsForeignStaleInactiveAndTamperedBindings
- TestProbeHostExecutionExpiryCannotBeReplacedByProbePermit

### E46: agent/internal/probe/probe_test.go

[Source](../../agent/internal/probe/probe_test.go)

- TestProbeConnectOnlyAndProvenance
- TestProbeRejectsInvalidRequestsBeforeResolution
- TestProbeRejectsDNSMetadataAndForeignBindingsWithoutDial
- TestProbeSingleAttemptAndSanitizedFailure
- TestProbeCancellationDeadlineAndRevocation
- TestProbePostConnectRevocationClosesConnection
- TestProbeBoundedAdmissionAndCooldown

### E47: agent/internal/probe/gate_test.go

[Source](../../agent/internal/probe/gate_test.go)

- TestProbeGateConsumesBeforeAttemptAndDoesNotResetOnFailure
- TestProbeGateRejectsForeignInstancesAndRequiresIndependentAuthority
- TestProbeGateConcurrentDuplicateHasOnlyOneAttempt
- TestProbeGateCloseCancelsInflightAndDeniesFurtherWork
- TestProbeGateCapacityNeverEvictsConsumedIDs

### E48: agent/internal/control/relay_runner_test.go

[Source](../../agent/internal/control/relay_runner_test.go)

- TestRelayRunnerPersistsBeforePrepareAndActivatesAfterRealPeerProbe

### E49: agent/internal/nativeexecution/probe_echo_endpoint_test.go

[Source](../../agent/internal/nativeexecution/probe_echo_endpoint_test.go)

- TestEchoIngressEndpointKeepsNumericProtocolAndPolicyBounds

### E50: agent/internal/control/probe_counter_clock_test.go

[Source](../../agent/internal/control/probe_counter_clock_test.go)

- TestProbeCounterPointSamplesEveryPointAndPreservesTerminalOffset
- TestEchoContextDecodeRefusalStillSamplesOwnerClock
- TestForwardCounterEmbeddingKeepsPromotedNativeFields

### E51: agent/internal/proberesult/contract_test.go

[Source](../../agent/internal/proberesult/contract_test.go)

- TestProbeResultSharedVectors
- TestProbeResultDigestAndTypedEcho

### E52: agent/internal/control/probe_negotiation_test.go

[Source](../../agent/internal/control/probe_negotiation_test.go)

- TestProbeClientNegotiationDoesNotAuthorizeExecution
- TestProbeClientRejectsUnboundActiveOversizedOrSupersededAcknowledgements

### E53: agent/internal/control/probe_registration_test.go

[Source](../../agent/internal/control/probe_registration_test.go)

- TestProbeRegistrationOwnsRotatesAndRevokesCurrentGate
- TestProbeRegistrationRejectsUnsafeOrSupersededAcknowledgements
- TestProbeRegistrationStopCannotBeUndoneByLateAcknowledgement
- TestProbeRegistrationMonitorClosesOnContextIdentityAndGuardLoss
- TestProbeRegistrationMonotonicFreshnessDeadlineClosesGate
- TestProbeRegistrationSupervisorClosesAndRevokesOnShutdown
- TestProbeRegistrationRecoversOwnerAfterRejectedAcknowledgement

### E54: agent/internal/probe/native/echo_format_test.go

[Source](../../agent/internal/probe/native/echo_format_test.go)

- TestEchoExecutionEqualityDistinguishesNilEmptyAndDetachedProtocols
- TestEchoContextRoundtripAndBothTimeParsesKeepFailureStages

### E55: agent/internal/state/runtime_facts_test.go

[Source](../../agent/internal/state/runtime_facts_test.go)

- TestRuntimeFactsPreserveRawStorageAndReferences
- TestRuntimeNativeFieldOrderAndRawJSONSemantics

### E56: agent/internal/state/journal_test.go

[Source](../../agent/internal/state/journal_test.go)

- TestJournalIntegrityAndPersistence

### E57: agent/internal/transit/engine_test.go

[Source](../../agent/internal/transit/engine_test.go)

- TestThreeNodeTLSBoundTransitTCPHalfClose
- TestThreeNodeTLSBoundTransitUDPAssociationAndEmptyDatagram
- TestPreparedTransitRefusesMissingAuthorization
- TestTransitRejectsSpoofedOpenAndRevokedGrant

### E58: agent/internal/relay/tls_test.go

[Source](../../agent/internal/relay/tls_test.go)

- TestMutualTLSExactNodeIdentityAndNoDowngrade
- TestMutualTLSRefusesForeignNodeTrustPurposeExpiryAndPin

### E59: agent/internal/platformobservation/host_contract_test.go

[Source](../../agent/internal/platformobservation/host_contract_test.go)

- TestHostNativeAliasAndLowerFactsHaveDistinctSerialization

### E60: agent/internal/relay/engine_test.go

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

### E61: agent/internal/relay/multihop_test.go

[Source](../../agent/internal/relay/multihop_test.go)

- TestMultihopTCPConsecutiveTransitHalfCloseRenewalAndCutoff
- TestMultihopUDPClientIsolationAndIntermediateFailure
- TestMultihopUDPRequestActivityPreservesAssociationBeforeDelayedReply

### E62: agent/internal/relay/wire_test.go

[Source](../../agent/internal/relay/wire_test.go)

- TestReplyKeepsPreparedFailureRetryableAndBindsAcceptance
- TestOpenAndFrameBoundsAndPreparedGate

### E63: agent/internal/relay/native_configuration_complete_test.go

[Source](../../agent/internal/relay/native_configuration_complete_test.go)

- TestMultihopCompleteImmutableNativeProjectionAllRolesAndProtocols
- TestMultihopCompleteValidationLeafFingerprintAndPrepareOrder
- TestRelayCompletePublicEgressPolicyEqualsOriginalAllowedDetour

### E64: agent/internal/relay/native_effects_complete_test.go

[Source](../../agent/internal/relay/native_effects_complete_test.go)

- TestRelayCompleteSharedUDPFailureReleasesTCPAndNodeAdmission
- TestRelayCompleteReadBeforeAfterAndWriteBeforeAuthority
- TestRelayCompleteDNSPolicyCallbackAndPostDialPartialClose
- TestRelayCompletePayloadWriterCountsSuccessfulPrefixOnly

### E65: agent/internal/relay/wire_complete_test.go

[Source](../../agent/internal/relay/wire_complete_test.go)

- TestRelayCompleteControlFramePartialIOAndValidationBeforeWrites
- TestRelayCompleteOpenValidationAuthorizationAndBindingFirstErrors
- TestRelayCompleteFramedBufferedFINAndAuthorityRefusalOrder

### E66: agent/internal/relay/tls_complete_test.go

[Source](../../agent/internal/relay/tls_complete_test.go)

- TestRelayCompleteTLSProtocolPinAndRootOwnership

### E67: agent/internal/payloadstats/counters_complete_test.go

[Source](../../agent/internal/payloadstats/counters_complete_test.go)

- TestPayloadStatsCompleteEntropyErrorShortAndPartialStreams
- TestPayloadStatsCompleteEpochSnapshotNilAndSuccessfulPayload
- TestPayloadStatsCompleteAtomicSaturationAndConcurrentSnapshots

### E68: agent/internal/relay/payload_read_complete_test.go

[Source](../../agent/internal/relay/payload_read_complete_test.go)

- TestRelayCompleteTCPIngressPayloadReadExcludesCarrierAndEgress
- TestRelayCompleteUDPIngressEmptyDatagramsAndPayloadRead

### E69: agent/internal/control/payload_counters_complete_test.go

[Source](../../agent/internal/control/payload_counters_complete_test.go)

- TestControlCompleteNativePayloadSnapshotConsumerAndTerminalCopy

### E70: agent/internal/adp3/validate_test.go

[Source](../../agent/internal/adp3/validate_test.go)

- TestSharedRuntimeFixture

### E71: agent/internal/adp3/multihop_test.go

[Source](../../agent/internal/adp3/multihop_test.go)

- TestMultihopSharedExecutionConformance

### E72: agent/internal/adp3relay/validate_test.go

[Source](../../agent/internal/adp3relay/validate_test.go)

- TestSharedFixture

### E73: agent/internal/adp3transit/validate_test.go

[Source](../../agent/internal/adp3transit/validate_test.go)

- TestOfflineTransitADP3Envelope
- TestTransitADP3RejectsVersionAndBindingDrift
- TestTransitADP3RejectsStaleAndConflictingSnapshots

### E74: agent/internal/contracts/validate_test.go

[Source](../../agent/internal/contracts/validate_test.go)

- TestAuthoritativeFixture
- TestSharedConformance
- TestRFC8785Vectors
- TestBoundedJSON
- TestPreciseTimes

### E75: agent/internal/transitcontracts/validate_test.go

[Source](../../agent/internal/transitcontracts/validate_test.go)

- TestSharedTransitVectors
- TestTransitEmbeddedSchemaMatchesRepositoryContract
- TestLegacyRelayAgentParserDeniesNewTransitRole

### E76: agent/internal/probeclaim/validate_test.go

[Source](../../agent/internal/probeclaim/validate_test.go)

- TestProbeClaimSharedVectorsAndTypedEcho

### E77: agent/internal/probeinstance/validate_test.go

[Source](../../agent/internal/probeinstance/validate_test.go)

- TestProbeInstanceSharedVectors
- TestProbeInstanceEchoAndTypedBypass

### E78: agent/internal/probedelivery/contract_test.go

[Source](../../agent/internal/probedelivery/contract_test.go)

- TestProbeDeliverySharedVectors
- TestProbeDeliveryTypedEcho

### E79: agent/internal/probenegotiation/validate_test.go

[Source](../../agent/internal/probenegotiation/validate_test.go)

- TestProbeNegotiationSharedVectors
- TestProbeNegotiationEchoAndTypedBypass

### E80: agent/internal/agentplatform/native_complete_test.go

[Source](../../agent/internal/agentplatform/native_complete_test.go)

- TestAgentPlatformCompleteCanonicalFieldsAndNativeDefaults
- TestAgentPlatformCompleteDefaultsCannotSampleTimeIOOrEntropy

### E81: agent/internal/control/platform_defaults_complete_test.go

[Source](../../agent/internal/control/platform_defaults_complete_test.go)

- TestControlCompletePlatformAliasesDefaultsAndPartialFixtureFallbacks
- TestControlCompleteConstructorsRetainNativeDefaultsAndNoSampling

### E82: agent/internal/control/probe_factory_complete_test.go

[Source](../../agent/internal/control/probe_factory_complete_test.go)

- TestControlCompleteNativeProbeFactoryPriorityAndBoundResolvers
- TestControlCompleteGuardRefusesBeforeNativeProbeGateEntropy

### E83: agent/internal/probe/constructors_complete_test.go

[Source](../../agent/internal/probe/constructors_complete_test.go)

- TestProbeCompleteFourConstructorsExplicitEffectsAndResolverHierarchy
- TestProbeCompleteLegacyFactoryAllocationAndNilPrerequisiteSourceBoundary

### E84: agent/internal/probe/native/defaults_complete_test.go

[Source](../../agent/internal/probe/native/defaults_complete_test.go)

- TestProbeNativeCompleteFreshZeroDialerAndNativeEffects

### E85: agent/internal/control/probe_counters_complete_test.go

[Source](../../agent/internal/control/probe_counters_complete_test.go)

- TestProbeCounterCompleteRunnerAssemblyAndFallbackClocks
- TestProbeCounterCompletePageSortCursorSnapshotLimitsAndRetention
- TestProbeCounterCompleteLiveReaderCloseAndFrozenTailCallsites
- TestProbeCounterCompleteRetiringReadersBoundDedupFreezeAndSession

### E86: agent/internal/probe/counters_complete_test.go

[Source](../../agent/internal/probe/counters_complete_test.go)

- TestCounterCompleteEpochBoundsDetachedAndConcurrentCounts
- TestCounterCompleteSealRaceLossSaturationAndExecutorClock
- TestCounterCompleteOutcomeBranchesAndCountCorruption

### E87: agent/internal/control/platform.go

[Source](../../agent/internal/control/platform.go)

See the source scenario assertions or configured command steps.

### E88: agent/internal/control/runner.go

[Source](../../agent/internal/control/runner.go)

See the source scenario assertions or configured command steps.

### E89: agent/internal/platformclock/synchronization_values_test.go

[Source](../../agent/internal/platformclock/synchronization_values_test.go)

- TestNativeSynchronizationStatusEncodingAndFacts
- TestSynchronizationProjectionKeepsInvalidFactsForDecision

### E90: agent/internal/authorization/synchronization_complete_test.go

[Source](../../agent/internal/authorization/synchronization_complete_test.go)

- TestSynchronizationCompleteNativeAliasesAndTaglessFacts
- TestSynchronizationCompleteProofBytesMACAndProviderErrors

### E91: agent/internal/authorization/synchronization.go

[Source](../../agent/internal/authorization/synchronization.go)

See the source scenario assertions or configured command steps.

### E92: agent/internal/executiontime/clock.go

[Source](../../agent/internal/executiontime/clock.go)

See the source scenario assertions or configured command steps.

### E93: agent/internal/platformclock/synchronization_complete_test.go

[Source](../../agent/internal/platformclock/synchronization_complete_test.go)

- TestSynchronizationCompleteNativeFactsCompetingFailures
- TestSynchronizationCompleteParseCacheAndSampleFailures

### E94: agent/internal/agentidentity/records_complete_test.go

[Source](../../agent/internal/agentidentity/records_complete_test.go)

- TestCredentialRecordCompleteLayoutAndEightProjections
- TestRelayRecordOptionalFieldsAreIndependent

### E95: apps/control/test/multihop-runtime.test.ts

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

### E96: scripts/phase2/relay-scenarios.ts

[Source](../../scripts/phase2/relay-scenarios.ts)

See the source scenario assertions or configured command steps.

### E97: apps/control/test/snapshot-assignment-ports.test.ts

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

### E98: scripts/phase2/runtime-intent-lock.ts

[Source](../../scripts/phase2/runtime-intent-lock.ts)

See the source scenario assertions or configured command steps.

### E99: scripts/phase2/access.ts

[Source](../../scripts/phase2/access.ts)

See the source scenario assertions or configured command steps.

### E100: apps/control/test/runtime-ledger-ports.test.ts

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

### E101: apps/control/test/relay-plan.test.ts

[Source](../../apps/control/test/relay-plan.test.ts)

- Control Relay plan binds both sessions and physical reservations in strict prepared assignments
- Relay plan is order stable and never mutates owner facts or reserved slots
- Relay compiler rejects missing, foreign, mixed-generation and unfenced reservations
- Relay compiler refuses expired or duplicated peer facts and bounds both Node credentials
- Relay pin refresh detects either endpoint change without mutating immutable intent or plan

### E102: apps/control/test/relay-planner.test.ts

[Source](../../apps/control/test/relay-planner.test.ts)

- relay resource plan distinguishes public UDP from independent internal TLS TCP socket
- relay plan refuses missing exact capability, wrong Profile revision and TLS resource conflict
- relay plan applies final target policy at egress and peer endpoint policy at ingress
- Relay reachable endpoints reject wildcard/multicast/mapped wildcard and duplicate internal ports
- current Relay resource allocator fails closed on a proposed Transit hop

### E103: apps/control/test/multihop-plan.test.ts

[Source](../../apps/control/test/multihop-plan.test.ts)

- ${count}-Node execution binds every role, session and physical Fence
- multi-hop compiler refuses absent capabilities, policy, exact ownership and peer authority

### E104: scripts/phase2/relay-capacity.ts

[Source](../../scripts/phase2/relay-capacity.ts)

See the source scenario assertions or configured command steps.

### E105: apps/control/test/node-management-ports.test.ts

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

### E106: scripts/phase2/security.ts

[Source](../../scripts/phase2/security.ts)

See the source scenario assertions or configured command steps.

### E107: scripts/phase2/transport.ts

[Source](../../scripts/phase2/transport.ts)

See the source scenario assertions or configured command steps.

### E108: apps/control/test/identity-input.test.ts

[Source](../../apps/control/test/identity-input.test.ts)

- opaque bearer token input rejects trailing whitespace, Unicode and malformed lengths

### E109: apps/control/test/access-command-ports.test.ts

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

### E110: scripts/phase2/recovery.ts

[Source](../../scripts/phase2/recovery.ts)

See the source scenario assertions or configured command steps.

### E111: apps/control/test/transport-grant-ports.test.ts

[Source](../../apps/control/test/transport-grant-ports.test.ts)

- Profile revoke uses one owner-authorized transaction and never transitions or allocates
- Profile restore rechecks subject authority and capacity, but disabled intents never transition
- Profile replay is owner-gated before returning the same operation IDs without repeating effects
- Profile no-op, stale CAS and empty references do not invent deployment work
- Profile port failures roll back grant, audit, operations and replay response together
- Profile integration rejects cross-scope owner references and missing effect wiring
- non-HTTP Profile grant callers cannot bypass identifier, revision, boolean or key validation

### E112: apps/control/test/intent-store-ordering.test.ts

[Source](../../apps/control/test/intent-store-ordering.test.ts)

- idempotency snapshots keys before ensure but compares the live digest after the row lock
- recovery-invalidated idempotency refuses before digest conflict or stored response decoding
- pending idempotency never decodes response and completed replay preserves body identity and decoder failure
- idempotency response samples status and encodes body before reading request keys
- Forward insert encodes again after the current-row await rather than caching mutable spec bytes
- Forward replacement encodes after CAS await and refuses zero or multiple affected rows before history
- Forward storage failure preserves identity and prevents the subsequent immutable revision write

### E113: apps/control/test/forward-command-ports.test.ts

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

### E114: apps/control/test/rule-commands-api.test.ts

[Source](../../apps/control/test/rule-commands-api.test.ts)

- Operation detail exposes the scoped Forward identity for explicit retry without skipping same-transaction authorization
- explicit retry delegates the original actor/scope/key and rejects extra or duplicate intent fields

### E115: apps/control/test/forward-probes-api.test.ts

[Source](../../apps/control/test/forward-probes-api.test.ts)

- Probe management routes delegate verified actor, scope, strict JSON and idempotency key
- Probe management routes reject cookies, missing authentication, oversized/duplicate JSON and query injection before delegation

### E116: apps/control/test/application-query-ports.test.ts

[Source](../../apps/control/test/application-query-ports.test.ts)

- query ports preserve one authorized transaction without a concrete Control or SQL connection
- denied query authorization prevents every projection and propagates transaction failure
- non-HTTP query callers cannot bypass pagination, filter or identifier validation
- query inputs are detached before asynchronous authorization and adapter failures are not swallowed

### E117: apps/control/test/console-read.test.ts

[Source](../../apps/control/test/console-read.test.ts)

- console pagination is bounded and rejects malformed integers
- read models enforce scope before running any page SQL
- page queries are scope bound, return no enrollment secret and separate operation status
- all three scoped lists use bounded second-page literal offsets
- console filter contracts reject duplicate, unknown, unbounded and injection inputs
- filters are bound identically into count and page SQL; prefix underscore stays literal
- candidate and overview authorization precedes data SQL, including manager requirement
- overview counts are scoped, single-statement and independent of any page or filter

### E118: apps/control/test/console-diagnostics.test.ts

[Source](../../apps/control/test/console-diagnostics.test.ts)

- Node diagnostics authorizes scope before querying any Node state
- Node diagnostics is read-only, scoped, sanitized and never claims probe health
- Node diagnostics returns 404 for out-of-scope or missing Node

### E119: apps/control/test/console-mysql-acceptance.test.ts

[Source](../../apps/control/test/console-mysql-acceptance.test.ts)

- console queries preserve bounded pages, independent candidates, full-scope totals and read-only authorization

### E120: apps/control/test/transport-query-ports.test.ts

[Source](../../apps/control/test/transport-query-ports.test.ts)

- native catalog needs current scope access and separates process gates from Node proof or authorization
- reference listing is authorized first in the same transaction and does not require an execution grant
- impact preview requires manager and exact Profile revision grant but never mutates the source or authorizes deployment
- scope denial and invisible Profiles stop before projection/resolution
- query parameters are closed, bounded and canonical before any transaction
- owned query survives caller mutation across authorization and stale pages never widen the revision filter
- malformed persisted reference fails closed instead of suggesting an update to another Profile

### E121: apps/control/test/transport-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/transport-query-mysql-acceptance.test.ts)

- native catalog and Profile references/impact use real prepared MySQL, scoped SELECT-only access and exact target grants

### E122: apps/control/test/tunnel-query-ports.test.ts

[Source](../../apps/control/test/tunnel-query-ports.test.ts)

- tunnel metadata authorizes inside one transaction, bounds peer windows, and never claims execution or network health
- revoked or expired Node/peer windows stay closed, and an absent Endpoint is metadata rather than fabricated readiness
- desired-rule references include disabled and recovery-suspended intent and derive exact ordered adjacency for all native roles
- scope denial and a missing scoped Node stop before any endpoint, peer or reference disclosure
- reference input is closed/canonical/bounded and detached before authorization awaits
- corrupt Node, Endpoint and credential metadata fail closed rather than emit partial authorization claims
- invalid, duplicate or unrelated desired references are rejected and do not become neighboring execution facts

### E123: apps/control/test/tunnel-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/tunnel-query-mysql-acceptance.test.ts)

- tunnel API uses real prepared SELECT-only MySQL: bounded windows, scoped exact adjacency, pagination and no persisted mutations

### E124: apps/control/test/transit-negotiation.test.ts

[Source](../../apps/control/test/transit-negotiation.test.ts)

- real MySQL TLS-bound Transit handshake rejects retired boot, credential revocation and capability spoofing
- transit negotiation HTTP path refuses client without a verified TLS machine certificate
- Transit preview poll and delivery report deny unauthenticated clients

### E125: apps/control/test/transit-coordination.test.ts

[Source](../../apps/control/test/transit-coordination.test.ts)

- offline Transit coordination plan remains downstream-first, ingress-first on withdrawal
- offline coordination database enforces ownership, receipt CAS, recovery and never releases ports
- offline rollout SQL creates only an isolated coordination journal

### E126: apps/control/test/transit-preparation.test.ts

[Source](../../apps/control/test/transit-preparation.test.ts)

- Transit v1 preparation binds 3 Nodes, both protocols, sessions, pins, fences and tail-first activation
- Multi-hop plan is deterministic across resource/facts order and does not mutate inputs
- Transit preparation refuses missing, foreign, mixed-generation, colliding and unfenced slots
- Transit preparation rejects expired credentials, wrong peer, unadvertised versions, scope mismatch and bad adjacent target
- Multi-hop logical planning still refuses one- and two-Node current paths
- transactional reserve primitive rejects malformed logical sets before touching MySQL

### E127: scripts/phase2/relay.ts

[Source](../../scripts/phase2/relay.ts)

See the source scenario assertions or configured command steps.

### E128: apps/control/test/path-template-ports.test.ts

[Source](../../apps/control/test/path-template-ports.test.ts)

- native template parser is closed, bounded, ordered and detached, with computed native requirements
- publication uses one authorization/owner transaction and preserves immutable versions, deduplication and audit
- scope denial precedes idempotency, reads and owner side effects; stale CAS and keys cannot mutate metadata
- archival is terminal, keeps immutable history and does not require or create new execution authority
- quota, reference denial and audit failure roll back head, immutable version, event and idempotent response together
- revision ceiling permits authorized no-op and archival, but cannot overwrite the last version
- reads detect stored corruption, detach pagination and retain archived rows without checking execution grants
- native authoring adapter checks sorted Node grants/capabilities, locked Profile and every current Endpoint in the supplied transaction

### E129: apps/control/test/path-binding-ports.test.ts

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

### E130: apps/control/test/path-template-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-template-mysql-acceptance.test.ts)

- path templates use real native reference authorization, transactional CAS/quotas, immutable history, archival and SELECT-only scoped queries

### E131: apps/control/test/path-binding-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-binding-mysql-acceptance.test.ts)

- path binding uses real original owner transactions: immutable expanded provenance, concurrent CAS, rollback, cap, archival and SELECT-only impact/history

### E132: scripts/phase2/path-template-console.ts

[Source](../../scripts/phase2/path-template-console.ts)

See the source scenario assertions or configured command steps.

### E133: scripts/phase2/path-switch-console.ts

[Source](../../scripts/phase2/path-switch-console.ts)

See the source scenario assertions or configured command steps.

### E134: scripts/phase2/path-batch-console.ts

[Source](../../scripts/phase2/path-batch-console.ts)

See the source scenario assertions or configured command steps.

### E135: apps/control/test/probe-negotiation-ports.test.ts

[Source](../../apps/control/test/probe-negotiation-ports.test.ts)

- Probe negotiation returns only immutable session-bound recognition on the supplied read transaction
- malformed declarations and session or fingerprint mismatches reject before transaction admission
- retired boots, foreign evidence, revoked, missing or expired credentials and unavailable TCP facts cannot negotiate
- machine reader binds the supplied fingerprint to its Node, fails closed on missing credentials and detaches facts
- the separate Probe hello endpoint cannot be reached with Bearer or spoofed session headers instead of mTLS

### E136: apps/control/test/probe-instance-registry.test.ts

[Source](../../apps/control/test/probe-instance-registry.test.ts)

- remote registry passes actual machine identity to the owner and emits a detached non-executable response
- typed bypass and verified machine/session mismatch reject before entering any owner operation
- Bearer or session headers do not substitute for verified mTLS on the instance endpoint

### E137: apps/control/test/probe-instance-ports.test.ts

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

### E138: apps/control/test/probe-permit-ports.test.ts

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

### E139: apps/control/test/probe-claims.test.ts

[Source](../../apps/control/test/probe-claims.test.ts)

- closed claim adapter forwards only actual mTLS identity and emits a detached minimized receipt after owner completion
- typed contract bypass and verified Node/session mismatch reject before owner consumption
- owner denial, post-commit expiration and inconsistent owner result cannot manufacture a receipt or retry consumption
- Bearer, claimed fingerprint and session headers never substitute for actual mTLS on the claim endpoint

### E140: apps/control/test/probe-delivery.test.ts

[Source](../../apps/control/test/probe-delivery.test.ts)

- closed delivery adapter forwards actual machine identity and minimizes immutable empty/one/status replies after owner completion
- invalid typed commands, cross-protocol and verified identity mismatch reject before any owner call
- owner denial and pre-commit guard failures propagate without fallback, cached success or a second transaction
- post-commit stale or uncertain clocks and expired results cannot produce discovery or status acknowledgements
- inconsistent owner identity, instance, time or execution markers fail closed after exactly one call
- delivery endpoints never substitute Bearer or claimed headers for actual mTLS

### E141: apps/control/test/probe-results.test.ts

[Source](../../apps/control/test/probe-results.test.ts)

- result adapter delegates once to the owner, awaits commit and returns only a detached receipt
- typed result injection and claimed Node/session mismatch reject before the owner
- failed owner commits propagate without an acknowledgement, fallback or retry
- stale post-commit clocks and inconsistent saved receipts cannot manufacture a result acknowledgement
- result endpoint rejects Bearer and claimed fingerprint without actual mTLS

### E142: apps/control/test/probe-negotiation-mysql-acceptance.test.ts

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

### E143: apps/control/test/probe-permit-mysql-acceptance.test.ts

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

### E144: apps/control/test/optional-http-services.test.ts

[Source](../../apps/control/test/optional-http-services.test.ts)

- ${name} named and positional HTTP wiring admit before authentication, await the owner and release
- ${name} omission, admission refusal, denied authentication and owner failure preserve dispatch boundaries

### E145: apps/control/test/foundation-cancellation.test.ts

[Source](../../apps/control/test/foundation-cancellation.test.ts)

- native signal identity crosses both public cancellation ports without wrappers or altered reason
- a common cancellation provider needs no native EventTarget members for sender pre-admission refusal

### E146: apps/control/test/notification-sender-drain.test.ts

[Source](../../apps/control/test/notification-sender-drain.test.ts)

- a common cancellation registration race removes the same once callback and never enters DNS
- cancelled DNS still owns sender capacity and close waits for the actual callbacks without another lookup or request
- cancelled authorization guards retain capacity until both real guards settle, including a late guard failure
- one pinned HTTPS attempt preserves HTTP rejection versus unknown network outcome without redirect or retry

### E147: apps/control/test/notification-delivery-worker.test.ts

[Source](../../apps/control/test/notification-delivery-worker.test.ts)

- delivery worker commits its bounded claim before leasing secrets, reauthorizes the dispatch and records an unknown result without immediate resend
- revoked manager after claim cancels dispatch and secret unavailability records refusal without using raw credentials or another sender
- failed claim and finish writes roll back their owner transaction without a hidden resend or resetting the existing fence
- worker retains its secret lease and coalesces ticks until sender physical drain, and close joins that drain

### E148: apps/control/test/publication-savepoints.test.ts

[Source](../../apps/control/test/publication-savepoints.test.ts)

- ${name} success keeps result identity and releases after the original action
- ${name} classifies before rollback and projects only after release
- ${name} unknown errors and classifier faults escape without savepoint rollback
- ${name} every savepoint or late projection failure escapes by identity
- publication refusal classifier retains error identity, status bounds, retryable guard and shared mutable code Set

### E149: apps/control/test/audit-owner-transactions.test.ts

[Source](../../apps/control/test/audit-owner-transactions.test.ts)

- audit rejects invalid closed queries before clock and authorization before any source read
- audit sequential source reads share caller transaction and frozen read-only result
- audit pagination binds cursor to explicit query and rejects corrupt duplicate ordering
- audit request admission releases capacity after both rejection and successful drain
- audit store and malformed-row failures release active slots for later independent actors

### E150: apps/control/test/station-alert-worker.test.ts

[Source](../../apps/control/test/station-alert-worker.test.ts)

- station worker authorizes before locks and atomically appends handoff and state
- station revoked manager suspends without reading facts or producing events
- station handoff or state failure rolls back all event effects and defers with original guarded revision
- station worker rechecks latest revision and prevents overlapping ticks while a fact read drains

### E151: apps/control/test/node-observation-ports.test.ts

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

### E152: apps/control/test/node-observation-mysql-acceptance.test.ts

[Source](../../apps/control/test/node-observation-mysql-acceptance.test.ts)

- observation production assembly uses SELECT-only MySQL and preserves scope authorization and database contents
- persisted report provenance and expiry never become independent health or applied-state claims
- a real MySQL authorization lock is stopped by the observation deadline without changing grants or execution state

### E153: apps/control/test/telemetry-owner-transactions.test.ts

[Source](../../apps/control/test/telemetry-owner-transactions.test.ts)

- ${family} telemetry intake authorizes before stored reads and preserves exact replay receipt without append
- ${family} telemetry rollup failure rolls back raw head and releases node admission
- ${family} telemetry parser and credential refusal cannot touch persisted head
- ${family} telemetry changed replay, epoch and uptime preserve original refusal precedence
- ${family} telemetry refuses revoked expired or superseded sessions before locking head
- ${family} telemetry history authorizes Scope before Node reads and keeps response non-authoritative
- ${family} telemetry request capacity drains and callback errors release capacity

### E154: apps/control/test/forward-probe-plan-ports.test.ts

[Source](../../apps/control/test/forward-probe-plan-ports.test.ts)

- probe preflight rejects open inputs, coercions and invalid identities before starting a transaction
- preflight uses one authorized read transaction, returns immutable binding and never issues executable authority
- manager and explicit Node Grant checks occur before reading any published execution
- trusted authorization port joins the supplied transaction without starting a nested one or granting execution
- stale revisions and disabled, deleting, recovery-suspended, DNS, UDP-only and Relay intents cannot plan
- metadata remains forbidden even when Forward policy allows it; foreign facts and denied CIDRs fail closed
- missing, expired and incompatible published bindings cannot become a plan
- MySQL projection is scoped, supplied-transaction-only and binds body generation/session/expiry to database rows

### E155: apps/control/test/notification-destination.test.ts

[Source](../../apps/control/test/notification-destination.test.ts)

- notification destinations share the native parser and return canonical HTTPS without credentials or query
- notification destination rejects alternate trust/address channels with the original public error
- notification destination bounds both supplied and canonical URL bytes

### E156: apps/control/test/forward-probe-mysql-acceptance.test.ts

[Source](../../apps/control/test/forward-probe-mysql-acceptance.test.ts)

- probe preflight production API is SELECT-only, manager-plus-grant authorized and never creates commands or execution work
- probe preflight rejects current database/body mismatches, revoked nodes and quarantined intents without writes

### E157: apps/control/test/probe-permit-validator-complete.test.ts

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

### E158: apps/control/test/probe-instance-mysql-acceptance.test.ts

[Source](../../apps/control/test/probe-instance-mysql-acceptance.test.ts)

- real MySQL serializes absent-slot races, replacement and repeated registration across independent application instances
- real MySQL rolls back first-slot seeds and replacement on downstream or maintenance failure; expired retries cannot renew
- real MySQL rechecks credential, session and capabilities before replay, while revocation remains possible after TCP withdrawal
- real MySQL quarantine preserves the stored generation, rejects resurrection and keeps non-instance state unchanged

### E159: apps/control/test/ingress-group-ports.test.ts

[Source](../../apps/control/test/ingress-group-ports.test.ts)

- ingress publication authorizes before replay and rechecks sorted live template grants even for an unchanged definition
- a response persistence failure rolls back ingress head, immutable revision, audit and replay before a same-key retry
- historical ingress descriptions use persisted references but active resolution refuses archived groups before template disclosure
- ingress requires distinct ingress Nodes and common protocols before committing definition state

### E160: apps/control/test/transit-staging.test.ts

[Source](../../apps/control/test/transit-staging.test.ts)

- staging journal is detached immutable and retains independent Scope, generation, digest and Fence proof
- multi-hop MySQL state stores no executable or active states

### E161: apps/control/test/path-topology.test.ts

[Source](../../apps/control/test/path-topology.test.ts)

- Direct path gives the same unique Agent identity a local direct role without a peer
- Current two-node Relay stays ingress then egress; activation remains downstream first
- Three- and four-Node paths derive transient transit roles and exact adjacent peers
- Roles belong to each Forward; an Agent can be ingress, transit and egress simultaneously
- Bounded path allows exactly the maximum without arbitrary cycles
- Invalid, repeated and missing Profile paths refuse planning
- Multi-hop planning does not bypass existing ADP/3 two-node execution boundary
- Topology compiler is detached, deterministic and never mutates the caller

### E162: apps/control/test/transit-reservations-db.test.ts

[Source](../../apps/control/test/transit-reservations-db.test.ts)

- strict reservation refuses same-Forward or foreign physical owner before overwriting fences
- new exclusively free ports acquire monotonically increasing Fences under locks

### E163: apps/control/test/transit-mysql-acceptance.test.ts

[Source](../../apps/control/test/transit-mysql-acceptance.test.ts)

- Transit real MySQL: atomic rollback, concurrent exclusivity and monotonic fences

### E164: apps/control/test/telemetry-rollup-values.test.ts

[Source](../../apps/control/test/telemetry-rollup-values.test.ts)

- rollup wide sums and precise counter increments preserve immutable prior bucket
- rollup attribution uses receipt interval end across minute and hour boundaries
- rollup reset gap overflow and terminal precedence never invents an increment interval
- rollup rejects cross-bucket or cross-series reuse before mutating existing values

### E165: apps/control/test/native-codec-complete.test.ts

[Source](../../apps/control/test/native-codec-complete.test.ts)

- readiness98 exact public/legacy class, API response/port aliases and constructor method surface
- required reconcile effects refuse construction without touching any provider
- native digest frame, command/request key order, frozen identity and original provider receivers
- unchanged grant returns 200, persists receipt and never reconciles; replay keeps exact response identity
- original ${failed} failure stops the sequence and rolls back all original transaction effects
- validation preserves actual actor/scope/profile/subject/revision/Boolean/key order before digest or transaction
- canonical command imports original digest and actual current consumer wires exact supplied owners

### E166: apps/control/test/console-serving.test.ts

[Source](../../apps/control/test/console-serving.test.ts)

- same-origin console assets retain content types, no-store and strict CSP
- console API refuses anonymous scoped list access

### E167: apps/control/test/console-module-assets.test.ts

[Source](../../apps/control/test/console-module-assets.test.ts)

- every distributed Web JavaScript leaf is served byte-exactly with security headers and fixed-path refusal

### E168: apps/control/test/forward-execution-registry-complete.test.ts

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

### E169: apps/control/test/runtime-legacy-type-map-complete.test.ts

[Source](../../apps/control/test/runtime-legacy-type-map-complete.test.ts)

- 203 all 34 runtime leaves retain bounded eight construction one interface 25 forwarding classification
- 203 all legacy runtime native aliases and generic defaults resolve to the exact original uninstantiated public declarations
- 203 production Recovery phase fixture and original tests retain actual legacy construction and native compilation imports until migration

### E170: apps/control/test/snapshot-source-complete.test.ts

[Source](../../apps/control/test/snapshot-source-complete.test.ts)

- 118 original public legacy classes constructor prototypes readonly source contracts and native clone remain exact aliases
- 118 registration preserves complete declaration ID driver role ownership refusal messages and first-error precedence
- 118 registry binds original source receiver at construction snapshots declarations freezes registrations and performs no eager collect clone or clock reads
- 118 direct and every contribution clone freeze before the next await with source-ID order context copy dynamic clone lookup and final ID sort
- 118 dynamic native clone failures retain original identity at direct or contribution boundary and stop subsequent owners
- 118 contribution shape and ownership refuse before conflicts and each assignment logical physical conflict stops the next source
- 118 Relay source captures original member callback without reading plans until collection and retains literal frozen role catalog and original contribution references

### E171: scripts/phase2/probe.ts

[Source](../../scripts/phase2/probe.ts)

See the source scenario assertions or configured command steps.

### E172: apps/control/test/control-startup-complete.test.ts

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

### E173: apps/control/test/control-client-complete.test.ts

[Source](../../apps/control/test/control-client-complete.test.ts)

- 157 ${entry.args[0]} ${entry.args[3] ?? ''} exact command method/path/body/key and opaque providers
- 157 public generic signature and native identity preserve strict parse binding
- 157 required env/scope precede command dispatch; every required positional argument preserves original usage refusal
- 157 provider failures preserve identity and stop without catch, retry or later output
- 157 native HTTPS exact headers, UTF8 body length, end, chunks, statuses, timeout destruction and original errors
- 157 native argv/env/URL/encoding/strict JSON/files and main composition retain original implementations

### E174: scripts/test/foundation-boundary-policy.test.mjs

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

### E175: scripts/check-foundation.mjs

[Source](../../scripts/check-foundation.mjs)

See the source scenario assertions or configured command steps.

### E176: scripts/test/foundation-boundary-completeness.test.mjs

[Source](../../scripts/test/foundation-boundary-completeness.test.mjs)

- the actual production source graph obeys the declared inventory including Web example operator and Go roots
- all static type and value reference syntaxes retain lower direction and concrete-provider refusal
- L0 infrastructure globals and L1 root or private package subpaths cannot become injected contracts
- L2 native adapters refuse reverse product value and type references while retaining lower contracts
- Control and browser product owners reject native platform branches including computed and aliased reads
- Go product owners reject native OS and architecture selection through imports aliases dot imports and build files
- only explicitly named bindings retain native selection and lower classifications cannot be exempted by a binding label

### E177: apps/control/test/foundation-compatibility.test.ts

[Source](../../apps/control/test/foundation-compatibility.test.ts)

- legacy and public errors, request lifecycle and native policy retain exact object identity
- public request lifecycle drains after a rejected application action and preserves its error identity
- bootstrap reads both environment values before validation and closes only an opened database
- bootstrap awaits cleanup and a cleanup failure retains finally error precedence

### E178: apps/control/test/foundation-extension.test.ts

[Source](../../apps/control/test/foundation-extension.test.ts)

- the public extension authorizes the caller transaction and returns detached immutable native-format intent
- the public extension refuses invalid identities and closed-format input before transactions and never logs denied intent
- the public extension completes despite logger failure and request draining waits for its actual transaction

### E179: packages/core/test/public-source-closure.test.ts

[Source](../../packages/core/test/public-source-closure.test.ts)

- protected Core has exactly four implementation files one package entry complete public names and no private ipv4Bytes subpath
- every independently versioned Control framework storage product native and browser public declaration matches its own source and runtime export
- all independently versioned Agent declarations preserve their exact native or lower public constant and typed Host alias
- native ADP3 admission refuses legacy input while the original internal ADP2 projection and lower generic shapes remain available
- saved package support assets and actual deployment COPY embed fs and source replacement inputs retain their declared consumers

### E180: apps/control/test/legacy-entrypoints.test.ts

[Source](../../apps/control/test/legacy-entrypoints.test.ts)

- ${family} pure legacy entries load their exact mapped canonical values and preserve erased runtime surfaces
- legacy aggregate retains its own version and three exact reader constructors while frozen policies stay distinct

### E181: apps/control/test/type-source-compatibility-complete.test.ts

[Source](../../apps/control/test/type-source-compatibility-complete.test.ts)

- 207 all nineteen named application leaves forward every exact type to the same canonical uninstantiated declaration
- 204 five runtime port groups retain every exact public canonical type declaration and original version leaf
- 202 direct public consumer imports/aliases use the same Accepted, Forward reference, Node authority and Member declarations
- 204/207 Policy imports and original DEFAULT_POLICY/Idempotency value imports retain exact leaves and declarations
- 202/204/207 changing erased import/export sources cannot change emitted runtime body, value imports or introduce a loading cycle
- 202/204/207 actual legacy runtime imports initialize and old server/bootstrap/phase/test paths remain resolvable

### E182: packages/contracts/test/contracts.test.ts

[Source](../../packages/contracts/test/contracts.test.ts)

- authoritative valid: ${item.name}
- authoritative invalid: ${item.name}
- shared conformance: ${item.name}
- RFC 8785 number and Unicode sorting vectors
- bounded JSON fails closed before any domain state is used
- precise timestamp comparison and lease upper bound
- CIDR requires a network, proper prefix, and IP family

### E183: packages/contracts/test/adp3.test.ts

[Source](../../packages/contracts/test/adp3.test.ts)

- shared complete ADP/3: ${item.name}

### E184: packages/contracts/test/relay.test.ts

[Source](../../packages/contracts/test/relay.test.ts)

- relay profile and open are strict, bounded and immutable values
- relay rejects downgrade, malformed limits and same endpoint identities
- relay rejects duplicate keys and unknown control fields
- shared Relay contract: ${item.name}
- shared ADP/3 resource: ${item.name}

### E185: packages/contracts/test/distribution-assets.test.ts

[Source](../../packages/contracts/test/distribution-assets.test.ts)

- all native schema copies preserve source bytes modulo checkout line endings, including the separate execution generator output
- all twenty-one schema resources compile every local definition without remote resolution
- all eleven declared package entries initialize through their actual public export targets
- staged native package initialization refuses missing or malformed schema/catalog while lower common entries remain loadable

### E186: packages/contracts/test/policy-entrypoints.test.ts

[Source](../../packages/contracts/test/policy-entrypoints.test.ts)

- the pure Policy entry has its own version and preserves thirteen required mutable numeric fields
- old package entries retain the original frozen Policy default identity values and insertion order

### E187: packages/contracts/test/native-assets-complete.test.ts

[Source](../../packages/contracts/test/native-assets-complete.test.ts)

- the real schema generators check all ten exact schema/declaration targets and execution aliases without rewriting other source roles
- the actual Transit comparator accepts uniform checkout CRLF and rejects each parity and contract-only Runtime mutation
- all eleven actual package entries preserve complete eager dependency failure and telemetry specification independence in the distributed COPY tree

### E188: packages/contracts/test/native-drivers.test.ts

[Source](../../packages/contracts/test/native-drivers.test.ts)

- native catalog is immutable, versioned, and distinguishes business from physical carrier protocols
- catalog parser refuses new drivers, executable fields, duplicate keys, versions and unbounded metadata

### E189: packages/contracts/test/telemetry-specification-complete.test.ts

[Source](../../packages/contracts/test/telemetry-specification-complete.test.ts)

- four handwritten telemetry parsers independently agree with their specification samples and ACK fixtures and preserve immutable detached data
- the exact four Agent native encoder fixtures satisfy the separate TS handwritten parsers and specification schemas
- handwritten telemetry keeps native uint64, host arithmetic and point provenance beyond specification-only checks

### E190: agent/internal/observationwire/native_wire_complete_test.go

[Source](../../agent/internal/observationwire/native_wire_complete_test.go)

- TestFourNativeTelemetryEncodersPreserveLiteralWireFixtures
- TestFourNativeTelemetryAcknowledgementsRequireOriginalSentIdentityAndClosedReceipts
- TestNativeTelemetryEncodersPreserveOriginalPageIdentityAndSizeLimits

### E191: packages/core/test/forward.test.ts

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

### E192: apps/control/test/control-bootstrap-complete.test.ts

[Source](../../apps/control/test/control-bootstrap-complete.test.ts)

- bootstrap retains exact public/native surfaces and original argv/env lookup defaults
- bootstrap destructuring ignores extra values and keeps arguments/env/provider receiver and exact refusal order
- bootstrap async stage failures retain exact identity while awaited close can supersede each original failure
- original Identity bootstrap validates before transaction and inserts account scope and owner in the same supplied transaction
- actual bootstrap entry keeps the native database alias and original Identity construction at callback invocation

### E193: apps/web/test/model.test.mjs

[Source](../../apps/web/test/model.test.mjs)

- scope IDs, ports and CIDRs reject invalid local form inputs
- Direct form only offers authenticated capabilities and authorized listener slots
- Operation state never derives healthy from accepted deployment
- list query encoding preserves server-side filters across bounded pages
- candidate pages keep only bounded current rows and freshly revalidated selections

### E194: apps/web/test/model-effects.test.mjs

[Source](../../apps/web/test/model-effects.test.mjs)

- model aliases preserve function identity and factory initialization does not read native time or effects
- native model credential evaluation preserves getter and parser lookup order even for invalid dates

### E195: apps/web/test/native-model-complete.test.mjs

[Source](../../apps/web/test/native-model-complete.test.mjs)

- all ten legacy model exports retain signatures and pure alias identity without eager native clock reads
- native credential expression captures Date.parse before the second getter even when that getter replaces it
- Direct capability keeps the original guard order and reads credentials only after every authorization fact
- Direct form preserves property and String Number coercion order before listener then target authorization
- native query preserves URLSearchParams defaults Object.entries getter and String coercion ordering
- pure model helpers retain bounded ports CIDRs protocol ordering candidate replacement tones and pagination

### E196: apps/web/test/relay-model.test.mjs

[Source](../../apps/web/test/relay-model.test.mjs)

- Relay Profile builder follows bounded native-relay contract
- Relay Endpoint accepts distinct TLS/TCP ports and bounded peer host facts
- Relay spec binds two distinct authorized nodes and immutable Profile revision
- multi-hop editor preserves route order and refuses cycles, missing capabilities and a closed gate

### E197: apps/web/test/console-flow.test.mjs

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

### E198: scripts/check-web.mjs

[Source](../../scripts/check-web.mjs)

See the source scenario assertions or configured command steps.

### E199: apps/web/test/browser-leaf-map-complete.test.mjs

[Source](../../apps/web/test/browser-leaf-map-complete.test.mjs)

- all twenty-two documented browser leaves retain exact old exports real consumers and explicit per-file roles
- four telemetry opens really reload bounded histories while initialization edits and clear perform no requests
- accepted template metadata publication really refreshes its bounded list after the original command

### E200: apps/web/test/request-effects.test.mjs

[Source](../../apps/web/test/request-effects.test.mjs)

- canonical request factory gives JSON decoding precedence over stale connection and abort/status checks
- canonical mutation factory retains keys after failure, deletes on success, and resets explicitly
- canonical request succeeds only after decode, cancellation, and response checks in order
- canonical request construction is lazy and disconnected mutations prepare a stable key before connection refusal
- native request effects preserve exact fetch framing and caller cancellation reason
- native response checking preserves server code and status with bounded fallback semantics

### E201: apps/web/test/native-request-complete.test.mjs

[Source](../../apps/web/test/native-request-complete.test.mjs)

- request public signatures and lazy connection getters retain short circuit and exact errors
- request captures version before dispatch and preserves default options and effect receiver lookup order
- request native failure precedence preserves identity except the exact JSON refusal boundary
- native send returns the exact fetch promise and preserves native option defaults and getter order
- mutation retains original input for separate signature and body serialization without clone or freeze
- same-signature concurrent mutations share a key and dispatch independently without an added queue
- mutation signature and key failures precede connection and clearing pending performs no effects
- native response errors preserve property and primitive coercion order including falsy nonnull values

### E202: apps/web/test/native-main-complete.test.mjs

[Source](../../apps/web/test/native-main-complete.test.mjs)

- native main module import has no eager DOM clock fetch or credentials effect
- main connect keeps validation first then original clear auth secret input and four reads; disconnect clears every owner in order
- main one-time registration secret flows through real node submit copy dialog close failure and disconnect callbacks
- main clipboard failure and node mutation failure stay bounded and do not fabricate credentials or refresh
- main native listeners keep lazy cross-owner callbacks filters navigation paging refresh and clear behavior

### E203: apps/web/test/native-rule-complete.test.mjs

[Source](../../apps/web/test/native-rule-complete.test.mjs)

- native Rule factory is lazy and keeps initializer defaults destructuring return names and callback wiring
- native Rule input Set preserves reset versus drop and callbacks retain original item and listener order
- native Rule clone ordered and JSON remain separate evaluations with original getters and errors
- native Rule show consent and clear callbacks preserve the original view operation order
- native Rule effects preserve encoding UTC UUID confirm binding cancellation options and bounded error representation
- actual main composition keeps Profile and Path handoffs lazy until the initialized Rule consumer exists

### E204: apps/web/test/probe-flow.test.mjs

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

### E205: apps/web/test/probe-run-history-flow.test.mjs

[Source](../../apps/web/test/probe-run-history-flow.test.mjs)

- manual historical run reads validate legacy and TCP/UDP Echo summaries and display stored evidence without commands
- full stored digest and independent Echo invocation digest reject tampering even when outer summary is resealed
- run detail refuses retention, lifecycle, Scope, status, proof and byte inconsistencies after valid content resealing
- history query rejects invalid windows, limits and status before I/O and preserves the echoed exact filter
- history pages reject mismatched filters, order, duplicate IDs, cursor binding and excessive response size
- next page requires the same frozen query and cursor position and never paginates automatically
- cancel, input edits, clear and Scope changes discard late history without automatic follow-up

### E206: apps/web/test/tunnel-flow.test.mjs

[Source](../../apps/web/test/tunnel-flow.test.mjs)

- tunnel Console uses only bounded read-only GETs and distinguishes recorded windows from network or certificate evidence
- pagination is bounded, read-only, and a deployment view delegates to the original management entrypoint exactly once
- dialog close and disconnect abort both reads and discard late responses without recreating actions
- replacing the selected Node ignores all stale metadata and references
- unavailable and malformed metadata clears previous output instead of retaining a readiness claim
- unrelated adjacency, incorrect authorization and invalid paging fail closed without actions
- unknown extra metadata fields never flow into the rendered credential projection

### E207: apps/web/test/rule-flow.test.mjs

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

### E208: .github/workflows/container.yml

[Source](../../.github/workflows/container.yml)

See the source scenario assertions or configured command steps.

### E209: .github/workflows/ci.yml

[Source](../../.github/workflows/ci.yml)

See the source scenario assertions or configured command steps.

### E210: tsconfig.json

[Source](../../tsconfig.json)

See the source scenario assertions or configured command steps.

### E211: agent/internal/observationwire/testdata/native-telemetry-fixtures.json

[Source](../../agent/internal/observationwire/testdata/native-telemetry-fixtures.json)

See the source scenario assertions or configured command steps.

### E212: agent/internal/nativeexecution/catalog.go

[Source](../../agent/internal/nativeexecution/catalog.go)

See the source scenario assertions or configured command steps.

### E213: agent/internal/executiondriver/registry.go

[Source](../../agent/internal/executiondriver/registry.go)

See the source scenario assertions or configured command steps.

### E214: apps/control/test/upgrade-assessment.test.ts

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

### E215: apps/control/test/recovery-workflow-ports.test.ts

[Source](../../apps/control/test/recovery-workflow-ports.test.ts)

- backup protects output, rechecks authority after synchronized dump and publishes signed manifest last
- backup partial failures close the database and never publish a manifest after failed dump or authority recheck
- restore refuses issuers, SQL tamper and unexhausted authority before creating a fresh target
- restore commits quarantine before credentials and authority rebind then closes target before source
- restore distinguishes pre-commit rollback from credential/rebind failure after committed quarantine
- restore preserves partial-target and migrate failures without fabricating rollback or deleting history

### E216: apps/control/test/recovery-quarantine-order.test.ts

[Source](../../apps/control/test/recovery-quarantine-order.test.ts)

- recovery quarantine preserves one transaction, immediate accounts and shared publication time before final event encoding
- recovery quarantine propagates every owner failure and stops subsequent owners/event without retries

### E217: apps/control/test/runtime-publication.test.ts

[Source](../../apps/control/test/runtime-publication.test.ts)

- publication hold requires a live same-session lease beyond the exact five-second boundary
- publication reuse retains exact renewal and credential/Relay caps without importing host authority
- publication deadline chooses the earliest authority and keeps the empty withdrawal policy deadline

### E218: apps/control/test/runtime-host-ports.test.ts

[Source](../../apps/control/test/runtime-host-ports.test.ts)

- Runtime Hello keeps protocol and identity refusal before effects, then lock/credential/facts/boot ordering
- Runtime construction refuses missing clock/time/machine methods before sampling or provider effects
- Runtime Hello refuses retired boots, changed capabilities, lost history and session exhaustion before boot writes
- Runtime publication records protected authority before Snapshot and leases in one transaction
- Runtime publication stops on authority/save failures and never records leases or completion
- Runtime publication preserves queued same-instance multihop state and refuses exhausted counters before retirement
- Runtime stale worker claim after compilation refuses authority and Snapshot persistence
- Runtime report duplicate replay preserves ACK and rejects changed body before observation writes
- Runtime report refuses identity, boot, unpublished generation, fence and phase before drain/report writes
- Runtime report accepts current evidence after drains and never fails execution on expired publication
- Runtime copies default and explicit validated policies at construction then detaches every Hello response
- Runtime retains policy validator receiver error identity and refuses weakened authority before any transaction
- native Policy validation retains constructor sample timing and original parser refusal for malformed values

### E219: apps/control/test/mysql-migration-statements.test.ts

[Source](../../apps/control/test/mysql-migration-statements.test.ts)

- migration splitting preserves comments and quoted semicolons without joining SQL tokens
- migration splitting respects doubled quotes and native string backslash escapes
- migration splitting follows NO_BACKSLASH_ESCAPES and ANSI_QUOTES without changing SQL text
- executable MySQL comments remain statements and unterminated or client-delimited scripts fail closed
- the four production migrations with semicolons in introductory comments retain complete ordered DDL

### E220: apps/control/test/runtime-resource-ports.test.ts

[Source](../../apps/control/test/runtime-resource-ports.test.ts)

- resource ports retain the caller transaction, Node session refusal and null versus zero authorization
- Direct reservation sorts physical protocols and refuses even the same existing owner
- Relay reservation orders physical resources while preserving forward protocol and allowing same-owner renewal
- resource capacity failure follows all reservations and propagates for caller rollback
- transition locks prior ownership first and keeps old slots through the drain window
- fence and generation exhaustion refuse writes at the original resource lock boundary
- slot removal preserves enumeration order and exact owner and physical protocol predicates

### E221: scripts/phase2/capacity.ts

[Source](../../scripts/phase2/capacity.ts)

See the source scenario assertions or configured command steps.

### E222: apps/control/test/background-task-effects.test.ts

[Source](../../apps/control/test/background-task-effects.test.ts)

- background effects prevent overlapping work and close joins the active task and stop hook exactly once
- background failure backoff uses completion time, exact thresholds and caps, then resets on success
- background shutdown waits for all independent hooks even when one fails

### E223: apps/control/test/server-composition-complete.test.ts

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

### E224: apps/control/test/background-native-effects.test.ts

[Source](../../apps/control/test/background-native-effects.test.ts)

- aggregate registration errors precede missing effects and declaration errors retain their own order without effects
- native construction inherits the host, defers first work and dynamically resolves timers and monotonic time
- provider and declaration receivers retain copied frozen configuration and cancellation is retryable after a throw
- failure delays stay capped beyond sixteen failures and no-delay failures use only admission samples
- independent tasks retain registration order, own active slots and sanitize errors only after all hooks settle

### E225: apps/control/test/runtime-status-ports.test.ts

[Source](../../apps/control/test/runtime-status-ports.test.ts)

- runtime status decodes report before current and preserves separate current freshness decode in the caller transaction
- runtime status retains lazy malformed-body failure order and absent body/zero timestamp semantics
- runtime status matches generation/fence tuples and marks exact expiry, wrong epoch and missing evidence unknown
- runtime raw status adapter uses only supplied execute and exact original query arguments

### E226: apps/control/test/foundation-storage-effects.test.ts

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

### E227: scripts/phase1/acceptance.ts

[Source](../../scripts/phase1/acceptance.ts)

See the source scenario assertions or configured command steps.

### E228: apps/control/test/authority.test.ts

[Source](../../apps/control/test/authority.test.ts)

- authority upper bound is durable and monotonically includes concurrent publishers
- recovery trust/database binding stays quarantined until the exact review ID
- missing or corrupted protected state cannot be initialized from zero
- artifact verification rejects changed data and publication rejects unsafe bounds
- offline recovery refuses stale or future clock observations even when marked synchronized

### E229: apps/control/test/upgrade-mysql-acceptance.test.ts

[Source](../../apps/control/test/upgrade-mysql-acceptance.test.ts)

- upgrade assessment preserves MySQL, authenticated journals and Authority; rejects unsafe restores and interrupted DDL

### E230: scripts/check-boundaries.mjs

[Source](../../scripts/check-boundaries.mjs)

See the source scenario assertions or configured command steps.

### E231: apps/control/test/legacy-constructor-effects.test.ts

[Source](../../apps/control/test/legacy-constructor-effects.test.ts)

- zero-argument legacy bindings retain subclass identity and construct without sampling a clock
- legacy Forward reads bind actual native SQL on the supplied transaction and decode only projected values
- legacy Forward references preserve explicit selector precedence, null authorizers and owner-only quarantine
- legacy Forward writes bind native JSON at each await and preserve CAS and exact failure identities
- legacy Idempotency zero-argument binding keeps native ensure-lock JSON replay and refusal priority
- legacy Idempotency snapshots keys across native SQL awaits but compares the live digest
- legacy Idempotency response serializes before key reads and propagates encode, SQL and quarantine failures

### E232: apps/control/test/legacy-owner-defaults.test.ts

[Source](../../apps/control/test/legacy-owner-defaults.test.ts)

- all six top-level legacy construction entries retain their exact runtime export names and erased type leaves
- legacy owner constructors retain distinct classes, public method inheritance and native initialization without clock sampling
- Identity audit resolves Date.now at each call and native account lookup keeps pool versus supplied-Tx ownership
- Nodes captures Date.now once, preserves separate machine samples and default resource initialization in the original transaction
- Nodes retains omitted versus supplied resources, credential defaults and original constructor refusal order
- Transport keeps native UUID captured at construction and dynamic time while grant callbacks and SQL share the original transaction
- RelayEndpoints dynamic clock, native store and original owner callbacks preserve request identity and transaction order
- legacy static recovery stores use the exact supplied executor and retain original failure identity and order

### E233: apps/control/test/runtime-construction-complete.test.ts

[Source](../../apps/control/test/runtime-construction-complete.test.ts)

- 203/205 RuntimeController constructs original state/status providers and preserves every ledger receiver and Forward argument
- 203/205 RuntimeLedger retains policy spread resource short circuit native stores collector authorization and captured clock/UUID
- 203/205 RelayCoordinator keeps same ledger/providers fresh policy false multihop captured instance clock and invocation-time static same-Tx quarantine
- 203 retained RelayExecutionLedger remains an interface extending original public native generic specialization

### E234: apps/control/test/transit-legacy-bindings-complete.test.ts

[Source](../../apps/control/test/transit-legacy-bindings-complete.test.ts)

- 203/205 journal holds one real coordinator/store and forwards all arguments result failure and original database member transaction
- 203/205 delivery retains held offline journal but creates preview service/store at each original call and exposes only peek
- 203/205 negotiation constructs original machine reader per hello and retains member transaction and complete argument identities
- 203/205 module-time reservations keep one real owner exclusive resource/store and exact arguments with late default capacity
- 203/205 staging holds service original native resource/release/store and all member receivers currentOnly arguments and one database transaction
- 205 native Transit store adapters issue original locks on caller transaction without opening or replacing it

## Acceptance Decision

Do not freeze the foundation public interfaces or open product parallel work from
CI totals alone. Close the concrete remaining obligations above, record applicable
exact-source execution and consciously define the accepted public-interface scope.
The current evidence map is a completed audit artifact; B acceptance is unfinished.

Only durable regression tests and this final map are retained. Temporary per-agent
JSON, PR body scratch and downloaded logs are removed after integration. Historical
Actions runs remain the immutable execution record.

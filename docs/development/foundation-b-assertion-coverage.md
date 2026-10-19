# Foundation B Assertion Coverage

Updated: 2026-10-19 (Asia/Shanghai).

This is the maintained acceptance map for readiness 1–220, replacing temporary
per-agent JSON and scratch extracts. It identifies actual assertion anchors and
remaining obligations. It is not a pass certificate.

## Status And Source Identity

The first test candidate is `8ee61b1fdc952675c7a625605aa79a447ab7e65f` in PR #112. Later appended tests,
this map and execution outcomes require the final candidate's own Actions.
The functional/MySQL/network/container/browser runs occur only in GitHub Actions.
A workflow's exact tested checkout/tree and its conclusion must be recorded with
the source revision; old passing revisions do not validate later tests.

| Assertion identification | Items | Meaning |
| --- | ---: | --- |
| covered | 2 | Identified assertions cover the whole listed requirement; execution is separate |
| partial | 218 | Identified assertions cover only the stated subset |
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
| 1 | partial | E132 | Covered: Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Need current-revision real inventory scan plus explicit L3 platform-branch and all type/private/unknown-path mutation coverage; policy mutation suite exists but was not run locally. |
| 2 | partial | E133, E134 | Covered: Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: Exhaustive Core/API/generic/export compatibility and all closed families/tool callers are not proved by the named identity/example cases. |
| 3 | covered | E147, E148 | Covered: Exact 5000ms hold boundary, renewal equality, absent/same/different sessions, queued multihop preservation, withdrawal and credential/Relay caps; host counters refuse before retirement/publication. Remaining: No missing assertion identified; exact-source execution still required. |
| 4 | partial | E148, E60 | Covered: Host fake traces cover Hello/boot history, capabilities, one Tx, authority/save/lease order and failures, stale claim after compile, report duplicate/body/fence/phase refusal and expiry. MySQL tests cover existing multihop lifecycle/withdrawal. Remaining: Full related-Node closure/lock/cleanup/drain traces and statement-level transaction fault comparison remain bounded to listed cases. |
| 5 | partial | E149, E60, E30 | Covered: SQL splitter refusal/quoting/comments and MySQL Runtime cases plus Agent read-only inspection refusal are exercised; CI supplies native build/vet/race. Remaining: No exhaustive adapter pre/post SQL/claim-competition differential; independent Windows functional execution and exact absent-field projection matrix are not supplied by Linux CI. |
| 6 | covered | E134 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Remaining: No missing assertion identified; exact-source execution still required. |
| 7 | partial | E60, E150, E151 | Covered: The configured full Actions matrix includes lifecycle, contracts, Go vet/race, MySQL, recovery, browser, namespace/multihop and container gates on each PR candidate. Remaining: Bind final exact checkout revision and all job conclusions after execution; conditional skips remain separate and physical hosts are not included. |
| 8 | partial | E152, E153, E60 | Covered: Caller-Tx Node/epoch/null/zero access, Direct same-owner refusal, protocol sort, Relay physical order/same-owner renewal, capacity after reservations, initial-owned transition lock, generation/fence exhaustion, drain retention and exact ordered removals. Remaining: Full original SQL rollback/competition and shared constructor/default wiring need additional targeted acceptance beyond the port traces and existing capacity/MySQL scenario. |
| 9 | partial | E60, E61 | Covered: Real-MySQL tests preserve succeeded history after terminal failure, fail existing deploying attempt, keep retryable active generation, reject stale reports and roll back owner/effect/response failures. Relay scenario exercises scanner terminal cleanup and duplicate delayed Report. Remaining: No direct RelayHost provider trace samples every Date.now boundary, claim clearing predicate, or failure precisely between operation write and deployment withdrawal. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 10 | partial | E60, E62, E63, E64, E65 | Covered: Snapshot source ownership/conflicts, late publication rollback with durable independent high-water, stale-report isolation, capacity rollback, authorizer withdrawal and genuine Reports while Forward row locked have explicit assertions. Direct LedgerHost traces now assert quarantine/duplicate retirement, accepted/running/succeeded intent and authority filtering, monotone timestamps, expire-before-claim with deadline/attempt/token, generation-limited tombstones and absent/null/zero/exact-boundary drains and distinct completion cleanup. Remaining: Every original SQL statement/argument, malformed persisted body lazy-decode precedence and mid-write real-MySQL rollback/competition are not exhaustively compared by fake-store traces or the mapped integration scenarios. |
| 11 | partial | E60, E66, E67, E68, E61, E69 | Covered: Compiler tests assert peer/session/credential/generation/fence binding, deterministic immutable digests, physical TCP/UDP separation and target policy. Real-MySQL tests cover activation, grant withdrawal, stale generation reports, late failure retention and capacity rollback; real Relay scenarios include deadline/partial-protocol/retry. Remaining: No full direct host/store/observations call trace verifies transitive Node closure locks, every phase pin/retiring overlap boundary or pending-query 100 ordering. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 12 | partial | E70, E60, E71, E72 | Covered: Node policy management/revocation replays, scope rejection, immutable policy and transaction rollback are asserted. Security script checks concurrent rotation same-CSR replay/conflict, exactly two credential records, old/current overlap cutoffs and unchanged session/revision. Transport script tests Relay credentials and caps. Remaining: Enrollment expiry while signing, signer failure/post-sign races, every grant/token/exhaustion branch and exact three-table write/lock order lack direct port-fake differential assertions. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 13 | partial | E1, E2, E3, E4 | Covered: Clock failure latch, credential/drain minimum cutoff, host/source precedence, refresh/rollback, 30s/500ppm/future bounds, blocked provider second sample Remaining: Legacy mutated clock-field and nil Ticket API compatibility, complete Linux/Windows unsupported clocks still lack explicit assertions |
| 14 | partial | E5, E6, E7, E8 | Covered: Authenticated Journal stale fields, custom raw history, lock/load/save/error/unlock ordering, tombstone max, save-before-bind and corrupt durable refusal Remaining: Unknown persistence outcome and every native caller failure branch remain unmapped; custom host now asserts each assignment/forward/generation/role/driver/config/address/protocol immutable rejection |
| 15 | partial | E9, E10, E11, E12 | Covered: Atomic byte replacement and 0600 POSIX mode, rename failure cleanup preserving history, missing-parent refusal, instance exclusivity and read-only inspection Remaining: Injected chmod/write/sync/close/directory-sync failures and per-OS unsupported cases |
| 16 | partial | E13, E14, E15, E16 | Covered: Stable CSR/key retry, corrupt machine no fallback, Relay trust/key/purpose/expiry, protected MAC missing distinction, renewal replay, nil providers Remaining: Exhaustive fake identity/channel traces and each intermediate save/reload/idle/remove failure, main TLS headers/status/redirect bounds |
| 17 | partial | E16, E8, E17, E18 | Covered: Missing explicit providers refuse before bootstrap, persisted Journal precedes socket bind, offline replay and run release ordering Remaining: Injected bootstrap every-stage failure trace, scheduler full timer/cancel/backoff matrix, blocked host worker lifecycle |
| 18 | partial | E19, E20, E21, E22 | Covered: Claim burn before I/O, bounded response read/error, cancellation/admission cooldown, report once and watch drain Remaining: Four telemetry transport pool/redirect traces, native Linux observation parsing bounds and non-Linux values |
| 19 | partial | E23, E16, E22, E24 | Covered: Diagnostics aggregate/final authority false and no secret, missing local providers, one32-byte entropy read and ignored short count, result deadline/uncertainty Remaining: Four16-byte exporter epochs, blocked host worker, OS resource read ordering, diagnostics file failure and warning argument injection |
| 20 | partial | E73, E74, E60, E64, E75 | Covered: Token grammar rejects whitespace/Unicode/lengths. Access port tests assert same-Tx current owner rechecks/replay/no-op/immutable token digest and rollback. Real MySQL/script assertions cover owner protection, member CAS/account conflict, orphan-account/replay rollback, scoped permissions, recovery token invalidation and retained Journal generation. Remaining: Direct IdentityService/IdentityAccessHost store traces for full FOR SHARE/FOR UPDATE lock chain, UUID-clock-audit encoding order, raw bootstrap failures and sorted recovery token rotation are not established. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 21 | partial | E76, E60, E72, E67 | Covered: Profile grant tests cover authorization before replay, revoked/restored/no-op/stale/cross-scope references and failure rollback. Transport script asserts Profile concurrent CAS/history/no-op/changed-key conflict, Endpoint reference refusal and credential issuance. Compiler tests cover normalization/refusal. Remaining: No complete explicit Transport/Endpoint store traces for native formatter capture, corrupt immutable old revisions, owner/grant/Node/Forward exact lock order and failure after each endpoint/audit write. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 22 | partial | E77, E78, E60 | Covered: B direct fake stores assert key snapshot across ensure/lock awaits with live digest, recovery refusal before decoding, pending/completed decode identity/fault, response evaluation order, separate Forward encodes across awaits, CAS affected rows 0/2 and no history after failed current write. Command ports/real MySQL assert one caller transaction and atomic rollback. Remaining: Raw Forward SELECT predicates/filter ordering/newest25/raw-spec and every quarantine/authorizer read/write SQL branch lack direct adapter assertions. Existing command rollback tests do not independently prove each lower-store query. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 23 | partial | E79, E80, E78, E74, E70, E71, E64 | Covered: HTTP structural fakes assert original actor/scope/key/operation args, body/status/no-store, strict duplicate/unknown-body rejection, cookie/anonymous refusal, scoped operation reads. Owner port and real HTTP scripts exercise mutations, policy/revocation and membership. Remaining: Not every management HTTP method has an independently typed complete structural fake; all inherited NodeApi/nullable/readonly signatures and every machine CSR/rotation error status need explicit contract tests. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 24 | partial | E81, E82, E83, E84, E85, E86, E87, E88 | Covered: Authorized same-Tx query fakes/SELECT-only real MySQL assert scope-before-read, bounded detached paging, exact native grants/reference revisions, non-authorizing metadata, four-peer windows and denial/corrupt rows. Remaining: Full old/new declaration identities and every optional/default HTTP argument are not established; exact callback/conversion clock boundaries need direct traces. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 25 | partial | E89, E90, E91, E92 | Covered: Transit mTLS machine path rejects missing verified TLS, retired boot/revoked credentials/capability spoofing; delivery offline MySQL asserts commit/replay/status/current identity without advancing execution. Relay production HTTP planning is exercised by relay script. Remaining: No dedicated complete structural RelayPlanApi/Transit API substitution test or full route argument/error-precedence matrix. Real Relay reservation-free preview path needs explicit no-write assertion. |
| 26 | partial | E93, E94, E95, E96, E97, E98, E99 | Covered: Path template/binding tests assert closed inputs, scoped manager/grant reads, CAS, quotas, immutable history, shared Forward rollback and SELECT-only impact. Browser scripts exercise template/binding and publication workflows. Remaining: All five Path/Ingress HTTP APIs are not covered by structural fake route tests; IngressGroup resolution/migration/deployment has no dedicated owner MySQL suite. Browser publication coverage is narrower than exhaustive Ingress semantics. |
| 27 | partial | E80, E100, E101, E102, E103, E104, E105, E106, E107, E108 | Covered: HTTP/owner tests check mTLS identity rather than Bearer/header substitutes, detached minimized receipts, owner commit before ACK, spent claims and bounded delivery/status, replay/conflicts/current grants and exact-Tx result rollback; machine/permit real MySQL is covered. Remaining: Typed v2/service v3 qualification/poll/claim/status/result APIs lack full dedicated adapter tests; all eleven independently typed HTTP fakes and staged v4 behavior are not proven. No new Echo acceptance is inferred. |
| 28 | partial | E82, E83, E84, E85, E86, E87, E88 | Covered: SQL-fake tests assert scope before projection, bound scoped count/page filters/literal bounded offsets, candidate/overview gates, count independence and diagnostics sanitized reads. SELECT-only MySQL suites assert real raw projections and unchanged persisted tables. Remaining: Full seven-consumer synchronous callback-after-final-read traces, conversion/getter/error/clock ordering, native iso(undefined) refusal and count-vs-page live-reference changes lack dedicated assertions. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 29 | partial | E25, E26, E8, E27, E28 | Covered: Registry declarations/selection/features/clone and replacement boundaries, native authorizer before bind, shared budgets, drain lifecycle Remaining: Lower generic public method-set compatibility, full nil/zero registry and platform metadata refusal order, native phase partial pointer error matrix |
| 30 | partial | E109, E110 | Covered: New B table checks all five optional telemetry HTTP families via named/positional construction, absence status, admit-before-auth, release on auth/owner errors, cookie/unknown-query refusal and body passthrough. Cancellation identity crosses public ports. Remaining: Owner ingestion replay/delta/history/rollup retention, uint64 overflow/bucket quality, independent family quotas/cooldown, observation-pool refusal and live disabled machine collection are not tested by these HTTP doubles. No telemetry owner-specific tests located in apps/control/test. |
| 31 | partial | E109 | Covered: New B table checks eight remaining optional HTTP families named/positional availability, admission/auth/owner ordering and release/error mapping, and rejects unknown query/cookies before owner calls. Remaining: Diagnostics/audit/station/notification/history/finite-plan/service owner-specific SQL, worker, vault/send/claim/fence/retention/CAS/recovery behavior is untested here; no dedicated suites for those owners located. HTTP doubles cannot establish those semantics. |
| 32 | partial | E29, E30, E18 | Covered: All enrollment failure stages preserve original errors and deferred reply/idle cleanup, configured trust, key-Journal-certificate order and completion only success Remaining: Native CSR/PKCS8/PKI/HTTPS invalid/duplicate/oversized/status/time matrix and file write fault injection |
| 33 | partial | E31, E32, E33 | Covered: Current physical binding/digest/expiry, forbidden DNS/address/policy before dial, revocation/cancel and Gate one-use Remaining: Native service TLS handshake exact cap/partial I/O, SetDeadline failures and multi-defect first errors |
| 34 | partial | E32, E33, E22 | Covered: Legacy nil resolver refusal, one admitted dial, process cooldown survives new Executor, cancellation and Gate 256-id burn Remaining: All4 explicit Effects constructor/default traces, counter epoch/seal/close/overflow and clock-domain boundary assertions |
| 35 | partial | E109, E111, E112 | Covered: Notification read endpoints receive correct actor/scope/ID and opaque owner response under optional-service admission/error boundaries. Worker explicit stores check one owner transaction per claim/preflight/finish, sorted manager authorization and policy->endpoint->outbox locks with callback transaction identity. Failed claim append rolls back row/fence/rate/attempt; failed finish preserves existing claimed fence/pending attempt and defers only once without another sender. Public read excludes reference/authority/destination/signing key. Remaining: No real MySQL statement/retention/eviction/CAS/override suite;16 endpoint/128 audit/256 attempt/1024 outbox quotas, pruning and exact native SQL/parser-order still open. |
| 36 | partial | E113, E103, E109 | Covered: Related publication savepoint tests assert success/known-refusal/unknown-error/fault order; Probe permits test original transaction failures; HTTP covers history/plan admission only. Remaining: Publication savepoint coverage does not cover Probe-plan-specific savepoints or retryable quota exceptions. No run/plan store suites located for history1024/7day/16prune, heads32/decisions16, parser family initialization, override hooks, exact SQL and sticky recovery. |
| 37 | partial | E109, E114 | Covered: Audit query and observation-service list optional HTTP dispatch/auth/admission are checked only. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors Remaining: Per-family raw SQL/node-association/attribution/numeric projection golden cases, complete source/kind/error alias/default/reflection/mutability contracts, all cursor/property/byte-limit/error permutations and physical SQL plan/pool evidence |
| 38 | partial | E83, E109, E115 | Covered: Console Node diagnostics asserts scoped read-only sanitized evidence/no health. Separate Forward diagnostics and station HTTP admission/dispatch has B tests. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick Remaining: Public command replay/CAS/quota/silence/ack sequence, policyCount legacy overrides, pure rules/recovery/episode matrix, storage retention/loss/SQL pruning, diagnostic owner and existing native store row mapping |
| 39 | partial | E116, E117, E109, E118 | Covered: Observation dedicated connection tests assert cancel destroy, failed rollback never returned, delayed pool acquisition cancellation and actual MySQL blocked authorization deadline. HTTP covers telemetry family dispatch only. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero Remaining: Forward/Probe mapped-family provenance/counter matrices; latest/history actual point ordering/digests/deltas/cooldown/rate/clock bounds; adapter SQL/observation pool deadlines/destruction; raw quotas/pruning and real MySQL rollback |
| 40 | partial | E77, E119, E103, E109 | Covered: Request keys/encode timing and non-metadata/native target guards are covered in related Forward/Probe tests; B HTTP covers observation-service availability/auth only. Remaining: Exact observation-service X509/base64/DER/trust/date/EKU/digest/error-order parser cases, cursor framing/UUID point/monotone quota, metadata CAS/history/archive/recovery lack direct assertions. Related guards are not full helper equality. |
| 41 | partial | E106, E105, E104, E109 | Covered: Probe adapters assert receipt identity/freshness and no ACK after failed commit; optional observation HTTP mapping is covered. Remaining: No complete native helper identity/capture/initialization trace; telemetry sample/ACK, cursor/signing hex/key zeroing, diagnostic DER, native UUID/digest and every SQL callback refusal remain untested here. |
| 42 | partial | E120 | Covered: Authored native URL tests establish canonical HTTPS/default-port/path output and exact legacy function identity; refuse alternate schemes, credentials, empty query/hash, control/Unicode/backslash, IP numeric/IPv6 forms, private name families, malformed labels/TLD, and supplied/canonical2048-byte and hostname253 bounds. Remaining: Notification signing/payload digests, Probe plan/run staged Echo bytes and rollup native helper/callback ordering remain uncovered. Tests authored, not functionally executed; this does not prove DNS/sender safety. |
| 43 | partial | E80, E79, E82, E85, E109 | Covered: HTTP tests reject duplicate/oversized/unknown JSON/query and preserve auth/status; console paging validates integer/default/duplicate/injection and scoped filter binding; optional APIs reject unknown query before owner. Remaining: Fatal UTF8 split/read/release failure order and every route limit+1, exact UUID/parser alias identity and all Runtime/Transit/observability native version paths are not covered by these tests. |
| 44 | partial | E119, E121 | Covered: Plan tests enforce exact active published binding, numeric destination, policy/grants, expired/missing source, no SQL writes and preview non-authorization. Remaining: Observation service TLS/Echo resolver native parser alias/captured clock and competing malformed/archive/recovery/digest/window refusal order lacks dedicated tests. |
| 45 | partial | E104, E105, E106, E100, E101 | Covered: Adapters check same input identity/session, one owner call, commit before detached ACK, 250ms freshness/post-commit expiry, no retry and executionEnabled:false. Remaining: Exact native parser function identity, JSON key order and all v2/v3 measurement/service branches/alias capture remain unproven by v1 adapter cases. |
| 46 | partial | E103, E108 | Covered: Permit suite checks budget/actor/plan/instance/machine authorization, consumed single use, across-host replay, current tuple/grants, deadline minima/cooldown, corruption, sticky withdrawals, result digest/replay/history rollback and no new authority. Remaining: Native codec/function alias equality, exact JSON/ISO/fingerprint/challenge/proof byte ordering and all staged v4 helper branches lack direct lower codec assertions. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 47 | partial | E103, E104, E105, E106 | Covered: Malformed binding/session/version/measurement/current authorization and receipt invariants have explicit refusal tests. Remaining: Pure validator alias identity, sorted union/closed-key/error precedence and complete TLS/Echo v3/v4 contexts are not independently tested here. |
| 48 | partial | E102, E122 | Covered: Registration/replacement/replay/revocation/current-evidence validation, resampling after lock, exhaustion, transactional rollback and sticky recovery are tested with direct ports and real MySQL. Remaining: Qualification marker v3/v4 persistence/parser-projection order and all raw SQL/zero-default/null sentinel/alias prototype behaviors require further direct tests. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 49 | partial | E119, E121, E100 | Covered: Current published/intent/machine reads enforce scoped JOIN identity/session/generation/expiry; planner denies metadata/foreign/corrupt/current mismatch and proves SELECT-only. Remaining: Every exact JOIN text/args/lazy JSON/capability filtering/null-default projection and native codec aliases need direct storage comparison. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 50 | partial | E103, E108 | Covered: Permit and withdrawal storage real MySQL exercises atomic claims/budgets/expiry/replay/current grants/sticky revocation, result unique ingestion/conflict and rollback. Remaining: All LIMIT257/UTF8-before-decoder errors, deliberately unchecked v1/v2 versus v4/v3 result order, two separate recovery clock reads and zero-default/prototype override behavior lack direct adapter traces. |
| 51 | partial | E102, E101, E100, E103 | Covered: Instance evidence and machine/session/capability refusals, owner register/revoke/inspect and permit ACK transaction boundaries have tests. Remaining: Qualification v3/v4 optional-marker semantics and all readonly/type-only aliases/init-no-I/O identity are not demonstrated by these runtime tests. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 52 | partial | E106, E103 | Covered: Result adapters and owners assert failed commit no ACK, post-commit freshness and identity/digest replay refusal. Remaining: No direct v4->v3->v2->v1 dispatch/inherited-discriminant/JSON-count/key-order matrix or native codec alias initialization test. No v4 ACK acceptance implied. |
| 53 | partial | E100, E101, E104, E105, E106 | Covered: Negotiation/instance/v1 claim/delivery/result compare returned immutable receipt/status flags, current identity and post-owner clock refusals; null offers/status behavior covered. Remaining: v2 typed and v3 service lazy descriptor callbacks, response key ordering/nullability and exact alias function identity lack full direct cases. |
| 54 | partial | E93, E95 | Covered: Native template parser closed/bounded/ordered/detached, immutable versions, CAS/no-op/archive/quota/reference grants and real transaction rollback are tested. Remaining: Exact terminal-newline hash regex, native parser/limits object identity/mutability, module initialization and every clock/getter/error-order boundary remain unmapped. |
| 55 | partial | E93, E95 | Covered: Real native authorization, concurrent publication CAS/quota, immutable archive/history and SELECT-only scoped query behavior have assertions. Remaining: Legacy subclass prototype overrides, exact count-before-list text/args/null JSON mappings and malformed driver JSON versus business validator timing require direct raw-store tests. No exhaustive pre/post-extraction SQL text/argument/evaluation-order differential or injected failure at every statement has been located; mapped real-MySQL cases prove only their asserted paths. |
| 56 | partial | E94, E96 | Covered: Numeric/DECIMAL sequence and limit-before-write, immutable cap, closed detached selection, same-Tx original Forward/CAS/capacity/provenance/replay, no-op metadata attach and retained history are asserted. Remaining: Full old/new aliases, exact raw SELECT b.*/double-scope/current-at SQL and final zero-arg new Date versus captured Date.now evaluation need direct comparison. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 57 | partial | E99, E94, E96 | Covered: Existing browser batch workflow covers group selection, stale CAS/lost-reply/publication and immutable path binding behavior; binding suite covers owner shared transaction. Remaining: No dedicated PathGroup raw-store suite for count override/revision-only quota,63/64 history, priority restoration, archived reference error order, exact SQL/prototype/static and all CAS/rollback branches. |
| 58 | partial | E113, E99 | Covered: New B savepoint suite checks success result identity, classify-before-rollback/project-after-release, unknown/refused/classifier/projection errors and create/rollback/release faults; classifier status/retryable/error identity/shared mutable Set tested. Browser tests cover publication workflow. Remaining: No full publication store create/count/event override,24-revision/LIMIT20/quota/digest/compensation/CAS/late transaction failure matrix. Browser behavior cannot prove each SQL predicate. |
| 59 | partial | E123 | Covered: Authored explicit-port tests assert manager auth before replay; template grants sorted before write and no-op revalidation; supplied Tx across all collaborators; response persistence failure rolls back head/revision/audit/replay and same-key retry succeeds; historical describe permits archived metadata without live grants but active resolve refuses before template disclosure; returned members preserve requested/input order and distinct ingress/common protocol refusals precede writes. Remaining: Raw MySQL SQL/count/head locking/CAS/quota archived inclusion, complete pagination/archive/error clock boundary and constructor/prototype alias compatibility remain uncovered. Fake transaction rollback is not real-MySQL evidence; run in Actions. |
| 60 | partial | E113 | Covered: Ingress deployment isolation shares tested success/refusal/fault ordering and same supplied SQL transaction object. Remaining: No IngressDeployment create/count/event hooks,64-batch/20-revision/LIMIT16, result association/origin/partial refusal/compensation or full rollback tests. Related Path browser coverage is insufficient. |
| 61 | partial | E113 | Covered: Ingress migration savepoint success, classified refusal and every create/rollback/release/projection failure preserve identity/order. Remaining: No IngressMigration early unequal group guard, sorted diff/apply/remove/restore lineage, same-Tx accepted Forward rollback, quotas/events/operations or raw SQL/CAS/prototype matrix. |
| 62 | partial | E89 | Covered: Real MySQL mTLS negotiation rejects retired boot, credential revocation and capability spoofing, retains contract-only executionEnabled:false; unauthenticated HTTP refuses. Remaining: Competing invalid inputs/raw NULL facts/capability traversal/time/error precedence, no-write exact SQL and direct reader/constructor override/alias identity need separate tests. |
| 63 | partial | E90, E89 | Covered: Delivery preview durable replay, actual mTLS identity, revoked credential/retired boot refusal, accepted+duplicate report and digest/sequence conflict, null poll, no coordinator advancement are asserted in real MySQL. Remaining: Complete delivery fake-reader/encoder/clock traces and all statement-failure/retained-plan/stale-between-transactions branches, exact response key order and legacy async prototype dispatch remain uncovered. |
| 64 | partial | E90 | Covered: Real MySQL tests exact creator/session/fence refusal, concurrent journal single writer, tail-first prepare/activate, verifier rejection, duplicate proof refusal, sealed/null completion and ingress-first recovery compensation; unchanged physical owner/fence is asserted. Remaining: Generation/revision exhaustion, malformed retained JSON/high-water, future/expiry boundaries, failure injected after each write/step/verifier and direct legacy/provider order traces remain. |
| 65 | partial | E91, E124, E68, E125 | Covered: Preparation binds3 nodes/protocols/sessions/pins/fences and tail-first activation, deterministic immutable plan, invalid ownership/generation/credential/capability/CIDR/topology refusals and no active staging SQL. Remaining: Exhaustive competing-invalid first errors, native property/getter/JSON/ISO/hash call ordering and canonical/legacy function identity remain unmapped. |
| 66 | partial | E126, E127, E91 | Covered: Fake SQL tests same-owner/foreign-owner refusal before fence overwrite, fence+1/6locks/3writes; real MySQL proves whole reservation rollback, one concurrent winner, owner retention and monotone fence2 re-acquisition. Malformed logical sets refuse before I/O. Remaining: No direct test post-allocation capacity failure, exact late per-node policy getter timing, malformed raw row count/Number coercion/fence maxima or failure at every lock/assign/count; Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 67 | partial | E124, E90, E127 | Covered: Staging pure immutable journal/refusal and isolated non-executable SQL, reservations rollback/exclusivity and abort refusal once coordination exists are asserted. Remaining: Complete stage/abort owned-slot/all-before-write release traces, lease+5000/Snapshot boundaries, exact-ten-second authority, changed second slot before first release and stage CAS/mid-release rollback are not covered by these narrower tests. |
| 68 | partial | E109, E114 | Covered: AuditEvents/AuditReadModels: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Closed input/invalid identity before wall clock; manager auth before sequential15-source reads; original Tx all calls; two clock samples; immutable read-only/no-execution result; explicit canonical query cursor binding with tail page; duplicate tuple refusal; read/request capacity finally release across store/projection/callback errors Remaining: Per-family raw SQL/node-association/attribution/numeric projection golden cases, complete source/kind/error alias/default/reflection/mutability contracts, all cursor/property/byte-limit/error permutations and physical SQL plan/pool evidence |
| 69 | partial | E109 | Covered: ForwardDiagnostics: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for admission/bounded same-read provenance and diagnostic snapshot/plan/config/session refusal. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 70 | partial | E109, E115 | Covered: StationAlerts: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual StationAlerts.tick due/candidate/auth/Scope-lock/latest/facts/event/handoff/state order in original Tx; revoked manager suspends without facts/event; handoff and state failures rollback event/queue/policy together; separateTx guarded revision/cutoff deferral then ticking reset; latest revision/manager/enabled/suspension/deadline recheck; blocked fact read prevents overlapping tick Remaining: Public command replay/CAS/quota/silence/ack sequence, policyCount legacy overrides, pure rules/recovery/episode matrix, storage retention/loss/SQL pruning, diagnostic owner and existing native store row mapping |
| 71 | partial | E109, E111, E112 | Covered: Notification secret/vault/HTTPS sender: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Native sender test replaces original DNS and HTTPS functions only: cancel with pending DNS or guard retains admission until true completion; close joins drains. HTTP302/503 returns rejected,204 delivered; request error returns unknown; one DNS and one request per send with TLS1.3/rejectUnauthorized/agent:false. Worker acquires exact scope/endpoint/revision/authority secret binding only after claim commit, zeroes passed bytes after result and releases lease only after sender idle. Remaining: Actual FileNotificationSecrets filesystem encryption/exclusive stage/link/read identity/32ref quota/pin pruning and Linux permission/tamper behavior untested by this fake lease. DNS address policy full range, HMAC exact signature, oversized response/overall deadlines/socket-close faults remain uncovered. |
| 72 | partial | E109, E111, E112 | Covered: NotificationDeliveries: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Worker tests verify claim commit-before-acquire/send, current dispatch manager reauthorization (revoked manager yields cancellation), missing lease yields nonnetwork credential refusal, unknown result preserves unknown and persisted30s retry-wait rather than immediate resend. Claim and finish failures roll back their transactions with retained fence; worker ticks coalesce and close waits actual idle then lease release. Read output contains no credentials/destinations/authority references. Remaining: No exhaustive6-attempt/expiry/rate/capacity/recovery/silence/changed policy or endpoint/history/query/cursor/loss state matrix, actual MySQL or full enqueue handoff. |
| 73 | partial | E109 | Covered: ProbeRunHistoryRecorder/ProbeRuns: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for same-Tx capture/immutable result/retention/eviction/loss/corruption and bounded historical queries. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 74 | partial | E109 | Covered: ProbePlans: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for creator delegation/current preview/CAS/replay/run/stop/recovery/default-off scheduling and original issuer/no deadline renewal. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 75 | partial | E109, E118 | Covered: NodeTelemetry/HostTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Actual independent NodeTelemetry and HostTelemetry public ingest/history: disabled/parser refusal before effects; credential before Node/head; revoked/expired/superseded before head; append->real process/host projection->rollup->ACK same Tx; raw/head/rollup rollback on callback failure then same-node admission released; exact replay returns original receivedAt without append or rollup; changed body/epoch/nonadvancing uptime refusal; history Scope first and no execution health; 4 request slots drain/finally; unavailable CPU/host metrics omitted not zero Remaining: Forward/Probe mapped-family provenance/counter matrices; latest/history actual point ordering/digests/deltas/cooldown/rate/clock bounds; adapter SQL/observation pool deadlines/destruction; raw quotas/pruning and real MySQL rollback |
| 76 | partial | E109 | Covered: ForwardTelemetry/ProbeTelemetry: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for current assignment/direct TCP/current instance/provenance and counter/reset/gap/history/rollup semantics. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 77 | partial | E109, E118, E128 | Covered: TelemetryRollups: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Node/Host ingestion calls original public real processObservation/hostObservation and same-Tx recorder; unsupported Host yields empty metric maps unavailable; absent process CPU omitted; recorder failure rolls back raw head and observation together Public fold and real processObservation; uint64-max gauge wide sum beyond64bit, exact9 counter increment near uint64 max, immutable prior bucket; receipt-end minute/hour boundary and monotonic elapsed rather than receipt delta; missing metrics omitted; sequence/drop/truncation gap, sequence/counter rollback reset, overflow before terminal, no interval/increments on noncontinuous; cross-bucket/cross-scope reuse refusal Remaining: TelemetryRollups public query/capacity and real rollup storage cursor/bucket/loss atomicity; complete Host CPU/context/missing and Forward/Probe conservation matrices; quotas/pruning/128-bit maximum and real MySQL equivalence |
| 78 | partial | E109 | Covered: ObservationServices: only optional HTTP availability/admission/auth/dispatch/error/release boundaries are covered by new B doubles. Remaining: No dedicated owner behavioral suite located for config/TLS/Echo parser/window/pin/CAS/archive/immutable digest metadata and no-live-health projection. SQL/default-native/worker/private callback and zero-argument/prototype aliases remain uncovered; HTTP tests cannot substitute for them. |
| 79 | partial | E102, E122, E101, E100 | Covered: Direct owner tests assert immutable registration and non-renewing replay, generation CAS/revocation/capability withdrawal/time resample/current-evidence and rollback. Real MySQL covers concurrent replacements/recovery; registry covers native machine dispatch/ACK. Remaining: Exact every dynamic Date.now call, qualification fields v3/v4, complete old/native constructor/function/type identity require additional evidence. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 80 | partial | E103, E102 | Covered: Current v1 instance identity/capability/expiry is tested; no v2/v3 qualification evidence located. Remaining: No dedicated ProbeTypeRegistry/ProbeServiceRegistry qualification suites for two-vs-three measurements, servicesVersion spread/proof marker, equal-generation mismatches and v2 eager-v3 lazy ACK clock/error precedence. |
| 81 | partial | E119, E121, E80, E103 | Covered: Plan preflight validates detached closed input, same-Tx manager+grant auth, active assignment/current binding, metadata refusal and no writes; permit owner/HTTP issuance replay/current checks covered. Remaining: Service resolver TLS/Echo context/digest clock chain, finite-plan notAfter and all five preview-vs-three issue kind distinctions need direct dedicated cases; no staged Echo enablement inferred. |
| 82 | partial | E32, E33 | Covered: Numeric endpoint/security refusal before dial, no application bytes, one attempt, provenance, replay/cancellation/global cooldown Remaining: Echo256/257/TCP framing and context JSON/time/error order, fresh dialer and all native constructor traces |
| 83 | partial | E8, E34, E17 | Covered: Persistence before bind/prepare, offline no replay, activation only after real peer proof Remaining: Exact Hello/report bytes and ignored marshal errors, strict ACK vs pending partial decode, full replacement/partial-start stop order |
| 84 | partial | E26, E25 | Covered: Native catalog metadata equals builtins, direct/relay/multihop capability ordered list and feature gates, duplicate/missing hook refusal Remaining: All zero registry paths, callback nonexecution and multi-defect private precheck first errors |
| 85 | partial | E82, E83, E84 | Covered: Paging/filters before reads, candidate management/auth-before-SQL, scoped count/page/overview, bounded diagnostic sanitized no-health and actual SELECT-only composition are asserted. Remaining: Exact callback conversion order/time source/new Date defaults,50-failure cap, mutable alias object and zero-default prototype behavior remain. Exact old/public alias, constructor arity/prototype/subclass dispatch and all declaration-level readonly/generic/default identities are not established by these behavioral tests; merge with the separate asset/alias evidence. |
| 86 | partial | E103, E108 | Covered: Extensive direct port+MySQL assertions cover budget/current evidence/claim/revoke/inspect/result/withdrawal replay, minimum expiry, corrupted histories and failed commit rollback. Remaining: Full ordered clock/JSON/codec call trace, every256/four-active actor/Node edge, private alias/default constructors and all staged v4 branches remain unmapped. |
| 87 | partial | E104, E105, E106 | Covered: Commit-before-ACK, one owner call, exact Node/session input, post-commit freshness/staleness/malformed receipt, detached output and no Bearer substitute have tests. Remaining: Exact helper alias/key order/default captured-vs-dynamic native clock and all max Date/future boundaries remain outside those assertions. |
| 88 | partial | E103 | Covered: Only underlying v1 permit owner current binding and instance checks are exercised; no v2/v3 adapter evidence located. Remaining: No dedicated ProbeTypes/ProbeServices adapter poll/claim/status/result suite for version-specific descriptor lazy callbacks, service selection before identity, exact time caps and committed-late ACK handling. |
| 89 | partial | E81, E79 | Covered: One supplied authorized transaction, provider errors/no projections after denial, detached query and operation JSON null/Boolean/unknown fields with Forward ID are asserted. Remaining: Exact frozen feature copy/new-return-copy and all Forward->status->operation->metadata call sequences/default alias identities need direct cases. |
| 90 | partial | E85, E86 | Covered: Scoped metadata-before-resolver/reference, granted exact revision, no-authority/immutable proposed spec, mutated caller input and corrupt persisted reference rejection are asserted in ports/SELECT-only MySQL. Remaining: Exact raw callback conversion and final zero-arg new Date clock/alias identity/loading traces remain. |
| 91 | partial | E87, E88 | Covered: Same-Tx auth, bounded peer windows/current/revoked/expired/null endpoint, exact desired adjacency and malformed/cross-scope rows; real SELECT-only MySQL unchanged tables are asserted. Remaining: Native clock capture/single sample/conversion getter ordering and full old mixed entry identities need direct traces. |
| 92 | partial | E74, E60, E64 | Covered: Owner-authorized one-Tx changes/replay/no-op/current records, token hash/detached snapshots/cross-scope refusal, effects and full response rollback are explicit; real MySQL proves whole member and Node grant rollback. Remaining: Constructor arity/type alias/default identity and exact SHA frame/time/ISO truthy zero-vs-negative max bounds remain unproven. |
| 93 | partial | E70, E60, E71 | Covered: Management validates immutable policy before await, current-manager replay gate, original authorizer reconciliation, whole-Node revoke no capacity veto, audit/response failure whole rollback and revoked credentials. Remaining: Exact every request-digest field/evaluation order, native ISO truthy cutoff and legacy/prototype/type identity need direct tests. |
| 94 | partial | E85, E86 | Covered: Catalog current scope and flags/default control-enabled distinctions remain separate from Node proof/authorization/platform acceptance; real MySQL contract included. Remaining: Native catalog nested object identity, constructor flag getter timing and all descriptor function aliases/loading remain outside behavioral assertions. |
| 95 | partial | E97, E93, E95, E94, E96 | Covered: Native tunnel browser workflow and original Path/Forward transactional owner tests cover actual authoring/binding contracts. Remaining: No direct NativeTunnels six-forward-method receiver/result identity, constructor collaborator order/single management object and topology-spread-specific tests. |
| 96 | partial | E25 | Covered: Missing/duplicate declarations and hooks refuse, caller mutation cannot alter registry, capability clones and feature combinations Remaining: Simultaneous defective metadata/callback/duplicate first-error exact strings, strict registry validation-last trace |
| 97 | partial | E35, E36 | Covered: Echo endpoint numeric/mapped/zone/hostname/address/port/protocol/CIDR/metadata boundaries and unchanged permitted loopback; context decode refusal still samples owner Now Remaining: Business/current-instance callback and lock traces with complete valid Echo context; multi-defect ordering beyond boolean leaves |
| 98 | partial | E76, E60 | Covered: Changed-only grant reconciliation/no-op/replay owner gates, original resource lease retention, current authorization/capacity and response failure real-MySQL rollback are explicit. Remaining: Exact native digest frame/property reads and old constructor/type/default identities need direct tests. |
| 99 | partial | E78, E60, E94, E96 | Covered: Direct/Relay create/update/remove/retry preparation/owner writes/capacity/receipt transaction order, replay authorization, CAS/no-op and injected failures are asserted; real MySQL validates atomic rollback/history and retained resources. Remaining: All path/group/ingress/publication variants and complete old aliases/method checks/default capture are not proven by ordinary Forward command cases. |
| 100 | partial | E94, E96, E78, E99 | Covered: Path bindings and browser group/publication cover shared Forward CAS/provenance/idempotency, no-op attach, retained historical binding and late failure rollback. Remaining: Ingress deployment/migration restoration/compensation and optional resolveCreateIn fallback paths have no full direct owner suite; batch browser flow cannot prove every same-Tx subcommand/provider branch. |
| 101 | partial | E78, E60, E79 | Covered: Retry ports assert reference->current Forward before locked source, reauthorization/recovery/stale/status refusal, source identity and unchanged intent; real MySQL response failure restores operation/deployment/idempotency; HTTP exact key/actor/scope/CAS. Remaining: Every competing-invalid first-error combination and exact previous_spec/source alias identity not independently mapped. |
| 102 | partial | E116, E117, E110 | Covered: Extensive direct and real MySQL passive observation assertions cover input/provenance/expiry/no-health, actor/Node/global admission/cooldown, cancellation retains capacity until work stops, dedicated connection destroy/rollback/pool race and real blocked auth deadline. Remaining: Exact all dynamic timer/native controller/getter invocation order and each report note/conversion byte-boundary remain unmapped; no physical/live-health claim. |
| 103 | partial | E67, E66, E92 | Covered: Native Relay compiler/refusal/immutable prepared binding and production HTTP Relay path used by scenario script. Remaining: No dedicated RelayPlans structural fake verifies parse-before-Tx/manage/error/preview-ID/forced-enabled and exact required provider receiver/result union. |
| 104 | partial | E22, E19, E20, E21 | Covered: 4096/32768 boundary+1 reads, reader original error, partial error Code, claim burned through HTTP failures/cancel and no retry Remaining: All versions actual request double-encode/Parse+Check order, mutex late close, invalid paths before providers |
| 105 | partial | E24, E37 | Covered: Result provenance/quantization/uncertainty refusal, strict shared result fixtures/digest/typed echo Remaining: Dedicated v2/v3/v4 native projection golden bytes and service/TLS/echo error and Now order |
| 106 | partial | E109, E80, E79, E129, E130, E104, E106 | Covered: HTTP scope/key/strict JSON/cookie/status, optional service named/positional middleware order and fixed console security asset serving are asserted; mTLS refuses Bearer/claimed fields. Remaining: Fatal UTF8/chunk-release/read failure/limit+1 on every route, exact native TLS fingerprint refusal order and telemetry machine-lookup bypass need dedicated native HTTP helper cases. |
| 107 | partial | E93, E95, E94, E96, E99 | Covered: Native template/binding owner ports+real MySQL test CAS/quota/archive/replay/immutable history/grants/shared Forward rollback; browser covers batch interactions. Remaining: Complete PathGroup/Publication raw stores, prototypes, every preview/apply/compensate/cancel alias branch and source-specific limits/digest evaluation remain partial. |
| 108 | partial | E113 | Covered: All three publication/deployment/migration store savepoint boundaries and refusal classification have new direct fake SQL tests. Remaining: Complete IngressGroup/Deployment/Migration owners/routes/raw query/CAS/history/compensation need suites; savepoint isolation alone is a narrow subset. |
| 109 | partial | E22, E38, E19, E39 | Covered: Exactly32-byte entropy including short read, both qualification timestamps parsed, negotiation nonauthority, claim burn and current gate Remaining: v2/v3/v4 projection byte/descriptor fields and native service context construction/clock stages |
| 110 | partial | E22, E13, E14, E8 | Covered: Machine request exact public fields excludes private key, expiry before renewal errors and omission, durable renewal retry and snapshot persistence Remaining: Golden drain/report UTC/nil/zero/map bytes, Snapshot invalid validity before issued, exact provider Now sample counts |
| 111 | partial | E24, E21, E37 | Covered: Report once, ACK failure burns and cannot retry, safe uncertainty/rounding/deadline serialization Remaining: All4 result ACK families golden stages, v2/v3/v4 status twice-encode golden bytes and final clock order |
| 112 | partial | E40, E36 | Covered: Nil/empty protocols differ, detached equality and changed protocol/challenge refuse; typed context encode then same parse error; both dates parse; owner decode error still samples Now and parent nil equality Remaining: Successful complete typed Echo context golden vectors and full product current-instance/check/deadline integration |
| 113 | partial | E82, E85, E87, E93 | Covered: Native public query parsing preserves closed bounded fields, duplicate/unknown and canonical paging/ref filters with validated callback inputs. Remaining: Every old/public query alias function identity/init graph and all optional observability cursor/default query helpers not covered by these cases. |
| 114 | partial | E22, E14 | Covered: Shared and legacy time parses return raw RFC3339Nano values/errors for fraction/offset/zero/invalid, both qualification parses, Relay first mapped errors Remaining: Hello/Guard setup/parse stage, Snapshot validity first, post-provider expiry and conditional Now count/overlap traces |
| 115 | partial | E78, E60, E62 | Covered: Native Forward command preparation asserts Direct compile before and after reservation, sorted Relay authorization, ingress move revoked/recovery guard, retry/capacity/same-Tx rollback and immutable input. Static assignment registry validates source ownership/driver roles. Remaining: No dedicated Forward execution-adapter registry/factory suite for six-method order, fifth default argument evaluation, bound receiver/catalog duplicate/refusal/error order; command tests cover selected actual adapter paths. |
| 116 | partial | E74, E76, E70, E60 | Covered: Member/Profile/Node reconciliation same-Tx/current authorizer/sorted references, disabled/no-op choices, withdrawal with retained leases and late failure rollback are asserted with ports+real MySQL. Remaining: Exact constructor/default/native aliases and every callback evaluation/getter order require separate identity/type/provider evidence. |
| 117 | partial | E70, E74 | Covered: Canonical Node management/grant behavioral input/output/cutoff/rollback tested through explicit effects. Remaining: Complete readonly/mutable public declaration and legacy type export identity is type/static coverage, not established by these tests. |
| 118 | partial | E62, E60 | Covered: Deterministic source ID execution, constructor snapshot capture/no reads, same-Tx callback/ownership/foreign roles/duplicate physical slots, full merge failure and real MySQL publication/capacity rollback are explicit. Remaining: Exact old/public source class alias/loading and every callback clock field/default constructor signature need separate compatibility evidence. |
| 119 | partial | E148, E147, E60 | Covered: Missing clock/time methods refuse before samples/effects; host state/claim/report/authority order and pure deadline boundaries are directly asserted. Remaining: Native/custom codec receiver failures and all NaN/infinity/zero/fraction/offset/error/short-circuit sample combinations, including every captured legacy default, are not exhaustive. |
| 120 | partial | E62, E90, E89, E126 | Covered: Runtime Snapshot callback receiver and supplied transaction, Transit native wrapper operations/persistence and reservation same-Tx/no-reset behavior covered. Remaining: Runtime query/telemetry and Transit resolver complete type alias/generic mutable shapes, module-time/per-call/retained native service lifetime and constructor/default capture/static recovery identity need additional type/direct trace evidence. |
| 121 | partial | E154 | Covered: Explicit effects prove no overlap, first-tick scheduling, repeated start/close, active/onStop joins, one cancellation, completion-time backoff thresholds/cap/reset and sanitized all-settled shutdown. Remaining: Native default function lookup, all registration/error precedence cases, count16 overflow and cancellation-throw retry, plus complete partial HTTPS startup/shutdown order remain uncovered. |
| 122 | partial | E65, E148, E70, E60 | Covered: Ledger early capacity sample/claim/deadline/drain/complete boundaries, Host compile/publication and existing Node/multihop transactional paths are asserted. Remaining: Complete Ledger/Relay/Node invalid-time guards, constructor precedence/native receivers and provision-format-after-commit versus credential-format-before-commit fault matrix remain partial. |
| 123 | partial | E133, E134, E109 | Covered: Exact Error/helpers/lifecycle alias identity and failure-path drain, port-only preview authorization/Tx, HTTP failure release and closed-input behavior are asserted. Remaining: Socket disconnect drain and complete source-text/augmentation compatibility remain unproven; Current source/type/private import graph and existing compiled callers are checked by typecheck and check-boundaries; this does not prove every declaration-augmentation/reflection, default lifetime, getter or historical consumer case. |
| 124 | partial | E133, E135, E148 | Covered: DEFAULT_POLICY old/new object identity, frozen state and thirteen ordered keys plus host required-method refusal are tested; real compiled callers retain the Policy source. Remaining: No exhaustive declaration augmentation or all constructor copy/validation/clock getter combinations. Current source/type/private import graph and existing compiled callers are checked by typecheck and check-boundaries; this does not prove every declaration-augmentation/reflection, default lifetime, getter or historical consumer case. |
| 125 | partial | E81, E87, E83 | Covered: Read models keep non-authorizing/null/unknown diagnostics and mutable API response projections through explicit ports. Remaining: Full Observation/Drain/Condition declaration required/mutable fields and canonical native alias identities are type compatibility work; runtime cases do not prove complete shapes. |
| 126 | partial | E66, E68, E60 | Covered: Native plan views consumed through actual compiler/Relay paths preserve sessions/pins/fences and deterministic immutable plan output, stale-generation isolation and rollback. Remaining: FR0007 required time->view guards before option getters and raw config/hop references with malformed/getter/throwing inputs lack direct RelayHost fake views. Exact conditional peer Now/skew samples and first-error nested traversal still unproven. |
| 127 | partial | E66, E91 | Covered: Native prepared execution value records and nested resource/pin/session/phase data validated through compiler strict parsing. Remaining: Complete common execution value declaration/generic aliases/canonical native method sets and direct JSON distinction need contract/static evidence. |
| 128 | partial | E148 | Covered: Required machine methods refuse before clock/policy/provider calls; protocol/foreign identity/capability order, boot history, publication, replay ACK/fencing and failure rollback are directly asserted. Remaining: All native getter/includes/receiver/error-text and allocation-before-integrity edge cases require additional vectors. |
| 129 | partial | E62, E60, E66, E78, E107 | Covered: Actual native compiler/Snapshot/Forward/source/Probe/HTTP integration tested through explicit callbacks/real MySQL; current session/config/fence/current-auth and transaction rollback covered. Remaining: Every native specialization constructor/default capture, generic type correlation/old alias, function identity/module initialization/getter sorting and full SQL trace remains incomplete. Behavioral integration is narrower than exhaustive specialization compatibility. |
| 130 | partial | E85, E66, E91 | Covered: Explicit native Profile revision/digest and Relay/Transit compiler consumers have assertions. Remaining: FR0009 opaque Profile default versus native family declaration/generic structural compatibility requires type tests; these runtime paths are not full public semantic equivalence. |
| 131 | partial | E66, E67, E91, E72 | Covered: Profile parse/native config/no-op/CAS and compiler digest/resource/Relay/Multihop/Transit config bindings are exercised. Remaining: Complete native Profile JSON/digest/key getter/freeze/error-point equivalence and typed generic consumers lack direct pure contract cases. |
| 132 | partial | E72 | Covered: Production Transport Profile commands and grants use formatter in real HTTP/MySQL flows. Remaining: Missing required formatter construction refusal before any provider effects and explicit formatter output/failure call ordering have no direct host tests. |
| 133 | partial | E71, E72 | Covered: Production machine/Relay credential rotations/replays/current-only/overlap bounds are covered end-to-end. Remaining: Constructor overlap/lifetime->formatter->four codecs prerequisite ordering and malformed provider rejection before effects lack direct explicit host tests. |
| 134 | partial | E71, E72, E70 | Covered: Machine/Relay concurrent replay changed CSR rejection, credential overlap and policy/management transactional errors are checked. Remaining: Native enrollment expiry/sign/post-sign/ordered token digest/sign errors and complete codec aliases/private handler semantics still need direct tests. |
| 135 | partial | E109, E79, E80 | Covered: Named and exact positional optional service wiring exercise original createControlApp/createApp behavior, HTTP auth/error/owner dispatch and request body status. Remaining: Hono generic Bindings/Variables/result types and every aggregate type signature/legacy reexport remain declaration/static compatibility coverage. |
| 136 | partial | E104, E105, E106, E89 | Covered: Actual mTLS machine paths refuse unauthenticated Bearer/fingerprint/session header substitution. Remaining: Exact session header empty/zero/sign/space/decimal/overflow grammar and native body reader chunk/limit/error cases lack direct helper tests. |
| 137 | partial | E109, E80, E79, E129 | Covered: Original routes status/body/header, optional admission-before-auth, cookie/duplicate/unknown/oversized and owner failure dispatch are asserted. Remaining: Full every route registration path/body limit/error precedence, native TLS failure fields and support all query/response versions remain outside these selected tests. |
| 138 | partial | E5, E6, E7 | Covered: Pure custom protocol/raw bytes, nil providers no effects, full stale metadata, extension before supports, equal lazy decode, lock/load/input/save/unlock error identities Remaining: Native codec complete field-by-field projection and typed/generic method-set compatibility remain unasserted; pure host now tests all8 immutable identity/config/address/protocol fields |
| 139 | partial | E6, E7, E11, E12, E8 | Covered: PhysicalTCP Journal for UDP, protected history reset refusal, tampered inspector no writes, imported highwater, persist before first bind Remaining: Canonical slot/drain golden bytes uint64 extremes, duplicate/lost/stale ACK tail and pending state matrix |
| 140 | partial | E30, E16, E17 | Covered: Feature/inspection refusal before effects, nil providers before bootstrap, unnegotiated offline Transit refusal Remaining: Native URL literal-case/malformed vectors, GET uint64 path and httpError identity/headers/retry matrix |
| 141 | partial | E41 | Covered: Lower/native identity differs and lower tagless, nil/empty/invalid raw len/cap/backing, maps/extension pointer identity, zero and nonzero metadata roundtrip Remaining: Compile-only Bootstrap/provider interface2 exact method-set signatures not separately asserted |
| 142 | partial | E41, E42, E6, E11, E12, E15 | Covered: Native Runtime JSON order/null/empty/invalid, authenticated persistence/MAC refusal, imported highwater, inspect readonly, protected Relay native record Remaining: Exact historical MAC envelope golden bytes and all strict outer-inner first-error mutations |
| 143 | partial | E5, E6, E8, E17 | Covered: Host failure sequence returns unchanged authority, raw references, native write failure highwater, Runner persist before bind Remaining: Single-projection counts and complete bootstrap proof/credential/client order, native-wrapper identical error identity every failure |
| 144 | partial | E43, E17 | Covered: Prepared Transit requires explicit authorizer and independent grant/identity, offline bridge refusal Remaining: Constructor all missing argument ordering, no Now samples, copies and typed nil/non-nil partial engine cleanup contracts |
| 145 | partial | E17, E43 | Covered: Offline Journal persisted before engine, no replay, forged grant/binding fails, prepared authorization Remaining: Exact controller parse/date/auth/reserve/final-auth order and Prepare/Activate partial/nil failure cleanup every phase |
| 146 | partial | E17, E7, E43, E44 | Covered: Offline no replay and saved highwater, missing execution auth, forged grant refused, native mutual TLS identity/purpose/pin expiry Remaining: Explicit peer-chain len!=1 precedence vector and Prepare/Activate failure durability mutation cases |
| 147 | partial | E45, E36 | Covered: Native Host alias vs tagless lower identity, Provider2 native method-set compilation, absent CPU null and nil/empty interfaces preserved; embedded Forward snapshot promoted fields and flattened JSON Remaining: Every telemetry DTO field/order/type/pointer and arbitrary generic Host provider no-extra-read conversion assertions |
| 148 | partial | E24 | Covered: Probe result serialization preserves rounding/provenance/safe expiry and rejects uncertain altered evidence Remaining: Four telemetry sample/ACK JSON golden vectors, rejectedPoints stages, zero/offset timestamp distinctions and local sort cursor |
| 149 | partial | E21, E24, E23 | Covered: Report burn-once/cancel drain and no retries, late transport cannot revive, aggregate final diagnostics Remaining: Telemetry encode-timeout-post-read4097-ACK-cancel exact order, pools/entropy/ticks/host pending and CounterSet freeze/tail lifecycle |
| 150 | partial | E30, E18, E16 | Covered: All statechanging inspection flags refused before native effects, Relay/paired proof permitted, missing providers no native fallback Remaining: Global flag order/help/default/parser and duplicate registration behavior golden comparison |
| 151 | partial | E30, E29, E11 | Covered: Inspection routes only resolve/inspect, token timing, enroll protected refusal/partial writes/cleanup, MAC tampering readonly Remaining: Native Abs/Rel/path predicate first-error vectors, stdout encoder errors and exactly32-byte proof key masking |
| 152 | partial | E18, E8 | Covered: Lock/boot/constructor/run failure releases once, Runner options sampled subset, constructor before signals, same run error Remaining: Native16-byte BootID short entropy count, all options/defaults, real signal context cancellation and Control plan command stdout |
| 153 | partial | E155 | Covered: Raw status adapter exact SELECT strings/argument order and supplied Tx; report-before-current decode and second current decode; malformed report/current first errors and absent/zero paths. Remaining: Complete malformed/undefined report epoch and all optional query/error precedence vectors are not exhaustively asserted. |
| 154 | partial | E155, E60 | Covered: Tuple generation/fence matching, applied spread fields, earliest freshness/cutoff, exact expiry and wrong epoch/missing evidence, permissive decode failure order are asserted. Remaining: Path recursion/subclass dispatch, every truthy0/NaN/invalid-time combination and aggregation ordering need more direct cases. |
| 155 | partial | E155, E156, E149 | Covered: Supplied-Tx status SELECTs and original lazy decoding are directly tested; old wrapper aliases/current composition compile and migrations are exercised by MySQL CI. Remaining: Full UoW uncertain-commit/retry/release and migration advisory-lock/partial DDL/marker/unlock/close failure sequence still need direct fault tests. |
| 156 | partial | E71, E72, E131 | Covered: Actual startControl configuration/feature flags used by real HTTP/Agent acceptance scripts with fail-closed feature defaults. Remaining: Control startup structural option substitutability/env getter/default/captured policy order, failure/partial-start/shutdown resource ownership not directly tested. |
| 157 | partial | E64, E71, E72 | Covered: Real client CLI member/grant/policy/Profile/endpoint command outputs compare to HTTP native responses. Remaining: Opaque Url/Bytes generic client provider all command/argument/default/body/header/TLS/time/status/cleanup/error ordering lacks dedicated fake-provider suite. |
| 158 | partial | E46, E47, E44, E48, E27, E28 | Covered: Actual multihop TCP/UDP TLS and association lifecycle, same shared Node budgets, drain/hard cutoff, half close, target policy and frame bounds Remaining: Immutable multihop synthetic assignment error-stage table, payloadstats native snapshot alias/atomic overflow/epoch failure |
| 159 | partial | E157, E71, E75 | Covered: Actual server composition is exercised by lifecycle/security/restore scenarios including maintenance/read-only refusal, trusted authority and restart. Remaining: No direct fake server preflight/bootstrap SQL/getter repeated-read/partial HTTPS startup/individual dependency-close sequence suite. |
| 160 | partial | E49, E50, E51, E52, E53, E54, E55, E56, E57, E58, E37 | Covered: Shared protocol positive/negative fixtures, schema matches repository, bounded/IJSON/JCS/time and typed bypass refusal Remaining: Per-package lazy sync.Once sticky compile errors, codec alias method sets, validator CLI and standalone responder all native lifecycle cases |
| 161 | partial | E109, E111, E112 | Covered: Only HTTP telemetry/Station availability/admission/dispatch is covered by new B test. The notification outbox claim/attempt/finish portions now have explicit transaction fault and ordering assertions, including late outcome failure preserving original claimed fence and no hidden sender retry. Remaining: This does not test FR0017 telemetry10 raw writes, Station event-before-outbox enqueue, notification insert duplicate/history/eviction/loss or exact SQL/native callback mappings; those remain separate. |
| 162 | partial | E113, E99 | Covered: Publication isolated item failure/success ordering and browser publication behavior available. Remaining: Exact Path/Ingress event-before-invalidation SQL statements/arguments and every history/provenance/current pointer mutation order has no direct adapter test. |
| 163 | partial | E158, E65, E75 | Covered: All quarantine owner callbacks, immediate accounts, shared publication timestamp, lazy trust and event encoding order plus fail-stop at each owner; actual recovery quarantines DB owners and preserves Agent journal. Remaining: Static legacy wrapper/default clock receiver traces and all UoW uncertain commit outcomes remain separate. |
| 164 | partial | E159, E75, E160 | Covered: Output protection/recheck, metadata/binding, exclusive dump/sync, independent authority recheck/lease bound and signed manifest-last; failures close DB without accepted manifest. Remaining: Native filesystem symlink/ancestor/vault and process args/env/getter/stdio/close fault matrix is not complete. |
| 165 | partial | E159, E75 | Covered: Issuer stop, tampered SQL and exact historical lease boundary refuse before fresh target; restore order, partial target/migrate failure, committed quarantine versus later credential/rebind failure are distinct. Remaining: All native SQL-name/hash coercion, trusted-time process/parser/skew/output and child pipeline failure/close precedence combinations remain unproved. |
| 166 | partial | E159, E75, E156 | Covered: One original DB transaction commits quarantine before binding/credentials/rebind; target DB finally precedes source close; errors retain committed versus rollback distinction. Legacy imports compile. Remaining: Native Authority reflection/identity and complete shell child-process error/unknown commit matrix are not exhaustively exercised. |
| 167 | partial | E146, E161 | Covered: Schema/reader ceilings, closed plan parsing, immutable history/refusal and compatible-versus-runtimeReady/productionApproved distinctions are asserted by static and SELECT-only MySQL cases. Remaining: Exhaustive exact public source/type aliases and all report key-order/counter/Journal combinations still need compatibility assertions. |
| 168 | partial | E146, E161 | Covered: Migration footprint/hash/partial DDL/unknown history and actual read-only database/Authority/journal preservation are asserted. Remaining: Native bounded-read stat/read/finally/UTF8 maximum and every read-only timeout/close/race/rollback error boundary remain partial. |
| 169 | partial | E161 | Covered: Real assessment verifies SELECT-only database, authenticated journals, protected Authority stability, unsafe restore and partial DDL refusal without mutation. Remaining: Exact fake plan/catalog/Authority-before/CA/open/inspect/Authority-after/report/end getter and exception order have no direct injection surface/test. |
| 170 | partial | E146 | Covered: Public CLI dispatch is asserted read-only and never constructs/mutates Authority for assessment; original operators compile. Remaining: Full argv/env/getter order for every maintenance/backup/restore/unknown branch and postcommit failure still need operator effect fakes. |
| 171 | partial | E146 | Covered: Assessment decision exit codes and read-only public dispatch/source ownership are asserted. Remaining: Complete output serialization/usage/whitelist/redaction/outer non-Error failure and release verifier fifteen-gate invocation sequence are not directly tested. |
| 172 | partial | E135, E133, E132 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Compare exact public/legacy ControlError, invalid, notFound and RequestLifecycle object identities. Compare root/shared/legacy-adp2 DEFAULT_POLICY object identity, frozen state and thirteen keys. Blocked application failure holds drain until final completion, preserves the original error and rejects admission after stop. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Source entry imports and native policy identity do not establish all precise L1/L2 negative import cases, native generic/type aliases or ADP2-after-live-ADP3 refusal. |
| 173 | partial | E135 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: Schema/entry staging is narrow; full recursive production asset/default/parser/JCS/time initialization and handwritten telemetry/spec behavior, generated declarations, ops consumers and actual image distribution remain. |
| 174 | partial | E16 | Covered: All9 missing Providers/Effects/LocalServices rejected before invalid config/bootstrap, exact error strings Remaining: Canonical field/order/type reflective aliases, old constructors partial fixture fallback and zero time/IO/entropy constructor counts |
| 175 | partial | E39, E31, E33 | Covered: Registration/current identity/Guard and foreign instance refusal, exact current physical binding, Gate close/replay Remaining: Echo->Services->Ingress->base native factory selection trace, fresh Dialer and nil/constructor precedence |
| 176 | partial | E36 | Covered: One Now for every current/terminal and available/unavailable point, current UTC vs terminal original offset, max uint64 decimal/epoch/overflow pointers and unavailable null values Remaining: Zero native Now at real Runner assembly, live CounterSet/frozen-tail callsite lifecycle, loss saturation/cursor/retention/page/close integration |
| 177 | partial | E132 | Covered: Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Need complete protected Core surface/behavior/private subpath cases plus full TS/JS/Go/type/native/unclassified/asset boundary mutation acceptance on candidate. |
| 178 | partial | E133 | Covered: Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Remaining: Native argv slice and actual Identity(db).bootstrap transaction/validation behavior need their native consumer and owner regressions; these injected tests prove command ordering and failure semantics. |
| 179 | partial | E136, E137 | Covered: Legacy model exports exercise scope/ports/CIDR rejection, capability/listener/protocol gates, canonical BOTH spec, bounded query encoding and candidate retention. These tests do not assert getter/clock/conversion evaluation ordering. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Remaining: Pure aliases, detached native form behavior, guard/effect ordering and double credential getter including invalid parse are mapped. Exact Date.parse property lookup replacement race, all coercion getter first-error cases and query filter primitive conversions remain. |
| 180 | partial | E130 | Covered: Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: Real source route graph parity is covered; actual matching-image/browser import execution and repeated filesystem read failures remain. |
| 181 | partial | E138 | Covered: Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Remaining: Canonical tests cover lazy construction/disconnected scope short circuit and decode/stale/abort/status order; exact successful scope/token/version getter capture, malformed result/native default exception behavior remain. |
| 182 | partial | E138 | Covered: Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Remaining: Native framing/AbortSignal/status and mutation-key behavior are asserted. Exact direct returned Promise identity, two serializations under getters, native timeout defaults and every concurrent outcome are not claimed by these tests. |
| 183 | partial | E130, E139 | Covered: Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: Source asset routes are covered; full factory no-eager-effects, all 24 initializer/DOM callbacks, lazy state/version initialization and secret/pending/dialog/reset behavior require canonical app VM acceptance. |
| 184 | partial | E140, E130, E139 | Covered: Legacy Relay helpers validate bounded Profile fields, peer/port inputs, immutable Profile revision, distinct Nodes, capability/grant refusal, multihop order/cycles/closed gate. These tests do not cover full DOM controller or native getter evaluation timing. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Remaining: Relay pure form validation and source assets are covered; six helper exact identity/order/time plus per-init DOM caches/edit/pinned-plan/CAS/unknown/history/deployment sequences remain. |
| 185 | partial | E141 | Covered: Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: Echo display tests validate recorded shape/relationships without browser cryptographic verification. Complete machine-context and all timing/service identity permutations and native receipt-owner correspondence remain. |
| 186 | partial | E103, E108 | Covered: Existing v1 non-Echo permit/result tests assert one shared owner transaction, current binding/digest duplicate/conflict, failed store/guard rollback and sticky consumption/withdrawal. Remaining: These fixtures are tcp-connect v1. No Control owner suite located for v4 Echo challenge/proof/byte/TLS historical capture, MySQL0037 optional representation, missing head/loss/immutable history or non-Echo-vs-Echo native family selection. Schema/Agent evidence covers different narrower contracts; no live Echo acceptance. |
| 187 | partial | E142 | Covered: Exercise real initProbeRuns exported entry and actual list/detail/next/cancel/input/clear button listeners with a minimal DOM and independent Node SHA256 canonical fixtures; no private source extraction or production hooks. Legacy and TCP/UDP echoed runs verify full stored summary digest and separate canonical Echo invocation; mutations of stored actor/binding/resultDigest fail without reseal, while nonce/timeout/service changes fail even with a correctly resealed summary and stale invocation. Detail refuses foreign Scope/service Scope, retention cutoff, invalid lifecycle/expiry/status/proof/byte arithmetic/closed fields; valid detail preserves full content digest. List rejects invalid local window/limit/path/status before I/O, accepts exact echoed filter, checks filter/order/duplicates/query-bound cursor and response-byte refusal. Valid fixed cursor continuation loads one explicitly requested older page only. Historical display states unknown health/no execution/no independent proof and exact controlled request/response counts; loading an ID does not read detail. Cancellation, edited inputs, clear and Scope changes drop late responses without automatic requests. Remaining: New functional cases authored but unexecuted locally; exact next integrated SHA Actions pending. Real HTTP owner/parameterized SQL and server retention/history capture remain in Control evidence. Browser run UI validation covers invoked TCP/UDP Echo and legacy summaries; real browser layout, all cryptographic/retention/record-size edge permutations, typed/TLS family matrix and native stored-history correspondence are not exhausted. |
| 188 | partial | E132 | Covered: Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Need all 22 leaves/21 native adapters/manual map and actual request triggers/private/type/asset boundary acceptance; no whole-folder exemption. |
| 189 | partial | E143 | Covered: Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: Existing detailed Rule flow assertions cover success/CAS/replay/preflight/abort/tail/path/Profile behavior; full effect getter ordering and every callback/refresh/finally exception path remain unasserted. |
| 190 | partial | E139, E143 | Covered: Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: Real legacy Rule flow and canonical app VM graph preserve named behavior; exact native Set/this-binding/UUID and all getter/effect callback-order cases remain. |
| 191 | partial | E130, E132 | Covered: Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Remaining: Source Rule fixed route bytes/security are covered; actual image packaging/browser execution and negative native-to-product/type imports remain. |
| 192 | partial | E162, E135, E150 | Covered: Integrated commit inherits saved A5 candidate and includes classified additions; exact Actions checkout/tree and clean source status are captured outside self-referential file content. Remaining: Source closure is inherited, not acceptance; final same-source CI and remaining assertion obligations must close before a complete gate decision. |
| 193 | partial | E162, E135 | Covered: Actual import/classification inventory plus public distribution/version checks and compiled current consumers cover declared graph/counter consistency within configured rules. Remaining: Every independent public counter/export/default ABI/reflective consumer has not been proven solely by these checks. |
| 194 | partial | E135, E130 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: Source schema/Web parity does not prove image COPY/import graph, Go embed/generated declarations, lock/SQL/fs inputs, moving base image resolution or independent responder build/scan/publication. |
| 195 | partial | E144, E134, E139, E143 | Covered: Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Remaining: Example is included in current root TypeScript include and has preview behavior tests; recursive existing check-web and canonical VM behaviors are mapped. Full ops/phase/manual/fixture/private/asset consumer closure still needs exact-source integrated checks. |
| 196 | partial | E2, E1, E59, E9, E10 | Covered: Native sync proof/Windows parser, forward uptime, protected lock/atomic replacement and native facts conversion Remaining: Both OS build-selection matrix and full old-wrapper default/error/availability exact equivalence |
| 197 | partial | E135 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: Local definitions and normalized schema copies are covered; generated Go declaration/alias parity, exact generator target behavior and explicit existing three Transit comparison semantic repair remain. |
| 198 | partial | E135 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Remaining: Source target imports and two staged asset faults are covered; actual image exports/init, every dependency failure position and four handwritten telemetry validator/ACK fixture behaviors remain. |
| 199 | partial | E145 | Covered: Catalog digest/order/deep freezing, physical UDP-to-TCP carrier distinction, flags and multihop gate. Closed-field/version/new-driver/duplicate/capability/privilege refusal; catalog rejected as Runtime Hello. Actual Go provider/Guard execution is not asserted. Remaining: TS catalog closed metadata/digest/gate cases do not prove native Go provider correspondence, platform/flag selection, duplicate suppression, Probe opt-in or Guard/Journal execution refusal. |
| 200 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: All53 pure aliases have runtime identity coverage; six original constructor/default/static binding behaviors and complete consumer/removal evidence require separate tests. |
| 201 | partial | E156, E65, E77 | Covered: Legacy constructor/import consumers compile and pure identities are checked; Ledger/idempotency acceptance retains supplied Tx and stable keys/monotonic clock order. Remaining: Identity dynamic versus Nodes captured Date.now, native UUID lifetime/default resource and every lazy Recovery/getter/callback construction sequence require direct behavioral traces. |
| 202 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: Accepted, Profile/Relay references, Node authorization and readonly Member input are type-compatible with canonical public declarations. Full compiler emission/import-cycle and every support consumer are not exhaustively proved. |
| 203 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: All25 Runtime forwarders have actual module identity coverage. Eight native construction/callable bindings, one retained RelayExecutionLedger interface and all constructor/default/consumer lifecycle behavior remain separate obligations. |
| 204 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: Five legacy port-source groups and shared/direct Policy type aliases have compile-only key generic acceptance; full canonical declarations/generic defaults and native default/initialization of construction bindings are not exhausted. |
| 205 | partial | E148, E65, E156, E62, E90 | Covered: Host/Ledger same-Tx clocks/claims/retirement/publication and source merge, native Transit coordination/ports and legacy imports are exercised. Remaining: All RuntimeController callback receivers/policy/default-resource captures plus held versus per-call Transit service lifetimes and static recovery clock traces are not exhaustively compared. |
| 206 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: All96 application pure aliases plus management aggregate are covered. Control composition/field/deferred callback sequence and command-request named wrapper are intentionally not declared identical to canonical implementations. |
| 207 | partial | E156 | Covered: Explicit architecture-map expectations load every listed pure legacy forwarding entry and compare actual runtime exports/value identity, including erased type-only leaves; key generic/type aliases compile in dedicated compatibility witnesses. Explicit independent expectations from the three published leaf maps cover 53 top-level +25 Runtime +96 application pure-forwarding leaves; no expected identity is generated by parsing implementation exports. Actual ES module import namespaces must have exactly expected runtime names and every value/function/class/frozen object must be strictly identical to its separately imported mapped canonical binding. Type-only legacy namespaces must be empty. Each expected leaf must occur in its published map and per-family distinct leaf counts must remain53/25/96. Canonical full-star expectations use the exact documented leaf, not a broader owner barrel. Separate management aggregate check preserves own version1 and exact three reader constructors; five original frozen telemetry policy objects retain distinct reference identities. Compile-only Equal constraints compare one named representative from each nineteen application type-export leaves, plus explicit supplied-Tx generic Forward/Profile/Relay/Node/Access/adapter/preparation ports, Accepted and Policy aliases; an intentionally typechecked negative assignment retains readonly MemberChangeInput and literal200\|202 response status. Remaining: All19 named application type-export leaves have a representative compile-only canonical equality constraint; exhaustive per-export type/readonly/generic/default surface and emission/initialization acceptance remain partial. |
| 208 | partial | E148, E65, E62, E78, E74, E70 | Covered: Direct hosts and original command/effect ports verify shared Tx and ordered callbacks; native composition and feature scopes are exercised by MySQL/browser scenarios. Remaining: Complete original Control initializer/deferred callback/getter/options group, restoration and every rejection rollback sequence still need construction-level traces. |
| 209 | partial | E162, E132, E156 | Covered: Actual classified source/type/private/native graph plus negative import mutations and canonical/legacy entrypoint loading are checked. Remaining: Those checks do not replace behavioral acceptance for all product owners or certify undeclared external/reflection consumers. |
| 210 | partial | E148, E65, E155, E154, E158, E78 | Covered: Raw/status host separation, task drain/backoff/allSettled, one supplied transaction, resources/ledger and ordered original recovery owners are directly asserted. Remaining: Full server preflight/partial-start/native dependency-close, all class prototype/override/static/lazy and real SQL fault sequences remain bounded. |
| 211 | partial | E110, E116, E111, E112 | Covered: Sender accepts common CancellationSignal without EventTarget members, preserves original reason and exact once callback identity/removal when cancellation races registration; no DNS starts. Native abort while DNS/guard outstanding returns rejected early but capacity/close remain held until actual callback settles, including late guard rejection. HTTPS request errors classified unknown rather than rejected, without retry. Remaining: Observation pool cancellation is covered separately. Full response/socket cancellation, listener-removal exceptions, all native-API assignability and actual FileNotificationSecrets close/pin ownership remain outside these tests. |
| 212 | partial | E135, E130 | Covered: Compare 18 source/embed/generated schema pairs after explicit CRLF-to-LF checkout normalization; do not claim raw byte identity. Compile all local $defs in all 21 distinct resources using AJV2020 and formats without remote resolver. Dynamically import all 11 manifest targets in the source distribution. Stage package source/data/schemas and use isolated child processes to reject missing/malformed Runtime schema and native catalog; dedicated policy/observation/values entries must load without those assets. This is not a Docker image test. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Remaining: Source resource/entry/Web route tests are narrow; complete assets consumer closure including native generated/handwritten/embed roles, fixtures/locks/SQL/COPY/deletions and actual distribution fault semantics remain. |
| 213 | partial | E144, E130, E138, E132, E137, E139, E143, E141 | Covered: Existing test:web preflight recursively discovers every production JS leaf excluding test and invokes node --check. The newly proposed duplicate syntax test was removed. This is syntax coverage, not browser behavior. Recursively discover every production Web JS leaf, excluding tests; request each through real createApp routes and compare exact response bytes to source. Assert exact JavaScript MIME, no-store, nosniff, DENY and CSP connect-src self; reject three unregistered fixed paths. This proves route/source parity, not packaged image execution. Canonical public request factory: malformed JSON precedes stale-version refusal; stale result reaches neither abort nor HTTP-status checks. Mutation failure retains the same key, success deletes it, explicit reset replaces it. Successful request executes decode, abort, status in order. Factory construction reads no state/effect; disconnected mutation computes signature/key before scope guard, short-circuits token/version and retains the key on subsequent refusal. Mutation sources reject outer value/type/reexport/import-type references, package-private paths, unclassified product/Web/operator leaves, sibling-private/framework-private/storage providers. Lower JS global time/parser and Go serialization/platform imports are rejected; browser owner native DOM/fetch/time and private sibling imports are rejected. This tests policy refusal, not a full production graph result. Seven pure legacy/public model helpers retain exact function identity. Model factory setup and credential short circuits read no native time/effect. Explicit credential effect receives lazy getter; query guard runs before forwarding identical filter object. Native credential path retains two getter reads then Date.parse then Date.now, including invalid date parse. This does not verify native Date.parse property lookup getter order. Native fetch stub receives exact escaped scope URL, method, Bearer/Accept/content/key headers, optional body and credentials/cache/redirect/referrer options. Caller abort reaches composed native signal with exact reason identity; lower throw retains same reason. GET omits body/content/idempotency headers. JSON read delegates to response; non-OK maps exact server code/message and fallback/status; successful response returns undefined. Existing VM loader reads the real recursive named import/reexport graph from app.js and executes native composition in its own lexical scopes. This is a minimal DOM contract harness, not a real browser. Actual closures assert disabled copy without inherited runtime fields, Relay immutable Profile/path plus fresh preview, eight-node order and disabled gate; old-page/connection results and grant-lost candidates cannot alter newer state. Late deployment and changed-form preview responses cannot reopen dialogs/enable submit. The loader exposes closures only in the test copy. Existing real legacy -> canonical owner/native graph tests assert ten detached rows, no dispatch before consent, CAS rejection per row, serial dispatch/no double click and same-key/body explicit uncertainty replay with unsent tail. Abort/disconnect discards late outcomes; retry reads Operation then Forward with latest-source/revision/recovery guards; no-op preserves current revision/no Operation. Profile/path batches retain detached allowed-only changes, fresh read-only preflight, no write on denied/malformed results, exact key/body replay without replacing intent, and fresh consent for tail. These tests do not exhaust every getter/effect/refresh exception or prove full native confirm this-binding equivalence. Existing legacy receipt/issue tests retain explicit consent, same immutable key/body, unknown health, no hidden POST, bounded eight-GET wait, revoke queried identity/body, abort/version/clear and stale acceptance refusal. New TCP/UDP Echo fixtures cover issued/consumed/revoked/quarantined states, echoed/unverified and TCP unreachable outcomes, exact business/request/response/payload bytes and stored-evidence-not-reverified-by-browser. New negative fixtures reject extra field, foreign Scope, descriptor/binding/context/instance mismatch, malformed challenge/signature/proof, byte arithmetic, unknown status, acceptance/deadline/TLS/source/execution claims and make exactly one GET. Remaining: Recursive production syntax/fixed routes and actual canonical Rule/app/Relay VM graphs plus native request/model behavior are mapped. Browser layout/real packaging and exhaustive owner/legacy effect/getter/initialization edge cases remain; exact integrated-source Actions pending. |
| 214 | partial | E134, E133, E146 | Covered: Assert same transaction/actor/Scope/manage authorization, BOTH mapping, canonical hostname and detached deeply frozen preview without execution authority. Closed input and identity refusal before transactions; exact denied error identity with no log. Logger exception isolated; request drain waits for authorization transaction and blocks new admission. Bootstrap reads DATABASE_URL then TUNEX_OWNER_TOKEN even when arguments are absent; ignores extra args and preserves exact required error. Injected open/migrate/bootstrap/log/close failures preserve error identity; close occurs exactly once only after successful construction; migrate failure skips bootstrap/output. Success trace uses original db/scope/actor/token and exact log; awaited close blocks settlement and overrides migration error as finally does. Known migration catalog asserts 37 files through0037 and partial-table/migration history refusal, schema reader ceilings and downgrade gates. Source assertions follow real CLI/public command/native inspector paths, require consistent snapshot READ ONLY/rollback/final end and keep separate MySQL Actions command. Injected assessment dispatch forbids Authority construction/mutations, checks exact args and decision exit0/2/1; inspection error suppresses credential text and returns bounded public refusal report. Remaining: Example preview/bootstrap/assessment evidence is mapped; actual backup/restore native process/atomicity, all phase/manual/container consumers, independent Responder and live Echo remain separate requirements. |
| 215 | partial | E25, E26, E16, E8, E34, E17, E32, E27, E28 | Covered: Native catalog/features, provider nil refusal, save-before-bind/prepare, real engine socket budgets and drain Remaining: Full source-closure named helper/type/consumer inventory must link all leaf assertions; metadata platform+feature first-error cases, static boundary evidence |
| 216 | partial | E59, E3, E2 | Covered: Exact native SyncStatus JSON bytes, parsed facts/sourceAccepted/observationValid, original proof forgery/host/platform refusal Remaining: Lower taglessness serializer explicit assertion and full old native alias method-set/OS provider error projection |
| 217 | partial | E3, E4, E59 | Covered: Parse invalid facts deferred to decision, host/source before validation, both sample errors, cache2s/rollback, blocked second sample, future/stale/500ppm bounds Remaining: Native OS/proof/unsupported provider selection and invalid timestamp plus wrong host/source cross-native provider traces |
| 218 | partial | E15 | Covered: All8 projections roundtrip every native field; 4 golden JSON records, 2 optional fields, required nil overlap, pointer identity, lower JSON differs Remaining: Reflective complete tag/type declaration/method-set equality and old private fixture serializers not independently compared |
| 219 | partial | E15, E13, E14, E22 | Covered: Machine corruption no fallback, protected initial missing vs MAC/malformed, stable request CSR/key replay, expired protected online-only replay recovery, native request excludes key Remaining: Permissive machine vs strict protected every malformed field, save/reload/remove failure injection all intermediate paths |
| 220 | partial | E150, E151, E134, E162 | Covered: Save complete candidate then run all applicable exact-source Actions, retain per-item covered/partial/gap and independent physical/long-run/release gates; public example and complete compiled consumers are included. Remaining: Full B acceptance remains closed while any listed requirement lacks complete assertions or applicable exact-source execution. |

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

### E5: agent/internal/executionstate/runtime_acceptance_order_test.go

[Source](../../agent/internal/executionstate/runtime_acceptance_order_test.go)

- TestRuntimeProviderOrderingAndRawAuthority
- TestRuntimeRefusalStagesAndNoNewAuthority
- TestRuntimeWithdrawalTombstoneMaximumAndNilProviders
- TestRuntimeEveryImmutableFieldRefusesWithoutSaving

### E6: agent/internal/state/adp3_journal_test.go

[Source](../../agent/internal/state/adp3_journal_test.go)

- TestRuntimeJournalPersistsPhysicalTCPForUDPAndRefusesHistoryReset
- TestRuntimeJournalInvalidJSONUsesStableIntegrityCode
- TestRuntimeJournalWriteFailureDoesNotAdvanceCallerHighWater
- TestRuntimeJournalCannotReinitializeOrUseCorruptState

### E7: agent/internal/state/adp3_transit_journal_test.go

[Source](../../agent/internal/state/adp3_transit_journal_test.go)

- TestTransitJournalPersistenceRetirementAndReplay
- TestTransitJournalFailsClosedOnCorruptDurableFile

### E8: agent/internal/control/runner_test.go

[Source](../../agent/internal/control/runner_test.go)

- TestSnapshotRenewalAndPersistenceBeforeBind

### E9: agent/internal/platformstate/atomic_write_test.go

[Source](../../agent/internal/platformstate/atomic_write_test.go)

- TestAtomicWriteReplacesBytesAndLeavesNoTemporaryFiles
- TestAtomicWriteFailedRenameCleansTempAndPreservesProtectedTarget

### E10: agent/internal/state/lock_test.go

[Source](../../agent/internal/state/lock_test.go)

- TestExclusiveInstance

### E11: agent/internal/state/inspect_test.go

[Source](../../agent/internal/state/inspect_test.go)

- TestJournalInspectionDoesNotWriteOrMigrate
- TestJournalInspectionRejectsTamperingIdentityAndMissingState
- TestJournalInspectionRetainsImportedPhysicalHighWater

### E12: agent/internal/state/multihop_journal_test.go

[Source](../../agent/internal/state/multihop_journal_test.go)

- TestExecutionMigrationIsExplicitAndRetainsImportedHighWater
- TestMultihopJournalRequiresMigrationAndRejectsCrossRoleOwnerAtSameFence

### E13: agent/internal/control/credentials_test.go

[Source](../../agent/internal/control/credentials_test.go)

- TestRotationRequestSurvivesRetryWithoutNewKeyOrCSR
- TestCorruptAtomicCredentialBundleNeverFallsBack

### E14: agent/internal/control/relay_credentials_test.go

[Source](../../agent/internal/control/relay_credentials_test.go)

- TestRelayCredentialPersistsRetryAndRejectsCorruptStoredBundle
- TestRelayCredentialChecksNodePurposeKeyPinsAndEffectiveExpiry
- TestRelayRenewalPreservesOldIdentityUntilDurableRetryAndCleansCrashRequest
- TestExpiredProtectedRelayBundleRequiresFreshOnlineAuthority
- TestRelayExpiredIssuanceReplayCannotTrapOnlineRecovery

### E15: agent/internal/agentidentity/records_test.go

[Source](../../agent/internal/agentidentity/records_test.go)

- TestNativeCredentialRecordsKeepEncodingAndFacts
- TestNativeProviderPersistsCredentialFactsUsingNativeRecords

### E16: agent/internal/control/platform_contract_test.go

[Source](../../agent/internal/control/platform_contract_test.go)

- TestExplicitProviderConstructorsRejectMissingBeforeBootstrap

### E17: agent/internal/control/transit_runner_test.go

[Source](../../agent/internal/control/transit_runner_test.go)

- TestTransitRunnerOfflinePersistBeforeEngineAndNoReplay
- TestTransitRunnerBridgeRejectsUnnegotiatedLeaseAndLegacyPhysicalPort

### E18: agent/internal/agentcommand/command_run_lifecycle_test.go

[Source](../../agent/internal/agentcommand/command_run_lifecycle_test.go)

- TestCommandRunReleaseAndConstructionBeforeSignals
- TestInspectionAllowsRelayAndPairedTimeProof

### E19: agent/internal/control/probe_claim_test.go

[Source](../../agent/internal/control/probe_claim_test.go)

- TestProbeClaimReceiptChecksHostBindingWithoutExecutionOrJournalMutation
- TestProbeClaimRejectsEveryForeignBindingAndBurnsFailedClaims
- TestProbeClaimRechecksLocalAuthorityAfterRemoteWork
- TestProbeClaimUncertainHTTPOutcomesRemainBurnedWithoutRedirectOrRetry
- TestProbeClaimConcurrentBurnCapacityAndPreflight

### E20: agent/internal/control/probe_delivery_test.go

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

### E21: agent/internal/control/probe_workflow_test.go

[Source](../../agent/internal/control/probe_workflow_test.go)

- TestProbeWorkflowRequiresSeparateExplicitOptIns
- TestProbeWorkflowPollClaimWatchConnectAndReportOnce
- TestProbeWorkflowUncertainClaimNeverExecutesOrReclaims
- TestProbeWorkflowInitialWithdrawalPreventsAllSocketWork
- TestProbeWorkflowReportAttemptBurnsBeforeLostOrInvalidAcknowledgement
- TestProbeWorkflowCancellationDrainsReportAndWatchBeforeReturning

### E22: agent/internal/nativeexecution/probe_wire_boundaries_test.go

[Source](../../agent/internal/nativeexecution/probe_wire_boundaries_test.go)

- TestProbeBoundedBodyAndReaderError
- TestProbeEntropyKeepsOne32ByteReadAndShortCount
- TestNativeWireTimesAndRelayScheduleFirstError
- TestCredentialRotationNeverEncodesPrivateKey

### E23: agent/internal/control/diagnostics_test.go

[Source](../../agent/internal/control/diagnostics_test.go)

- TestDiagnosticsIsAggregateLocalDataAndDoesNotReplaceAuthority

### E24: agent/internal/control/probe_execution_test.go

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

### E25: agent/internal/control/execution_drivers_test.go

[Source](../../agent/internal/control/execution_drivers_test.go)

- TestExecutionRegistryDeclarations
- TestExecutionRegistrySelection
- TestExecutionRegistryCapabilities
- TestExecutionDriverFactoryBoundaries
- TestExecutionDriverReplacementBoundary
- TestExecutionDriverAuthorizationContract
- TestExecutionDriverErrorAndPolicyContract

### E26: agent/internal/control/execution_catalog_test.go

[Source](../../agent/internal/control/execution_catalog_test.go)

- TestExecutionCatalogMatchesBuiltins

### E27: agent/internal/forward/tcp_lifecycle_test.go

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

### E28: agent/internal/forward/udp_test.go

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

### E29: agent/internal/executionenrollment/enrollment_failure_order_test.go

[Source](../../agent/internal/executionenrollment/enrollment_failure_order_test.go)

- TestEnrollmentEveryFailurePreservesOrderAndCleanup

### E30: agent/internal/agentcommand/inspection_test.go

[Source](../../agent/internal/agentcommand/inspection_test.go)

- TestInspectionReturnsWithoutEnrollmentLockOrRunner
- TestInspectionRejectsEveryStateChangingFlagBeforeEffects

### E31: agent/internal/control/native_direct_probe_test.go

[Source](../../agent/internal/control/native_direct_probe_test.go)

- TestProbeHostReadsCurrentPhysicalBindingWithoutMutation
- TestProbeHostRejectsForeignStaleInactiveAndTamperedBindings
- TestProbeHostExecutionExpiryCannotBeReplacedByProbePermit

### E32: agent/internal/probe/probe_test.go

[Source](../../agent/internal/probe/probe_test.go)

- TestProbeConnectOnlyAndProvenance
- TestProbeRejectsInvalidRequestsBeforeResolution
- TestProbeRejectsDNSMetadataAndForeignBindingsWithoutDial
- TestProbeSingleAttemptAndSanitizedFailure
- TestProbeCancellationDeadlineAndRevocation
- TestProbePostConnectRevocationClosesConnection
- TestProbeBoundedAdmissionAndCooldown

### E33: agent/internal/probe/gate_test.go

[Source](../../agent/internal/probe/gate_test.go)

- TestProbeGateConsumesBeforeAttemptAndDoesNotResetOnFailure
- TestProbeGateRejectsForeignInstancesAndRequiresIndependentAuthority
- TestProbeGateConcurrentDuplicateHasOnlyOneAttempt
- TestProbeGateCloseCancelsInflightAndDeniesFurtherWork
- TestProbeGateCapacityNeverEvictsConsumedIDs

### E34: agent/internal/control/relay_runner_test.go

[Source](../../agent/internal/control/relay_runner_test.go)

- TestRelayRunnerPersistsBeforePrepareAndActivatesAfterRealPeerProbe

### E35: agent/internal/nativeexecution/probe_echo_endpoint_test.go

[Source](../../agent/internal/nativeexecution/probe_echo_endpoint_test.go)

- TestEchoIngressEndpointKeepsNumericProtocolAndPolicyBounds

### E36: agent/internal/control/probe_counter_clock_test.go

[Source](../../agent/internal/control/probe_counter_clock_test.go)

- TestProbeCounterPointSamplesEveryPointAndPreservesTerminalOffset
- TestEchoContextDecodeRefusalStillSamplesOwnerClock
- TestForwardCounterEmbeddingKeepsPromotedNativeFields

### E37: agent/internal/proberesult/contract_test.go

[Source](../../agent/internal/proberesult/contract_test.go)

- TestProbeResultSharedVectors
- TestProbeResultDigestAndTypedEcho

### E38: agent/internal/control/probe_negotiation_test.go

[Source](../../agent/internal/control/probe_negotiation_test.go)

- TestProbeClientNegotiationDoesNotAuthorizeExecution
- TestProbeClientRejectsUnboundActiveOversizedOrSupersededAcknowledgements

### E39: agent/internal/control/probe_registration_test.go

[Source](../../agent/internal/control/probe_registration_test.go)

- TestProbeRegistrationOwnsRotatesAndRevokesCurrentGate
- TestProbeRegistrationRejectsUnsafeOrSupersededAcknowledgements
- TestProbeRegistrationStopCannotBeUndoneByLateAcknowledgement
- TestProbeRegistrationMonitorClosesOnContextIdentityAndGuardLoss
- TestProbeRegistrationMonotonicFreshnessDeadlineClosesGate
- TestProbeRegistrationSupervisorClosesAndRevokesOnShutdown
- TestProbeRegistrationRecoversOwnerAfterRejectedAcknowledgement

### E40: agent/internal/probe/native/echo_format_test.go

[Source](../../agent/internal/probe/native/echo_format_test.go)

- TestEchoExecutionEqualityDistinguishesNilEmptyAndDetachedProtocols
- TestEchoContextRoundtripAndBothTimeParsesKeepFailureStages

### E41: agent/internal/state/runtime_facts_test.go

[Source](../../agent/internal/state/runtime_facts_test.go)

- TestRuntimeFactsPreserveRawStorageAndReferences
- TestRuntimeNativeFieldOrderAndRawJSONSemantics

### E42: agent/internal/state/journal_test.go

[Source](../../agent/internal/state/journal_test.go)

- TestJournalIntegrityAndPersistence

### E43: agent/internal/transit/engine_test.go

[Source](../../agent/internal/transit/engine_test.go)

- TestThreeNodeTLSBoundTransitTCPHalfClose
- TestThreeNodeTLSBoundTransitUDPAssociationAndEmptyDatagram
- TestPreparedTransitRefusesMissingAuthorization
- TestTransitRejectsSpoofedOpenAndRevokedGrant

### E44: agent/internal/relay/tls_test.go

[Source](../../agent/internal/relay/tls_test.go)

- TestMutualTLSExactNodeIdentityAndNoDowngrade
- TestMutualTLSRefusesForeignNodeTrustPurposeExpiryAndPin

### E45: agent/internal/platformobservation/host_contract_test.go

[Source](../../agent/internal/platformobservation/host_contract_test.go)

- TestHostNativeAliasAndLowerFactsHaveDistinctSerialization

### E46: agent/internal/relay/engine_test.go

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

### E47: agent/internal/relay/multihop_test.go

[Source](../../agent/internal/relay/multihop_test.go)

- TestMultihopTCPConsecutiveTransitHalfCloseRenewalAndCutoff
- TestMultihopUDPClientIsolationAndIntermediateFailure
- TestMultihopUDPRequestActivityPreservesAssociationBeforeDelayedReply

### E48: agent/internal/relay/wire_test.go

[Source](../../agent/internal/relay/wire_test.go)

- TestReplyKeepsPreparedFailureRetryableAndBindsAcceptance
- TestOpenAndFrameBoundsAndPreparedGate

### E49: agent/internal/adp3/validate_test.go

[Source](../../agent/internal/adp3/validate_test.go)

- TestSharedRuntimeFixture

### E50: agent/internal/adp3/multihop_test.go

[Source](../../agent/internal/adp3/multihop_test.go)

- TestMultihopSharedExecutionConformance

### E51: agent/internal/adp3relay/validate_test.go

[Source](../../agent/internal/adp3relay/validate_test.go)

- TestSharedFixture

### E52: agent/internal/adp3transit/validate_test.go

[Source](../../agent/internal/adp3transit/validate_test.go)

- TestOfflineTransitADP3Envelope
- TestTransitADP3RejectsVersionAndBindingDrift
- TestTransitADP3RejectsStaleAndConflictingSnapshots

### E53: agent/internal/contracts/validate_test.go

[Source](../../agent/internal/contracts/validate_test.go)

- TestAuthoritativeFixture
- TestSharedConformance
- TestRFC8785Vectors
- TestBoundedJSON
- TestPreciseTimes

### E54: agent/internal/transitcontracts/validate_test.go

[Source](../../agent/internal/transitcontracts/validate_test.go)

- TestSharedTransitVectors
- TestTransitEmbeddedSchemaMatchesRepositoryContract
- TestLegacyRelayAgentParserDeniesNewTransitRole

### E55: agent/internal/probeclaim/validate_test.go

[Source](../../agent/internal/probeclaim/validate_test.go)

- TestProbeClaimSharedVectorsAndTypedEcho

### E56: agent/internal/probeinstance/validate_test.go

[Source](../../agent/internal/probeinstance/validate_test.go)

- TestProbeInstanceSharedVectors
- TestProbeInstanceEchoAndTypedBypass

### E57: agent/internal/probedelivery/contract_test.go

[Source](../../agent/internal/probedelivery/contract_test.go)

- TestProbeDeliverySharedVectors
- TestProbeDeliveryTypedEcho

### E58: agent/internal/probenegotiation/validate_test.go

[Source](../../agent/internal/probenegotiation/validate_test.go)

- TestProbeNegotiationSharedVectors
- TestProbeNegotiationEchoAndTypedBypass

### E59: agent/internal/platformclock/synchronization_values_test.go

[Source](../../agent/internal/platformclock/synchronization_values_test.go)

- TestNativeSynchronizationStatusEncodingAndFacts
- TestSynchronizationProjectionKeepsInvalidFactsForDecision

### E60: apps/control/test/multihop-runtime.test.ts

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

### E61: scripts/phase2/relay-scenarios.ts

[Source](../../scripts/phase2/relay-scenarios.ts)

See the source scenario assertions or configured command steps.

### E62: apps/control/test/snapshot-assignment-ports.test.ts

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

### E63: scripts/phase2/runtime-intent-lock.ts

[Source](../../scripts/phase2/runtime-intent-lock.ts)

See the source scenario assertions or configured command steps.

### E64: scripts/phase2/access.ts

[Source](../../scripts/phase2/access.ts)

See the source scenario assertions or configured command steps.

### E65: apps/control/test/runtime-ledger-ports.test.ts

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

### E66: apps/control/test/relay-plan.test.ts

[Source](../../apps/control/test/relay-plan.test.ts)

- Control Relay plan binds both sessions and physical reservations in strict prepared assignments
- Relay plan is order stable and never mutates owner facts or reserved slots
- Relay compiler rejects missing, foreign, mixed-generation and unfenced reservations
- Relay compiler refuses expired or duplicated peer facts and bounds both Node credentials
- Relay pin refresh detects either endpoint change without mutating immutable intent or plan

### E67: apps/control/test/relay-planner.test.ts

[Source](../../apps/control/test/relay-planner.test.ts)

- relay resource plan distinguishes public UDP from independent internal TLS TCP socket
- relay plan refuses missing exact capability, wrong Profile revision and TLS resource conflict
- relay plan applies final target policy at egress and peer endpoint policy at ingress
- Relay reachable endpoints reject wildcard/multicast/mapped wildcard and duplicate internal ports
- current Relay resource allocator fails closed on a proposed Transit hop

### E68: apps/control/test/multihop-plan.test.ts

[Source](../../apps/control/test/multihop-plan.test.ts)

- ${count}-Node execution binds every role, session and physical Fence
- multi-hop compiler refuses absent capabilities, policy, exact ownership and peer authority

### E69: scripts/phase2/relay-capacity.ts

[Source](../../scripts/phase2/relay-capacity.ts)

See the source scenario assertions or configured command steps.

### E70: apps/control/test/node-management-ports.test.ts

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

### E71: scripts/phase2/security.ts

[Source](../../scripts/phase2/security.ts)

See the source scenario assertions or configured command steps.

### E72: scripts/phase2/transport.ts

[Source](../../scripts/phase2/transport.ts)

See the source scenario assertions or configured command steps.

### E73: apps/control/test/identity-input.test.ts

[Source](../../apps/control/test/identity-input.test.ts)

- opaque bearer token input rejects trailing whitespace, Unicode and malformed lengths

### E74: apps/control/test/access-command-ports.test.ts

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

### E75: scripts/phase2/recovery.ts

[Source](../../scripts/phase2/recovery.ts)

See the source scenario assertions or configured command steps.

### E76: apps/control/test/transport-grant-ports.test.ts

[Source](../../apps/control/test/transport-grant-ports.test.ts)

- Profile revoke uses one owner-authorized transaction and never transitions or allocates
- Profile restore rechecks subject authority and capacity, but disabled intents never transition
- Profile replay is owner-gated before returning the same operation IDs without repeating effects
- Profile no-op, stale CAS and empty references do not invent deployment work
- Profile port failures roll back grant, audit, operations and replay response together
- Profile integration rejects cross-scope owner references and missing effect wiring
- non-HTTP Profile grant callers cannot bypass identifier, revision, boolean or key validation

### E77: apps/control/test/intent-store-ordering.test.ts

[Source](../../apps/control/test/intent-store-ordering.test.ts)

- idempotency snapshots keys before ensure but compares the live digest after the row lock
- recovery-invalidated idempotency refuses before digest conflict or stored response decoding
- pending idempotency never decodes response and completed replay preserves body identity and decoder failure
- idempotency response samples status and encodes body before reading request keys
- Forward insert encodes again after the current-row await rather than caching mutable spec bytes
- Forward replacement encodes after CAS await and refuses zero or multiple affected rows before history
- Forward storage failure preserves identity and prevents the subsequent immutable revision write

### E78: apps/control/test/forward-command-ports.test.ts

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

### E79: apps/control/test/rule-commands-api.test.ts

[Source](../../apps/control/test/rule-commands-api.test.ts)

- Operation detail exposes the scoped Forward identity for explicit retry without skipping same-transaction authorization
- explicit retry delegates the original actor/scope/key and rejects extra or duplicate intent fields

### E80: apps/control/test/forward-probes-api.test.ts

[Source](../../apps/control/test/forward-probes-api.test.ts)

- Probe management routes delegate verified actor, scope, strict JSON and idempotency key
- Probe management routes reject cookies, missing authentication, oversized/duplicate JSON and query injection before delegation

### E81: apps/control/test/application-query-ports.test.ts

[Source](../../apps/control/test/application-query-ports.test.ts)

- query ports preserve one authorized transaction without a concrete Control or SQL connection
- denied query authorization prevents every projection and propagates transaction failure
- non-HTTP query callers cannot bypass pagination, filter or identifier validation
- query inputs are detached before asynchronous authorization and adapter failures are not swallowed

### E82: apps/control/test/console-read.test.ts

[Source](../../apps/control/test/console-read.test.ts)

- console pagination is bounded and rejects malformed integers
- read models enforce scope before running any page SQL
- page queries are scope bound, return no enrollment secret and separate operation status
- all three scoped lists use bounded second-page literal offsets
- console filter contracts reject duplicate, unknown, unbounded and injection inputs
- filters are bound identically into count and page SQL; prefix underscore stays literal
- candidate and overview authorization precedes data SQL, including manager requirement
- overview counts are scoped, single-statement and independent of any page or filter

### E83: apps/control/test/console-diagnostics.test.ts

[Source](../../apps/control/test/console-diagnostics.test.ts)

- Node diagnostics authorizes scope before querying any Node state
- Node diagnostics is read-only, scoped, sanitized and never claims probe health
- Node diagnostics returns 404 for out-of-scope or missing Node

### E84: apps/control/test/console-mysql-acceptance.test.ts

[Source](../../apps/control/test/console-mysql-acceptance.test.ts)

- console queries preserve bounded pages, independent candidates, full-scope totals and read-only authorization

### E85: apps/control/test/transport-query-ports.test.ts

[Source](../../apps/control/test/transport-query-ports.test.ts)

- native catalog needs current scope access and separates process gates from Node proof or authorization
- reference listing is authorized first in the same transaction and does not require an execution grant
- impact preview requires manager and exact Profile revision grant but never mutates the source or authorizes deployment
- scope denial and invisible Profiles stop before projection/resolution
- query parameters are closed, bounded and canonical before any transaction
- owned query survives caller mutation across authorization and stale pages never widen the revision filter
- malformed persisted reference fails closed instead of suggesting an update to another Profile

### E86: apps/control/test/transport-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/transport-query-mysql-acceptance.test.ts)

- native catalog and Profile references/impact use real prepared MySQL, scoped SELECT-only access and exact target grants

### E87: apps/control/test/tunnel-query-ports.test.ts

[Source](../../apps/control/test/tunnel-query-ports.test.ts)

- tunnel metadata authorizes inside one transaction, bounds peer windows, and never claims execution or network health
- revoked or expired Node/peer windows stay closed, and an absent Endpoint is metadata rather than fabricated readiness
- desired-rule references include disabled and recovery-suspended intent and derive exact ordered adjacency for all native roles
- scope denial and a missing scoped Node stop before any endpoint, peer or reference disclosure
- reference input is closed/canonical/bounded and detached before authorization awaits
- corrupt Node, Endpoint and credential metadata fail closed rather than emit partial authorization claims
- invalid, duplicate or unrelated desired references are rejected and do not become neighboring execution facts

### E88: apps/control/test/tunnel-query-mysql-acceptance.test.ts

[Source](../../apps/control/test/tunnel-query-mysql-acceptance.test.ts)

- tunnel API uses real prepared SELECT-only MySQL: bounded windows, scoped exact adjacency, pagination and no persisted mutations

### E89: apps/control/test/transit-negotiation.test.ts

[Source](../../apps/control/test/transit-negotiation.test.ts)

- real MySQL TLS-bound Transit handshake rejects retired boot, credential revocation and capability spoofing
- transit negotiation HTTP path refuses client without a verified TLS machine certificate
- Transit preview poll and delivery report deny unauthenticated clients

### E90: apps/control/test/transit-coordination.test.ts

[Source](../../apps/control/test/transit-coordination.test.ts)

- offline Transit coordination plan remains downstream-first, ingress-first on withdrawal
- offline coordination database enforces ownership, receipt CAS, recovery and never releases ports
- offline rollout SQL creates only an isolated coordination journal

### E91: apps/control/test/transit-preparation.test.ts

[Source](../../apps/control/test/transit-preparation.test.ts)

- Transit v1 preparation binds 3 Nodes, both protocols, sessions, pins, fences and tail-first activation
- Multi-hop plan is deterministic across resource/facts order and does not mutate inputs
- Transit preparation refuses missing, foreign, mixed-generation, colliding and unfenced slots
- Transit preparation rejects expired credentials, wrong peer, unadvertised versions, scope mismatch and bad adjacent target
- Multi-hop logical planning still refuses one- and two-Node current paths
- transactional reserve primitive rejects malformed logical sets before touching MySQL

### E92: scripts/phase2/relay.ts

[Source](../../scripts/phase2/relay.ts)

See the source scenario assertions or configured command steps.

### E93: apps/control/test/path-template-ports.test.ts

[Source](../../apps/control/test/path-template-ports.test.ts)

- native template parser is closed, bounded, ordered and detached, with computed native requirements
- publication uses one authorization/owner transaction and preserves immutable versions, deduplication and audit
- scope denial precedes idempotency, reads and owner side effects; stale CAS and keys cannot mutate metadata
- archival is terminal, keeps immutable history and does not require or create new execution authority
- quota, reference denial and audit failure roll back head, immutable version, event and idempotent response together
- revision ceiling permits authorized no-op and archival, but cannot overwrite the last version
- reads detect stored corruption, detach pagination and retain archived rows without checking execution grants
- native authoring adapter checks sorted Node grants/capabilities, locked Profile and every current Endpoint in the supplied transaction

### E94: apps/control/test/path-binding-ports.test.ts

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

### E95: apps/control/test/path-template-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-template-mysql-acceptance.test.ts)

- path templates use real native reference authorization, transactional CAS/quotas, immutable history, archival and SELECT-only scoped queries

### E96: apps/control/test/path-binding-mysql-acceptance.test.ts

[Source](../../apps/control/test/path-binding-mysql-acceptance.test.ts)

- path binding uses real original owner transactions: immutable expanded provenance, concurrent CAS, rollback, cap, archival and SELECT-only impact/history

### E97: scripts/phase2/path-template-console.ts

[Source](../../scripts/phase2/path-template-console.ts)

See the source scenario assertions or configured command steps.

### E98: scripts/phase2/path-switch-console.ts

[Source](../../scripts/phase2/path-switch-console.ts)

See the source scenario assertions or configured command steps.

### E99: scripts/phase2/path-batch-console.ts

[Source](../../scripts/phase2/path-batch-console.ts)

See the source scenario assertions or configured command steps.

### E100: apps/control/test/probe-negotiation-ports.test.ts

[Source](../../apps/control/test/probe-negotiation-ports.test.ts)

- Probe negotiation returns only immutable session-bound recognition on the supplied read transaction
- malformed declarations and session or fingerprint mismatches reject before transaction admission
- retired boots, foreign evidence, revoked, missing or expired credentials and unavailable TCP facts cannot negotiate
- machine reader binds the supplied fingerprint to its Node, fails closed on missing credentials and detaches facts
- the separate Probe hello endpoint cannot be reached with Bearer or spoofed session headers instead of mTLS

### E101: apps/control/test/probe-instance-registry.test.ts

[Source](../../apps/control/test/probe-instance-registry.test.ts)

- remote registry passes actual machine identity to the owner and emits a detached non-executable response
- typed bypass and verified machine/session mismatch reject before entering any owner operation
- Bearer or session headers do not substitute for verified mTLS on the instance endpoint

### E102: apps/control/test/probe-instance-ports.test.ts

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

### E103: apps/control/test/probe-permit-ports.test.ts

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

### E104: apps/control/test/probe-claims.test.ts

[Source](../../apps/control/test/probe-claims.test.ts)

- closed claim adapter forwards only actual mTLS identity and emits a detached minimized receipt after owner completion
- typed contract bypass and verified Node/session mismatch reject before owner consumption
- owner denial, post-commit expiration and inconsistent owner result cannot manufacture a receipt or retry consumption
- Bearer, claimed fingerprint and session headers never substitute for actual mTLS on the claim endpoint

### E105: apps/control/test/probe-delivery.test.ts

[Source](../../apps/control/test/probe-delivery.test.ts)

- closed delivery adapter forwards actual machine identity and minimizes immutable empty/one/status replies after owner completion
- invalid typed commands, cross-protocol and verified identity mismatch reject before any owner call
- owner denial and pre-commit guard failures propagate without fallback, cached success or a second transaction
- post-commit stale or uncertain clocks and expired results cannot produce discovery or status acknowledgements
- inconsistent owner identity, instance, time or execution markers fail closed after exactly one call
- delivery endpoints never substitute Bearer or claimed headers for actual mTLS

### E106: apps/control/test/probe-results.test.ts

[Source](../../apps/control/test/probe-results.test.ts)

- result adapter delegates once to the owner, awaits commit and returns only a detached receipt
- typed result injection and claimed Node/session mismatch reject before the owner
- failed owner commits propagate without an acknowledgement, fallback or retry
- stale post-commit clocks and inconsistent saved receipts cannot manufacture a result acknowledgement
- result endpoint rejects Bearer and claimed fingerprint without actual mTLS

### E107: apps/control/test/probe-negotiation-mysql-acceptance.test.ts

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

### E108: apps/control/test/probe-permit-mysql-acceptance.test.ts

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

### E109: apps/control/test/optional-http-services.test.ts

[Source](../../apps/control/test/optional-http-services.test.ts)

- ${name} named and positional HTTP wiring admit before authentication, await the owner and release
- ${name} omission, admission refusal, denied authentication and owner failure preserve dispatch boundaries

### E110: apps/control/test/foundation-cancellation.test.ts

[Source](../../apps/control/test/foundation-cancellation.test.ts)

- native signal identity crosses both public cancellation ports without wrappers or altered reason
- a common cancellation provider needs no native EventTarget members for sender pre-admission refusal

### E111: apps/control/test/notification-sender-drain.test.ts

[Source](../../apps/control/test/notification-sender-drain.test.ts)

- a common cancellation registration race removes the same once callback and never enters DNS
- cancelled DNS still owns sender capacity and close waits for the actual callbacks without another lookup or request
- cancelled authorization guards retain capacity until both real guards settle, including a late guard failure
- one pinned HTTPS attempt preserves HTTP rejection versus unknown network outcome without redirect or retry

### E112: apps/control/test/notification-delivery-worker.test.ts

[Source](../../apps/control/test/notification-delivery-worker.test.ts)

- delivery worker commits its bounded claim before leasing secrets, reauthorizes the dispatch and records an unknown result without immediate resend
- revoked manager after claim cancels dispatch and secret unavailability records refusal without using raw credentials or another sender
- failed claim and finish writes roll back their owner transaction without a hidden resend or resetting the existing fence
- worker retains its secret lease and coalesces ticks until sender physical drain, and close joins that drain

### E113: apps/control/test/publication-savepoints.test.ts

[Source](../../apps/control/test/publication-savepoints.test.ts)

- ${name} success keeps result identity and releases after the original action
- ${name} classifies before rollback and projects only after release
- ${name} unknown errors and classifier faults escape without savepoint rollback
- ${name} every savepoint or late projection failure escapes by identity
- publication refusal classifier retains error identity, status bounds, retryable guard and shared mutable code Set

### E114: apps/control/test/audit-owner-transactions.test.ts

[Source](../../apps/control/test/audit-owner-transactions.test.ts)

- 'audit rejects invalid closed queries before clock and authorization before any source read', async () => {
- 'audit sequential source reads share caller transaction and frozen read-only result', async () => {
- 'audit pagination binds cursor to explicit query and rejects corrupt duplicate ordering', async () => {
- 'audit request admission releases capacity after both rejection and successful drain', async () => {
- 'audit store and malformed-row failures release active slots for later independent actors', async () => {

### E115: apps/control/test/station-alert-worker.test.ts

[Source](../../apps/control/test/station-alert-worker.test.ts)

- 'station worker authorizes before locks and atomically appends handoff and state', async () => {
- 'station revoked manager suspends without reading facts or producing events', async () => {
- 'station handoff or state failure rolls back all event effects and defers with original guarded revision', async () => {
- 'station worker rechecks latest revision and prevents overlapping ticks while a fact read drains', async () => {

### E116: apps/control/test/node-observation-ports.test.ts

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

### E117: apps/control/test/node-observation-mysql-acceptance.test.ts

[Source](../../apps/control/test/node-observation-mysql-acceptance.test.ts)

- observation production assembly uses SELECT-only MySQL and preserves scope authorization and database contents
- persisted report provenance and expiry never become independent health or applied-state claims
- a real MySQL authorization lock is stopped by the observation deadline without changing grants or execution state

### E118: apps/control/test/telemetry-owner-transactions.test.ts

[Source](../../apps/control/test/telemetry-owner-transactions.test.ts)

- \`${family} telemetry intake authorizes before stored reads and preserves exact replay receipt without append\`, async () => {
- \`${family} telemetry rollup failure rolls back raw head and releases node admission\`, async () => {
- \`${family} telemetry parser and credential refusal cannot touch persisted head\`, async () => {
- \`${family} telemetry changed replay, epoch and uptime preserve original refusal precedence\`, async () => {
- \`${family} telemetry refuses revoked expired or superseded sessions before locking head\`, async () => {
- \`${family} telemetry history authorizes Scope before Node reads and keeps response non-authoritative\`, async () => {
- \`${family} telemetry request capacity drains and callback errors release capacity\`, async () => {

### E119: apps/control/test/forward-probe-plan-ports.test.ts

[Source](../../apps/control/test/forward-probe-plan-ports.test.ts)

- probe preflight rejects open inputs, coercions and invalid identities before starting a transaction
- preflight uses one authorized read transaction, returns immutable binding and never issues executable authority
- manager and explicit Node Grant checks occur before reading any published execution
- trusted authorization port joins the supplied transaction without starting a nested one or granting execution
- stale revisions and disabled, deleting, recovery-suspended, DNS, UDP-only and Relay intents cannot plan
- metadata remains forbidden even when Forward policy allows it; foreign facts and denied CIDRs fail closed
- missing, expired and incompatible published bindings cannot become a plan
- MySQL projection is scoped, supplied-transaction-only and binds body generation/session/expiry to database rows

### E120: apps/control/test/notification-destination.test.ts

[Source](../../apps/control/test/notification-destination.test.ts)

- notification destinations share the native parser and return canonical HTTPS without credentials or query
- notification destination rejects alternate trust/address channels with the original public error
- notification destination bounds both supplied and canonical URL bytes

### E121: apps/control/test/forward-probe-mysql-acceptance.test.ts

[Source](../../apps/control/test/forward-probe-mysql-acceptance.test.ts)

- probe preflight production API is SELECT-only, manager-plus-grant authorized and never creates commands or execution work
- probe preflight rejects current database/body mismatches, revoked nodes and quarantined intents without writes

### E122: apps/control/test/probe-instance-mysql-acceptance.test.ts

[Source](../../apps/control/test/probe-instance-mysql-acceptance.test.ts)

- real MySQL serializes absent-slot races, replacement and repeated registration across independent application instances
- real MySQL rolls back first-slot seeds and replacement on downstream or maintenance failure; expired retries cannot renew
- real MySQL rechecks credential, session and capabilities before replay, while revocation remains possible after TCP withdrawal
- real MySQL quarantine preserves the stored generation, rejects resurrection and keeps non-instance state unchanged

### E123: apps/control/test/ingress-group-ports.test.ts

[Source](../../apps/control/test/ingress-group-ports.test.ts)

- ingress publication authorizes before replay and rechecks sorted live template grants even for an unchanged definition
- a response persistence failure rolls back ingress head, immutable revision, audit and replay before a same-key retry
- historical ingress descriptions use persisted references but active resolution refuses archived groups before template disclosure
- ingress requires distinct ingress Nodes and common protocols before committing definition state

### E124: apps/control/test/transit-staging.test.ts

[Source](../../apps/control/test/transit-staging.test.ts)

- staging journal is detached immutable and retains independent Scope, generation, digest and Fence proof
- multi-hop MySQL state stores no executable or active states

### E125: apps/control/test/path-topology.test.ts

[Source](../../apps/control/test/path-topology.test.ts)

- Direct path gives the same unique Agent identity a local direct role without a peer
- Current two-node Relay stays ingress then egress; activation remains downstream first
- Three- and four-Node paths derive transient transit roles and exact adjacent peers
- Roles belong to each Forward; an Agent can be ingress, transit and egress simultaneously
- Bounded path allows exactly the maximum without arbitrary cycles
- Invalid, repeated and missing Profile paths refuse planning
- Multi-hop planning does not bypass existing ADP/3 two-node execution boundary
- Topology compiler is detached, deterministic and never mutates the caller

### E126: apps/control/test/transit-reservations-db.test.ts

[Source](../../apps/control/test/transit-reservations-db.test.ts)

- strict reservation refuses same-Forward or foreign physical owner before overwriting fences
- new exclusively free ports acquire monotonically increasing Fences under locks

### E127: apps/control/test/transit-mysql-acceptance.test.ts

[Source](../../apps/control/test/transit-mysql-acceptance.test.ts)

- Transit real MySQL: atomic rollback, concurrent exclusivity and monotonic fences

### E128: apps/control/test/telemetry-rollup-values.test.ts

[Source](../../apps/control/test/telemetry-rollup-values.test.ts)

- 'rollup wide sums and precise counter increments preserve immutable prior bucket', () => {
- 'rollup attribution uses receipt interval end across minute and hour boundaries', () => {
- 'rollup reset gap overflow and terminal precedence never invents an increment interval', () => {
- 'rollup rejects cross-bucket or cross-series reuse before mutating existing values', () => {

### E129: apps/control/test/console-serving.test.ts

[Source](../../apps/control/test/console-serving.test.ts)

- same-origin console assets retain content types, no-store and strict CSP
- console API refuses anonymous scoped list access

### E130: apps/control/test/console-module-assets.test.ts

[Source](../../apps/control/test/console-module-assets.test.ts)

- every distributed Web JavaScript leaf is served byte-exactly with security headers and fixed-path refusal

### E131: scripts/phase2/probe.ts

[Source](../../scripts/phase2/probe.ts)

See the source scenario assertions or configured command steps.

### E132: scripts/test/foundation-boundary-policy.test.mjs

[Source](../../scripts/test/foundation-boundary-policy.test.mjs)

- L0/L1 reject value, type-only, inline import type and re-export dependencies on outer owners
- package private paths and direct private Core leaves remain closed
- unclassified production paths are refused instead of inheriting a module-directory exemption
- cross-owner private value/type/re-export paths and example private imports are rejected
- framework private implementations and direct storage are not product extension points
- lower platform globals/types and native date/parser operations are rejected
- Go lower contracts refuse native tags, parser imports and platform clock reads
- independent browser owners require explicit effects instead of native globals or private sibling services
- dynamic import, require, triple slash native types and computed references cannot bypass lower boundaries
- named operator bindings remain classified but cannot reach product-private implementation leaves
- classification and binding records cannot exempt lower native dependencies or historical imports

### E133: apps/control/test/foundation-compatibility.test.ts

[Source](../../apps/control/test/foundation-compatibility.test.ts)

- legacy and public errors, request lifecycle and native policy retain exact object identity
- public request lifecycle drains after a rejected application action and preserves its error identity
- bootstrap reads both environment values before validation and closes only an opened database
- bootstrap awaits cleanup and a cleanup failure retains finally error precedence

### E134: apps/control/test/foundation-extension.test.ts

[Source](../../apps/control/test/foundation-extension.test.ts)

- the public extension authorizes the caller transaction and returns detached immutable native-format intent
- the public extension refuses invalid identities and closed-format input before transactions and never logs denied intent
- the public extension completes despite logger failure and request draining waits for its actual transaction

### E135: packages/contracts/test/distribution-assets.test.ts

[Source](../../packages/contracts/test/distribution-assets.test.ts)

- all native schema copies preserve source bytes modulo checkout line endings, including the separate execution generator output
- all twenty-one schema resources compile every local definition without remote resolution
- all eleven declared package entries initialize through their actual public export targets
- staged native package initialization refuses missing or malformed schema/catalog while lower common entries remain loadable

### E136: apps/web/test/model.test.mjs

[Source](../../apps/web/test/model.test.mjs)

- scope IDs, ports and CIDRs reject invalid local form inputs
- Direct form only offers authenticated capabilities and authorized listener slots
- Operation state never derives healthy from accepted deployment
- list query encoding preserves server-side filters across bounded pages
- candidate pages keep only bounded current rows and freshly revalidated selections

### E137: apps/web/test/model-effects.test.mjs

[Source](../../apps/web/test/model-effects.test.mjs)

- model aliases preserve function identity and factory initialization does not read native time or effects
- native model credential evaluation preserves getter and parser lookup order even for invalid dates

### E138: apps/web/test/request-effects.test.mjs

[Source](../../apps/web/test/request-effects.test.mjs)

- canonical request factory gives JSON decoding precedence over stale connection and abort/status checks
- canonical mutation factory retains keys after failure, deletes on success, and resets explicitly
- canonical request succeeds only after decode, cancellation, and response checks in order
- canonical request construction is lazy and disconnected mutations prepare a stable key before connection refusal
- native request effects preserve exact fetch framing and caller cancellation reason
- native response checking preserves server code and status with bounded fallback semantics

### E139: apps/web/test/console-flow.test.mjs

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

### E140: apps/web/test/relay-model.test.mjs

[Source](../../apps/web/test/relay-model.test.mjs)

- Relay Profile builder follows bounded native-relay contract
- Relay Endpoint accepts distinct TLS/TCP ports and bounded peer host facts
- Relay spec binds two distinct authorized nodes and immutable Profile revision
- multi-hop editor preserves route order and refuses cycles, missing capabilities and a closed gate

### E141: apps/web/test/probe-flow.test.mjs

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

### E142: apps/web/test/probe-run-history-flow.test.mjs

[Source](../../apps/web/test/probe-run-history-flow.test.mjs)

- manual historical run reads validate legacy and TCP/UDP Echo summaries and display stored evidence without commands
- full stored digest and independent Echo invocation digest reject tampering even when outer summary is resealed
- run detail refuses retention, lifecycle, Scope, status, proof and byte inconsistencies after valid content resealing
- history query rejects invalid windows, limits and status before I/O and preserves the echoed exact filter
- history pages reject mismatched filters, order, duplicate IDs, cursor binding and excessive response size
- next page requires the same frozen query and cursor position and never paginates automatically
- cancel, input edits, clear and Scope changes discard late history without automatic follow-up

### E143: apps/web/test/rule-flow.test.mjs

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

### E144: scripts/check-web.mjs

[Source](../../scripts/check-web.mjs)

See the source scenario assertions or configured command steps.

### E145: packages/contracts/test/native-drivers.test.ts

[Source](../../packages/contracts/test/native-drivers.test.ts)

- native catalog is immutable, versioned, and distinguishes business from physical carrier protocols
- catalog parser refuses new drivers, executable fields, duplicate keys, versions and unbounded metadata

### E146: apps/control/test/upgrade-assessment.test.ts

[Source](../../apps/control/test/upgrade-assessment.test.ts)

- known migration footprints cover tables, multi-column DDL and superseded enums
- CLI dispatch and CI wiring keep assessment read-only and separate real MySQL acceptance
- public assessment dispatch never constructs or mutates Authority and preserves decision exit codes
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
- Probe registry DDL has an explicit Control-only reader ceiling and cannot silently downgrade
- Probe permit DDL has a distinct Control-only ceiling and detects partial ownership tables
- Probe withdrawals have an independent Control-only ceiling and partial migration/backfill requires review
- short-lived Probe results require a new Control-only reader ceiling and reject partial DDL
- immutable path metadata requires a Control-only reader ceiling and rejects all partial three-table footprints
- immutable path provenance requires its own Control-only ceiling and detects partial two-table DDL

### E147: apps/control/test/runtime-publication.test.ts

[Source](../../apps/control/test/runtime-publication.test.ts)

- publication hold requires a live same-session lease beyond the exact five-second boundary
- publication reuse retains exact renewal and credential/Relay caps without importing host authority
- publication deadline chooses the earliest authority and keeps the empty withdrawal policy deadline

### E148: apps/control/test/runtime-host-ports.test.ts

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

### E149: apps/control/test/mysql-migration-statements.test.ts

[Source](../../apps/control/test/mysql-migration-statements.test.ts)

- migration splitting preserves comments and quoted semicolons without joining SQL tokens
- migration splitting respects doubled quotes and native string backslash escapes
- migration splitting follows NO_BACKSLASH_ESCAPES and ANSI_QUOTES without changing SQL text
- executable MySQL comments remain statements and unterminated or client-delimited scripts fail closed
- the four production migrations with semicolons in introductory comments retain complete ordered DDL

### E150: .github/workflows/ci.yml

[Source](../../.github/workflows/ci.yml)

See the source scenario assertions or configured command steps.

### E151: .github/workflows/container.yml

[Source](../../.github/workflows/container.yml)

See the source scenario assertions or configured command steps.

### E152: apps/control/test/runtime-resource-ports.test.ts

[Source](../../apps/control/test/runtime-resource-ports.test.ts)

- resource ports retain the caller transaction, Node session refusal and null versus zero authorization
- Direct reservation sorts physical protocols and refuses even the same existing owner
- Relay reservation orders physical resources while preserving forward protocol and allowing same-owner renewal
- resource capacity failure follows all reservations and propagates for caller rollback
- transition locks prior ownership first and keeps old slots through the drain window
- fence and generation exhaustion refuse writes at the original resource lock boundary
- slot removal preserves enumeration order and exact owner and physical protocol predicates

### E153: scripts/phase2/capacity.ts

[Source](../../scripts/phase2/capacity.ts)

See the source scenario assertions or configured command steps.

### E154: apps/control/test/background-task-effects.test.ts

[Source](../../apps/control/test/background-task-effects.test.ts)

- background effects prevent overlapping work and close joins the active task and stop hook exactly once
- background failure backoff uses completion time, exact thresholds and caps, then resets on success
- background shutdown waits for all independent hooks even when one fails

### E155: apps/control/test/runtime-status-ports.test.ts

[Source](../../apps/control/test/runtime-status-ports.test.ts)

- runtime status decodes report before current and preserves separate current freshness decode in the caller transaction
- runtime status retains lazy malformed-body failure order and absent body/zero timestamp semantics
- runtime status matches generation/fence tuples and marks exact expiry, wrong epoch and missing evidence unknown
- runtime raw status adapter uses only supplied execute and exact original query arguments

### E156: apps/control/test/legacy-entrypoints.test.ts

[Source](../../apps/control/test/legacy-entrypoints.test.ts)

- ${family} pure legacy entries load their exact mapped canonical values and preserve erased runtime surfaces
- legacy aggregate retains its own version and three exact reader constructors while frozen policies stay distinct

### E157: scripts/phase1/acceptance.ts

[Source](../../scripts/phase1/acceptance.ts)

See the source scenario assertions or configured command steps.

### E158: apps/control/test/recovery-quarantine-order.test.ts

[Source](../../apps/control/test/recovery-quarantine-order.test.ts)

- recovery quarantine preserves one transaction, immediate accounts and shared publication time before final event encoding
- recovery quarantine propagates every owner failure and stops subsequent owners/event without retries

### E159: apps/control/test/recovery-workflow-ports.test.ts

[Source](../../apps/control/test/recovery-workflow-ports.test.ts)

- backup protects output, rechecks authority after synchronized dump and publishes signed manifest last
- backup partial failures close the database and never publish a manifest after failed dump or authority recheck
- restore refuses issuers, SQL tamper and unexhausted authority before creating a fresh target
- restore commits quarantine before credentials and authority rebind then closes target before source
- restore distinguishes pre-commit rollback from credential/rebind failure after committed quarantine
- restore preserves partial-target and migrate failures without fabricating rollback or deleting history

### E160: apps/control/test/authority.test.ts

[Source](../../apps/control/test/authority.test.ts)

- authority upper bound is durable and monotonically includes concurrent publishers
- recovery trust/database binding stays quarantined until the exact review ID
- missing or corrupted protected state cannot be initialized from zero
- artifact verification rejects changed data and publication rejects unsafe bounds
- offline recovery refuses stale or future clock observations even when marked synchronized

### E161: apps/control/test/upgrade-mysql-acceptance.test.ts

[Source](../../apps/control/test/upgrade-mysql-acceptance.test.ts)

- upgrade assessment preserves MySQL, authenticated journals and Authority; rejects unsafe restores and interrupted DDL

### E162: scripts/check-boundaries.mjs

[Source](../../scripts/check-boundaries.mjs)

See the source scenario assertions or configured command steps.

## Acceptance Decision

Do not freeze the foundation public interfaces or open product parallel work from
CI totals alone. Close the concrete remaining obligations above, record applicable
exact-source execution and consciously define the accepted public-interface scope.
The current evidence map is a completed audit artifact; B acceptance is unfinished.

Only durable regression tests and this final map are retained. Temporary per-agent
JSON, PR body scratch and downloaded logs are removed after integration. Historical
Actions runs remain the immutable execution record.

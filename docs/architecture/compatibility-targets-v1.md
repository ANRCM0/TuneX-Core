# Compatibility Targets v1

Date: 2026-10-18 (Asia/Shanghai).
Status: source support inventory; current-source acceptance pending.

Compatibility is explicit adaptation to a named target and refusal of unsupported
input. An import barrel or a parser existing in the repository does not establish
compatibility with every older system or third-party API.

| Target | Current source route | Promise and refusal |
| --- | --- | --- |
| Current ADP/3 and execution extension 1 | RuntimeCodec, existing closed TS/Go contracts | Preserve exact supported shapes, capabilities and persisted readers; unknown versions/fields do not fall back |
| Native Direct/Relay/multihop assignment schema 1 | L2 nativeLedgerCompiler/nativeRelayCompiler; existing catalog and Agent registry | Same native compilers relocated behind L1 ports; existing platform/role/phase/protocol/gate rules; compilation or registration is not authority |
| Historical ADP/2 | Explicit legacy contract entry | Offline/historical readers only; production Control still rejects ADP/2 |
| MySQL authoritative Runtime storage | State/resource/ledger stores and Relay deployment/observation adapters over existing MySqlUnitOfWork | Original tables and caller transaction/lock/SQL intent; no second ledger, SQLite/PostgreSQL or generic repository compatibility claim; equivalence unverified |
| Current Node control/Relay credential lifecycle | NodeAuthorityHost, Node store/machine lookup, original NodeCertificateAuthority signer and secrets/native codec | Preserve current signing purposes/key restrictions, replay, expiry, overlap and revocation; no new CA or trust root, provider or behavior acceptance claim |
| Current Control bearer/Scope/member lifecycle | IdentityAccessHost, identity-owner public service/queries, MySqlIdentityStore/separate account lookup and native codec/secrets | Original header/token grammar, hashes, pool/transaction split, locks, errors, member revision/role/audit and explicit recovery ordering; no identity migration, new authority or acceptance claim |
| Current Transport Profile and Relay endpoint management | Independent transport-owner/relay-endpoint-owner services; L1 configuration ports, L2 MySQL/native codec and old constructors/helpers | Same pinned Profile/grant/digest, normalization, key/revision/idempotency, ordered locks and Node audit/refusal; changed active endpoints remain unsupported, no new withdrawal, protocol, authority or acceptance claim |
| Current Forward intent and idempotency state | L1 ForwardIntentStore/IdempotencyStore/StoredValues, L2 MySQL intent stores and stored-value adapter, old Forwarding/Idempotency bridges | Same filtered reads, lazy JSON, revision/current-row writes, affected-row conflict, recovery flags, request digest/replay/status and caller transaction; no second ledger, retry, reset or acceptance claim |
| Current path/ingress management contracts | Independent application APIs, existing owner ports and IngressGroupResolver; old config/limit exports retained | Preserve exact immutable references, paging/provenance, same transaction, per-item receipts/CAS/replay/conditional compensation and restored-state refusal; no automatic selection, shared listeners, global membership, new execution authority or acceptance claim |
| Current Probe management/machine interfaces | Independent Forward/machine APIs, Probe and observation-service public owners, original transactional stores and direct legacy aliases | Original preflight/acceptance distinction, v1/v2/v3 identity/qualification/one-use/withdrawal/short observations/result history and commit-before-ACK; no echo route/version, renewal, refund, health/authority or acceptance claim |
| Current management SQL projections | Raw management/profile/tunnel read stores, synchronous L3 projections, native stored-value/time/ISO effects and original reader/helper aliases | Original SELECT/filter/parameter/page/read/format/error/auth transaction intent; no new pool/write/retry/snapshot consistency/authority/health claim; callback and compatibility equivalence unverified |
| Current Agent execution adapters | Generic executionhost HostVersion 1; old typed executiondriver aliases/actual-OS binding and nativeexecution Direct/Relay/Multihop implementations | Same descriptor/clone/refusal/zero-value/native format/phase/cleanup/check/error intent and Runner persist-before-sockets; no new driver/protocol/capability/default/echo/authority or acceptance claim |
| Linux Agent process observation | platformobservation process Linux implementation | Existing rusage and file-descriptor measurements; same OS-visible process scope |
| Other Agent process observation platforms | platformobservation non-Linux implementation | Unsupported fields remain absent; does not claim new Windows resource measurements |
| Current Linux/Windows execution timing | L1 executiontime decisions; L2 platformclock OS counters/status; old proof/authorization entries | Preserve suspend-aware uptime, wall resampling, same-host/platform binding, cache/error/freshness and Guard cutoffs; unsupported OS still refuses |
| Authenticated Runtime Journal acceptance | L1 executionstate host with original state native/MAC/store adapters | Preserve exact wire/JSON history, Fence/session/phase rules and persist-before-sockets; no cached execution authority, new store or automatic migration |
| Protected file/instance primitives | L2 platformstate via old state exports | Original lock and atomic write/fsync/rename semantics, with existing Windows directory-sync handling; native acceptance still pending |
| Current Agent machine/Relay credential files | executionidentity port, native agentidentity provider, old helper/construction entries | Same CSR/key/Node/chain/pin/expiry/overlap/replay and atomic/MAC files; configured CA remains authority, no missing-state fallback on later verification failure |
| Current Agent Control/Probe/telemetry HTTPS channels | executionchannel main/Auxiliary ports and native controlchannel provider | Same dynamic mTLS, isolated telemetry pools, per-profile URL/redirect rules, epoch/read/close/deadline behavior; no added retries, routing, claims or authority |
| Current Agent bootstrap/operational scheduling | runtimeplatform ports and native platformruntime providers | Preserve initialization refusal, original read/credential/migration/client order and standard timer/context semantics; operational scheduling does not replace Guard evidence |
| Agent-visible host resources | runtimeobservation value/Provider contract, platformobservation.Native/CaptureHost and old aliases | Original bounded Linux reads/fields and non-Linux unsupported values; no physical-host/cgroup-health/capacity claim |
| Agent runtime/process provenance and local measurements | runtimeobservation.Provider plus runtimeplatform MeasurementFiles/LocalLog; native platformobservation/platformruntime | Preserve individual read/lock order, PID/platform/goroutine/memory observations, disabled/configured diagnostic and sibling counter paths, modes/atomic writes and existing stderr calls; no new authority or health meaning |
| Agent telemetry epoch and Probe request entropy | runtimeplatform.Entropy, platformruntime.Local, old private helper wrappers | Original secure full-buffer/error source, 16/32-byte reads and lowercase hex; no weak fallback, cached ID, extra retry or new echo behavior |
| `tunex-flat-forward` format version 1 | flatForwardAdapter | Demonstration of closed flat input to current intent; no execution, no TuneX V2/third-party import promise |
| Experimental Transit and staged echo | Explicit experimental/staged contracts | Not accepted production compatibility or complete execution capability |
| Other legacy systems/external engines | No approved adapter in this source scope | Unsupported until a named target/version, contract, security/lifecycle policy and acceptance are supplied |

New adapters must document exact target/version, normalization, unsupported fields,
error mapping, current authorization, budgets, configuration and ownership. Stateful
or executable integration needs its original command/host authority and recovery
semantics. Do not add platform/legacy branches in feature modules, silently choose
latest revisions, widen accepted schemas or retry an unknown external side effect.

Process observations, timing decisions/native clock queries and protected file
primitives now have explicit source boundaries; the Node signer also has an
injected port. Runner scheduling/credentials/TLS/HTTP, host resources and other
sender/trust integrations still need owner/layer work. Do not infer that all
platform code is isolated or that any native acceptance passed.

## Probe And Observation Owner Source Continuation (2026-10-19)

Probe and observation-service public owner entries are source interface candidates,
not protocol versions or accepted compatibility claims. Original shared rules and
storage value providers have one owner-local implementation; old helper/value paths
are direct aliases. The explicit declaration reader preserves the old head/revision
Pick shape. Legacy zero-argument SQL classes retain their public methods, subclass
entrypoints and original lower implementation. Readiness item 51 covers unexecuted
identity, shape, initialization, rejection-order and same-transaction evidence.

Application/persistence qualification differences and staged planner versus command
issuance differences remain unchanged. No echo issuance, renewal, refund, migration,
new authority or history reset is added. See
[owner collaboration](probe-owner-collaboration-v1.md) for full chains and removal
conditions. Direct wire/native/classification and all acceptance gates remain open.

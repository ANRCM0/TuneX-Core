# Control Source Closure v1

Date: 2026-10-19 (Asia/Shanghai).
Status: manual A5 source classification and compatibility ledger; no executed
import graph, type check, behavior acceptance or frozen revision evidence.

## Scope And Method

This record covers `apps/control/src/kernel`, `framework`, `compatibility`,
`infrastructure`, `api`, every `modules/*-owner` directory and the five existing
root commands. Application and old module/runtime leaves have separate inventories.
The directory/leaf inventory below comes from source navigation; imports, public
entries, the root construction paths and the specific legacy reader bodies were
read. It is not a claim of executing a recursive dependency analysis or reviewing
every algorithm body anew. Existing FR and owner documents remain the semantic
record; this ledger connects their concrete source names and retained callers.

The six-part task scope is L0-L3 classification, using existing kernel/framework/
compatibility and owner public entries; foundation records are touched; FR-0025
adds cancellation v1, advances Notification effects to v2 and gives the changed
Node report read context explicit v2; all acceptance below is planned, not executed;
the other parallel source slices retain exclusive application/Agent/Web/shared
inventory ownership. No tests, type/syntax/static/boundary checks, formatters,
generators, builds, CI, network experiments or Git writes were run in this slice.

## Kernel And Framework Leaves

All paths in this section are relative to `apps/control/src`.

| Owner | Named leaves and dependency direction | Actual outer binding |
| --- | --- | --- |
| L0 runtime decisions | `kernel/public.ts`, `publication.ts`; validated facts to pure hold/reuse/deadline decisions | `framework/runtime-host.ts` imports the public entry; no new Core export or native default |
| L1 common lifecycle | `framework/public.ts`, `application-ports.ts`, `background-tasks.ts`, `errors.ts`, `forward-import.ts`, `idempotency.ts`, `module-log.ts`, `pagination.ts`, `request-identity.ts`, `request-lifecycle.ts`, `idempotency.md` | Existing application aliases, server request/task assembly, owner services and public example. Effects are supplied; old error class identity and request/idempotency ownership remain |
| L1 cancellation | `framework/cancellation-ports.ts` | FR-0025 cancellation v1 replaces platform-global signal types in Node report read v2 and Notification effects v2. Native controller/signal identity and existing runtime call bodies remain with their original consumers |
| L1 Identity/Node | `identity-access.ts`, `identity-access-ports.ts`, `node-authority.ts`, `node-authority-ports.ts`, `node-facts.ts`, `node-report-read-ports.ts`, `machine-session-lock-ports.ts` | Identity/Node public owners plus original secret/PKI/MySQL providers. Independent account/machine lookup is explicitly pool backed at L2, not a new transaction/authority |
| L1 Runtime coordination | `runtime-host.ts`, `runtime-host-ports.ts`, `runtime-contracts.ts`, `runtime-assignment-ports.ts`, `runtime-evidence-read-ports.ts`, `runtime-ledger.ts`, `runtime-ledger-ports.ts`, `runtime-relay.ts`, `runtime-relay-ports.ts` | Existing RuntimeController/RuntimeLedger/RelayCoordinator compatibility constructors bind providers; application and server share the existing ledger |
| L1 Runtime resources | `runtime-resources.ts`, `runtime-resource-ports.ts`, `runtime-exclusive-reservations.ts`, `runtime-exclusive-reservation-ports.ts`, `runtime-reservation-release.ts`, `runtime-reservation-release-ports.ts` | Original MySQL resource providers and Transit/ledger/Node supplied collaborators; resources do not publish or mint authority |
| L1 storage/read/effect contracts | `forward-diagnostic-store-ports.ts`, `ingress-deployment-storage-ports.ts`, `ingress-group-storage-ports.ts`, `ingress-migration-storage-ports.ts`, `intent-store-ports.ts`, `management-read-ports.ts`, `notification-effects-ports.ts`, `notification-store-ports.ts`, `observation-read-store-ports.ts`, `observation-recovery-storage-ports.ts`, `path-binding-storage-ports.ts`, `path-group-storage-ports.ts`, `path-publication-storage-ports.ts`, `path-template-storage-ports.ts`, `probe-history-store-ports.ts`, `probe-permit-storage-ports.ts`, `probe-registration-store-ports.ts`, `publication-recovery-storage-ports.ts`, `recovery-event-storage-ports.ts`, `relay-configuration-ports.ts`, `runtime-status-storage-ports.ts`, `station-alert-store-ports.ts`, `telemetry-rollup-store-ports.ts`, `telemetry-store-ports.ts`, `transit-coordination-storage-ports.ts`, `transit-delivery-storage-ports.ts`, `transit-staging-storage-ports.ts` | Public owner contracts specialize generic storage records and values; original MySQL stores implement these contracts in the supplied transaction |

Internal framework type references are same-owner collaboration, including
`application-ports.ts`; its filename does not denote the outer `application/`
directory. Framework's common execution family is the precise contracts policy,
execution-observation and execution-values leaves. Native family specialization
and serialization belong outside L1. Public counters are independent, as listed
in the candidate index; the framework barrel's version does not replace the
Runtime host/ledger/resource/relay or storage interface counters.

## Compatibility Leaves

These are L2 representation/platform effects. Same-owner leaf imports are
intentional. Product use selects the declared `compatibility/public.ts`, or the
narrow HTTP public entry below. An exported native type is still native and does
not become a common L1 type when an L3 owner consumes it.

| Family | Exact leaves | Existing consumers and defaults |
| --- | --- | --- |
| Common formats | `public.ts`, `stored-value.ts`, `flat-forward.ts`, `native-codecs.ts`, `native-module-values.ts`, `native-identity.ts`, `native-node-codec.ts`, `native-target-policy.ts` | Stored SQL decoding, Identity/Node grammar/secrets representations, owner ID/digest/time/JSON requests; old aliases remain the same declaration/function |
| Runtime/Relay/Path | `runtime-codec.ts`, `native-runtime.ts`, `native-runtime-family.ts`, `native-runtime-catalog.ts`, `native-runtime-status.ts`, `native-relay-plan.ts`, `native-relay-configuration.ts`, `native-relay-endpoint.ts`, `native-relay-resources.ts`, `native-relay-assignment-policy.ts`, `native-multihop-plan.ts`, `native-path-topology.ts` | Original compiler objects/catalog, RuntimeStatusQueries, profile/endpoint/Forward/Path/Ingress owners, offline plan command. Native ADP family does not broaden live protocol support; multihop stays gated |
| Probe/observation | `native-observability-codecs.ts`, `native-observation-values.ts`, `native-observation-lifecycle.ts`, `native-diagnostic-probe.ts`, `native-probe-machine.ts`, `native-probe-result.ts`, `native-probe-result-codec.ts`, `native-probe-echo-values.ts`, `native-probe-history-echo.ts`, `native-telemetry-acks.ts` | Existing Probe machine/permit/result/history, diagnostic, telemetry and passive observation owners. Historical Echo decode is distinct from realtime Echo v4 admission |
| Transit | `native-transit-machine.ts`, `native-transit-delivery.ts`, `native-transit-preparation.ts` | Existing Transit owner contracts and old runtime wrappers; native encoding does not authorize live Transit execution |
| HTTP | `native-http-codecs.ts`, `native-http-queries.ts`, `native-control-app.ts`, `native-control-http.ts`, `control-http/public.ts` | Existing `api/routes.ts` and native HTTP factory/session/query/fingerprint/header/withdrawal effects. Narrow public HTTP interface remains version 1 |
| Startup/commands | `native-background-tasks.ts`, `native-control-startup.ts`, `native-control-server.ts`, `native-control-bootstrap-command.ts`, `native-control-client-cli.ts`, `native-operator-command.ts` | Existing server/main/bootstrap/client and operator command owners; environment/process/HTTPS/fs/timer effects stay native. Protected notification path validation retains original timing and exclusions |
| Recovery/upgrade | `native-recovery.ts`, `native-upgrade-format.ts`, `native-upgrade-inspection.ts` | Recovery/upgrade owners and existing ops command roots. File/process/SQL/trusted-time/authority inspection stay explicit; native AuthorityRecord aliases do not grant mutation authority |
| Notification | `native-notification-destination.ts`, `native-read-projection.ts` | Existing endpoint/delivery URL representation and read-model time/JSON projection values; no delivery permission follows from parsing |

The original public version declarations stay at their own entries: HTTP,
bootstrap native, operator native, recovery native and compiler/runtime family
versions are not interchangeable. Barrel loading is itself a compatibility
consideration; no old value bridge is mechanically redirected through a broader
barrel in this slice.

## Infrastructure Leaves

`infrastructure/mysql.ts` is L2 UnitOfWork/Transaction/migration machinery, with
mysql2-native transaction identity, guarded READ COMMITTED transactions, original
limited lock retries, release/rollback and migration advisory lock/DDL semantics.
It is not an L1 transaction type. Schema and protected authority ownership remain
unchanged; partial DDL is not globally rolled back.

Verification adds private L2 `mysql-migration-statements.ts` under that same
owner. It preserves SQL slices and ordered DDL while excluding comment/quoted
semicolons from statement boundaries, reads the connection's quote mode without
changing it, and refuses malformed or client-DELIMITER input. It creates no new
transaction, authority or public service. Its pure cases and fresh-MySQL migration
acceptance are recorded with the verification candidate.

| L2 provider family | Exact leaves | Binding/consumer |
| --- | --- | --- |
| Authority/platform/security | `authority.ts`, `identity-secrets.ts`, `pki.ts`, `multihop-release.ts`, `notification-https.ts`, `notification-secrets.ts`, `station-alert-storage-native.ts` | Existing server/ops/native assembly; AuthorityStore remains the original protected store; PKI/credential files and controlled HTTPS keep native boundaries |
| Bootstrap and common | `mysql-control-bootstrap.ts`, `mysql-read-pagination.ts`, `mysql-management-read.ts`, `mysql-identity.ts`, `mysql-node-authority.ts`, `mysql-node-observation.ts`, `mysql-intent-store.ts`, `mysql-relay-configuration.ts` | Existing server, Identity/Node constructors and Control composition. Raw management stores receive owner validation/projection effects explicitly rather than importing product implementations |
| Runtime | `mysql-runtime-host.ts`, `mysql-runtime-ledger.ts`, `mysql-runtime-relay.ts`, `mysql-runtime-resources.ts`, `mysql-runtime-status-store.ts` | One framework host/ledger/relay/resource set and runtime-status owner. Resource factory preserves the original capacity supplied by server policy |
| Path/Ingress | `mysql-path-template-store.ts`, `mysql-path-binding-store.ts`, `mysql-path-group-store.ts`, `mysql-publication-store.ts`, `mysql-path-publication-recovery-store.ts`, `mysql-ingress-group-store.ts`, `mysql-ingress-deployment-store.ts`, `mysql-ingress-deployment-recovery-store.ts`, `mysql-ingress-migration-store.ts`, `mysql-ingress-migration-recovery-store.ts` | Corresponding public owners; supplied Tx, original tables/locks/revisions/CAS/publication lineage and recovery event ordering |
| Probe/observation | `mysql-probe-history-store.ts`, `mysql-probe-instance-store.ts`, `mysql-probe-permit-store.ts`, `mysql-probe-plan-store.ts`, `mysql-probe-qualification-store.ts`, `mysql-probe-machine.ts`, `mysql-probe-permit-intents.ts`, `mysql-probe-read.ts`, `mysql-observation-service-store.ts` | Existing Probe/history/plan/declaration owners, original admission and consumed/withdrawn history, no new permit/instance authority |
| Transit | `mysql-transit-coordination-store.ts`, `mysql-transit-delivery-store.ts`, `mysql-transit-staging-store.ts`, `mysql-transit-machine.ts` | Corresponding Transit public owners and original runtime assembly; contract/offline boundaries remain |
| Observability | `mysql-audit-read-store.ts`, `mysql-forward-diagnostic-read-store.ts`, `mysql-forward-telemetry.ts`, `mysql-forward-telemetry-mapping.ts`, `mysql-host-telemetry.ts`, `mysql-probe-telemetry.ts`, `mysql-probe-telemetry-mapping.ts`, `mysql-telemetry.ts`, `mysql-telemetry-rollup-storage.ts`, `mysql-telemetry-recovery-store.ts`, `mysql-station-alert-storage.ts`, `mysql-station-alert-fact-store.ts`, `mysql-station-alert-recovery-store.ts`, `mysql-recovery-event-store.ts` | Server/Control public projection and measurement owners; recovery owns supplied-Tx sequencing while providers retain SQL |
| Notifications | `mysql-notification-endpoint-store.ts`, `mysql-notification-outbox-store.ts`, `mysql-notification-recovery-store.ts` | Endpoint/delivery/recovery owners; original binding, terminal evidence, attempt/rate boundaries and no automatic replay |

The following are **retained legacy assembly/type bridges**, not pure L2 providers
and not a precedent for a lower store to import an upper product owner. This
distinction includes type references, not just value imports.

| Legacy leaf | Exact product/lower assembly | Real retained consumers and removal condition |
| --- | --- | --- |
| `mysql-console-read.ts` | Module-level `ConsoleReadModels` from old `application/management-read-models.ts`, filters from old `application/console-query.ts`, one `MySqlManagementReadStore`, native projection values; old `consolePageSql` forwarding | `console-read.test.ts`, `console-mysql-acceptance.test.ts`, `console-diagnostics.test.ts`; migrate these constructors/prototype methods and helper import, preserve module initialization/zero-arg behavior before removal |
| `mysql-transport-read.ts` | Module-level old application aggregate -> `TransportReferenceReadModels`, lower profile reference store and native projection | `transport-query-mysql-acceptance.test.ts`; migrate explicit reader binding and verify original optional revision/default behavior |
| `mysql-tunnel-read.ts` | Module-level old application aggregate -> `TunnelReadModels`, lower metadata store and native projection | `tunnel-query-mysql-acceptance.test.ts`; migrate reader binding with original node/endpoint/peer/references semantics |
| `mysql-runtime-observations.ts` | Extends public `RuntimeStatusQueries`, constructs raw status store/native codec using supplied policy, keeps own `status` prototype method | Existing runtime controller compatibility constructor; replace only together with caller construction/prototype/subclass compatibility and exact freshness/recursive status evidence |
| `mysql-audit-events.ts` | Module-level public `AuditReadModels`/`auditStoragePolicy` and raw audit store | Old zero-argument/prototype reader contract; production server binds owner projection explicitly. Remove only with retained compatibility imports/fixtures migrated |
| `mysql-path-templates.ts`, `mysql-path-bindings.ts`, `mysql-path-groups.ts` | Old owner type-specialized methods over lower template/binding/group stores; module-level store identity retained | Path template/binding MySQL acceptance and binding-port fixtures still name old classes. Group API retained as old compatibility surface; remove only after old API commitments/fixtures migrate |
| `mysql-path-publications.ts`, `mysql-ingress-groups.ts`, `mysql-ingress-deployments.ts`, `mysql-ingress-migrations.ts` | Public owner DTO/method views and original owner storage-value bindings over lower stores | Legacy exported constructors/static recovery/typed surface; production uses lower stores. Removal must include caller/fixture migration and source type compatibility, supplied Tx and shared recovery clock behavior |
| `mysql-probe-instances.ts`, `mysql-probe-permits.ts` | Owner type-specialized lower registration/permit stores with original storage values | Probe instance/permit/negotiation MySQL tests and instance-port fixtures retain imports; migrate those plus static quarantine/default time behavior before removal |
| `mysql-probe-plans.ts`, `mysql-probe-runs.ts`, `mysql-probe-type-qualifications.ts`, `mysql-observation-services.ts` | Public plan/history/qualification/declaration types, lower stores and original owner storage values | Retained legacy API/type/static quarantine surfaces; remove only after public contract commitments and fixtures migrate; preserve history and suspension rather than issue/requeue |
| `mysql-notification-endpoints.ts`, `mysql-notification-deliveries.ts`, `mysql-station-alerts.ts`, `mysql-telemetry-rollups.ts` | Public product types/storage values with lower endpoint/outbox/station/rollup providers | Retained old construction/prototype/static interfaces; server already binds lower stores directly. Migrate remaining compatibility consumers with original lazy decode/default timestamp/terminal status behavior |
| `mysql-forward-diagnostics.ts` | Raw diagnostic store with framework storage aliases, retained old diagnostic entry | Existing old import/API commitment; retire only with fixture/source contract migration, not by deleting the public exported class |

Names without a located live production import above are not asserted dead.
Exported compatibility obligations and fixture consumers are explicit reasons to
retain them. A later authorized import-graph check must account for external old
consumers and negative rules rather than silently deleting apparently unused APIs.

## Product Owner Leaf Map

All rows use `modules/<owner>/public.ts` as cross-owner entry. `public.ts` in each
row is listed once implicitly. Same-owner implementation leaves remain private;
old application/module re-exports have exact compatibility scopes in their own
inventories. Contracts/API/storage-value projections do not grant SQL ownership.

| Owner | Exact other leaves | Actual composition/consumer boundary |
| --- | --- | --- |
| `audit-owner` | `api.ts`, `contracts.ts`, `policy.ts`, `read-models.ts`, `service.ts` | Server AuditEvents/AuditReadModels, HTTP audit contract, old MySQL audit wrapper |
| `console-query-owner` | `contracts.ts`, `http-query.ts`, `read-models.ts`, `rules.ts`, `service.ts` | Control/HTTP ConsoleQueries and server read models; exact old HTTP query bridge retained |
| `control-bootstrap-command-owner` | None; the existing public leaf contains contracts and orchestration | Root bootstrap passes native DB/environment/log effects and original Identity bootstrap callback |
| `control-client-command-owner` | `contracts.ts`, `service.ts` | Root client with native environment/read/network/output effects |
| `control-query-owner` | `contracts.ts`, `service.ts` | Control composition, public Forward read and Runtime deployment/operation/observation readers; HTTP ControlDetailApi |
| `control-startup-owner` | `contracts.ts`, `server-preflight.ts`, `service.ts` | Main startup and server preflight; native release/default effects supplied |
| `forward-diagnostic-owner` | `api.ts`, `contracts.ts`, `policy.ts`, `service.ts` | Server diagnostic service, native probe projections, public Probe binding predicates and raw diagnostic store |
| `forward-owner` | `command-api.ts`, `command-ports.ts`, `commands.ts`, `contracts.ts`, `execution-contracts.ts`, `execution-registry.ts`, `execution.ts`, `native-adapters.ts`, `relay-assignment-source.ts`, `service.ts`, `snapshot-assignments.ts`, `README.md` | Control and original Runtime compatibility assembly; public Path binding/group/publication, Node authorization and native compiler/catalog. No competing ledger |
| `identity-owner` | `access-reconciler.ts`, `command-api.ts`, `command-effects.ts`, `commands.ts`, `contracts.ts`, `execution-ports.ts`, `service.ts`, `README.md` | Existing Identity bridge, Control access commands and Recovery; public Node grants/Forward references plus L1 IdentityAccessHost |
| `ingress-owner` | `contracts.ts`, `deployment-api.ts`, `deployment-storage-values.ts`, `deployments.ts`, `group-api.ts`, `groups.ts`, `limits.ts`, `migration-api.ts`, `migration-contracts.ts`, `migration-storage-values.ts`, `migration-values.ts`, `migrations.ts`, `recovery.ts`, `values.ts` | Control and HTTP group/deployment/migration APIs, public Path/Forward contracts and supplied L1 stores; storage values alias the original public Path publication values |
| `native-driver-owner` | `contracts.ts`, `service.ts` | Control driver query and native public catalog; metadata is no readiness/execution authorization |
| `native-tunnel-owner` | `contracts.ts`, `service.ts` | Control/HTTP tunnel command orchestration over public Path/Forward and native representations |
| `node-observation-owner` | `api.ts`, `contracts.ts`, `rules.ts`, `service.ts` | Passive HTTP Node observation, native lifecycle/value effects and existing public Node/Probe facts |
| `node-owner` | `change-reconciler.ts`, `command-api.ts`, `command-effects.ts`, `commands.ts`, `contracts.ts`, `execution-contracts.ts`, `execution-ports.ts`, `grant-contracts.ts`, `management-contracts.ts`, `policy.ts`, `service.ts`, `README.md` | Existing Nodes bridge, Control management, public Forward/Identity and L1 NodeAuthorityHost. PKI/SQL remain injected lower providers |
| `notification-owner` | `api.ts`, `deliveries.ts`, `delivery-contracts.ts`, `delivery-values.ts`, `endpoint-contracts.ts`, `endpoint-storage-values.ts`, `endpoint-values.ts`, `endpoints.ts`, `outbox-storage-values.ts`, `policy.ts`, `recovery.ts` | Server endpoint/delivery/station wiring, HTTP and recovery; original secrets/sender/authority binding supplied, no ambient platform branch |
| `observation-service-owner` | `api.ts`, `contracts.ts`, `reference.ts`, `service.ts`, `storage-values.ts`, `values.ts` | Server and HTTP declaration service, public Probe service reference, recovery supplied-Tx operation |
| `operator-command-owner` | `contracts.ts`, `service.ts` | Ops command root supplies native process/env/output effects and existing recovery/upgrade work |
| `path-owner` | `binding-api.ts`, `binding-contracts.ts`, `binding-values.ts`, `bindings.ts`, `group-api.ts`, `group-contracts.ts`, `group-values.ts`, `groups.ts`, `limits.ts`, `publication-api.ts`, `publication-contracts.ts`, `publication-storage-values.ts`, `publication-values.ts`, `publications.ts`, `recovery.ts`, `references.ts`, `template-api.ts`, `template-contracts.ts`, `template-state.ts`, `template-values.ts`, `templates.ts` | Control/HTTP templates/bindings/groups/publications, public Forward/Ingress consumers and original supplied-Tx stores |
| `probe-history-owner` | `api.ts`, `contracts.ts`, `policy.ts`, `service.ts`, `storage-values.ts`, `values.ts` | Server/HTTP history reads, Probe permit/result recorder and recovery. Native Echo historical projection remains distinct from live machine admission |
| `probe-owner` | `claims.ts`, `command-api.ts`, `delivery.ts`, `forward-commands.ts`, `forward-plans.ts`, `instance-contracts.ts`, `instance-registry.ts`, `instance-storage-values.ts`, `instances.ts`, `machine-api.ts`, `machine-contracts.ts`, `machine-policy.ts`, `measurement-contracts.ts`, `measurements.ts`, `negotiation.ts`, `observation-services.ts`, `owner-contracts.ts`, `permit-contracts.ts`, `permit-state.ts`, `permit-storage-values.ts`, `permits.ts`, `plan-contracts.ts`, `qualification-policy.ts`, `qualification-storage-values.ts`, `qualifications.ts`, `result-contracts.ts`, `results.ts`, `service-contracts.ts`, `services.ts`, `types.ts` | Control and nine HTTP machine APIs; public history/declaration/Forward/Node/native collaborators; original one-use permits/commit-before-ACK and instance generations remain with this owner |
| `probe-plan-owner` | `api.ts`, `contracts.ts`, `policy.ts`, `service.ts`, `storage-values.ts`, `values.ts` | Server scheduled plan issuer callback to Control public Probe commands, HTTP plan and recovery; schedule enablement stays explicit |
| `recovery-owner` | `contracts.ts`, `quarantine.ts`, `workflow-contracts.ts`, `workflow.ts` | Ops recovery with public owner supplied-Tx quarantine operations and native authority/backup/database effects; original event/credential/rebind order |
| `relay-endpoint-owner` | `contracts.ts`, `service.ts`, `README.md` | Existing RelayEndpoints bridge, HTTP and Control; native resolver/codec and supplied original store |
| `relay-plan-owner` | `contracts.ts`, `ports.ts`, `service.ts` | Control/HTTP relay preview, native compiler and public resource/Node/Forward facts; preview does not issue authority |
| `runtime-status-owner` | `contracts.ts`, `service.ts` | Control query and old MySqlRuntimeObservations bridge; raw store plus native codec and policy, recursive product health aggregation remains here |
| `station-alert-owner` | `api.ts`, `contracts.ts`, `handoff.ts`, `policy.ts`, `recovery.ts`, `service.ts`, `storage-values.ts`, `values.ts` | Server/HTTP alerts and public notification handoff; supplied facts/storage, owner episode/armed policy and recovery |
| `telemetry-owner` | `api.ts`, `forward-contracts.ts`, `forward-mapping-contracts.ts`, `forward.ts`, `host-contracts.ts`, `host.ts`, `node-contracts.ts`, `node.ts`, `policy.ts`, `probe-contracts.ts`, `probe-mapping-contracts.ts`, `probe.ts`, `recovery.ts`, `rollup-contracts.ts`, `rollup-storage-values.ts`, `rollup-values.ts`, `rollups.ts` | Server four measurement families/rollup recorder, HTTP and recovery. Original distinct family limits, mapping and serial pruning slots remain |
| `transit-owner` | `contracts.ts`, `coordination-contracts.ts`, `coordination-step.ts`, `coordination-values.ts`, `coordination.ts`, `delivery.ts`, `negotiation.ts`, `preparation-contracts.ts`, `preparation.ts`, `reservation-values.ts`, `reservations.ts`, `stage-values.ts`, `staging-contracts.ts`, `staging.ts` | Original runtime Transit wrappers, framework exclusive resources/release and public Forward/Transport/endpoint contracts; no additional execution authorization |
| `transport-owner` | `contracts.ts`, `grant-api.ts`, `grant-commands.ts`, `grant-reconciler.ts`, `queries.ts`, `query-contracts.ts`, `query-read-models.ts`, `service.ts`, `README.md` | Existing Transport bridge and Control/HTTP Profile/grants/readers, public Node/Forward references, native configuration and original supplied-Tx stores |
| `tunnel-query-owner` | `contracts.ts`, `read-models.ts`, `service.ts` | Control/HTTP query and old MySQL reader bridge; native projection values plus lower metadata store |
| `upgrade-assessment-owner` | `contracts.ts`, `inspection-ports.ts`, `inspection.ts`, `internal-contracts.ts`, `rules.ts` | Ops assess/inspect commands and native schema/authority/journal inspection; assessment stays read-only and is not migration acceptance |

Public versions remain the explicit owner/API constants in the public leaves and
the candidate index. Transport module version 2 is intentional; a module version
1 does not collapse its command, machine, query, recovery or external wire version.
README leaves are integration documentation, not executed entrypoints.

## HTTP And Existing Root Entries

`api/contracts.ts` declares the L3 HTTP view using public owner contracts and L1
Runtime/request/admission ports. `api/routes.ts` is the existing HTTP assembly:
it consumes these services and narrow native HTTP effects; it does not become a
new service locator for product owners. `api/public.ts` is the public factory;
`api/app.ts` forwards that public factory and `application-ports.ts` forwards the
same contracts. Native Hono environment/app types are exposed by the narrow L2
HTTP public entry, not imported back into common L1 ports.

The exact native query adapters are `audit-query.ts`, `ingress-query.ts`,
`notification-delivery-query.ts`, `observation-service-query.ts`,
`path-group-query.ts`, `path-publication-query.ts`, `path-template-query.ts`,
`probe-plan-query.ts`, `probe-run-query.ts`, `station-alert-query.ts`,
`telemetry-query.ts`, `telemetry-rollup-query.ts`, `transport-query.ts`,
`tunnel-query.ts`. Their query parsing is L2 HTTP format work used by the existing
route assembly, not independent product persistence owners.

`api/console-query.ts` is a precise old one-export value bridge to
`console-query-owner/http-query.ts`. New route consumers already use the owner
public entry. Preserve this leaf's existing module loading path: removing it or
repointing through the entire owner barrel needs explicit old fixture/import and
initialization compatibility migration. It is not a general private-import rule.

| Root | Real assembly and retained defaults | Removal/change conditions |
| --- | --- | --- |
| `server.ts` | Native HTTPS/fs listener, MySQL pools/guard/migrate, protected authority/PKI, one resource set and original Identity/Nodes/Runtime bridges; public product services, tasks and requests. Default host `127.0.0.1`, original credential overlap 120/relay 86400 and explicit feature flags | Existing production entry; changing concrete return types/constructors is a contract migration, not A5 cleanup. Preserve native notification path preflight, worker backoff and stopAdmission/closeAllConnections/task-close/request-drain/dependency-close ordering |
| `main.ts` | Public startup owner with native startup effects, `startControl` and native multihop release verification | Existing deployment entry; preserve environment defaults/error/partial-start behavior; no fresh composition root introduced |
| `bootstrap.ts` | Public bootstrap command/native effects plus callback to original Identity bootstrap on same database | Original migrate, argument/env validation and finally-close behavior; token/output API cannot be replaced by documentation |
| `client.ts` | Public client command with native client effects | Preserve actual CLI arguments/request/response/error/output behavior |
| `cli.ts` | Native fs/process/JSON input; public Core parse, framework facts, native Direct/Snapshot compiler | Offline plan only, no resource reserve, authorization issue or deployment. Preserve usage/error/exit-code/output shape |

## Concentrated Acceptance Cases

All cases below are planned and unexecuted. They complement the existing
readiness/FR cases; they do not authorize running checks during source development.

1. Cover every named source leaf, type import, narrow HTTP public entry, old
   compatibility re-export and composition edge in the existing boundary tooling;
   refuse negative L1-to-native/L3 and cross-owner private imports. Exact legacy
   assembly entries must not exempt their complete infrastructure directory.
2. Verify old reader/class/type/prototype exports against canonical public owners
   and raw stores, including the three application-aggregate reader bridges and
   API Console query leaf's original loading behavior. Avoid introducing barrel
   initialization/eager native effects while migrating value imports.
3. Exercise server preflight/partial startup/final shutdown, feature/default
   values, shared resources and one ledger, independent observation pool guard,
   original task failure/backoff and allSettled/drain/dependency close sequencing.
4. Verify native HTTP route/service/error/authorization/session/query/withdrawal
   behavior and unchanged DTO/type substitutions; include old `api/app.ts` and
   `application-ports.ts` imports. Passive reads/preview do not confer authority.
5. Verify each storage family with original caller Tx, locks/retries/CAS/history
   and product storage-value callbacks. Recovery failure cases retain exact event,
   time-sampling, commit, credentials and protected authority-rebind order.
6. Verify bootstrap/client/offline CLI startup/argument/default/error/output and
   finally cleanup through their public factories. An offline compiler result is
   not live protocol/driver acceptance; realtime Echo and Transit gates remain.
7. Pin all evidence to the later saved complete source revision/tree, including
   public examples/assets/dependency inputs. Functional/MySQL/network/browser
   evidence belongs in GitHub Actions after authorization; independent physical
   host and release evidence remains separate.
8. FR-0025: verify native signal structural substitution into the L1 cancellation
   port without a wrapper/cast/full DOM dependency; test original reason/throw,
   callback identity/once/removal and observation pool-wait/sender DNS/guard/
   request/response cancellation with retained capacity until actual drain. L1
   views deliberately no longer expose arbitrary platform event members.

This closes the named source ownership and compatibility classification for this
Control slice. Algorithm equivalence, machine-enforced complete import closure,
canonical fixture migration, saved candidate identity and acceptance remain
unexecuted. These are explicit later gates, not evidence supplied by this document.

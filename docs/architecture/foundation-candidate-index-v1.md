# Foundation Candidate Review Index v1

Date: 2026-10-20 (Asia/Shanghai). Status: **source/public-version index supporting
the separately identified B acceptance decision**. The index is not itself a
complete dependency manifest or execution certificate. This document
joins actual public declarations, their documented consumers, source roots and
distribution inputs. Version numbers below are declarations read from source,
not successful compatibility negotiations or test results.

Current A5 source classification is closed for the named integrated candidate in
[foundation-a5-source-closure-v1.md](foundation-a5-source-closure-v1.md). This
supersedes earlier inventory leftovers for source ownership only; exact saved
revision and matching machine/functional acceptance were absent at that handoff.
The human has since authorized B verification and push; see
[verification record](../development/foundation-verification-2026-10-19.md).
Existing compatibility constructors/aliases are retained deliberately.

B accepts the current public-version/consumer/default/compatibility scope at
`e208a3abf17129b0c2898ba2022c69f60f45445a`, actually tested as
`c3ce8a67b901f61234b4116190409854818cb6c7`. The
[assertion map](../development/foundation-b-assertion-coverage.md) and
[verification](../development/foundation-verification-2026-10-19.md) supersede the
dated planned/unexecuted source handoff below for this revision. Future modules
consume that frozen contract set or a verified successor; independent physical,
long-run/load, Responder, release and production gates remain separate.

## Candidate Identity And Scope

The complete integrated candidate was saved as
`9f1d78d939a59c1514d9bcca1591afa2e89e6754` and merged by PR #111 as
`373c291a6ea4f04e5929796a6119eb3b60027c34`. Configured checks passed on the
PR test merge identified in the verification record. This index originally
recorded the source-phase dirty candidate; its no-check statements below retain
that historical scope. Cleanup and later edits require their own evidence.
Tables here index the
complete named leaf/family ledgers below; omission from this short navigation
table is not exclusion from the candidate or a directory exemption. Any actually
omitted/new source discovered later reopens its source classification.

The navigation sources are:

| Question | Source record |
| --- | --- |
| Layers and public dependency direction | foundation-layers-v1.md and foundation-boundaries-v1.json |
| Production/support roots and protected Core | foundation-source-root-catalog-v1.md |
| Current A5 disposition and known compatibility/consumer closure | foundation-a5-source-closure-v1.md and current scope ledgers; superseded partial inventories removed |
| Exact59 top-level Control module leaves, six original constructor/default bindings and five public type consumer changes | control-legacy-module-leaves-v1.md;200-202 unexecuted, full source scope joined by current A5 ledgers |
| Exact34 legacy Runtime leaves, eight construction/callable bindings, one retained interface and25 forwarders | control-runtime-legacy-leaves-v1.md; five type forwarding paths and three Policy imports use existing public declarations;203-205 unexecuted |
| Exact99 application leaves, original Control composition, request wrapper, versioned read aggregate and96 forwarders | control-application-legacy-leaves-v1.md; nineteen named type-forwarding sources and original Control Policy/Accepted references use existing public declarations;206-208 unexecuted |
| Control kernel/framework/native/storage/HTTP/31 owners and roots | foundation-control-source-closure-v1.md; includes FR-0025 common cancellation, named legacy MySQL/API value bridges and actual construction/drain chains |
| Agent lower/native/Runner/commands/private consumers and embedded assets | foundation-agent-source-closure-v1.md; FR-0023/0024 source-migrate native lower representations and preserve old native consumers |
| Packages/Web/operator/example/fixture/test/config/deploy/workflow consumers | foundation-assets-consumers-closure-v1.md; support adaptation belongs to B and real platform/release gates remain independent |
| Contracts exports, native leaves and direct schema inputs | contracts-package-native-boundaries-v1.md |
| Named21 schema references/loaders/copies, generated/handwritten roles and catalog/provider chain | contract-assets-source-map-v1.md; package README corrected,197-199 unexecuted |
| Agent lower/native/product/default call chains | agent-remaining-source-callchains-v1.md, agent-native-default-bindings-v1.md and agent-native-contracts-auxiliary-v1.md |
| Browser public/native/product leaves and served paths | browser-native-leaf-inventory-v1.md, console-browser-composition-v1.md and rule-command-owner-native-v1.md |
| Source changes and compatibility decisions | ../changes/FR-0001-foundation-layer-boundaries.md through FR-0025; each FR has its own scope and remains implemented-unverified |
| Planned acceptance and unmet gates | ../development/foundation-readiness.md; all current-source cases remain unexecuted |

## Public Versions: Separate Counters

Paths in the Control tables are relative to apps/control/src. An aggregate entry
version does not replace versions of its exported ports. Package version 0.1.0,
Core/Forward v1, ADP/3, native schema versions and SQL schema sequence 0038 are
different contracts; none can stand in for an accepted source revision.

B's [FR-0027](../changes/FR-0027-probe-plan-json-integers.md) advances only the
UpgradeAssessment public counter to 2 and the reviewed SQL sequence to 0038.
The additional Control profile `adp3-probe-plan-json-integers-v1` covers 0038;
all 26 older profile ceilings, old aliases and Agent release profiles remain.
Exhaustive CompatibilityProfile source consumers must account for the new member.
Plan/report payload versions remain 1. The explicitly reviewed CHECK-only SQL
has no new table/column footprint and does not prove full schema equivalence.
The original A5 inventories below retain their dated source scope. B acceptance
and the new migration behavior have their own exact-source evidence in verification.

| Public entry/declaration | Current candidate value | Concrete consumers and compatibility boundary |
| --- | --- | --- |
| @tunex/core, packages/core/src/index.ts | package0.1.0; protected domain v1 | Original framework/kernel/native validators and product commands; four-file source map in root catalog; no added private primitive export |
| kernel/public.ts, RUNTIME_KERNEL_INTERFACE_VERSION | 1 | L1 Runtime decisions through the public kernel entry |
| framework/public.ts, FRAMEWORK_INTERFACE_VERSION | 1 | Production composition, owner ports and public example; not a claim that every host is interface1 |
| @tunex/contracts/policy, RUNTIME_POLICY_INTERFACE_VERSION | 1 | L1 policies and exact native aliases; FR-0005 |
| @tunex/contracts/execution-observation, EXECUTION_OBSERVATION_INTERFACE_VERSION | 1 | L1 phase/condition/observation/drain facts and exact native aliases; FR-0006 |
| @tunex/contracts/execution-values, RUNTIME_VALUES_INTERFACE_VERSION | 2 | Host/ledger/Relay/common values; native-runtime-family explicitly supplies outer types; FR-0008/0009 |
| framework/public.ts, RUNTIME_HOST_INTERFACE_VERSION | 3 | Old RuntimeController explicitly binds native family, clock and codec; direct host callers supply effects; FR-0002/0008 |
| framework/public.ts, RUNTIME_LEDGER_INTERFACE_VERSION | 3 | Original ledger construction/owner consumers and MySQL/native providers; same ledger and supplied transaction; FR-0004/0008 |
| framework/public.ts, RUNTIME_RELAY_INTERFACE_VERSION | 5 | Existing RelayCoordinator/native bindings and opaque Profile family; FR-0004/0007/0008/0009 |
| framework/public.ts, RUNTIME_EVIDENCE_READ_INTERFACE_VERSION | 2 | Original Probe/runtime evidence readers with explicit native specialization; FR-0008 |
| framework/public.ts, NODE_AUTHORITY_INTERFACE_VERSION | 3 | Original Nodes construction, native codec/signer/store and public authority users; FR-0004/0010 |
| framework/public.ts, RELAY_CONFIGURATION_INTERFACE_VERSION | 2 | Transport and endpoint owner/native Profile format; FR-0009 |
| framework/public.ts, BACKGROUND_TASKS_INTERFACE_VERSION | 2 | Server's five original task registrations; old application constructor binds native effects; FR-0003 |
| framework/public.ts, CANCELLATION_INTERFACE_VERSION / NODE_REPORT_READ_INTERFACE_VERSION / NOTIFICATION_EFFECTS_INTERFACE_VERSION | 1 / 2 / 2 | FR-0025 common cancellation observer; existing native signal objects and runtime listener bodies retained, full platform-only event methods no longer part of lower view |
| framework/public.ts, RUNTIME_RESOURCE_INTERFACE_VERSION | 1 | Node, ledger and original shared RuntimeResources with supplied Tx |
| framework/public.ts, RUNTIME_EXCLUSIVE_RESERVATION_INTERFACE_VERSION / RUNTIME_RESERVATION_RELEASE_INTERFACE_VERSION | 1 / 1 | Original Transit preparation/staging and ledger reservations/release; no second authority |
| framework/public.ts, IDENTITY_ACCESS_INTERFACE_VERSION / INTENT_STORAGE_INTERFACE_VERSION / MANAGEMENT_READ_INTERFACE_VERSION | 1 / 1 / 1 | Existing Identity/Forward/management owners and MySQL providers, with precise legacy construction bindings |
| compatibility/public.ts, COMPATIBILITY_INTERFACE_VERSION | 1 | Existing Control/server/CLI/native compositions and public flat import example; native aggregate is not an L1 entry |
| compatibility/public.ts, RECOVERY_NATIVE_INTERFACE_VERSION / OPERATOR_COMMAND_NATIVE_INTERFACE_VERSION / CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION | 1 / 1 / 1 | Original Recovery/ops/bootstrap command effects at existing entrypoints |
| api/public.ts, CONTROL_HTTP_INTERFACE_VERSION | 1 | Actual server HTTP composition; old api/app.ts and ports.ts aliases; native Hono entry remains compatibility/control-http/public.ts |
| modules/transport-owner/public.ts, TRANSPORT_MODULE_INTERFACE_VERSION | 2 | Original Transport/endpoint/native composition; requires original formatting effect; FR-0009 |
| apps/web/console-model-owner/public.js, CONSOLE_MODEL_INTERFACE_VERSION | 1 | Old model.js ten-export binding and browser consumers; FR-0019 |
| apps/web/console-request-owner/public.js, CONSOLE_REQUEST_INTERFACE_VERSION | 1 | Original app composition and native HTTP, same pending-key owner; FR-0020 |
| apps/web/rule-command-owner/public.js, RULE_COMMAND_INTERFACE_VERSION | 1 | Original rule-console initializer and explicit native view/effects; FR-0022 |
| apps/web/browser-native/public.js, BROWSER_NATIVE_INTERFACE_VERSION | 1 | Model/main/Relay/Rule compositions with explicit callbacks and fixed assets |
| examples/foundation-extension/public.ts, MODULE_CONTRACT_VERSION | 1 | main.ts public preview composition; source only, not Runtime/Agent acceptance |

The following framework declarations are also independently **1**, exported by
framework/public.ts. They are not covered merely by the Framework1 row:

| Declaration family | Exact constant names | Existing binding/consumer family |
| --- | --- | --- |
| Machine/session | MACHINE_SESSION_LOCK_INTERFACE_VERSION | Runtime and machine entry transaction locks |
| Path | PATH_TEMPLATE_STORAGE_INTERFACE_VERSION, PATH_BINDING_STORAGE_INTERFACE_VERSION, PATH_GROUP_STORAGE_INTERFACE_VERSION, PATH_PUBLICATION_STORAGE_INTERFACE_VERSION | path-owner public services, original MySQL stores and old Path constructors |
| Ingress | INGRESS_GROUP_STORAGE_INTERFACE_VERSION, INGRESS_DEPLOYMENT_STORAGE_INTERFACE_VERSION, INGRESS_MIGRATION_STORAGE_INTERFACE_VERSION | ingress-owner services and original supplied-Tx stores |
| Transit | TRANSIT_COORDINATION_STORAGE_INTERFACE_VERSION, TRANSIT_DELIVERY_STORAGE_INTERFACE_VERSION, TRANSIT_STAGING_STORAGE_INTERFACE_VERSION | original coordination/delivery/staging owners and MySQL providers; offline/contract-only boundaries retained |
| Probe | PROBE_PERMIT_STORAGE_INTERFACE_VERSION, PROBE_REGISTRATION_STORAGE_INTERFACE_VERSION, PROBE_HISTORY_STORAGE_INTERFACE_VERSION | original permit/machine/history/plan consumers and native/MySQL providers |
| Runtime status | RUNTIME_STATUS_STORAGE_INTERFACE_VERSION | runtime-status-owner and MySqlRuntimeStatusStore; FR-0016 |
| Observation/diagnostics | OBSERVATION_READ_STORAGE_INTERFACE_VERSION, FORWARD_DIAGNOSTIC_STORAGE_INTERFACE_VERSION, STATION_ALERT_STORAGE_INTERFACE_VERSION | original metadata/diagnostic/station owners and exact legacy wrappers |
| Notification storage | NOTIFICATION_STORAGE_INTERFACE_VERSION | endpoint/outbox/delivery owners and original native storage; effects2 is independently listed above |
| Telemetry | TELEMETRY_STORAGE_INTERFACE_VERSION, TELEMETRY_ROLLUP_STORAGE_INTERFACE_VERSION | separate original measurement/rollup owners and SQL providers |
| Recovery | OBSERVATION_RECOVERY_STORAGE_INTERFACE_VERSION, PUBLICATION_RECOVERY_STORAGE_INTERFACE_VERSION, RECOVERY_EVENT_STORAGE_INTERFACE_VERSION | original owner recovery methods, one caller Tx and original mutation order; FR-0017 |

Other Control product public entries declare their own module/API/command/query/
recovery counters. Current declared values are1 except Transport module2 above
and UpgradeAssessment2 under FR-0027.
The named owners include Identity, Node, Forward, Path, Ingress, Probe/history/plan,
ObservationService, Audit, ForwardDiagnostic, StationAlert, Notification, Telemetry,
Transit, RelayEndpoint/RelayPlan, RuntimeStatus, Console/Control/Tunnel queries,
native catalog/tunnel, Recovery, UpgradeAssessment and startup/client/bootstrap/
operator commands. Consumers and old-path declarations are recorded in their
individual owner documents and public files; this grouped navigation is not a
complete per-symbol/type/import graph or permission to import private leaves.

### Agent Public Counters

Paths are relative to agent/internal; public Go APIs remain inside the existing
Agent module. An exported identifier here does not create an external Go module.

| Public declaration | Candidate value | Concrete chain and refusal/compatibility condition |
| --- | --- | --- |
| executiontime.InterfaceVersion / platformclock.InterfaceVersion | 2 / 2 | FR-0023 tagless parsed timing facts and native SyncStatus/SynchronizationFacts; old proof/OS aliases, explicit parse-at-Evidence/cache change and unsupported platform refusal |
| executionstate.InterfaceVersion | 3 | Tagless Journal facts with explicit native state records/conversion; FR-0012/0013, native serializer/type consumers must migrate |
| runtimeplatform.InterfaceVersion / platformruntime.InterfaceVersion | 2 / 2 | Runner bootstrap/provider/effects and original native lifecycle; FR-0013 |
| executionhost.HostVersion / executiondriver.HostVersion | 1 / same alias | Existing Runner driver host and typed native adapter; no protocol/default-driver upgrade |
| executionhost.PreparedInstanceVersion / nativeexecution.OfflineTransitAdapterVersion | 1 / 1 | Original offline controller/engine prepare/persist lifecycle; FR-0014, no production Transit registration |
| runtimeobservation.InterfaceVersion / platformobservation.InterfaceVersion / observationwire.InterfaceVersion | 2 / 2 / 1 | Generic lower Host facts, original native DTO/provider/encoders and Runner exporters; FR-0015 |
| executionidentity.InterfaceVersion / agentidentity.InterfaceVersion | 2 / 2 | FR-0024 tagless lower facts, four canonical native records/eight projections; same protected provider/CA and no missing-state recovery fallback |
| executionchannel.InterfaceVersion / controlchannel.InterfaceVersion | 1 / 1 | Runner main/Auxiliary channels and original dynamic mTLS/telemetry pools |
| executionenrollment.InterfaceVersion / agentenrollment.InterfaceVersion | 1 / 1 | Original first-enrollment host and native effects; existing command composes them |
| agentcommand.InterfaceVersion / agentcli.InterfaceVersion | 1 / 1 | Original main flags/inspect/enroll/run and public control.New |
| agentplatform.InterfaceVersion | 1 | Canonical native Providers/Effects/LocalServices with exact Control aliases; FR-0018 changes named declaration identity |
| nativeexecution.InterfaceVersion / probe.InterfaceVersion | 2 / 1 | FR-0024 native RelayResponse input with lower request/return facts; existing driver/Probe seam and original Guard/constructor/counter order |
| platformstate.InterfaceVersion / observationtrust.InterfaceVersion | 1 / 1 | Original atomic file/lock and native observation trust implementations, not a new Authority/Journal owner |

## Required Assets And Distribution Paths

These are observed source declarations. No COPY, import, embed, schema, migration,
Compose file, label or healthcheck has been executed or accepted by this review.

| Input | Real consumer/distribution path | Review/acceptance limit |
| --- | --- | --- |
| Root package.json/package-lock.json, workspace package manifests | npm workspace source dependencies; Docker dependencies stage copies root + Control/Core/contracts manifests, npm ci omits dev | Lockfile v3 and workspace links read; installed node_modules is not candidate identity or a successful clean install |
| .node-version and agent/go.mod/go.sum | Node24.14.1 source pin; Go1.26.3 module/toolchain; Docker uses node:24-bookworm-slim / golang:1.26.3-bookworm | Moving base tags require later resolved image evidence; no dependency update/install/network fetch in this slice |
| packages/contracts/data/native-drivers-v1.json | Native catalog parser and digest; Control COPY includes whole packages/contracts | Catalog1 metadata is not live driver authority; generated/Agent catalog parity unverified |
| docs/protocol/schemas | Actual TS fs inputs resolved from source modules; Control explicitly COPYs schema directory | Direct native asset map in contracts-package-native-boundaries-v1.md; nested references/byte parity/module initialization still require closure |
| Agent embedded schema copies/generated Go structs | Existing go:embed and native packages; Agent/responder builder COPYs agent/ | Do not regenerate or infer parity from matching filenames; generation invokes gofmt and is not source-phase authorized |
| apps/control/migrations/0001-0038 | Original MySQL migration reader and upgrade inspection; whole apps/control is copied | Original A5 sequence ended0037; B0038 CHECK repair and exact read-only catalog review are in FR-0027, awaiting their own native upgrade/refusal evidence |
| apps/web including owner/native modules, index.html/style.css | Control literal asset union/routes + original fixed reader; whole apps/web is copied | Browser import resolution, MIME/CSP/headers and every referenced asset require acceptance; directory COPY alone does not prove loading |
| scripts/ops and canonical Control command/native owners | Existing ops/recovery/upgrade/release entries; Control COPY includes scripts/ops and apps/control | Production/operator source, not test-only; preserve lazy initialization, original Tx, protected history and credential/rebind ordering |
| examples/foundation-extension/{public,module,main}.ts and README.md | Public source example in repository checkout | Not copied into current production Control image; root tsconfig include omits examples; type/import/behavior acceptance is still required |
| deploy/Dockerfile.control and deploy/control-liveness.mjs | TS production entry main.ts, runtime workspace/source/schema/static/ops inputs | Build-time contracts import is narrow; socket liveness is not DB/mTLS/lease/readiness or full module graph evidence |
| deploy/Dockerfile.agent | Static Linux tunex-agent from cmd/tunex-agent; protected state/secret paths | Image/build/run/architecture/OS behavior unverified on candidate; same-host CI cannot satisfy physical gates |
| deploy/Dockerfile.observation-responder | Independent opt-in native responder binary in scratch image | Separate source artifact; no responder publication/scan/signature/physical evidence inferred from Control/Agent image jobs |
| .dockerignore | Excludes Git/caches/node_modules/bin/exe/artifacts/.env and PEM/key inputs | Removed obsolete directory rules after historical-tree cleanup; packaging checks remain bound to their actual revision |
| deploy/compose.control.example.yaml / compose.agent.example.yaml | Separate Control/Agent host examples; protected mounts, pinned image inputs and explicit options | Their Echo/services flags do not establish complete live v4 machine input or UI/capability support |
| deploy/compose.runtime.example.yaml / compose.dev.yaml | Internal runtime example with optional Agent profile; separate development MySQL8.4.9 volume | Distinct examples, not automatically equivalent option sets or safe production rollout evidence |
| deploy/compose.observation.example.yaml | Independent explicit identity/host/SNI/address/CIDR/expiry responder | No automatic Agent/business Relay/probe; independent source/package/host acceptance |
| deploy/compose.multihop-control.override.example.yaml | Explicit opt-in multihop and reviewed release evidence mount | Later exact-source release/physical approval gate, not enabled by foundation index |
| .github/workflows/ci.yml / container.yml | Existing contract/functional infrastructure and Control/Agent package/scan declarations | Reviewed entry excerpts only; neither a complete workflow coverage audit nor a run on current source |
| .github/workflows/candidate-images.yml / images.yml | Manual exact-main candidate and automatic dev/stable release source declarations | No dispatch/push/tag/publication occurred; foundation acceptance does not imply image/release/operational acceptance |

Current manifests declare Control Hono/node-server/mysql2, contracts AJV/formats/
canonicalize/Core, and Go JSON canonicalization/schema/x/text dependencies. The
candidate must retain the manifests and lock/sum inputs together. Versions and
source file presence do not prove dependency integrity, license review, clean
installation, reproducibility or loaded behavior; none is claimed here.

## Dirty Additions And Deletion Replacements

Read-only worktree navigation identified the following concrete additions which
must not disappear from a freeze based only on tracked HEAD:

- apps/control/migrations/0020-node-telemetry.sql through0037-probe-echo.sql:
  four measurement families, rollups, Path groups/publications, Ingress groups/
  migrations, station/notification, Probe history/plans/types/services/Echo.
- docs/protocol/schemas/{telemetry-v1,forward-telemetry-v1,host-telemetry-v1,
  probe-telemetry-v1,probe-types-v2,probe-services-v3,probe-echo-v4}.schema.json.
- New Control kernel/framework/compatibility/owner/store source, Agent lower/
  native/product packages, browser owner/native/console source, existing public
  example and all associated FR/architecture/spec/protocol/readiness records.
- Independent responder Dockerfile/Compose source. Source presence is not an
  artifact release or a runtime capability claim.

The identified tracked deletions have actual named native replacements:

| Removed old leaf family | Replacement source owner | Retained public/default route |
| --- | --- | --- |
| authorization/clock_linux.go, clock_other.go, clock_windows.go | platformclock corresponding OS clock files | authorization/clock.go SystemClock wrapper and executiontime facts |
| authorization/synchronization_linux.go, synchronization_other.go, synchronization_windows.go, windows_status.go | platformclock corresponding synchronization/status files | authorization/synchronization.go original public/proof wrappers |
| control/usage_linux.go, usage_other.go | platformobservation/process_linux.go, process_other.go and process.go | Control platform.go observer/provider binding, original measurement availability semantics |
| state/lock_linux.go, lock_other.go, lock_windows.go | platformstate corresponding OS lock files and files.go | state/platform.go AtomicWrite/AcquireLock wrappers |

Keep replacement files and wrappers in the same candidate. This is a source
relocation map, not permission to remove more compatibility code or evidence
that OS selection/locking/measurement/refusal remains equivalent. No absent
platform field is converted to a fabricated measurement.

## Remaining Source Closure Versus Later Acceptance

| Item | Present evidence | Required next work |
| --- | --- | --- |
| Complete source/type/private/default/consumer classification | Current named source is assigned by the Control59/Runtime34/application99 and full Control/Agent/assets ledgers; known lower format/signal residuals implemented under FR-0023-0025 | Later enforce real import/type/private/default edges and negative cases on the exact saved candidate; any genuinely omitted/new source reopens classification |
| Public versions and bridge removal | Concrete counters above, FR-0001-0025 and named actual production/support/fixture/serializer/default consumers with removal conditions | Accept type/alias/default/reflection/serializer/loading/refusal behavior; keep actual old callers and do not delete bridges from a narrower production-only search |
| Runtime assets and support inputs | COPY/exports/fs/embed/lock/config/ops/workflow roles assigned; named21 schema/local-reference/loader/copy/generator/catalog and actual support consumer maps integrated | Accept schema targets/parity/generated/native/default/distribution behavior and retain all classified support inputs when saving the candidate |
| Existing source-check coverage | Root tsconfig omits examples; test:web checks old fixed JS list; boundary tool has older allowlists/body strings; exact source-text/container consumers recorded | After verification authorization adapt existing tooling to canonical leaves/JS/type/private/assets/ops/examples without weakening negative cases |
| Legacy VM test consumers | Rule/app/Relay tests extract prior private source layout | Later adapt harness to canonical public factories/native ports, preserving real coverage and without adding production credential/state hooks |
| Integrated candidate identity | Full reviewable source scope and concrete deletion replacements identified; A5 classification complete, no immutable source identity generated | Save exact content under later authorization and record actual revision; do not use old HEAD or a partial path list as source identity |
| Public example | ForwardImportPreview source and intended command documented | Later accept public imports/types, denied/unknown/invalid input, immutability/log/drain and executionAuthorized:false; it is not a Runtime/Agent deployment demo |
| Live Echo v4 | Native/history/schema and explicit deployment option source exist | Keep separate staged machine/API/capability boundary; historical parsing is not live v4 acceptance, and this index adds no route or feature |

The earlier review index alone changed no runtime source. Current integration
also records FR-0023-0025's explicit lower source contract changes; it does not
erase their compatibility impact. Readiness192-220 records candidate/asset/version/
coverage/deletion/closure and new contract acceptance, all planned/unexecuted.
Current source phase
does not run tests, type/syntax/static/boundary checks, formatters, generators,
builds, CI, network/MySQL/browser/native experiments or Git writes.

The A5 source classification and reviewable candidate records are now complete;
the next stage is separately authorized saving/freezing and B contract/functional/
example acceptance. C/D/E and
independent physical, long-run, recovery, image, release and production gates do
not become complete by writing this index. The original source handoff kept the upper-module gate closed. The later bounded
B decision above opens contract consumption only at its identified revision and scope.

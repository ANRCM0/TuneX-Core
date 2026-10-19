# Foundation Assets And Support Consumer Closure v1

Date: 2026-10-19 (Asia/Shanghai). This is the A5 manual source-role and consumer
closure for package/assets, the browser delivery graph, examples, operator and
acceptance support, deployment and workflow inputs. It supplements the actual
21-schema/local-reference/embed/generated/catalog map in
contract-assets-source-map-v1.md and the 22 original browser leaf map in
browser-native-leaf-inventory-v1.md. It does not duplicate those implementations.
No test, checker, generator, formatter, build, workflow, browser/native/network
experiment, dependency install or Git write was performed. No frozen revision or
successful parity/import/package/runtime result is asserted.

## Scope And Layer Decision

1. Layers: preserve protected package Core L0; classify three common contract
   entries as L1, native contract/browser/deployment effects as L2, browser owners
   and the preview module as L3, and the actual compositions/support separately.
2. Interfaces consumed: existing package exports; framework/public.ts;
   compatibility/public.ts; product owner public entries; existing native CLI,
   operator, schema/catalog, browser and packaging contracts.
3. Foundation source touched: none in this slice; only this source inventory.
4. Added/changed runtime interface contracts: none; no counter/default/load/error
   timing changes and no new entrypoint or competing authority.
5. Planned acceptance: exact-candidate export/loading/fixture/browser/example/
   packaging/support adaptation below. Executed: source reads only.
6. Concurrent effects: this standalone document has no shared composition edits;
   it does not open independent module branches, verification or release gates.

## Package Entries And Representation Consumers

All package versions remain 0.1.0. packages/core/package.json exposes only
src/index.ts. Its types.ts, forward.ts and primitives.ts stay private supporting
leaves; the public Core API is unchanged. packages/core/test/forward.test.ts
consumes that public source entry, not an additional package subpath. Control
framework/kernel/native and product owner consumers remain in their Control
source inventory. The example consumes the public framework abstraction rather
than adding a direct Core dependency.

The contracts package has the following complete declared export keys. Entries
are real JS/TS module-loading boundaries, not interchangeable type namespaces.

| Export key | Source entry and ownership | Concrete consumer/reason retained |
| --- | --- | --- |
| . | index.ts native compatibility aggregate | Existing contracts tests, phase1/phase2 harnesses and remaining old/native Control callers; transit and staged Echo are still exported here for compatibility |
| ./shared | shared.ts native common aggregate | Native compatibility callers; validatePolicy imports validate.ts and may initialize native schema loading |
| ./policy | policy.ts L1 | Existing framework ports and old wrappers requiring exact common Policy identity/default |
| ./execution-observation | execution-observation.ts L1 | Framework/native observation alias consumers |
| ./execution-values | execution-values.ts L1 | Framework Runtime family values with explicit outer native type bindings |
| ./runtime | runtime.ts L2 | Native Runtime/Relay/catalog consumers; adp3.ts, relay.ts, multihop.ts, native-drivers.ts retain actual schema/catalog imports |
| ./probe | probe.ts L2 | Current native Probe v1/v2/v3 families; negotiation, instance, claim, delivery, result, types, services are explicit leaves |
| ./observability | observability.ts L2 | Native telemetry, forward-telemetry, host-telemetry, probe-telemetry parser/DTO consumers |
| ./experimental/transit | experimental-transit.ts L2 offline/contract | Transit Intent/ADP/negotiation/delivery native consumers; not production execution registration |
| ./legacy/adp2 | legacy-adp2.ts L2 legacy | Explicit old Direct parser/types consumers and vectors; retained legacy contract |
| ./staged/probe-echo | staged-probe-echo.ts L2 staged | Native Echo value/history consumers; availability is separate from machine route/capability acceptance |

Private support leaves json.ts, digest.ts and time.ts own native JSON,
canonicalization/digest and date representation. types.ts retains native DTOs and
exact common aliases. validate.ts owns native ADP2 schema/semantic validation;
adp3.ts, relay.ts, multihop.ts, transit.ts, adp3-transit.ts,
transit-negotiation.ts, transit-delivery.ts, probe-negotiation.ts,
probe-instance.ts, probe-claim.ts, probe-delivery.ts, probe-result.ts,
probe-types.ts, probe-services.ts and probe-echo.ts own their named wire families.
telemetry.ts, forward-telemetry.ts, host-telemetry.ts and probe-telemetry.ts are
handwritten native telemetry parsers; native-drivers.ts reads the catalog. These
are all current contracts src leaves, with barrel responsibility shown above.

No root/shared/native aggregate is reclassified as L1 merely because a caller
imports one pure helper. Existing root and private-leaf test imports are support
consumers to preserve or migrate deliberately during B, not public package export
expansion. Removing an old aggregate needs every value/type import migrated,
native initialization/refusal timing retained, package/export and image import
acceptance, and an explicit compatibility decision; this slice removes none.

## Fixtures, Tests And Their Actual Readers

Paths in the table are under docs/protocol/fixtures unless otherwise stated.
The file names identify representation inputs; no vector was executed or its
expected validity independently accepted during this inventory.

| Fixture | Named TS and Go consumer families |
| --- | --- |
| adp-v2-direct.json | packages/contracts/test/contracts.test.ts and agent/internal/contracts/validate_test.go; build-conformance-fixtures.mjs also reads the Direct input |
| packages/contracts/test/fixtures/conformance.json | Same TS test and Go contracts/validate_test.go; original build-conformance-fixtures.mjs output |
| adp-v3-runtime.json | contracts/test/adp3.test.ts and agent/internal/adp3/validate_test.go |
| native-relay-v1.json | contracts/test/relay.test.ts and agent/internal/relaycontracts/validate_test.go |
| adp-v3-relay.json | contracts/test/relay.test.ts and transit.test.ts; Go adp3relay/validate_test.go and transitcontracts/validate_test.go |
| adp-v3-execution.json | contracts/test/multihop.test.ts and agent/internal/adp3/multihop_test.go; build-multihop-fixtures.mjs output |
| transit-v1.json | contracts/test/transit.test.ts and adp3-transit.test.ts; Go transitcontracts/validate_test.go and adp3transit/validate_test.go |
| probe-negotiation-v1.json | contracts/test/probe-negotiation.test.ts and Go probenegotiation/validate_test.go; same-named build-probe-negotiation-fixtures.mjs output |
| probe-instance-v1.json | contracts/test/probe-instance.test.ts and Go probeinstance/validate_test.go; build-probe-instance-fixtures.mjs output |
| probe-claim-v1.json | contracts/test/probe-claim.test.ts and Go probeclaim/validate_test.go; build-probe-claim-fixtures.mjs output |
| probe-delivery-v1.json | contracts/test/probe-delivery.test.ts and Go probedelivery/contract_test.go; build-probe-delivery-fixtures.mjs output |
| probe-result-v1.json | contracts/test/probe-result.test.ts and Go proberesult/contract_test.go; build-probe-result-fixtures.mjs output |

contracts/test/native-drivers.test.ts reads native parser/catalog public source;
apps/web/test/console-flow.test.mjs and transport-flow.test.mjs also read the
native-drivers-v1.json data directly. contracts/test/transit-negotiation.test.ts
and transit-delivery.test.ts construct their vectors in source. Other listed
contract tests also construct refusal cases in source. There is no dedicated
file-backed v2/v3/v4/telemetry fixture family in this fixture directory; existing
in-source Control/Agent cases remain part of the candidate rather than an
inferred generated vector set. contracts/test/multihop.test.ts and Go
transitcontracts/validate_test.go also read source schemas directly.

The generator/check responsibility and newline differences are recorded in
contract-assets-source-map-v1.md. Fixtures and generated Go types/copies remain
distinct from runtime schemas, public common values and live authorization.
No source map authorizes generator execution or deletion of an output only
because production embeds another schema copy.

## Browser Delivery And Compatibility Consumers

index.html selects app.js and style.css. app.js is the actual browser composition:
it imports model.js, console-request-owner/public.js, browser-native/public.js,
relay.js and the named Probe/Transport/Rule/Tunnel/Path/Ingress/observation/audit/
notification/telemetry initializers in the existing 22-leaf map.

| Entry/module family | Real consumer/default binding |
| --- | --- |
| console-model-owner/{public,service}.js | model.js binds ten old public functions with browserConsoleModelEffects; app.js and model.test.mjs consume old surface |
| console-request-owner/{public,service}.js | app.js binds createConsoleRequests with browserConsoleRequestEffects; one original pending-key owner |
| rule-command-owner/{public,service}.js | rule-console.js binds command factory and native view/effects; app.js and rule-flow.test.mjs retain old initializer |
| browser-native/public.js | Actual model time/query effects and request fetch/JSON/key/abort effects; reexports four explicit native view/form leaves |
| browser-native/control-console.js | mountControlConsole used by app.js with supplied helper/request/initializer callbacks |
| browser-native/relay-forms.js, relay-console.js | relay-model.js and relay.js bind native factories with original public helpers/defaults |
| browser-native/rule-console.js | rule-console.js supplies existing native view/effect binding |
| probe.js, path-templates.js, transport-console.js, tunnel-console.js | Direct initializer imports in probe-flow, path-template-flow/path-switch-flow, transport-flow and tunnel-flow tests respectively |
| relay-model.js | relay-model.test.mjs and console-flow.test.mjs old public helper consumer |

console-flow.test.mjs also reads HTML and extracts/evaluates the old relay.js,
probe.js, transport-console.js, rule-console.js, tunnel-console.js,
path-templates.js and app.js bodies with VM/import stripping. That extraction
layout is a known B adaptation obligation after factory extraction; it does not
justify adding production globals, credentials or state hooks for the test.

Control api/routes.ts declares fixed /console paths and JS/CSS MIME types.
compatibility/native-control-http.ts declares the matching literal asset family
and nativeControlConsoleAsset reads ../../../web/<asset> relative to its source.
This is the actual production read path, not a bundler output or generic directory
server. Dockerfile.control copies the entire apps/web tree. Owner public/service
files and native factory leaves must stay in both the fixed served paths and the
image; directory COPY alone does not prove browser resolution, CSP, headers or
behavior. The two /console HTML routes and all transitive imports need later
exact-candidate browser/HTTP acceptance.

Old model/relay-model/relay/rule-console and remaining initializers cannot be
deleted while app composition, direct tests and source-extraction consumers
remain. Removal requires intentional caller migration plus pending-key/retry/
late-response/scope/abort/default/key/error and DOM/form parity acceptance. The
22-leaf map assigns native views individually; this is not a browser exemption.

## Production Operators, Public Example And Support Roots

| Named input | Actual ownership and consumer |
| --- | --- |
| scripts/ops/cli.ts | Production npm ops composition: public operator command/native effects, public upgrade owner, backupDatabase/restoreDatabase from recovery.ts |
| scripts/ops/recovery.ts | Existing production backup/restore composition; original Control/MySQL/authority/ledger/Identity/Nodes/Forward/Transport/Probe/recovery owners and explicit native effects, retained transaction and protected-history ownership |
| scripts/ops/check-multihop-release.ts | npm release:multihop-check; public release command and native evidence verifier; no gate opened by source presence |
| scripts/ops/upgrade.ts | Old parse/assess/schema/type forwarder into upgrade owner and native public entry; actual upgrade-assessment, upgrade-mysql-acceptance and probe-instance-mysql-acceptance tests still consume it |
| scripts/ops/upgrade-inspect.ts | Old read/catalog/DB-inspect/run forwarder; same named upgrade/Probe tests and container.yml network-none import consume it |
| examples/foundation-extension/public.ts | Existing MODULE_CONTRACT_VERSION 1 and preview module/types entry |
| examples/foundation-extension/module.ts | L3 public framework transaction/auth/import/freezing/identity/log ports; no private Core/kernel, native platform or cross-owner SQL |
| examples/foundation-extension/main.ts | Real preview composition with public framework lifecycle/error, public flatForwardAdapter and fixed demonstration actor/transaction/log providers |
| examples/foundation-extension/README.md | Intended invocation and refused/invalid/immutability/log/drain cases; preview-only executionAuthorized:false, no RuntimeHost/Agent/MySQL demo and not copied into production Control image |
| scripts/run-go.mjs, run-multihop-acceptance.mjs, verify-offline-plan.mjs, time-proof.ts | Native process/cache/runtime/plan/proof acceptance wrappers, individually documented in source-root catalog; not production execution providers |
| scripts/manual/udp-smoke.mjs and test/udp-smoke.test.mjs | Native diagnostic and its test; sockets/processes if invoked, no current network evidence |
| scripts/phase1/acceptance.ts, echo-target.mjs | Original complete acceptance composition and native target fixture |
| scripts/phase2/acceptance.ts, access.ts, access-migration.ts, capacity.ts, faults.ts, linux-agent.ts, security.ts, transport.ts, recovery.ts | Functional/security/capacity/recovery acceptance compositions with direct old Control construction/native SQL/process consumers |
| scripts/phase2/relay.ts, relay-scenarios.ts, relay-capacity.ts, relay-isolation.ts, multihop.ts, multihop-physical.ts | Relay/multihop acceptance and explicit topology/physical harness; same-host namespaces never become independent physical hosts |
| scripts/phase2/probe.ts, probe-console.ts, rule-console.ts, tunnel-console.ts, path-template-console.ts, path-switch-console.ts, path-batch-console.ts, profile-batch-console.ts, multihop-console.ts | Native browser/API acceptance consumers; Playwright/runtime evidence requires later Actions authorization |
| scripts/phase2/native-linux.ts, network-lab.ts, dual-target.mjs, runtime-intent-lock.ts | Native host/process/namespace/target and acceptance locking support, not L1 extension ports or a second Runtime ledger |
| scripts/check-boundaries.mjs; named generator/fixture scripts in contract-assets-source-map-v1.md | Existing development checks/generators only; preserve negative cases, update after B authorization, never run in current source phase |

recovery.ts retains old Runtime RelayCoordinator/RuntimeLedger/
SnapshotAssignmentRegistry and Transport/Identity/Nodes/Forwarding/Idempotency
construction imports. These remain actual dependencies of its production
composition, not unused bridges. Its cli.ts consumer, phase2/recovery.ts and
apps/control/test/authority.test.ts prevent arbitrary removal. Upgrade forwarders
also cannot disappear until their named tests and container import are migrated;
upgrade-assessment.test.ts additionally reads upgrade-inspect.ts source, so a
new successful public call alone would not satisfy that consumer's expectation.
No current operator constructor or transaction/signing/time/secret flow changed.

Application old-path support consumers remain in phase1/acceptance.ts and
phase2/{acceptance,access,capacity,faults,linux-agent,multihop,probe,recovery,
relay-capacity,relay-isolation,relay-scenarios,relay,security,transport}.ts.
apps/control/test consumer families include application-query/console-read/
console-diagnostics/console-serving/console-mysql, access/forward/node command
and observation ports, Path/Tunnel/Transport query/storage/command ports, Probe
negotiation/instance/permit/claim/delivery/result/API/MySQL, multihop coordinator/
runtime and Transit coordination/preparation/reservation/staging/negotiation.
These are known test/harness users of application bridges, with source ownership
recorded in the application closure document; they are not unclassified product
imports. scripts/check-boundaries.mjs also names old application source paths.
Bridge removal requires every such value/type/source-text consumer migrated,
constructor/default/alias identity preserved or expressly changed, and the same
positive and negative contract/MySQL/browser cases accepted on the exact source.

## Deployment, Dependencies And Workflow Inputs

| Input | Real reader/output and bounded meaning |
| --- | --- |
| package.json, package-lock.json, .node-version, packages/core/package.json, packages/contracts/package.json, apps/control/package.json | Workspace links/dependency/runtime/tool inputs; source declarations, not installed dependency integrity or reproducibility evidence |
| tsconfig.json | Existing strict NodeNext TS includes packages/apps and phase1/phase2/ops; examples omitted and JS not enabled |
| .gitignore, .dockerignore | Saved candidate/context exclusion rules; ignored caches/node_modules/artifacts/secret-like inputs are not source acceptance; actual context and secret absence await packaging |
| deploy/Dockerfile.control | Dependency stage npm ci omit-dev/ignore-scripts; Node runtime copies apps/control, Core/contracts, schemas, apps/web, scripts/ops and liveness; only root contracts import exercised in its source RUN declaration |
| deploy/Dockerfile.agent | Original Linux Agent build from agent/go.mod/go.sum/source, protected state/secrets paths and non-root runtime |
| deploy/Dockerfile.observation-responder | Independent opt-in Go responder binary/scratch runtime; not in the Control/Agent image workflows below |
| deploy/control-liveness.mjs | Unauthenticated bounded localhost TCP healthcheck only; not MySQL, mTLS, lease or deployment readiness |
| deploy/preflight.mjs, preflight-role.mjs | Native filesystem/certificate/clock/UID/GID/digest preflight, existing legacy validate API retained; local-static runtimeReady:false even if local checks pass |
| deploy/ci-prerequisites.mjs | candidate-images.yml/images.yml parse exact SHA/main/push/latest-attempt CI responses; no old successful attempt substitutes for current pending/failure |
| deploy/verify-trivy.mjs | container.yml/images.yml require two valid scan JSON inputs and block fixable CRITICAL; HIGH reports remain observations, no whole-security clearance |
| deploy/compose.control.example.yaml, compose.agent.example.yaml | Separate host examples and protected mounts/options; Agent Echo/services flags alone do not create live machine/API/capability input |
| deploy/compose.runtime.example.yaml, compose.dev.yaml | Internal combined runtime/profile and development MySQL8.4.9; distinct role/operational assumptions |
| deploy/compose.observation.example.yaml | Explicit independent identity/SNI/listen/CIDR/expiry responder; no automatic Agent/Relay/Probe service or publication |
| deploy/compose.multihop-control.override.example.yaml | Explicit opt-in Control gate plus reviewed release evidence; no default feature enablement |
| deploy/upgrade-plan.example.json | Deliberate placeholder revisions/digests/profile/Journal inspection inputs to read-only upgrade plan; no real release evidence |
| deploy/README.md; deploy/test/{automatic-images,ci-prerequisites,control-liveness,preflight,preflight-role,release-gates,upgrade-packaging,verify-trivy}.test.mjs | Operator instructions and existing native packaging/preflight/release/scan tests; retained support source, not passing evidence |
| .github/workflows/ci.yml | deployment-tools/contracts/phase1/probe-workflow/multihop/relay-isolation jobs; explicit Go checks, contract/port tests, MySQL/native/browser harnesses; Actions source declarations only |
| .github/workflows/container.yml | deploy tests, Control/Agent build/non-root/revision/refusal/import checks, SBOM/scans and three runtime/control/agent Compose config inputs |
| .github/workflows/candidate-images.yml | Manual exact-reviewed-main SHA prerequisites before build and again before publish, SHA-only candidate tags; Control/Agent only |
| .github/workflows/images.yml | main dev and stable vMAJOR.MINOR.PATCH publication source, exact-main CI latest attempts before publish, immutable-source tags and separately guarded moving dev alias; Control/Agent only |

The npm and Go manifest/lock/sum inputs must be kept with the actual saved source;
moving container base tags need later resolved image provenance. The responder
has source Docker/Compose declarations but no inferred publication/scan/signature
or physical evidence from the two-image workflows. No workflow was dispatched,
release tag created, remote CI queried or image built/published in this slice.

## B Handoff: Planned, Unexecuted

This closes named support roots and their existing consumer/removal obligations
at source-role level. It is not a machine-generated per-symbol import report,
complete source-content manifest, frozen candidate, accepted foundation or upper
module parallel-development authorization. Control/Agent source closure and
integrated candidate recording remain owned by their companion inventories.

- Preserve all 11 contract exports and Core's sole entry; accept loading/refusal
  timing, native schema/catalog assets, same type identity and negative private
  imports on the exact candidate, without moving external representations to L1.
- Accept the 11 protocol fixture files plus conformance input against actual TS
  and Go readers, including inline negative vectors, recursive schema targets,
  generated/embed byte and newline behavior already recorded in cases 197-199.
- Adapt existing root typecheck coverage to the public example and existing Web
  syntax/test lists to the actual owner/native graph; adapt old VM/source-text
  tests and boundary assertions while retaining real negative coverage. No
  tool expansion is performed during A5 to manufacture evidence.
- Accept fixed /console HTML/JS/CSS assets, transitive imports, MIME/CSP/security
  headers, request retry/abort/scope/default/native form semantics and packaged
  source paths through the authorized Actions environment.
- Accept public preview imports/types/invalid/denied/unknown/immutability/logger/
  drain with executionAuthorized:false; it remains separate from Runtime/Agent
  deployment and real transaction/authorization integration.
- Accept operator old/public bridge parity, source-only/lazy import, DB/authority/
  Journal preservation, upgrade inspection and real image context dependencies;
  removal waits for both production and support consumers to migrate.
- Keep frozen-source contract evidence, post-merge CI, Control/Agent image
  publication, independent responder artifact, live Echo v4 capability, physical
  multi-host, long-run/recovery and production-readiness gates distinct.

No source acceptance success, current CI conclusion or feature/release readiness
is derived from this inventory. Tool/harness adaptation and all execution require
the later verification authorization recorded in the project agreement.

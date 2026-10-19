# Foundation Source Root Catalog v1

Date: 2026-10-19 (Asia/Shanghai). Manual current-source root/entry classification.
Not a frozen content manifest, exhaustive import graph, passing boundary report
or accepted foundation. This records actual source reads and named production/
support scope; no whole-directory exemption follows from a row.

Current A5 source classification is closed in
[foundation-a5-source-closure-v1.md](foundation-a5-source-closure-v1.md).
The complete named Control, Agent and asset/consumer ledgers there supersede
older bounded-inventory leftovers below. Actual graph/type/private/asset/default/
behavior acceptance is tracked separately. The candidate was saved, its configured
CI passed, and PR #111 merged; see
[verification](../development/foundation-verification-2026-10-19.md).
The detailed source-only table below records its original classification scope;
readiness reconciliation and the foundation acceptance gate remain open.

## Production And Support Roots

| Root/entry | Current source ownership and evidence |
| --- | --- |
| packages/core/src | Four actual files below; protected L0/public @tunex/core, unchanged in this slice |
| packages/contracts/src and data | Three exact L1 leaves; other native leaves/barrels and direct schema/catalog assets in contracts-package-native-boundaries-v1.md; recursive/distribution parity unverified |
| apps/control/src | Complete named Control ledger plus top-level59/Runtime34/application99 source maps in the A5 record; public/adapter/product/old construction roles and actual consumers assigned, machine-enforced type/private/consumer acceptance unverified |
| apps/control/src/bootstrap.ts | Original production npm control:bootstrap root, now public command/native/Identity composition; control-bootstrap-command-native-v1.md,178 unexecuted |
| apps/web | Actual static production UI served by Control; model/request/Rule owners, native views and complete manual22-leaf map below; full candidate acceptance unexecuted; no npm package.json in this source layout |
| agent/internal | Complete named lower/native/Runner/Probe/state/engine/codec/default/private consumer ledger in foundation-agent-source-closure-v1.md; FR-0023/0024 migrate lower native representations, source graph/behavior acceptance unverified |
| agent/cmd/tunex-agent | Original command/native CLI and public control.New composition; agent-command-native-v1.md |
| Agent time-proof/adp-validate/observation-responder commands | Native helper/codec/responder owners, not new Agent authority; agent-native-contracts-auxiliary-v1.md |
| Agent network-fixture | Named acceptance infrastructure, not a production execution provider or physical-host proof |
| scripts/ops | Original production operator Recovery/upgrade/CLI/release compositions and public owners, readiness161-171 unexecuted |
| examples/foundation-extension | Existing L3 public preview plus L1/L2 demo composition; source authored/read, never run; does not execute Runtime or authorize Forward |
| scripts manual/phase1/phase2 | Manual diagnostic/acceptance executables and fixtures, separate from server/Agent product owners; source presence or native namespace flow is not passing/physical evidence |
| scripts generators/fixture builders/run wrappers | Native development/acceptance tooling below; no source-stage execution or expansion |
| Protocol/schema/catalog/SQL/native generated assets | Runtime-loaded versus specification/generated/fixture paths remain separately tracked; documents can be real runtime inputs, not automatically non-production |
| Deployment/CI/config/lockfiles | Named manifests/locks/Compose/Docker/ignore and four workflow inputs assigned in foundation-assets-consumers-closure-v1.md; no image/build/deployment/CI acceptance inferred; Responder remains separate from current two-image workflows |

Historical source/reference checkouts are removed from the current tree and remain
outside implementation dependencies. Generated/native assets and tests are not excluded from the eventual
candidate; they have different responsibility and evidence roles from product code.
HEAD alone does not identify dirty additions/modifications/deletions. The actual
saved revision/content identity belongs to the later authorized freeze/acceptance
step, not a fabricated SHA or a generated snapshot in this source-only phase.

## Protected Core: Exact Four Files Read

| Source | Public/private responsibility |
| --- | --- |
| packages/core/src/index.ts | Only package entry; public type star plus explicit parser/decision/primitive named exports |
| packages/core/src/types.ts | Readonly Node/Forward/endpoint/path/locked Transport facts, changes/issues/results and tcp/udp union |
| packages/core/src/primitives.ts | Pure ID/counter/port checks, IP bytes/canonicalization, ASCII target hostname and recursive freezing; ipv4Bytes is a leaf export, absent from public package entry |
| packages/core/src/forward.ts | Pure detached canonical parsing/validation and expectedRevision/change/no-op/exhaustion decision; original JSON.stringify equality, issue order and private record/check helpers |

All four complete source bodies were read. Imports stay on local primitive/type
leaves; there are no source dependencies on DB/clock/network/process/framework/
product owner. The package manifest exposes only src/index.ts, version0.1.0 and no
runtime dependency declaration. Package version is not proof of accepted contract
version, parser correctness or automated boundary compliance. Source and exports
remain unchanged. In particular this slice does not fix/normalize special input,
IP/Counter/hostname/CAS behavior or add ipv4Bytes as a public subpath.

Actual outer source navigation identifies Core consumers in Control public
framework/kernel/product/native codecs and contracts native validators. The
complete per-import/type/private consumer closure remains a separate candidate
requirement. Existing examples/kernel/adapter documents establish intended paths,
not an exhaustive checked graph. Acceptance177 must retain negative private
subpath and infrastructure/global cases on the exact candidate.

## Read Native Development/Acceptance Tools Without Executing

| File(s) | Observed source purpose and side effects if later invoked |
| --- | --- |
| scripts/run-go.mjs | Creates agent/.cache, forwards argv to go in agent root with local build/module caches, inherited stdio and original status/error propagation |
| scripts/verify-offline-plan.mjs | Spawns original Control plan on fixed JSON, pipes Snapshot to Go adp-validate and asserts parser result; no assertion of actual network execution |
| scripts/run-multihop-acceptance.mjs | Sequentially runs phase2 multihop counts3/4/8 with forwarded args/env, exits on first nonzero/error; no physical evidence by itself |
| scripts/time-proof.ts | Reads trusted proof/key env pair and emits original flags or pairing error; does not manufacture clock synchronization or a proof |
| scripts/generate-multihop-schema.mjs | Derives execution schema from Runtime schema with native multihop/role/extension additions; writes output or compares normalized newlines in --check mode |
| scripts/generate-go-contracts.mjs | Reads named schema definitions, generates exact original Go structs/aliases/native schema copies, invokes gofmt, writes or compares; ADP3 aliases adp3execution types |
| scripts/build-conformance-fixtures.mjs | Reads native ADP2 fixture, constructs shared stateless cases/digests, writes/compares packages/contracts/test/fixtures/conformance.json |
| scripts/build-multihop-fixtures.mjs | Writes/compares docs/protocol/fixtures/adp-v3-execution.json; stateless vectors do not prove authorization or live execution |
| scripts/build-probe-negotiation-fixtures.mjs | Writes/compares original negotiation fixture, non-executable contract evidence |
| scripts/build-probe-instance-fixtures.mjs | Writes/compares probe-instance-v1 fixture, ownership without Permit authority |
| scripts/build-probe-claim-fixtures.mjs | Writes/compares consumed-receipt fixture, never executable grants |
| scripts/build-probe-delivery-fixtures.mjs | Writes/compares bounded discovery/point-in-time observation fixture |
| scripts/build-probe-result-fixtures.mjs | Writes/compares reported-only result/ACK fixture and native canonical digest |
| scripts/check-transit-adp-schema.mjs | Compares declared/native Transit schemas and non-executable field constraints; source reading is not a successful comparison |
| scripts/check-boundaries.mjs | Existing source/string allowlists and assertions; read excerpts show TS/Go roots and old paths, not a proven current four-layer/JS/type/asset graph |

Complete source was read for Core and the small wrappers/generators. Fixture
builder heads/tails and boundary-tool excerpts identify purpose/output; they are
not a claim that every assertion, vector or current dependency has been reviewed.
No script (including --check), generator, gofmt, build, fixture, parser, test,
process/network/native experiment or CI was executed. Existing tools stay intact;
adaptation belongs to later authorization. Their success log literals are not
current results, and fixture output names do not prove generated content parity.

The manual UDP diagnostic source identifies itself as a local echo/probe fixture,
with bounded flags, native UDP/entropy and two localhost clients/exact-byte result
assertions; its source output literal is not a current successful probe. It does
not authenticate to Control or change protected persistent execution state.

The three Dockerfiles declare native build/runtime layouts. Control COPY includes
whole apps/control, packages/core/contracts, protocol schemas, apps/web and ops;
Agent/responder build from the copied agent source. .dockerignore excludes caches,
dependencies, Git and secret-like inputs rather than new model module directories.
Their npm/go/RUN/import/healthcheck statements were only read, never executed;
healthcheck remains local socket liveness, not MySQL/mTLS/lease/readiness evidence.

## Browser Model Source And Named Remaining Work

Current source slice: console-model-owner/{public,service}.js is L3, browser-native/
public.js is L2, and old model.js binds exact original ten public functions. Three
fixed Control asset routes/type entries follow the real relative ESM imports.
See FR-0019 and console-model-browser-native-v1.md;179-180 unexecuted.

Later FR-0020 source integration: app.js is now its original real composition,
console-request-owner/public.js owns pending-key/result coordination, and import-
free browser-native main/Relay view/form factories receive explicit public helper
callbacks. Old app/relay-model/relay paths keep their original consumer surfaces;
five further fixed module assets are wired. See console-request-native-v1.md and
console-browser-composition-v1.md;181-184 planned/unexecuted. The old VM source
extraction harness needs canonical-source adaptation in authorized acceptance.

Subsequent FR-0021 fixes existing Echo receipt/history projections; FR-0022 completes
the manual map of the following22 original leaves. Twenty-one are explicit L2
native views/forms/representations, with source bodies/defaults/returns/triggers/
callers/assets in browser-native-leaf-inventory-v1.md. Original Rule business
construction/preflight/replay/stop/refresh is actually moved into RuleCommands1,
with native DOM/effects and old initializer binding; rule-command-owner-native-v1.md.
188-191 acceptance is unexecuted; this is not a folder or product-policy exemption.

Exact original production leaves mapped:

- probe.js, probe-runs.js, probe-plans.js
- transport-console.js, rule-console.js, tunnel-console.js, observation-services.js
- path-templates.js, path-groups.js, path-publications.js
- ingress-groups.js, ingress-migrations.js
- forward-diagnostics.js, audit-console.js, station-alerts.js
- notification-endpoints.js, notification-deliveries.js
- telemetry-console.js, forward-telemetry-console.js, host-telemetry-console.js
- probe-telemetry-console.js, telemetry-aggregate-console.js
- index.html and style.css as actual static assets

Complete original app/relay-model/relay bodies were read and moved by FR-0020
with precise public/native/old composition roles, not by a directory exemption.
Rule policy/native bodies now also have actual distinct owners and three fixed
served assets; other21 native bodies stay. HTML/CSS purpose/delivery are recorded,
with complete DOM/style/packaging acceptance still open. Do not remove these files
from the full frozen candidate or replace them with a
generic browser exemption. The existing boundary/test:web source lists do not
cover this whole root or the new module graph automatically.

## Candidate And Acceptance Mapping Still Required

The later [candidate review index](foundation-candidate-index-v1.md) joins actual
public counters, known consumers, deployment/lock/schema inputs, dirty additions
and named deletion replacements. It records root tsconfig/example and old Web/
boundary coverage gaps for later authorized adaptation. This is manual source
navigation, not a complete import manifest or frozen revision;192-196 remain
planned/unexecuted and the full closure work below is still required.

The named21 schema/local-reference/TS-loader/Go-embed/output and native catalog/
provider source chain is now in
[contract-assets-source-map-v1.md](contract-assets-source-map-v1.md). The package
README records its actual11 imports, and boundary inventory native subpaths match
package.json spelling. Generation/byte parity/reference compilation/default/
consumer/distribution acceptance197-199 stays planned/unexecuted; this bounded
source map does not complete the whole candidate or expand any native exemption.

The59 top-level Control modules files now have complete body/role/default/target
source navigation in
[control-legacy-module-leaves-v1.md](control-legacy-module-leaves-v1.md): six
original construction/static bindings and53 direct forwarding leaves. Five type
consumer sites use the same existing owner public declarations directly. Nested
owners, full caller/type/private/fixture/asset closure and acceptance200-202 are
still open; no compatibility entry or value-loading site is removed by this map.

Readiness177 maps Core/root/tool/export/private/dependency preservation;178 maps
the original bootstrap;179-180 map model/native/asset/browser behavior. All are
planned/unexecuted and supplement the existing47 plus subsequent source cases,
not a completion percentage. No tool/test/CI framework was added.

The earlier remaining A5 source scope is now joined by the full Control, Agent,
assets/support and application ledgers linked in the current A5 record. Source/
type/private/default/consumer/removal roles, public versions and distribution
inputs have a reviewable candidate disposition; source checks have not run.
Runnable commands on paper and old green results do not satisfy current contract/
example acceptance. B needs later human authorization and the actual saved complete
revision; physical/long-run/recovery/Responder/release gates remain independent
and unverified where evidence or hosts are absent.

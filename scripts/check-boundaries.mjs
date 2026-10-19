import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFoundationBoundaries } from './check-foundation.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(path, entry.name);
    if (['node_modules', '.cache', 'bin'].includes(entry.name)) return [];
    return entry.isDirectory() ? files(full) : [full];
  });
}
for (const file of files(resolve(root, 'packages/core/src'))) {
  const source = readFileSync(file, 'utf8');
  const references = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)];
  for (const [, name] of references) {
    if (!name.startsWith('./') || !resolve(dirname(file), name).startsWith(resolve(root, 'packages/core/src') + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error(`Core dependency boundary violated: ${file}: ${name}`);
  }
  if (/\b(?:process|fetch|Buffer|Bun|Deno|PrismaClient|WebSocket)\b/.test(source)) throw new Error(`Core uses infrastructure globals: ${file}`);
}
const coreManifest = JSON.parse(readFileSync(resolve(root, 'packages/core/package.json'), 'utf8'));
if (Object.keys(coreManifest.dependencies ?? {}).length) throw new Error('Core must not depend on infrastructure packages');
for (const base of ['packages', 'apps', 'agent']) for (const file of files(resolve(root, base))) {
  if (!/\.(?:ts|go)$/.test(file)) continue;
  if (/['"][^'"\r\n]*legacy[\\/]v2[\\/]/.test(readFileSync(file, 'utf8'))) throw new Error(`VNext references historical source: ${file}`);
}
const runnerPath = resolve(root, 'agent/internal/control/runner.go');
const runnerSource = readFileSync(runnerPath, 'utf8');
if (/["']github\.com\/tunex\/vnext\/agent\/internal\/(?:forward|relay)["']/.test(runnerSource) ||
    /["']native\.(?:direct|relay|multihop)\.v\d+["']/.test(runnerSource)) {
  throw new Error('Runner must dispatch through the execution registry, not native engine imports or driver-ID branches');
}
for (const file of files(resolve(root, 'agent/internal/control'))) {
  if (!/[\\/]native_[^\\/]+_driver\.go$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (/["']github\.com\/tunex\/vnext\/agent\/internal\/(?:state|authorization)["']/.test(source)) {
    throw new Error(`Execution adapters must not import journal or authority internals: ${file}`);
  }
}
for (const [directory, allowed] of [
  ['probe', ['context', 'encoding/hex', 'errors', 'net', 'regexp', 'sync', 'time',
    'github.com/tunex/vnext/agent/internal/probe/native', 'github.com/tunex/vnext/agent/internal/probeecho',
    'github.com/tunex/vnext/agent/internal/observationtrust', 'github.com/tunex/vnext/agent/internal/runtimeplatform']],
  ['egress', ['net/netip']],
  ['probedelivery', ['embed', 'encoding/json', 'fmt', 'regexp', 'sync', 'time',
    'github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer',
    'github.com/santhosh-tekuri/jsonschema/v6', 'github.com/tunex/vnext/agent/internal/contracts']],
  ['proberesult', ['embed', 'encoding/json', 'fmt', 'regexp', 'sync', 'time',
    'github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer',
    'github.com/santhosh-tekuri/jsonschema/v6', 'github.com/tunex/vnext/agent/internal/contracts']],
]) for (const file of files(resolve(root, 'agent/internal', directory))) {
  if (!file.endsWith('.go') || file.endsWith('_test.go')) continue;
  const source = readFileSync(file, 'utf8');
  const imports = source.match(/\bimport\s*\(([\s\S]*?)\)/)?.[1] ?? source.match(/\bimport\s+("[^"]+")/)?.[1] ?? '';
  for (const [, reference] of imports.matchAll(/"([^"]+)"/g)) {
    // Native effects are classified separately; this closed list applies to
    // the product's direct leaves rather than to its new nested L2 adapters.
    if (directory === 'probe' && dirname(file) !== resolve(root, 'agent/internal/probe')) continue;
    if (!allowed.includes(reference)) throw new Error(`Probe/egress dependency boundary violated: ${file}: ${reference}`);
  }
  if (/\b(?:Listen|ListenPacket|WriteFile|StartAuthorized|StoreProtected)\s*\(/.test(source)) {
    throw new Error(`Probe/egress must not deploy listeners or persist execution state: ${file}`);
  }
}
const probeHost = readFileSync(resolve(root, 'agent/internal/control/native_direct_probe.go'), 'utf8');
if (/\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)|\b(?:StoreProtected|Save|beginDrain|startExecution)\s*\(/.test(probeHost)) {
  throw new Error('Probe host adapter may read live execution authority, not mutate or replace it');
}
if (/\bnegotiateProbe\s*\(/.test(runnerSource)) {
  throw new Error('Contract-only Probe negotiation must not silently enter Run/poll before live authority is integrated');
}
for (const file of files(resolve(root, 'agent/internal/control'))) {
  if (!file.endsWith('.go') || file.endsWith('_test.go') || file.endsWith('native_direct_probe.go')) continue;
  if (/\bprobeDirect\s*\(/.test(readFileSync(file, 'utf8'))) {
    throw new Error(`Raw Probe executor cannot bypass future one-use remote admission: ${file}`);
  }
}
const probeContract = JSON.parse(readFileSync(resolve(root, 'docs/protocol/schemas/probe-negotiation-v1.schema.json'), 'utf8'));
if (probeContract.$defs.Response.properties.executionEnabled.const !== false ||
    probeContract.$defs.Response.properties.state.const !== 'contract-only') {
  throw new Error('Probe negotiation must remain contract-only without executable authority');
}
const instanceContract = JSON.parse(readFileSync(resolve(root, 'docs/protocol/schemas/probe-instance-v1.schema.json'), 'utf8'));
if (instanceContract.$defs.Response.properties.executionEnabled.const !== false ||
    instanceContract.$defs.Request.properties.action.enum.join(',') !== 'inspect,register,revoke') {
  throw new Error('Probe instance ownership must stay non-executable with a closed action set');
}
const probeRegistration = readFileSync(resolve(root, 'agent/internal/control/probe_registration.go'), 'utf8');
if (/\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)|\b(?:StoreProtected|Save|beginDrain|startExecution)\s*\(/.test(probeRegistration)) {
  throw new Error('Probe registration lifecycle may not publish or replace Forward execution authority');
}
const claimContract = JSON.parse(readFileSync(resolve(root, 'docs/protocol/schemas/probe-claim-v1.schema.json'), 'utf8'));
if (claimContract.$defs.Response.properties.executionEnabled.const !== false ||
    claimContract.$defs.Response.properties.state.const !== 'consumed' ||
    Object.keys(claimContract.$defs.Request.properties).sort().join(',') !==
      'bootId,instanceGeneration,instanceId,kind,nodeId,permitId,probeVersion,protocolVersion,sessionEpoch') {
  throw new Error('Probe claims may close a known permit only, never accept caller authority or enable execution');
}
const claimHostPath = resolve(root, 'agent/internal/control/probe_claim.go');
const deliveryContract = JSON.parse(readFileSync(resolve(root, 'docs/protocol/schemas/probe-delivery-v1.schema.json'), 'utf8'));
if (JSON.stringify(deliveryContract.$defs.Binding) !== JSON.stringify(claimContract.$defs.Binding) ||
    JSON.stringify(deliveryContract.$defs.PollResponse.properties.offer.anyOf) !==
      JSON.stringify([{ $ref: '#/$defs/Offer' }, { type: 'null' }])) {
  throw new Error('Probe delivery must preserve the complete claim binding and null-or-single offer shape');
}
for (const name of ['PollResponse', 'StatusResponse']) {
  if (deliveryContract.$defs[name].properties.executionEnabled.const !== false) {
    throw new Error('Probe delivery observations must not enable execution');
  }
}
if (deliveryContract.$defs.StatusResponse.properties.state.const !== 'consumed' ||
    Object.keys(deliveryContract.$defs.PollRequest.properties).sort().join(',') !==
      'bootId,instanceGeneration,instanceId,kind,nodeId,probeVersion,protocolVersion,requestId,sessionEpoch' ||
    Object.keys(deliveryContract.$defs.StatusRequest.properties).sort().join(',') !==
      'bootId,instanceGeneration,instanceId,kind,nodeId,permitId,probeVersion,protocolVersion,requestId,sessionEpoch') {
  throw new Error('Probe delivery requests may carry only machine association and correlation, never caller authority');
}
const deliveryAdapter = readFileSync(resolve(root, 'apps/control/src/modules/probe-owner/delivery.ts'), 'utf8');
if (/\b(?:fetch|createConnection|createPool|transaction|issue|consume|revoke|withdraw)\s*\(/.test(deliveryAdapter)) {
  throw new Error('Probe delivery adapter must delegate read-only offer/check without transactions, execution or mutation');
}
const resultContract = JSON.parse(readFileSync(resolve(root, 'docs/protocol/schemas/probe-result-v1.schema.json'), 'utf8'));
if (JSON.stringify(resultContract.$defs.Binding) !== JSON.stringify(claimContract.$defs.Binding) ||
    resultContract.$defs.Request.properties.applicationHealth.const !== 'unknown' ||
    resultContract.$defs.Request.properties.source.const !== 'agent-reported' ||
    resultContract.$defs.Request.properties.applicationPayloadBytes.const !== 0 ||
    resultContract.$defs.Response.properties.health.const !== 'unknown' ||
    resultContract.$defs.Response.properties.executionEnabled.const !== false) {
  throw new Error('Probe result receipts must preserve binding and reported-only, zero-payload, non-authorizing semantics');
}
const resultAdapter = readFileSync(resolve(root, 'apps/control/src/modules/probe-owner/results.ts'), 'utf8');
if (/\b(?:fetch|createConnection|createPool|transaction|issue|consume|revoke|withdraw)\s*\(/.test(resultAdapter) ||
    !resultAdapter.includes('this.permits.receiveResult(')) {
  throw new Error('Probe result adapter must delegate ingestion to the existing permit owner without another authority');
}
const claimHost = readFileSync(claimHostPath, 'utf8');
if (/\bprobe\.(?:Permit|Grant)\s*\{|\bprobeDirect\s*\(|\.Run\s*\(|\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)|\b(?:StoreProtected|Save|beginDrain|startExecution)\s*\(/.test(claimHost)) {
  throw new Error('A Probe claim receipt cannot manufacture execution grants or mutate execution authority');
}
const deliveryHostPaths = ['probe_delivery.go', 'probe_authority_watch.go'].map(name => resolve(root, 'agent/internal/control', name));
const executionHostPath = resolve(root, 'agent/internal/control/probe_execution.go');
const workflowHostPath = resolve(root, 'agent/internal/control/probe_workflow.go');
const pollRouterPath = resolve(root, 'agent/internal/control/probe_types_delivery.go');
const deliveryHostImports = ['bytes', 'context', 'crypto/rand', 'encoding/hex', 'encoding/json', 'fmt', 'io', 'net/http',
  'strconv', 'strings', 'sync', 'time', 'github.com/tunex/vnext/agent/internal/probe',
  'github.com/tunex/vnext/agent/internal/probedelivery', 'github.com/tunex/vnext/agent/internal/nativeexecution',
  'github.com/tunex/vnext/agent/internal/observationtrust', 'github.com/tunex/vnext/agent/internal/platformruntime',
  'github.com/tunex/vnext/agent/internal/probeecho', 'github.com/tunex/vnext/agent/internal/runtimeplatform'];
for (const file of deliveryHostPaths) {
  const source = readFileSync(file, 'utf8');
  const imports = source.match(/\bimport\s*\(([\s\S]*?)\)/)?.[1] ?? '';
  if ([...imports.matchAll(/"([^"]+)"/g)].some(([, name]) => !deliveryHostImports.includes(name)) ||
      /\bprobe\.(?:Permit|Grant)\s*\{|\b(?:probeDirect|claimProbe)\s*\(|\.Run\s*\(|\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)|\b(?:StoreProtected|Save|beginDrain|startExecution)\s*\(/.test(source)) {
    throw new Error(`Probe delivery/watch hooks may observe and cancel only, not execute or mutate deployment authority: ${file}`);
  }
}
const executionHost = readFileSync(executionHostPath, 'utf8');
const executionHostImports = ['context', 'encoding/json', 'sync/atomic', 'time', 'github.com/tunex/vnext/agent/internal/probe',
  'github.com/tunex/vnext/agent/internal/proberesult', 'github.com/tunex/vnext/agent/internal/nativeexecution',
  'github.com/tunex/vnext/agent/internal/platformruntime', 'github.com/tunex/vnext/agent/internal/probeecho',
  'github.com/tunex/vnext/agent/internal/probeservices', 'github.com/tunex/vnext/agent/internal/probetypes',
  'github.com/tunex/vnext/agent/internal/runtimeplatform'];
const executionImports = executionHost.match(/\bimport\s*\(([\s\S]*?)\)/)?.[1] ?? '';
if ([...executionImports.matchAll(/"([^"]+)"/g)].some(([, name]) => !executionHostImports.includes(name)) ||
    /\b(?:probeDirect|claimProbe|pollProbe|NewGate|StoreProtected|Save|beginDrain|startExecution)\s*\(|\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)/.test(executionHost) ||
    !executionHost.includes('runner.monitorConsumedProbe(') || !executionHost.includes('owned.session.gate.Run(') ||
    !executionHost.includes('Check: watch.Check') || !executionHost.includes('nativeexecution.ProjectProbeResult(')) {
  throw new Error('Probe admission must use the retained receipt monitor and existing one-use Gate, serialize closed results, and never mutate authority or perform HTTP');
}
const workflowHost = readFileSync(workflowHostPath, 'utf8');
const workflowImports = workflowHost.match(/\bimport\s*\(([\s\S]*?)\)/)?.[1] ?? '';
if ([...workflowImports.matchAll(/"([^"]+)"/g)].some(([, name]) => !['context', 'time',
    'github.com/tunex/vnext/agent/internal/probe', 'github.com/tunex/vnext/agent/internal/nativeexecution'].includes(name)) ||
    /\b(?:probeDirect|NewGate|StoreProtected|Save|beginDrain|startExecution|monitorConsumedProbe|probeResultRequest)\s*\(|\bprobe\.(?:Permit|Grant)\s*\{|\.gate\.Run\s*\(|\brunner\.(?:journal|runtimeState|instances|drains|ticket|guard)\s*=(?!=)/.test(workflowHost) ||
    !workflowHost.includes('if !runner.options.ProbeExecution || !runner.options.ProbeRegistration') ||
    !workflowHost.includes('runner.executeConsumedProbe(') || !workflowHost.includes('nativeexecution.DecodeProbeResultResponse(') ||
    !workflowHost.includes('execution.reported.CompareAndSwap(false, true)')) {
  throw new Error('Probe workflow must opt in explicitly, reuse owner admission, validate receipts and never recreate execution authority');
}
const resultWire = readFileSync(resolve(root, 'agent/internal/nativeexecution/probe_result_wire.go'), 'utf8');
for (const marker of ['func ProjectProbeResult(', 'proberesult.ParseRequest(raw)', 'func DecodeProbeResultResponse(',
  'proberesult.ParseResponse(raw)', 'proberesult.CheckResponse(request, *ack)',
  'ApplicationHealth: "unknown"', 'Source: "agent-reported"', 'ApplicationPayloadBytes: 0']) {
  if (!resultWire.includes(marker)) throw Error('Probe native result codec must retain closed serialization and ACK validation: ' + marker);
}
for (const file of files(resolve(root, 'agent/internal/control'))) {
  if (!file.endsWith('.go') || file.endsWith('_test.go')) continue;
  const source = readFileSync(file, 'utf8');
  if (![claimHostPath, workflowHostPath].includes(file) && /\bclaimProbe\s*\(/.test(source)) {
    throw new Error(`Only the opt-in serial Probe workflow may claim tasks: ${file}`);
  }
  if (![workflowHostPath, pollRouterPath, ...deliveryHostPaths].includes(file) && /\bpollProbe\s*\(/.test(source) ||
      file !== executionHostPath && !deliveryHostPaths.includes(file) && /\bmonitorConsumedProbe\s*\(/.test(source)) {
    throw new Error(`Probe delivery/watch hooks must feed only the opt-in workflow and original one-use adapter: ${file}`);
  }
  if (![executionHostPath, workflowHostPath].includes(file) && /\b(?:executeConsumedProbe|resultRequest|reportProbe|runProbeTask)\s*\(/.test(source) ||
      file !== executionHostPath && /\bprobeResultRequest\s*\(|\bprobe\.(?:Permit|Grant)\s*\{|\.gate\.Run\s*\(/.test(source)) {
    throw new Error(`Only the one-use adapter may construct grants; only its opt-in workflow may execute/report: ${file}`);
  }
}
// Canonical AST policy covers value imports, type imports and public/private edges.
// The former intermediate-path table no longer describes extracted owners.
checkFoundationBoundaries();
const transportSource = readFileSync(resolve(root, 'apps/control/src/modules/transport-owner/service.ts'), 'utf8');
if (/\bonGrantChange\b/.test(transportSource)) {
  throw new Error('Profile grant acceptance must use owner command/effect ports, not a mutable Transport callback');
}
if (/['"]\.\/runtime\//.test(transportSource)) {
  throw new Error('Transport must own Profile mutations without importing the Runtime implementation');
}
const apiSource = readFileSync(resolve(root, 'apps/control/src/api/routes.ts'), 'utf8');
if (/\btransport\s*\.\s*(?:applyGrant|changeGrant)\s*\(/.test(apiSource)) {
  throw new Error('HTTP must enter Profile grant acceptance through the application transaction, not owner mutation primitives');
}
const controlSource = readFileSync(resolve(root, 'apps/control/src/application/control.ts'), 'utf8');
for (const source of [apiSource, controlSource]) {
  if (/\b(?:identity\s*\.\s*changeMember|nodes\s*\.\s*changeGrant)\s*\(/.test(source)) {
    throw new Error('HTTP and Control facades must enter member/Node Grant changes through the application acceptance service');
  }
  if (/\bnodes\s*\.\s*(?:management|applyManagement|storePolicy|markRevoked|audit)\s*\(/.test(source)) {
    throw new Error('HTTP and Control facades must enter whole-Node policy/revocation through the application acceptance service');
  }
  if (/\bforwarding\s*\.\s*(?:insert|replace|markDeleting|setAuthorizer|currentForUpdate)\s*\(/.test(source) ||
      /\bidempotency\s*\.\s*claim\s*\(/.test(source)) {
    throw new Error('HTTP and Control facades must delegate Forward acceptance instead of mutating owners or claiming requests');
  }
}
if (/\b(?:compileDirect|decideForwardChange)\s*\(/.test(controlSource)) {
  throw new Error('Control composition must not contain Forward intent decisions or native compilation');
}
for (const file of files(resolve(root, 'apps/control/src'))) {
  if (file.endsWith('.ts') && /\badditionalAssignments\b/.test(readFileSync(file, 'utf8'))) {
    throw new Error(`Snapshot sources must use constructor-supplied ports, not mutable additional-assignment callbacks: ${file}`);
  }
}
for (const file of files(resolve(root, 'apps/control/src/modules/runtime'))) {
  if (/['"]\.\.\/transport\.ts['"]/.test(readFileSync(file, 'utf8'))) {
    throw new Error(`Runtime must consume the Transport resolution port, not the complete implementation: ${file}`);
  }
}
const projection = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-console-read.ts'), 'utf8');
if (/\bControlApplication\b|\b(?:write|createPool|createConnection)\s*\(/.test(projection)) {
  throw new Error('Console projections must use the supplied read transaction, not Control or write/connection helpers');
}
// The old wrappers retain constructors; actual SELECT bodies now share this
// canonical raw store. Check it as well so empty forwarders cannot hide writes.
const managementStore = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-management-read.ts'), 'utf8');
if (/\bControlApplication\b|\b(?:write|createPool|createConnection|fetch)\s*\(|\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|CREATE|DROP|TRUNCATE)\b/.test(managementStore)) {
  throw Error('Canonical management/reference/Tunnel raw storage must remain SELECT-only on the supplied transaction');
}
const transportProjection = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-transport-read.ts'), 'utf8');
if (/\b(?:write|createPool|createConnection|fetch)\s*\(|\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/.test(transportProjection)) {
  throw new Error('Transport reference projections must remain SELECT-only in the supplied transaction');
}
const tunnelProjection = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-tunnel-read.ts'), 'utf8');
if (/\b(?:write|createPool|createConnection|fetch)\s*\(|\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b|\b(?:certificate|response|source_fingerprint)\b|SELECT\s+\*/.test(tunnelProjection)) {
  throw new Error('Tunnel metadata must remain SELECT-only and must not select certificates, issuance responses or whole rows');
}
const tunnelRaw = managementStore.slice(managementStore.indexOf('export class MySqlTunnelMetadataReadStore'));
if (!tunnelRaw.startsWith('export class MySqlTunnelMetadataReadStore') || /\b(?:certificate|response|source_fingerprint)\b|SELECT\s+\*/.test(tunnelRaw)) {
  throw Error('Canonical Tunnel metadata must not select certificates, issuance responses or whole rows');
}
const relayFixture = readFileSync(resolve(root, 'scripts/phase2/relay.ts'), 'utf8');
const pathStore = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-path-template-store.ts'), 'utf8');
if (/\b(?:createPool|createConnection|fetch)\s*\(/.test(pathStore) ||
    /\b(?:ALTER|CREATE|DROP|TRUNCATE|REPLACE)\b/.test(pathStore) ||
    /\b(?:INTO|UPDATE|DELETE\s+FROM)\s+scopes\b/.test(pathStore) ||
    [...pathStore.matchAll(/\b(?:INTO|UPDATE|FROM)\s+([a-z_]+)\b(?!\s*=)/g)].some(([, table]) =>
      !['path_templates', 'path_template_revisions', 'path_template_events', 'scopes'].includes(table))) {
  throw new Error('PathTemplate metadata owner may access only its supplied transaction/tables and Scope quota lock, never execution state');
}
const bindingStore = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-path-binding-store.ts'), 'utf8');
if (/\b(?:createPool|createConnection|fetch)\s*\(/.test(bindingStore) || /\b(?:ALTER|CREATE|DROP|TRUNCATE|REPLACE)\b/.test(bindingStore) ||
    [...bindingStore.matchAll(/\b(?:INTO|FROM|JOIN)\s+([a-z_]+)\b/g)].some(([, table]) => !['forward_path_bindings', 'current_path_bindings', 'forwards'].includes(table)) ||
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+forwards\b/.test(bindingStore) ||
    /\b(?:UPDATE|DELETE\s+FROM)\s+forward_path_bindings\b/.test(bindingStore)) {
  throw new Error('Path binding store must retain immutable provenance and mutate its pointer only, using the supplied original Forward transaction');
}
const browserOptIn = relayFixture.indexOf("const tunnelBrowser=process.env.TUNEX_TUNNEL_BROWSER==='1';");
const browserGuard = relayFixture.indexOf("if(tunnelBrowser&&(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true'))throw Error('Tunnel browser acceptance is Actions-only');");
if (browserOptIn < 0 || browserGuard <= browserOptIn || ['await mkdir(', 'await execute(', 'await createConnection('].some(marker => {
  const effect = relayFixture.indexOf(marker); return effect < 0 || effect < browserGuard;
})) throw new Error('Reject unsupported browser opt-in before creating PKI/artifacts or opening a fixture database');
const multihopFixture = readFileSync(resolve(root, 'scripts/phase2/multihop.ts'), 'utf8');
const multihopOptIn = multihopFixture.indexOf("const browserConsole=process.env.TUNEX_MULTIHOP_BROWSER==='1';");
const multihopGuard = multihopFixture.indexOf("if(browserConsole&&(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true'||process.argv.includes('--isolated')))throw Error('Multi-hop browser acceptance requires non-isolated Linux Actions');");
if (multihopOptIn < 0 || multihopGuard <= multihopOptIn || ['await mkdir(', 'await execute(', 'await createConnection(', 'new NetworkLab('].some(marker => {
  const effect = multihopFixture.indexOf(marker); return effect < 0 || effect < multihopGuard;
})) throw new Error('Reject unsupported multi-hop browser opt-in before fixture/network/database setup');
const observer = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-node-observation.ts'), 'utf8');
const probeReader = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-probe-read.ts'), 'utf8');
const probeMachine = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-probe-machine.ts'), 'utf8');
const probeInstances = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-probe-instance-store.ts'), 'utf8');
if (/\b(?:createPool|createConnection|fetch)\s*\(/.test(probeInstances) ||
    [...probeInstances.matchAll(/\b(?:INTO|UPDATE|FROM)\s+([a-z_]+)\b(?!\s*=)/g)].some(([, table]) =>
      table !== 'probe_instances')) {
  throw new Error('Probe instance owner must use the supplied transaction and only its own non-executable table');
}
if (/\bprobeInstances\b|\bprobePermits\b/.test(apiSource)) {
  throw new Error('HTTP Probe registration must pass through the closed machine registry contract');
}
const permits = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-probe-permit-store.ts'), 'utf8');
if (/\b(?:createPool|createConnection|fetch)\s*\(/.test(permits) ||
    [...permits.matchAll(/\b(?:INTO|UPDATE|FROM)\s+([a-z_]+)\b(?!\s*=)/g)].some(([, table]) =>
      !['probe_permits', 'probe_permit_budget', 'probe_permit_withdrawals', 'probe_results'].includes(table))) {
  throw new Error('Probe permit owner may write only its bounded permits and shared budget, not execution authority');
}
const permitIntents = readFileSync(resolve(root, 'apps/control/src/infrastructure/mysql-probe-permit-intents.ts'), 'utf8');
for (const source of [observer, probeReader, probeMachine, permitIntents]) {
  if (/\b(?:write|createPool|createConnection|fetch)\s*\(/.test(source) ||
      /\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|CREATE|DROP|TRUNCATE)\b/.test(source)) {
    throw new Error('Observation and probe projections must remain SELECT-only, not write paths or network clients');
  }
}
for (const file of [resolve(root, 'README.md'), ...files(resolve(root, 'docs')).filter(path => path.endsWith('.md'))]) {
  for (const [, target] of readFileSync(file, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const path = target.split('#')[0];
    if (path && !existsSync(resolve(dirname(file), path))) throw new Error(`Broken documentation link: ${file}: ${target}`);
  }
}
console.log('Core, execution adapters and Control ports, VNext source isolation and documentation links passed.');

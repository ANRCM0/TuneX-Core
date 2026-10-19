# Control server bootstrap native candidate

Date: 2026-10-19. Source authored only in the existing dirty foundation tree.
No tests, type/syntax/static/import/boundary checks, formatters, generators, builds,
CI, network/native/MySQL/browser experiments or Git writes ran. Candidate acceptance
cases below are planned and unexecuted; shared numbering is owned by main. This
slice does not accept A5, the foundation, release or the parallel-module gate.

Main integration follow-up: shared native public exports and precise source
inventory are now integrated, and readiness159 is planned/unexecuted. Existing
server public signatures and native assembly remain; this is not current-source
type/import/lifecycle/MySQL acceptance evidence.

## Layer scope and public chains

The existing server.ts stays the real composition root and retains its public
ServerOptions and startControl result. It still binds the original database,
authority, Identity/Node/Control/Runtime, SQL adapters, product owners, native TLS
server, HTTP app and background lifecycle. It is not a new root hiding business
rules. The moved product feature/lifetime rules live in the existing L3
control-startup-owner/server-preflight.ts and are exposed by that owner's public.ts.

checkControlServerPreflight consumes structural ControlServerPreflightOptions and
the supplied original policy. Its generic policy requires only the three numeric
fields used by the original rule and returns the original chosen policy object,
preserving its full caller type. It imports no private server interface or wire
policy implementation. No default provider is added and no L0/L1 API changes.

The L2 MySqlControlBootstrapStore in infrastructure/mysql-control-bootstrap.ts owns
exactly the original two raw pool queries. It holds the supplied original pool owner
and exposes obsoleteSnapshots and authorityIdentity, returning original raw row
arrays without conversion, shape checks, copy, retry, transaction or new pool. Its
public row declarations describe n/name/nodes; they do not coerce MySQL values.
mysql.ts remains the original legitimate L2 implementation and was not wrapped or
edited. The server remains responsible for the original obsolete-history refusal,
authority initialization and close decisions.

The L2 nativeProtectedNotificationRoot in compatibility/native-control-server.ts
owns the original node:path resolve/dirname/relative/absolute/overlap expressions and
their original protected-directory refusal. It takes structural native path fields,
imports only the original L1 ControlError and node:path, and returns the original
resolved string. It imports no L3 class/DTO. The caller still performs the original
optional-directory branch, FileNotificationSecrets.open and close/rethrow cleanup.

Complete paths are server preflight -> L3 rules -> original policy; original db
construction/migrate -> L2 raw obsolete read -> original refusal/close -> L2 raw
authority identity read -> original AuthorityStore initialize with original CA read
and trust digest -> original guard; later original notification directory branch ->
public L2 protected path rules -> original protected store open -> original cleanup.

## Evaluation, error and default compatibility

Preflight preserves every original option getter and short-circuit expression:
webhook protection first, then schedule, ingress, service prerequisites, then the
Probe one-second skew requirement. It retains repeated policy access, policy
lease/skew/poll reads in lead calculation, lifetime default 86400, overlap default
120 and the same Integer/bound refusal. No object is copied or normalized and no
getter is eagerly snapshotted. DEFAULT_POLICY is still supplied by the original
server composition binding. The returned policy is used by the unchanged assembly.

Database URL read, construction and migrate stay after preflight. Raw obsolete SQL
still precedes identity SQL; no shape fallback or empty-row guard is introduced.
The original n>0 comparison and strict nodes===0 check remain, including their
different coercion semantics. Non-null assertions serve typed source access only
and add no runtime validation. Obsolete history still closes db before throwing;
query failures preserve the original surrounding cleanup gaps instead of adding
new catch/finally behavior. AuthorityStore construction still follows the second
query and precedes initialize. Initialize arguments retain name -> CA read/trust
digest -> initialize flag/strict zero-node evaluation order. Its catch still awaits
db.close before rethrow and guard installation still follows successful initialize.

Protected notification path reads remain dynamic on the same options object:
resolve directory; absolute/canonical checks; only then stateDirectory and ordered
certificate/key dirname evaluation; short-circuit containment checks in both
directions. Tail-empty, '..', separator prefix and absolute relative-tail cases
remain identical. There is no new realpath, filesystem mutation, case folding or
directory creation. Missing/relative/noncanonical/overlapping directories retain
the same ControlError class/code/status/message. FileNotificationSecrets.open stays
after root calculation. Its outer catch retains sequential telemetryDb.close then
db.close then throw, without swallowing a close failure or adding secret cleanup.

The original assembly, public option/result shape, Date.now function capture at
every service construction, feature/default accesses, original store instances and
cyclic issuer callbacks remain. Native HTTPS certificate/key/CA read order, minimum
TLS version, request certificate settings, listen/error promise and host default are
unchanged. Partial listen failure retains stopAdmission, first allSettled task/drain
group then second allSettled dependencies and original error. Successful startup
retains tasks.start and returned original port/db/control/runtime/authority/close.
Shutdown retains one memoized promise, stop/closeAllConnections order, original
allSettled stop/drain/server group before dependency closure and final generic
failure if any result rejects. No logging, retry or cleanup policy was added.

## Main integration and compatibility

Main must expose the native helper through the shared compatibility public entry:

```ts
export { nativeProtectedNotificationRoot } from './native-control-server.ts';
export type { NativeProtectedNotificationPaths } from './native-control-server.ts';
```

This slice did not edit that shared file, framework public, Recovery sources or
shared readiness/inventory/plan/progress/FR documents. The startup owner's public
entry adds checkControlServerPreflight and its structural option/policy types.
The raw store is an exported L2 leaf consumed explicitly by the real composition
root. No old public function/class was removed, wrapped or aliased into a second
implementation; ServerOptions and startControl remain at the same original path.
This is an additive original-source separation, not a frozen public semantic
change requiring a new FR number.

## Planned acceptance and remaining scope

When authorized, associate all evidence with the exact frozen source revision.
Preflight cases cover option getter order/repeated accesses, all feature refusal
precedence, changing getters, original policy identity/default and lead/lifetime/
overlap boundaries, missing policy versus supplied policy. Bootstrap cases cover
query SQL/order/raw array identity, raw number/string/null behavior, obsolete versus
identity failures, original missing-row errors, db.close refusal order and close
rejection precedence, authority argument/getter/CA read order and initialization
failure/guard installation. Protected path cases cover absent/relative/noncanonical
paths, identical/ancestor/descendant/sibling/state/certificate paths, both containment
directions and short circuit, platform separator behavior, dynamic option access,
open failure and sequential close failures. No physical host claim is inferred.

Regression cases additionally preserve exact constructor/default/Date binding,
feature flags, original raw/rollup recorder and issuer instances, worker task order,
partial startup failure, HTTPS read/listen failure, allSettled groups, single close
promise and logs/errors. Functional SQL/TLS/native filesystem evidence belongs to
GitHub Actions; source/type compatibility remains unverified until authorized.

Remaining source includes complete lower runtime/default/native classification and
shared inventory, plus separate offline plan CLI/native chains. The unchanged server
native TLS assembly is a real composition responsibility; this document does not
make it a blanket exemption for unresolved owner code elsewhere.

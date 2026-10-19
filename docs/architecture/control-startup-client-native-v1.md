# Control startup and client native source candidate

Date: 2026-10-19. Dirty source authored only. No tests, type/syntax/static/boundary/
import checks, formatters, generators, builds, CI, network/MySQL/browser experiments
or Git writes ran. This does not accept A5 or open the module/release gates.

## Public ownership and full source chains

The real main.ts composition root binds public control-startup-owner/runControlStartup
to the original server.ts startControl callback, existing release verifier and public
L2 native startup effects. Configuration and feature refusal are L3 product decisions;
the root is not an exception for retaining that whole business body. No server.ts
implementation or exported server options were changed.

ControlStartupEffects and ControlStartupOptions are structural generic L3 contracts;
CONTROL_STARTUP_INTERFACE_VERSION and CONTROL_CLIENT_COMMAND_INTERFACE_VERSION are
both 1 source candidates, additive to the existing product entries.
The required start callback accepts the original startup options and returns the
original minimum port/close view. The original DEFAULT_POLICY type/value is supplied
from the L2 native leaf, with no L2 import of L3 contracts. The root explicitly binds
the server implementation; no lower leaf imports server.ts or starts another host.
native-control-startup.ts directly exposes the existing release verifier implementation
and provides dynamic env/log/signal effects. No new verification behavior is authored.

The real client.ts root binds public control-client-command-owner/runControlClient
to public L2 nativeControlClientEffects. The original whole command selection and
request mapping remains in L3; it consumes required argv/env/file/codec/encoding/URL/
HTTPS/output effects. Opaque Url and Bytes type parameters avoid L3 Node URL/Buffer
contracts and avoid a reverse lower import of product types. Native client effects
own node:https, node:fs, original parseJson, JSON/string/URL encodings and stdout.
The complete original HTTPS request callback/event body remains one L2 implementation.

The complete chains are:

- main.ts -> public startup owner -> required native env/default policy and original
  release callback -> required original startControl callback -> original server
  assembly -> original close method -> native signal registrations.
- client.ts -> public client command owner -> original argv/env prerequisites ->
  original command branch/file decode/body encode/path/key mapping -> URL and CA read
  -> one required native HTTPS request -> original response parse/pretty print/log.

The old main.ts/client.ts paths remain executable entrypoints; they originally had
no named public exports to alias. New public owner functions/effect contracts are
additive source interfaces, with no provider defaults. cli.ts offline plan and
server.ts, framework and shared documents were not edited by this slice.

## Startup evaluation, refusal and cleanup compatibility

Port is still read/converted/validated before any feature reads. Probe execution,
schedule, ingress and services flags are read in the same order. Services refusal
precedes ingress refusal, then schedule, then the explicit one-second clock-skew
requirement. Production multihop environment checks and required release evidence/
source revision evaluation retain short-circuit and argument order before server
option reads. The original verifier remains an evidence-bundle check, not newly
executed acceptance or a signature proof.

Options keep original object-field evaluation order: required DB/CA/key/server/state
values, OpenSSL/credential duration, host, initialization, multihop, captured Probe
flags, telemetry/rollup/alerts/delivery flags, optional notification storage and
policy. Environment is not snapshotted: repeated multihop/host and notification
reads remain repeated dynamic lookups. No stronger validation, extra default or
normalization is added. Policy still passes the original default object for disabled
Probe execution and spreads it with maxClockSkewSeconds:1 only for enabled execution.

After start succeeds, logging still rereads host at the original point, then creates
the same closing guard and registers SIGINT before SIGTERM. The guard is set before
awaiting server.close, and callbacks still discard that promise with void. No catch,
new exit code, retry, additional signal cleanup or alternate close policy is added.

## Client command and HTTP compatibility

Argument slicing and env read order retain command/scope/idOrFile/key/expectedOrFile/
mutationKey followed by URL/CA/token. Trusted URL/CA/token/scope validation remains
before command selection and file reads. Original supported commands and their usage
strings remain verbatim, including the existing usage list's omissions. Unknown
commands retain the original failure path rather than adding new aliases/features.

Relay-plan, Profile/Endpoint/member/grant, Forward/Node create/read/update/policy,
delete/retry and revoke branches retain method/path/body and argument positions.
Each branch reads the same file in utf8, uses the same original parseJson and
JSON.stringify operation and performs the same encodeURIComponent calls. Updates
still use Number(key), and optional revision query strings retain truthiness rules.
node-revoke still sends the literal '{}' body.

Request-key precedence remains mutationKey for update/node-policy/node-grant/
profile-grant; expectedOrFile for delete/retry/member/profile/node-endpoint; key
otherwise. Only original create enforces the explicit persistent-key refusal at
that point. URL construction stays after key selection/refusal and before CA bytes
read. No stable key is generated, hashed, normalized or silently replaced.

The native HTTPS implementation preserves method/CA/timeout:10000; Bearer and JSON
headers; optional idempotency-key and truthy-body content-length using original
Buffer.byteLength. It accumulates the original Buffer chunks, resolves only 2xx,
and rejects the same HTTP status/body error otherwise. Timeout destroys the request
with the same error; request error registration and req.end(body) order remain.
No response size limit, redirect handling, extra network probe, new response event
or error normalization is introduced. Success retains parseJson -> pretty JSON with
null replacer/two spaces -> console.log, without new catch/exit-code behavior.

## Main integration and planned acceptance

Shared public integration now exports the two native leaves:

```ts
export { nativeControlStartupEffects, verifyMultihopRelease } from './native-control-startup.ts';
export { nativeControlClientEffects } from './native-control-client-cli.ts';
```

The main agent integrated compatibility/public.ts, shared source inventory and
planned readiness156-157. This slice changes
no frozen L0/L1 public API or existing server/client wire semantics and requires no
breaking-contract FR. Any separately proposed Runtime status FR is outside this scope.

Planned, unexecuted cases on an authorized exact frozen revision: startup port and
feature env evaluation/refusal order, missing required variables, production gate
short circuit, repeated/mutated env lookups, original option defaults and policy
identity/spread, release failure before start, start failure before log/signals,
dynamic host log, SIGINT/SIGTERM order and once-only close including close rejection.
Client cases cover every original command/usage/refusal, file-read/parse failures,
method/path/encoding/body mapping, request-key precedence and persistent create key,
URL/CA/error order, original headers/content length, 2xx/non-2xx, chunk projection,
timeout destruction/request error/end order and final parse/pretty output. Structural
effect providers and opaque Url/Bytes types need later type acceptance; no claim of
passing source/type compatibility is made now. Functional HTTPS/process evidence
belongs to GitHub Actions; physical-host/release gates remain separately unverified.

Remaining source includes complete server lifecycle/native assembly and ops/recovery,
plus overall all-source/type/default/compatibility classification. The offline plan
CLI is separately recorded as an explicit native inspection adapter using public
compiler/facts; it has no authority/reservation/deployment side effects and remains
unverified. Existing HTTP adapter evidence and release safety are not inferred from
authored extraction or these planned cases.

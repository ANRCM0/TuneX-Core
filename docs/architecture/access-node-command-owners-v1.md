# Access And Node Command Owners v1

Date: 2026-10-19 (Asia/Shanghai). A2 original source slice, authored and unverified.
This is not acceptance of the foundation or the closed parallel-module gate.
Current dirty source is not identified by its base HEAD alone.

## Canonical Source And Public Entry

| Existing command | Canonical source | Public entry | Compatibility leaf |
| --- | --- | --- | --- |
| AccessCommands | modules/identity-owner/commands.ts | identity-owner/public.ts | application/access-commands.ts |
| AccessCommandApi, responses, interface version 1 | identity-owner/command-api.ts | identity-owner/public.ts | application/access-command-contract.ts |
| AccessChangeEffects, AccessExecutionResult | identity-owner/command-effects.ts | identity-owner/public.ts | runtime/access-ports.ts |
| NodeManagementCommands | modules/node-owner/commands.ts | node-owner/public.ts | application/node-management.ts |
| NodeManagementApi, response, interface version 1 | node-owner/command-api.ts | node-owner/public.ts | application/node-command-contract.ts |
| NodeManagementEffects | node-owner/command-effects.ts | node-owner/public.ts | runtime/node-change-ports.ts |

Each class retains its original five-argument constructor, own method bodies,
required effects checks and method signatures. Compatibility entries directly
re-export canonical leaves, without another subclass, instance, command coordinator
or copied API/effects declaration. Owner-local imports use canonical leaves;
cross-owner Node grant and Access result types use owner public entries, avoiding
a runtime self-import through the owner's public barrel. Node command/API/effects
types reuse the original Node-owned management declaration already exposed by its
public entry. Node snapshotting uses the same owner-local policy implementation
exposed by snapshotNodeCommand, with no duplicate validation.

L1 authorization/transaction/idempotency and original Identity/Node writer ports
are unchanged. No L0 API, schema, table, Runtime ledger, Agent authority or command
semantics are added. Runtime AccessChangeReconciler/NodeChangeReconciler bodies and
existing root instances remain unchanged; they consume the precise old type
aliases and continue to join the caller's transaction.

## Native Effects And Actual Call Chains

The old modules/identity-credentials.ts leaf led directly to
infrastructure/identity-secrets.ts. The new Access owner does not import that leaf
or the private secret implementation. Its bearer/ID/counter checks consume public
L2 nativeIdentityCodec, which binds the same original validBearerToken/isId/
isCounter functions. Its nativeIdentityTokenHash public alias re-exports the same
original tokenHash function through compatibility/native-identity.ts and
compatibility/public.ts; SHA-256 implementation, UTF-8 input and hexadecimal result
are not replaced with another digest or prefixed fingerprint.

The request path remains nativeCommandRequest -> L1 buildRequestIdentity with the
same original digest provider, replacing the old stateless application wrapper.
Actor/Scope/key validation, method/path/input projection and digest timing retain
their original call points. Member request identity contains the same optional
tokenHash, never the bearer token itself. Omitted token and original truthy token
selection remain unchanged. Member command Object.freeze snapshot still precedes
validation and request identity; expectedRevision allows zero only on that same
original member path.

Node ID validation consumes public L2 nativeNodeCodec's same original isId.
The original snapshotNodeCommand still rejects unknown command keys, clones and
freezes the same policy and arrays, and validates before request construction.
Policy uses PUT and revoke uses POST at the original paths. Access/Node response
ISO formatting consumes existing public nativeIsoTime, whose body is the original
new Date(value).toISOString(). No clock sample or null normalization is added.

The exact chains remain:

1. Access member: snapshot/validate -> token-hash request -> original transaction
   -> Identity owner authorization -> claim/replay -> Identity changeMember ->
   injected member effects -> status/body projection -> idempotent receipt.
2. Access Node grant: validate -> request -> original transaction -> Identity owner
   authorization -> claim/replay -> original Node changeGrant -> injected grant
   effects -> changed-dependent 202/200 response -> idempotent receipt.
3. Node management: Node ID validation -> original snapshot -> request -> original
   transaction -> Scope manage authorization -> claim/replay -> Node applyManagement
   -> injected reconcile -> Node audit -> 202 response -> idempotent receipt.

Replay still requires the original authorization first, then returns before any
writer/effects/audit/receipt side effect. All writes and callbacks receive the
same supplied Tx. Access no-change still invokes its original effects port and
returns status 200; changed returns 202. Node management remains 202. Node audit
still receives the raw numeric maximumAuthorization, while response formatting
keeps `maximumAuthorization ? nativeIsoTime(maximumAuthorization + 5000) : null`.
Zero remains null; this is not changed to a non-null check. Access uses the same
truthy rule and 5000 offset. Errors in effects, audit, ISO conversion or receipt
continue to abort the original transaction in their original order.

## Main Composition Integration

The main owner integrates shared files serially. application/control.ts now
consume AccessCommands/MemberChangeResponse/NodeGrantResponse from
modules/identity-owner/public.ts, and NodeManagementCommands/NodeChangeResponse plus
NodeManagementCommand from modules/node-owner/public.ts. Keep its current
construction arguments and existing Runtime reconciler instances unchanged.
api/application-ports.ts now consumes AccessCommandApi and NodeManagementApi
from those same respective public owner entries. The main integration has updated both
shared files; original collaborator instances and exact legacy leaves remain.

Shared boundaries should include the new commands/command-api/command-effects
leaves in their existing Identity/Node L3 owner, mark old application and Runtime
port leaves as precise reexports, and include the original native token hash alias
under L2. The alias does not make private infrastructure imports public exceptions.

## Planned Acceptance And Remaining Debt

No tests, type/syntax/static/boundary checks, formatter, generator, build, CI,
network/MySQL/browser/native experiment, commit or push ran. Planned cases for
later authorized Actions on one frozen source revision:

1. Compare public/legacy constructor and method identity, API/DTO/effects aliases,
   missing or non-function effects rejection and same root/reconciler instances.
   Existing five-argument construction and no new default provider must hold.
2. Compare member snapshot and validation order, expectedRevision zero, omitted/
   invalid token, exact SHA-256 tokenHash request bytes, bearer secrecy and original
   key/actor/Scope/path digest refusal. Node grant keeps boolean/revision rules.
3. Compare owner/manage authorization before replay; valid replay skips writer,
   effects, audit and receipt. Ensure each original callback/write shares the same
   Tx and later effects/audit/format/receipt errors roll everything back.
4. Compare Access changed/no-change 202/200, original grant/member effects and
   reconcile order, Node policy/revoke snapshot and methods, audit kind/details,
   original 202 response and receipt order. No new grant/identity authority exists.
5. Compare null/zero/positive/negative authorization limits and original truthy
   `+5000` ISO projection, including out-of-range ISO errors. Audit retains raw
   numbers; responses retain exact DTOs and original operation ID order.

Existing IdentityService/NodeService native policy and storage providers remain
their original owners; this slice does not certify all their source/type
dependencies. Runtime access/node reconcilers and their Forward/authorization
collaborators still need the separately assigned Runtime-owner continuation and
whole-source classification. It does not move their orchestration into these
product commands. Main root/API integration, A1 residuals, other A2 owners,
Agent/native/Runner and full classification/acceptance remain distinct work.
Foundation acceptance, stages B-E and the independent upper-module gate remain
incomplete; physical-host/release evidence remains unverified.

Current shared integration records canonical effects/commands and original L2
token hash alias, with readiness92/93 planned and entirely unexecuted.

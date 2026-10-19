# PathTemplate Owner Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original template metadata and cross-owner validation only.

## Public Rules And Compatibility

The Path public entry is modules/path-owner/public.ts, source interface candidate
1. Original template parsing, capability requirements, limits and persisted head/
revision validators now have one implementation in that owner directory. Existing
PathTemplateConfig/Head/Revision/Reader/Writer/References types are re-exported, not
redefined with stronger readonly, nullability or mutation guarantees.

The old modules/path-template-contract.ts directly re-exports the parser, requirements
and config type. application/path-templates.ts retains its classes and directly
re-exports the old limits and validator names. No copied validator remains there.
Legacy consumers must keep function/object identity and original failure behavior.
Remove these aliases only after identifying callers and accepting a compatible
frozen revision; do not remove them as a source-cleanup shortcut.

Closed-object keys, plain/null prototypes, version one, canonical TCP/UDP ordering,
two-to-eight distinct ordered nodes, exact downstream endpoints and locked Profile
references retain the original rules. The original hash predicate is retained, not
silently replaced by a stricter canonical-string check. Head and revision validation
retain parse-before-digest/error order, revision/time bounds and shallow returned
metadata with the original frozen parsed configuration.

## Original Owner Chains

- PathTemplateQueryApi -> PathTemplateQueries -> Scope authorization and template
  reader -> original MySqlPathTemplates -> existing template/revision tables. Head/
  revision validation and output formatting remain at the original query points;
  these metadata reads do not reauthorize live execution or reserve resources.
- PathTemplateCommandApi -> PathTemplateCommands -> original idempotency claim,
  Scope lock, locked head/CAS, immutable revision, clock and reference checks ->
  template writer/audit -> original response. The original supplied transaction,
  no-op/archive behavior, creation quotas and archived-ID refusal remain unchanged.
- NativePathReferences -> public Path requirements -> existing Node, Transport and
  Endpoint contracts in that same transaction. Original sorted Node and endpoint
  traversal, capability, protocol, Profile/digest and endpoint-revision checks remain.
  It checks declarations/grants, not online readiness or Runtime authority.
- PathBindings, PathGroups and IngressGroups -> public Path head/revision validators
  and reader/reference contracts. Each retains its own archived/digest/current-head
  refusal, provenance and mutation rules; no shared global transaction or state
  owner is introduced by exposing the validators.

PathTemplateQueries uses the existing L1 pageWindow and L2 ISO helper. Commands and
the owner validator use the existing L2 digest, and command construction obtains
the original current Date.now function through the public default-clock helper.
There is no earlier clock read, new command framing, timer, retry or normalization.

## Planned Evidence And Remaining Work

Readiness item 54 covers public/legacy identity and type shapes, exact parse/hash/
error behavior, source call chains, query metadata and same-transaction command/
reference ordering. Historical source-string tooling must be adapted only in the
later authorized verification phase. No test/CI tooling is expanded now.

The following [storage slice](path-template-storage-v1.md) places the original SQL
behind parameterized lower contracts; MySqlPathTemplates is now a precise legacy
wrapper. Item 55 records its unexecuted evidence separately. Other Path/Ingress
and Transit application, persistence, format and reference dependencies remain open.

Entering A2 does not accept or freeze A1: all unresolved A1 and full-source inventory
items remain blockers for the phase-A candidate. No tests, type/syntax/static/
boundary checks, formatter, generator, build, experiment, CI, commit or push ran.
No automatic selection, new listener, protocol, authority, schema, history reset or
cross-owner table write is added. Foundation and upper-module gates remain closed.

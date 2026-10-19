# PathTemplate Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original immutable template metadata persistence only.

## Contract And Implementation

L1 framework/public.ts exposes storage interface candidate 1: mutable stored head
and revision records, a parameterized configuration value, transactional reader and
writer ports, and the existing ReadPageWindow. It imports no Path product rule.
The original PathTemplateHead/Revision/Reader/Writer names specialize these lower
contracts with PathTemplateConfig; their fields, nullability and paging shape are
intended unchanged. This is not a new generic template product or validation policy.

L2 infrastructure/mysql-path-template-store.ts contains the one original SQL
implementation. It receives the caller transaction, never opens a pool or commits,
and uses the original bounded SQL paging helper. JSON remains raw driver/string
decoding, not schema validation or normalization. Boolean conversion, missing-row
nulls, count/list ordering, prefix matching, SQL arguments and optional head lock
are retained. The generic configuration type does not certify stored data.

Publish retains initial-head insertion only for revision one, immutable revision
insertion and current-head update in that order. Archive updates the same flag.
Audit generates its UUID at the original insertion call and writes the same event
fields. Scope lock, quota, CAS and archive decisions remain with the original
caller; there is no extra lock, retry, affected-row policy or authority.

## Owner Chains And Legacy Entry

- Existing PathTemplate APIs -> PathTemplateCommands/Queries -> original identity,
  idempotency, public Path rules and reference checks -> lower transactional ports
  -> MySqlPathTemplateStore -> original template, revision and event tables.
- Existing Control composition explicitly supplies MySqlPathTemplateStore with the
  public PathTemplateConfig type to those coordinators and the same Path/Ingress
  collaborators. No additional composition root or transaction is introduced.
- infrastructure/mysql-path-templates.ts retains MySqlPathTemplates as a stateless
  zero-argument class with its original public async prototype methods and optional
  lock default. Methods delegate to one lower implementation; subclass override
  points remain available. It owns no SQL, parser, pool or protected state.

The wrapper is a precise legacy binding, not a general L2 reverse-import exception.
Remove it only after caller inventory and accepted compatibility evidence on the
frozen revision. Public product imports belong in this wrapper and Control, never
in the lower implementation. NativePathReferences still uses the original Node,
Transport and Endpoint contracts and caller transaction. No Forward publication,
Runtime ledger, Agent authority/Journal or listener owner moves to this store.

## Planned Evidence And Remaining Debt

Readiness item 55 covers type/legacy construction and subclass compatibility, exact
SQL/argument/lock order, raw JSON and Boolean behavior, missing/corrupt values,
bounded prefix paging, publish/archive/audit behavior and transaction rollback.
Later authorized verification must adapt historical source-string tooling to the
actual single SQL owner; it must not restore copied SQL to satisfy old patterns.
Functional/MySQL evidence belongs in Actions on the same frozen source.

No tests, type/syntax/static/boundary checks, formatter, generator, build, network/
MySQL/browser/container experiment, CI, commit or push ran. This is an uncommitted
dirty source candidate, not an exact tested revision or A2 acceptance. Other Path
bindings/groups/publication, Ingress and Transit storage/native/application owners,
A1 residuals and full-source classification remain open. Foundation and upper
module gates remain closed; no schema, protocol, feature or frozen semantics change.

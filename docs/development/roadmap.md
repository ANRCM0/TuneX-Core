# TuneX VNext Implementation Roadmap

**Status: implementation plan.** Legacy V2 code remains in repository for reference; no migration or VNext release has been executed by these documentation commits.

## Phase 0 — Frozen design baseline

- Core v1, Forward v1, ADP/1, Runtime/Agent and Module Boundaries documented.
- Set new package structure (`packages/core`, `packages/contracts`, `apps/control`, `agent`, `apps/web`) without prematurely requiring a separate Core service.
- Establish ADR process, version tags, typed validation, security requirements and test fixtures.
- **Exit**: no ambiguous state ownership, Forward can be modeled without mandatory Link/Tunnel, errors/IDs/version semantics agreed.

## Phase 1 — Core and control persistence

- Implement pure types, parsers, Forward invariants, expected-revision change decisions.
- Implement minimal Node identity/grants and Forward CRUD.
- MySQL: Forward revisions, durable Operations, per-node snapshot generation, reservations and fences, Agent report deduplication. Database schema is **new**; V2 migration compatibility not required.
- Minimal REST API and tests. Redis may wake jobs, MySQL scanner ensures recovery.
- **Exit**: idempotent create/update/delete intent, isolation and conflict tests, Core tests without DB/Redis.

## Phase 2 — ADP/1 + single-node Go Agent

- Real authenticated Hello, Snapshot, Report; durable high-water/fence and local cache.
- Go `native.direct.v1` TCP and UDP execution; create/enable/disable/delete, resource cleanup, bounded lease.
- Minimal UI or CLI control workflow; no billing, federation or TST prerequisite.
- **Exit**: isolated Linux two-process/host traffic harness verifies payload + reverse path, restart/reapply, port conflict, stale snapshot, secure machine auth.

## Phase 3 — Native relay

- Implement `ingress` / `egress` Assignments, staged prepare/activate, correct dependency ordering.
- True two-Agent TCP and UDP flows, failure recovery, resource fencing, role capability compatibility.
- **Exit**: real multi-host/namespace tests demonstrate no ingress exposure before egress ready; rollback/cleanup and reconnect pass.

## Phase 4 — Transport evolution

- Versioned immutable Transport Profiles, driver registry and negotiated capabilities.
- Audit encrypted transport design, key lifecycle, no-downgrade semantics, link reuse only when warranted.
- Advanced multi-hop, QUIC or other protocols require explicit follow-up ADR/security review, not automatic v1 support.
- **Exit**: native parity maintained; secure path validated under negative identity/config tests and real network environment.

## Phase 5 — Product modules

- Unified Forward-first Web Console, Node Management UI, useful real-time health with freshness.
- Optional routing, usage metering, quotas, billing, notification, federation.
- **Exit**: removal of optional modules does not break standalone direct TCP/UDP service.

## Engineering discipline

- Small vertical slices: define behavior → implement Core/Contract → Control → Agent → integration test → real traffic test.
- Keep old V2 code read-only reference until replacement is tested; no obligation to keep its public API or migrations.
- CI must distinguish unit, DB integration, simulated Agent, real network and security acceptance. Never turn a simulated pass into a production claim.
- Breaking changes to accepted VNext specs require ADR and synchronized contract tests.
- Docker/production support comes after Linux real-network verification, backup/restore, capability compatibility and secret handling.

## Suggested mono-repo

```text
apps/web/
apps/control/src/{api,modules,infrastructure}/
packages/core/src/
packages/contracts/src/agent/
agent/internal/{control,assignment,ownership,forward,transport}/
deploy/
docs/{architecture,spec,protocol,development,testing,decisions}/
legal/
```

A directory shape is not a demand to create empty scaffolding or premature microservices.


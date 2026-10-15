# Multi-hop execution delivery

Baseline: `904c5aa1907948b3859652c80575268c796c4895`.
Started: 2026-10-16 (Asia/Shanghai).

This is the implementation ledger for the six authorized delivery batches.
An implementation, a passing local test, a passing CI run, and an external-host
acceptance are separate evidence. No unchecked gate is a completion claim.

| Batch | Scope | Status | Required exit |
| --- | --- | --- | --- |
| 1 | Shared physical ownership, migration, execution authority | implemented; runtime acceptance deferred | Durable ownership, stale-writer/replay rejection, crash-safe migration, protected authority |
| 2 | Complete mixed snapshots and execution Report/Ack | implemented; conformance execution deferred | Version/capability gates, complete resource set, idempotent durable delivery |
| 3 | Ingress/Transit/Egress Runner integration | implemented; data-plane acceptance deferred | Actual role sockets, renewal continuity, bounded drain, hard expiry |
| 4 | Control-to-Agent deployment coordination | implemented; MySQL/process acceptance deferred | Three real Agents, downstream-first activation, recovery and safe cleanup |
| 5 | Four/eight-node and external-host acceptance | tools and CI prepared; no runtime results | Consecutive Transit hops, faults, budgets, renewal and reproducible evidence |
| 6 | Console, operator procedures and release gates | implemented; UI/container/release acceptance deferred | Gated configuration, diagnostics, audit and verified release prerequisites |

## Invariants

- One Node identity and one authoritative physical ownership history per Agent.
- Physical resource keys use transport protocol/port; UDP over TLS owns TCP.
- A role/Forward/deployment ownership change must advance the physical Fence.
- Duplicate delivery does not recreate listeners; renewal does not replace an
  unchanged execution instance or extend a retired instance's authority.
- Publication rechecks live permissions, sessions, credentials and policies;
  its upper bound is recorded in protected Authority before DB publication.
- Acknowledging receipt does not prove execution or end-to-end reachability.
- An execution report cannot release authority held by another historical session.
- Every durable transition precedes the corresponding network side effect.
- Old clients reject unsupported execution contracts; no silent downgrade or
  Journal reinitialization is permitted during migration or rollback.
- Execution remains default-off until its runtime and network gates pass.

## Failure and capacity hardening

The Report consumer now distinguishes retryable downstream failures from terminal
execution errors for the latest multi-hop plan. A terminal error during deployment
fails that attempt. A terminal error after success creates a linked failed
Operation, preserving the original successful Operation for audit. The path is
withdrawn, renewal stops, and physical slots remain owned until cleanup is safe.
Old-generation reports cannot fail an accepted successor, and unrelated queued
work cannot preserve the failed path's ingress Snapshot.

Capacity preflight covers every current and historical path Node on creation,
updates, deletion, retries, authorized grant/member/policy changes and automatic
session/credential refresh. It includes each Node's eventual assignments and
retirement history. A rejected acceptance transaction retains the previous
plans, fences and Operations.

Deployment diagnostics now use the same live authorization decision as Snapshot
publication. They expose renewal permission separately from fresh execution
observations and retain the last Operation's linked failure details. Revocation
immediately clears displayed readiness even before removal reaches every Agent;
stale observations are not labelled as current evidence.

Seven real-MySQL regression cases were added for these branches. They use
synthetic execution reports and do not constitute network evidence. The configured
CI Phase 1 job invokes them with its disposable MySQL service. Their source
passes TypeScript checking; the cases have not been executed in this session.

## Acceptance environments

- Local workspace: Windows; Node 24.14.1, npm 11.11.0, Go 1.26.3.
- Local WSL Linux tools exist; no new service or runtime suite was started.
- Independent physical-host inventory: unavailable. The user explicitly deferred
  testing until development is complete; do not ask for hosts again at this stage.
- Existing deployment/Relay/long-running recovery P0 work remains a separate
  release prerequisite; multi-hop completion does not waive it.

## Evidence

The implementation was prepared against the baseline SHA above. Source commits
and pushes are recorded in Git history; publication does not establish passing
CI, runtime acceptance or image availability. The existing main-branch workflows
run automatically on push, and their results must be checked for that exact SHA.

Static checks performed during development:

- TypeScript `tsc --noEmit` passes after the implementation changes.
- Go production packages build and `go vet ./...` passes; test sources were compiled with
  `go test -run '^$' ./...` without running test cases.
- Schema/type generation and fixture freshness checks pass. There are 36 shared
  execution vectors, including a mixed Direct/Relay/multi-hop Snapshot.
- Browser JavaScript syntax checks and module/document boundary checks pass.
- Five changed CI/Compose YAML files parse, and `git diff --check` passes.

These checks do not establish runtime correctness. New unit, conformance,
MySQL, network, process, race, container, UI and physical-host acceptance cases
are authored but not reported as passing. Final static rechecks are recorded
by the development session; deferred acceptance must use the actual tested
commit, tree state, binary hashes and image digests.

Operational details, the unified command sequence, physical inventory format and
production evidence bundle are in [multi-hop execution](multihop-execution.md).
The protocol and adapter decision are in
[ADR-0005](../decisions/0005-mixed-multihop-execution.md).

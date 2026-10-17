# Native Multi-hop Console Acceptance

Status (2026-10-17): authored and wired to Actions; local static checks only.
No exact-commit functional, MySQL, browser or network result is claimed.
This completes acceptance tooling, not B1/P1 or project acceptance.

## Entry Point and Bounds

The existing `multihop` job in `.github/workflows/ci.yml` builds the native Go
Agent, time-proof and network-fixture binaries against disposable MySQL 8.4.9.
It installs pinned-package Chromium on the disposable runner and runs the
existing `npm run test:multihop` with `TUNEX_MULTIHOP_BROWSER=1` for each matrix
size: 3, 4 and 8 Agents. The following isolated-network step does not opt in.

The opt-in rejects non-Linux, non-Actions and `--isolated` combinations before
creating artifacts/PKI, opening MySQL or constructing a network lab. Default
fixture behavior, production feature flags, Core, machine contracts, migrations,
Journal and Runtime authority are unchanged. Do not run functional acceptance on
the development workstation; use the existing Actions entry point.

`scripts/phase2/multihop-console.ts` reuses `withBrowser` and the original real
Control/Agent fixture after replay and grant-recovery checks, before source
offline deletion. The one-day disposable CA exception is confined to the test
browser context. This is not production TLS verification or physical-host proof.

The browser fixture grants only ingress an additional business port and gives
every downstream Node four internal TCP ports: two per dual-protocol Forward.
Selections are distinct within this fixture, bounded to 128 attempts each; this
does not promise OS availability or reserve ports before original acceptance.

## Authored Flow

1. Publish Profile r2 through the original form while the source remains on r1.
   Source desired revision and complete spec remain unchanged throughout.
2. Copy from the original rule row. Verify default disabled state, blank listener
   port, editable ingress, original business protocols, target, exact r1 lock and
   all ordered transit Nodes. No mutation or reservation is made by opening it.
3. Select the explicit spare port and run the original read-only plan. Assert
   exact proposed spec, ordered path, r1, two resources per Node, no reservation
   and no executable authorization. MySQL still has only source-owned slots.
4. For 4/8 Nodes, move the first transit down and back, checking draft order and
   immediate preview invalidation. For 3 Nodes, edit/restore the target instead.
   Neither action dispatches a command. Recheck the original plan explicitly.
5. Create the disabled copy through the original POST, wait for its Operation,
   check two fenced reservations per Node, and independently require TCP refusal
   and UDP refusal/timeout at the copy listener. Read the middle Node's original
   tunnel reference view: transit role, predecessor, successor, full path, r1 and
   disabled intent; these metadata reads are not health evidence.
6. Explicitly enable with CAS r1, await real ready reports for every ordered Node
   and reverse activation order, then verify actual TCP and UDP through both
   source and copy. The deployment query still reports `trafficVerified:false`;
   only the separate native client provides this fixture's traffic evidence.
7. Explicitly disable with CAS r2. Wait for convergence and refuse both protocols,
   retaining the copy's reservations. Explicitly delete with CAS r3 and wait for
   safe cleanup; no owned copy slots remain and source traffic still works.

Exactly five explicit browser intent requests (Profile/create/enable/disable/
delete), two read-only plan POSTs and distinct original idempotency keys are
checked. There is no source update, hidden replay, bulk endpoint, automatic
rollback, physical Link sharing or new execution path. Operation/readiness waits
poll bounded conditions rather than assuming success after a fixed sleep.

Two additional lightweight DOM regressions cover the six-transit maximum,
reordering/invalidation/fresh preview with a newer current Profile, and fail-closed
copy preview when the Control multi-hop gate is disabled. They remain model/UI
tests, not substitutes for the real browser flow.

## Evidence and Remaining Gates

The existing report retains exact commit/tree/patch identity, Agent and fixture
hashes, topology, traffic and final process/database cleanup. Its `console`
section records matrix size, current versus locked Profile, explicit attempts,
draft invalidation and copy-resource cleanup only after the assertions succeed.
Baseline and isolated runs without opt-in record `console:null` and are not
browser evidence. Failure or cleanup error never becomes a successful report.

Upload adds only `.artifacts/multihop/**/console-multihop-*.png` to the existing
evidence allowlist. Screenshots cover desktop/390px copy plans, disabled transit
references and active deployment. No browser trace, HAR, PKI, token or protected
Agent state is uploaded by this addition; the pre-existing failure report policy
is unchanged. Browser credentials remain tab-memory-only and the shared helper
checks empty token input, storage and cookies, plus no page JavaScript errors.

Exact-SHA Actions and final frozen-source matrix review remain required. All
Agents here are independent processes on one Linux host, not physical machines.
Physical multi-host/public-network/NAT, long-run, operational recovery and release
gates remain missing when their environments are unavailable. New driver or
production enablement is not authorized by this fixture.

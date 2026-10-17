# Native Multi-hop Console Acceptance

Status (2026-10-17): authored and wired to Actions; local static checks only.
No exact-commit functional, MySQL, browser or network result is claimed.
This extends acceptance tooling, not B1/P1, C1 or project acceptance.

## Entry Point and Bounds

The existing `multihop` job in `.github/workflows/ci.yml` builds the native Go
Agent, time-proof and network-fixture binaries against disposable MySQL 8.4.9.
It installs pinned-package Chromium on the disposable runner and runs the
existing `npm run test:multihop` with `TUNEX_MULTIHOP_BROWSER=1` for each matrix
size: 3, 4 and 8 Agents. The following isolated-network step does not opt in.

The opt-in rejects non-Linux, non-Actions and `--isolated` combinations before
creating artifacts/PKI, opening MySQL or constructing a network lab. Default
fixture default behavior, production feature flags, Core, machine contracts,
Journal and Runtime authority are unchanged. Separate path slices add migrations
0018/0019 and original-owner provenance, not another executable contract. Do not run functional acceptance on
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
7. The separate path-switch flow below attaches the same path, switches and
   explicitly restores it before cleanup. Explicitly disable using its returned
   current CAS (r4), retaining the copy's reservations; then delete with CAS r5 and wait for
   safe cleanup; no owned copy slots remain and source traffic still works.

The copy lifecycle still checks exactly five explicit browser intent requests
(Profile/create/enable/disable/delete), two read-only plan POSTs and five distinct
original idempotency keys, separately from the path-switch and metadata flows. There is no source
update, hidden retry, bulk endpoint, automatic
rollback, physical Link sharing or new execution path. Operation/readiness waits
poll bounded conditions rather than assuming success after a fixed sleep.

Two additional lightweight DOM regressions cover the six-transit maximum,
reordering/invalidation/fresh preview with a newer current Profile, and fail-closed
copy preview when the Control multi-hop gate is disabled. They remain model/UI
tests, not substitutes for the real browser flow.

## Explicit Path Binding and Switching

`scripts/phase2/path-switch-console.ts` uses the same original browser/Control/
Agent context while the copy is enabled at r2:

1. Publish an exact full-path template r1 through the metadata form, retaining
   Profile r1 while its current head is r2. Attach it through the separate path
   panel. The expanded copy is unchanged: 200, no Operation or generation change.
2. Publish template r2 with only ingress/egress, then verify the copy remains at
   its old CAS/path. Current reference impact shows the fixed target and original
   CAS, without reserving resources or applying automatically.
3. Prepare the exact proposal, confirm, run the original fresh Relay plan and
   original Forward/path transaction. Route the actual committed 202 then abort
   its response. UI fields lock uncertain; explicitly replay the identical
   key/body with no new plan or CAS replacement. Copy becomes r3, the real
   two-Node deployment is ready, and actual native TCP/UDP is verified.
4. Explicitly select template r1 and current CAS r3. A new original Operation
   restores the full 3/4/8-Node path as r4 with a higher deployment generation;
   this is not automatic rollback or replay of an old Snapshot. Verify real
   TCP/UDP, unchanged full spec and three immutable provenance records [r1,r2,r1].
5. Archive template head r2. Its current binding still points to r1 and actual
   traffic still works; new impact is unavailable. Original copy disable/delete
   then uses returned CAS r4/r5 and verifies original safe resource cleanup.

This adds three metadata commands and four binding attempts (one deliberate
same-key replay), six distinct keys, three non-reserving path proposals and
three original Relay plan checks. Only original Runtime deploys the two actual
path changes. `console.pathSwitch` records assertions after completion, including
no physical-host or measured-interruption claim. Screenshots cover shortened
path state and 390px layout; source desired spec/revision is never mutated.

## PathTemplate Metadata Follow-up

`scripts/phase2/path-template-console.ts` uses the same original page/context and
real enrolled Node/Profile/Endpoint owners after the copied Forward is deleted.
It creates only [immutable template metadata](../spec/native-path-templates-v1.md):

1. Fill all ordered Nodes and explicitly pin Profile r1 while current is r2.
   Capture current downstream Endpoint revisions through the original bounded GETs.
2. Publish r1 via the real form. The browser route forwards to real Control and
   aborts the already committed 202 reply; the UI stays uncertain and locks fields.
   No replacement command or new Endpoint capture occurs. Explicitly replay the
   identical key/body and receive the original acceptance.
3. Explicitly publish unchanged config with CAS r1 (200/no new revision), then
   change business protocols, recapture and publish r2. Exact r1 is unchanged.
4. Inspect r1 with the current head r2 as CAS, then archive r2 permanently. r1
   remains readable with its original config and `archived:true`.
5. Recheck original source revision/full spec, source-only owned slots, current
   Profile r2 and real source TCP/UDP. Metadata has no binding, execution authority,
   reservation, Forward update or new Runtime lifecycle.

This adds exactly five metadata attempts (including one deliberate same-key
replay), four distinct keys and two bounded captures. With the separate path
flow, the combined browser session has seventeen intent attempts, fifteen
distinct keys, five original Relay plan POSTs and three path proposal POSTs.
`console.templates` records only successful metadata assertions, with explicit
non-authority flags. Port/UI regressions and real MySQL concurrent CAS/quota /
SELECT-only history run separately. Original-owner bindings/impact/single-rule
switches are covered by the separate flow above; multi-rule path publication and
C1 acceptance remain pending.

## Evidence and Remaining Gates

The existing report retains exact commit/tree/patch identity, Agent and fixture
hashes, topology, traffic and final process/database cleanup. Its `console`
section records matrix size, current versus locked Profile, explicit attempts,
draft invalidation and copy-resource cleanup only after the assertions succeed.
Baseline and isolated runs without opt-in record `console:null` and are not
browser evidence. Failure or cleanup error never becomes a successful report.

Upload adds only `.artifacts/multihop/**/console-multihop-*.png` to the existing
evidence allowlist. Screenshots cover desktop/390px copy plans, disabled transit
references, active deployment, shortened path/mobile switching state and
desktop/390px immutable template inspection.
No browser trace, HAR, PKI, token or protected
Agent state is uploaded by this addition; the pre-existing failure report policy
is unchanged. Browser credentials remain tab-memory-only and the shared helper
checks empty token input, storage and cookies, plus no page JavaScript errors.

Exact-SHA Actions and final frozen-source matrix review remain required. All
Agents here are independent processes on one Linux host, not physical machines.
Physical multi-host/public-network/NAT, long-run, operational recovery and release
gates remain missing when their environments are unavailable. New driver or
production enablement is not authorized by this fixture.

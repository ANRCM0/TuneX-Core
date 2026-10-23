# N2 Personal Console Source Candidate

Source only, 2026-10-21. No syntax/type/static/boundary checks, tests, browser,
network, formatter, build, CI, commit or push were executed for this candidate.
The existing blue/white console design and original command owners remain.

## Layers And Contracts

- L2 browser presentation and HTTP representation adapters consume the existing
  IdentityContext, ConsoleNode, immutable template/profile/endpoint and Forward APIs.
- Existing L3 ConsoleModel form decisions reject absent `canUse` and unauthorized
  ingress purpose. No server foundation, Runtime ledger or Agent owner is edited.
- Public `initPathTemplates` adds `loadDraft` to its returned operations. It keeps
  pending command replay protected and routes the selected draft through the
  original exact Endpoint capture and immutable publish command.
- Direct/Relay/Path/Probe commands still use their original server authorization,
  CAS, preview and idempotency behavior. Client navigation never authorizes them.
- Root integration must classify the three new native representation leaves and
  record the ConsoleModel successor semantics and additive PathTemplate operation
  alongside the current foundation change request.

## Root Integration

Serve these four additional module assets with the existing console headers:

- `/console/account-context.js`
- `/console/line-builder.js`
- `/console/template-reference.js`
- `/console/admin-resource-console.js`

No new HTTP API is required. Login reads `GET /api/v1/me/context?limit=100`, with
`after` for the next bounded page. The current page plus active selection is kept
in memory. Scope IDs are selected from actual identity records; inactive/absent
membership remains visible but disabled. Ordinary managers are not scope owners.
Governance navigation appears only for an enterable owner context. Every scoped
request is still independently checked by Control.

Personal machine/resource lists use `ownership=mine|available`; Forward lists
default to `ownership=mine`. Node rows consume `resourceSource`, `ownerActorId`,
`allowedRoles`, `canUse` and `readDetail`. Shared reports are labelled unavailable,
excluded from stale-host summaries, and do not offer whole-host detail actions.

The line builder queries bounded Relay candidates independently by `role=ingress`,
`role=transit` and `role=egress`. It reads the selected exact Profile revision,
captures exact Endpoint revisions, and offers two explicit actions. Save loads
the existing template editor; publishing and Forward binding remain separate.
Use directly calls the original Relay initializer's additive `loadPathDraft`,
which rereads purpose-specific candidates and the exact Profile, checks current
multihop support and loads a new disabled Forward draft with an empty target.
It creates no template or command. The user still fills the target, previews and
submits through the original Forward flow. Unknown pending commands cannot be
silently replaced, and late reads are discarded after account/Scope changes.
The older Relay candidate selector now selects a purpose explicitly; pinned
ingress/transit/egress candidates are fetched for their own roles. Candidate/ingress
groups resolve exact template digests from the selected name/revision before the
original immutable metadata command; users do not supply digests or runtime fences.

## Required Administrator Flows

The enterable Scope owner has a separate resource-management view. Its governance
Node list deliberately omits personal `ownership` filters and filters by original
`resourceSource`; it can therefore find ungranted shared Nodes and legacy Nodes.
The independent shared provision form calls `POST shared-nodes`. The ordinary
personal form calls `POST nodes`; the forms cannot silently switch resource source.
Both provision paths send once, guard duplicate clicks, and retain an ambiguous
result lock because these original server provision APIs do not implement
idempotent replay. A new attempt requires explicitly acknowledging a checked
resource list. One-time enrollment credentials remain in the original dialog only.

The administrator Grant editor reads `GET nodes/:id/grants` plus `GET members`.
It consumes the successor Grant entry `{actorId,allowedRoles,portLimits}` and
requires its original Node-wide grant revision; there is no hand-entered CAS.
`PUT nodes/:id/grants/:actor` carries explicit `allowedRoles:null|role[]` and:

- Keep existing limits: omit `portLimits` entirely, including purpose-only updates.
- Clear additional restrictions: explicitly send `portLimits:null`.
- Replace limits: send `{allowedPorts:null|number[],maxBindings:null|number}`.
  Zero is a real physical-binding maximum; blank means no additional maximum.

The UI labels physical binding counts as protocol/port slots, not merely distinct
port numbers. Withdrawal sends `allowed:false`, `allowedRoles:null` and omits
replacement limits. Each change uses its original key/body and server atomic
command. Uncertain results permit explicit same-key/body replay; no new CAS or
automatic retry is substituted. Acceptance is displayed separately from later
Operation reconciliation or expiry of old authorization.

An expert classification section reads the current Node `resourceRevision` or
Forward/Template/Group/Ingress revision first. It uses original `classify` and
`classify-owner` endpoints. Node source, explicit owner/null and retain/discard of
legacy grants are selected deliberately; private Nodes require discarding old
delegations. Other resource owners are selected from current eligible members.
Classification cannot transfer an already classified resource; the server retains
that authority and all protected history.

Every Forward has a `Probe support` entry calling the N4 initializer's additive
`openCapabilities(forward)`, including Relay, multihop and UDP. The original Direct
TCP `open(forward)` execution entry remains separate. Root must integrate the N4
`probe.js` successor before this entry can work.

Usable Node rows also expose an on-demand `GET nodes/:id/port-usage` read. The
dialog is explicitly the current account's personal physical-port usage and
renders the original read-only response; it never relabels whole-host capacity as
personal consumption. Root owns this successor API route and access filtering.

## Planned Acceptance

Authored cases in `test/product-context-flow.test.mjs` cover authenticated context
transport, inactive owner entry, cursor mismatch, purpose denial, shared report
visibility, exact immutable template resolution and rejected revision/access reads.
These cases have not been run. Existing ConsoleModel/Relay/browser fixtures must
be migrated to the `canUse`, `allowedRoles`, `readDetail` successor contract before
concentrated verification; missing fields intentionally do not grant usage.
Additional authored cases distinguish keep/clear/replace of Grant limits, zero
maximum, invalid subsets, duplicates and closed DTO fields. They are unexecuted.

Authorized later Actions/browser acceptance should cover:

- Login failure, two concurrent logins, disconnect during lookup, Scope selection
  and paging, no usable Scope, and revoked membership on a later scoped command.
- Switching accounts or Scope clears secrets, pending commands, diagnostic/history
  state, line draft choices, selected rule batches and cached Forward status.
- Ordinary users cannot see governance navigation; typing or replaying a forbidden
  server request still fails at its original owner boundary.
- Personal/shared query totals and pages use server filters before pagination.
- Ingress-only/egress-only grants produce distinct role choices; revoked grants
  fail original preview/publish/command checks after a selection is cached.
- The complete select resources -> exact revisions -> explicit template publish ->
  exact binding -> original Forward command -> Operation/status flow, including
  uncertain replay, conflicting revisions, deleted resources and partial failures.
- Direct unsaved composition -> fresh role/profile reads -> disabled Relay draft
  -> user target -> preview -> original Forward submit; denial at any stale hop,
  pending-command replacement, late responses and account reset. Authored cases in
  `test/native-relay-complete.test.mjs` remain unexecuted.
- ProbeRun/ProbePlan `losses:null` displays unavailable. Aggregate withheld scope
  counters require four null values and never display synthetic zeroes.
- Shared host evidence in Forward diagnostics remains unavailable while the
  actor's Forward listener evidence is retained. No null implies offline/healthy.
- Responsive layout, keyboard focus, control labels, error recovery, fixed asset
  routes and the established security headers on desktop and mobile browsers.
- Shared versus private provision URL/body, double click, unknown result without
  replay, one-time secret clearing and explicit next provisioning attempt.
- Grant read revision, purpose-only update preserving limits, explicit clear,
  zero-binding limit, revocation, concurrent node-wide CAS conflict, same-key
  replay and post-acceptance refresh failure without misreporting rejection.
- Legacy classifications for all five resource types, exact revisions, active
  owner selection, explicit Node grant handling, stale revision rejection, and
  inability to transfer an already owned resource.
- Owner-only resource navigation, Scope switch during administrator requests,
  personal port-usage access, and N4 support display for each Forward shape.

## Remaining UX Scope

FR-0032 adds `resource-limit-console.js` through the same fixed native asset
adapter. Governance edits one shared Node/subject's latest policy with explicit
UTC millisecond dates, bytes/second, burst bytes, total bytes and revision CAS.
Blank limits mean null, zero denies, and at least one dimension must be set.
Unknown PUT outcomes freeze body/key/identity for exact replay or explicit discard;
account/Scope clear aborts pending reads and rejects late results. Personal shared
Node views read only the current actor's configured policy. Private exemption,
future-head semantics and unavailable/null consumption are labelled explicitly.
This page supplies no running-balance or precise billing claim.

Authored `resource-limit-console-flow.test.mjs` and `resource-limit-audit-flow.test.mjs`
cover DTO/units, unknown outcomes, account clear and immutable audit revision.
They have not run. Real browser accessibility/mobile, multi-user denial, actual
configuration delivery and Agent exhaustion still require authorized acceptance.

The personal Node view now has an in-page preparation/enrollment/run/status guide
using the original CLI flags and interactive token input, with no secret embedded
in a generated command. It explains Direct versus Relay/multihop switches, paired
Control support, current session/report checks and protected Journal recovery.
Agent binaries, actual Control URL, CA, filesystem provisioning and service
management still come from the trusted deployment workflow. This source guide is
not an installer or proof of an accepted operating-system deployment.
The new selector prepares a new line; existing line revision editing remains in
the original exact-revision editor. Group candidate names and line revisions,
advanced switch/batch/publication/ingress migration forms retain their explicit
expert inputs and confirmation steps. There is no automatic publication, retry,
failover or claim of current network health. Password login, registration and
account recovery remain outside this frontend slice. Historic non-Node resource
classification is an expert ID-based entry; the original owner-specific readers
and server acceptance still determine which records can be classified.

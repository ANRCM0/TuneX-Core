# Product Resource Access v1

Date: 2026-10-21; verification status updated 2026-10-23.
FR-0028 through FR-0030 passed the configured N candidate Actions scope and were
merged through PR #114 at `9a5f719`. Exact candidate/main identities, job results
and remaining gates are recorded in [N verification](../testing/verification-status.md).
This does not change the historical frozen B acceptance. Examples below are
documentation, not evidence that these particular requests were executed.

## Ownership, Use And Governance

The existing Scope is the shared resource namespace. Its owner is the Scope
governance actor; ordinary `canManage` membership does not grant private use.
Cross-Scope sharing and a global administrator are outside this contract.

| Resource | Use or ordinary modification | Governance |
| --- | --- | --- |
| Private Node | Explicit private owner plus original membership/grant/execution checks | May manage/revoke under the original commands; cannot use or regrant another person's private Node |
| Admin-shared Node | Explicit grant, purpose subset, port limits and original execution checks | Shared provision and explicit grants; creating the Node grants no implicit use |
| Legacy-unclassified Node | New use/renewal denied pending explicit classification | Original audited CAS classification with explicit old-grant handling |
| Forward | Immutable product owner plus original full-route execution authorization | Original stop/delete rules; governance does not change a target, enable or retry as another owner |
| PathTemplate / PathGroup / IngressGroup | Immutable product owner plus original referenced-resource authorization | Explicit legacy classification under the original owner |

`authorization_actor` remains execution authorization metadata. It does not
replace immutable product ownership. Saving a path or selecting a candidate does
not reserve a port, prove reachability or grant execution authority.

## HTTP Entry Points

Authenticate with the original Bearer header. Actor identity always comes from
that authentication, not a query/body actor supplied for personal reads. Scoped
paths below have prefix `/api/v1/scopes/:scope`.

| Method and path | Source contract |
| --- | --- |
| `GET /api/v1/me/context?limit=100&after=scope-id` | Bounded current-account Scope records; `after` is optional, inactive/absent membership cannot enter |
| `POST /nodes` | Original NodePolicy body; creates a private Node and its explicit initial owner grant |
| `POST /shared-nodes` | Same NodePolicy body; Scope owner only, no implicit creator grant |
| `GET /nodes/:id/grants` | Shared Node grant revision, actor IDs and `{actorId,allowedRoles,portLimits}` entries |
| `PUT /nodes/:id/grants/:actor` | Original node-wide CAS and Idempotency-Key, purpose and optional port limits |
| `GET /nodes/:id/port-usage` | Current caller's original physical-slot aggregates; accepts no query parameters |
| `POST /nodes/:id/classify` | Explicit source, owner/null, legacy-grant choice and resource revision CAS |
| `POST /forwards/:id/classify-owner` | Explicit non-null owner and original configuration revision CAS |
| `POST /path-templates/:id/classify-owner` | Same one-time owner classification under the Path owner |
| `POST /path-groups/:id/classify-owner` | Same one-time owner classification under the Path owner |
| `POST /ingress-groups/:id/classify-owner` | Same one-time owner classification under the Ingress owner |

Node provisioning has no idempotent command receipt. An uncertain response must
be reconciled with the resource list before explicitly creating another Node;
do not automatically replay provisioning. Original grant/classification commands
retain their Idempotency-Key, same-body replay, transaction and audit contracts.
Classification never transfers an already classified resource or rewrites the
execution authorizer, configuration revision, protected history or running state.

## Grant Example And Three Limit States

After reading the current Node-wide grant revision, an administrator may send:

```http
PUT /api/v1/scopes/scope-a/nodes/shared-b/grants/user-a
Authorization: Bearer <administrator-token>
Idempotency-Key: <fresh-original-command-key>
Content-Type: application/json

{"expectedRevision":1,"allowed":true,"allowedRoles":["transit"],"portLimits":{"allowedPorts":[34001,34002],"maxBindings":2}}
```

Purposes are `ingress`, `transit`, `egress`. Null or omitted `allowedRoles` means
no additional purpose restriction; an empty/invalid/duplicate subset is rejected.
No grant always means denial. Withdrawal requires `allowedRoles:null`.

| `portLimits` input | Meaning |
| --- | --- |
| Omitted | Preserve current limits, including purpose-only edits |
| `null` | Clear additional grant limits |
| Explicit object | Replace with validated `allowedPorts` and `maxBindings` |

Each object field is null for no extra restriction. A non-null port array is a
nonempty, unique subset of 1..65535. A non-null maximum is a nonnegative safe
integer; zero is a real maximum. Grant restrictions do not widen Node policy or
platform capacity. Narrowing joins the original whole-route reconciliation.

## Personal Lists And Usage

`GET /nodes?ownership=mine` lists the caller's private Nodes;
`ownership=available` lists owned private and granted shared Nodes.
`resourceSource=private|admin-shared|legacy-unclassified` is a source filter, not
an authorization flag. Governance listing and ordinary personal listing remain
distinct. Forward personal lists use `ownership=mine`. Filters, total counts and
pages use the same caller restrictions before pagination.

`GET /nodes/candidates?mode=relay&role=transit` selects a purpose explicitly.
The default purpose is ingress. Capability and credential summaries remain
advisory: original preview and commands recheck the complete path.

ConsoleNode2 requires `resourceSource`, `ownerActorId`, `allowedRoles`, `canUse`
and `readDetail:full|shared`. NodeApi's detail response is the separate
`detail:full|basic` union; consumers must discriminate before reading policy or
credential fields. Shared users cannot read whole-machine reports, host telemetry
or other users' references. Explicit governance and private-owner read policy is
defined by ResourceAccess; execution eligibility is checked independently.

NodePortUsage1 counts current caller physical `protocol+port` bindings from the
single Runtime ledger, including internal and draining rows until original
release. TCP and UDP are separate. Private Nodes report `not-applicable`, null
remaining and null grant limits. Shared Nodes report `shared-grant`; an unlimited
maximum has null remaining, while exhausted limits clamp remaining to zero.
`overLimit` and `outOfRangeBindings` explain different violations. The response
contains no other user, Forward ID or slot details and sets
`executionAuthorized:false`. Reading retained usage does not grant execution.

Forward history/diagnostics/aggregate reads are owner-aware. Withheld Scope loss
counters are null with explicit markers; missing measurements are not zero.
Probe support is specified separately in
[forward-probe-capabilities-v1](forward-probe-capabilities-v1.md).

## Migration And Acceptance

0039 explicitly leaves old Node claims and Forward/template/group owners
unclassified. 0040 adds nullable grant port limits. No migration derives owners
from grants, Scope ownership or the last execution actor. The reviewed successor
Control profiles do not change older ceilings or Agent profiles.

The [N ledger](../maintenance.md) maps
PR-01 through PR-14 and PA-01 through PA-12. Public Node authority5, Runtime
Relay7/resource2/exclusive2, Node module3/management2/usage1 and the caller-aware
read successors have migrated consumers exercised in the configured N Actions
scope. Old constructors and aliases must bind explicit policy/access providers.
The verification record binds interrupted MySQL migration, concurrent
grant/reservation, privacy and browser-flow results to their exact tested source;
independent hosts, release and operational readiness remain separate gates.
Bandwidth/byte accounting was subsequently confirmed by the human. FR-0032 adds
migration 0041 and explicit shared-resource Control/Agent profiles without
changing older ceilings. Its [payload specification](shared-resource-payload-limits-v1.md)
describes per-user/Node bidirectional payload, explicit periods, the original
Journal's conservative precharge and unavailable online balances. It is a
N successor whose port/payload cases have configured Actions evidence in that
record; this specification itself is not runtime evidence.

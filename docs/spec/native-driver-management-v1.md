# Native driver catalog and Profile impact v1

Date: 2026-10-17. Status: working-tree implementation; corresponding Actions pending.
Decision: [ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md).
The shared declarations are in
`packages/contracts/data/native-drivers-v1.json`; this is not an ADP message or
dynamic plugin manifest.

The follow-up [Profile publication](profile-publication-v1.md) consumes only explicit
current-page impacts, freezing at most ten per-rule proposals and independently
using the original fresh plan/CAS commands. It is not an atomic rollout or plan-issued
execution authority; its exact-SHA functional acceptance also remains pending.

## Native declarations

`GET /api/v1/scopes/:scope/native-drivers` accepts no query parameters. It requires
current Scope read membership, Bearer auth without cookies, maintenance permission,
and returns no-store JSON. The response includes version 1, catalog digest,
`source:declared-native-implementation`, `authorized:false`, `reserved:false`,
`nodeEvidence:not-included`, `platformAcceptance:not-inferred` and three descriptors.

Each descriptor includes its revision, assignment schema version/URN, platforms,
roles/phases, business protocols and physical carrier mapping, advertised and
required capabilities, Agent opt-in flags, Control gate, security, privilege and
limit assumptions, lifecycle and present Probe/usage support. The requested
business protocol additionally needs its matching `tcp`/`udp` Node capability.
Direct adds no transport encryption; native Relay and multihop use mutual TLS 1.3.
Relay UDP business still uses TCP transport/listener resources, not a second UDP
carrier reservation, at the inter-Node egress/transit listener. The user-facing
ingress still binds the selected business TCP/UDP protocol. `carrierByProtocol`
describes transport between nodes (or Direct's unencapsulated connection), not
every physical resource of a complete path. This does not change the port arbiter.

`controlEnabled` means only the process feature gate permits consideration. It is
not current Node capability/credential/permission evidence, readiness, network
reachability or reviewed production enablement. Declared Linux/Windows support is
not completed OS acceptance; native low-port binding obeys actual OS policy, and
independent clock proof still applies. These built-ins need no network-admin
privilege for ordinary unprivileged sockets. No shell/executable field is accepted.

Direct's opt-in Probe support means only the separately authorized zero-payload
TCP observation at the Agent's Direct egress. It is not a UDP/full-path Probe.
Relay/multihop independent Probe support remains unsupported in this catalog;
internal deployment checks do not change that label. Usage metrics are not yet
reported by any catalog entry, and cannot be inferred from resource reservations.

## Current Profile references

`GET /api/v1/scopes/:scope/transport-profiles/:profile/references`

Only these canonical, non-repeated parameters are accepted:

| Parameter | Meaning |
| --- | --- |
| `page` | Integer 1..10000, default 1 |
| `limit` | Integer 1..100, default 25 |
| `revision` | Optional exact currently referenced Profile config revision, 1..MAX_COUNTER |
| `targetRevision` | Optional exact proposed immutable revision, 1..MAX_COUNTER |

Unknown keys, duplicates, empty values, leading zeros, coercion and out-of-range
values reject 422 rather than broaden a query. Profile IDs compare byte-for-byte.
An invisible/missing Profile is 404. Plain listing needs current Scope membership,
not an execution grant. It returns total/page/items ordered by Forward ID and
includes disabled/recovery-suspended current desired rules, but excludes deleting
rules and other Scopes/Profiles. Query results are detached and immutable internally.

Each item includes forwardId, revision/expectedRevision, configRevision, spec,
recoverySuspended, proposedSpec and changed. Without a target, proposedSpec/changed
are null. Root metadata includes currentRevision, referenceRevision, target,
`source:persisted-control-state`, `previewOnly:true`, `reserved:false`,
`fullPlanAuthorization:false`, observedAt and the read-committed consistency label.
Page output is bounded, but JSON predicates/counts may scan the current Scope;
counts/items and subsequent requests can differ under concurrent edits.

This is NOT a historical reference inventory or deletion-safety proof: old leases,
Snapshots, quarantined holders and retired execution state are outside its scope.
No new Profile-delete operation is exposed.

## Explicit configuration impact

Supplying targetRevision additionally requires current Scope manager permission
and the original Transport owner's explicit Profile Grant for the caller. The
Owner is not exempt. The caller transaction resolves exactly that Profile/revision
and verifies its stored configuration digest; absent grant/revision returns 404.
The target is never an implicit latest-revision lookup. All pages reauthorize.

The response target includes revision and configDigest. Each proposedSpec keeps
the original complete intent and changes only transport.configRevision;
expectedRevision is the current Forward CAS value. changed is false if already
locked to that target. No new authority, resource reservation, Node Grant check,
full deployment preflight, Operation, lease, Forward write or publication occurs.

The Console's Profile rows offer references/impact, with separate query/preview
actions and bounded pages. Revising inputs, closing the dialog or disconnecting
invalidates/aborts old responses. Choosing Load Editor is explicit, single-use and
only populates the existing Relay form with a locked target revision and expected
Forward revision. The user must still rerun the original Relay plan check and
explicitly submit a CAS update, which rechecks all current Node/Profile Grants,
target policies, Endpoints, resources and feature gates. A failed or stale preview
never bypasses those original checks or causes automatic switching.

Publishing a new Profile revision never updates existing rules. Cross-rule batch
publication, template references, physical tunnel sharing and automatic routing
remain separate development work, not implied by this API.

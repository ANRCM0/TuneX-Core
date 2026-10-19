# Native Logical Tunnel Management v1

Status: implemented, unverified. Development does not run tests or static checks;
concentrated acceptance and fixes follow source freeze.
Decision: [ADR-0026](../decisions/0026-logical-tunnel-management.md).

## 1. Meaning and Ownership

A logical tunnel is a reusable, immutable native path configuration. Its ID is
the existing same-Scope PathTemplate ID, not another entity or a live connection
ID. `NativeTunnels<Tx>` is a business composition of existing public application
methods. It opens no transaction, performs no network I/O and owns no table.

The old and new API names share revisions, digests, archive state, quotas,
audit history, idempotency and binding history. Existing Node/Profile grants
and Scope roles remain authoritative. The query is not use authorization.

Existing paths still contain exactly 2..8 distinct ordered Nodes, business
TCP/UDP protocols, one exact Profile revision and the exact downstream Endpoint
revisions. There is no heterogeneous segment format or implicit latest alias.
Each bound Forward retains its independent runtime resources. Defining a tunnel
does not create sockets, leases, Operations, rules or a shared connection pool.

## 2. Definition API

```text
GET    /api/v1/scopes/{scope}/tunnels?page=1&limit=25&prefix=...
GET    /api/v1/scopes/{scope}/tunnels/{id}?revision={exactRevision}
PUT    /api/v1/scopes/{scope}/tunnels/{id}
DELETE /api/v1/scopes/{scope}/tunnels/{id}
GET    /api/v1/scopes/{scope}/tunnels/{id}/references
```

These delegate, respectively, to original template list/get/publish/archive
and path-reference use cases. Query names, closed input validation, limits,
authorization and errors are those of [PathTemplate v1](native-path-templates-v1.md)
and [path bindings](native-path-bindings-v1.md). Unknown/duplicate query parameters
reject. Mutations accept no query parameters, require `Idempotency-Key`, reject
unknown body fields and have an 8192-byte body limit.

Publish accepts exactly `{expectedRevision,config}`; creation uses CAS 0.
Archive accepts exactly `{expectedRevision}` with an existing revision.
Archival is permanent for that identifier, keeps history and does not stop or
rewrite previously expanded Forwards. All 128 identifiers per Scope, including
archived ones, and 64 revisions per identifier are shared with the old API.

Definition list/detail preserve all original fields. Each list item and detail
add `tunnelId`, exactly equal to `templateId`. The response-level `management`
object has this version-1 shape:

```json
{
  "version": 1,
  "kind": "native-logical-tunnel",
  "backingResource": "path-template",
  "configurationReuse": true,
  "physicalConnectionSharing": false,
  "allocationOwner": "forward-runtime",
  "health": "not-assessed"
}
```

Detail adds `topology` in configuration order. Each item contains `nodeId`, role
`ingress`/`transit`/`egress`, and `endpointRevision`. Only ingress has null
Endpoint revision. These are locked configuration references, not current Node
health, session state, route reachability or a reservation.

Mutation receipts are exactly the original `{templateId,revision,configDigest,
archived,changed}` and original 200/202 status. References return the original
bounded current-intent impact page unchanged; no extra query after acceptance
may turn a committed write into an apparent failure.

## 3. Forward Bindings

```text
GET  /api/v1/scopes/{scope}/forwards/{id}/tunnel-binding
POST /api/v1/scopes/{scope}/forwards/{id}/tunnel-preview
PUT  /api/v1/scopes/{scope}/forwards/{id}/tunnel-binding
```

GET accepts no parameters and returns the original current/history provenance.
POST/PUT accept exactly `{expectedRevision,template}`; `template` remains the
closed `{templateId,revision,configDigest}` selection. Body limit is 1024 bytes,
query parameters reject, and PUT requires the original idempotency key.

Preview delegates to the original non-reserving authorized proposal. PUT calls
the original `ForwardCommands.applyPath`, preserving authorization, replay
ordering, CAS, exact reference checks, Core decision, capacity, Operation and
binding acceptance in its one transaction. No separate prepare/write sequence
or second execution ledger is introduced. Receipts retain `pathBinding`.
An unchanged expansion may accept provenance without a new Operation.

Both names use the original `/path-templates/{id}` or
`/forwards/{id}/path-binding` request-digest path. Clients must preserve the
same body and key when replaying an uncertain result. Switching API names does
not bypass idempotency conflicts or create a fresh command. Publication of a
new tunnel revision never updates a Forward automatically. Binding keeps the
original ingress/business-protocol restrictions and possible interruption,
bounded TCP drain and UDP loss limitations.

## 4. Console and Status Separation

Tunnel Management reuses the existing authoring and explicit switch panels.
The selected definition shows the immutable ordered path and locked references.
Loading it into the rule-binding editor is an explicit local selection only;
current Forward CAS inspection, proposal and confirmed original acceptance
remain separate. Archived definitions can be inspected but not selected for a
new binding. A pending uncertain binding blocks replacing its target.

Definition edits, endpoint capture, dispatch and disconnect invalidate the
definition display. Reads use bounded requests with abort/epoch protection.
No pending write is replaced by an automatic refresh or a new idempotency key.
The original maximum-ten rule queue remains the batch mechanism and uses the
same canonical owners, not a bulk API or atomic multi-rule switch.

The existing [Node tunnel dialog](native-tunnel-management-v1.md) continues to
show persisted Endpoint/credential/session metadata separately. Neither view
proves network health or deletion safety. Deployment remains the original
per-rule Runtime/Agent status, not a property fabricated from this definition.

## 5. Deferred Verification

No tests, typecheck, lint, boundary checks, browser, MySQL or Actions run in this
development slice. Source/diff reading is not successful acceptance evidence.
At source freeze, add and run alias idempotency/equivalent authorization/CAS/
archive/quota vectors, topology bounds and Console selection/uncertainty/
disconnect/mobile scenarios alongside the final-SHA matrix. Existing release
gates and unavailable physical-host gates remain unchanged and unfulfilled.

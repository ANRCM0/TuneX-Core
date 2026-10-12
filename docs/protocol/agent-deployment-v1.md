# Agent Deployment Protocol v1 (ADP/1)

- **Status**: Accepted for implementation (normative design; current V2 Agent does not implement ADP/1)
- **Version**: `protocolVersion: 1`
- **Trust boundary**: Control ↔ Go Agent (control plane only)
- **Transport**: mutually authenticated HTTPS/JSON (TLS 1.3 preferred); no external Agent admin listener required
- **Source of truth**: MySQL-backed Control desired state; never Redis alone

## 1. Objectives / non-goals

ADP/1 transfers **complete desired node snapshots** and receives **observations**. Its core unit is an **Assignment**, not an HTTP action directly manipulating a Forward. All operations must be idempotent, recoverable, versioned, attributable to an authenticated Node identity, and fenced against stale execution.

No general remote shell, arbitrary executable hooks, untrusted dynamically loaded plugins, synchronous distributed transactions, or per-packet control-plane dependencies. This protocol does not carry user payload traffic.

## 2. Canonical nouns

| Term | Meaning |
| --- | --- |
| `Forward` | Core business intent; revision changes for user spec modifications |
| `Operation` | Durable API-side record of a requested change, recovery and outcome |
| `Deployment` | Runtime plan for an effective Forward version and topology |
| `Assignment` | One Node's desired execution slot for one Forward/protocol/role |
| `Snapshot` | Complete desired Assignment set for one Node, at one monotonically increasing generation |
| `Observation` | Agent-reported actual local state, annotated with version and fresh report sequence |
| `Lease` | Bounded authorization to continue executing a configuration while offline |
| `Fence` | Monotonically increasing ownership token for an actual binding/resource slot |
| `Tombstone` | Explicit durable denial of stale re-creation after removal/reassignment |

**Business state** (`enabled`), **deployment stage** (`preparing/activating/applied...`), and **runtime health** are distinct.

## 3. Control endpoints (proposed VNext; not existing routes)

All endpoints require authenticated Node identity, authorization to a single node scope, input size limits, anti-replay, rate limits and audit metadata. Client-supplied `nodeId` is always cross-checked against authenticated identity.

1. `POST /agent/v1/hello` — send `nodeId`, `bootId`, supported protocol range, Agent build, capability identifiers and last stored snapshot generation; return accepted version, session policy, allowed polling, clock/lease bounds. Reject incompatible Agents without assigning work.
2. `GET /agent/v1/snapshot?sinceGeneration=N` — get full, self-contained latest Snapshot for that Node; unchanged requests may yield `304` when last known snapshot is still valid. A 304 is **not** authorization to exceed a prior lease expiry. During a stale local lease, the Agent must obtain a renewed authenticated lease/snapshot before it resumes.
3. `POST /agent/v1/report` — report per-assignment prepare/apply/drain/error outcomes, last applied snapshot, fresh boot/report sequence and observed metrics. Server responds with durable acknowledgment of accepted report IDs/sequence. Retry the same report safely.

Long polling / SSE change hints MAY be added later, but **must not replace full Snapshot reconciliation**. HTTP responses on a healthy transport are not application ACK.

## 4. Identity, credentials and authorization

Control certificate validation is mandatory (trusted issuer/pinned identity with hostname checks); Agent authenticates with a node-scoped credential (mTLS identity by default). Enrollment/rotation/revocation belong to Node Management. Use least-privilege credentials, protect in memory/on disk, never send private keys or secret material in `Observation` or normal logs. A stolen or replayed snapshot must not bypass Node identity, lease, generation and fence verification.

Authorization is scoped to precisely one Node. A Node MUST NOT fetch another Node's assignments even if it supplies that node ID in a query. An Agent MUST reject unsigned/untrusted local cache data and response bodies from unauthenticated peers.

## 5. Snapshot envelope (canonical JSON fields)

```json
{
  "protocolVersion": 1,
  "nodeId": "node-hk",
  "snapshotGeneration": 114,
  "complete": true,
  "issuedAt": "2026-10-12T08:00:00Z",
  "validUntil": "2026-10-12T08:05:00Z",
  "assignments": [
    {
      "assignmentId": "asg-forward-1001-tcp-hk",
      "forwardId": "forward-1001",
      "forwardRevision": 5,
      "deploymentGeneration": 8,
      "bindingFence": 42,
      "role": "ingress",
      "protocol": "tcp",
      "phase": "active",
      "listener": {
        "address": "0.0.0.0",
        "port": 25565
      },
      "driver": {
        "id": "tst.v1",
        "schemaVersion": 1,
        "configRef": "runtime-config-123",
        "configDigest": "sha256:abcdef012345"
      }
    }
  ],
  "tombstones": []
}
```

This is a shape illustration; exact hash encodings and driver config-reference dereference rules require tests before shipping. `configRef` is a scoped, authenticated, immutable reference or secure configuration payload; it must be resolvable consistently for the corresponding deployment generation. The agent must not blindly fetch arbitrary URLs supplied in a snapshot. A production schema must explicitly define/validate such references.

### Envelope rules

- `protocolVersion` MUST equal a negotiated supported version. Unknown required fields/capabilities must fail closed with a stable error.
- `nodeId` MUST match authenticated Agent. `snapshotGeneration` increases monotonically **per Node**; allocate it transactionally in MySQL. It is not a global system counter.
- `complete=true` means the list is the **whole authoritative desired set for that Node**, never a page or delta. Truncated/incomplete responses **MUST NOT** trigger deletion. Snapshots must be integrity checked, size-bounded and parsed atomically.
- `issuedAt/validUntil` specify bounded execution authority. Clock drift, monotonic local duration and credential validity must be handled explicitly. Agents MUST NOT silently extend lease duration because the Control is offline.
- `assignments[]` contains **at most one assignment per logical execution slot**. The controller validates all conflicts and deterministic ordering before publishing a snapshot.
- `tombstones[]` carry the identity/fence/retirement generation of removed or reassigned slots, to guard against delayed commands and local restoration. A missing assignment in a valid complete snapshot is also a removal intent; tombstones preserve anti-resurrection guarantees across version races.
- Snapshot generation and local durable high-water/fencing state MUST be committed before acknowledging adoption; if durable persistence fails, do not mutate the running data plane based on an unrecoverable generation.

### Assignment shape

An Assignment is per **Node × Forward × protocol × role/slot**. For TCP+UDP, Runtime emits separate protocol-specific Assignments. Roles are `direct`, `ingress`, `relay`, `egress`; v1's minimum implemented roles are `direct`, then `ingress/egress` when the Native relay milestone lands.

- `assignmentId`: stable identifier of the logical assignment slot, non-reusable across deleted Forward IDs.
- `forwardId + forwardRevision`: audited business source.
- `deploymentGeneration`: version of effective deployment topology; may increase without changing business revision.
- `bindingFence`: monotonic resource ownership token, **associated with physical binding key** `(nodeId, protocol, port)`, and checked at final commit to bind/swap/release; not merely compared within a Forward.
- `phase`: `prepared`, `active`, `draining`; removed means absence plus tombstone. An Agent cannot activate solely because an Assignment exists in prepared phase.
- `listener`: valid only for direct/ingress roles; egress/relay receive driver-specific upstream/downstream configuration.
- `driver.id/schemaVersion`: explicitly supported static driver; `configDigest` identifies immutable resolved config. Unknown or missing mandatory driver config fails closed; secure requirements may never downgrade to cleartext.

Resource conflicts in a snapshot are a protocol error; the Agent must reject the conflicting assignments rather than making arbitrary "last one wins" decisions.

## 6. Observation report

```json
{
  "protocolVersion": 1,
  "nodeId": "node-hk",
  "bootId": "boot-7f70",
  "reportSequence": 18,
  "observedAt": "2026-10-12T08:00:10Z",
  "acceptedSnapshotGeneration": 114,
  "observations": [
    {
      "assignmentId": "asg-forward-1001-tcp-hk",
      "deploymentGeneration": 8,
      "bindingFence": 42,
      "phase": "active",
      "condition": "ready",
      "errorCode": null
    }
  ]
}
```

`bootId` changes on each process incarnation; `reportSequence` must strictly increase within that boot. Server deduplicates by authenticated node, bootId and sequence, rejects stale data overwriting fresher observations, records arrival time separately from untrusted source timestamp, and ages stale observations to `unknown`. An ACK about `applied/ready` **does not prove end-to-end target health**.

Recommended conditions: `pending`, `prepared`, `ready`, `degraded`, `error`, `draining`, `removed`; health comes from separate timestamped probes/measurements. Errors are typed with optional `retryable` and bounded backoff hint.

## 7. Identity/version/ownership dimensions

| Dimension | Scope | Purpose |
| --- | --- | --- |
| `forwardRevision` | Single Forward | CAS on user-intent changes |
| `deploymentGeneration` | Forward effective deployment | Routing/transport update generation |
| `snapshotGeneration` | Single Node | Reject out-of-order desired sets |
| `bindingFence` | Physical resource slot | Prevent expired executor from rebinding or freeing another owner's resource |
| `bootId + reportSequence` | Agent incarnation | Reject reordered/replayed observations |
| `validUntil` | Authorized snapshot lease | Bound offline continuation |

Agent must durably remember last adopted generation and resource fence high-water marks across crash/restart. Generation equality means idempotent reconcile, never duplicate listeners. Old ACKs/observations may be recorded for audit, but cannot advance deployment state for a newer generation.

A physical slot owner changes only under Runtime ownership/lease rules; stale goroutines and asynchronous shutdown callbacks must check the current fence **at the point of resource mutation**. The fact that an old listener's socket descriptor remains alive while draining must not grant it authority to bind or release the successor's slot.

## 8. Agent apply algorithm

1. Authenticate response and peer; confirm target Node, negotiated version, `complete` and lease.
2. Validate entire snapshot shape, driver availability, assignment uniqueness, local binding/resource compatibility and required config digests.
3. Compare against durable snapshot generation/fence high-water state. Reject older; accept equal as idempotent; new ones must be safely durably staged.
4. Produce local diff against observed running assignments; prepare independent resources without externally advertising new ingress readiness.
5. Honor per-assignment `phase`. Establish required downstream resources before activating ingress. At activation, verify capability/lease/fence and perform actual bind/swap.
6. Stop new accepts during drain, preserve or close existing connections under explicit TCP/UDP drain policy, then release resources only if this generation still owns the slot.
7. Persist operation result and emit Observation with exact deployment generation. Reconcile periodically even without new Snapshot.

The apply algorithm MUST be crash-safe. Partial failure must be observable and recoverable; no attempt to pretend atomic distribution across hosts.

## 9. Multi-node ordering and cleanup

Runtime prepares **egress/relay dependencies first**, then ingress; activates ingress only when its required downstream dependencies reported **prepared** at the intended generation. For a chain, prepare from tail to head. A new route SHOULD use make-before-break when supported; TCP existing streams MAY continue on old path while new TCP streams use the new. UDP session continuity is not universally guaranteed and must be documented.

On delete: persist intent + tombstone, publish new snapshots, stop new ingress, drain or stop, receive report or apply bounded expiry policy, then safely release reservations. Offline Agent old snapshots must not survive the maximum authorization lifetime. Absence in a valid complete snapshot must ultimately remove unexpected active assignments.

## 10. Retries, failures and authority

- Worker and API crashes: MySQL Operation ledger + scan for uncompleted work; Redis notification is best effort.
- Duplicate Snapshot/report: idempotent.
- Network timeout: retry with bounded exponential backoff/jitter; API accepted != applied.
- No Agent contact: desired remains pending, never silently mark healthy.
- Offline execution: permitted only within valid credential and snapshot lease; revocation while offline is bounded by the lease limit, **not immediate**.
- Time uncertainty/credential expiry: fail closed under configured policy, report when possible.
- Invalid config/unsupported driver/port in use/fence conflict: report typed permanent or conditionally retryable failure; do not silently weaken requested security.

### Stable error codes (initial registry)

`INVALID_CONFIG`; `UNSUPPORTED_CAPABILITY`; `UNSUPPORTED_PROTOCOL_VERSION`; `AUTHORIZATION_DENIED`; `PORT_IN_USE`; `STALE_GENERATION`; `FENCING_REJECTED`; `LEASE_EXPIRED`; `TRANSPORT_UNAVAILABLE`; `DEPENDENCY_NOT_READY`; `RESOURCE_CONFLICT`; `INTEGRITY_FAILURE`; `INTERNAL_ERROR`.

Unknown error codes are **not success** and should be preserved verbatim for diagnostics while mapped to safe generic failure.

## 11. Compatible evolution from ADP/1 onward

The current V2 protocol is **not compatible** with ADP/1. Future ADP/1 minor compatible additions can only add explicitly optional fields/recognized capability values without changing default security meaning. Incompatible shape, fencing, lease or snapshot semantics require ADP/2 plus an ADR and capability negotiation. A newer Control must not send a snapshot an Agent cannot interpret, and an older Agent must reject unsupported critical fields, not guess.

## 12. Verification gates

See [Acceptance Matrix](../testing/acceptance-v1.md). Required: complete snapshot deletion safety, duplicate/out-of-order delivery, crashed Writer/Worker/Agent, durable high-water, port reclaim fencing, withheld downstream, repeated restarts, TCP/UDP real traffic, secure transport no-downgrade, malformed/foreign-node/expired snapshot rejection, stale Observation suppression.


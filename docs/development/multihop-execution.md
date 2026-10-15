# Multi-hop implementation and deferred acceptance

Date: 2026-10-16. Baseline: `904c5aa1907948b3859652c80575268c796c4895`.

The implementation follows the six-batch development sequence. Local runtime,
container, isolated-network and physical-host tests were deliberately deferred
at the user's request. Compilation and static checks are recorded separately in
the [delivery ledger](multihop-delivery.md); no network success is claimed.

## Implementation map

| Batch | Main implementation |
| --- | --- |
| Shared authority | Runtime journal migration, shared protocol/port fences, immutable instances, old-session quarantine, existing protected Authority and durable execution leases |
| Actual commands | Explicit complete execution extension, mixed Direct/Relay/multi-hop Snapshot, strict TS/Go schema and shared positive/negative vectors |
| Agent execution | Opt-in production Runner, role adapter, distinct mTLS handshake, recursive probes, bounded frame bridging and existing drain/UDP machinery |
| Coordination | MySQL path and preparation/activation cursors, actual Report-driven progress, ingress-priority withdrawal, historical-Node scans and safe cleanup |
| Acceptance tools | Three/four/eight independent Agents, held reports, exact TCP/UDP flow, renewal, restart, grants, replay, offline cleanup, namespace partition/delay/loss and physical-host collection |
| Console/release | Ordered optional transit nodes, editing, per-Node progress/errors/leases/isolation, revision restore, production evidence gate and deployment override |

The production path uses `native.multihop.v1`; offline Transit v1 remains
non-executable by the production Runner. See
[ADR-0005](../decisions/0005-mixed-multihop-execution.md) for the adapter and
migration decision.

## Development enablement

Keep existing Node identity, credentials, journal and journal key. Do not
re-enroll or initialize empty state as an upgrade or rollback technique.

1. Back up the protected state using the existing recovery procedure. A saved
   old journal is evidence, not permission to erase newer high-water.
2. Run the new Agent with `--relay --multihop`. This migrates the existing Runtime
   journal in place. Optional `--import-transit-journal /absolute/offline.json`
   imports same-Node/same-key offline Transit history once as retired fences.
   Do not run an old offline writer against the imported source afterward.
3. Start a development Control with `TUNEX_MULTIHOP_EXECUTION=1`, or use the
   acceptance harness's explicit `multihopEnabled` server option.
4. Grant every path Node and immutable Transport Profile to the acting user.
   Configure an internal endpoint on every Node after ingress. TCP and UDP
   business protocols require distinct internal TCP ports.
5. Use Console path selection and preview. Preview neither reserves ports nor
   grants execution. Observe the accepted Operation and all path participants.

The new journal marker is intentionally incompatible with old binaries and
with starting the new Runner without `--multihop`. To stop multi-hop, disable
the Forward or Control feature while retaining the new aware Agent. Wait for
retirement/lease safety; do not remove the marker or restore stale files.

## Execution failures and retry

A fresh error report for the current published Snapshot is checked against the
latest deployment's Node, session, assignment, generation, Fence and config
digest. A report from a previous deployment cannot fail its successor.

Retryable downstream errors keep the same deployment available for recovery.
A terminal error withdraws the path and fails the current attempt. If that
attempt already succeeded, Control records a new failed `policy` Operation
linked through `sourceOperationId`; the earlier success remains in history.
The error includes the failing Node, session and exact execution instance.

After a terminal failure, inspect the reported cause and use the normal failed
Operation retry action. Retry creates fresh execution authorization and a new
deployment generation and physical Fences. Control checks the complete eventual
Snapshot size on every path Node, including historical tombstones, inside the
acceptance transaction. A capacity rejection rolls back the attempted plan,
Operation and Fence changes together.

Withdrawal stops renewal for the entire path and prioritizes ingress publication.
An unrelated queued command on ingress cannot keep a failed path in its published
Snapshot. Polling and removal remain asynchronous; slots stay reserved until
execution reports or bounded historical lease expiry establish safe cleanup.

The deployment view reports `renewalAllowed` independently from each Node's
`reportFresh` execution evidence. Revocation clears readiness immediately while
retaining fresh reports and the already-issued Snapshot cutoff for diagnosis.
An old `ready` observation does not prove continuing Control authorization.
The latest Operation and linked failure details remain visible after withdrawal.

## Unified acceptance commands, to run later

Prepare the pinned Node/Go versions, disposable MySQL 8.4, OpenSSL, Linux or the
configured WSL distribution, actual OS time synchronization, and built Linux
Agent/time-proof/network-fixture binaries. Existing setup details are in
[getting started](getting-started.md) and [Relay isolation](relay-network-isolation.md).
On WSL, set the inspected `TUNEX_WSL_HOST` and `TUNEX_WSL_DISTRO`; do not invent
an address or use a production database.

```bash
npm run check
node scripts/run-go.mjs vet ./...
node scripts/run-go.mjs test -race ./...
node --test apps/control/test/multihop-runtime.test.ts
npm run test:phase1
npm run test:relay-isolation
npm run test:multihop-all
npm run test:multihop-isolation
```

`TUNEX_TEST_DATABASE_URL` points to disposable MySQL. Each multi-hop run creates
and removes a unique database. The isolation suite also needs iproute2 (`ip`,
`ss`, `tc`), iptables, and permission to create its own network namespaces.
It changes only its owned namespaces, links, scoped rules and qdiscs.

The CI matrix is prepared for 3, 4 and 8 Nodes. It builds the actual binaries and
runs both independent-process and isolated-network scenarios. Existing workflows
run automatically when source is pushed to main; only their exact-SHA results
can establish CI evidence.

Evidence lives under `.artifacts/multihop/`. It records exact SHA, dirty-tree
status, tracked patch digest, binary hashes, protocol results, deployment
history, resource samples and cleanup status. Private key and enrollment files
are not uploaded by CI. A failure or incomplete cleanup cannot produce a
passing release artifact.

Same-host processes and network namespaces do not count as physical hosts.

## Physical-host collection, when inventory exists

Prepare an existing enabled multi-hop Forward and exact echo target. Configure
known SSH host keys and BatchMode-capable SSH aliases. The collector does not
deploy software, enroll Nodes, restart services or inject disruptive faults.
It reads reviewed host identity, binary hashes, protected journal identity and
fresh local diagnostics, then runs the checked network-fixture probe on ingress.
The SSH account needs read access to those files; no password or private key is
placed in the inventory.

The JSON inventory passed to `npm run test:multihop-physical -- inventory.json`
has the following shape. Replace every placeholder; relative local paths are
resolved against the current working directory.

```json
{
  "version": 1,
  "physicalInventoryReviewed": true,
  "sourceRevision": "<40-character-tested-commit>",
  "controlURL": "https://control.example:41001",
  "ca": "/secure/control-ca.pem",
  "tokenEnvironment": "TUNEX_ACCEPTANCE_TOKEN",
  "scopeId": "<scope>",
  "forwardId": "<existing-forward>",
  "images": {"control": "<image@sha256:digest>", "agent": "<image@sha256:digest>"},
  "agentSHA256": "<checked-linux-binary-sha256>",
  "fixtureSHA256": "<checked-fixture-sha256>",
  "fixture": "/opt/tunex/network-fixture",
  "hosts": [
    {
      "nodeId": "<ingress-node>",
      "sshAlias": "tunex-ingress",
      "machineIdSHA256": "<sha256-of-trimmed-machine-id>",
      "agentBinary": "/opt/tunex/tunex-agent",
      "journal": "/var/lib/tunex-agent/journal.json",
      "diagnostics": "/var/lib/tunex-agent/diagnostics/status.json"
    }
  ]
}
```

Include three to eight hosts in exact path order, with at least three reviewed
distinct physical machines. Distinct machine IDs supplement the operator's
physical inventory; they cannot prove that separate VMs are physical servers.
The collector verifies current Control readiness before and after real TCP/UDP
traffic, and records this limit explicitly. Broader physical fault and soak
acceptance remains an operator-controlled exercise.

## Production enablement and release

Base Compose templates default to disabled. In `NODE_ENV=production`, setting
`TUNEX_MULTIHOP_EXECUTION=1` requires:

- `TUNEX_SOURCE_REVISION`: the actual 40-character built revision, baked into the
  Control image from `TUNEX_SOURCE_REVISION` build argument.
- `TUNEX_MULTIHOP_RELEASE_EVIDENCE`: a reviewed, read-only manifest bundle.
- All gates in `MULTIHOP_RELEASE_GATES`, with passed clean-tree reports for that
  exact revision and SHA-256 hashes of the referenced artifact files.
- Matching immutable Control/Agent image digests in container/publication reports.
- Actual physical-host traffic and the three existing P0 operational gates.

The manifest structure is:

```json
{
  "version": 1,
  "sourceRevision": "<40-character-tested-commit>",
  "images": {"control": "<image@sha256:digest>", "agent": "<image@sha256:digest>"},
  "gates": [
    {"name": "contracts", "artifact": "contracts.json", "sha256": "<artifact-sha256>"}
  ]
}
```

Every required gate must be present exactly once. The example is deliberately
incomplete and cannot enable production. Generic reports have `passed: true`,
`commit` and `workingTreeDirty: false`; multi-hop reports additionally need
the relevant actual traffic, node-count, cleanup or physical-host evidence.
Artifact paths must stay inside the bundle, including after symlink resolution.

```bash
npm run release:multihop-check -- /secure/release/manifest.json <tested-commit>
```

After approval, apply
[the Control override](../../deploy/compose.multihop-control.override.example.yaml)
to the matching base Control template and set `TUNEX_MULTIHOP_AGENT=true` on
participating Agent hosts. The verifier checks reviewed evidence integrity; it
does not sign artifacts or independently rerun tests.

The existing P0 items remain release prerequisites:
1Panel deployment reliability, two-physical-host Relay acceptance, and long-run
stability with backup/recovery. Multi-hop implementation does not replace them.

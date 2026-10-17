# Native TLS Tunnel Management v1

Status: Implemented and statically checked; exact-commit functional/MySQL/browser
acceptance remains pending in Actions. Decision: [ADR-0021](../decisions/0021-native-tunnel-read-model.md).

## 1. Read Ownership and Authorization

`TunnelQueries<Tx>` uses the existing `TransactionBoundary` and `ScopeAuthorization`.
Scope membership precedes exact Node-in-Scope validation; the same supplied
transaction then feeds `TunnelReadPort`. A missing/foreign Node returns 404 before
Endpoint/peer/reference reads. Scope readers can inspect this metadata without a
Node use grant; no use permission or management rights are created by reading.
`MySqlTunnelReader` is SELECT-only, opens no connection and performs no network I/O.
Persisted invalid metadata fails closed, rather than fabricating readiness.

No database migration, Core selector, Agent command/contract, protected Journal,
credential issuance path, execution authority or Runtime ledger is added.

## 2. Bounded Persisted Status

```text
GET /api/v1/scopes/{scope}/nodes/{node}/tunnel
```

No query parameters are accepted. The response includes:

- `source:persisted-control-state`, query `observedAt`, `health:unknown`,
  `executionAuthorized:false`, `reserved:false`, `networkCheck:not-performed`,
  `certificateVerification:not-performed-by-this-query`.
- Node revocation, machine credential deadline, recorded-machine-window boolean,
  reported capabilities, persisted session/snapshot counters and report receipt time.
  Neither capabilities nor receipt age prove an active current Agent or TLS session.
- Endpoint `{revision,config}` or null. Config is the original normalized listener,
  advertised host and at most 256 unique TCP ports, not verified reachability.
- Peer metadata count and at most four items, selected open peer windows first,
  then recent issue time/fingerprint. Each item contains only SHA-256 fingerprint,
  issued/expiry/retirement times, revoked, effective deadline and recorded-window
  boolean. Effective deadline is clipped by machine expiry; revoked/expired/absent
  machine credentials close all recorded windows. More than two recorded open peer
  windows is an integrity failure, not an expanded allowance.

No PEM/certificate, private key, enrollment token/response, raw Agent Report,
issuance response, authorization claim or arbitrary serialized database row is
returned. Reading does not issue/rotate/revoke credentials, attempt handshakes,
resolve DNS or send a Probe. `observedAt` is query time, not handshake evidence.

`read-committed-metadata-not-global-snapshot` deliberately describes the existing
transaction isolation. Counts and bounded rows can differ under concurrent changes;
there is no consistent-snapshot or constant-cost claim. Peer counts scan retained
records using the existing Node index; row output is bounded independently.

## 3. Desired References and Adjacency

```text
GET /api/v1/scopes/{scope}/nodes/{node}/tunnel/references?page=1&limit=25
```

Only canonical `page` (1..10000) and `limit` (1..100, default 25) are accepted;
unknown/duplicate parameters and noncanonical/injected values reject. The query
detaches/validates paging before awaiting authorization. MySQL LIMIT/OFFSET uses
the existing bounded-integer literal helper, not mysql2 DOUBLE number bindings.
All Scope/Node values remain bound parameters; JSON Node matching is exact-case.

The same-Scope current, nondeleting Relay/multihop intent set includes disabled and
recovery-suspended rules and excludes Direct. Rows carry Forward ID/revision,
enabled/suspended, business protocols, immutable Profile ID/revision, ordered Node
path, role, previous/next Node and whether this role needs an Endpoint. Target host,
complete spec, deployment plan and lease contents are omitted.

All pages mark `previewOnly:true`, `reserved:false`, `executionAuthorized:false`,
`historicalReferencesIncluded:false`, `deletionSafety:not-proven`, and
`read-committed-page-not-global-snapshot`. Scope/JSON count scans use existing
indexes and are not constant-cost. These pages cannot prove a Node, Endpoint or
Profile safe to delete or resources available; historical authorizations remain
owned by the original Runtime retirement ledger.

## 4. Console and Original Write Flows

Node rows and the existing Endpoint view open one read-only dialog with bounded
status/reference pages, explicit refresh and the original deployment-view action.
Closing, selecting another Node or disconnecting aborts requests and invalidates
detached actions. Unknown/failed/corrupt reads clear prior output; credentials are
not persisted or automatically requested. Desktop and narrow layouts retain
in-dialog scrolling instead of expanding the page.

The existing Profile impact dialog adds Inspect Exact Revision, issuing
`GET transport-profiles/{id}?revision={explicitRevision}` and discarding stale
inspection responses when inputs/connection change. Publishing a new Profile
does not update existing rules. Impact Load Editor retains selected revision and
Forward CAS; original Relay plan verification remains mandatory before update.
Late plan/deployment responses cannot recreate actions after invalidation.

Relay copy remains the [original disabled-copy proposal](native-rule-management-v1.md),
with blank required listener port, ordered path and locked Profile revision.
No new mutation endpoint, atomic rollout, automatic rollback or shared physical
tunnel is implied. The follow-up [explicit Profile publication](profile-publication-v1.md)
adds a bounded current-impact-page command queue, still pending exact-SHA Actions.

## 5. Authored Acceptance, Not Executed Evidence

- Seven application-port tests cover authorization ordering, bounded metadata,
  expiry/revocation, all roles, corruption and canonical detached paging.
- A real MySQL/API test uses a SELECT-only account, prepared queries, eight peer
  records, two open windows, >25 references, foreign/deleting/Direct/case-mismatch
  exclusions, all roles, disabled/suspended intent, HTTP injection rejection and
  full-table hashes before/after reads. A separate writer sets revocation to verify
  closed metadata, then another before/after hash checks those reads.
- Seven tunnel-controller tests and four Profile/plan/deployment regressions,
  plus asset/CSP/anonymous-route checks, are connected to the existing test suites.
- With `TUNEX_TUNNEL_BROWSER=1`, `test:relay` calls the Actions/Linux-only Chromium
  helper against real HTTPS Control/MySQL and two native Relay Agents. It reads
  metadata/deployment, inspects r1 after publishing r2, previews a real reference,
  loads the original editor, checks a fresh plan, CAS-updates and verifies actual
  TCP/UDP. It then creates a disabled copy on another port, explicitly enables it,
  verifies both protocols and deletes/waits for cleanup. No hidden command replay.

The dedicated `probe-workflow` job builds the existing native fixtures and runs
both browser flows; other Relay jobs do not opt in. The trust exception is confined
to the disposable one-day CA browser context. Upload allows only evidence.json
and `console-tunnel-*.png`, not PKI, state, traces, HAR or broad failure bundles.
No local functional/MySQL/network/container/browser tests were run. Exact-SHA
Actions, real multihop-copy browser flow, long-run rotation and physical-host
evidence remain absent; this contract is not B1/P1 or production-readiness closure.

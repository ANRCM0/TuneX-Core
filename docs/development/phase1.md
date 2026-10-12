# Phase 1 TCP Slice

This stage implements direct TCP creation from an authenticated HTTPS request to
an independent Go Agent, a real listener and a target. It is an internal milestone.
Update, disable, delete, retry, UDP, Relay and production release gates are not
provided by this stage. Unsupported requests are rejected instead of translated
to V2 or accepted as unimplemented work.

## Components

- `ControlApplication`: coordinates Identity, Nodes, Forwarding, Runtime and
  Idempotency commands inside one MySQL transaction.
- `MySqlUnitOfWork`: MySQL 8.4, READ COMMITTED, bounded deadlock retry and fresh
  database migration. Forward history, exclusive slots, Operation and replay
  response commit together. Redis is not required.
- `RuntimeLedger`: exclusive reservations and retained fence counters,
  whole-node prospective snapshot capacity, pending scanner and expiring claim.
- `RuntimeController`: current Node sessions, immutable full snapshots,
  renewal, report/ACK deduplication, fresh observations and Operation completion.
- `Nodes`: one-use 10-minute enrollment token, ECDSA P-256 CSR verification and
  24-hour client certificate; retries with the same CSR reuse the certificate.
- `tunex-agent`: online Hello before execution, MAC-protected journal persisted
  before bind, direct TCP half-close, destination CIDR enforcement after DNS,
  bounded concurrency, ACK retry and authorization/certificate deadline guard.

Node certificate fingerprints are checked against the enrolled database identity.
Only TLS-authorized client sockets may access machine routes. Enrollment/API use
server-authenticated TLS and separate owner bearer credentials; cookies and client
identity headers do not authorize a machine. Neither Agent client follows redirects.

## Run Control

Use a fresh database. Configure an ECDSA CA and a TLS server certificate with the
correct host/IP SAN. The CA key must remain private to Control. OpenSSL is required
for CSR verification/signing.

```sh
export DATABASE_URL='mysql://dev-user:dev-password@127.0.0.1:3306/tunex_vnext'
export TUNEX_CA_CERT=/secure/control/ca.pem
export TUNEX_CA_KEY=/secure/control/ca.key
export TUNEX_SERVER_CERT=/secure/control/server.pem
export TUNEX_SERVER_KEY=/secure/control/server.key
export TUNEX_CONTROL_STATE=/secure/control/state
export TUNEX_OWNER_TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
npm run control:bootstrap -- scope-dev owner-dev
npm run control
```

The default endpoint is `https://127.0.0.1:41001`. `TUNEX_CONTROL_HOST` and
`TUNEX_CONTROL_PORT` override the bind. `TUNEX_OPENSSL` may point to OpenSSL.

## Create a Node and Forward

Node input is JSON with `allowedListenerAddresses`, `allowedPorts`,
`egressPolicyRevision`, `allowedDestinationCidrs` and `allowMetadataTargets`.
CIDRs must be explicit network addresses; metadata targets default to denied.

```sh
export TUNEX_CONTROL_URL=https://127.0.0.1:41001
npm run control:cli -- node scope-dev node-policy.json
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
export TUNEX_ENROLLMENT_TOKEN='<token returned by node creation>'
.artifacts/tunex-agent --enroll --control "$TUNEX_CONTROL_URL" --node "$NODE_ID" \
  --ca "$TUNEX_CA_CERT" --state /secure/agent/state \
  --journal-key /secure/agent/secrets/journal.key
.artifacts/tunex-agent --control "$TUNEX_CONTROL_URL" --node "$NODE_ID" \
  --ca "$TUNEX_CA_CERT" --state /secure/agent/state \
  --journal-key /secure/agent/secrets/journal.key
npm run control:cli -- create scope-dev forward.json stable-request-key
npm run control:cli -- get scope-dev "$FORWARD_ID"
npm run control:cli -- operation scope-dev "$OPERATION_ID"
```

Forward JSON is Core v1 intent with enabled=true, protocols=["tcp"], ingress and
target. Reuse the same request key and input when a create response is lost.
Returned `202` means durable acceptance; query Operation and desired/applied/health.

The Agent journal key must be outside the state directory and readable only by the
Agent account. An OS advisory lock enforces one CLI Agent per state directory on
Linux and Windows, and is released automatically after process exit. It cannot
prevent stolen Node credentials being used on another machine.
Enrollment is not a recovery bypass: corrupt state requires Node
retirement, not resetting counters.

## Verification

```sh
npm run check
node scripts/run-go.mjs vet ./...
mkdir -p .artifacts
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
export TUNEX_TEST_DATABASE_URL='mysql://test-admin:test-password@127.0.0.1:3306/tunex_phase1'
npm run test:phase1
```

Windows uses `npm.cmd` and `.artifacts/tunex-agent.exe`. The harness creates a
unique disposable database, trusted test PKI, independent Agent/target processes,
and closes them after testing. Evidence is under ignored
`.artifacts/phase1/run-*/evidence.json`, with commit, binary SHA, schema/version,
platform/kernel/database and named outcomes. Keys and tokens are excluded.

Acceptance covers enrollment retry, durable create replay, first-write concurrency,
port conflict, post-intent rollback, Worker claim recovery/current-state reads,
deadline termination, foreign identity rejection, exact payload/half-close,
ACK replay/integrity, session retirement, expired-report health and snapshot bytes.
GitHub Actions runs the same harness on Linux/MySQL. Linux real-node/release gates,
full security audit and Phase 2 lifecycle tests remain outstanding.

# System synchronization evidence and Linux Agent acceptance

This slice adds the OS synchronization check required by ADP/2. Comparing Hello
time to the local clock remains a separate skew check, not synchronization proof.

## Providers

The Linux Agent reads `adjtimex` with modes=0. It accepts only synchronized kernel
states, rejects UNSYNC/CLOCKERR and requires nonnegative bounded maximum/estimated
error. This is a read-only syscall; it does not adjust clock parameters or time.

Windows uses the documented verbose `w32tm /query /status` output. The parser
does not depend on translated field labels. It requires the exact known layout,
valid leap/stratum/state, a successful last-sync result and a non-local reference.
The error budget includes half root delay, root dispersion, absolute phase offset,
and a conservative 500-ppm holdover since the last successful synchronization.
The recently observed OS status itself also accrues holdover uncertainty.

Unknown, truncated, failed or stale status is not successful synchronization.
The current development Windows host reports stale successful-sync data and a
failed result; the new check correctly returns `CLOCK_UNCERTAIN`. Its running
W32Time service alone is not treated as proof. A request to its existing provider
for resynchronization was denied by Windows access control; configuration was not
changed and the check was not weakened to make local positive tests pass.

## Optional protected supervisor proof

An Agent account that cannot query the OS time service can use a trusted supervisor:

```sh
node scripts/run-go.mjs build -o ../.artifacts/time-proof ./cmd/time-proof
.artifacts/time-proof --check
.artifacts/time-proof --watch --out /secure/time-status/proof.json \
  --key /secure/time-secrets/proof.key
.artifacts/tunex-agent --control "$TUNEX_CONTROL_URL" --node "$NODE_ID" \
  --ca "$TUNEX_CA_CERT" --state /secure/agent/state \
  --journal-key /secure/agent/secrets/journal.key \
  --time-proof /secure/time-status/proof.json --time-proof-key /secure/time-secrets/proof.key
```

Windows uses `.exe` and may require the supervisor account to have read permission
for the time-service RPC. The collector is query-only, writes atomic status every
five seconds, and never signs an arbitrary user-supplied ?synchronized? flag.
Provider failure is published as an unusable status instead of preserving a stale
success indefinitely. The MAC key is generated once and kept outside the writable
status and Agent state directories. Configure actual account ACLs/permissions.

Proofs have a 30-second maximum age and an OS error bound within the policy skew.
Agent rechecks their short cache, host identity and OS provider, so proof from a
different host/platform cannot authorize execution. Duplicate fields, malformed
payload, wrong MAC, missing key, over-size input and expiry fail closed. An expired
proof/failed provider latches the existing process guard closed.

The integration suites accept `TUNEX_TIME_PROOF` and `TUNEX_TIME_PROOF_KEY` only as
paths to this real collector's proof. They do not synthesize valid OS status. On
Linux the default remains the direct kernel provider. Internal unit clock injection
is not exposed as a command flag or production configuration.

## Native Linux topology

`npm run test:linux-agent` runs real Linux Agent, TCP/UDP target and client processes
in the existing WSL environment, with Node 24.14.1/MySQL 8.4.9 Control on the Windows
host's inspected private WSL interface. Linux state/key files live in a unique
native `/tmp/tunex-linux-*` directory so persistence/fsync uses the native filesystem.
It does not use the unrelated WSL MariaDB or existing Redis services.

```sh
export TUNEX_TEST_DATABASE_URL='mysql://test-admin:test-password@127.0.0.1:43307/tunex_phase1'
export TUNEX_WSL_DISTRO=TXBoard-Baseline
export TUNEX_WSL_HOST='<inspected private WSL host interface>'
npm run test:linux-agent
```

Before running, build Linux/amd64 `tunex-agent`, `network-fixture` and `time-proof`
into `.artifacts/*-linux` with Go 1.26.3. This fixture is a developer acceptance
binary, not a driver, remote shell or release Agent extension. Each run creates a
fresh database/PKI and stops only its uniquely identified native processes.

The suite verifies actual kernel synchronization, mTLS enrollment, persistent
MySQL acceptance/ACK, exact TCP/UDP payload, Control-loss hard cutoff of held TCP
and active UDP, no cached listeners after offline restart, higher-generation online
recovery, disable and tombstoned deletion. It uses the validated 18-second test
policy without relaxing the 5-second skew or clock-source check.

Evidence is under ignored `.artifacts/linux-agent/run-*/evidence.json` and records
the synchronization status, kernel, binary hash, commit/dirty state, generations,
policy and explicit mixed-platform topology. This closes Linux Agent/data-plane
evidence gaps, not the entirely Linux Control/MySQL stack or namespace/release gates.
Docker Hub/cached-image access remains unavailable locally, so that distinction
must be preserved. Native Linux Go race tests and CI remain additional checks.

Remaining work includes grant management, full capacity/recovery matrix, Relay
contracts and implementation, product Web, deployment/SBOM/licenses and release
rehearsal. The overall project goal remains active.

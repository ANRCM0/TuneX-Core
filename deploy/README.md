# TuneX VNext container foundation

Status: **development packaging prototype**, not production-certified or two-host validated. VNext uses ADP/3; do not deploy legacy/v2 container images into this topology.

## Build images from the repository root

```sh
docker build -f deploy/Dockerfile.control -t tunex-control:dev .
docker build -f deploy/Dockerfile.agent -t tunex-agent:dev .
```

The Control container uses Node.js 24 to execute the checked-in TypeScript entrypoint. The Agent is built with the Go toolchain in `agent/go.mod`. Both use UID/GID 10001 and never auto-enroll nodes or auto-initialize Control trust.

## Required preparation

1. Provision **external** MySQL 8.4, schema and Control database user. The disposable `compose.dev.yaml` MySQL service is not a production database.
2. Supply existing Control CA, signing key, server certificate/private key, and the original protected persistent authority state. Mount as files accessible to UID 10001 (not world-readable).
3. Do not use `TUNEX_AUTHORITY_INITIALIZE=1` on an existing authority, and **never** delete the state folder/journal to make startup pass.
4. On each Agent host, use an already **enrolled** Node; put `journal.key` in a separately protected directory outside the Agent state folder. Never commit enrollment token, certificates or journal keys.
5. A native Agent runs with host networking because it owns real TCP/UDP listening ports; check host firewall and ensure an older Agent instance is stopped before replacing it. A Control-only host should run only the Control service.
6. Control publishes port 41001 to host loopback only. Supply a validated HTTPS reverse proxy or configure a deliberate and firewall-restricted trusted endpoint before starting remote Agents. `TUNEX_CONTROL_URL` must match the trusted Control certificate name.

## Inspect before running

```sh
# Set variables via a protected environment file; do not commit that file.
# TUNEX_CONTROL_IMAGE, TUNEX_DATABASE_URL, TUNEX_CONTROL_STATE_DIR,
# TUNEX_CONTROL_PKI_DIR (and, separately on Agent hosts:
# TUNEX_AGENT_IMAGE, TUNEX_CONTROL_URL, TUNEX_NODE_ID,
# TUNEX_AGENT_STATE_DIR, TUNEX_AGENT_SECRETS_DIR).
docker compose -f deploy/compose.runtime.example.yaml config
# Only after prerequisites and a recorded rollback plan:
docker compose -f deploy/compose.runtime.example.yaml up -d control
# Only on the intended Agent host:
docker compose -f deploy/compose.runtime.example.yaml --profile agent up -d agent
```

Use immutable image tags/digests in deployments; a local `:dev` image is for isolated acceptance only. No automatic schema downgrade is provided.

## Security and recovery

Both services drop Linux capabilities and set `no-new-privileges`. Protect CA private keys, Agent journal MAC keys, persisted identities, and MySQL backup credentials using OS ownership (container UID 10001). Do not mount host Docker sockets or run the Agent privileged.

Rollback is **not** volume deletion or re-enrollment. Snapshot state, fencing history, protected journals, authority and database versions are all security-sensitive. Record image digest, schema version, state backup and a verified recovery procedure before attempting an upgrade. Keep one owner per Agent state and set of native listening ports.

## Third slice: provenance, inventory and pre-deployment checks

Build image labels include the exact source commit SHA when passed as `--build-arg TUNEX_SOURCE_REVISION="$(git rev-parse HEAD)"`. **A label is traceability, not a cryptographic signature or supply-chain attestation.** The packaging CI verifies both image labels and produces separate SPDX SBOM artifacts. Automated Trivy scanning is **not yet enabled**: the referenced Action release tags were not resolvable on this CI runner, so the unverified steps were removed rather than silently treated as passed. A green build does not certify zero vulnerabilities; independently scan both pinned images and review the findings before release.

Before using 1Panel with previously provisioned directories, export immutable *registry* references for both images and the four absolute, already-existing protected directories. Then execute:

```sh
node deploy/preflight.mjs
docker compose -f deploy/compose.runtime.example.yaml --profile agent config --quiet
```

Preflight rejects mutable tags, missing or world-writable state paths, symlinked storage and nested Agent state/secret directories; it intentionally does not read private keys or contact the host. Use independent Control/Agent hosts as planned. This check does **not** validate file ownership, cert validity, journal correctness, firewall, database migrations, network reachability, or rollback feasibility. Do not infer those checks from a successful preflight.

Capture and store your selected image digest, SBOM, scan report, schema version and recovery evidence for each test deployment. No registry image publication or automatic 1Panel rollout is implemented in this slice.

## Runtime liveness and shutdown gates (second slice)

The Control image includes a bounded `HEALTHCHECK` that opens a TCP connection to `127.0.0.1:TUNEX_CONTROL_PORT` and fails if the local listener is missing or the port is invalid. It does **not** verify authenticated HTTPS, MySQL, authority, Agent lease, or data plane readiness. **Do not route production traffic or authorize upgrades based solely on Docker's healthy status.** Agent readiness requires a fresh authoritative Report and real TCP/UDP payload. Do not fabricate an Agent health endpoint.

Container CI now verifies both binaries start only with required trust prerequisites: bare Control must fail when required environment and protected authority state are absent; Agent must fail when its CA, credential and MAC journal key are absent. No trusted state is created by these checks.

Before a controlled update on 1Panel, record the old image digest, database migration revision, full verified MySQL backup, protected Control authority state, CA keys, Agent journal and Node identity. Ensure exactly one live writer/Agent per identity and socket. Gracefully stop the replaced instance before its successor acquires the same state. Keep the old binaries/images available, but **do not start them against a newer incompatible schema**. A rollback may require a tested full restoration of corresponding database/trust state and cannot be performed by dropping volumes or re-enrolling Nodes.

After a staged replacement, verify its actual HTTPS/mTLS operation, current Snapshot/Report, fresh Forward operation, TCP and UDP payload, expired credential refusal and safe resource reclamation before approving production use. Automatic one-command upgrade or downtime-free migration are **not yet implemented**.

## Next acceptance gates (not yet claimed)

- Build both images on disposable Linux CI and exercise image startup and clean shutdown.
- Runtime health/readiness checks, verified image digest/labels, SBOM and vulnerability/permission checks.
- Controlled 1Panel deployment, external MySQL backup/restore and downgrade compatibility decision.
- Two independent host Relay tests including TCP/UDP, mTLS negative peer test, renewed certificate, forced disconnect, failover and real firewalling.

Passing this Docker packaging review alone is **not** a production readiness guarantee.

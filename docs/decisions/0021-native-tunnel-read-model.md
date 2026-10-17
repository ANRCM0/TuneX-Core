# ADR-0021: Bounded Native TLS Tunnel Metadata and Desired Adjacency

Status: Accepted for incremental implementation; exact-SHA Actions acceptance pending.
Date: 2026-10-17 (Asia/Shanghai).

## Context

The native product plan needs Endpoint, credential-window and neighboring-rule
inspection without turning a Console read into credential issuance, an active
network probe or a second deployment owner. Existing Profile impact and rule-copy
flows also need real referenced-rule Relay browser coverage, not just empty lists
or lightweight DOM tests.

## Decision

- `TunnelQueries<Tx>` authorizes Scope membership and loads the exact scoped Node
  before the supplied SELECT-only projection reads any Endpoint, peer metadata or
  desired references, in the same application transaction. Reading does not require
  a Node use grant or confer one; use remains independently checked on commands.
- Status returns configured Endpoint, Node revocation/machine window, declared
  capabilities and persisted report/session counters, and at most four peer
  fingerprint/time/revocation records. It never selects certificates, issuance
  responses, enrollment data, private keys, raw Reports or runtime lease contents.
- Recorded open windows are clipped by Node revocation and machine expiry. They
  are not verified certificates, current TLS sessions, network reachability,
  authorization to execute, or application health. No issuance or network call is
  performed. Counts and rows are READ COMMITTED metadata, not a global snapshot.
- Desired references paginate only same-Scope, nondeleting Relay/multihop rules,
  including disabled and recovery-suspended intent. Exact ordered adjacency and
  Profile revision locks are descriptive, not historical lease/deletion-safety
  evidence. Core, ownership, Runtime, machine contracts and Journal stay unchanged.
- Console reads abort/discard stale results. Inspecting a Profile revision uses an
  explicit immutable revision, never an implicit latest alias. Viewing a deployment
  reuses the original entrypoint; loading an impact/copy still requires the original
  fresh plan check and independently authorized CAS command.

## Validation and Limits

Port/controller tests, a real SELECT-only MySQL/API test with full-table before/after
digests, and real Chromium -> Control -> two native Linux Relay Agents -> TCP/UDP
fixture coverage are authored and wired to Actions. The latter covers referenced
Profile publication/inspection/update, disabled copy, explicit enable/delete and
safe cleanup. Only designated screenshots and redacted evidence are uploaded.
Local validation is static only; none of these functional results is claimed yet.

This does not complete B1: explicit multi-rule Profile publication remains separate.
Real multihop-copy browser coverage, rotation/long-run and independent physical-host
acceptance also remain pending. There is no shared physical tunnel, new driver,
automatic rollout or new credential-management mutation. See the
[management contract](../spec/native-tunnel-management-v1.md).

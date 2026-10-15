# Transit Control coordination — offline durable stage (stacked after PR #106)

Status: **persistent orchestration journal and verified-observation interface; NOT a live multi-hop deployment.**

This is an intentionally isolated step toward the distributed Transit coordinator, not a change in the deployed Agent HTTP endpoint, snapshot publisher or Go Runner.

## Deliverables

- `0011-transit-coordination.sql`: separate, composite-key, foreign-keyed MySQL journal referencing the immutable `transit_deployments` staging row. It does not change `execution_leases` or live `snapshots` and its phase names are **not** statements that a real listener is ready.
- `TransitCoordinationJournal` serializes **one** writer per Forward + Generation using `SELECT FOR UPDATE`, verifies the retained stage's JCS Plan Digest, authorizing actor, exact runtime Node sessions, and every physical `port_slots` owner/Generation/Fence before entering a forward phase. All journal transitions bump a revision with a CAS predicate and a complete JCS digest of their high-water.
- Deterministic `OfflineTransitCommand`: first `prepare` Egress → Transit → Ingress, then `activate` in the **same downstream-first order**. Only if each prior node supplies a matching verified complete observation may the journal advance. There is no executable ADP/3 role/snapshot or network call in these commands.
- `TransitObservationProof`: every observation is pinned to the command digest, exact Node, assignment IDs, Session Epochs, Deployment Generation, physical Fences, expected condition, bounded receive time, and monotonically increasing per-node report sequence. **It is not proof by itself**: `confirm` requires an additional authenticated external `TransitProofVerifier` and has no production caller yet.
- Failures or uncertain remote outcomes switch to `compensating`: a proposed **withdraw Ingress → Transit → Egress** sequence. No resources are released on success or failure; `quarantined` is a persistent isolation state.
- Crash recovery (`quarantineRecovery`) turns incomplete *or simulated sealed* work into withdrawal-only, never replaying an old prepare/activate. The original Staging `abort` now forbids any release if a coordination row exists, protecting against releasing a slot before remote leases and reports have been safely retired.
- MySQL 8.4 CI acceptance covers concurrent start, unauthorized actor, missing verifier, wrong/stale receipt, sequential prepare/activation, simulated recovery, ingress-first withdrawal, HWM, and resource retention.

## Integration blockers — do not bypass

1. A secure Agent Hello capability negotiation and trustworthy durable Transit Report/Ack extension is **not implemented**. The current deployed `/agent/v3/*` endpoints remain Direct/Relay-only. The observation verifier is a future integration boundary; an always-true test verifier is acceptable **only in isolated tests**.
2. A complete **mixed** Direct/Relay/Transit Agent Snapshot, authorized live publisher, and exact atomic cross-role port ownership journal must be designed. The standalone Transit envelope in PR #105 cannot simply be injected into existing runtime snapshots.
3. The Control coordinator must reverify creator's live grants, certificate pins, current policy/Profile and expiration at each publication. Staging-only immutable facts and this offline journal are insufficient to mint leases.
4. Durable end-to-end Agent reports, idempotent retries/restarts, partial-network-failure compensation, lease revocation, and multi-host TCP/UDP E2E evidence are required. No Console option, new transport capability advertisement, live Runner registration or production service wiring may be exposed until those gates pass.
5. Cleanup after coordination must verify **all** historical leases and possibly live snapshots as well as Fences and quarantined coordination state, and remain operator-controlled. Do not prematurely clear a physical owner merely because withdrawal observations were simulated.

## Verification

`node --test apps/control/test/transit-coordination.test.ts` is an offline MySQL test, skipped without `TUNEX_TEST_DATABASE_URL`. In CI, the Phase 1 job provisions a real MySQL 8.4.9 container and runs it before the larger `npm run test:phase1` suite. Also require same-head Contracts/Go race, Phase 1, Relay Isolation and Containers to pass before the stacked PR is considered ready for review.

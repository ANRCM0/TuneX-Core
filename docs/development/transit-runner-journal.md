# Transit Runner / Journal preparation — staged Agent slice

Status: **offline integration helper and durable high-water implemented; NO production multi-hop execution**.

This slice builds on the isolated Transit ADP/3 envelope in PR #105 and retains existing Direct/Relay behavior.

## Delivered

- `state.InitializeTransitJournal` creates a separate, explicit, protected Node-bound Transit state file. It **never** silently bootstraps or resets a missing journal.
- `state.LoadTransitJournal` verifies HMAC, strict JSON, Node/extension identity, generation/digest, immutable retained Snapshot and physical `tcp/port` Fence high-water. A corrupted or wrong-key file fails closed.
- `state.AcceptTransitSnapshot` takes an exclusive lock, rejects stale writers or generations, never decreases physical Fences, retains retirement high-water, and persists before a listener may be prepared.
- `control.TransitController` is an **unregistered** Agent executor adapter with explicit capability negotiation, live external authorization, peer identity, session epoch and a mandatory local port guard. It recognizes prepared/active/draining roles; prepared never binds a port, active must pass `transit.Engine.Activate()` downstream mTLS probe before reporting ready, and retiring closes active sockets.
- `control.Runner.transitControllerForIntegration` is a private, currently uncalled bridge requiring both a live Runtime ticket and an **additional** Control-issued Transit authorization callback. `transitPhysicalGuard` refuses sockets with any Direct/Relay journal fence or active/draining owner. The bridge is **not invoked** from `Runner.Run()` or `Runner.poll()`.
- A process restart only reloads the Transit high-water and does not automatically recreate a listener. Even an identical Snapshot requires a **new** generation for a new `ApplyTransitSnapshot` call. No implicit recovery of stale authority.
- Negative tests check port collision, missing capabilities/authority, stale writers, signature tampering, role/session mismatch, durable replay rejection, revoked permission, and refusal to report active when no downstream peer answers.

## Required follow-on work before the live cutover

1. Control needs a single, **authoritative durable distributed multi-hop** publisher/journal, explicit Agent Hello capability negotiation and complete mixed Direct/Relay/Transit snapshots; PR #105's Transit envelope remains isolated.
2. A real, authenticated server-derived Transit authorization must supply the callback; the pre-integration adapter does not create authority or revalidate MySQL reservations by itself.
3. Physical resources and phase/Fence state across the Direct/Relay Runtime journal and Transit journal are **not atomically coordinated**; the current conservative guard rejects any previously used Direct/Relay port. Production integration must implement an atomic shared journal or equivalent serialized ownership before allowing both paths.
4. Observations returned by `TransitController` are local diagnostics, not a durable, acknowledged ADP/3 Report. Add report idempotency, downstream-first orchestration, compensation, lease renewal, and abort semantics.
5. Real independent three-node TCP and UDP plus network partition, credential revocation, restart, rollback and long-running traffic tests are mandatory. No production multi-hop claim is justified by the tests in this PR.

## Verification

Run `npm run check` (Go vet, Go race, TS contracts), `npm run contracts:check`, and same-head Contracts, Phase 1, Relay Isolation and container CI. A passing standalone Agent test proves *only* this integration surface; it does not imply a live Control-to-Agent multi-hop path.

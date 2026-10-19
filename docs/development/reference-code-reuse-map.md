# Reference Code Reuse And Adaptation

Date: 2026-10-19. The human explicitly allowed reference and reuse of appropriate
mature reference-project code to accelerate development. This supersedes earlier
task wording that limited all work to behavior-only study and independent source.
It does not authorize verification, new product scope or a different authority.

## Working Method

Read the actual implementation and select an applicable bounded component or
algorithm. Adapt or reuse it inside the correct TuneX owner/public contract,
recording upstream file/revision, changes and copyright/license provenance when
source is introduced. Keep existing legal/NOTICE.md and upstream notices. This
authorization is not a blanket change of the project's licensing or publication
status. Do not create an import, build, runtime or deployment dependency on the
Forwardx reference checkout.

Keep the original TuneX Runtime ledger, Agent authority/Journal/Gate/counter,
transaction ownership, exact identity, refusal and deadline rules. Reuse does
not substitute upstream assumptions or protocol versions for these invariants.
New frozen public semantics still require the original FR process. Source-only
work and later Actions acceptance remain separate; reference tests are examples
of scenarios, not current TuneX or upstream pass evidence.

## Initial Concrete Mapping

Reference source: local Forwardx at
8a3e70ccd62fbfee301f3b919120d51e9892de28, package-declared AGPL-3.0-only.
Only source was read; no upstream code or scripts were executed.

| Source actually read | Useful implementation pattern | TuneX application and constraint | Current disposition |
| --- | --- | --- | --- |
| agent/gost_additive_sync.go, gostAPIClient.request | maximum+1 body bound, reader error before oversize, bounded error-code projection, caller-owned Close | Existing nativeexecution/probe_http.go and later HTTP adapter work keep original TuneX 4096/32768 bounds, version correlation, context order and spent claims | Compare existing original-source extraction; reference for later missing cases, no copied source in this batch |
| agent/http_client.go, native transport/client factories | Separate synchronization/presence/event workloads, explicit proxy and bounded connection/header/idle settings | Existing Control/observation channels retain TuneX mTLS, approved URLs, channel separation and injected/native defaults; any tuning follows measured-load authorization | Concrete source candidate, no provider/default or performance change implemented |
| agent/tcping_report_gate.go, countReports and identity helpers | Count once per completed collection rather than HTTP retry; retain counters across missing ACK; identify topology/series/epoch | Existing Probe counters and telemetry preserve exact uint64, current-instance/global-budget and non-refundable authority; reporting/series ideas can inform C3 | Source pattern read; no new counter owner, LRU policy, reset or entropy fallback adopted |
| server/forwardGroupRuntimeStatus.ts, identity/count/status helpers | Derive expected identity set, deduplicate configured/running identities and expose partial state | C1 can adapt using original TuneX session/generation/fence/Operation identities and public read models; runtime counts do not prove application health | Source candidate for gated product work; no C1 implementation or behavior evidence |

This map is not an assertion that every upstream default fits TuneX or that the
reference revision passed tests. Prefer reusing a suitable component over writing
a parallel equivalent; keep incompatibilities explicit instead of silently
weakening contracts. Existing correct TuneX implementations remain the basis for
equivalent owner moves, while new code can use these concrete reference patterns.

## Current Work And Remaining Stages

Current A source batches through readiness105 are authored but unverified. A still
needs remaining Path/Ingress/application/HTTP ownership, Agent wire/time/native
closure and complete source/type/default/bridge classification with a reviewable
freeze candidate. B requires later human verification authorization and exact-source
contract/functional/public-example evidence. C1-C4 user workflows, D1 measured-load
evaluation/D2 fixed topology and manual switching, and separately approved E
automation/external capabilities remain incomplete. Reuse permission accelerates
those tasks without marking them done or bypassing their existing gates.

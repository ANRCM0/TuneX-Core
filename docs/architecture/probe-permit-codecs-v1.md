# Probe Permit Codec Boundary V1

Date: 2026-10-19. Source candidate; unverified, not accepted.

The existing `ProbePermits` owner now consumes public L2 Probe result/type/service/
echo parsers, result-body/digest/proof functions, JSON encoding, UTC/ISO conversion,
certificate fingerprint and default wall-clock bindings. Its single authority,
transaction locks, 256-record budget, issuance/consume/check/revoke/withdrawal
state machine, instance/machine/plan/qualification checks, replay/duplicate result
rules, history capture and protected store calls remain in L3 and are not copied.

Permit issuance IDs, machine fingerprints, binding checks, expiry/freshness, proof
pinning and response/refusal order remain unchanged in source intent. Echo proof
verification still receives the exact original invocation/challenge bytes and
certificate DER fingerprint; no echo execution or fallback is introduced. The
owner does not delegate authority to codec helpers, and no Journal/Runtime ledger
or protected history is reset.

Readiness item 46 is planned only. Exact parser/digest/proof identity, JSON/ISO,
certificate bytes, issuance/claim/consume/check/revoke transaction order, budget,
replay/withdrawal, expiry/freshness, history and failure semantics require frozen
source acceptance. No tests/checks/type/syntax/boundary/format/build/network/
MySQL/browser/container/CI/Git ran.

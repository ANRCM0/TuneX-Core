# Probe Machine Codec Boundary V1

Date: 2026-10-19. Source candidate; unverified, not accepted.

Probe machine adapters for claim, negotiation, instance, delivery, result, typed
and service flows now consume public L2 parser/JSON/UTC-ISO/default-clock and
digest bindings. L3 keeps mTLS/session identity checks, freshness windows,
permit-owner calls, committed-before-ack ordering, `executionEnabled: false`,
measurement/service selection and refusal/error rules. Existing request/response
types and parser labels remain unchanged; direct type imports are compatibility
surface only and parser implementation stays in the contract owner.

No parser fallback, permit creation/extension, Runtime write, network operation,
echo enablement, sender, new clock policy, retry or authority is introduced. The
same owner call occurs before response construction; a lost response still leaves
the permit spent. Default clocks capture the native wall-clock function through
the public L2 binding, while explicit clock overrides remain available.

Readiness item 45 is planned only. Exact parser identity, JSON field ordering,
UTC/ISO formatting, default/explicit clock behavior, 250ms freshness, session and
permit refusal, transaction-before-ack ordering and unsupported-feature behavior
require frozen-source acceptance. No checks/tests/type/syntax/boundary/format/build/
network/MySQL/browser/container/CI/Git ran.

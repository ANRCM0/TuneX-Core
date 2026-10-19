# Probe Permit State Codec V1

Date: 2026-10-19. Source candidate; unverified, not accepted.

`probe-permit-state.ts` retains the L3 persisted permit field, binding, state,
TLS/echo context and invocation consistency rules. It now uses public L2 Probe
service/echo context parsers, selection/invocation digest and ISO conversion.
The validator remains pure and synchronous: malformed state returns `false`,
without storage, clock, network, authority or mutation. The single permit owner
and lower store continue to call the same validator; no alternate parser or
permissive fallback is added.

Readiness item 47 is planned only. Exact field-key unions, binding identity,
context scope/version/protocol/window, challenge/invocation digest and ISO byte
semantics require frozen-source acceptance. No tests/checks/type/syntax/boundary/
format/build/network/MySQL/browser/container/CI/Git ran.

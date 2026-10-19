# Probe Observation Codec Boundary V1

Date: 2026-10-19. Source candidate; unverified, not accepted.

`ProbeObservationServices` now obtains Probe service/TLS/echo context parsers and
the immutable context digest through public L2 compatibility bindings. Its L3
owner continues to validate the scoped service reference, authorize the same
transaction, read the metadata head/revision, enforce archive/recovery/revision/
digest/window/clock rules, and return the existing resolver shapes. No network,
credential, permit, sender, listener, echo execution or Runtime write is added.

The existing Probe/echo parser functions and error behavior are aliased directly;
no parser copy or alternate fallback is introduced. The constructor keeps its
explicit clock override and the native default now captures the same wall-clock
function through the public compatibility binding. Observation service values and
the metadata owner remain the source of trust/configuration policy.

Readiness item 44 is planned only. Exact parser identity, context digest, clock
capture, authorization/store call order, refusal/error mapping, version/transport
selection and no-execution behavior require frozen-source acceptance. No tests,
checks, type/syntax/boundary/format/build/network/MySQL/browser/container/CI/Git ran.

# Runtime Observation Ports

Public Go interface 1. Provider exposes memory,
process, goroutine, PID, platform provenance and host measurements. Value types
belong here; native runtime/OS reads stay in platformobservation. Old adapter types
remain aliases to the same declarations, preserving their JSON representation.

Reads are separate methods to preserve the existing caller's sample ordering and
lock scope. Unsupported process/host fields remain absent or explicitly unsupported,
not fabricated zero measurements. Observations confer no health, capacity, physical
host or execution authorization. The existing host worker owns its 500ms deadline,
non-overlap and late-result discard; the provider does not schedule or retry work.

Native source equivalence and injected failure/blocking traces remain part of
the public contract acceptance obligations.

Exact-source verification and remaining environment limits are recorded in
[verification status](../../../docs/testing/verification-status.md).

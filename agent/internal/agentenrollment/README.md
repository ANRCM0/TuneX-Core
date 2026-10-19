# Native Enrollment Binding 1

Source candidate only. This L2 package supplies executionenrollment.Platform and
Channel using the original CLI file/CSR/key/CA/certificate/HTTPS/parser operations.
Native returns that one lower Host with native typed providers; it is not a new
application composition root or an independent Journal implementation.

Existing native behavior is retained, not tightened or certified: the same files,
read-error branches, P256 generation, saved CSR reuse, URL/redirect/TLS settings,
ten-second timeout, bounded reply parsing, certificate checks, ignored response CA
and write/failure order still need exact-source acceptance. Body/idle cleanup is
deferred by the host through final writes and the CLI completion callback.

No Runtime permission, new trust root, retry, state reset, background worker or
automatic recovery is added. Root/key path checks and all CLI flags stay in the
existing command. Verification requires later authorization and Actions evidence;
see docs/architecture/agent-enrollment-v1.md and readiness item 32.

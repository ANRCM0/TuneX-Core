# ADR: independent TuneX Secure Transport 1

Decision: accepted for experimental implementation; production enablement pending.

The product exposes one Forward business contract and owns its secure transport
inside the Go Agent. TST/1 defines TuneX rule authorization, bounded framing,
TCP stream multiplexing, UDP associations, flow control and lifecycle. It does
not adopt the previous third-party frame format or keep a protocol adapter.

Go's `crypto/tls` provides TLS 1.3, mTLS, authenticated encryption, nonces,
record ordering, replay protection, key derivation and cryptographic randomness.
TuneX does not add a custom encryption layer. ALPN must be exactly `tst/1`;
unsupported versions fail closed. Session tickets are disabled and application
early data is not accepted. Per-Link CA certificates bind Workspace, Link, node
and opposite roles through URI SANs and ordinary certificate-chain verification.

TCP carries multiplexed TCP and UDP application lanes with bounded memory,
stream and connection windows. UDP therefore inherits TCP head-of-line blocking.
This implementation does not promise QUIC latency or loss characteristics.

The egress owns its authorized targets. An OPEN contains a Forward ID, revision
and protocol, never an address. A shared carrier's authentication cannot grant
arbitrary dialing or cross-Workspace access. Changed/removed rule authorization
affects that rule; replacement carrier identity/endpoints can interrupt all rules.

Incompatible historical resources remain explicitly quarantined, with recoverable
records and notices. Active external executables, adapters and build dependencies
are removed only after replacement regression coverage and source archival.

Consequences: one deployable data plane and one business authority; new custom
framing requires independent security review, fuzz/state-machine/resource tests
and real Linux deployment evidence before opening the default feature gate.

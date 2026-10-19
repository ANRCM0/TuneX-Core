# Native Observation Trust Interface 1

Source candidate only, unverified. This L2 package owns the existing public service
context/digests, strict leaf pin/identity/purpose/time checks and native bounded TLS
handshake. It does not load private keys, read Agent state, dial a destination,
mint/consume a permit or prove application health.

Trust.Handshake consumes a caller-owned already-connected raw socket and the
original continuously checked authority callback. It keeps TLS 1.3-only, exact
SNI/ALPN/leaf verification, independent 32768-byte RX/TX wire budgets, context
cancellation close, deadline and timeout/uncertainty rules. The caller still closes
the connection at its original lifetime endpoint. Non-timeout handshake failures
remain unverified evidence rather than authority or an invented successful result.

The old probe.handshakeService maps native denial back to the original ErrDenied;
its raw budget error aliases this package's one budget error. Existing Trust.New,
Current and VerifyConnection meanings remain unchanged. New package-interface
version 1 does not change the service/Probe wire, ALPN, trust root or capability.

See docs/architecture/agent-probe-native-boundary-v1.md and readiness item 33. Native
crypto/TLS operations belong here, while Runner/Gate/watch/current-instance and
permit ownership remain outside. Whole Probe/native source still contains mixed
dependencies; this move is not acceptance or permission to bypass those owners.

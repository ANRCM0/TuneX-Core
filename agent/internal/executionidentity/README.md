# Agent Identity Provider Boundary

Public Go interface 2. The generic Provider uses
adapter-owned Certificate/Roots types without importing TLS, filesystem or crypto
implementations into this package. Request/bundle facts have no JSON tags or native
serialization guarantee. FR-0024 keeps exact original native field names/order/tags
in agentidentity records, with explicit facts/native conversion at Provider methods.
Old native helper and Control fixture aliases use those records. Direct lower JSON
is a breaking source behavior and is not a credential format. Private keys and
certificates must never be logged.

The native provider loads/verifies machine identity, prepares durable rotation
requests, checks returned credentials, and reads/writes the original machine/Relay
files. It does not update Guard, authorize sockets, replace Journal or publish the
Runner's in-memory identity. The Runner retains those decisions and the existing
Probe invalidation/mutex/Guard/idle-connection sequence.

LoadRelay's missing flag refers only to the initial read: a later MAC/store read
failure is not absence and must not trigger issuance. Machine and Relay replay,
overlap, expired-history and cleanup orders remain distinct. The native adapter
retains the original permissive machine JSON decode versus strict protected Relay
decode; this interface does not silently widen or tighten those wire grammars.

Providers are trusted compiled-in code, not a sandbox or a remote authentication
plugin. Existing control.New binds native providers; NewWithProviders requires both
explicit providers without fallback. Legacy package-local Runner construction has
the old native defaults.

Exact-source verification and remaining environment limits are recorded in
[verification status](../../../docs/testing/verification-status.md).

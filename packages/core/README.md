# @tunex/core

Pure Core v1 domain functions. No Node builtins, external dependencies, IO, secrets,
database models, runtime state or drivers. `parseForwardSpec` accepts unknown
input; `decideForwardChange` decides immutable CAS changes and preserves revision
for a canonical no-op. Repositories must enforce the actual atomic CAS.

Empty `path.via` canonicalizes to an absent path. Protocols serialize TCP then UDP.
Endpoint IPs use canonical text; ASCII hostnames lowercase and lose one root dot.
Node existence, network policy, authorization and reservations are outer concerns.

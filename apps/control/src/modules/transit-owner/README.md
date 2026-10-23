# Transit Owner

FR-0030 source candidate; unverified. Transit keeps its original Runtime exclusive
reservation host, staging/abort journal and exact release owner. It does not use
the Relay host's same-owner reuse mode.

Staging passes the complete Forward into Node authorization and filters internal
TLS candidates with `RuntimeRelayNodes.reservationPorts`. The same transaction
then reserves the whole physical set through the mandatory shared-Node policy.
An occupied slot remains rejected even when the owner is the staging Forward.
Failure rolls back the original stage transaction; grant narrowing does not
block abort or exact original cleanup.

The compatibility `reserveTransitResources` entry accepts the original
transaction, Forward, resources and generation plus the injected
`RuntimePortReservationPolicy`. Production composition must bind this policy in
every alias. The root compatibility wrapper can assemble the original explicit
MySQL providers if preserving the old construction shape; an unrestricted stub
or optional silent bypass is not a compatible fallback.

Ports, old/draining occupancy and immutable owner counting follow the public
Node owner README and FR-0030. No acceptance, checks, builds or tests ran for this
source candidate. Native Transit authority, Journal and protected history retain
their original owners.

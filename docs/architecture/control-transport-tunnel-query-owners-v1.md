# Control, Transport and Tunnel query owner candidates

Date: 2026-10-19. These are authored dirty source candidates, not accepted
interfaces or a tested frozen revision. No verification or Git writes ran.

## Public entries and original source chains

Control detail coordination and its complete existing version-1 contracts now live
in modules/control-query-owner/public.ts. The original chain is scoped identity
validation -> supplied transaction -> L1 authorization -> public Forward owner
read port and original Runtime observation/Operation/Deployment readers. There is
no executable handle, storage replacement or new authority. Capabilities still copy
and freeze the input at construction and return a fresh mutable copy. Forward
details retain get -> observation status -> latest Operation -> metadata order;
deployment/revision reads first resolve the Forward, and Operation reads retain
the original null/Boolean/unknown projections. All use the authorization transaction.

Transport queries, query contracts and TransportReferenceReadModels now live under
the existing modules/transport-owner/public.ts. The chain is input validation ->
copied frozen query and paging -> same-Tx authorization -> required profile metadata
reader -> optional original immutable Profile resolver -> required references read
port -> required L1 ProfileReferenceReadStore and ReadProjectionValues -> original
MySQL store -> original persisted state. Projection callbacks preserve raw JSON,
Boolean, null-count and configRevision fallback mapping before product validation.

The query requests management authorization exactly when targetRevision is present.
Missing metadata and currentRevision integrity checks precede optional resolution;
resolved identity/revision checks precede reference reads; page/duplicate checks
precede per-spec identity/revision/path/Profile validation. Proposed specs and flags
retain their original values and final deepFreeze. The tail observedAt still uses
the dynamic zero-argument new Date ISO operation at the original return position,
now through existing public L2 nativeReadProjectionValues.currentIso(). It does not
replace that operation with Date.now or capture a clock at construction.

Tunnel metadata queries, complete existing version-1 contracts and TunnelReadModels
now live in modules/tunnel-query-owner/public.ts. The chain is identity validation ->
supplied transaction/authorization -> required read port -> required L1
TunnelMetadataReadStore/ReadProjectionValues -> original MySQL store. Raw projections
stay synchronous callbacks with original field/null/count mappings.

Tunnel construction still captures the default Date.now function without reading
time; existing L2 nativeWallClockSource() preserves that default expression timing.
An explicit clock remains accepted unchanged. Status retains Node metadata read
and validation -> one clock sample/validation -> endpoint revision/config parse ->
peers read using the sampled now -> bounded peer validation/window projection.
Existing public L2 parseRelayEndpoint and nativeIsoTime provide the original parser
and new Date(value).toISOString() operations at the original call sites. Endpoint
parse errors retain their original narrow catch mapping.

Peer window limits, unique fingerprints, machine revocation/expiry, effectiveUntil
intersection, four-item projection, two-window bound and open-first metadata
selection remain unchanged. Health stays unknown and network/certificate checks
stay not-performed; no credential, execution or deletion authorization is added.
References retain Node existence/metadata validation before reading references,
page/spec validation, path index/role projection, historicalReferencesIncluded:false
and deletionSafety:not-proven. Original query input defaults, paging freezes and
final deepFreeze remain; contract fields retain original mutable declarations.

All cross-owner paging rules/types consume Console public.ts; Control reads consume
Forward public.ts. L1 and L0 contracts are unchanged. No breaking public semantics
or new provider requirements are introduced, so this relocation needs no new FR.

## Compatibility and integration

The six old application query/service/contract entries directly alias canonical
leaves, preserving their exact named exports, class identity and original public
methods. application/management-read-models.ts now directly aliases all three
canonical read model classes and retains MANAGEMENT_READ_MODEL_INTERFACE_VERSION=1.
The earlier Console owner is unchanged. HTTP transport/tunnel query parameter
parsers consume public owner types and preserve original parsing behavior.

The existing Control composition now imports ControlQueries from control-query-owner/public.ts,
TransportQueries/TransportReferenceReadModels from transport-owner/public.ts and
TunnelQueries/TunnelReadModels from tunnel-query-owner/public.ts. The same original
stores, values, resolver, clock defaults and shared root instances must be supplied.
api/application-ports.ts now obtains ControlDetailApi, TransportQueryApi and
TunnelQueryApi from those three public entries respectively. Shared classification
and readiness now record these sources and planned items89-91.

## Planned acceptance and open scope

After verification authorization, cover old/new export/class identity, constructor
defaults and explicit clocks, provider callback binding/timing, shared transaction
authorization and exact read/error order, missing metadata and malformed persisted
rows, count/null/JSON/Boolean projections and preserved DTO mutability/deep freezing.
Control cases include invalid identity, features copy/freeze and desired/Operation
projection ordering. Transport cases include targetRevision manage flag, resolver
identity/revision mismatch, revision filters, page/duplicate guards, original
dynamic new-Date tail observation and non-authorizing proposed specs. Tunnel cases
include captured Date.now versus later clock replacement, one now sample, invalid
timestamps, endpoint catch boundaries, peer limits/uniqueness/window intersections,
revocation/expiry, path-role projection and unknown/non-authorizing flags. HTTP cases
retain duplicate/unknown paging keys and canonical positive revision parsing.

Functional/MySQL/HTTP evidence belongs to GitHub Actions on the authorized frozen
revision. No checks/tests were executed. Native catalog/tunnel management, command
owners, remaining Path/Ingress coordination, full HTTP chains and whole-source
classification remain open. These slices do not complete A2 or accept the foundation.

Current integration uses the original stores/values/resolver and same instances.
Shared source declarations/readiness89-91 are authored, entirely unexecuted.

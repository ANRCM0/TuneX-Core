# @tunex/contracts

Private ESM package version0.1.0. The current source contains three lower common
contract entries and separate native Runtime, Probe, observability, historical
ADP2, offline Transit and staged Echo entries. Package version, public port
versions, wire versions and current-source acceptance are separate records.

## Public Imports

The package.json export map defines the supported entries. An exported type or
function in a private src leaf does not add another package subpath.

| Import | Source responsibility |
| --- | --- |
| @tunex/contracts/policy | L1 common Policy declaration, interface1 |
| @tunex/contracts/execution-observation | L1 phase/condition/Observation/Drain facts, interface1 |
| @tunex/contracts/execution-values | L1 Runtime values and erased outer-format family, interface2 |
| @tunex/contracts/runtime | L2 current ADP3 Runtime/Relay and explicit mixed execution extension1, native catalog and compilers' wire values |
| @tunex/contracts/probe | L2 independent v1 negotiation/instance/claim/delivery/result, typed v2 and service-bound v3 families |
| @tunex/contracts/observability | L2 Node/Host/Forward/Probe telemetry wire parsers and values |
| @tunex/contracts/shared | L2 native DEFAULT_POLICY, bounded JSON, digest, time and validation; not an L1 utility entry |
| @tunex/contracts/legacy/adp2 | L2 historical/offline ADP2 Direct contracts; no production ADP2 enablement |
| @tunex/contracts/experimental/transit | L2 offline Intent/ADP Transit and contract-only negotiation/delivery; no production driver installation |
| @tunex/contracts/staged/probe-echo | L2 unfinished Echo v4 contracts/helpers; end-to-end availability and live machine input remain separate |
| @tunex/contracts | Broad native compatibility barrel including legacy/Transit/staged Echo; not a lower common-contract entry |

Lower framework code uses the three dedicated L1 entries. Type-only imports also
count as source dependencies. Root/runtime/shared can expose aliases of common
facts while remaining native dependency graphs; those aliases do not authorize
L1 imports of native formats, files, validators or platform effects.

Normal /probe intentionally excludes staged Echo and Transit even though the
root barrel exports their symbols. Import availability does not enable a feature,
approve a capability, allocate a permit or authorize execution.

## Source Assets And Loading

Native TS schema validators load specific files from docs/protocol/schemas using
URLs relative to their source modules. Native driver metadata loads the package's
data/native-drivers-v1.json and computes its native digest. Keep repository-relative
schema assets and package data with their source distribution. Copying only src
or one manifest is insufficient for those native imports. Barrel value imports
can eagerly load/compile multiple schemas before a parser is called; L1 common
entries have no schema/catalog loader.

Agent codecs embed separate schema copies. The existing Go generator maintains
only its named schema/type targets, including shared adp3execution declarations
and exact adp3 aliases; it does not maintain every embedded schema in the Agent.
The full source-to-copy/generated/handwritten mapping is in
[the asset source map](../../docs/architecture/contract-assets-source-map-v1.md).
Byte parity, module loading and clean package/image delivery have not been
executed for the current foundation source.

## Parsing And Authority

The existing ADP2/ADP3 stateless parser source rejects duplicate keys (including
escaped duplicates), unknown fields, unsafe or rounded integers, lone surrogates,
excessive body/depth, inconsistent JCS digests, resource conflicts, invalid CIDR
networks and inconsistent reports within each family's declared scope.
Number tokens are checked exactly before floating-point conversion can erase
evidence; mathematical integers such as `2.0`/`2e0` remain supported.

AJV's regex adapter requires full-string matches for anchored scalar patterns,
matching the domain rules and Go's end-of-input behavior. Timestamps compare
fractional seconds exactly; unrepresentable leap seconds are rejected by both
parsers. This is conservative input rejection, not a relaxation of a lease.

Snapshot/session freshness, Node identity, capabilities, lease policy, instance
ownership and persistent generation/fence history require Runtime state and are
not proved by this parser. Digest authenticity still requires an authenticated
channel. Fixed-time fixtures are not current execution authorization.

The complete current foundation acceptance is planned/unexecuted. This README
records source behavior and boundaries, not a new passing parser/compatibility
result. See the [native leaf map](../../docs/architecture/contracts-package-native-boundaries-v1.md)
and [foundation readiness](../../docs/testing/verification-status.md).

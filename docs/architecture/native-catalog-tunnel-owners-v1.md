# Native catalog and logical tunnel owner candidates

Date: 2026-10-19. Source authored only; acceptance is planned and unexecuted.
The dirty source is not a frozen revision or an opened module gate.

## Native catalog source chain

modules/native-driver-owner/public.ts owns the original NativeDrivers class and
complete version-1 query API/view declarations. The original runtime catalog and
digest have a direct L2 leaf export in compatibility/native-runtime-catalog.ts;
compatibility/public.ts now exposes those two exact exports.
The leaf does not clone, rebuild, hash or freeze the catalog. NativeDrivers consumes
the public L2 constants and its existing required L1 authorization/transaction ports.

The chain remains list -> supplied transaction -> scope authorization -> original
catalog descriptor spreads in original order -> final deepFreeze. The constructor
retains multihopEnabled=false and probeIssuanceEnabled=false and their original
positional order. Only the original multihop gate controls controlEnabled; catalog
digest, protocol check declaration, source and non-authorizing/evidence-not-included
flags retain their original values. Descriptor nested declaration objects/arrays
keep original identities; the public view type still removes readonly only from
outer descriptor fields. No platform acceptance or Node capability evidence is added.

## Logical tunnel source chain

modules/native-tunnel-owner/public.ts owns the original NativeTunnels class,
NATIVE_TUNNEL_MANAGEMENT singleton and complete version-1 API/view declarations.
The legacy generic parameter still exposes no transaction API. The required four
constructor collaborators remain original Path query, Path command, Path binding
and Forward applyPath APIs, in the original order, without new defaults.

list/get await the same original owner method and then build the original deeply
frozen tunnel view. The management object keeps its singleton identity and original
not-assessed/configuration-reuse/Forward-runtime ownership declarations. Topology
still follows config.nodes order, uses ingress/transit/egress labels and the prior
node's exact endpoint revision, with null at ingress. DTO declarations retain their
original mutable/readonly fields.

publish/archive/binding/preview/references/apply return the same original collaborator
method result, preserve argument order and bind the same collaborator receiver. No
async wrapper, new transaction, alternate request path/digest or durable receipt is
introduced. In particular, both API names still use the original Path/Forward command
identity; there is no second tunnel state, credential or execution authority.

## Public API prerequisites and compatibility

The authorized prerequisite move places the complete original path-template-api
declarations in path-owner/template-api.ts and path-binding-api declarations in
path-owner/binding-api.ts. Their version constants and exact mutable DTO/API shapes
are publicly exposed by Path. Local contracts use the canonical existing same-owner
port leaves; Console paging comes from its public entry, and ForwardIntent from L1.
The complete original Forward command API declarations now live in
forward-owner/command-api.ts, consuming Path public receipt types. Its version stays
1. Moving those declarations does not move or close the ForwardCommands coordinator.

All seven legacy application entries are precise leaf aliases: native-drivers,
native-driver-contract, native-tunnels, native-tunnel-api, path-template-api,
path-binding-api and forward-command-contract. Original named runtime/type exports
are preserved, without duplicate implementations. NativeTunnel internals consume
Path/Forward public contracts and their own local contracts, not their own public
barrel. No L0/L1 public contract semantics or provider requirements change; no new
breaking foundation change is implemented.

## Main integration and planned acceptance

The existing Control composition now imports NativeDrivers and NativeTunnels from their corresponding owner
public entries, and obtains NativeDriverApi/NativeTunnelApi there in HTTP application
ports. The direct NATIVE_DRIVER_CATALOG/NATIVE_DRIVER_CATALOG_DIGEST export is appended
from native-runtime-catalog.ts to the shared L2 public entry. Root instances and
Path/Forward collaborator bindings remain the same. Shared boundary/readiness/index
registration now records these source moves, without acceptance execution.

After verification authorization, cover exact old/new class/type/version exports,
runtime constant/catalog/digest/nested identities, constructor defaults/order and
explicit flags, same-Tx authorization, catalog order/gate behavior and result freeze.
Tunnel cases cover singleton identity, original list/get order, page/item spreading,
topology roles/endpoints, deeply frozen views versus original mutable DTO declarations,
same arguments/receiver/result identity for all six forwarding methods, canonical
command digests and durable receipts across both API names, authorization refusal and
no new state/transaction/authority. Verify Path/Forward API declarations and compatibility
entries on the exact authorized frozen revision. Functional/HTTP/MySQL evidence
belongs to GitHub Actions. No checks, tests, builds, experiments, CI or Git writes ran.

Forward/access/Node/Profile commands, remaining Path/Ingress coordination, full HTTP
chains and source/type/default/bridge classification remain open. This slice does
not complete A2 or accept the foundation.

Readiness94/95 records exact catalog/tunnel/API alias cases, entirely unexecuted.
Shared existing roots and public L2 export are now integrated as source.

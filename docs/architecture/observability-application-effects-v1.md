# Observability Application Effects V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

The optional observability application owners now consume public compatibility
bindings for native UUID/digest/JSON/base64/time/monotonic/byte and selected wire
codec operations. Their L3 responsibilities remain unchanged: authorization,
request admission/cooldown maps, clock-skew and freshness policy, response/receipt
validation, cursor/query framing, owner transaction boundaries, rollback/replay,
feature switches, notification handoff and Probe/Runtime authority separation.

L2 `compatibility/public.ts` retains native function identity and behavior through
small bindings: UTC parse/ISO conversion, JSON UTF8/default byte count, base64url
cursor text/encoding, UUID, digest, hex secret bytes, monotonic time, and the
observability/Probe wire parser exports. No helper reads a clock before an outer
validation point, normalizes a cursor, changes JSON framing, changes byte limits,
or creates a second key/authority. Notification signing bytes are still held only
for the original sender call and zeroed in its existing `finally`; the hex helper
returns the same transient byte representation only to that existing owner path.
No secret enters a public DTO or log. Diagnostic certificate fingerprints use the original DER
base64 bytes and SHA-256 sequence.

The four telemetry owners keep their original constructor/default clock function,
sample skew/freshness, source/mapping checks, raw store transactions, rollup
recording, status/observedAt responses and wire schemas. Audit/station/notification
and Probe history/plan owners keep canonical UTC/query cursor formats, exact
base64url framing, request digest inputs, UUID placement, policy/receipt/error
ordering and admission limits. The change moves native operations only; it does
not centralize business parsers, owner state, handoff, sender, permit, ledger,
Journal, Runtime authority or feature enablement.

Old application imports and constructor signatures remain where they are public or
shared compatibility paths. This is an additive/private source boundary, not an
acceptance of all remaining application values, HTTP/query helpers, Probe/path/
Transit storage, Agent native dependencies or unclassified files.

Readiness item 41 is planned only. Exact import/type/default function identity,
cursor byte/framing, UTC/ISO precision, digest/UUID/key-zeroing/error order,
wire parser compatibility, clock/cooldown behavior and transaction/rollback/feature
semantics require later frozen-source acceptance. No tests/checks/type/syntax/
boundary/format/build/native/network/MySQL/browser/container/CI/Git ran.

## Station/Notification Lower Port Follow-Up (2026-10-19)

Original Station and Notification classes/rules now live under public owner roots.
L1 notification-effects-ports owns their original Vault/Sender/lease declarations;
existing native Vault/Sender consume lower types with unchanged implementations.
Temporary signing bytes and physical idle-before-lease-release remain at the
original worker points. No new key/Authority or native support is claimed. See
[owner chains](station-notification-owners-v1.md), readiness70-72 unexecuted.
## Telemetry Public Owner Follow-Up (2026-10-19)

Original raw/aggregate service bodies and rollup values/providers now have a public
telemetry owner. They keep distinct state, original public native primitives and
precise arithmetic/epoch/quality/coverage rules. Four ACK projections move to L2
without extra time reads or state policy; mapped accepted/rejected guards stay at
the original L3 private ack method. Existing SQL/mapper/database/provider instances
are unchanged. See [owner chains](telemetry-public-owners-v1.md), readiness75-77
unexecuted; no behavioral/native/whole-foundation acceptance or optimization claim.
## Observation Declaration Public Chain (2026-10-19)

Original inert declaration service/API/contracts/storage values now belong to the
existing public Observation owner. Old application/flat paths are exact leaf
aliases; same server/Control/HTTP roots, lower SQL and legacy override/static paths
remain. See [owner chain](observation-service-owner-v1.md), readiness78 unexecuted.
This source move is not A1/A2/foundation/physical/release acceptance.
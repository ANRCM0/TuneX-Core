# HTTP Codec And Query Boundary V1

Date: 2026-10-19. Source candidate; unverified, not accepted.

`api/app.ts` now consumes public L2 HTTP codec bindings for request UUIDs, bounded
JSON parsing, observability/Runtime/Transit/Probe wire parsers and fatal UTF8 body
decoding. Route matching, middleware, certificate admission, scope/authentication,
body limits, error mapping and owner calls remain in the L3 HTTP composition.
No parser fallback, protocol version acceptance, network operation, authority or
feature enablement is added. Existing codec function identities and errors are
retained through direct compatibility exports.

The old generic pagination arithmetic is now L1 `pageWindow`; application
`consolePage` keeps its public name as a wrapper. API query adapters use the L1
helper while product filter vocabularies remain in the console owner. This removes
the generic API-to-application dependency without moving product filter policy.

Notification destination URL parsing is shared by L2 infrastructure and L3 value
compatibility as documented separately. Other HTTP query/filter/type and
management projection dependencies remain explicitly classified debt. The public
codec layer does not own routes, auth, response DTOs, application state or SQL.

Readiness item 43 is planned only. Exact codec identity/limits/error ordering,
fatal UTF8 behavior, body chunk handling, route/auth/protocol compatibility and
pagination defaults/offsets require frozen-source acceptance. No checks/tests/
type/syntax/boundary/format/build/network/MySQL/browser/container/CI/Git ran.

# Observability Value Codecs V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

The remaining observability value helpers now use public L2 compatibility bindings
for external/native effects. Notification destination URL parsing lives once in
`compatibility/native-notification-destination.ts`; the old application helper is
a compatibility re-export, and HTTPS sender/secret infrastructure consumes the
same public function. Its URL byte bounds, ASCII/fragment/query/userinfo/port,
hostname/IP/TLD/private-name refusal and canonical `URL.href` behavior remain
unchanged. It performs no DNS, network, secret or authority work.

Notification endpoint/delivery and station values use the original digest and
JSON/UTF8 byte semantics. Probe plan/run values use the original UTC parse/ISO,
JSON limits, canonical base64, staged echo invocation/frame/digest and service
selection functions. Probe run proof hashing still hashes the exact original frame
bytes; no echo execution or proof authority is added. Telemetry rollup values use
the same digest, time parsing, JSON byte encoder and deep-clone semantics for
series, samples and bucket updates. Product closed-object, state, quota, reason,
measurement, config, digest, lifecycle and arithmetic rules remain L3.

Compatibility exports are aliases to the existing contract/native functions or
small native projections. No new parser policy, normalization, schema, pool,
transaction, Runtime ledger, Agent authority, Journal, permit, sender, secret
storage, worker, feature default or protocol is introduced. Existing application
and infrastructure imports may continue through precise wrappers; the destination
URL implementation no longer makes application code an owner of the platform URL
parser.

Readiness item 42 is planned only. Exact URL/error/byte semantics, public function
identity, JSON/base64/UTC/frame hashing, clone timing, value validation order,
Probe/notification compatibility and no-network/no-secret behavior require frozen
source acceptance. No tests/checks/type/syntax/boundary/format/build/native PKI/
MySQL/network/browser/container/CI/Git ran. Other HTTP/query/path/Transit/Probe
owners, Agent native code and full repository classification remain open.

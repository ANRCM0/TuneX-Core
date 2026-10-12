# @tunex/contracts

ADP/2 direct wire messages only. The authoritative Schema lives in
`docs/protocol/schemas/adp-v2-direct.schema.json`; the TypeScript validator loads
it directly and the Go build embeds its checked generated copy and types.

Both parsers reject duplicate keys (including escaped duplicates), unknown fields,
unsafe or rounded integers, lone surrogates, excessive body/depth, inconsistent
JCS digests, resource conflicts, invalid CIDR networks and inconsistent reports.
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

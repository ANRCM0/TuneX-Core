# TuneX Secure Transport 1

Status: experimental implementation specification. TLS cryptography is Go's standard `crypto/tls`; the framing and stream protocol below are an independent TuneX design. No FXP interoperability is provided.

## Authentication

TLS 1.3 is mandatory and ALPN is exactly `tst/1`. Both endpoints present a leaf certificate chaining to the Link's configured CA. The peer certificate contains exactly the expected identity URI `urn:tunex:tst:w:WORKSPACE:l:LINK:n:NODE:r:ROLE`. Roles are `ingress` and `egress`. Certificate chain, validity, identity, TLS version and ALPN are checked before processing application bytes. No authentication failure permits plaintext fallback. Certificates have DNS SAN `tst-node-NODE.tunex.invalid`; URI identity remains authoritative. CA and private keys are confidential placement material, never part of public DTOs.

## Frame encoding

Every frame has a 20-byte big-endian header: type (u8), flags (u8, zero), reserved (u16, zero), stream/association ID (u64), payload length (u32), sequence (u32). Unknown types, nonzero reserved fields, illegal IDs or lengths close the connection. Data payloads are at most 16,384 bytes; datagrams are at most 65,507 bytes. Length is checked before allocation. Datagram sequence starts at one and is strictly monotone per direction; duplicates and backwards sequence are rejected, sequence wrap closes the association.

| Type | Value | Payload |
| --- | --- | --- |
| OPEN | 1 | at most 1,024 bytes of strict JSON `{forward_id,revision,protocol}`; Forward ID 1–2,147,483,647; revision 1–9,007,199,254,740,991; protocol `tcp` or `udp`; no target supplied by ingress |
| OPEN_ACK | 2 | empty; authorizes stream start |
| DATA | 3 | TCP bytes |
| FIN | 4 | empty; TCP half-close |
| RESET | 5 | bounded machine error code |
| DATAGRAM | 6 | one UDP datagram |
| WINDOW_UPDATE | 7 | u32 credit increment; stream zero updates connection window |
| PING | 8 | 8 opaque bytes, stream zero |
| PONG | 9 | same 8 bytes, stream zero |
| GOAWAY | 10 | bounded machine error code, stream zero |
| ERROR | 11 | bounded machine error code, stream zero |

Ingress allocates monotonically increasing odd stream IDs; IDs are never reused on a connection. Egress cannot initiate streams. At most 256 concurrent streams and 1,024 queued control frames are permitted; pending window updates for the same stream are coalesced. A stream begins opening, then authorized, then independently half-closed in each direction, then closed/reset. DATA/DATAGRAM before OPEN_ACK, duplicate OPEN/ACK/FIN, and protocol-mismatched payloads are rejected.

OPEN rejects duplicate or unknown JSON fields, missing fields, trailing JSON and nonpositive IDs/revisions. A business `both` rule creates independent TCP streams and UDP associations; `both` is not an OPEN protocol value. Non-DATAGRAM frames have sequence zero. A DATAGRAM has a nonzero sequence. Empty UDP datagrams are valid; WINDOW_UPDATE increments must be nonzero.

## State transitions and error scope

| State | Accepted event | Result |
| --- | --- | --- |
| TLS pending | Verified chain, exact identity, TLS version and ALPN | Authenticated carrier; otherwise close before frame processing |
| Opening | Authorized egress local snapshot, then OPEN_ACK | Active TCP stream or UDP association |
| Opening | Unknown rule, stale revision, missing protocol permission or target dial failure | RESET that stream; retain sibling streams |
| Active TCP | DATA within stream/connection credit | Buffer bounded bytes for the application |
| Active TCP | FIN | Remote write half closes; buffered data drains before EOF; local writes can continue |
| Active TCP | Both directions FIN, then local close | Release the stream and unread connection credit |
| Active UDP | Next exact sequence within byte/packet limits | Queue one complete datagram |
| Active UDP | Packet queue exhausted or association inactivity | RESET/release that association and return unread connection credit |
| Any stream | RESET, rule cancellation or local close | Cancel pending writes; buffered bytes already delivered before remote RESET may drain |
| Any carrier | Invalid framing/state/credit, I/O failure, GOAWAY/ERROR, certificate or placement expiry | Close carrier and all of its streams; fresh authorized carriers may reconnect |

Closed IDs remain historical. In-flight RESET/FIN/ACK/credit for an already closed historical ID is ignored; late DATA/DATAGRAM is discarded with only connection credit returned. Zero-byte late datagrams never generate a zero WINDOW_UPDATE. Unknown/future/even IDs fail the carrier. No closed ID becomes a new stream.

Public transport errors are `tst_protocol_error`, `tst_connection_closed`, `tst_resource_limit`, `tst_rule_unauthorized`, `tst_identity_invalid` and `tst_deadline_exceeded`. RESET uses bounded lowercase machine codes such as `tst_stream_closed` and `tst_resource_limit`; arbitrary remote payloads are not rendered as user messages. GOAWAY/ERROR terminate the carrier rather than promising a graceful drain.

## Flow control and scheduling

Initial per-stream byte window is 262,144; connection window is 4,194,304. Each DATA or DATAGRAM consumes both windows. Reading returns consumed bytes through WINDOW_UPDATE; increments are bounded by the initial windows. A sender waits for credit and honors write deadlines. Receivers retain bounded byte buffers; zero-length TCP DATA is invalid. The writer uses bounded queues and round-robin scheduling across stream IDs with a bounded priority batch for control frames. Frame writes have a connection deadline so a silent peer cannot strand shutdown indefinitely. TLS/TCP carries UDP, so UDP traffic experiences TCP head-of-line blocking and is not QUIC.

Each transport association queues at most 64 datagrams in addition to its byte window. Overflow resets only that association, returns discarded connection credit, and preserves sibling TCP/UDP streams. The ingress client queue holds four packets per association and drops excess queued packets. Production UDP association expiry is 60 seconds without activity in either direction; successful one-way requests or replies keep the association active.

## Runtime admission limits

Each egress placement admits a burst of eight attempted TLS handshakes and refills four attempts per second. Every accepted socket consumes this budget before TLS, including failed authentication. At most eight handshakes execute concurrently, each with a five-second deadline. A placement permits four authenticated carriers and 256 business flows across its rules; each carrier independently caps streams at 256. Rule quotas can impose lower admission limits. Configured TST connection/IP quotas are bounded at 4,096; this does not raise placement or carrier caps. A placement snapshot contains at most 500 bindings. These bounds apply per placement, so deployments still need host/network admission against distributed traffic.

## Authorization and lifecycle

Egress validates every OPEN against its local deployed snapshot: Workspace/Link identities authenticated by the certificate, Forward ID, rule revision and permitted TCP/UDP protocol. It dials only the authorized locally configured target. Authentication never grants arbitrary target access. Changed/removed/suspended rules revoke their own streams; unrelated rules remain active. Placement generation and rule revision are independent: a carrier lease renewal must not invalidate unchanged streams.

Manager applies only matching node/Workspace/Link/role placements, checks canonical configuration digest, stores durable generation fences and refuses stale, conflicting, expired or regressing leases. Removed placements retain a tombstone. Private cached placements can restore only while their leases remain valid; authenticated authoritative empty state removes obsolete listeners. Expiry closes listeners, sessions and datagram mappings. Endpoint/certificate changes may interrupt the whole Link and must be identified as such.

Two authenticated paths may deliver the same generation in a different order. An active placement receiving an identical fingerprint with a shorter but still-valid lease acknowledges its existing longer lease without changing state or restarting streams. It never persists the shorter deadline. Expired lease messages, different content at the same generation, older generations and deletion tombstones remain rejected. Controller lease writes also retain the maximum observed deadline.

## Certificate policy

Panel issues short-lived per-Link/per-role certificates from a sealed CA; snapshots deliver material over the authenticated control channel. Leaf expiry and lease expiry independently fail closed. Revocation uses retirement/rotation plus generation replacement; this release does not claim online OCSP. Replacement keys establish new TLS sessions; old sessions are terminated at their bounded authorization/lease lifetime. Private persisted files use mode 0600 and directories 0700 where supported. Errors are machine codes without targets, PEM, raw payload or arbitrary executable output.

## Threat model and release gate

Threats covered by tests include foreign CA/identity, wrong Workspace/Link/role, expired certificates, ALPN downgrade, arbitrary target requests, stale rules, replayed IDs/datagrams, oversized/truncated/unknown frames, resource exhaustion, shared-rule disruption and old cached listeners. TLS protects integrity, confidentiality and transport replay; sequence validation is an application association fence, not a new cipher. Malicious authenticated peers can consume their bounded connection allowance; deployment must constrain peer counts and handshake rate. The first release remains disabled by default until independent security review and Linux deployment evidence are completed.

## Independent vectors

PING with eight zero bytes encodes header `0800000000000000000000000000000800000000` followed by `0000000000000000`. FIN on stream one encodes `0400000000000000000000010000000000000000`. Tests must use these literal vectors and exercise length/truncation rejection rather than deriving expected bytes from the encoder.

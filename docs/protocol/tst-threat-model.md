# TST/1 threat model

Status: implementation review document, not external audit approval.

## Assets and trust boundaries

Assets are payload confidentiality/integrity, scoped rule authority, private
certificates/keys, port ownership, generation fences, leases and deduplicated
usage facts. The Panel is the desired-state authority. The authenticated Agent
control channel conveys immutable placement authorization. The egress accepts
only the opposite configured identity and dials targets from its local snapshot.

A Workspace member controls permitted business fields, not transport credentials.
An administrator can authorize nodes and maintain resources. A compromised
authorized ingress can originate traffic for its granted rules; mTLS does not
protect against a compromised endpoint or Controller. Host administrators can
access service secrets and private state. Target services and the data network
are untrusted with respect to carrier confidentiality.

## Threats and controls

| Threat | Control | Regression evidence |
| --- | --- | --- |
| Passive interception/active mutation | Standard TLS 1.3 authenticated encryption; no plaintext fallback | tls_test.go and real payload runtime tests |
| Foreign CA/node/Workspace/Link/role | Verified chain, one exact URI SAN, DNS SAN, mTLS, exact ALPN | TLS identity negatives; runtime placement identity tests |
| Downgrade/version confusion | TLS min=max1.3; exact tst/1; unknown frames/reserved bits rejected | TLS ALPN/version negatives, frame vectors |
| Ingress chooses arbitrary target | OPEN strict schema with no target; egress local Forward/revision/protocol authorization | decodeOpen negatives; unauthorized runtime OPEN |
| Replay/cross-session ID reuse | TLS record protection; increasing odd IDs; exact per-association sequence; no early data | duplicate OPEN/datagram and old revision tests |
| Truncation/oversized allocation | 20-byte header, per-type preallocation bounds, exact required fields | frame negative tests; FuzzReadFrame |
| Unlimited buffers or starving sibling | stream/link windows; bounded stream, packet and control queues; round-robin scheduling; UDP packet overflow resets only its association | blocked-stream deadline; 65 empty datagrams with held sibling TCP; late empty datagram regression |
| Handshake/connection exhaustion | per-placement attempt burst8/refill4 per second before TLS, concurrent handshakes8/deadline5s, authenticated sessions4, business flows256 | budget/refill and real accept-path tests; host network admission still needed |
| Credentials expire while connected | local/peer certificate expiry plus independent placement lease deadlines close sessions | local/remote certificate lifetime and lease-expiry tests |
| Late apply resurrects deleted rule | durable generation tombstone; digest and revision checks | cache/remove/reapply and failed-update tests |
| Shared A edit/removal stops B | per-rule authorization cancellation and snapshot diff | held B TCP and fixed UDP mapping tests |
| Cache tampering/foreign identity | AEAD envelope bound to Agent; private mode/ACL, no symlink/oversize acceptance | private-cache integrity and owner tests |
| Repeated usage acknowledgment bills twice | stable producer/rule/day identity and transactional checkpoint delta | Agent ACK and backend Link traffic regressions |
| Public errors leak configuration/key | closed DTO projections, bounded machine codes, no raw frame/PEM logs | DTO/error redaction and public integration checks |

## Residual risk and required external review

An authenticated malicious peer can consume its bounded resources and intentionally
terminate its carrier. Per-placement handshake admission does not constitute a distributed
rate limiter: deployments must constrain trusted peers and apply host admission
controls. TLS/TCP UDP suffers head-of-line blocking. Crash-time not-yet-persisted
traffic is not exact financial accounting. Clock skew can reject otherwise valid
certificates; hosts need reliable time. This release has no OCSP/CRL endpoint;
revocation is bounded by identity replacement, authorization removal and lease.

Reviewers must inspect races around OPEN_ACK, RESET/FIN, credit reclamation,
expiry/rotation and rule revocation; sustained malicious/control-frame loads;
certificate issuer and sealed storage; TOCTOU/private filesystem behaviors; and
Controller transaction/executor fence lifetimes. Run Linux race/fuzz/network
partition/restart/port-exhaustion and installation/rollback tests. Internal peer
review is recorded separately; no external approval is inferred from green tests.

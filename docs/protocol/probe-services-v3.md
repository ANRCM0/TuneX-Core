# Service-Bound Probe Machine Messages v3

Date: 2026-10-18 (Asia/Shanghai). Local source implementation, unverified.
[Closed Schema](schemas/probe-services-v3.schema.json).

## Separate Version And Bounds

protocolVersion remains 3; probeVersion is explicitly 3. This new family uses
/agent/v3/probe/services/{instance,poll,claim,status,result}, with corresponding
probe-services-* request/ack kinds. All v1/v2 machine contracts stay unchanged;
no new TLS offer goes to an old parser and no failed v3 exchange falls back to
another version's execution. A qualified original Gate/instance generation serves
all three types through ONE poll; no additional permit/admission budget or loop
is created by the wire contract.

Qualification and poll require exactly this ordered tuple, not an arbitrary set:
tcp-connect-v1, tcp-ingress-connect-v1, tcp-ingress-tls-v1. Identity is the original
node/boot/session/instance/instanceGeneration/requestId with positive safe counters,
64-lowercase-hex instance/request IDs and exact response echo. Qualified interval
remains positive and at most 30 seconds, bounded by serverTime before expiry;
qualification is not a reusable grant or renewal of original instance authority.

Messages are closed JSON, rejecting duplicate/unknown keys and invalid numeric
values. PollResponse alone may be at most 32768 UTF-8 bytes to carry one public
leaf context. Other requests/acks remain at most 4096 bytes. A normalized full
service context is at most 16384 bytes; its public certificate is at most 8192
decoded bytes. No unbounded certificate chain, secret or arbitrary header exists.

## Measurement Descriptors

Each single task carries exactly one matching descriptor:
- tcp-connect-v1 / taskKind tcp-connect / point agent-direct-egress /
  capability probe.tcp-connect.v1.
- tcp-ingress-connect-v1 / taskKind tcp-ingress-connect /
  point agent-local-direct-ingress / capability probe.tcp-ingress-connect.v1.
- tcp-ingress-tls-v1 / taskKind tcp-ingress-tls /
  point agent-local-direct-ingress / capability probe.tcp-ingress-tls.v1.

Offer contains descriptor, permitId, original complete ProbeClaimBinding, timeout
100..2000 milliseconds, issuedAt/expiresAt and serviceContext. Old two measurements
require serviceContext:null. TLS requires the complete context described next.
Binding node/boot/session matches outer identity; permit lifetime is positive and
at most two seconds. Poll/status observations remain at most 250 milliseconds old
at serverTime and strictly before task expiry, not a lease or real-time guarantee.

## Service Context And Compact Selection

Compact service selection is exactly {scopeId,serviceId,revision,configRevision,
configDigest,contextDigest}. revision is the CURRENT metadata CAS, not the immutable
configRevision (1..64); metadata revision cannot be less than configRevision.
Scope uses the original ID syntax; service ID is safe 1..64 characters with letters,
digits, dot, underscore or hyphen, no colon. Both digests are lowercase sha256:hex.

Full context extends that selection with config, exactly the registry configuration:
version:1, purpose:direct-ingress-tls-handshake, endpoint:{address,port},
trust:{mode:pinned-leaf-v1,serverName,certificateDer}, validFrom/validUntil.
Endpoint is a canonical numeric address/valid port without zones, wildcard, mapped,
multicast, link-local or prohibited metadata addresses. serverName is lowercase
multi-label DNS, not an IP or a DNS lookup target. CertificateDer is one canonical
base64 public value <=8192 decoded bytes. Numeric epoch-millisecond window has a
positive span <=7days; offer issuance/expiry must fit that declared window.

configDigest is digest(config). contextDigest is digest({scopeId,serviceId,revision,
configRevision,configDigest,config}), excluding its own contextDigest field. Parsers
check structure, bounds, base64 and these two digests ONLY: they do not parse X.509,
query current registry/manager/Node Grant, resolve DNS or validate a remote peer.
Those owners must supply/check actual current authority and dedicated leaf trust.

Claim/status/result requests and acks use service:compactSelection for TLS, null
for the old two measurements. They never repeat the public DER. Every response
echoes exactly the same selection/context identity, descriptor and correlation;
these compact values remain bound into the actual v3 result body/digest. A matching
digest is content identity, not proof that old metadata is still authorized.

## Result Semantics

All results preserve original binding/timeout/issue/expiry/consumption, measuredAt,
validUntil, elapsedMs, applicationHealth:unknown, source:agent-reported and
applicationPayloadBytes:0. Measurement time follows consumption; validUntil is
after measurement and at or before expiry; elapsed cannot exceed timeout. TLS
elapsed includes TCP connection plus handshake, not only the dial. TLS wire bytes
can traverse the business Forward even though no TLS application data is sent.

Old two measurements keep only connected/tcp-connected or
unreachable/tcp-connect-failed, with service:null and tls:null. TLS result permits
exactly three outcomes:
- verified/tls-handshake-verified with tls:{version:TLSv1.3,
  alpn:tunex-observation/1,leafFingerprint:sha256:hex,verified:true}.
- unreachable/tcp-connect-failed with tls:null for an actual dial failure.
- unverified/tls-handshake-failed with tls:null for an actual handshake failure.

Cancellation, deadline/clock uncertainty, authority loss and missing measurement
must not be manufactured as a target/handshake failure. A successful result parser
cannot compare leafFingerprint to an absent full context; the existing client/
permit-result owner must compare it to the exact issued/validated leaf. Actual
socket target remains the current original Forward ingress, not a direct dial to
the context endpoint that bypasses the Forward.

probeServicesResultBody/ResultBody removes only requestId. Digest covers the actual
v3 kind/version, descriptor, compact service, TLS evidence and all original result
facts; it is never converted to a v1/v2 result first. Acknowledgement checks exact
identity/selection/descriptor/digest, acceptedAt after measurement and acceptance/
serverTime strictly before validUntil. Acknowledgement is non-executable and
health remains unknown, not application correctness or external reachability.

## Implementations And Evidence

TypeScript exports parseProbeServices/checkProbeServices, parseProbeServiceSelection,
parseProbeServiceContext, probeServiceSelection and result body/digest helpers.
Go probeservices exports matching ParseX/CheckXResponse/ResultBody/ResultDigest,
ParseServiceContext/ParseServiceSelection (also ParseSelection), and
SelectionFromContext as a copy from a context already validated by the parser.

Current manager/service head/config/digest/window, original Node Grant/policy,
qualification, one-use Gate, live watch, timing and peer trust remain actual owners'
responsibility. This protocol source alone authorizes no work or change of target.
No tests, static/type/syntax checks, scripts, generators, formatters, fixtures,
network/CI, commits or pushes performed. Functional/interoperability/physical and
production acceptance remain unverified.

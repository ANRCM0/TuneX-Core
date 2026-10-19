# Agent Probe Native Boundary V1

Date: 2026-10-18. Status: source candidate; unverified, not accepted.

## Native Public Entries

Existing L2 nativeexecution now supplies three original native projections:

- DirectProbeDestination performs the old phase/protocol/schema, computed config
  digest, Direct conversion, egress-policy revision and target-port checks.
- ProbeIngressEndpoint compares configured/current observed numeric endpoints and
  original zone/unmap/port/multicast/link-local/egress-policy restrictions.
- ProbeServiceDestinationAllowed restricts the declared observation service to
  the original numeric business destination and original address/egress policy.

ProbeDestination is detached decoded native configuration, not a live-instance
proof or permit. Runner keeps the original closed protocol check, binding Node/
boot/session/Journal generation, Guard/Ticket, exact single live assignment,
stream/ticket and assignment tuple checks before native projection. It still
computes ticket deadlines and clones destination CIDRs at the original return
point. Observed ingress checks run before native endpoint parsing, and target
resolvers keep their original mutex, current pointer and callback rechecks.
All native projection failures still map to Probe's original ErrDenied.

The native helpers receive no Runner, Journal, Gate, permit issuer or authority
store. Successful native decoding never permits execution. The existing typed
driver still supplies current-instance observation; no target override, alternate
listener, business-target fallback, network attempt or new capability is added.

L2 observationtrust declares interface version 1 and now also owns the original
native bounded handshake through Trust.Handshake. Its public Context/Trust/New/
Current/VerifyConnection API and native checks stay in this owner. The old
probe.handshakeService remains a bridge with its original signature and denial
error; errTLSBudget aliases the one lower budget error. No native implementation
is copied into a second helper. These interface declarations do not change wire,
ALPN, leaf trust, schema, role/phase or feature versions.

## TLS And Resource Lifetime

The handshake accepts only an already-connected caller socket. It preserves the
existing context-deadline and callback check, raw SetDeadline, cancellation-driven
raw close, independent 32768-byte RX/TX wire budgets, TLS 1.3-only range, exact SNI/
ALPN/public leaf/purpose verification and native time-read locations. No application
read/write, CA fallback, session resumption permission, retry or second dial is
introduced. The existing explicit pin verifier remains the reason native TLS uses
InsecureSkipVerify; it does not disable identity validation.

After the handshake the original callback/context/deadline/budget check still runs.
Timeout, uncertainty, missing verification and exhausted budget remain denial;
other handshake failure remains nil evidence with no error, yielding the original
unverified result. The Probe bridge retains its original ErrDenied identity. The
caller still owns deferred raw close. Gate replay burn, shared process admission,
25ms authority monitoring, watch state, claim/result/report-once, counters and
freshness projection are not moved or reset.

## Remaining Source Debt And Acceptance

This removes actual native configuration/address work from Control and TLS
implementation from Probe. It does not certify all Probe or Control as separated:
the executor/Gate still contain native dial/time/entropy/address/echo dependencies,
product binding and wire interactions. observationtrust owns only its explicit
native public trust/handshake APIs, not a new authority or generic framework.
Native engines/wire and remaining private compatibility/source classification
still require work. Existing incomplete echo stays unchanged/default-disabled.

Readiness item 33 requires exact frozen-source equivalence for error and validation
order, wrong/current/stale binding or instance, detached destination/CIDRs, address
policies, native trust/TLS budgets/cancellation/deadlines, unknown versus denial,
raw socket lifetime and original Gate/watch/one-use/report behavior. Functional
native PKI/network/Windows/Linux evidence belongs in authorized Actions, not local
experiments. No checks/tests/gofmt/build/PKI/network/CI ran for this extraction.
Full foundation and parallel-development acceptance remain unmet.

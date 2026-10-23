# Native Execution Adapters v1

Source candidate, unverified. InterfaceVersion is 2 (FR-0024 native credential
response binding); process-local HostVersion remains 1. ADP/3, native assignment
schema 1 and Relay/multihop wire dimensions are unchanged.

Direct, Relay and Multihop export the original compiled driver implementations
through the existing executiondriver typed binding. ADP/native config conversions,
forward TCP/UDP starts/replacements, Relay preparation/activation/drain/cleanup,
connection/session clamp, observations and error/retry classification have one
implementation here. Old private Control helper names delegate rather than copy it.

These L2 adapters consume only the existing execution inputs, native engine/public
contract APIs, authorization callback and injected executionhost.PayloadGate.
They do not receive Runner/Journal/authority/permit state. Factory and start APIs are trusted internal adapter APIs,
not permission for a feature to bypass original execution acceptance or to create
another composition/authority root. The check remains required throughout I/O;
native engines retain their existing implementation and failure preconditions.

Platform discovery belongs to executiondriver's actual-OS binding, never a remote
capability or non-authoritative observation. The shared-resource-limits.v1
capability is an optional payload-enforcement declaration on all three native
drivers. No new role, phase, protocol, Probe path or echo composition is added.
Remaining native engine/wire internals and Control/Probe/CLI coupling are separate
classification work, not certified wholesale by this move.

See docs/development/foundation-readiness.md item 29 and
docs/architecture/agent-execution-host-v1.md for pending acceptance.
No code/behavior/platform compatibility is accepted from source
closure alone; no checks/gofmt/tests/build/network/CI or Git mutation has run here.

The original native Probe destination/config/digest/policy and observed endpoint
parsing now also lives here. Those helpers receive no Runner/ticket/Journal/permit;
their decoded output is not authorization. Runner retains every live binding,
closed protocol, Guard/Ticket and exact current-instance check, deadline and CIDR
copy. Native handshake/trust stays in observationtrust; the Probe bridge preserves
its old error/lifetime. See agent-probe-native-boundary-v1.md and item 33, unexecuted.

The additional legacy_registry.go contains the original private Runner header and
native declaration prechecks, deliberately split around Runner's original
duplicate-ID check. The old strict public registry still validates last; native
prechecks neither replace it nor weaken its bounded descriptor requirements.
Echo business/observed ingress numeric adapters preserve their separate original
protocol/address/policy/port refusal order instead of reusing the different plain
ingress predicate. See agent-probe-native-owner-v1.md for these source chains,
remaining mixed wire/default work and unexecuted acceptance cases.

FR-0032 payload integration binds Host.Payload before Direct listen or Relay peer
listen/activation. StartDirectMetered, forward.StartAuthorizedMetered,
forward.StartUDPAuthorizedMetered, relay.PrepareMetered and
relay.PrepareMultihopMetered retain their original host gate for the instance's
entire lifetime. The old Start/Prepare entrypoints explicitly pass nil for
unmetered inputs. Hostless Direct replacement refuses a metered old instance;
Runner owns close/start when the assignment or immutable bucket binding changes.
SetAuthorization renews the original authorization without replacing its gate.

Direct TCP/UDP and Relay ingress/egress charge application payload before the
socket write in each direction. Multi-hop transit charges the decoded payload at
one outgoing write per direction. TCP may split an allowed prefix across payload
frames; UDP must reserve the entire datagram. Empty UDP still calls
Acquire(ctx, 0, true), so the durable owner checks its period, zero rate and
exhausted quota before allowing the datagram. TLS records, frame headers,
Open/Accept, activation probes and FIN/Close consume no payload. Failed writes
retain conservative debit; original operational telemetry counts actual written
bytes and remains ingress-only for Relay. No private billing state, durable
balance, authority, Journal or Runtime ledger is owned here.

Rate waits receive the instance/session cancellation context and recheck original
authorization after acquiring credit. UDP waits hold no listener/session locks.
Original idle, peer credential, lease, drain and shutdown limits remain in force.
The new payload gate/dispatch tests and metered Relay test helpers are authored
only; no formatter, syntax/type/static check, tests, build, network experiment or
CI has executed for this change.

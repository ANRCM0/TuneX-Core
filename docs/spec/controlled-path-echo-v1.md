# Controlled Forward Path Echo

Status: P source candidate, unverified. See FR-0036 and FR-0039.

An explicit `tcp-path-echo` or `udp-path-echo` command uses the existing Forward
Probe command URL, revision, service reference, request key and bounded timeout.
The distinct measurement ends in `-v1`, capability is `probe.<kind>.v1`, and point
is `agent-local-forward-ingress`. Direct kinds retain their Direct point. A path
command requires an enabled Relay/multihop Forward and a numeric final target
exactly matching the current controlled Echo service declaration.

Control opt-in is `TUNEX_PROBE_PATH_ECHO=1`, with `TUNEX_PROBE_ECHO=1` and the
existing services/ingress/execution and synchronized-clock requirements. Agent
opt-in is `--probe-path-echo`, with `--relay --probe-echo --probe-services
--probe-ingress --probe-execution --probe-registration`. Multihop also requires
its existing opt-in and release gates. All new flags default off. Opt-in is
configuration, not evidence of qualification, execution or network success.

The v4 extension accepts the unchanged five-measurement list or exactly that
ordered list followed by `tcp-path-echo-v1, udp-path-echo-v1`. The latter requires
both explicit path capabilities during qualification. Poll responses may offer
only a measurement in the request list. Original same-slot Echo qualification,
expiry and revocation stay necessary; path capability is rechecked at issuance,
claim, status and result. An old v4 closed reader refuses new descriptors/lists.
No v1-v3 endpoint consumes path permits, and no Direct downgrade is performed.

The complete owner chain is:

1. Original Forward read ownership and manager authorization, exact desired
   revision, enabled/non-suspended intent, controlled-service reference.
2. Public Node role authorization for every route member; original Relay
   `assignments` reads the same publishable plan, grants, current credentials,
   endpoint/Profile pins and original Runtime ledger. Locking published readers
   run in the original permit transaction. Every node has exactly one matching
   active published assignment for the requested protocol, with the same route
   revision, deployment/config/fence and current session. The shortest credential,
   Snapshot or service lifetime narrows the original two-second permit bound.
3. Original bounded permit budget/qualification, one-use claim and revalidation.
   Agent's original Runner binding/ticket checks select its actual current engine.
   Native listener observation reads the current active non-draining TCP/UDP
   socket, retaining socket identity and authorization checks. Agent dials this
   numeric ingress only. The ingress policy must explicitly allow that local
   address; final egress policy remains with the original forwarding engine.
4. Original forwarding engines carry the fixed nonce request through their
   existing payload gates, peer credentials, deadlines and final egress policy.
   The registered responder signs the service/nonce/invocation-bound response.
   Original result verification recomputes proof and reauthorizes the entire
   route. Lost/late/failed work never refunds the original issuance reservation.
5. Original permit, result and bounded history owners persist observations;
   migration 0045 extends their enums/checks. The console distinguishes the local
   path observation point from Direct and passive diagnostics.

The 256-byte request/response and their overhead consume real payload and original
UDP associations. Closing a Probe socket does not shorten the original business
association idle lifetime. There is no reserved Probe quota or new engine.
Success proves a controlled round trip from the Agent-local ingress to the exact
declared service at the captured binding/time. It does not prove public client
reachability, arbitrary application health, future availability or capacity.

Upgrade Control and SQL to `adp3-path-echo-v1` (ceiling 0045), and upgrade/enable
Agents and closed clients before path issuance. Agent Journal format and its
original runtime/multihop/shared-resource profile remain unchanged. Disabling a
flag neither erases history nor permits an old schema reader to open newer state.
Tests, generated parity, actual TLS/network/MySQL/browser and independent-host
acceptance remain unexecuted for this candidate.

The integrated P build also contains FR-0040 schema0046 for recent path sample
alerts. Use its adp3-path-sample-alert-v1 Control profile for the complete candidate;
0045 is the minimum slice profile, not the final integrated database footprint.

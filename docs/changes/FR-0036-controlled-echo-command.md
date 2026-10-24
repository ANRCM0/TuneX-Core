# FR-0036: Controlled Echo Command And Original Permit Owner

Date: 2026-10-24. Status: Actions contract/native scope verified at `aae0632f`; independent-host/load/long-run unverified.
Authorization: P implementation request and 2026-10-19 standing source decision.

1. Layers: L3 Probe command, qualification and original permit lifecycle; L2
   native version-4 HTTP projection and existing Agent executor/codecs.
2. Consume ProbePermits1, original instance/qualification stores, observation
   service public resolver, existing staged/probe-echo wire and proof primitives.
3. Additive source contracts and an explicit Control feature switch. No L0,
   Runtime ledger, Journal or execution authority changes. Existing migration
   0037 already has echo qualification, challenge and history storage fields.
4. Add ProbeEchoRegistry/ProbeEcho public APIs, original permit `echo` mode and
   challenge-bound claim/check/result. Commands accept TCP/UDP ingress echo only
   when enabled, with exact registered service, current v4 qualification and
   original cooldown/budget/deadline. Existing non-echo defaults remain closed.
5. Author issuer, qualification, claim/check proof mismatch, reauthorization,
   replay, rollback, expired/withdrawn policy, Web and native Agent cases. Tests,
   builds, generated checks and Actions are unexecuted in this source phase.
6. Serial changes to shared Probe public interfaces, Control startup/composition,
   HTTP substitutions, support display and examples. No parallel feature gate.

## Decision And Compatibility

Planner and Agent already know nonce Echo but the original Control command does
not issue it and has no version-4 machine routes. Finish the original owner chain:
manager command -> exact service/Forward plan -> same permit budget transaction ->
random 32-byte challenge bound to immutable invocation -> original Agent instance
and v4 qualification -> discovery -> one-use claim -> bounded authority watch ->
nonce proof -> original result/history transaction. No standalone executor/store.

The new `TUNEX_PROBE_ECHO=1` also requires original execution/ingress/services flags.
Old Control startup and direct constructor shapes keep echo disabled. Original
v1-v3 machine routes exclude Echo records; they cannot downgrade a v4 permit.
Qualification uses existing echo_version=1 plus services_version=1 and the same
original slot, instance high-water, expiry, fingerprint and revocation tombstone.
Proof/challenge/service context are checked before consuming and on every status
and result. No claim refunds, deadline extension or relaxed clock skew.

The measurement point remains agent-local-direct-ingress. This only proves the
bounded controlled request/response on that Direct binding; it does not establish
external public ingress or arbitrary application health. Relay/multihop needs an
explicit successor measurement and binding rather than reinterpreting this point.

Probe owner version 2, command API 3, module 4 and machine API 2; HTTP version 5
describes new required collaborators. Old aliases remain bound to original owners;
native composition injects the same service resolver for both TLS and Echo. Old
qualification readers must migrate to echoVersion; stored records are not erased
to permit downgrade. Existing schema/profile ceilings stay unchanged.

Source cases and future exact-source Actions/physical proof are separate. Keeping
the staged codec export until acceptance records preserves its unfinished status;
new routes do not by themselves assert acceptance or authorize publication.

Actions found that enabling v4 allowed original connect tasks to execute but the
Agent's result builder required nonce context for every measurement. The private
`probeV4ResultWith` now retains original connect, ingress-connect and pinned TLS
validation on that same negotiated wire; it delegates nonce kinds to the original
`probeEchoResult`. The L2 `ProbeEchoResultWithTLS` projects only supplied evidence;
`ProbeEchoResult` keeps its original signature as the explicit compatibility entry.
No route downgrade, new authority, extra clock owner or relaxed deadline is added.
TCP unreachable Echo results also retain their existing closed v4 classification.

## Verification Update - 2026-10-24

The current [P verification record](../development/product-verification-p-2026-10-24.md)
binds executed contracts, native MySQL and hosted-runner functional evidence to
`aae0632f20c1ffc333433b67c72beafc29605e2a`. Earlier planned/unexecuted
wording in this source proposal records its authoring snapshot. Whole-workflow
conclusions and independent-host/load/long-run limits remain in that record;
this update does not open merge, publication, release or parallel-feature gates.

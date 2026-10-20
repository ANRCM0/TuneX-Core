# Agent Native Engine Owners v1

Date: 2026-10-19 (Asia/Shanghai). A4/A5 source candidate, authored and unverified.
This source slice does not accept the foundation, native execution or physical
hosts. No Forwardx implementation or assets were copied.

## Actual Native Owners And Public Consumers

| Source owner | Native dependencies and owned state | Public entry/consumer chain |
| --- | --- | --- |
| forward/tcp.go | net/context/time, native contracts assignment/policy, private slot/config, per-listener and process TCP permits, original authorization and payload writer | Start/StartAuthorized, TCP.Replace/ReplaceAuthorized, Close/Drain/Remaining/SetAuthorization; nativeexecution.Direct/StartDirect/ReplaceDirect |
| forward/udp.go | UDP listener/association/DNS/dial/time, immutable config, original global UDP permits, bounded queues/credits and drops | StartUDP/StartUDPAuthorized, UDP replacement/lifecycle/Stats; same nativeexecution Direct adapter |
| forward/budget.go | original tcpNodePermits/udpNodePermits channels, idempotent release | AcquireNodeBudget consumed by Relay acquireNode and existing Transit; not another budget |
| forward/tcp.go Allowed | native DirectConfig policy projection -> egress.Allowed | Existing public Allowed retained for Direct and existing Transit callers |
| forward/authorization.go | private callback lock, read-before/read-after and write-before gating | Engine internal, no authority issuer; Runner-supplied callbacks remain original |
| forward/probe_ingress.go | actual socket inspection and slot-pinned current ownership/policy callbacks | TCP/UDP ObserveIngress -> nativeexecution Direct Probe observation; metadata grants no permit |
| relay/engine.go | TLS/socket/DNS/context/time/entropy, checked assignment, original identity, instance/peer/session maps, original nodeConnections and shared Forward permits | Prepare, Engine Activate/Close/Drain/Remaining/Rejected/SetAuthorization/PayloadCounters; nativeexecution Relay/Multihop adapters |
| relay/native_configuration.go | original JSON immutable Hop copy, profile conversion, neighbor/role/config/digest/synthetic native assignment | Private projectMultihop called only by same-owner PrepareMultihop after its original checks |
| relay/multihop.go | public ADP validation, local fingerprint, path/edge binding/digest, neighbor TLS, native framed forwarding, original IJSON/open projection | PrepareMultihop; same Engine lifecycle; no new public route or protocol |
| relay/tls.go | TLS1.3/x509/URI/ALPN/fingerprint checks, cloned roots/pins, native verification time | TLSConfig/VerifyPeer/Fingerprint and ALPN; consumed by Agent identity and existing Transit; multihop uses same-owner protocol variants |
| relay/wire.go | bounded binary headers, JSON/IJSON/schema, original ReadFull/writeAll, frame flags and Open callback order | Read/WriteControl, ReadReply, Read/WriteFrame, ValidateOpen/constants; Engine and existing Transit frame consumers |
| relay/frame_connection.go | same private TLS connection, serialized writes, read buffering, FIN and check callbacks | Engine's private TCP bridge; not an independent execution owner |
| relay/udp_engine.go | same Engine associations, queues, idle/credit/deadline/peer checks | Engine internal, existing shared admission and close/wait order |
| payloadstats/snapshot.go | original detached Snapshot declaration, no native imports or writer handle | Existing `(payloadstats.Snapshot, bool)` read signatures on TCP/UDP/Engine; Control forward_counters consumes the same type |
| payloadstats/counters.go | original random epoch, atomic saturating counters/overflow and nil-unavailable behavior | New and Counters methods consumed by Forward/Relay only; public reads do not issue identity/health/billing authority |

These engine/wire implementations are L2 native adapters, not a generic pure Core.
Native ADP/contracts/relaycontracts and egress are their explicit current source
dependencies. Declaration placement alone does not accept every contract package
or private type reference. No package-wide exception is inferred for new imports.

## B Verification Repair

The 2026-10-19 B audit found that `payloadstats.New`'s documented returned-error
branch was unreachable through Go 1.26 `crypto/rand.Read`, which terminates the
process when an overridden Reader returns an error. The implementation now uses
`io.ReadFull(rand.Reader, epoch[:])`, preserving the same 16-byte source and hex
epoch while returning nil for a returned reader error or incomplete epoch. It
does not substitute weak randomness, retry, issue authority or change forwarding.
The default operating-system reader can still terminate on its own unrecoverable
failure; this repair makes no broader recovery guarantee. An Actions regression
covers successful, partial and failing readers and detached/saturating snapshots.
This restores the existing diagnostic nil-unavailable contract and adds no new
public interface or source fallback. Exact-source execution remains required.

## Actual Source Change

The original multihop conversion body moves from PrepareMultihop into its private
same-owner native_configuration.go. It still JSON-clones the Hop before reading
local/edge/role fields; converts Profile via the same JSON path; constructs the
same binding, upstream/downstream pin, peer endpoint or target and copied CIDRs;
computes the same native config digest; and builds the same prepared synthetic
native.relay.v1 assignment. No conversion or engine code is duplicated.

PrepareMultihop retains nil/path/index validation, the original ADP validator,
optional local leaf parse and local fingerprint check before the conversion.
Conversion errors still return before prepare; prepare receives the same owned
Hop and synthetic assignment. No roots/policy/authorization checks are moved
ahead of the original local fingerprint failure. The helper stays private and
has no independent caller, clock, socket, callback, state writer or issuer.

Relay dialTarget now directly calls the already-public egress.Allowed numeric-IP
policy function with the exact config CIDRs and allowMetadata flag. Previously
it built a DirectConfig solely for forward.Allowed, whose body immediately called
that same function. DNS enumeration, Allow short circuit, e.check evaluation,
numeric dial, post-dial close/refusal and final TARGET_UNAVAILABLE/REJECTED order
remain in place. This removes cross-engine configuration coupling without adding
a wrapper or changing the public Forward Allowed entry used by other callers.

The original Snapshot declaration moves verbatim to payloadstats/snapshot.go
within the same package; import path, Go type identity, fields and engine method
signatures are unchanged. No second snapshot/counter, entropy call or read wrapper
is introduced. Existing Control structural read and tail retention need no source
changes. Native mutation remains in counters.go, separate from the public read
shape. No new public method/provider/version or frozen semantic change is needed.

## Preserved Budget, Default And Lifetime Ownership

Direct TCP's process channel remains in Forward with capacity 4096, including
connecting/draining instances. Listener replacement keeps the same shared
per-listener permits. UDP's process channel remains the same 4096 associations
and survives instance replacement; old associations are canceled and reclaimed
through the same close/wait path. Relay retains its original nodeMutex/count gate,
then acquires Forward TCP and, for UDP, Forward UDP in that order. UDP admission
failure still releases TCP immediately. Successful release still runs once,
releases both permits and decrements the original node count. Transit continues
to consume that same public budget; it is not edited in this slice.

Direct optional-nil authorization remains original compatibility behavior; Relay
still requires a non-nil callback. Direct starts check before bind and after bind,
closing a partially opened listener on refusal. Relay prepare still validates
strict assignment first, then roots/prepared/maximum/callback, authorization and
local identity, clones roots, creates the original Engine, and closes/cancels on
partial listener failure. Native defaults/time reads and guard tickers stay in
their original owner statements. No startup or clock is injected through the
new conversion helper.

TCP replacement/Drain keeps slot linearization and predecessor streams; UDP
replacement/Drain retains its deliberate cancellation semantics. Relay TCP drain
keeps its native deadline and callback freeze; Relay UDP drain still closes.
SetAuthorization/check/peerCheck, 25 ms watcher, native certificate expiries,
socket close, wait and guardDone order are untouched. TLS roots/pins cloning,
exact URI and fingerprint checks, separate Relay/Multihop ALPN and per-handshake
time reads remain in tls.go. Wire/frame code, bounds, IJSON/schema, partial reads/
writes/EOF/FIN handling and callback order are unchanged.

Payload stats still count actual successful ingress payload only. Relay egress/
transit remain non-additive; no TLS/frame/control bytes become payload. New may
return nil on epoch entropy failure without stopping forwarding. Nil mutation
remains a no-op and Snapshot unavailable; zero Counter also remains unavailable.
Saturation latches overflow at uint64 max; reads are individually atomic rather
than a fictitious transaction-consistent snapshot. Empty successful UDP datagrams
still count datagrams without adding byte payload.

## Compatibility, Planned Acceptance And Remaining Work

Existing public Forward/Relay/Payloadstats entries, private conversion callers and
consumer method sets stay the same; no root/CLI/Control change is required. The
public Forward Allowed compatibility entry remains while any native Direct or
Transit caller still requires DirectConfig. Removing it or moving shared budgets
would require an explicit coordinated contract/migration task. Snapshot's old
source location is not an API, so no alias or compatibility type is added.

All following cases are planned and unexecuted for later authorized Actions on
one frozen revision:

1. Compare old/new multihop conversion on ingress/transit/egress, TCP/UDP, exact
   edge pins/bindings/resources/digest, immutable Hop/Profile/CIDR ownership and
   validator/leaf/fingerprint/conversion/prepare first-error ordering.
2. Compare public egress versus original Forward Allowed on numeric IPv4/IPv6,
   mapped/invalid/sensitive/multicast/unspecified addresses, CIDR/metadata flags,
   DNS candidates, check callback short circuits and post-dial close/errors.
3. Exercise shared TCP/UDP budgets across Direct/Relay/Transit and retired/new
   instances, admission failures and idempotent release; retain original limits,
   queue/idle/amplification behavior and no leaked permits after partial start.
4. Compare nil/default authorization, replace/stop/drain/close/wait, expiry/guard,
   TLS purpose/URI/pin/ALPN, exact framing/IJSON/error precedence, short writes/
   reads/FIN, authorization ending before/after I/O and native sampling points.
5. Compare Snapshot public identity/method sets, random-epoch failure/zero/nil,
   atomic saturation/overflow, partial payload writes, successful empty datagrams,
   ingress-only Relay counts and Control read/tail compatibility.

No tests, type/syntax/static/import/boundary checks, gofmt/formatter, generator,
build, CI, network/native experiment, commit or push ran. Further native contract
classification, mixed wire/schema dependencies, whole-source/type/default graph,
same-revision functional evidence and independent physical gates remain open.
This slice establishes concrete owner source and dependency removal, not complete
A4/A5 acceptance or an opened upper-module gate.

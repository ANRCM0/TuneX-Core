# Control Probe Registration Public Owner

Date: 2026-10-19. Original source extraction only; no check or acceptance result.
This continues A1, not the whole Control Probe or foundation closure.

## Original Chains

| Entry | Public owner implementation | Contracts and providers | Same original state |
| --- | --- | --- | --- |
| Negotiation hello | ProbeNegotiator -> negotiation.ts -> machine-policy.ts | MachineSessionReader specialization, supplied transaction, public L2 request/ACK codecs | Read-only credential/session evidence |
| Instance HTTP machine adapter | ProbeInstanceRegistry -> instance-registry.ts -> ProbeInstanceOwner | Exact machine API plus public L2 parser/ACK | Calls the one original instance owner |
| Instance register/revoke/inspect | ProbeInstances -> instances.ts -> machine-policy.ts | TransactionBoundary, ProbeInstanceStore -> existing lower MySqlProbeInstanceStore | Original generation/slot, no permit issuance |
| v2 type qualification | ProbeTypeRegistry -> qualifications.ts -> qualification-policy.ts | CurrentProbeInstances, machine evidence and ProbeTypeQualifications -> existing lower qualification SQL | Original instance-bound qualification |
| v3 service recognition | ProbeServiceRegistry -> qualifications.ts -> same qualification rules | Same instance/qualification store and original distinct service parser/ACK | Adds original servicesVersion proof without rotating or renewing the slot |

Machine API, evidence, instance and measurement/qualification declarations now
have canonical leaves under probe-owner. CurrentProbeInstances is the original
readCurrent port moved beside the instance contracts; its former permit-port
export remains an exact type alias. Measurement constants/arrays remain the same
runtime objects, including original mutability and paired echo union types.
No declaration has a stronger readonly, discriminant or correlation guarantee.

Control binds the same original classes and stores through public.ts. Other
machine coordinators consume the public machine API. Old application entries and
flat ports directly alias their former exact export surfaces; no copied class,
new composition root, lower SQL rewrite, ledger or authority is introduced.

## Instance Time, Identity And Lifecycle

Input is detached before asynchronous transactions. Register retains evidence
read and first dynamic wall-clock check, instance lock, second dynamic time sample
and credential check after lock waits. Exact current instance replay cannot renew
expiry. New identity requires expectedGeneration equality and advances once,
bounded by the original counter maximum and minimum of 30 seconds, credentials
and retirement. Revoke retains its two checks with directCapability=false so an
authenticated host can close its slot after TCP capability withdrawal. Existing
state replay returns the original view. Inspect retains read/time/evidence order,
stale precedence and executionEnabled=false; it reserves nothing.

Negotiation retains parser/identity/fingerprint refusal order, one transaction
and a dynamically obtained wall clock. The instance adapter retains request action
dispatch and its lazy dynamically obtained ACK clock after owner completion.
No constructor clock capture is added to either path.

## Qualification Distinctions

Both registries retain their constructor-captured default clock, machine/current
slot reads, exact instance match, optional old qualification lock, stored-value
validation and current time/credential checks in the original transaction.
Registration can qualify only the existing live slot; replay does not renew it.
Revocation retains a tombstone when no proof was published and refuses equal/newer
mismatched generations. Future old qualification remains a clock error.

v2 and v3 capability checks and returned-qualified predicates stay distinct. v3
requires all three original measurements and can add servicesVersion=1 to the
same original proof. It does not add echo qualification. v2 retains its original
ingress capability behavior and stored fields. Neither path rotates the instance
or obtains a second budget. Original shallow spread, deep freeze and error order
remain. ACKs stay after transaction completion: v2 samples now before its helper;
v3 passes the original lazy callback, keeping the formatter's call timing.

Existing instance/qualification values still execute at original lower SQL call
points. Legacy zero-argument stores and static quarantine bind the same lower
implementations and original product callbacks. Agent Gate/counters and permit
authority/Journal are not replaced or reset by qualification metadata.

## Deferred Evidence And Residual Work

Readiness79/80 records planned aliases/APIs, time/read/lock/error/rollback order,
generation/replay/revocation/stale cases, v2/v3 proof distinctions, tombstones,
credential/capability withdrawal and exact ACK/default behavior. All unexecuted.
No checks/tests/formatters/generators/builds/CI/native/network/MySQL/browser/container
experiments, commits or pushes ran for this slice. Later functional/MySQL evidence
belongs in authorized Actions on the same frozen source, with physical-host and
release gates independent.

Other Probe command/plan/service-resolution, permit/claim/delivery/result/type/
service coordinators, remaining application/HTTP, Agent/native, Runner and whole
source/type/default/bridge classification remain open. Partial source extraction
does not open acceptance or parallel feature development. The human explicitly
authorized source-task subagents on 2026-10-19; that does not authorize verification.

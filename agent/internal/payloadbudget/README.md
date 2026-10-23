# Shared Payload Admission

Public Go interface1, FR-0032 source candidate; acceptance remains unverified.
This owner imports only standard Go packages. It opens no file, reads no clock
directly and issues no Runtime lease. Policy decisions use the existing Runner's
authorization callback and injected wall/monotonic samples, wait scheduler and
durable precharge callback.

A binding fixes bucket, Scope, user, node and the explicit UTC period. Revisions
may change rate, burst and byte limit while retaining consumed bytes. The bounded
history retains all periods, including expired or removed buckets. Overlap,
identity changes, revision rollback, conflicting equal revisions and exceeding
the 1024-bucket capacity fail closed; records are never evicted to make room.

One Gate per bucket aggregates all assignments, TCP/UDP and both directions.
TCP may reserve a prefix; UDP reserves its entire decoded datagram or refuses it.
Empty UDP payload still checks original authorization, period, zero rate and
exhaustion, then succeeds with zero bytes when admitted. Headers, TLS overhead
and probe/control frames are outside this payload contract.

Transient rate credit starts at zero on startup and revision changes. A monotonic
token balance is capped by burst; waiting uses bounded scheduler delays and
rechecks the original per-instance authority. A revised durable policy is adopted
before retrying, so a stale expected revision cannot spend under an older policy.
The native callback persists consumption in the original authenticated Runtime
Journal before Acquire permits a socket write. A crash, cancellation or short
write may conservatively consume unsent bytes; ambiguous reservations never refund.

Runner binds a per-instance AuthorizedGate to the original lease/proof check.
Lease renewal updates this holder without replacing the shared Gate. A different
bucket or limited/unlimited binding closes and starts the active execution with
an explicit host; old drains retain their prior holder. Control-only buckets
with no active assignments still update gates used by drains. The original
100ms authority watch closes active and draining executions at period end,
zero rate or exhaustion. Old lease expiry remains conjunctive with every quota.

Native state writes the optional protected resourceBudgets version1 field and
read-only JournalInspection version2 summary. Older readers reject the new
protected field; downgrade requires the original assessment workflow. Removing
a policy never resets durable history. Inspection exports only version, count
and an exact decimal sum, without bucket identities or raw Snapshot contents.

Source cases in gate_test.go plus executionstate/payload_test.go,
state/payload_budget_test.go and control/payload_limits_test.go are authored and
unexecuted. Functional/filesystem/concurrency acceptance requires the authorized
GitHub Actions run on the exact frozen revision.

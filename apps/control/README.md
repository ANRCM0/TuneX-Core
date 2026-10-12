# Control: Direct TCP/UDP Lifecycle

Hono HTTPS API, MySQL acceptance and persistent Runtime scanner publish ADP/2
direct TCP snapshots to enrolled Go Agents. Public APIs create Nodes/Forwards and
query desired/applied/health and Operation. Machine routes use verified Node mTLS
credentials, online sessions and persisted report ACKs.

Owner modules share a MySQL UnitOfWork. Idempotency response, intent/history,
exclusive port and Operation commit together; complete prospective node snapshot
capacity is checked before acceptance. Full snapshots are immutable and retained.
The deterministic planner and offline inspection CLI remain available.

See [Phase 1 development](../../docs/development/phase1.md) for setup, commands and
actual verification boundaries. The direct lifecycle now supports TCP/UDP creation,
CAS updates, enable/disable, deletion and explicit failed-Operation retry. Runtime
persists retirement records and per-session execution leases before safe cleanup.
See [Phase 2 direct slice](../../docs/development/phase2.md). Relay remains a later
versioned transport milestone.

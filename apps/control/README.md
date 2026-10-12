# Control: Phase 1 Direct TCP

Hono HTTPS API, MySQL acceptance and persistent Runtime scanner publish ADP/2
direct TCP snapshots to enrolled Go Agents. Public APIs create Nodes/Forwards and
query desired/applied/health and Operation. Machine routes use verified Node mTLS
credentials, online sessions and persisted report ACKs.

Owner modules share a MySQL UnitOfWork. Idempotency response, intent/history,
exclusive port and Operation commit together; complete prospective node snapshot
capacity is checked before acceptance. Full snapshots are immutable and retained.
The deterministic planner and offline inspection CLI remain available.

See [Phase 1 development](../../docs/development/phase1.md) for setup, commands and
actual verification boundaries. Direct TCP creation is implemented; UDP, resource
updates/deletion, explicit retry and Relay are intentionally rejected/deferred.

# ADP/3 Online Direct Cutover

Baseline: `0e07483`. Control and the standard Agent now communicate through
`/agent/v3/*` using the complete ADP/3 schema. The current advertised execution
driver remains `native.direct.v1`; Relay execution is not enabled by this cutover.

Control compiles and persists the same complete Snapshot it sends over TLS. Runtime
retirements and tombstones use physical resource protocol/port and preserve their
fence history. Hello requires `adp.3`; a retry for the current boot cannot replace
its capabilities. Old `/agent/v2/*` requests return `UNSUPPORTED_PROTOCOL_VERSION`,
and an old version sent to `/agent/v3/*` fails strict parsing.

Enrollment exclusively initializes the protected Node-bound RuntimeJournal. Agent
startup validates it, sends its high-water in Hello, and does not recover sockets
from cached authority. Snapshot acceptance locks and compares persisted state,
writes it before bind, and preserves listener/execution instances during renewal.
ACK, credential rotation, drains and resource ownership now use ADP/3 messages.
The direct engine's existing local configuration structs remain implementation
details, not a wire-version translation or compatibility API.

There is no automatic ADP/2 state migration. Control refuses any persisted ADP/2
Snapshot history, and Agent refuses an old journal. A previous deployment must stop
all issuers, exhaust or isolate all historical authority, retain its identities and
state for audit, and rebuild reviewed intent with a fresh database/trust/Node ID.
Do not edit a stored protocol field or reset a high-water counter to upgrade.
The recovery suite tests old ADP/3 backups, not an ADP/2 in-place upgrade.

Local verification includes `npm run check` (161 TS tests, Go tests/build, generated
contracts and offline TS-to-Go compilation), Go vet and native Linux race. The
real native Linux Agent suite passed 7 checks for TCP/UDP, hard cutoff, offline/
online restart, disable and delete. Transport passed 13 checks, including wire/DB
body equality and refusal of old endpoint/payload/history. The recovery suite
passed 9 checks and capacity suite passed 6 during cutover development. Access
management passed 14 checks. Evidence records dirty/commit and Agent SHA; the
local network topology is Windows Control/MySQL plus WSL Linux Agent/client/target.
Remote CI and a wholly Linux deployment are not counted as verified.

Remaining work: Agent Relay identity loading, runtime coordination and publication,
two independent Agents carrying encrypted traffic, replacement/cleanup and negative
fault acceptance. Phase 2 matrix and production release gates also remain open.

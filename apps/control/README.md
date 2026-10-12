# Control: deterministic direct planner

`src/modules/runtime/planner.ts` compiles already-authorized, already-reserved
Forward intent into ADP/2 direct Assignments and complete node Snapshots. The
offline CLI is a contract inspection tool; it does not authorize, persist, serve
an API or deploy. It rejects unsupported Relay and missing reservations.

Runtime must supply the whole node set, not a single Forward delta. MySQL-backed
acceptance, enrollment, API and Worker are the next vertical slice. No temporary
in-memory database is presented as durable acceptance.

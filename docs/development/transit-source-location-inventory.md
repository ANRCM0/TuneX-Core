# Transit Source Location Inventory

Date: 2026-10-19 (Asia/Shanghai). Scope: current Transit source locations and
callers, read during the human-authorized inventory. Not a repository-wide
import/boundary check, historical deletion audit or acceptance result.

## Location Correction

The earlier interruption looked for apps/control/src/runtime/transit-coordination.ts
and then apps/control/src/runtime. Those are not the current source locations.
The actual directory is apps/control/src/modules/runtime. All seven Transit
entries below were present there when inventoried, and Control and existing test
sources already referenced the modules/runtime paths. No recovery from Git,
legacy/ or Forwardx/ was required, and no src/runtime directory was created.
The preceding missing-source conclusion was an assistant path-reading error; it
does not establish that the human or another process deleted these sources.

## Existing Entries And Actual Owners

| Existing modules/runtime entry | Current implementation or remaining work |
| --- | --- |
| transit-api-contract.ts | Direct public Transit API aliases |
| transit-negotiation.ts | Legacy constructor/hello over public negotiation and raw SQL reader |
| transit-delivery.ts | Legacy constructor/enqueuePreview/poll/report over public preview delivery |
| transit-coordination.ts | This slice retains legacy construction and five public methods over public coordination and lower SQL |
| transit-staging.ts | Five-argument lazy bridge over public stage/abort, raw stage SQL and exact Runtime resource release; item 67 unexecuted |
| transit-reservations.ts | Precise legacy function over public validation and the same Runtime resource owner exclusive mode; items 65/66 unexecuted |
| transit-preparation.ts | Direct function/type aliases to one public compiler and L2 native format provider; item 65 unexecuted |

Public owner implementation paths are under apps/control/src/modules/transit-owner.
coordination-values.ts remains the single offlineTransitStep implementation, and
coordination-step.ts directly re-exports it. stage-values.ts remains the single
retained-stage verifier. This slice adds coordination.ts for the original journal
policy, not another journal or an execution engine. The new MySQL coordination
store is under apps/control/src/infrastructure and consumes lower framework ports.

## Read Callers And Continuation

Control previously constructed the original runtime journal as the delivery
planner; this slice explicitly binds public coordination to its required SQL
store. The legacy delivery wrapper still constructs the legacy journal, which
delegates to the same implementation. Existing transit-coordination.test.ts still
imports the modules/runtime journal and offline step. No test source or tooling
was expanded or executed during this inventory.

Staging/abort now has its original public Runtime/Node/Profile/Endpoint chain and
exact resource release; see [boundary](../architecture/transit-staging-owner-v1.md).
Other mixed application owners, A1 residuals, Agent Probe/native, Runner and
whole-source classification remain open. No source-only inventory opens the
frozen-source acceptance or upper-module gate.

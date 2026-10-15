# Transit mTLS command preview / durable delivery Report/Ack — integration slice

Status: **real Control HTTP transport + durable outbox and authenticated receipt, NON-EXECUTABLE**.
This work extends PR #109's mTLS capability handshake, the offline Control coordinator (#107), and the separate Agent journal (#106).

## What is live

1. **GET `/agent/v3/transit/command`**, with `X-TuneX-Session-Epoch` and `X-TuneX-Boot-Id`, requires an authenticated and authorized Node mTLS certificate. The current Boot, Node, session, non-revoked credential and declared Transit capabilities are re-checked under a MySQL transaction. Returns a pending `transit-command-preview-v1` or JSON `null`.
2. **POST `/agent/v3/transit/report`** requires the same mTLS/session authorization. The only legal condition is `"received"`. Accepted receipts are atomically persisted and acknowledged; an identical sequence/body retries as `"duplicate"`. A reused sequence with a different body, sequence regression, changed Boot, missing/stale command, retired credential, mismatched digest, or expired preview fails closed.
3. `0012-transit-delivery.sql` supplies an immutable command-preview outbox and an independently sequenced report receipt ledger. Both remain separate from **production** ADP/3 Snapshot, execution leases, Agent Report and operation states.
4. The offline `TransitDeliveryService.enqueuePreview` is **internal only** and requires the exact, immutable reserved staging proposal, coordinator revision/digest, Node session and current physical port Fence. No API route or production worker invokes it. Its retries use the same persisted digest.
5. Preview fields explicitly contain `kind:"transit-command-preview-v1"` and `executionEnabled:false` but **no** TLS listener, driver config, Transit Intent, neighbor secrets or executable Assignment. The acknowledgment also has `executionEnabled:false`. A delivery ACK **never calls** `TransitCoordinationJournal.confirm` and never makes the node Ready.
6. The authoritative JSON Schema and TS/Go parsers reject unknown fields, execution attempts, versions/digest tampering and fake Ready observations. The Go Agent Runtime is intentionally not yet wired to poll these messages; it still advertises only Direct/Relay.

## Why a delivery receipt is not an execution report

The **transport** now records that an authenticated Node-side client *received an ineligible preview*. There is not yet a durable authorization-bound assignment, shared Direct/Relay/Transit resource owner, persistent Agent execution observation or signed/verified Ready. Treating an `Ack(status=accepted)` as a Ready would permit a malicious or old Agent to activate a path without evidence.

Future integration must replace the preview with a formally authorized **executable ADP/3 Transit Snapshot**, negotiate explicit permissions, integrate the Go Runner, hold the shared physical Fence through restart and revocation, and securely bind reported prepared/ready/removed status to the exact generation and assignment. Then test partition/rollback/TCP/UDP on independent machines. No UI control or production multi-hop claim until these gates pass.

## Validation

`npm run check` checks both TS/Go schemas, strict semantic parsers, endpoint mTLS failure, and offline tests. Phase 1 CI runs a dedicated MySQL 8.4 `transit-coordination.test.ts`, now including preview transport with concurrent duplicate receipts, certificate revocation, stale Boot, changed digest/sequence, and evidence that no coordinator state advanced. Same-head Phase 1, Contracts, Relay Isolation and Containers must all pass.

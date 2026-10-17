# ADR-0019: Declarative native catalog and read-only Profile impact

Date: 2026-10-17. Status: implemented in the working tree; exact-SHA acceptance pending.
Scope: the existing native Direct/Relay/multihop implementations only, under
[ADR-0006](0006-classified-extension-contracts.md). No new execution driver,
wire format, Core selector, runtime ownership, migration or Journal change.

## Decision

A closed, versioned shared product catalog declares the three built-ins, their
assignment schema, roles/phases, business-to-carrier mapping, capabilities, flags,
OS/privilege assumptions, limit owners and present Probe/usage support. The Agent
registry remains compiled and authoritative; it never loads this file to register
or execute a driver. A Go parity regression compares the shared declarations with
the compiled registry. The catalog cannot claim current Node evidence, deployment
authorization or host acceptance. Control process gates are a separate projection.

Transport configuration impact is a separate read application. Scope membership
authorization, SELECT-only references and optional locked Profile resolution use
the same caller transaction. A normal member can inspect current desired references;
an impact query additionally requires manager status and the original owner's
explicit Profile Grant, even for the Owner. The existing resolver validates the
chosen immutable revision and digest. Node, Endpoint, policy, port and deployment
authorization are deliberately NOT inferred from a Profile-only impact query.

Results are paged (default 25, max 100, page max 10000), sorted by Forward ID,
limited to one Scope/Profile, optionally one current config revision, and exclude
deleting rules. Disabled/recovery-suspended desired references remain visible.
The projection does not traverse old Snapshot/leases or establish safe deletion.
READ COMMITTED pages/counts are observations, not a multi-request atomic snapshot.
Scope's existing index bounds the candidate set; JSON predicate evaluation and
counts may scan that Scope. This is not a constant-cost or new indexed-history API.

An explicit target revision produces a proposed ForwardSpec changing only its
locked Profile reference plus the current expected Forward revision. It does not
reserve resources, sign authority, update a Forward, create an Operation, renew a
lease or batch-publish a Profile. The Console can explicitly load one proposal
into the existing Relay editor, then requires a fresh original plan check and an
explicit CAS update through the original single Runtime owner. Profile publication
continues not to change any referencing rule implicitly.

## Compatibility and evidence

Pure Core and ADP strict parsers remain unchanged; old message acceptance does not
expand. The catalog is copied with the existing contracts package in the Control
image, not added to Agent Hello or persisted safety history. Defaults stay unchanged,
and multihop remains opt-in. No P6 engine or carrier is admitted by this ADR.

New contract/parser, Go registry parity, application/HTTP query, SELECT-only real
MySQL and light Console-controller regressions are wired to Actions. Full-table
before/after digests verify no query mutations in the SQL fixture. Existing real
HTTPS Chromium Probe fixture loads the new module, inspects native metadata and
publishes/queries/previews an unreferenced Profile; full referenced-rule editing
and physical-host validation
remain distinct follow-up evidence, not claimed by these authored tests.

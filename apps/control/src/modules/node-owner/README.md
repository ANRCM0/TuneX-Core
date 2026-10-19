# Node Owner Module

Source-candidate public interface 1. Entry: `public.ts`.

`NodeService<Tx>` owns product provision, policy, grant, revoke and view commands.
Existing NodeManagementCommand/Change/Writer and NodeGrantState/Writer contracts
stay with this owner. Credential and runtime execution authorization coordination
is inherited from the public L1 NodeAuthorityHost, not copied here.

Composition supplies NodeAuthorityOptions: the original transaction boundary and
Scope/access authority, Node store, machine lookup, resource locks, PKI signer,
secret generator/hash, native codec and clock. In live Control, the old Nodes
constructor binds the existing providers; callers need not migrate constructors
to use this source split. Providers do not add a parallel ledger or trust root.

Commands with a Tx argument join the caller's original transaction. Provision and
view/list operations retain their existing transaction entrypoints. Management
visibility, Runtime Node lock and scoped Node lock remain ordered; grant access
audit still calls the original Identity owner in that same transaction. Machine
TLS lookup retains its explicit pool-backed provider, never used as a replacement
for transaction-bound command authorization. Do not call storage directly from
another module or bypass the public command/authorization contracts.

There is no platform branch, SQL, raw signing process or crypto implementation in
this module. The native network-policy validator is a public L2 adapter, while
the product management-command shape/snapshot stays here. No automatic retry or
new credential/protocol/policy semantics are part of this extraction.

This module is unverified. Concentrated acceptance cases are in the foundation
readiness record, item 12; tests/checks/builds/PKI experiments have not been run for
this source. The foundation and parallel-development gates remain closed.

NodeApi and its response DTOs are the independent HTTP-facing contract, covering
the existing user and online machine calls without exposing NodeService, Nodes or
transaction methods. NodeService implements the contract through its own product
methods and inherited lower credential owner; L1 does not import this L3 API.
NodeView.policy intentionally remains unknown, matching the old untyped stored
projection rather than asserting a newly validated policy. Existing mutable
response shapes, nullable cutoffs and credential fields are unchanged in source
intent. Item 23 records old/new API and HTTP substitution acceptance, unexecuted.

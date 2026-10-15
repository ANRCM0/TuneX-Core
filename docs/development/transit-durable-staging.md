# Durable offline Transit staging — next slice after PR 102

The new TransitStagingCoordinator is internal-only and does not run in the existing Control services.

It stages an immutable, non-executable three-to-eight-node Transit plan within one MySQL transaction. A stage requires the current Forward revision, original execution authorizer, scoped Node grants, current machine sessions, valid peer pins, an authorized immutable Profile, explicit role/wire capability, exact ports and fenced reservations. The physical reservation and a digest-bound staging record are written atomically.

An explicit abort rechecks every current Node row, retained plan digest, all matching physical Fences, any unexpired historical execution leases, and any potentially live published Snapshot. Abort releases ONLY the staged exact resource set and commits the aborted record atomically. Missing, altered, or still-live state prevents release.

The table only admits the states reserved and aborted. No new ADP/3 Snapshot role, Go Agent Runner executor or Console control is enabled. Existing Nodes do not advertise the required multi-hop capabilities, so this slice cannot stage an executable Forward.

Still required: versioned ADP/3 Transit Snapshot plus matching Go parser and journal, persistent downstream-first distributed coordinator, real three-node TCP/UDP execution, revocation and partition tests, multiple physical Linux hosts, and complete production acceptance.

Run same-head Contracts, Phase 1, Relay Isolation, and container gates. Unit tests cover independent journal digest and corruption; database rollback and concurrency must be verified with a real MySQL acceptance suite before any execution path is registered.

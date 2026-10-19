# Execution Time Boundary

Public Go interface 2, source candidate and unverified. This package owns the
existing Guard/Ticket and synchronization-cache decisions. It reads no OS clock,
hostname, command output, proof file or protected key. All samples/evidence/host/
platform identity are supplied through Clock or SynchronizationSources. FR-0023
separates tagless parsed SyncStatus facts from platformclock's native JSON record.
Evidence providers supply ObservedAt time.Time, ObservationValid and SourceAccepted;
native RFC3339 parsing and OS source-name recognition belong to platformclock.
Direct lower native status literals/serialization are a breaking source change.
authorization keeps old native names and proof output with explicit projection.

The live authorization entrypoints delegate to these decisions and bind the
original OS/proof providers. The compatibility Guard retains its old clock field
as a delegating source; it holds no copied timing/failure/ticket state. Tickets
are aliases of the single lower-owned type. New providers must fail closed, include
suspend in uptime, sample wall after uptime, and retain the post-evidence sample.

The original two-second cache, 30-second evidence freshness, 500-ppm holdover,
same-host/platform binding, wall/uptime divergence latch, credential cutoff,
non-renewable expired session and drain bounds remain source intent. A sample or
OS synchronization status does not grant execution without the owner-held Guard.

Acceptance cases are in foundation-readiness item 13. No tests, checks or native
clock experiments have been executed for this extraction.

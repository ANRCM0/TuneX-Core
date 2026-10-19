# Native Observation Wire

Interface1 source candidate, unverified. This L2 package owns the original native
Host, process/Forward/Probe telemetry and counter JSON records. It neither samples
an OS/engine nor owns a counter, cursor, worker, transport pool or execution grant.

Four Encode*TelemetrySample functions preserve the original family preflight and
JSON errors/limits; four Check*TelemetryAck functions preserve native field/time/
identity/provenance/count validation. Process retains its Z suffix rule while the
other families retain their original regex. ProbeTelemetryLimits must be supplied
from the existing owner constants; it introduces no budget/default policy.

ReadAckBody only reads the original4097-byte bounded body and returns read errors.
Caller owns deferred Close, cancellation, timeout, HTTP status/length/family error
and ACK call order. EncodeValue/decimal/optional signed/epoch/time helpers perform
the original formats at caller-chosen sites. UTCTimeText and TimeText intentionally
differ: terminal Probe timestamps retain their original non-normalized offset.

platformobservation's public Host names alias these exact native DTOs and Provider
selects runtimeobservation.Provider[HostResources]. Lower Host facts have no JSON
format. Native type identity and generic custom providers require explicit migration;
there is no implicit native family or lower serialization fallback. Existing native
OS implementations produce these aliases directly, with no data conversion/copy.

Original counter retention/selection/null/pointer/availability and diagnostic map
projection remain with Runner. Forward local snapshot embeds its native DTO beside
private context; old named control DTO aliases/helper entrypoints remain. No live
Journal, secret, authority, budget or Probe product implementation is imported here.
Native contracts I-JSON and Probe result Binding are explicit existing format
dependencies, not a whole-package exemption or evidence of behavior acceptance.

FR-0015/readiness147-149 records exact bytes, method sets, field/time/lock/pointer/
body/error/close and owner lifecycle acceptance, all planned/unexecuted. No tests,
checks/gofmt/generators/build/CI/experiments/Git/delegation ran for this source move.

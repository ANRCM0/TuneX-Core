# Observation Value And Native Module Boundary V1

Date: 2026-10-18. Source candidate; unverified, not accepted.

L2 compatibility/public.ts now owns the original closed observation object,
server-name/address, URN encoding, public-key/certificate projection and staged
echo configuration wire adapter. These native functions import no L3 owner,
configuration type, limits or policy. Old observation-service-values exports of
observationObject/observationServerName/observationAddress re-export the same lower
implementations. HTTP app imports the lower public object helper directly.
This removes that specific reverse dependency, not all HTTP/query helper debt.

L3 observation-service-values retains service identity, version/purpose/config
shape, size/window/revision/receipt rules and trust decisions. L2 handles bounded
canonical base64/DER, X509 parsing, native IP/URL/key APIs and fingerprint hashing.
It projects only booleans, dates/names/usage and detached fingerprint metadata;
no raw certificate, key handle, private key, socket or grant is returned.

The leaf adapter invokes two synchronous outer callbacks at original points.
After native dates/usage/SAN extraction the first creates the exact expected
DNS/URI set; native key-strength projection follows. The second performs the
original scoped policy checks, including raw-DER equality/CA/strength, exact
server-auth-only EKU and two SANs, finite ordered certificate validity and the
config window inside that validity. Lazy boolean projections preserve original
raw/CA short-circuit reads. Native hashing runs only after this callback succeeds.
Callbacks do no I/O, do not retain native projections and receive no authority.
Errors retain their old wrapping/refusal points in source intent. There is no
system-root, chain-validation, network, time-read or alternate-key fallback.

Ed25519 echo still uses the original staged decoder and 32-byte public-key/SPKI
validation/fingerprint sequence. No registration, permit, execution, sender,
listener, feature/default change or echo enablement is introduced. Address and
server-name rules, scoped URN encoding, schema and fingerprint formats stay put.

L2 native-module-values supplies original UUID/digest bindings, JSON UTF8 byte
count, monotonic time and default wall-clock function capture. The default helper
returns the current Date.now function when the constructor default is evaluated;
it does not read time or substitute a later dynamic clock. ObservationServices
keeps its old constructor, caller clock override, maps, admission/cooldown limits
and exact audit-ID/digest/read/size points while using these public L2 functions.
Its original transaction/authorization/replay/SQL-store sequencing stays L3.

The shared command request now uses public L1 buildRequestIdentity for original
identity/key validation and immutable method/path/input digest framing, with the
same native digest supplied by L2 nativeCommandRequest. The callback runs only
after validation; no normalization, new key, response shape or digest format is
introduced. The old application/command-request.ts function keeps its original
signature as a compatibility wrapper, not a new authority or composition root.
ObservationServices consumes the public native binding directly.

Readiness item 40 is planned only: exact-source API/type/default/initialization/
error order, malformed/plain/null-prototype/duplicate fields, native IP/base64/
X509/key/SAN/EKU/validity and staged echo, byte/digest/UUID/clock/cooldown and
transaction/replay/HTTP behavior need acceptance. No check, type/syntax/boundary
run, test, format/generator/build/script, native PKI/network/browser/database/
container experiment, CI or Git/commit/push ran. This named owner split does not
close other observability/telemetry/path/Probe/native helpers, HTTP routing/query
composition, Agent or whole-repository debt. Foundation/parallel gates remain unmet.

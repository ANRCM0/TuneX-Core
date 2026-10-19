# FR-0024: Agent Credential Facts And Native Records

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner: Agent executionidentity/agentidentity/nativeexecution/Control. Recorded
before implementation under the human's 2026-10-19 standing source authorization
and explicit parallel A5 work. No verification, commit or release authorization.

## Task Proposal

1. L1 credential provider facts; L2 native credential record/codec adapters; L3 aliases.
2. Existing executionidentity Provider, agentidentity native credential APIs,
   nativeexecution wire helpers and unchanged state protected storage APIs.
3. Breaking lower direct serialization/type identity assumptions; native bytes stay.
4. executionidentity interface2 removes JSON tags from facts. agentidentity
   interface2 owns exact canonical CredentialBundle/RotationRequest/RelayResponse/
   RelayBundle native records and explicit facts/native conversions. Provider
   signatures retain lower facts; Native methods explicitly project at boundaries.
   Control private JSON-sensitive aliases point to native records; nativeexecution
   interface2 Relay response receives the native response and returns provider facts.
5. Planned exact-source Actions for tags/bytes/identity/conversion/provider stages,
   retries/corruption/missing/expired-history/cleanup and old fixtures; none executed.
6. Only Agent source and owned FR/closure document; shared versions/readiness by main.

## Why Current Extensions Are Insufficient

The generic Provider port already expresses required operations. Its lower facts
still declare persisted/native JSON tags; deleting tags alone would silently alter
credential files, strict protected decoding and fixture JSON. Native representation
belongs to the current agentidentity owner; explicit pure projections prevent an
implicit lower serialization fallback or a second credential authority.

## Impact And Compatibility

Lower direct JSON now has Go default field spelling and is not a credential format.
Canonical native identity belongs to agentidentity, with exact original fields,
order, tags, omitempty and pointer semantics. Existing old native helper names and
Control private aliases retain original native JSON behavior. Provider clients
continue lower facts and Native methods convert explicitly at their original stage.
DecodeProtected(any) remains the same trusted native adapter; Control pending and
Relay response destinations are canonical native records. No serializer is added
to lower facts. Unknown reflective/source-text consumers require migration rather
than an unverified compatibility promise.

## Migration And Version Plan

Record native types and bidirectional scalar/pointer projections in agentidentity;
remove lower tags; wrap Native Prepare/Validate/Save/Load/Relay methods around the
same existing native bodies. Preserve private/public old native helper signatures.
Native credential response codec consumes agentidentity.RelayResponse; request and
bundle facts keep original provider flow. No changed timestamps, encoding order,
strict/permissive decoder behavior, key/CSR/request-ID entropy call, save/removal/
reload order, missing flag, error return or recovery reset. Keep old native aliases
until real callers migrate and exact-source native/contract acceptance passes.

## Acceptance And Known Limits

Planned: lower/native distinction, every field/order/tag/omitempty and nil pointer;
native bytes/JSON/reflection/type and old literals; pending retry key/CSR identity;
initial missing versus corrupt/MAC failure; strict protected versus permissive
machine decode; validation time and overlap; save-before-publish/remove/reload,
partial failure and expired protected historical identity. All unexecuted. No
Journal, Guard, authority, wire/schema version or physical/release gate change.

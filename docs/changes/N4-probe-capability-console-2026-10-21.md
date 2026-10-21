# N4 Probe Capability Console

Date: 2026-10-21. Status: implemented-unverified; verification not executed.

1. Layer: existing web Probe presentation, consuming L3 Probe capability query v1.
2. Public contracts: existing console request/clear lifecycle, original execution-capabilities read, new GET forwards/:id/probe-capabilities, existing delegated forward-diagnostics action.
3. Foundation: untouched; no Agent, framework, schema, database or composition change.
4. Interface: initProbeConsole gains readonly openCapabilities(forward); existing open retains Direct TCP command selection. A dynamically created matrix explains transport, issuance switches, original read-only preflight and absence of a newly collected network observation. It never authorizes or invokes execution.
5. Acceptance: author isolated DOM/request contract cases for five-row rendering, stale selection/Scope response rejection, clearing, malformed contracts, API failures and no POST/polling. Do not execute tests/checks/browser/network experiments in this source phase.
6. Parallel impact: edit apps/web/probe.js only, plus this record and a new test file. No index/style/browser-native or shared documentation edits. Main/visibility owner serially adds all-Forward entrypoints; main registers backend route.

The human's N product source authorization and the coordinating owner's explicit N4 UI assignment authorize this work. Matrix refreshes only on explicit selection, existing capability refresh or a manual button; it creates no independent polling loop. Matrix data never toggles the original issuance state or grants consent. Relay/multihop/UDP readonly selection is separate from the existing explicit Direct TCP command path.

## Implemented Source

`apps/web/probe.js` dynamically inserts a section immediately after probe-capability, using the existing table-wrap/inner-table/hint/actions classes. Its four columns distinguish measurement location, original command switch, original read-only preflight and the absence of a network observation collected by this query. It displays selected list revision separately from the revision read by the capability owner. It creates no health badge and does not present accepted local connect preflight as business-path reachability.

The exact v1 response identity, five unique descriptors, false authority/end-to-end flags, expiry shape and same-Forward diagnostics path are validated before rendering. Server text is assigned through textContent. API/permission/contract failures erase old rows and diagnostic selection; they do not become an unsupported claim. Repeated refresh replaces the previous rows.

`open(forward)` preserves the original Direct TCP command selection and also reads the support matrix through the existing capabilities refresh. `openCapabilities(forward)` accepts any valid Forward ID/revision for readonly inspection; it leaves the command's selected variable null and original execution/prepare controls disabled. A manual readonly refresh invokes only GET forwards/:id/probe-capabilities. It shares the existing session AbortController and clear epoch, adds a latest-read sequence, and checks the selected Forward object and Scope before rendering. No timers or polling are added.

The existing global delegated forward-diagnostics action is reused by a disabled-until-valid button carrying the exact Forward ID. It opens the original passive diagnostic owner, with its own authorization. This query does not read diagnostic evidence automatically.

## Main Integration

The main browser-native list currently exposes TCP Probe only for original Direct TCP. Keep that command entry. Add a separate readonly support-matrix action for every Forward and call `probeConsole.openCapabilities(forward)` after resolving the selected Forward from the current list. Suggested label: Probe support / 探测支持. Main/visibility owns that caller edit; this slice does not change browser-native, index or style files.

Main separately registers the backend GET route described in FR-0031. The existing capability endpoint remains a readonly global issuance-policy read; matrix responses do not alter that policy or enable commands.

## Authored Acceptance

`apps/web/test/probe-capability-matrix-flow.test.mjs` authors DOM/request cases for five observation rows, independent switch/preflight/evidence columns, readonly Relay/multihop selection, command-boundary preservation, explicit refresh only, shared abort on clear, late Forward and Scope response rejection, malformed/denied response clearing and no POST. Existing tiny DOM harnesses without document support retain the original command behavior; production uses the anchor's ownerDocument.

No test, static/type/syntax/boundary check, browser/network experiment, formatter, generator, build, CI, commit or push was executed. The authored cases and main integration remain unverified on an exact source revision.

# Browser Native Adapters

BrowserNative1 source candidate, unverified. public.js exposes native model
time/query effects, request HTTP/abort/JSON/error/UUID effects, main view mount,
Relay form/view and Rule view factory. Native view/form source imports no
L3 owner; public helpers/commands/Console initializers are supplied by the original
app/model/Relay/Rule module composition entries.

control-console.js contains the original main DOM/form/time/clipboard and ephemeral
page/connection state; relay-forms.js retains exact native wire/profile/form fields;
relay-console.js contains the original Relay DOM/preview/CAS/deployment presentation.
rule-console.js keeps original Rule DOM/input Set and representation/abort/time/
UUID effects while RuleCommands1 owns its original command state machine.
They define functions at import, without mounting a view or touching native globals
until the old corresponding calls. Actual import/browser behavior is unverified.

Public model/request coordination is in the separate console-model-owner and
console-request-owner and rule-command-owner directories. These adapters do not implement a second server
authority, ledger, Journal, engine, schema/version, automatic retry or persistence.
Fixed module assets are individually served by Control with its original headers.
See FR-0019/FR-0020/FR-0022 and the Console/Rule architecture docs. The21 other native
leaves and old Rule binding are mapped individually in browser-native-leaf-inventory-
v1.md. Manual source mapping is not behavior/boundary/asset acceptance; no directory
exemption applies to new or existing browser source.

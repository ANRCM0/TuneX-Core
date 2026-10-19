# Native Agent Platform Bindings

Interface1 source candidate, unverified. This L2 package owns the canonical
Providers/Effects/LocalServices native binding structs and their original stateless
defaults. The structs specialize public lower identity/channel/runtime/observation
contracts with the same TLS/X509/HTTP/native Host family as before.

DefaultProviders returns original agentidentity.Native/controlchannel.Native;
DefaultEffects returns platformruntime.Bootstrap/Schedule/controlchannel.Native;
DefaultLocalServices returns platformobservation.Native and three original
platformruntime.Local values. These are stateless bindings, without a clock read,
file read, client creation, random sample or authority operation at construction.

This package imports no Control/Probe product module. It does not define flags,
commands, credentials, Journal facts, budgets, workers, a second authority, runtime
plugin discovery or a Probe executor factory. Product assembly remains in the
existing Control constructor seam, with its original public entrypoints/refusals.

Control's old three type names are aliases. Field shapes and source uses remain;
canonical named-struct package/reflection identity changes to agentplatform.
FR-0018 records that compatibility limitation and later acceptance/removal rules.
No current-source tests/checks/build/native evidence has been run.

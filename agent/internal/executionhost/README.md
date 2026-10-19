# Generic Execution Host v1

Source candidate, unverified. HostVersion remains 1; this is not a wire version.

This L1 package owns one generic Host/Driver/Instance boundary and registry
implementation. Assignment, Policy and peer Identity are injected type parameters.
No ADP parser, Relay engine, OS discovery, clock read, socket, Journal or authority
owner is imported. Time values in the identity callback are values, not clock reads.

Descriptor/Features/ProbeTarget and clone/validation/refusal behavior retain the
existing contract. Registry.Resolve accepts only header Selection plus features
and a trusted actual platform. It is not a parser or authorization decision and
cannot make an otherwise unsupported assignment/wire shape valid. The allowed
metadata names/bounds and error messages remain the original host-v1 rules.

Drivers must honor the provided check throughout execution, close partial failed
starts and support declared phase/drain/close behavior. An observation port returns
an existing instance endpoint/check, not an executable Probe grant. Host exposes no
Runner, authority issuer, Journal writer, resource ledger or recovery operation.

The existing executiondriver package is the L2 typed/native-platform binding.
Native engine factories are in nativeexecution; Control retains exact old private
helper/provider names. New trusted compiled code uses these public ports and known
composition, not private Control implementations. Do not copy registry/kernel logic
or create a competing authority. A new execution meaning still needs its separate
closed protocol/catalog/authorization/lifecycle/recovery change process.

The original Runner owns persist-before-sockets, Guard/Ticket checks, fences,
deadlines, replacement/retirement and protected history. A caller-supplied platform
or a factory return is not physical-host acceptance or permission to bypass it.

Foundation readiness item 29 records unexecuted alias/clone/zero-value/selection/
native lifecycle/order/error/compatibility cases. No checks, gofmt, tests, build,
native/network/CI run, commit or push has occurred for this extraction.

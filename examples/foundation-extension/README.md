# Public Foundation Extension Example

Status: source authored, not executed or accepted.

This is one independently located L3 module. It previews an imported Forward
intent through public framework ports and an explicitly supplied L2 adapter. It
does not publish a rule, reserve a resource, open a socket or write database state.

| File | Responsibility |
| --- | --- |
| `public.ts` | Module contract version 1 and public service/types |
| `module.ts` | L3 scoped management preview; public L1 dependencies only |
| `main.ts` | Composition with demonstration transaction/auth/log providers and a public L2 adapter |

The public foundation entrypoints are
`apps/control/src/framework/public.ts` and
`apps/control/src/compatibility/public.ts`. No module import reaches Core/kernel
internals, framework implementation files, SQL, a production owner class or an OS
branch. The adapter is `tunex-flat-forward` format 1, not TuneX V2 compatibility.

The main file uses a fixed example actor/Scope, a read-only in-memory transaction
fixture and an explicit input. This fixture is not production authorization or a
general transaction implementation. Production integration supplies real public
owner ports and calls the original Forward command for any actual publication.

In the authorized concentrated acceptance environment, with the project's supported
Node runtime and workspace dependencies installed, the intended entry is:

```powershell
node examples/foundation-extension/main.ts
```

This command has not been run. Expected source behavior is a version 1 preview
whose target host is normalized from `Example.COM.` to `example.com`, protocols
are `tcp, udp`, and `executionAuthorized` is false. A code-only success event goes
to the injected stderr logger. RequestLifecycle waits for application completion.

Contract acceptance still needs successful execution, denied/unknown/invalid input,
immutability, no physical/store side effects and logger/drain cases listed in
`docs/testing/verification-status.md`. A runnable command in documentation is
not recorded as a passing test. New module development uses an independent branch
only after the foundation gate passes; this existing source worktree is preserved.

Current-source integration reading (2026-10-21): the module still consumes public
L1 ForwardIntent/ForwardImportAdapter, transaction, scoped authorization, freezing,
identity and logging contracts. The existing main binds public L1 RequestLifecycle
and ControlError with the public L2 flatForwardAdapter; JSON/stderr/stdout stay in
that composition. Ops/upgrade/native contract classification does not change this
example's public surface or prove its imports execute. This is the same preview
example, not a RuntimeHost/Agent/MySQL demonstration. Full type/import/asset closure
and the already planned example acceptance remain unexecuted on current source.

The N resource-ownership successor does not add a resource read to this preview.
It parses caller-supplied intent and checks Scope entry through the existing
authorization port; it reads no Node, Forward, template, report or saved reference.
No ResourceReadAccess provider is needed for this example. Its preview result
cannot establish ownership, grant a purpose or authorize publication. Integrations
that read saved resources must supply the successor access provider; integrations
that publish must call the original Forward owner and consume its command receipt.
This example's unchanged contract does not demonstrate those product operations.

# Control Bootstrap Command And Native Effects v1

Date: 2026-10-19 (Asia/Shanghai). Source implemented, unverified.

The original apps/control/src/bootstrap.ts is a production npm control:bootstrap
entry. It previously combined argv/env/native database construction and first-owner
command sequencing. It now composes public command coordination and native effects;
no operation, first-owner rule, permission, database schema or public L0/L1 changes.

| Entry relative to apps/control/src | Ownership |
| --- | --- |
| modules/control-bootstrap-command-owner/public.ts | CONTROL_BOOTSTRAP_COMMAND_INTERFACE_VERSION1, generic Database/effects and runControlBootstrap |
| compatibility/public.ts | CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION1, nativeControlBootstrapEffects and exact NativeControlBootstrapDatabase alias |
| compatibility/native-control-bootstrap-command.ts | Original process argv/env, MySqlUnitOfWork construction and console output; no Identity product import |
| bootstrap.ts | Existing top-level composition supplies native effects and original Identity(db).bootstrap callback |
| modules/identity-owner/public.ts | Original public IdentityService and same bootstrap validation/transaction algorithm |
| modules/identity.ts | Existing native constructor binding, retained at the original root |

The L3 command takes arguments/env/openDatabase/bootstrap/log. Its database view
contains only migrate/close; it does not import MySQL, process, filesystem, Identity
implementation or native DTO. Native effects import no L3 product. The old root
has no business body or new named export. This is an existing real composition,
not permission for ordinary modules to instantiate private owners.

argv is sliced once; scope/actor destructured, then DATABASE_URL and owner token
read in original order. Both env reads still precede the combined required check,
which keeps its exact error. Extra argv are still ignored. Native database
construction remains outside try; constructor failure has no new close attempt.

Inside try, await migrate, then construct the same original Identity and await its
bootstrap, then log the same owner/scope message. finally awaits close for migrate,
bootstrap and log failures too; close failure precedence remains original. The
entry retains top-level await with no new catch, exit policy, retry or partial-DDL
rollback promise. Identity still validates IDs/random bearer, inserts account,
creates scope and adds owner in its own original transaction. No token rotation,
second issuer, new Authority/Journal write or credential logging is added.

No existing ControlStartup1/Identity/public foundation method set changes. This
new L3/L2 command candidate is version1; no separate frozen-interface FR is needed.
Exact-source acceptance178 must cover arguments/env/getter/first-error/default,
constructor/migrate/Identity/log/close order, original aliases/consumers and failures.
All planned/unexecuted. No tests/checks/format/generation/build/CI/experiments/Git
writes/delegation occurred. This is not demonstrated first-start operational safety.

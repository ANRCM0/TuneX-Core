# V2 dependency and retirement inventory

Baseline: `8ca81c0c3f779bb3485594f8b1dc91f3a1c246a4`. This inventory concerns the current candidate source, not a published image scan.

| Boundary | Current dependency | Verification |
| --- | --- | --- |
| Agent executable and TST data plane | Go standard library only; `agent/go.mod` has no require/replace directives | `go list -deps ./...`; locked clean cross-build; native dependency audit |
| Transport cryptography | Go `crypto/tls`, `crypto/x509`, ECDSA, secure random and AES-GCM for private cache | TLS 1.3/mTLS/ALPN/identity negative tests; no custom transport cipher |
| Panel certificate provisioning | Node crypto and the existing locked backend dependencies | Issuer tests, sealed storage tests and backend lockfile installation |
| Panel/Worker | Bun runtime, Prisma/MySQL and Redis with `backend/bun.lock` | Unit, disposable database/HTTP tests and real local processes |
| Web | React/Next.js and existing UI dependencies with `web/package-lock.json` | Locked install, typecheck, source tests, build and browser evidence |
| Production containers and installer | Existing native Panel/Agent build stages and Compose services | Source audit and shell syntax; Linux build/install remains a separate gate |

The following executable dependencies were removed after replacement coverage and historical-source archival:

| Retired boundary | Replacement |
| --- | --- |
| `third_party/forwardx/forwardx-fxp` build, binary and Docker stage | In-process `agent/internal/securelink` and `agent/internal/tstruntime` |
| `agent/internal/linkrunner` process control, source/target adapters | Native placement lifecycle, private cache, lease/generation fences and Forward authorization |
| `backend/src/integrations/forwardx` compiler and protocol adapter | `backend/src/domain/link/tst-compiler.ts` and native Link services |
| FXP-only frontend creation/edit and dedicated business flow | Unified Forward operation and `/forwards` workflow |
| Retired environment flags, binary paths and protocol capabilities | Default-off `TUNEX_TST_ENABLED` and current Agent capability `forward.link.tst.v1` |
| External-protocol integration fixture and CI build dependency | Independent vectors, real two-Agent TST acceptance and native protocol regression |

`scripts/ci/native-dependency-check.mjs` rejects retired active modules, binary/flag/capability references, an Agent module dependency, or inclusion of the user's reference checkout. It scans source/build/configuration paths, excluding generated files and historical compliance archives. Ordinary historical attribution comments are preserved.

Applied historical Prisma migrations and recoverable legacy database storage remain for checksums and data recovery. The additive V2 migration explicitly quarantines incompatible records; these records are not an active protocol adapter. License/source archives are documentation and are never compiled or loaded. The user-owned `Forwardx/` checkout is preserved and excluded from Git and Docker contexts.

New TST framing, state transitions, identity checks and vectors derive from the supplied plan and public Go/TLS contracts. The old wire format is not a contract for the new implementation. Historical attribution and distribution obligations remain documented in [the archive record](README.md). An external license/security review and actual release-image SBOM are still needed before a production release.

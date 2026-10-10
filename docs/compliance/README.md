# Historical source and attribution

The current and retired dependencies are mapped in [the V2 inventory](native-dependencies.md).

TuneX V2 removes the external ForwardX data plane. `forwardx-historical-source.zip`
preserves all 57 files from the former `third_party/forwardx/`, including the exact
modified source, AGPL-3.0-only license, upstream manifest, modification manifest
and third-party notices. The archive was compared file by file using SHA-256
before removing the active source. Archive SHA-256:

`9317e6791c6b60a9f9ebcb9038c46166e853c55fbc0602f3d6a0804f7876b44f`

Upstream: https://github.com/poouo/Forwardx, version 2.3.281, commit
`cb0ef0bb156dc114e4344c887328018491fbd638`. Historic TuneX baseline:
`8ca81c0c3f779bb3485594f8b1dc91f3a1c246a4`. Modified source and notices remain
available from this repository alongside the historic Git revisions. Removing
runtime use does not retroactively remove obligations for earlier distributions.

`pre-v2-documentation-paths.zip` preserves the six previous current documents
with their original repository paths. `pre-v2-documentation.zip` is the initial
flat archive; duplicate README entries are disambiguated in the path archive.
Historic applied database migrations remain unchanged to preserve checksums and
upgrade history. They describe the old storage contract, not an active driver.

Inherited generic TuneX features that previously recorded a behavioral reference
retain their attribution comments in source, schema and tests. These references
must not be erased merely to produce an empty text search. The new TST framing,
TLS identity verification and Go transport are independently implemented; this
statement does not relicense inherited code or claim the whole product was
written independently of every reference.

The user-owned, untracked `Forwardx/` reference checkout is preserved and excluded
from version control, Docker contexts and release artifacts. Archives in this
directory are documentation only; the Agent, Panel, build and installer never
read or compile them.

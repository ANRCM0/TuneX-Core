# Unified Forward browser verification

`browser-unified-checks.mjs` drives the actual React Forward components in Chrome,
with the CSS emitted by the production Next build and an isolated HTTP fixture.
It verifies business submissions, permission gates and responsive drawer layout.
It does not prove an Agent listener, TST handshake or real traffic flow.

From `web`, run the production build, start the HTTP fixture in one terminal,
then run the checks in a second terminal:

```powershell
node node_modules/next/dist/bin/next build
& '../backend/node_modules/.bin/bun.cmd' src/components/forwards/__tests__/browser-unified-server.ts
node src/components/forwards/__tests__/browser-unified-checks.mjs
```

Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe`;
`TUNEX_TEST_CHROME` can specify another executable. Ports 41975 and 41976 must
be available. The checks own and remove a temporary browser profile and reset
only the isolated fixture's in-memory records.

Results are written to `web/test-artifacts/unified-forward-browser-evidence.json`.
PNG evidence is captured at widths 390 and 1536. Drawer bounds and horizontal
overflow are checked at 360, 390, 768, 1024, 1280 and 1536 pixels.

The scenarios cover one scoped Native creation with automatic port selection,
pending versus ready state, revision-checked editing, suspend/resume, history,
unverified diagnosis, confirmed deletion, TST copying and its capability gate,
reader permissions, and late request isolation when switching workspaces.
Every mutation is recorded, and any frontend Link mutation fails the checks.

For the actual local Panel/Worker/Agent environment, first finish
`scripts/integration/tst-local.mjs --keep` with all checks passing. Start Next
with mocks disabled and its server API base and API rewrite pointing to that
Panel. Then pass the private fixture path and Next URL:

```powershell
node src/components/forwards/__tests__/browser-unified-real-checks.mjs '<private fixture.json>' 'http://127.0.0.1:41000'
```

This second script logs in through the actual form, switches the workspace,
creates Native and TST Forward rules on test ports 25120/25121, and verifies
real TCP/UDP echo payloads and listener removal alongside the UI lifecycle.
It records no auth requests, cookies, credentials or raw transport config.
Screenshots crop the drawer to exclude account details. Its results use the
`real-unified-forward-` artifact prefix and explicitly state the local loopback
scope, rather than implying a Linux or public deployment.

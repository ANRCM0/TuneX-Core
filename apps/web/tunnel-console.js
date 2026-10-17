const tunnelId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const tunnelCounter = value => Number.isSafeInteger(value) && value >= 0;
const tunnelTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function initTunnelConsole({ request, notify, byId, deployment, document = globalThis.document }) {
  const el = name => byId('tunnel-' + name);
  let node = null, epoch = 0, statusVersion = 0, referenceVersion = 0, page = 1;
  let statusRead = new AbortController(), referenceRead = new AbortController();
  function cell(row, value) { const td = document.createElement('td'); td.textContent = value; row.append(td); return td; }
  function resetReferences() {
    referenceVersion++; referenceRead.abort(); referenceRead = new AbortController();
    el('reference-rows').replaceChildren(); el('references-meta').textContent = 'No current reference page.';
    el('prev').disabled = el('next').disabled = true;
  }
  function clear() {
    epoch++; statusVersion++; statusRead.abort(); statusRead = new AbortController(); resetReferences();
    node = null; page = 1; el('status').textContent = ''; el('state').textContent = 'No current metadata.';
    el('dialog').close();
  }
  async function status() {
    if (!node) return;
    const id = node, connection = epoch, version = ++statusVersion;
    statusRead.abort(); statusRead = new AbortController(); el('status').textContent = ''; el('state').textContent = 'Loading persisted metadata only.';
    try {
      const data = await request('GET', 'nodes/' + encodeURIComponent(id) + '/tunnel', undefined, undefined, { signal: statusRead.signal });
      if (connection !== epoch || version !== statusVersion) return;
      if (data.nodeId !== id || data.source !== 'persisted-control-state' || data.health !== 'unknown' || data.executionAuthorized !== false || data.reserved !== false ||
          data.networkCheck !== 'not-performed' || data.certificateVerification !== 'not-performed-by-this-query' || !tunnelTime(data.observedAt) ||
          typeof data.node?.revoked !== 'boolean' || typeof data.node.recordedMachineWindowOpen !== 'boolean' ||
          !tunnelCounter(data.node.sessionEpoch) || !tunnelCounter(data.node.snapshotGeneration) ||
          !Array.isArray(data.node.capabilities) || data.node.capabilities.length > 256 || data.node.capabilities.some(value => typeof value !== 'string') ||
          data.node.credentialUntil !== null && !tunnelTime(data.node.credentialUntil) || data.node.lastReportAt !== null && !tunnelTime(data.node.lastReportAt) ||
          data.peerCredentials?.limit !== 4 || !tunnelCounter(data.peerCredentials.total) || !tunnelCounter(data.peerCredentials.recordedWindowCount) ||
          data.peerCredentials.recordedWindowCount > 2 || data.peerCredentials.recordedWindowCount > data.peerCredentials.total ||
          !Array.isArray(data.peerCredentials.items) || data.peerCredentials.items.length > 4 ||
          data.peerCredentials.items.some(peer => !/^sha256:[a-f0-9]{64}$/.test(peer.fingerprint) || !tunnelTime(peer.issuedAt) || !tunnelTime(peer.validUntil) ||
            peer.retireAfter !== null && !tunnelTime(peer.retireAfter) || peer.effectiveUntil !== null && !tunnelTime(peer.effectiveUntil) ||
            typeof peer.revoked !== 'boolean' || typeof peer.recordedWindowOpen !== 'boolean') ||
          data.endpoint !== null && (!tunnelCounter(data.endpoint?.revision) || data.endpoint.revision < 1 || typeof data.endpoint.config?.listenAddress !== 'string' ||
            typeof data.endpoint.config.advertisedHost !== 'string' || !Array.isArray(data.endpoint.config.allowedTcpPorts) || data.endpoint.config.allowedTcpPorts.length > 256 ||
            data.endpoint.config.allowedTcpPorts.some(port => !Number.isInteger(port) || port < 1 || port > 65535)))
        throw Error('Invalid persisted tunnel metadata. No health or authorization claim.');
      el('state').textContent = 'Persisted metadata / health UNKNOWN / no network check or certificate verification / no execution authorization. Recorded windows are not active sessions.';
      el('status').textContent = JSON.stringify({ nodeId: id, observedAt: data.observedAt,
        node: { revoked: data.node.revoked, credentialUntil: data.node.credentialUntil, recordedMachineWindowOpen: data.node.recordedMachineWindowOpen,
          capabilities: data.node.capabilities, sessionEpoch: data.node.sessionEpoch, snapshotGeneration: data.node.snapshotGeneration, lastReportAt: data.node.lastReportAt },
        endpoint: data.endpoint === null ? null : { revision: data.endpoint.revision, config: { listenAddress: data.endpoint.config.listenAddress,
          advertisedHost: data.endpoint.config.advertisedHost, allowedTcpPorts: data.endpoint.config.allowedTcpPorts } },
        peerCredentials: { total: data.peerCredentials.total, recordedWindowCount: data.peerCredentials.recordedWindowCount,
          shown: data.peerCredentials.items.length, truncated: data.peerCredentials.total > data.peerCredentials.items.length,
          items: data.peerCredentials.items.map(peer => ({ fingerprint: peer.fingerprint, issuedAt: peer.issuedAt, validUntil: peer.validUntil,
            retireAfter: peer.retireAfter, effectiveUntil: peer.effectiveUntil, revoked: peer.revoked, recordedWindowOpen: peer.recordedWindowOpen })) } }, null, 2);
    } catch (error) {
      if (connection === epoch && version === statusVersion) { el('status').textContent = ''; el('state').textContent = 'Metadata unavailable; health UNKNOWN.'; notify(error.message, true); }
    }
  }
  async function references(nextPage = 1) {
    if (!node) return;
    resetReferences(); const id = node, connection = epoch, version = referenceVersion;
    try {
      if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > 10000) throw Error('Reference page outside bounds.');
      const data = await request('GET', 'nodes/' + encodeURIComponent(id) + '/tunnel/references?page=' + nextPage + '&limit=25',
        undefined, undefined, { signal: referenceRead.signal });
      if (connection !== epoch || version !== referenceVersion) return;
      if (data.nodeId !== id || data.page !== nextPage || data.limit !== 25 || !tunnelCounter(data.total) || data.previewOnly !== true || data.executionAuthorized !== false ||
          data.reserved !== false || data.historicalReferencesIncluded !== false || data.deletionSafety !== 'not-proven' ||
          !Array.isArray(data.items) || data.items.length > 25 || new Set(data.items.map(item => item.forwardId)).size !== data.items.length ||
          data.items.some(item => !tunnelId(item.forwardId) || !tunnelCounter(item.revision) || item.revision < 1 || !tunnelId(item.profileId) ||
            !tunnelCounter(item.configRevision) || item.configRevision < 1 || typeof item.enabled !== 'boolean' || typeof item.recoverySuspended !== 'boolean' ||
            !['ingress', 'transit', 'egress'].includes(item.role) || !Array.isArray(item.path) || item.path.length < 2 || item.path.length > 8 ||
            item.path.some(value => !tunnelId(value)) || new Set(item.path).size !== item.path.length || !item.path.includes(id) ||
            item.previousNodeId !== (item.path[item.path.indexOf(id) - 1] ?? null) || item.nextNodeId !== (item.path[item.path.indexOf(id) + 1] ?? null) ||
            item.role !== (item.path[0] === id ? 'ingress' : item.path.at(-1) === id ? 'egress' : 'transit') || item.endpointRequired !== (item.path[0] !== id) ||
            !Array.isArray(item.protocols) || !item.protocols.length || item.protocols.some(value => !['tcp', 'udp'].includes(value))))
        throw Error('Invalid tunnel reference page. No neighboring execution facts inferred.');
      page = nextPage;
      el('references-meta').textContent = 'Current desired references / page ' + page + ' / total ' + data.total + '. Includes disabled and recovery-suspended rules; NOT historical lease or deletion-safety proof.';
      for (const item of data.items) {
        const row = document.createElement('tr');
        cell(row, item.forwardId + ' / r' + item.revision + (item.enabled ? '' : ' / disabled') + (item.recoverySuspended ? ' / recovery suspended' : ''));
        cell(row, item.role + ' / previous: ' + (item.previousNodeId ?? 'none') + ' / next: ' + (item.nextNodeId ?? 'none') + ' / ' + item.path.join(' -> '));
        cell(row, item.profileId + ' / locked r' + item.configRevision + ' / ' + item.protocols.join('/') + (item.endpointRequired ? ' / Endpoint required' : ' / no ingress Endpoint requirement'));
        const action = document.createElement('button'); action.type = 'button'; action.className = 'secondary'; action.textContent = 'View Deployment';
        action.addEventListener('click', async () => {
          if (connection !== epoch || version !== referenceVersion) return;
          clear();
          try { await deployment(item.forwardId); } catch (error) { notify(error.message, true); }
        });
        cell(row, '').append(action); el('reference-rows').append(row);
      }
      el('prev').disabled = page <= 1; el('next').disabled = page >= Math.min(10000, Math.max(1, Math.ceil(data.total / 25)));
    } catch (error) { if (connection === epoch && version === referenceVersion) { resetReferences(); notify(error.message, true); } }
  }
  async function open(id) {
    if (!tunnelId(id)) throw Error('Select a scoped Node.');
    clear(); node = id; el('title').textContent = 'Native TLS tunnel metadata / ' + id; el('dialog').showModal();
    await Promise.all([status(), references()]);
  }
  el('refresh').addEventListener('click', () => Promise.all([status(), references(page)]));
  el('prev').addEventListener('click', () => references(page - 1)); el('next').addEventListener('click', () => references(page + 1));
  el('close').addEventListener('click', () => el('dialog').close());
  el('dialog').addEventListener('close', () => { if (!el('dialog').open && node !== null) clear(); });
  clear(); return { open, status, references, clear };
}

const transportId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const transportRevision = value => Number.isSafeInteger(value) && value > 0;
function positiveRevision(value, optional = false) {
  if (optional && value === '') return undefined;
  if (!/^[1-9][0-9]*$/.test(value) || !transportRevision(Number(value))) throw Error('Select a canonical immutable Profile revision.');
  return Number(value);
}

export function initTransportConsole({ request, notify, byId, detail, edit, confirm = globalThis.confirm, document = globalThis.document }) {
  const el = name => byId('transport-' + name);
  let epoch = 0, catalogVersion = 0, referenceVersion = 0, profile = null, page = 1, total = 0, preview = false;
  let session = new AbortController(), reads = new AbortController();
  function cell(row, text) { const td = document.createElement('td'); td.textContent = text; row.append(td); return td; }
  function empty(id, text, columns) {
    const tbody = el(id); tbody.replaceChildren(); const row = document.createElement('tr');
    const td = cell(row, text); td.colSpan = columns; td.className = 'empty'; tbody.append(row);
  }
  function invalidate() {
    referenceVersion++; reads.abort(); reads = new AbortController(); total = 0;
    el('references-prev').disabled = el('references-next').disabled = true;
    el('references-meta').textContent = 'No current preview. Query again after changing revisions.';
    empty('reference-rows', 'No current reference page.', 4);
  }
  async function catalog() {
    const version = ++catalogVersion, connection = epoch;
    empty('catalog-rows', 'Loading declarations (not Node evidence).', 4);
    try {
      const data = await request('GET', 'native-drivers', undefined, undefined, { signal: session.signal });
      if (version !== catalogVersion || connection !== epoch) return;
      if (data.version !== 1 || data.source !== 'declared-native-implementation' || data.authorized !== false || data.reserved !== false ||
          !Array.isArray(data.drivers) || data.drivers.length !== 3) throw Error('Invalid native capability declarations.');
      el('catalog-rows').replaceChildren();
      for (const driver of data.drivers) {
        const row = document.createElement('tr');
        cell(row, driver.id + ' / descriptor r' + driver.descriptorRevision);
        cell(row, 'TCP -> ' + driver.carrierByProtocol.tcp.toUpperCase() + ' / UDP -> ' + driver.carrierByProtocol.udp.toUpperCase());
        cell(row, (driver.controlEnabled ? 'Control gate on' : 'Control gate OFF') + ' / Agent flags: ' + (driver.agentFlags.join(' ') || 'none'));
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Declarations';
        button.addEventListener('click', () => { if (version === catalogVersion && connection === epoch) detail('Native driver: declaration only', driver); });
        cell(row, '').append(button); el('catalog-rows').append(row);
      }
    } catch (error) {
      if (version === catalogVersion && connection === epoch) { empty('catalog-rows', 'Capabilities unknown; no execution claim.', 4); notify(error.message, true); }
    }
  }
  async function references(usePreview = false, nextPage = 1) {
    if (!profile) return;
    invalidate(); const version = referenceVersion, connection = epoch, id = profile;
    try {
      const revision = positiveRevision(el('from-revision').value.trim(), true);
      const targetRevision = usePreview ? positiveRevision(el('target-revision').value.trim()) : undefined;
      if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > 10000) throw Error('Reference page outside bounds.');
      const query = new URLSearchParams({ page: String(nextPage), limit: '25' });
      if (revision !== undefined) query.set('revision', String(revision));
      if (targetRevision !== undefined) query.set('targetRevision', String(targetRevision));
      const data = await request('GET', 'transport-profiles/' + encodeURIComponent(id) + '/references?' + query,
        undefined, undefined, { signal: reads.signal });
      if (version !== referenceVersion || connection !== epoch) return;
      if (data.profileId !== id || data.page !== nextPage || data.limit !== 25 || data.previewOnly !== true || data.reserved !== false ||
          data.fullPlanAuthorization !== false || !Number.isSafeInteger(data.total) || data.total < 0 ||
          !Array.isArray(data.items) || data.items.length > 25 || (usePreview ? data.target?.revision !== targetRevision : data.target !== null))
        throw Error('Invalid read-only Profile reference page.');
      if (data.items.some(item => !transportId(item.forwardId) || !transportRevision(item.revision) || item.expectedRevision !== item.revision ||
          item.spec?.transport?.profileId !== id || item.spec.transport.configRevision !== item.configRevision || !item.spec.path ||
          (usePreview ? typeof item.changed !== 'boolean' || item.proposedSpec?.transport?.profileId !== id || item.proposedSpec.transport.configRevision !== targetRevision :
            item.changed !== null || item.proposedSpec !== null))) throw Error('Invalid Profile impact association.');
      page = nextPage; total = data.total; preview = usePreview;
      el('references-meta').textContent = 'Profile ' + id + ' / current r' + data.currentRevision + ' / page ' + page +
        ' / total ' + total + ' / target ' + (targetRevision ?? 'none') + '. Read-only configuration impact, NOT deployment authorization or resource reservation.';
      if (!data.items.length) empty('reference-rows', 'No retained current-intent references on this page.', 4);
      else el('reference-rows').replaceChildren();
      for (const item of data.items) {
        const row = document.createElement('tr');
        cell(row, item.forwardId + ' / Forward r' + item.revision);
        cell(row, 'Profile r' + item.configRevision + (item.recoverySuspended ? ' / recovery suspended' : ''));
        cell(row, item.changed === null ? 'Not previewed' : item.changed ? 'Explicit revision change required' : 'Already locked to target');
        const actions = cell(row, ''), info = document.createElement('button');
        info.type = 'button'; info.className = 'secondary'; info.textContent = 'Inspect';
        info.addEventListener('click', () => { if (version === referenceVersion && connection === epoch) detail('Profile reference / configuration impact only', item); }); actions.append(info);
        if (usePreview && item.changed === true && item.proposedSpec) {
          const load = document.createElement('button'); load.type = 'button'; load.className = 'secondary'; load.textContent = 'Load Editor';
          load.addEventListener('click', async () => {
            if (version !== referenceVersion || connection !== epoch || !confirm('Load this proposed revision into the editor? No deployment occurs until a fresh plan check and explicit update.')) return;
            const selected = { id: item.forwardId, revision: item.expectedRevision, spec: item.proposedSpec };
            invalidate();
            el('references-dialog').close();
            try { await edit(selected); if (connection === epoch) notify('Loaded a proposal only. Recheck the Relay plan and explicitly submit with CAS; permissions/resources may have changed.'); }
            catch (error) { if (connection === epoch) notify(error.message, true); }
          }); actions.append(load);
        }
        el('reference-rows').append(row);
      }
      el('references-prev').disabled = page <= 1;
      el('references-next').disabled = page >= Math.min(10000, Math.max(1, Math.ceil(total / 25)));
    } catch (error) {
      if (version === referenceVersion && connection === epoch) { invalidate(); notify(error.message, true); }
    }
  }
  async function open(item) {
    if (!transportId(item?.profileId) || !transportRevision(item.currentRevision)) throw Error('Select a published Profile.');
    invalidate(); profile = item.profileId; page = 1; preview = false;
    el('reference-title').textContent = 'Profile ' + profile + ' / references and explicit revision impact';
    el('from-revision').value = ''; el('target-revision').value = String(item.currentRevision);
    if (!el('references-dialog').open) el('references-dialog').showModal();
    await references();
  }
  async function inspectRevision() {
    if (!profile) return;
    const id = profile, version = referenceVersion, connection = epoch;
    try {
      const revision = positiveRevision(el('target-revision').value.trim());
      const record = await request('GET', 'transport-profiles/' + encodeURIComponent(id) + '?revision=' + revision,
        undefined, undefined, { signal: reads.signal });
      if (version !== referenceVersion || connection !== epoch) return;
      if (record.profileId !== id || record.revision !== revision || !/^sha256:[a-f0-9]{64}$/.test(record.configDigest)) throw Error('Invalid immutable Profile revision.');
      detail('Immutable Profile configuration / ' + id + ' / r' + revision + ' / not deployment evidence', record);
    } catch (error) { if (version === referenceVersion && connection === epoch) notify(error.message, true); }
  }
  function clear() {
    epoch++; catalogVersion++; session.abort(); session = new AbortController();
    invalidate(); profile = null; page = 1; preview = false;
    el('references-dialog').close(); el('from-revision').value = ''; el('target-revision').value = '';
    empty('catalog-rows', 'Connect and refresh Relay management to load native declarations.', 4);
  }
  el('references-query').addEventListener('click', () => references(false, 1));
  el('references-preview').addEventListener('click', () => references(true, 1));
  el('revision-inspect').addEventListener('click', inspectRevision);
  el('references-prev').addEventListener('click', () => references(preview, page - 1));
  el('references-next').addEventListener('click', () => references(preview, page + 1));
  el('references-close').addEventListener('click', () => el('references-dialog').close());
  el('references-dialog').addEventListener('close', () => { if (!el('references-dialog').open) invalidate(); });
  for (const name of ['from-revision', 'target-revision']) el(name).addEventListener('input', invalidate);
  clear();
  return { catalog, references, open, clear };
}

export function initRuleConsole({ request, notify, byId, refresh, document: dom = globalThis.document, confirm: ask = globalThis.confirm, newKey = () => crypto.randomUUID() }) {
  const el = byId, selected = new Map(), inputs = new Set();
  let plan = null, active = false, stopped = false, generation = 0, controller = null;
  const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  const revision = value => Number.isSafeInteger(value) && value >= 1;
  const clone = value => JSON.parse(JSON.stringify(value));
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ?
    Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  const completeRejection = error => [400, 401, 403, 404, 409, 413, 422, 429].includes(error.httpStatus);
  const node = (tag, value) => { const n = dom.createElement(tag); if (value !== undefined) n.textContent = String(value); return n; };

  function selectionState() {
    el('rule-selection').textContent = selected.size + ' / 10 selected on this page';
    for (const suffix of ['enable', 'disable']) el('rule-batch-' + suffix).disabled = !selected.size || active;
  }
  function page(dropInputs = true) { selected.clear(); for (const input of inputs) input.checked = false; if (dropInputs) inputs.clear(); selectionState(); }
  function checkbox(item) {
    const input = node('input'); input.type = 'checkbox';
    input.disabled = item.recoverySuspended === true;
    input.setAttribute('aria-label', 'Select Forward ' + item.id);
    input.addEventListener('change', () => {
      if (input.disabled) { input.checked = false; return; }
      if (!input.checked) selected.delete(item.id);
      else if (selected.size >= 10) { input.checked = false; notify('Select at most 10 rules from the current page.', true); }
      else selected.set(item.id, clone(item));
      selectionState();
    });
    inputs.add(input); return input;
  }
  function command(forward, enabled) {
    if (!id(forward.id) || !revision(forward.revision) || forward.recoverySuspended || !forward.spec || typeof forward.spec.enabled !== 'boolean')
      throw Error('Invalid Forward projection; reload the list.');
    return { forwardId: forward.id, expectedRevision: forward.revision, method: 'PUT',
      resource: 'forwards/' + encodeURIComponent(forward.id),
      input: { expectedRevision: forward.revision, spec: { ...clone(forward.spec), enabled } },
      key: newKey(), state: 'pending', result: null, error: '' };
  }
  function unfinished() { return plan?.rows.some(row => ['pending', 'uncertain', 'preflight-failed'].includes(row.state)); }
  function discard() {
    if (active) throw Error('Stop local dispatch before closing or preparing another command.');
    if (unfinished() && !ask('Discard this local command list? An uncertain command may already be accepted remotely. This does not revoke, roll back or cancel any remote operation.')) return false;
    clear(); return true;
  }
  function render() {
    selectionState();
    if (!plan) return;
    const body = el('rule-command-rows'); body.replaceChildren();
    for (const row of plan.rows) {
      const tr = node('tr'), expected = node('td', row.forwardId + ' / expected r' + row.expectedRevision);
      const frozen = node('details'), summary = node('summary', row.method + ' / ' + (row.pathTarget ? 'Path ' + row.pathTarget.templateId + ' -> locked r' + row.pathTarget.revision : row.preflight ? 'Profile ' + row.preflight.profileId + ' -> locked r' + row.preflight.revision : row.input.spec ? 'desired enabled=' + row.input.spec.enabled : 'explicit retry'));
      frozen.append(summary, node('pre', JSON.stringify(row.pathTarget ? { command: row.input, sourceSpec: row.sourceSpec, proposedSpec: row.proposedSpec,
        interruption: 'possible-same-listener-replacement', tcp: 'bounded-drain-or-authorization-deadline', udp: 'associations-may-reset-and-lose-datagrams' } : row.input, null, 2))); expected.append(frozen);
      if (row.preflight) expected.append(node('p', row.check ? 'Fresh plan checked / NOT reserved or authorization for this later update: ' + JSON.stringify(row.check) :
        'Fresh per-rule plan required before the first write. Unknown write replay retains the original key/body, without substituting another plan.'));
      const state = node('td', row.state), result = node('td', row.result ? JSON.stringify(row.result) : row.error || 'Not sent');
      result.className = 'mono';
      const action = node('td');
      if (['uncertain', 'preflight-failed'].includes(row.state)) {
        const replay = node('button', row.state === 'uncertain' ? 'Replay Same Command' : 'Recheck Same Proposal'); replay.type = 'button'; replay.className = 'secondary'; replay.disabled = active || !el('rule-command-consent').checked;
        const current = plan;
        replay.addEventListener('click', () => { if (plan === current) return dispatch(row); }); action.append(replay);
      }
      tr.append(expected, state, result, action); body.append(tr);
    }
    const states = plan.rows.some(row => row.preflight) ? ['pending', 'checking', 'sending', 'accepted', 'unchanged', 'rejected', 'preflight-failed', 'uncertain'] :
      ['pending', 'sending', 'accepted', 'unchanged', 'rejected', 'uncertain'];
    const counts = states.map(state => state + ': ' + plan.rows.filter(row => row.state === state).length).join(' / ');
    el('rule-command-state').textContent = counts + '. Accepted is not applied or healthy; each rule is independent.';
    const sent = plan.rows.some(row => row.state !== 'pending');
    el('rule-command-start').textContent = sent ? 'Continue Unsent Commands' : 'Send Explicit Commands';
    el('rule-command-start').disabled = active || !el('rule-command-consent').checked ||
      plan.rows.some(row => ['uncertain', 'preflight-failed'].includes(row.state)) || !plan.rows.some(row => row.state === 'pending');
    el('rule-command-consent').disabled = active;
    el('rule-command-stop').disabled = !active;
    el('rule-command-close').disabled = active;
  }
  function show(title, rows) {
    plan = { rows }; stopped = false; el('rule-command-title').textContent = title;
    el('rule-command-consent').checked = false; render(); el('rule-command-dialog').showModal();
  }
  function batch(enabled) {
    try {
      if (typeof enabled !== 'boolean' || selected.size < 1 || selected.size > 10) throw Error('Select 1 to 10 rules on the current page.');
      const rows = [...selected.values()].map(item => command(item, enabled));
      if (!discard()) return;
      show(enabled ? 'Enable Selected Rules' : 'Disable Selected Rules', rows);
    } catch (error) { notify(error.message, true); }
  }
  function profileBatch(proposal) {
    try {
      if (!proposal || !id(proposal.profileId) || !revision(proposal.targetRevision) || !/^sha256:[a-f0-9]{64}$/.test(proposal.configDigest) ||
          !Array.isArray(proposal.items) || proposal.items.length < 1 || proposal.items.length > 10 ||
          new Set(proposal.items.map(item => item.forwardId)).size !== proposal.items.length) throw Error('Select 1 to 10 changed rules from one current Profile impact page.');
      const target = Object.freeze({ profileId: proposal.profileId, revision: proposal.targetRevision, configDigest: proposal.configDigest });
      const rows = proposal.items.map(item => {
        if (!id(item.forwardId) || !revision(item.expectedRevision) || item.expectedRevision !== item.revision || item.changed !== true || item.recoverySuspended !== false ||
            !revision(item.configRevision) || item.configRevision === target.revision || item.spec?.transport?.profileId !== target.profileId ||
            item.spec.transport.configRevision !== item.configRevision || !Array.isArray(item.spec.path?.via) || !item.spec.path.via.length || !item.proposedSpec)
          throw Error('Invalid or recovery-suspended Profile impact; query a fresh page.');
        const expected = { ...clone(item.spec), transport: { profileId: target.profileId, configRevision: target.revision } };
        if (JSON.stringify(ordered(expected)) !== JSON.stringify(ordered(item.proposedSpec))) throw Error('Profile batch may change only the explicit locked Profile revision.');
        return { ...command({ id: item.forwardId, revision: item.expectedRevision, recoverySuspended: false, spec: expected }, expected.enabled), preflight: target, check: null };
      });
      if (!discard()) return false;
      show('Explicit Profile ' + target.profileId + ' -> r' + target.revision + ' / Independent Rule Updates', rows); return true;
    } catch (error) { notify(error.message, true); return false; }
  }
  function pathBatch(proposal) {
    try {
      const config = proposal?.config;
      if (!id(proposal?.templateId) || !revision(proposal.targetRevision) || proposal.targetRevision > 64 ||
          !/^sha256:[a-f0-9]{64}$/.test(proposal.configDigest) || !/^sha256:[a-f0-9]{64}$/.test(proposal.profileDigest) ||
          !Array.isArray(config?.nodes) || config.nodes.length < 2 || config.nodes.length > 8 || config.nodes.some(value => !id(value)) ||
          new Set(config.nodes).size !== config.nodes.length || !Array.isArray(config.protocols) || !config.protocols.length || config.protocols.length > 2 ||
          config.protocols.some(value => !['tcp', 'udp'].includes(value)) || new Set(config.protocols).size !== config.protocols.length ||
          !id(config.transport?.profileId) || !revision(config.transport.configRevision) ||
          !Array.isArray(proposal.items) || !proposal.items.length || proposal.items.length > 10 ||
          new Set(proposal.items.map(item => item.forwardId)).size !== proposal.items.length)
        throw Error('Select 1 to 10 available changes from one exact current path impact page.');
      const target = Object.freeze({ templateId: proposal.templateId, revision: proposal.targetRevision, configDigest: proposal.configDigest });
      const preflight = Object.freeze({ profileId: config.transport.profileId, revision: config.transport.configRevision, configDigest: proposal.profileDigest });
      const rows = proposal.items.map(item => {
        if (!id(item.forwardId) || !revision(item.expectedRevision) || item.recoverySuspended !== false || item.changed !== true || item.unavailableReason !== null ||
            item.binding?.templateId !== target.templateId || !revision(item.binding.revision) || item.binding.revision > 64 || !/^sha256:[a-f0-9]{64}$/.test(item.binding.configDigest) ||
            item.spec?.ingress?.nodeId !== config.nodes[0] || !Array.isArray(item.spec.protocols) ||
            JSON.stringify([...item.spec.protocols].sort()) !== JSON.stringify([...config.protocols].sort()) || typeof item.spec.enabled !== 'boolean')
          throw Error('Invalid, unavailable or recovery-suspended path impact; query a fresh page.');
        const sourceSpec = clone(item.spec), proposedSpec = { ...clone(item.spec), path: { via: [...config.nodes.slice(1)] }, transport: clone(config.transport) };
        if (JSON.stringify(ordered(item.proposedSpec)) !== JSON.stringify(ordered(proposedSpec))) throw Error('Path publication may change only the exact path/Profile; target, listener and enabled intent must stay unchanged.');
        const specChanged = JSON.stringify(ordered(sourceSpec)) !== JSON.stringify(ordered(proposedSpec));
        if (!specChanged && item.binding.revision === target.revision && item.binding.configDigest === target.configDigest)
          throw Error('This path binding is already at the exact target.');
        return { forwardId: item.forwardId, expectedRevision: item.expectedRevision, method: 'PUT', resource: 'forwards/' + encodeURIComponent(item.forwardId) + '/path-binding',
          input: { expectedRevision: item.expectedRevision, template: target }, key: newKey(), state: 'pending', result: null, error: '',
          sourceSpec, proposedSpec, specChanged, pathTarget: target, preflight, check: null };
      });
      if (!discard()) return false;
      show('Explicit Path ' + target.templateId + ' -> r' + target.revision + ' / Independent Rule Updates', rows); return true;
    } catch (error) { notify(error.message, true); return false; }
  }
  async function retry(operationId) {
    let version = generation;
    try {
      if (!id(operationId)) throw Error('Invalid Operation ID.');
      if (!discard()) return;
      version = generation; const abort = controller = new AbortController();
      const options = { signal: abort.signal, timeoutMs: 5000 };
      const source = await request('GET', 'operations/' + encodeURIComponent(operationId), undefined, undefined, options);
      if (version !== generation || abort.signal.aborted) return;
      if (source.id !== operationId || !id(source.forwardId) || !revision(source.targetRevision) || source.status !== 'failed' || source.recoveryInvalidated !== false)
        throw Error('Only a current, non-recovered failed Operation can be retried.');
      const current = await request('GET', 'forwards/' + encodeURIComponent(source.forwardId), undefined, undefined, options);
      if (version !== generation || abort.signal.aborted) return;
      if (current.desired?.revision !== source.targetRevision || current.desired.deleting || current.desired.recoverySuspended || current.lastOperation?.id !== source.id)
        throw Error('The source is no longer the latest retryable desired revision; reload diagnostics.');
      show('Retry Failed Operation ' + operationId, [{ forwardId: source.forwardId, expectedRevision: source.targetRevision,
        method: 'POST', resource: 'operations/' + encodeURIComponent(operationId) + '/retry',
        input: { expectedRevision: source.targetRevision }, sourceOperationId: operationId,
        key: newKey(), state: 'pending', result: null, error: '' }]);
    } catch (error) { if (version === generation && !controller?.signal.aborted) notify(error.message, true); }
  }
  function accepted(row, result) {
    if (!result || result.forwardId !== row.forwardId || !revision(result.revision) ||
      !(result.operationId === null || id(result.operationId)) ||
      (row.sourceOperationId ? result.sourceOperationId !== row.sourceOperationId || result.revision !== row.expectedRevision || !result.operationId :
        result.revision !== row.expectedRevision + (result.operationId === null ? 0 : 1)))
      throw Error('Unrecognized acceptance; query the known rule and replay only this same command.');
    if (row.pathTarget) {
      const binding = result.pathBinding, target = row.pathTarget;
      if (result.revision !== row.expectedRevision + (row.specChanged ? 1 : 0) || (result.operationId !== null) !== row.specChanged ||
          binding?.templateId !== target.templateId || binding.revision !== target.revision || binding.configDigest !== target.configDigest ||
          !revision(binding.sequence) || binding.sequence > 64 || !revision(binding.forwardRevision) || binding.forwardRevision > result.revision || typeof binding.changed !== 'boolean')
        throw Error('Unrecognized path receipt; original outcome remains uncertain.');
    }
    return { forwardId: result.forwardId, revision: result.revision, operationId: result.operationId,
      ...(row.pathTarget ? { pathBinding: clone(result.pathBinding) } : {}),
      ...(row.sourceOperationId ? { sourceOperationId: row.sourceOperationId } : {}) };
  }
  async function dispatch(onlyRow) {
    if (active || !plan || !el('rule-command-consent').checked) return;
    if (onlyRow ? !['uncertain', 'preflight-failed'].includes(onlyRow.state) || !plan.rows.includes(onlyRow) : plan.rows.some(row => ['uncertain', 'preflight-failed'].includes(row.state))) return;
    const current = plan, version = generation;
    const rows = onlyRow ? [onlyRow] : plan.rows.filter(row => row.state === 'pending');
    if (!rows.length) return;
    active = true; stopped = false;
    try {
      for (const row of rows) {
        if (stopped || version !== generation) break;
        const replay = row.state === 'uncertain', abort = controller = new AbortController();
        let writeStarted = false;
        if (row.preflight && !replay) row.check = null;
        row.state = row.preflight && !replay ? 'checking' : 'sending'; row.error = ''; render();
        try {
          if (row.preflight && !replay) {
            if (row.pathTarget) {
              const preview = await request('POST', 'forwards/' + encodeURIComponent(row.forwardId) + '/path-preview', clone(row.input), undefined, { signal: abort.signal, timeoutMs: 5000 });
              if (version !== generation || current !== plan) return;
              abort.signal.throwIfAborted();
              if (stopped) throw Error('Local dispatch stopped');
              if (preview?.forwardId !== row.forwardId || preview.expectedRevision !== row.expectedRevision || preview.previewOnly !== true ||
                  preview.reserved !== false || preview.executionAuthorized !== false || preview.fullPlanAuthorization !== false || preview.changed !== row.specChanged ||
                  JSON.stringify(ordered(preview.template)) !== JSON.stringify(ordered(row.pathTarget)) ||
                  JSON.stringify(ordered(preview.spec)) !== JSON.stringify(ordered(row.sourceSpec)) ||
                  JSON.stringify(ordered(preview.proposedSpec)) !== JSON.stringify(ordered(row.proposedSpec)))
                throw Error('Fresh path proposal differs from the frozen command; no intent sent. Recheck explicitly, never replace CAS or target.');
            }
            const checked = await request('POST', 'relay-plan', clone(row.pathTarget ? row.proposedSpec : row.input.spec), undefined, { signal: abort.signal, timeoutMs: 5000 });
            if (version !== generation || current !== plan) return;
            abort.signal.throwIfAborted();
            if (checked?.reserved !== false || checked.executionSupported !== false || checked.runtimeEnabled !== true || checked.profile?.profileId !== row.preflight.profileId ||
                checked.profile.revision !== row.preflight.revision || checked.profile.configDigest !== row.preflight.configDigest)
              throw Error('Unrecognized fresh Profile plan; no intent sent. Recheck the same proposal explicitly.');
            row.check = { profileId: checked.profile.profileId, revision: checked.profile.revision, configDigest: checked.profile.configDigest,
              checkedAt: new Date().toISOString(), reserved: false, executionAuthorized: false };
          }
          abort.signal.throwIfAborted();
          if (stopped) throw Error('Local dispatch stopped');
          row.state = 'sending'; render(); writeStarted = true;
          const result = await request(row.method, row.resource, clone(row.input), row.key, { signal: abort.signal, timeoutMs: 5000 });
          if (version !== generation || current !== plan) return;
          abort.signal.throwIfAborted();
          row.result = accepted(row, result); row.state = row.result.operationId === null ? 'unchanged' : 'accepted';
        } catch (error) {
          if (version !== generation || current !== plan) return;
          // Only complete, recognized client rejection responses establish a definite non-acceptance.
          row.state = !replay && !abort.signal.aborted && completeRejection(error) ? 'rejected' : writeStarted || replay ? 'uncertain' : 'preflight-failed';
          row.error = (replay ? 'Original outcome remains unknown. ' : writeStarted ? '' : 'No intent sent. ') + String(error.message ?? 'Request outcome unknown').slice(0, 260);
        }
        render();
        if (['uncertain', 'preflight-failed'].includes(row.state)) break;
      }
    } finally {
      if (version === generation && current === plan) {
        active = false; controller = null; el('rule-command-consent').checked = false; render();
        try { await refresh(); } catch { if (version === generation) notify('Command results retained; list refresh failed. Refresh manually, not by issuing replacements.', true); }
      }
    }
  }
  function stop() { stopped = true; controller?.abort(); }
  function clear() {
    generation++; stop(); plan = null; active = false; controller = null;
    el('rule-command-dialog').close(); el('rule-command-rows').replaceChildren();
    el('rule-command-title').textContent = 'Explicit Rule Commands';
    el('rule-command-state').textContent = ''; el('rule-command-consent').checked = false;
    el('rule-command-consent').disabled = false;
    for (const suffix of ['start', 'stop']) el('rule-command-' + suffix).disabled = true;
    el('rule-command-close').disabled = false;
    page(false);
  }
  el('rule-batch-enable').addEventListener('click', () => batch(true));
  el('rule-batch-disable').addEventListener('click', () => batch(false));
  el('rule-command-consent').addEventListener('change', render);
  el('rule-command-start').addEventListener('click', () => dispatch());
  el('rule-command-stop').addEventListener('click', stop);
  const close = event => { event?.preventDefault(); try { discard(); } catch (error) { notify(error.message, true); } };
  el('rule-command-close').addEventListener('click', close);
  el('rule-command-dialog').addEventListener('cancel', close);
  selectionState();
  return { page, checkbox, batch, profileBatch, pathBatch, retry, clear };
}

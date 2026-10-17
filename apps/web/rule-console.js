export function initRuleConsole({ request, notify, byId, refresh, document: dom = globalThis.document, confirm: ask = globalThis.confirm, newKey = () => crypto.randomUUID() }) {
  const el = byId, selected = new Map(), inputs = new Set();
  let plan = null, active = false, stopped = false, generation = 0, controller = null;
  const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
  const revision = value => Number.isSafeInteger(value) && value >= 1;
  const clone = value => JSON.parse(JSON.stringify(value));
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
  function unfinished() { return plan?.rows.some(row => ['pending', 'uncertain'].includes(row.state)); }
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
      const frozen = node('details'), summary = node('summary', row.method + ' / ' + (row.input.spec ? 'desired enabled=' + row.input.spec.enabled : 'explicit retry'));
      frozen.append(summary, node('pre', JSON.stringify(row.input, null, 2))); expected.append(frozen);
      const state = node('td', row.state), result = node('td', row.result ? JSON.stringify(row.result) : row.error || 'Not sent');
      result.className = 'mono';
      const action = node('td');
      if (row.state === 'uncertain') {
        const replay = node('button', 'Replay Same Command'); replay.type = 'button'; replay.className = 'secondary'; replay.disabled = active || !el('rule-command-consent').checked;
        const current = plan;
        replay.addEventListener('click', () => { if (plan === current) return dispatch(row); }); action.append(replay);
      }
      tr.append(expected, state, result, action); body.append(tr);
    }
    const counts = ['pending', 'sending', 'accepted', 'unchanged', 'rejected', 'uncertain'].map(state => state + ': ' + plan.rows.filter(row => row.state === state).length).join(' / ');
    el('rule-command-state').textContent = counts + '. Accepted is not applied or healthy; each rule is independent.';
    const sent = plan.rows.some(row => row.state !== 'pending');
    el('rule-command-start').textContent = sent ? 'Continue Unsent Commands' : 'Send Explicit Commands';
    el('rule-command-start').disabled = active || !el('rule-command-consent').checked ||
      plan.rows.some(row => row.state === 'uncertain') || !plan.rows.some(row => row.state === 'pending');
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
    return { forwardId: result.forwardId, revision: result.revision, operationId: result.operationId,
      ...(row.sourceOperationId ? { sourceOperationId: row.sourceOperationId } : {}) };
  }
  async function dispatch(onlyRow) {
    if (active || !plan || !el('rule-command-consent').checked) return;
    if (onlyRow ? onlyRow.state !== 'uncertain' || !plan.rows.includes(onlyRow) : plan.rows.some(row => row.state === 'uncertain')) return;
    const current = plan, version = generation;
    const rows = onlyRow ? [onlyRow] : plan.rows.filter(row => row.state === 'pending');
    if (!rows.length) return;
    active = true; stopped = false;
    try {
      for (const row of rows) {
        if (stopped || version !== generation) break;
        const abort = controller = new AbortController(); row.state = 'sending'; row.error = ''; render();
        try {
          const result = await request(row.method, row.resource, clone(row.input), row.key, { signal: abort.signal, timeoutMs: 5000 });
          if (version !== generation || current !== plan) return;
          abort.signal.throwIfAborted();
          row.result = accepted(row, result); row.state = row.result.operationId === null ? 'unchanged' : 'accepted';
        } catch (error) {
          if (version !== generation || current !== plan) return;
          // Only complete, recognized client rejection responses establish a definite non-acceptance.
          row.state = !abort.signal.aborted && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.httpStatus) ? 'rejected' : 'uncertain';
          row.error = String(error.message ?? 'Request outcome unknown').slice(0, 300);
        }
        render();
        if (row.state === 'uncertain') break;
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
  return { page, checkbox, batch, retry, clear };
}

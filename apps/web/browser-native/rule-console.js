export function createNativeRuleConsole(createCommands) {
  return function initRuleConsole({ request, notify, byId, refresh, document: dom = globalThis.document, confirm: ask = globalThis.confirm, newKey = () => crypto.randomUUID() }) {
    const el = byId;
    const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ?
      Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
    const commands = createCommands({ request, notify, refresh,
      view: { selectionState, resetInputs, render, show, clear: clearView,
        consented: () => el('rule-command-consent').checked,
        clearConsent: () => { el('rule-command-consent').checked = false; } },
      effects: {
        id: value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value),
        revision: value => Number.isSafeInteger(value) && value >= 1,
        hash: value => /^sha256:[a-f0-9]{64}$/.test(value),
        clone: value => JSON.parse(JSON.stringify(value)), ordered, json: value => JSON.stringify(value),
        encode: value => encodeURIComponent(value), newKey: () => newKey(), confirm: message => ask(message),
        newAbort: () => new AbortController(), options: abort => ({ signal: abort.signal, timeoutMs: 5000 }),
        aborted: abort => abort?.signal.aborted, throwIfAborted: abort => abort.signal.throwIfAborted(), abort: abort => abort?.abort(),
        checkedAt: () => new Date().toISOString(),
        completeRejection: error => [400, 401, 403, 404, 409, 413, 422, 429].includes(error.httpStatus),
        errorText: error => String(error.message ?? 'Request outcome unknown').slice(0, 260),
      } });
    const state = commands.state, inputs = new Set();
    const node = (tag, value) => { const n = dom.createElement(tag); if (value !== undefined) n.textContent = String(value); return n; };

    function selectionState() {
      el('rule-selection').textContent = state.selected.size + ' / 10 selected on this page';
      for (const suffix of ['enable', 'disable']) el('rule-batch-' + suffix).disabled = !state.selected.size || state.active;
    }
    function resetInputs(dropInputs) {
      for (const input of inputs) input.checked = false;
      if (dropInputs) inputs.clear();
    }
    function checkbox(item) {
      const input = node('input'); input.type = 'checkbox';
      input.disabled = item.recoverySuspended === true;
      input.setAttribute('aria-label', 'Select Forward ' + item.id);
      input.addEventListener('change', () => {
        if (input.disabled) { input.checked = false; return; }
        commands.select(item, input.checked, () => { input.checked = false; });
      });
      inputs.add(input); return input;
    }
    function render() {
      selectionState();
      if (!state.plan) return;
      const body = el('rule-command-rows'); body.replaceChildren();
      for (const row of state.plan.rows) {
        const tr = node('tr'), expected = node('td', row.forwardId + ' / expected r' + row.expectedRevision);
        const frozen = node('details'), summary = node('summary', row.method + ' / ' + (row.pathTarget ? 'Path ' + row.pathTarget.templateId + ' -> locked r' + row.pathTarget.revision : row.preflight ? 'Profile ' + row.preflight.profileId + ' -> locked r' + row.preflight.revision : row.input.spec ? 'desired enabled=' + row.input.spec.enabled : 'explicit retry'));
        frozen.append(summary, node('pre', JSON.stringify(row.pathTarget ? { command: row.input, sourceSpec: row.sourceSpec, proposedSpec: row.proposedSpec,
          interruption: 'possible-same-listener-replacement', tcp: 'bounded-drain-or-authorization-deadline', udp: 'associations-may-reset-and-lose-datagrams' } : row.input, null, 2))); expected.append(frozen);
        if (row.preflight) expected.append(node('p', row.check ? 'Fresh plan checked / NOT reserved or authorization for this later update: ' + JSON.stringify(row.check) :
          'Fresh per-rule plan required before the first write. Unknown write replay retains the original key/body, without substituting another plan.'));
        const rowState = node('td', row.state), result = node('td', row.result ? JSON.stringify(row.result) : row.error || 'Not sent');
        result.className = 'mono';
        const action = node('td');
        if (['uncertain', 'preflight-failed'].includes(row.state)) {
          const replay = node('button', row.state === 'uncertain' ? 'Replay Same Command' : 'Recheck Same Proposal'); replay.type = 'button'; replay.className = 'secondary'; replay.disabled = state.active || !el('rule-command-consent').checked;
          const current = state.plan;
          replay.addEventListener('click', () => { if (state.plan === current) return commands.dispatch(row); }); action.append(replay);
        }
        tr.append(expected, rowState, result, action); body.append(tr);
      }
      const states = state.plan.rows.some(row => row.preflight) ? ['pending', 'checking', 'sending', 'accepted', 'unchanged', 'rejected', 'preflight-failed', 'uncertain'] :
        ['pending', 'sending', 'accepted', 'unchanged', 'rejected', 'uncertain'];
      const counts = states.map(value => value + ': ' + state.plan.rows.filter(row => row.state === value).length).join(' / ');
      el('rule-command-state').textContent = counts + '. Accepted is not applied or healthy; each rule is independent.';
      const sent = state.plan.rows.some(row => row.state !== 'pending');
      el('rule-command-start').textContent = sent ? 'Continue Unsent Commands' : 'Send Explicit Commands';
      el('rule-command-start').disabled = state.active || !el('rule-command-consent').checked ||
        state.plan.rows.some(row => ['uncertain', 'preflight-failed'].includes(row.state)) || !state.plan.rows.some(row => row.state === 'pending');
      el('rule-command-consent').disabled = state.active;
      el('rule-command-stop').disabled = !state.active;
      el('rule-command-close').disabled = state.active;
    }
    function show(title) {
      el('rule-command-title').textContent = title;
      el('rule-command-consent').checked = false; render(); el('rule-command-dialog').showModal();
    }
    function clearView() {
      el('rule-command-dialog').close(); el('rule-command-rows').replaceChildren();
      el('rule-command-title').textContent = 'Explicit Rule Commands';
      el('rule-command-state').textContent = ''; el('rule-command-consent').checked = false;
      el('rule-command-consent').disabled = false;
      for (const suffix of ['start', 'stop']) el('rule-command-' + suffix).disabled = true;
      el('rule-command-close').disabled = false;
    }
    el('rule-batch-enable').addEventListener('click', () => commands.batch(true));
    el('rule-batch-disable').addEventListener('click', () => commands.batch(false));
    el('rule-command-consent').addEventListener('change', render);
    el('rule-command-start').addEventListener('click', () => commands.dispatch());
    el('rule-command-stop').addEventListener('click', commands.stop);
    const close = event => { event?.preventDefault(); try { commands.discard(); } catch (error) { notify(error.message, true); } };
    el('rule-command-close').addEventListener('click', close);
    el('rule-command-dialog').addEventListener('cancel', close);
    selectionState();
    return { page: commands.page, checkbox, batch: commands.batch, profileBatch: commands.profileBatch,
      pathBatch: commands.pathBatch, retry: commands.retry, clear: commands.clear };
  };
}

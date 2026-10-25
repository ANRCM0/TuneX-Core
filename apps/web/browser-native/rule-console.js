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
    const state = commands.state, inputs = new Map();
    const node = (tag, value) => { const n = dom.createElement(tag); if (value !== undefined) n.textContent = String(value); return n; };
    const statusLabels = { pending: '待提交', checking: '检查方案中', sending: '提交中', accepted: '已接收，待确认部署',
      unchanged: '配置无需变更', rejected: '请求被拒绝', 'preflight-failed': '方案检查未完成', uncertain: '提交结果未知' };

    function selectionState() {
      let available = 0, suspended = 0;
      for (const [input, item] of inputs) {
        if (item.recoverySuspended === true) suspended++; else available++;
        input.disabled = state.active || item.recoverySuspended === true;
      }
      el('rule-selection').textContent = '已选 ' + state.selected.size + ' / 10 条 · 本页可选 ' + available + ' 条' +
        (suspended ? '，恢复暂停 ' + suspended + ' 条暂不可选' : '');
      el('rule-select-page').disabled = state.active || state.selected.size >= Math.min(10, available);
      el('rule-clear-selection').disabled = state.active || !state.selected.size;
      for (const suffix of ['enable', 'disable']) el('rule-batch-' + suffix).disabled = !state.selected.size || state.active;
    }
    function resetInputs(dropInputs) {
      for (const input of inputs.keys()) input.checked = false;
      if (dropInputs) inputs.clear();
    }
    function checkbox(item) {
      const input = node('input'); input.type = 'checkbox';
      input.disabled = state.active || item.recoverySuspended === true;
      input.setAttribute('aria-label', '选择转发 ' + item.id);
      if (item.recoverySuspended === true) input.title = '恢复暂停中，请先完成恢复审查';
      input.addEventListener('change', () => {
        if (input.disabled) { input.checked = false; return; }
        commands.select(item, input.checked, () => { input.checked = false; });
      });
      inputs.set(input, item); selectionState(); return input;
    }
    function render() {
      selectionState();
      if (!state.plan) return;
      const body = el('rule-command-rows'); body.replaceChildren();
      for (const row of state.plan.rows) {
        const tr = node('tr'), expected = node('td', row.forwardId + ' · 原版本 r' + row.expectedRevision);
        const frozen = node('details'), summary = node('summary', row.pathTarget ? '更新线路 ' + row.pathTarget.templateId + ' 至 r' + row.pathTarget.revision : row.preflight ? '更新传输配置 ' + row.preflight.profileId + ' 至 r' + row.preflight.revision : row.input.spec ? row.input.spec.enabled ? '启用这条转发' : '停用这条转发' : '重试原失败操作');
        frozen.append(summary, node('pre', JSON.stringify(row.pathTarget ? { command: row.input, sourceSpec: row.sourceSpec, proposedSpec: row.proposedSpec,
          interruption: 'possible-same-listener-replacement', tcp: 'bounded-drain-or-authorization-deadline', udp: 'associations-may-reset-and-lose-datagrams' } : row.input, null, 2))); expected.append(frozen);
        if (row.preflight) expected.append(node('p', row.check ? '本项方案检查已完成；提交时仍需重新核对权限与资源。检查不预留资源。' :
          '首次提交前检查本项方案。提交结果未知时只重试原请求。'));
        const rowState = node('td', statusLabels[row.state] ?? row.state), result = node('td');
        rowState.setAttribute('data-state', row.state);
        const guidance = row.result ? row.result.operationId === null ? '配置无需变更；没有产生新的部署操作。' :
          '请求已接收。请到执行记录核对操作 ' + row.result.operationId + '，再确认实际转发结果。' :
          ({ pending: '确认后才会提交。', checking: '正在检查当前方案，尚未提交配置。', sending: '正在等待提交回执。',
            rejected: '本次请求被拒绝，请查看原因并刷新规则后重新评估。',
            'preflight-failed': '本次未提交配置。确认后可重新检查原方案。',
            uncertain: '可能已经提交。确认后仅重试原请求，暂不继续后续规则。' }[row.state] ?? '请查看原始结果。');
        result.append(node('p', guidance));
        if (row.result || row.error) {
          const detail = node('details'); detail.append(node('summary', row.result ? '查看原始回执' : '查看原始原因'),
            node('pre', row.result ? JSON.stringify(row.result, null, 2) : row.error)); result.append(detail);
        }
        const action = node('td');
        if (['uncertain', 'preflight-failed'].includes(row.state)) {
          const replay = node('button', row.state === 'uncertain' ? '重试原请求' : '重新检查原方案'); replay.type = 'button'; replay.className = 'secondary'; replay.disabled = state.active || !el('rule-command-consent').checked;
          const current = state.plan;
          replay.addEventListener('click', () => { if (state.plan === current) return commands.dispatch(row); }); action.append(replay);
        }
        tr.append(expected, rowState, result, action); body.append(tr);
      }
      const states = state.plan.rows.some(row => row.preflight) ? ['pending', 'checking', 'sending', 'accepted', 'unchanged', 'rejected', 'preflight-failed', 'uncertain'] :
        ['pending', 'sending', 'accepted', 'unchanged', 'rejected', 'uncertain'];
      const counts = states.map(value => ({ value, count: state.plan.rows.filter(row => row.state === value).length }))
        .filter(item => item.count > 0).map(item => statusLabels[item.value] + ' ' + item.count + ' 条').join(' · ');
      el('rule-command-state').textContent = counts + '。每条独立执行；已接收不代表部署完成或业务可用。';
      const sent = state.plan.rows.some(row => row.state !== 'pending');
      const pending = state.plan.rows.filter(row => row.state === 'pending').length;
      el('rule-command-start').textContent = !pending ? '没有待提交规则' : sent ? '继续提交剩余 ' + pending + ' 条' : '确认并提交这 ' + pending + ' 条';
      el('rule-command-start').disabled = state.active || !el('rule-command-consent').checked ||
        state.plan.rows.some(row => ['uncertain', 'preflight-failed'].includes(row.state)) || !state.plan.rows.some(row => row.state === 'pending');
      el('rule-command-consent').disabled = state.active;
      el('rule-command-stop').disabled = !state.active;
      el('rule-command-close').disabled = state.active;
    }
    function show(title) {
      el('rule-command-title').textContent = title === 'Enable Selected Rules' ? '批量启用转发' : title === 'Disable Selected Rules' ? '批量停用转发' :
        title.startsWith('Explicit Profile ') ? '批量更新传输配置' : title.startsWith('Explicit Path ') ? '批量更新线路' :
        title.startsWith('Retry Failed Operation ') ? '重试失败操作' : title;
      el('rule-command-consent').checked = false; render(); el('rule-command-dialog').showModal();
    }
    function clearView() {
      el('rule-command-dialog').close(); el('rule-command-rows').replaceChildren();
      el('rule-command-title').textContent = '批量操作确认';
      el('rule-command-state').textContent = ''; el('rule-command-consent').checked = false;
      el('rule-command-consent').disabled = false;
      for (const suffix of ['start', 'stop']) el('rule-command-' + suffix).disabled = true;
      el('rule-command-close').disabled = false;
    }
    el('rule-select-page').addEventListener('click', () => {
      if (state.active) return;
      for (const [input, item] of inputs) {
        if (state.selected.size >= 10) break;
        if (input.disabled || state.selected.has(item.id)) continue;
        input.checked = true; commands.select(item, true, () => { input.checked = false; });
      }
    });
    el('rule-clear-selection').addEventListener('click', () => { if (!state.active) commands.page(false); });
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

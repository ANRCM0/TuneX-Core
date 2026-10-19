export function createRuleCommands({ request, notify, refresh, view, effects }) {
  const state = { selected: new Map(), plan: null, active: false, stopped: false, generation: 0, controller: null };
  function select(item, checked, uncheck) {
    if (!checked) state.selected.delete(item.id);
    else if (state.selected.size >= 10) { uncheck(); notify('Select at most 10 rules from the current page.', true); }
    else state.selected.set(item.id, effects.clone(item));
    view.selectionState();
  }
  function page(dropInputs = true) {
    state.selected.clear(); view.resetInputs(dropInputs); view.selectionState();
  }
  function command(forward, enabled) {
    if (!effects.id(forward.id) || !effects.revision(forward.revision) || forward.recoverySuspended || !forward.spec || typeof forward.spec.enabled !== 'boolean')
      throw Error('Invalid Forward projection; reload the list.');
    return { forwardId: forward.id, expectedRevision: forward.revision, method: 'PUT',
      resource: 'forwards/' + effects.encode(forward.id),
      input: { expectedRevision: forward.revision, spec: { ...effects.clone(forward.spec), enabled } },
      key: effects.newKey(), state: 'pending', result: null, error: '' };
  }
  function unfinished() { return state.plan?.rows.some(row => ['pending', 'uncertain', 'preflight-failed'].includes(row.state)); }
  function discard() {
    if (state.active) throw Error('Stop local dispatch before closing or preparing another command.');
    if (unfinished() && !effects.confirm('Discard this local command list? An uncertain command may already be accepted remotely. This does not revoke, roll back or cancel any remote operation.')) return false;
    clear(); return true;
  }
  function show(title, rows) {
    state.plan = { rows }; state.stopped = false; view.show(title);
  }
  function batch(enabled) {
    try {
      if (typeof enabled !== 'boolean' || state.selected.size < 1 || state.selected.size > 10) throw Error('Select 1 to 10 rules on the current page.');
      const rows = [...state.selected.values()].map(item => command(item, enabled));
      if (!discard()) return;
      show(enabled ? 'Enable Selected Rules' : 'Disable Selected Rules', rows);
    } catch (error) { notify(error.message, true); }
  }
  function profileBatch(proposal) {
    try {
      if (!proposal || !effects.id(proposal.profileId) || !effects.revision(proposal.targetRevision) || !effects.hash(proposal.configDigest) ||
          !Array.isArray(proposal.items) || proposal.items.length < 1 || proposal.items.length > 10 ||
          new Set(proposal.items.map(item => item.forwardId)).size !== proposal.items.length) throw Error('Select 1 to 10 changed rules from one current Profile impact page.');
      const target = Object.freeze({ profileId: proposal.profileId, revision: proposal.targetRevision, configDigest: proposal.configDigest });
      const rows = proposal.items.map(item => {
        if (!effects.id(item.forwardId) || !effects.revision(item.expectedRevision) || item.expectedRevision !== item.revision || item.changed !== true || item.recoverySuspended !== false ||
            !effects.revision(item.configRevision) || item.configRevision === target.revision || item.spec?.transport?.profileId !== target.profileId ||
            item.spec.transport.configRevision !== item.configRevision || !Array.isArray(item.spec.path?.via) || !item.spec.path.via.length || !item.proposedSpec)
          throw Error('Invalid or recovery-suspended Profile impact; query a fresh page.');
        const expected = { ...effects.clone(item.spec), transport: { profileId: target.profileId, configRevision: target.revision } };
        if (effects.json(effects.ordered(expected)) !== effects.json(effects.ordered(item.proposedSpec))) throw Error('Profile batch may change only the explicit locked Profile revision.');
        return { ...command({ id: item.forwardId, revision: item.expectedRevision, recoverySuspended: false, spec: expected }, expected.enabled), preflight: target, check: null };
      });
      if (!discard()) return false;
      show('Explicit Profile ' + target.profileId + ' -> r' + target.revision + ' / Independent Rule Updates', rows); return true;
    } catch (error) { notify(error.message, true); return false; }
  }
  function pathBatch(proposal) {
    try {
      const config = proposal?.config;
      if (!effects.id(proposal?.templateId) || !effects.revision(proposal.targetRevision) || proposal.targetRevision > 64 ||
          !effects.hash(proposal.configDigest) || !effects.hash(proposal.profileDigest) ||
          !Array.isArray(config?.nodes) || config.nodes.length < 2 || config.nodes.length > 8 || config.nodes.some(value => !effects.id(value)) ||
          new Set(config.nodes).size !== config.nodes.length || !Array.isArray(config.protocols) || !config.protocols.length || config.protocols.length > 2 ||
          config.protocols.some(value => !['tcp', 'udp'].includes(value)) || new Set(config.protocols).size !== config.protocols.length ||
          !effects.id(config.transport?.profileId) || !effects.revision(config.transport.configRevision) ||
          !Array.isArray(proposal.items) || !proposal.items.length || proposal.items.length > 10 ||
          new Set(proposal.items.map(item => item.forwardId)).size !== proposal.items.length)
        throw Error('Select 1 to 10 available changes from one exact current path impact page.');
      const target = Object.freeze({ templateId: proposal.templateId, revision: proposal.targetRevision, configDigest: proposal.configDigest });
      const preflight = Object.freeze({ profileId: config.transport.profileId, revision: config.transport.configRevision, configDigest: proposal.profileDigest });
      const rows = proposal.items.map(item => {
        if (!effects.id(item.forwardId) || !effects.revision(item.expectedRevision) || item.recoverySuspended !== false || item.changed !== true || item.unavailableReason !== null ||
            item.binding?.templateId !== target.templateId || !effects.revision(item.binding.revision) || item.binding.revision > 64 || !effects.hash(item.binding.configDigest) ||
            item.spec?.ingress?.nodeId !== config.nodes[0] || !Array.isArray(item.spec.protocols) ||
            effects.json([...item.spec.protocols].sort()) !== effects.json([...config.protocols].sort()) || typeof item.spec.enabled !== 'boolean')
          throw Error('Invalid, unavailable or recovery-suspended path impact; query a fresh page.');
        const sourceSpec = effects.clone(item.spec), proposedSpec = { ...effects.clone(item.spec), path: { via: [...config.nodes.slice(1)] }, transport: effects.clone(config.transport) };
        if (effects.json(effects.ordered(item.proposedSpec)) !== effects.json(effects.ordered(proposedSpec))) throw Error('Path publication may change only the exact path/Profile; target, listener and enabled intent must stay unchanged.');
        const specChanged = effects.json(effects.ordered(sourceSpec)) !== effects.json(effects.ordered(proposedSpec));
        if (!specChanged && item.binding.revision === target.revision && item.binding.configDigest === target.configDigest)
          throw Error('This path binding is already at the exact target.');
        return { forwardId: item.forwardId, expectedRevision: item.expectedRevision, method: 'PUT', resource: 'forwards/' + effects.encode(item.forwardId) + '/path-binding',
          input: { expectedRevision: item.expectedRevision, template: target }, key: effects.newKey(), state: 'pending', result: null, error: '',
          sourceSpec, proposedSpec, specChanged, pathTarget: target, preflight, check: null };
      });
      if (!discard()) return false;
      show('Explicit Path ' + target.templateId + ' -> r' + target.revision + ' / Independent Rule Updates', rows); return true;
    } catch (error) { notify(error.message, true); return false; }
  }
  async function retry(operationId) {
    let version = state.generation;
    try {
      if (!effects.id(operationId)) throw Error('Invalid Operation ID.');
      if (!discard()) return;
      version = state.generation; const abort = state.controller = effects.newAbort();
      const options = effects.options(abort);
      const source = await request('GET', 'operations/' + effects.encode(operationId), undefined, undefined, options);
      if (version !== state.generation || effects.aborted(abort)) return;
      if (source.id !== operationId || !effects.id(source.forwardId) || !effects.revision(source.targetRevision) || source.status !== 'failed' || source.recoveryInvalidated !== false)
        throw Error('Only a current, non-recovered failed Operation can be retried.');
      const current = await request('GET', 'forwards/' + effects.encode(source.forwardId), undefined, undefined, options);
      if (version !== state.generation || effects.aborted(abort)) return;
      if (current.desired?.revision !== source.targetRevision || current.desired.deleting || current.desired.recoverySuspended || current.lastOperation?.id !== source.id)
        throw Error('The source is no longer the latest retryable desired revision; reload diagnostics.');
      show('Retry Failed Operation ' + operationId, [{ forwardId: source.forwardId, expectedRevision: source.targetRevision,
        method: 'POST', resource: 'operations/' + effects.encode(operationId) + '/retry',
        input: { expectedRevision: source.targetRevision }, sourceOperationId: operationId,
        key: effects.newKey(), state: 'pending', result: null, error: '' }]);
    } catch (error) { if (version === state.generation && !effects.aborted(state.controller)) notify(error.message, true); }
  }
  function accepted(row, result) {
    if (!result || result.forwardId !== row.forwardId || !effects.revision(result.revision) ||
        !(result.operationId === null || effects.id(result.operationId)) ||
        (row.sourceOperationId ? result.sourceOperationId !== row.sourceOperationId || result.revision !== row.expectedRevision || !result.operationId :
          result.revision !== row.expectedRevision + (result.operationId === null ? 0 : 1)))
      throw Error('Unrecognized acceptance; query the known rule and replay only this same command.');
    if (row.pathTarget) {
      const binding = result.pathBinding, target = row.pathTarget;
      if (result.revision !== row.expectedRevision + (row.specChanged ? 1 : 0) || (result.operationId !== null) !== row.specChanged ||
          binding?.templateId !== target.templateId || binding.revision !== target.revision || binding.configDigest !== target.configDigest ||
          !effects.revision(binding.sequence) || binding.sequence > 64 || !effects.revision(binding.forwardRevision) || binding.forwardRevision > result.revision || typeof binding.changed !== 'boolean')
        throw Error('Unrecognized path receipt; original outcome remains uncertain.');
    }
    return { forwardId: result.forwardId, revision: result.revision, operationId: result.operationId,
      ...(row.pathTarget ? { pathBinding: effects.clone(result.pathBinding) } : {}),
      ...(row.sourceOperationId ? { sourceOperationId: row.sourceOperationId } : {}) };
  }
  async function dispatch(onlyRow) {
    if (state.active || !state.plan || !view.consented()) return;
    if (onlyRow ? !['uncertain', 'preflight-failed'].includes(onlyRow.state) || !state.plan.rows.includes(onlyRow) : state.plan.rows.some(row => ['uncertain', 'preflight-failed'].includes(row.state))) return;
    const current = state.plan, version = state.generation;
    const rows = onlyRow ? [onlyRow] : state.plan.rows.filter(row => row.state === 'pending');
    if (!rows.length) return;
    state.active = true; state.stopped = false;
    try {
      for (const row of rows) {
        if (state.stopped || version !== state.generation) break;
        const replay = row.state === 'uncertain', abort = state.controller = effects.newAbort();
        let writeStarted = false;
        if (row.preflight && !replay) row.check = null;
        row.state = row.preflight && !replay ? 'checking' : 'sending'; row.error = ''; view.render();
        try {
          if (row.preflight && !replay) {
            if (row.pathTarget) {
              const preview = await request('POST', 'forwards/' + effects.encode(row.forwardId) + '/path-preview', effects.clone(row.input), undefined, effects.options(abort));
              if (version !== state.generation || current !== state.plan) return;
              effects.throwIfAborted(abort);
              if (state.stopped) throw Error('Local dispatch stopped');
              if (preview?.forwardId !== row.forwardId || preview.expectedRevision !== row.expectedRevision || preview.previewOnly !== true ||
                  preview.reserved !== false || preview.executionAuthorized !== false || preview.fullPlanAuthorization !== false || preview.changed !== row.specChanged ||
                  effects.json(effects.ordered(preview.template)) !== effects.json(effects.ordered(row.pathTarget)) ||
                  effects.json(effects.ordered(preview.spec)) !== effects.json(effects.ordered(row.sourceSpec)) ||
                  effects.json(effects.ordered(preview.proposedSpec)) !== effects.json(effects.ordered(row.proposedSpec)))
                throw Error('Fresh path proposal differs from the frozen command; no intent sent. Recheck explicitly, never replace CAS or target.');
            }
            const checked = await request('POST', 'relay-plan', effects.clone(row.pathTarget ? row.proposedSpec : row.input.spec), undefined, effects.options(abort));
            if (version !== state.generation || current !== state.plan) return;
            effects.throwIfAborted(abort);
            if (checked?.reserved !== false || checked.executionSupported !== false || checked.runtimeEnabled !== true || checked.profile?.profileId !== row.preflight.profileId ||
                checked.profile.revision !== row.preflight.revision || checked.profile.configDigest !== row.preflight.configDigest)
              throw Error('Unrecognized fresh Profile plan; no intent sent. Recheck the same proposal explicitly.');
            row.check = { profileId: checked.profile.profileId, revision: checked.profile.revision, configDigest: checked.profile.configDigest,
              checkedAt: effects.checkedAt(), reserved: false, executionAuthorized: false };
          }
          effects.throwIfAborted(abort);
          if (state.stopped) throw Error('Local dispatch stopped');
          row.state = 'sending'; view.render(); writeStarted = true;
          const result = await request(row.method, row.resource, effects.clone(row.input), row.key, effects.options(abort));
          if (version !== state.generation || current !== state.plan) return;
          effects.throwIfAborted(abort);
          row.result = accepted(row, result); row.state = row.result.operationId === null ? 'unchanged' : 'accepted';
        } catch (error) {
          if (version !== state.generation || current !== state.plan) return;
          // Replay refusal cannot disprove an earlier uncertain write.
          row.state = !replay && !effects.aborted(abort) && effects.completeRejection(error) ? 'rejected' : writeStarted || replay ? 'uncertain' : 'preflight-failed';
          row.error = (replay ? 'Original outcome remains unknown. ' : writeStarted ? '' : 'No intent sent. ') + effects.errorText(error);
        }
        view.render();
        if (['uncertain', 'preflight-failed'].includes(row.state)) break;
      }
    } finally {
      if (version === state.generation && current === state.plan) {
        state.active = false; state.controller = null; view.clearConsent(); view.render();
        try { await refresh(); } catch { if (version === state.generation) notify('Command results retained; list refresh failed. Refresh manually, not by issuing replacements.', true); }
      }
    }
  }
  function stop() { state.stopped = true; effects.abort(state.controller); }
  function clear() {
    state.generation++; stop(); state.plan = null; state.active = false; state.controller = null;
    view.clear(); page(false);
  }
  return { state, select, page, batch, profileBatch, pathBatch, retry, dispatch, stop, discard, clear };
}

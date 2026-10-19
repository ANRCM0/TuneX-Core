export function createConsoleRequests(state, effects) {
  const pendingKeys = new Map();

  function connected() {
    if (!state.scope() || !state.token()) throw new Error('请先连接 Control');
  }
  async function request(method, resource, input, stableKey, options = {}) {
    connected();
    const version = state.version();
    const response = await effects.send(state, method, resource, input, stableKey, options);
    let result;
    try { result = await effects.readJson(response); } catch { throw new Error('Control 返回了非 JSON 响应'); }
    if (version !== state.version()) throw new Error('连接已变化，已丢弃旧请求结果');
    effects.throwIfAborted(options);
    effects.checkResponse(response, result);
    return result;
  }
  async function mutate(method, resource, input) {
    const signature = effects.signature(method, resource, input);
    if (!pendingKeys.has(signature)) pendingKeys.set(signature, effects.newKey());
    const result = await request(method, resource, input, pendingKeys.get(signature));
    pendingKeys.delete(signature);
    return result;
  }
  function clearPending() { pendingKeys.clear(); }

  return { connected, request, mutate, clearPending };
}

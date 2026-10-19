export const BROWSER_NATIVE_INTERFACE_VERSION = 1;
export { createNativeRuleConsole } from './rule-console.js';
export { mountControlConsole } from './control-console.js';
export { createNativeRelayForms } from './relay-forms.js';
export { createNativeRelayConsole } from './relay-console.js';

export const browserConsoleModelEffects = {
  credentialActive: readValue => Date.parse(readValue()) > Date.now(),
  listResource(kind, page, filters) {
    const query = new URLSearchParams({ page: String(page), limit: '25' });
    for (const [key, value] of Object.entries(filters)) if (value !== '') query.set(key, String(value));
    return kind + '?' + query;
  },
};

export const browserConsoleRequestEffects = {
  send(state, method, resource, input, stableKey, options) {
    const headers = { Authorization: 'Bearer ' + state.token(), Accept: 'application/json' };
    if (input !== undefined) headers['Content-Type'] = 'application/json';
    if (stableKey) headers['Idempotency-Key'] = stableKey;
    return fetch('/api/v1/scopes/' + encodeURIComponent(state.scope()) + '/' + resource, {
      method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error',
      referrerPolicy: 'no-referrer', signal: AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? 15000), ...(options.signal ? [options.signal] : [])]),
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
  },
  readJson: response => response.json(),
  throwIfAborted: options => options.signal?.throwIfAborted(),
  checkResponse(response, result) {
    if (!response.ok) {
      const error = new Error(String(result.code ?? 'HTTP_' + response.status) + '：' + String(result.message ?? '请求失败'));
      error.httpStatus = response.status;
      throw error;
    }
  },
  signature: (method, resource, input) => JSON.stringify([method, resource, input]),
  newKey: () => crypto.randomUUID(),
};

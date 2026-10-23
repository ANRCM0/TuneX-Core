const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

export function identityContextView(value, after = null) {
  if (!validId(value?.actorId) || value.limit !== 100 || !Array.isArray(value.scopes) || value.scopes.length > 100 ||
      typeof value.truncated !== 'boolean' || (value.truncated ? !validId(value.nextAfter) : value.nextAfter !== null))
    throw Error('账号上下文响应无效');
  let previous = after;
  for (const scope of value.scopes) {
    if (!validId(scope.scopeId) || previous !== null && scope.scopeId <= previous ||
        !['owner','manager','viewer'].includes(scope.role) || !['active','inactive','absent'].includes(scope.membership) ||
        typeof scope.canEnter !== 'boolean' || typeof scope.canManage !== 'boolean' ||
        scope.canEnter !== (scope.membership === 'active') ||
        (scope.membershipRevision !== null && (!Number.isSafeInteger(scope.membershipRevision) || scope.membershipRevision < 1)))
      throw Error('账号空间记录无效');
    previous = scope.scopeId;
  }
  if (value.truncated && value.nextAfter !== previous) throw Error('账号空间分页游标无效');
  return value;
}

export async function readIdentityContext(token, { after = null, signal, send = globalThis.fetch } = {}) {
  const response = await send('/api/v1/me/context?limit=100' + (after ? '&after=' + encodeURIComponent(after) : ''), {
    method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]),
  });
  let value;
  try { value = await response.json(); } catch { throw Error('Control 返回了非 JSON 账号上下文'); }
  if (!response.ok) throw Error(String(value.code ?? 'HTTP_' + response.status) + '：' + String(value.message ?? '登录失败'));
  return identityContextView(value, after);
}

export const scopeGovernance = scope => scope?.canEnter === true && scope.role === 'owner';
export function roleAllowed(node, role) {
  return node?.canUse === true && (node.allowedRoles === null || Array.isArray(node.allowedRoles) && node.allowedRoles.includes(role));
}

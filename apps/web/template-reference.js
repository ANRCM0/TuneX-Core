const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

export async function resolveTemplateLines(text, request, memberKey) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 8) throw Error('选择 1–8 条线路修订。');
  const selections = lines.map(line => {
    const values = line.split(/\s+/);
    if (values.length !== 3 || !id(values[0]) || !id(values[1]) || !/^[1-9][0-9]*$/.test(values[2]) || Number(values[2]) > 64)
      throw Error('每行填写：成员名称 线路名称 精确修订。摘要由页面读取。');
    return { memberId: values[0], templateId: values[1], revision: Number(values[2]) };
  });
  if (new Set(selections.map(item => item.memberId)).size !== selections.length) throw Error('成员名称不能重复。');
  const resolved = [];
  for (const item of selections) {
    const value = await request('GET', 'path-templates/' + encodeURIComponent(item.templateId) + '?revision=' + item.revision);
    if (value.templateId !== item.templateId || value.revision !== item.revision || value.archived !== false ||
        !/^sha256:[a-f0-9]{64}$/.test(value.configDigest) || value.executionAuthorized !== false || value.reserved !== false)
      throw Error('线路精确修订不可用，请重新选择。');
    resolved.push({ [memberKey]: item.memberId, template: { templateId: item.templateId, revision: item.revision, configDigest: value.configDigest } });
  }
  return resolved;
}

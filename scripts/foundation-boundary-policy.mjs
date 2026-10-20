import ts from 'typescript';
import { posix } from 'node:path';

const goPrefix = 'github.com/tunex/vnext/agent/';
const normalized = path => path.replaceAll('\\', '/');
const contains = (scope, path) => path === scope || path.startsWith(scope + '/');
const owner = path => path.match(/^(apps\/control\/src\/modules\/[^/]+-owner|apps\/web\/[^/]+-owner)\//)?.[1];

export function classifySource(path, inventory) {
  path = normalized(path);
  const matches = inventory.layers.flatMap(layer => layer.scopes.filter(scope => contains(scope, path)).map(scope => ({ layer: layer.id, scope })));
  matches.sort((a, b) => b.scope.length - a.scope.length);
  const binding = inventory.compositionRoots.includes(path) || inventory.legacyBridges.includes(path) ||
    (matches.length === 0 && inventory.ownerContractEntrypoints.includes(path)) || inventory.legacyProviderBindings.some(entry => entry.source === path);
  if (matches.length) return { ...matches[0], binding };
  if (binding) return { layer: 'binding', binding: true };
  for (const [name, scopes] of Object.entries(inventory.legacyOwnerImplementations)) {
    if (scopes.some(scope => contains(scope, path))) return { layer: 'legacy-owner', owner: name, binding: false };
  }
  if (contains('agent/cmd/network-fixture', path)) return { layer: 'support', binding: false };
  return undefined;
}

export function sourceReferences(path, source) {
  if (path.endsWith('.go')) {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
    const imports = [...withoutComments.matchAll(/\bimport\s*(?:\(([\s\S]*?)\)|(?:[\w.]+\s+)?("[^"]+"))/g)];
    return imports.flatMap(match => [...(match[1] ?? match[2]).matchAll(/"([^"]+)"/g)].map(value => value[1]));
  }
  const syntax = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const references = [...syntax.referencedFiles, ...syntax.typeReferenceDirectives].map(reference => reference.fileName);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) references.push(node.moduleSpecifier.text);
    if (ts.isExternalModuleReference(node) && node.expression && ts.isStringLiteralLike(node.expression)) references.push(node.expression.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) references.push(node.argument.literal.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      const argument = node.arguments[0];
      references.push(argument && ts.isStringLiteralLike(argument) ? argument.text : '<dynamic-module-reference>');
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return references;
}

export function referenceTarget(path, reference) {
  if (reference.startsWith('.')) return posix.normalize(posix.join(posix.dirname(path), reference));
  if (reference === '@tunex/core') return 'packages/core/src/index.ts';
  if (reference.startsWith('@tunex/core/')) return 'packages/core/' + reference.slice('@tunex/core/'.length);
  if (reference === '@tunex/contracts') return 'packages/contracts/src/index.ts';
  const entries = { shared: 'shared', policy: 'policy', 'execution-observation': 'execution-observation', 'execution-values': 'execution-values',
    runtime: 'runtime', probe: 'probe', observability: 'observability', 'experimental/transit': 'experimental-transit', 'legacy/adp2': 'legacy-adp2', 'staged/probe-echo': 'staged-probe-echo' };
  if (reference.startsWith('@tunex/contracts/')) {
    const entry = entries[reference.slice('@tunex/contracts/'.length)];
    return entry ? 'packages/contracts/src/' + entry + '.ts' : '<private-contract-subpath>';
  }
  if (reference.startsWith(goPrefix)) return 'agent/' + reference.slice(goPrefix.length);
  return undefined;
}

export function sourceViolations(path, source, inventory) {
  path = normalized(path);
  const classified = classifySource(path, inventory), errors = [];
  if (!classified) return ['unclassified production source: ' + path];
  const layer = classified.layer;
  for (const reference of sourceReferences(path, source)) {
    if (/(?:^|[\/])(?:legacy|Forwardx)(?:[\/]|$)/i.test(reference)) errors.push('historical implementation reference: ' + reference);
    const target = referenceTarget(path, reference), targetClass = target && classifySource(target, inventory);
    if (reference === '<dynamic-module-reference>') errors.push('unclassified computed module reference');
    if (reference.startsWith('@tunex/core/') || target === '<private-contract-subpath>') errors.push('private package subpath: ' + reference);
    if (layer === 'L0' || layer === 'L1') {
      if (path.endsWith('.go') && !target) {
        if (!['context', 'errors', 'fmt', 'io', 'maps', 'math', 'slices', 'strings', 'sync', 'sync/atomic', 'time', 'unicode/utf8'].includes(reference)) errors.push('lower native/external dependency: ' + reference);
      } else if (!targetClass || !['L0', ...(layer === 'L1' ? ['L1'] : [])].includes(targetClass.layer)) errors.push('lower dependency direction: ' + reference);
      if (targetClass?.layer === 'L0' && !contains('packages/core/src', path) && !contains('apps/control/src/kernel', path) &&
          !['packages/core/src/index.ts', 'apps/control/src/kernel/public.ts'].includes(target)) errors.push('private Core dependency: ' + reference);
    }
    if (layer === 'L2' && !classified.binding && targetClass?.layer === 'L3')
      errors.push('adapter imports product implementation or type: ' + reference);
    const fromOwner = owner(path), toOwner = target && owner(target);
    if (toOwner && !/\/public\.(?:ts|js)$/.test(target) &&
        (!classified.binding && layer === 'L3' && fromOwner !== toOwner || path.startsWith('scripts/ops/'))) errors.push('cross-owner private dependency: ' + reference);
    if (!classified.binding && layer === 'L3' && targetClass?.layer === 'L1' && target.startsWith('apps/control/src/framework/') && !target.endsWith('/public.ts')) errors.push('private framework dependency: ' + reference);
    if (!classified.binding && layer === 'L3' && target?.startsWith('apps/control/src/compatibility/') && !target.endsWith('/public.ts')) errors.push('private native adapter dependency: ' + reference);
    if (!classified.binding && layer === 'L3' && target?.startsWith('apps/control/src/infrastructure/')) errors.push('product imports concrete storage: ' + reference);
    if (!classified.binding && layer === 'L3' && owner(path) && !target) errors.push('product imports external/native implementation: ' + reference);
  }
  // Products branch on capabilities. OS/architecture selection belongs to L2,
  // even when its platform name arrives through an injected fact.
  if (layer === 'L3' && !classified.binding) {
    if (path.endsWith('.go')) {
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
      const operations = code.replace(/"(?:\\.|[^"\\])*"|`[^`]*`|'(?:\\.|[^'\\])*'/g, '');
      const aliases = ['runtime'];
      for (const match of code.matchAll(/(?:\bimport\s+|^\s*)([A-Za-z_]\w*|\.)\s+"runtime"/gm)) aliases.push(match[1]);
      if (aliases.some(alias => alias === '.' ? /\bGO(?:OS|ARCH)\b/.test(operations) :
          new RegExp('\\b' + alias + '\\.GO(?:OS|ARCH)\\b').test(operations))) errors.push('product native platform selection');
      const platformFact = '\\b[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*\\.(?:Platform|OS|Arch|Architecture|OperatingSystem)\\b';
      if (new RegExp(platformFact + '\\s*(?:==|!=|<=|>=|<|>)|(?:==|!=|<=|>=|<|>)\\s*' + platformFact + '|\\bswitch\\s+(?:[^;{}]*;\\s*)?' + platformFact + '\\s*\\{').test(operations))
        errors.push('product native platform selection through injected facts');
      const platforms = '(?:aix|android|darwin|dragonfly|freebsd|hurd|illumos|ios|js|linux|nacl|netbsd|openbsd|plan9|solaris|wasip1|windows|zos)';
      if (new RegExp('_' + platforms + '(?:_[a-z0-9]+)?\\.go$').test(path) ||
          source.split(/\r?\n/).some(line => /^\s*\/\/(?:go:build|\s*\+build)\s/.test(line) && new RegExp('\\b' + platforms + '\\b').test(line)))
        errors.push('product platform-specific source selection');
    } else {
      const syntax = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const nativeRoots = new Set(['process', 'navigator', 'Deno', 'Bun']);
      function memberPath(node) {
        if (ts.isIdentifier(node)) return node.text;
        if (ts.isPropertyAccessExpression(node)) return memberPath(node.expression) + '.' + node.name.text;
        if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression))
          return memberPath(node.expression) + '.' + node.argumentExpression.text;
        return '';
      }
      function platformFact(node) {
        while (ts.isParenthesizedExpression(node)) node = node.expression;
        return /\.(?:platform|os|arch|architecture|operatingSystem)$/i.test(memberPath(node));
      }
      function visit(node) {
        const name = memberPath(node).replace(/^globalThis\./, '');
        if (/^(?:process\.(?:platform|arch)|navigator\.(?:platform|userAgent|userAgentData)|Deno\.build|Bun\.env)(?:\.|$)/.test(name))
          errors.push('product native platform selection');
        if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer &&
            nativeRoots.has(memberPath(node.initializer).replace(/^globalThis\./, '')))
          errors.push('product native platform selection through native destructuring');
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
            nativeRoots.has(memberPath(node.initializer).replace(/^globalThis\./, '')))
          errors.push('product native platform selection through native alias');
        if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.LessThanToken,
          ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken].includes(node.operatorToken.kind) &&
          (platformFact(node.left) || platformFact(node.right)) || ts.isSwitchStatement(node) && platformFact(node.expression))
          errors.push('product native platform selection through injected facts');
        ts.forEachChild(node, visit);
      }
      visit(syntax);
    }
  }
  // Browser owner effects are explicit. Mixed historical Control/Agent product
  // native views stay declared in their ledgers, not broadly exempted L1 APIs.
  if (layer === 'L0' || layer === 'L1' || layer === 'L3' && !classified.binding && path.startsWith('apps/web/') && owner(path)) {
    if (path.endsWith('.go')) {
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
      if (/`[^`]*\b(?:json|xml|yaml):/.test(code)) errors.push('lower native serialization tags');
      if (/\b(?:time\.(?:Now|NewTimer|NewTicker|After|AfterFunc|Sleep|Tick|Parse|ParseInLocation)|runtime\.GOOS|os\.|json\.(?:Marshal|Unmarshal|NewDecoder|NewEncoder))\b/.test(code) || /\.Format\(time\./.test(code)) errors.push('lower native clock/platform/parser operation');
      for (const match of code.matchAll(/(?:\bimport\s+|^\s*)([A-Za-z_]\w*|\.)\s+"time"/gm)) {
        if (match[1] === '.' || new RegExp('\\b' + match[1] + '\\.(?:Now|NewTimer|NewTicker|After|AfterFunc|Sleep|Tick|Parse|ParseInLocation)\\b').test(code))
          errors.push('lower native clock/platform/parser operation through time import alias');
      }
    } else {
      const syntax = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const globals = new Set(['process', 'fetch', 'Buffer', 'Bun', 'Deno', 'WebSocket', 'AbortSignal', 'AbortController', 'URL', 'URLSearchParams', 'document', 'window', 'navigator', 'XMLHttpRequest', 'Date']);
      function visit(node) {
        if (ts.isIdentifier(node) && globals.has(node.text) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
            !((ts.isPropertySignature(node.parent) || ts.isParameter(node.parent)) && node.parent.name === node)) errors.push('lower platform global/type: ' + node.text);
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'globalThis' &&
            (globals.has(node.name.text) || node.name.text === 'JSON')) errors.push('lower platform global/type: globalThis.' + node.name.text);
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const name = node.expression.getText(syntax);
          // Core's original detached-spec equality uses pure JSON serialization;
          // this exact existing leaf is not permission to parse native formats.
          if (['Date.now', 'Date.parse', ...(layer === 'L3' ? [] : ['JSON.parse', 'JSON.stringify'])].includes(name) &&
              !(path === 'packages/core/src/forward.ts' && name === 'JSON.stringify')) errors.push('lower native clock/parser operation: ' + name);
        }
        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Date') errors.push('lower native Date construction');
        ts.forEachChild(node, visit);
      }
      visit(syntax);
    }
  }
  return [...new Set(errors)].map(error => path + ': ' + error);
}

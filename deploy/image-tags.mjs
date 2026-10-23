import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const stable = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export function latestStableTag(tags) {
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) {
    throw new Error('Expected Git tag names');
  }
  let latest = null;
  let version = null;
  for (const tag of tags) {
    const match = stable.exec(tag);
    if (!match || match[0] !== tag) continue;
    const candidate = match.slice(1).map(BigInt);
    for (let index = 0; index < candidate.length; index++) {
      if (version && candidate[index] < version[index]) break;
      if (!version || candidate[index] > version[index]) {
        latest = tag;
        version = candidate;
        break;
      }
    }
  }
  return latest;
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Read Git tags from stdin');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('Git tag inventory exceeds limit');
    chunks.push(chunk);
  }
  const result = latestStableTag(Buffer.concat(chunks).toString('utf8').split(/\r?\n/));
  if (!result) throw new Error('No stable vMAJOR.MINOR.PATCH tag found');
  console.log(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

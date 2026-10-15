import { verifyMultihopRelease } from '../../apps/control/src/infrastructure/multihop-release.ts';

const path=process.argv[2],revision=process.argv[3]??process.env.TUNEX_SOURCE_REVISION;
if(!path||!revision)throw Error('Usage: node scripts/ops/check-multihop-release.ts evidence.json <40-character-source-revision>');
console.log(JSON.stringify(await verifyMultihopRelease(path,revision),null,2));

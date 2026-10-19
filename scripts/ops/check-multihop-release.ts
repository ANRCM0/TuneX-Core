import { nativeOperatorCommandEffects,verifyMultihopRelease } from '../../apps/control/src/compatibility/public.ts';
import { runReleaseEvidenceCommand } from '../../apps/control/src/modules/operator-command-owner/public.ts';

await runReleaseEvidenceCommand({...nativeOperatorCommandEffects,verify:verifyMultihopRelease});

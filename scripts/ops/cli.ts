import { nativeOperatorCommandEffects } from '../../apps/control/src/compatibility/public.ts';
import { runOperatorCommand,operatorCommandFailure } from '../../apps/control/src/modules/operator-command-owner/public.ts';
import { runUpgradeAssessment } from '../../apps/control/src/modules/upgrade-assessment-owner/public.ts';
import { backupDatabase,restoreDatabase } from './recovery.ts';

runOperatorCommand({...nativeOperatorCommandEffects,assessUpgrade:runUpgradeAssessment,backup:backupDatabase,restore:restoreDatabase})
 .catch(error=>operatorCommandFailure(error,nativeOperatorCommandEffects));

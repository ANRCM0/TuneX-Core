import { nativeUpgradeInspectionEffects } from '../../compatibility/public.ts';
import type { UpgradeAssessmentEffects } from './inspection-ports.ts';
import { assessUpgrade, parseUpgradePlan } from './rules.ts';

export async function runUpgradeAssessment(options: {
    planPath: string; databaseUrl: string; stateDirectory: string; caPath: string;
}) {
    const effects:UpgradeAssessmentEffects=nativeUpgradeInspectionEffects;
    const plan = parseUpgradePlan(await effects.readInput(options.planPath));
    const catalog = await effects.catalog();
    const authority = effects.authority(options.stateDirectory), before = await authority.read();
    const ca = effects.trust(await effects.readInput(options.caPath, 65536));
    const db = await effects.openDatabase(options.databaseUrl);
    try {
        const database = await effects.inspectDatabase(db, catalog);
        const after = await authority.read();
        return assessUpgrade(plan, {
            database, authority: after, authorityStable: before.sequence === after.sequence,
            trustMatches: ca === after.trustDigest,
            schemaFiles: catalog.files.map(({ name, sha256 }) => ({ name, sha256 })),
        });
    } finally { await db.end(); }
}

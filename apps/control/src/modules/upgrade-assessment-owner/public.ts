export { parseUpgradePlan, assessUpgrade } from './rules.ts';
export { runUpgradeAssessment } from './inspection.ts';
export { UPGRADE_ASSESSMENT_INTERFACE_VERSION } from './contracts.ts';
export type { CompatibilityProfile, JournalInspection, UpgradePlan, SchemaMarker, DatabaseInspection, UpgradeInspection } from './contracts.ts';
export type { UpgradeAssessmentEffects, UpgradeInspectionConnection } from './inspection-ports.ts';

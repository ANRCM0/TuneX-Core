import type { Release } from './internal-contracts.ts';
import type { NativeUpgradeAuthorityRecord as AuthorityRecord, NativeUpgradeDatabaseInspection as DatabaseInspection } from '../../compatibility/public.ts';
export type { NativeUpgradeDatabaseInspection as DatabaseInspection, NativeUpgradeSchemaMarker as SchemaMarker } from '../../compatibility/public.ts';

// Version 10 adds the recent path sample Station profile.
export const UPGRADE_ASSESSMENT_INTERFACE_VERSION=10 as const;

export type CompatibilityProfile = 'adp3-runtime-v1' | 'adp3-multihop-v1' | 'adp3-probe-registry-v1' | 'adp3-probe-permits-v1' | 'adp3-probe-withdrawals-v1' | 'adp3-probe-results-v1' | 'adp3-path-templates-v1' | 'adp3-path-bindings-v1' | 'adp3-node-telemetry-v1' | 'adp3-forward-telemetry-v1' | 'adp3-host-telemetry-v1' | 'adp3-probe-telemetry-v1' | 'adp3-telemetry-rollups-v1' | 'adp3-path-groups-v1' | 'adp3-path-publications-v1' | 'adp3-ingress-groups-v1' | 'adp3-ingress-migrations-v1' | 'adp3-station-alerts-v1' | 'adp3-notification-endpoints-v1' | 'adp3-notification-deliveries-v1' | 'adp3-probe-runs-v1' | 'adp3-probe-plans-v1' | 'adp3-typed-probes-v1' | 'adp3-observation-services-v1' | 'adp3-probe-services-v1' | 'adp3-probe-echo-v1' | 'adp3-probe-plan-json-integers-v1' | 'adp3-product-resource-access-v1' | 'adp3-shared-node-port-limits-v1' | 'adp3-shared-resource-limits-v1' | 'adp3-account-credentials-v1' | 'adp3-resource-usage-v1' | 'adp3-resource-alerts-v1' | 'adp3-path-echo-v1' | 'adp3-path-sample-alert-v1';
export interface JournalInspection {
    version: 1|2;
    nodeId: string;
    protocolVersion: 3;
    executionExtension: 0 | 1;
    generation: number;
    snapshotDigest: string;
    fileDigest: string;
    maxBindingFence: number;
    maxRetiredFence: number;
    importedTransit: boolean;
    resourceBudgetVersion?:0|1;
    resourceBudgetBuckets?:number;
    prechargedBytes?:string;
}
export interface UpgradePlan {
    version: 1;
    operation: 'upgrade' | 'rollback' | 'recover';
    source: Release;
    target: Release;
    controlMultihop: boolean;
    agentMultihop: boolean;
    journals: JournalInspection[];
}
export interface UpgradeInspection {
    database: DatabaseInspection;
    authority: AuthorityRecord;
    authorityStable: boolean;
    trustMatches: boolean;
    schemaFiles: { name: string; sha256: string }[];
}

import type { NativeUpgradeAuthorityRecord, NativeUpgradeConnection, NativeUpgradeSchemaCatalog,
    NativeUpgradeDatabaseInspection } from '../../compatibility/public.ts';

export interface UpgradeInspectionConnection { end():Promise<void> }
export interface UpgradeAssessmentEffects<Db extends UpgradeInspectionConnection=NativeUpgradeConnection> {
    readInput(path:string|URL,maximum?:number):Promise<string>;
    catalog():Promise<NativeUpgradeSchemaCatalog>;
    authority(stateDirectory:string):{read():Promise<NativeUpgradeAuthorityRecord>};
    trust(certificate:string):string;
    openDatabase(databaseUrl:string):Promise<Db>;
    inspectDatabase(db:Db,catalog:NativeUpgradeSchemaCatalog):Promise<NativeUpgradeDatabaseInspection>;
}

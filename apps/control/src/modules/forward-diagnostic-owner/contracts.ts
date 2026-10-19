import type { DiagnosticStoragePage, DiagnosticStorageForward, DiagnosticStorageOperation, DiagnosticStorageNode, DiagnosticStorageReportContext, DiagnosticStorageObservation, DiagnosticStorageDrain, DiagnosticStorageAssignment, DiagnosticStorageDeployment, DiagnosticStorageSlot, DiagnosticStorageRetirement, DiagnosticStorageLease, DiagnosticStorageProbe, ForwardDiagnosticStorage } from '../../framework/public.ts';

export interface DiagnosticPage<T> extends DiagnosticStoragePage<T> {}
export interface DiagnosticForward extends DiagnosticStorageForward {}
export interface DiagnosticOperation extends DiagnosticStorageOperation {}
export interface DiagnosticNode extends DiagnosticStorageNode {}
export interface DiagnosticReportContext extends DiagnosticStorageReportContext {}
export interface DiagnosticObservation extends DiagnosticStorageObservation {}
export interface DiagnosticDrain extends DiagnosticStorageDrain {}
export interface DiagnosticAssignment extends DiagnosticStorageAssignment {}
export interface DiagnosticDeployment extends DiagnosticStorageDeployment {}
export interface DiagnosticSlot extends DiagnosticStorageSlot {}
export interface DiagnosticRetirement extends DiagnosticStorageRetirement {}
export interface DiagnosticLease extends DiagnosticStorageLease {}
export interface DiagnosticProbe extends DiagnosticStorageProbe {}
export interface ForwardDiagnosticReadPort<Tx> extends ForwardDiagnosticStorage<Tx> {}

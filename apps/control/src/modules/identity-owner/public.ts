export const IDENTITY_MODULE_INTERFACE_VERSION=2 as const;
export { AccessChangeReconciler } from './access-reconciler.ts';
export type { AccessExecution } from './execution-ports.ts';
export { IdentityService } from './service.ts';
export { AccessCommands } from './commands.ts';
export { ACCESS_COMMAND_INTERFACE_VERSION } from './command-api.ts';
export type { MemberChangeResponse, NodeGrantResponse, AccessCommandApi } from './command-api.ts';
export type { AccessExecutionResult, AccessChangeEffects } from './command-effects.ts';
export type { MemberChangeInput, MemberChangeState, MemberWriter, IdentityMemberChange, IdentityMemberView, RecoveryIdentity,
    IdentityQueries, IdentityOwner, IdentityModuleOptions } from './contracts.ts';
export type { IdentityContextQuery, IdentityScopeView, IdentityContextView } from './contracts.ts';

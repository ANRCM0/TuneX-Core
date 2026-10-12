export type NodeId = string;
export type ForwardId = string;
export type ScopeId = string;
export type Revision = number;
export type CapabilityId = string;
export type NetworkProtocol = 'tcp' | 'udp';
export interface Node { readonly id: NodeId; readonly scopeId: ScopeId; readonly revision: Revision }
export interface ListenEndpoint { readonly address: string; readonly port: number }
export interface TargetEndpoint { readonly host: string; readonly port: number }
export interface PathSpec { readonly via: readonly NodeId[] }
export interface TransportRef { readonly profileId: string; readonly configRevision: Revision }
export interface ForwardSpec {
  readonly enabled: boolean;
  readonly protocols: readonly NetworkProtocol[];
  readonly ingress: { readonly nodeId: NodeId; readonly listen: ListenEndpoint };
  readonly target: TargetEndpoint;
  readonly path?: PathSpec;
  readonly transport?: TransportRef;
}
export interface Forward { readonly id: ForwardId; readonly scopeId: ScopeId; readonly revision: Revision; readonly spec: ForwardSpec }
export type ForwardChange = { readonly kind: 'replace'; readonly spec: unknown } | { readonly kind: 'set-enabled'; readonly enabled: boolean };
export interface Issue { readonly code: string; readonly path: string; readonly message: string }
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly Issue[] };
export type ValidationResult = Result<ForwardSpec>;

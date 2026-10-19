import type { RuntimeAssignment, RuntimeMessages, RuntimeSnapshot, RelayProfileConfig } from '@tunex/contracts/runtime';
import type { RuntimeValueFamily, RuntimeSnapshotValue, RuntimeHelloRequestValue, RuntimeHelloResponseValue,
    RuntimeReportRequestValue, RuntimeReportAckValue, RuntimeAssignmentSourceDriverValue } from '@tunex/contracts/execution-values';
import type { RuntimeMachinePort, RuntimeSnapshotInput, AssignmentDriverDeclaration, SnapshotContribution,
    SnapshotAssignmentSource, SnapshotAssignmentCollector, RelayAssignmentReader, RuntimeRelayPlan,
    RuntimeRelayLedger, PublishedRuntimeEvidence, PublishedRuntimeReader, RuntimeRelayProfile, RuntimeRelayTransport,
    RuntimeMultihopInput, RuntimeRelayPlanInput, RelayConfigurationCodec, TransportProfileConfig } from '../framework/public.ts';

/** Existing closed ADP/driver formats bind the common ports; this selects no new protocol. */
export interface NativeRuntimeFamily extends RuntimeValueFamily {
    readonly relayProfile:RelayProfileConfig;
    readonly driver:RuntimeAssignment['driver'];
    readonly sourceDriver:RuntimeAssignmentSourceDriverValue&{
        readonly id:Exclude<RuntimeAssignment['driver']['id'],'native.direct.v1'>;
        readonly schemaVersion:RuntimeAssignment['driver']['schemaVersion'];
    };
    readonly helloRequest:Omit<RuntimeMessages['HelloRequest'],keyof RuntimeHelloRequestValue>;
    readonly helloResponse:Omit<RuntimeMessages['HelloResponse'],keyof RuntimeHelloResponseValue>;
    readonly snapshot:Omit<RuntimeSnapshot,keyof RuntimeSnapshotValue<RuntimeAssignment>>;
    readonly reportRequest:Omit<RuntimeMessages['ReportRequest'],keyof RuntimeReportRequestValue>;
    readonly reportAck:Omit<RuntimeMessages['ReportAck'],keyof RuntimeReportAckValue>;
}
export type NativeRuntimeMachinePort=RuntimeMachinePort<NativeRuntimeFamily>;
export type NativeRuntimeSnapshotInput=RuntimeSnapshotInput<NativeRuntimeFamily>;
export type NativeAssignmentDriverDeclaration=AssignmentDriverDeclaration<NativeRuntimeFamily>;
export type NativeSnapshotContribution=SnapshotContribution<NativeRuntimeFamily>;
export type NativeSnapshotAssignmentSource<Tx>=SnapshotAssignmentSource<Tx,NativeRuntimeFamily>;
export type NativeSnapshotAssignmentCollector<Tx>=SnapshotAssignmentCollector<Tx,NativeRuntimeFamily>;
export type NativeRelayAssignmentReader<Tx>=RelayAssignmentReader<Tx,NativeRuntimeFamily>;
export type NativeRuntimeRelayPlan=RuntimeRelayPlan<NativeRuntimeFamily>;
export type NativeRuntimeRelayLedger<Tx>=RuntimeRelayLedger<Tx,NativeRuntimeFamily>;
export type NativePublishedRuntimeEvidence=PublishedRuntimeEvidence<NativeRuntimeFamily>;
export type NativePublishedRuntimeReader<Tx,Evidence extends NativePublishedRuntimeEvidence=NativePublishedRuntimeEvidence>=PublishedRuntimeReader<Tx,Evidence>;
export type NativeRuntimeRelayProfile=RuntimeRelayProfile<NativeRuntimeFamily>;
export type NativeRuntimeRelayTransport<Tx>=RuntimeRelayTransport<Tx,NativeRuntimeFamily>;
export type NativeRuntimeMultihopInput=RuntimeMultihopInput<NativeRuntimeFamily>;
export type NativeRuntimeRelayPlanInput=RuntimeRelayPlanInput<NativeRuntimeFamily>;
export type NativeRelayConfigurationCodec=RelayConfigurationCodec<NativeRuntimeFamily>;
export type NativeTransportProfileConfig=TransportProfileConfig<NativeRuntimeFamily>;

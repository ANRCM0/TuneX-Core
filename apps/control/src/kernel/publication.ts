export interface PublishedSnapshotFacts {
    readonly sessionEpoch:number;
    readonly validUntil:number;
}
export interface PublicationLeaseFacts {
    readonly now:number;
    readonly leaseSeconds:number;
    readonly credentialUntil:number;
    readonly relayUntil:number;
    readonly withdrawn:boolean;
}

/** Inputs are current facts from the host transaction, never an authority grant. */
export function holdPublishedSnapshot(previous:PublishedSnapshotFacts|undefined,input:{
    readonly sessionEpoch:number;readonly now:number;readonly credentialUntil:number;
    readonly withdrawn:boolean;readonly awaitingClaim:number;readonly multihopPreserved:boolean;
}):boolean {
    return !input.withdrawn&&input.awaitingClaim>0&&input.multihopPreserved&&previous!==undefined&&
        previous.sessionEpoch===input.sessionEpoch&&previous.validUntil>input.now+5000&&previous.validUntil<=input.credentialUntil;
}

export function reusePublishedSnapshot(previous:PublishedSnapshotFacts|undefined,input:{
    readonly sessionEpoch:number;readonly now:number;readonly credentialUntil:number;
    readonly relayUntil:number;readonly renewalLeadSeconds:number;readonly assignmentsUnchanged:boolean;
}):boolean {
    return previous!==undefined&&previous.sessionEpoch===input.sessionEpoch&&input.assignmentsUnchanged&&
        previous.validUntil<=Math.min(input.credentialUntil,input.relayUntil)&&previous.validUntil-input.now>input.renewalLeadSeconds*1000;
}

export function publicationDeadline(input:PublicationLeaseFacts):number {
    const policyDeadline=input.now+input.leaseSeconds*1000;
    return input.withdrawn?policyDeadline:Math.min(policyDeadline,input.credentialUntil,input.relayUntil);
}

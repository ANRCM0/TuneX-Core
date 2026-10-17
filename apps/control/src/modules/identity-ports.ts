export interface MemberChangeInput {
    readonly expectedRevision: number;
    readonly role: 'manager' | 'viewer' | 'removed';
    readonly token?: string;
}

export interface MemberChangeState {
    readonly actorId: string;
    readonly revision: number;
    readonly role: string;
    readonly active: boolean;
    readonly changed: boolean;
}

export interface MemberWriter<Tx> {
    changeMember(tx: Tx, owner: string, scopeId: string, subject: string, expectedRevision: number,
        role: MemberChangeInput['role'], token?: string): Promise<MemberChangeState>;
}

/** The optional files come from the trusted OS collector; no harness manufactures synchronization. */
export function timeProofArguments(): string[] {
    const proof = process.env.TUNEX_TIME_PROOF, key = process.env.TUNEX_TIME_PROOF_KEY;
    if (Boolean(proof) !== Boolean(key))
        throw new Error('TUNEX_TIME_PROOF and TUNEX_TIME_PROOF_KEY must be provided together');
    return proof && key ? ['--time-proof', proof, '--time-proof-key', key] : [];
}

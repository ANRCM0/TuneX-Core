import type { CompatibilityProfile } from './contracts.ts';

export interface Build {
    revision: string;
    imageDigest: string;
    profile: CompatibilityProfile;
}
export interface Release { control: Build; agent: Build }

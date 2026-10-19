import { ControlError } from '../../framework/public.ts';
import type { PathPublicationStorageValues } from '../../framework/public.ts';
import type { PathPublicationFailure } from './publication-contracts.ts';
import { PATH_PUBLICATION_REJECTIONS } from './publication-values.ts';

export const pathPublicationStorageValues:PathPublicationStorageValues<PathPublicationFailure>=Object.freeze({
    isRefusal(error:unknown):boolean {
        return error instanceof ControlError && !error.retryable && PATH_PUBLICATION_REJECTIONS.has(error.code) &&
            [403,404,409,422,429].includes(error.status);
    },
    // Project only after the adapter has rolled back and released the original savepoint.
    refusal(error:unknown):PathPublicationFailure {
        const value=error as ControlError;
        return {code:value.code,status:value.status as PathPublicationFailure['status']};
    },
});

// Historical/offline compatibility only. The production Control still rejects ADP/2.
export type * from './types.ts';
export { DEFAULT_POLICY } from './types.ts';
export { parseMessage, validateStructure, validatePolicy, validateSnapshot, validCidr } from './validate.ts';

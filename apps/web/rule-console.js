import { createRuleCommands } from './rule-command-owner/public.js';
import { createNativeRuleConsole } from './browser-native/public.js';

export const initRuleConsole = createNativeRuleConsole(createRuleCommands);

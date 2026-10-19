import { createConsoleModel } from './console-model-owner/public.js';
import { browserConsoleModelEffects } from './browser-native/public.js';

export { validScope, parsePorts, parseCidrs, allowedProtocols, stateTone, pageCount, candidateChoices } from './console-model-owner/public.js';
const { directCapable, directSpec, listResource } = createConsoleModel(browserConsoleModelEffects);
export { directCapable, directSpec, listResource };

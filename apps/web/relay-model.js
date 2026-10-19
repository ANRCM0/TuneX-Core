import { parsePorts, directCapable } from './model.js';
import { createNativeRelayForms } from './browser-native/public.js';

const { relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec } = createNativeRelayForms({ parsePorts, directCapable });
export { relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec };

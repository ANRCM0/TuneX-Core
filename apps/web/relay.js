import { relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec } from './relay-model.js';
import { createNativeRelayConsole } from './browser-native/public.js';

export const initRelayConsole = createNativeRelayConsole({ relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec });

import { freezeModuleValue } from '../../framework/public.ts';
import type { NotificationEndpointValues } from '../../framework/public.ts';
import type { NotificationEndpoint, NotificationEndpointAudit } from './endpoint-contracts.ts';
import { parseNotificationEndpoint, parseNotificationEndpointAudit } from './endpoint-values.ts';

export const notificationEndpointStorageValues:NotificationEndpointValues<NotificationEndpoint,NotificationEndpointAudit>=
    freezeModuleValue({endpoint:parseNotificationEndpoint,audit:parseNotificationEndpointAudit});

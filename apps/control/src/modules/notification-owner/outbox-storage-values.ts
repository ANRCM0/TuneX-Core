import { freezeModuleValue } from '../../framework/public.ts';
import type { NotificationOutboxValues } from '../../framework/public.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt } from './delivery-contracts.ts';
import { parseNotificationDelivery, parseNotificationDeliveryAttempt } from './delivery-values.ts';

export const notificationOutboxStorageValues:NotificationOutboxValues<NotificationDelivery,NotificationDeliveryAttempt>=
    freezeModuleValue({delivery:parseNotificationDelivery,attempt:parseNotificationDeliveryAttempt});

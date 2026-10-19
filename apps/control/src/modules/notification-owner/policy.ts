export const NOTIFICATION_ENDPOINT_LIMITS = Object.freeze({ endpointsPerScope:16, policiesPerEndpoint:16, auditPerScope:128,
    auditPage:16, requestBytes:8192, responseBytes:131072, activeRequests:2, actorKeys:128, cooldownMs:1000 });
export const NOTIFICATION_DELIVERY_LIMITS=Object.freeze({ rowsPerScope:1024, attemptsPerScope:256, attemptsPage:16, page:50,
    retentionMs:604800000, eventLifetimeMs:3600000, claimMs:30000, maximumAttempts:6, activePerScope:2,
    responseBytes:262144, payloadBytes:4096, activeRequests:2, actorKeys:128, cooldownMs:1000 });

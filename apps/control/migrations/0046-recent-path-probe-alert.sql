-- Sample conditions retain original Station event and notification handoff owners.
ALTER TABLE station_alert_events MODIFY rule ENUM('forward-operation-failed','node-report-stale','node-credential-expiring','shared-usage-high','shared-period-ending','recent-path-probe-degraded') NOT NULL;

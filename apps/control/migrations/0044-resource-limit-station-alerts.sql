ALTER TABLE station_alert_events MODIFY rule ENUM('forward-operation-failed','node-report-stale','node-credential-expiring','shared-usage-high','shared-period-ending') NOT NULL;

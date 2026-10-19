-- Endpoint intent only. Destinations and signing keys never enter SQL.
CREATE TABLE notification_endpoint_scopes (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 audit_evicted BIGINT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(audit_evicted<=9007199254740991)
);
CREATE TABLE notification_endpoints (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 endpoint_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 credential_revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 enabled BOOLEAN NOT NULL,
 managed_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 updated_at BIGINT UNSIGNED NOT NULL,
 suspended ENUM('none','recovery') NOT NULL,
 authority_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 credential_ref CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(scope_id,endpoint_id),
 FOREIGN KEY(scope_id) REFERENCES notification_endpoint_scopes(scope_id),
 FOREIGN KEY(managed_by) REFERENCES accounts(id),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(credential_revision BETWEEN 1 AND revision),
 CHECK(enabled IN (0,1)),
 CHECK(JSON_TYPE(config)='OBJECT' AND OCTET_LENGTH(config)<=4096),
 CHECK(JSON_EXTRACT(config,'$.enabled') IS NOT NULL AND JSON_TYPE(JSON_EXTRACT(config,'$.enabled'))='BOOLEAN'),
 CHECK(enabled=(JSON_EXTRACT(config,'$.enabled')=CAST('true' AS JSON))),
 CHECK(created_at<=9007199254740991 AND updated_at<=9007199254740991)
);
CREATE TABLE notification_endpoint_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 endpoint_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('publish','disable') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 INDEX notification_endpoint_audit_scope(scope_id,created_at,id),
 INDEX notification_endpoint_audit_head(scope_id,endpoint_id,created_at,id),
 FOREIGN KEY(scope_id,endpoint_id) REFERENCES notification_endpoints(scope_id,endpoint_id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(created_at<=9007199254740991)
);

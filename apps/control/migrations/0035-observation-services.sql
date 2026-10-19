-- Manager-declared public configuration only, never service ownership or execution authority.
CREATE TABLE observation_service_scopes (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 audit_evicted BIGINT UNSIGNED NOT NULL DEFAULT 0,
 CHECK(audit_evicted<=9007199254740991)
);
CREATE TABLE observation_services (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 service_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config_revision INT UNSIGNED NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 recovery_suspended BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(scope_id,service_id),
 FOREIGN KEY(scope_id) REFERENCES observation_service_scopes(scope_id),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(config_revision BETWEEN 1 AND 64),
 CHECK(archived IN (0,1) AND recovery_suspended IN (0,1))
);
CREATE TABLE observation_service_revisions (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 service_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 config_revision INT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,service_id,config_revision),
 FOREIGN KEY(scope_id) REFERENCES observation_service_scopes(scope_id),
 CHECK(config_revision BETWEEN 1 AND 64),
 CHECK(JSON_TYPE(config)='OBJECT' AND OCTET_LENGTH(config)<=16384),
 CHECK(created_at<=253402300799999)
);
CREATE TABLE observation_service_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 service_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config_revision INT UNSIGNED NOT NULL,
 kind ENUM('publish','archive') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 INDEX observation_service_audit(scope_id,created_at,id),
 INDEX observation_service_detail_audit(scope_id,service_id,created_at,id),
 FOREIGN KEY(scope_id,service_id,config_revision) REFERENCES observation_service_revisions(scope_id,service_id,config_revision),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(config_revision BETWEEN 1 AND 64),
 CHECK(created_at<=253402300799999)
);

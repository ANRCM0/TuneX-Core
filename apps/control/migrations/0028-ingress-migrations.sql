-- Explicit ingress lineage and revision migration coordination, never live group membership.
CREATE TABLE ingress_migrations (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_group_revision BIGINT UNSIGNED NOT NULL,
 target_group_revision BIGINT UNSIGNED NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 plan_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 cancelled BOOLEAN NOT NULL DEFAULT FALSE,
 recovery_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
 plan JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id),
 INDEX ingress_migration_group(scope_id,group_id,batch_id),
 FOREIGN KEY(scope_id,group_id,source_group_revision) REFERENCES ingress_group_revisions(scope_id,group_id,revision),
 FOREIGN KEY(scope_id,group_id,target_group_revision) REFERENCES ingress_group_revisions(scope_id,group_id,revision),
 CHECK(revision BETWEEN 1 AND 20),
 CHECK(created_at<=9007199254740991),
 CHECK(cancelled IN (0,1)),
 CHECK(recovery_invalidated IN (0,1)),
 CHECK(OCTET_LENGTH(plan)<=131072),
 CHECK(JSON_LENGTH(plan,'$.items') BETWEEN 1 AND 8)
);
CREATE TABLE ingress_migration_attempts (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position BIGINT UNSIGNED NOT NULL,
 kind ENUM('apply','compensate') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 outcome JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id,position,kind),
 FOREIGN KEY(scope_id,batch_id) REFERENCES ingress_migrations(scope_id,batch_id),
 CHECK(position BETWEEN 1 AND 8),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(outcome)<=32768)
);
CREATE TABLE ingress_migration_events (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('create','apply','compensate','cancel','recovery') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,batch_id,revision),
 FOREIGN KEY(scope_id,batch_id) REFERENCES ingress_migrations(scope_id,batch_id),
 CHECK(revision BETWEEN 1 AND 20),
 CHECK(created_at<=9007199254740991)
);

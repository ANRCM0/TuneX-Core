-- Native ingress definitions and durable creation coordination, never another executor.
CREATE TABLE ingress_groups (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 current_revision BIGINT UNSIGNED NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(scope_id,group_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(current_revision BETWEEN 1 AND 64),
 CHECK(archived IN (0,1))
);
CREATE TABLE ingress_group_revisions (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,group_id,revision),
 FOREIGN KEY(scope_id,group_id) REFERENCES ingress_groups(scope_id,group_id),
 CHECK(revision BETWEEN 1 AND 64),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(config)<=8192),
 CHECK(JSON_LENGTH(config,'$.members') BETWEEN 1 AND 8)
);
CREATE TABLE ingress_group_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('publish','archive') NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(scope_id,group_id,revision) REFERENCES ingress_group_revisions(scope_id,group_id,revision),
 CHECK(created_at<=9007199254740991)
);
CREATE TABLE ingress_deployments (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_revision BIGINT UNSIGNED NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 plan_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 cancelled BOOLEAN NOT NULL DEFAULT FALSE,
 recovery_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
 plan JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id),
 INDEX ingress_deployment_group(scope_id,group_id,batch_id),
 FOREIGN KEY(scope_id,group_id,group_revision) REFERENCES ingress_group_revisions(scope_id,group_id,revision),
 CHECK(revision BETWEEN 1 AND 20),
 CHECK(created_at<=9007199254740991),
 CHECK(cancelled IN (0,1)),
 CHECK(recovery_invalidated IN (0,1)),
 CHECK(OCTET_LENGTH(plan)<=131072),
 CHECK(JSON_LENGTH(plan,'$.items') BETWEEN 1 AND 8)
);
CREATE TABLE ingress_deployment_attempts (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position BIGINT UNSIGNED NOT NULL,
 kind ENUM('create','compensate') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 outcome JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id,position,kind),
 FOREIGN KEY(scope_id,batch_id) REFERENCES ingress_deployments(scope_id,batch_id),
 CHECK(position BETWEEN 1 AND 8),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(outcome)<=32768)
);
CREATE TABLE ingress_deployment_events (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('create','compensate','cancel','recovery') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,batch_id,revision),
 FOREIGN KEY(scope_id,batch_id) REFERENCES ingress_deployments(scope_id,batch_id),
 CHECK(revision BETWEEN 1 AND 20),
 CHECK(created_at<=9007199254740991)
);

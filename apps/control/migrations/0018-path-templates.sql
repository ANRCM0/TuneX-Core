-- Immutable native path metadata, never execution authorization or Forward bindings.
CREATE TABLE path_templates (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 current_revision BIGINT UNSIGNED NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(scope_id,template_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(current_revision BETWEEN 1 AND 64),
 CHECK(archived IN (0,1))
);
CREATE TABLE path_template_revisions (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 profile_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,template_id,revision),
 FOREIGN KEY(scope_id,template_id) REFERENCES path_templates(scope_id,template_id),
 CHECK(revision BETWEEN 1 AND 64),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(config)<=8192)
);
CREATE TABLE path_template_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('publish','archive') NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(scope_id,template_id,revision) REFERENCES path_template_revisions(scope_id,template_id,revision),
 CHECK(created_at<=9007199254740991)
);

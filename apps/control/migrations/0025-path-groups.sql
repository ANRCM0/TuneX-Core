-- Bounded native group metadata and immutable application provenance, never execution state.
CREATE TABLE path_groups (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 current_revision BIGINT UNSIGNED NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(scope_id,group_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(current_revision BETWEEN 1 AND 64),
 CHECK(archived IN (0,1))
);
CREATE TABLE path_group_revisions (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,group_id,revision),
 FOREIGN KEY(scope_id,group_id) REFERENCES path_groups(scope_id,group_id),
 CHECK(revision BETWEEN 1 AND 64),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(config)<=8192),
 CHECK(JSON_LENGTH(config,'$.candidates') BETWEEN 1 AND 8)
);
CREATE TABLE path_group_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('publish','archive') NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(scope_id,group_id,revision) REFERENCES path_group_revisions(scope_id,group_id,revision),
 CHECK(created_at<=9007199254740991)
);
CREATE TABLE forward_path_group_bindings (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sequence BIGINT UNSIGNED NOT NULL,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 group_revision BIGINT UNSIGNED NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 candidate_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 path_binding_sequence BIGINT UNSIGNED NOT NULL,
 forward_revision BIGINT UNSIGNED NOT NULL,
 expanded_spec JSON NOT NULL,
 spec_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(forward_id,sequence),
 INDEX path_group_references(scope_id,group_id,group_revision,forward_id),
 FOREIGN KEY(scope_id,group_id,group_revision) REFERENCES path_group_revisions(scope_id,group_id,revision),
 FOREIGN KEY(forward_id,forward_revision) REFERENCES forward_revisions(forward_id,revision),
 FOREIGN KEY(forward_id,path_binding_sequence) REFERENCES forward_path_bindings(forward_id,sequence),
 CHECK(sequence BETWEEN 1 AND 64),
 CHECK(group_revision BETWEEN 1 AND 64),
 CHECK(path_binding_sequence BETWEEN 1 AND 64),
 CHECK(forward_revision BETWEEN 1 AND 9007199254740991),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(expanded_spec)<=65536)
);
CREATE TABLE current_forward_path_group_bindings (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 sequence BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(forward_id,sequence) REFERENCES forward_path_group_bindings(forward_id,sequence)
);

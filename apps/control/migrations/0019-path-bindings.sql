-- Immutable application provenance and one current pointer, never another executor.
CREATE TABLE forward_path_bindings (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 sequence BIGINT UNSIGNED NOT NULL,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 template_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 template_revision BIGINT UNSIGNED NOT NULL,
 config_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 forward_revision BIGINT UNSIGNED NOT NULL,
 expanded_spec JSON NOT NULL,
 spec_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(forward_id,sequence),
 INDEX path_references(scope_id,template_id,template_revision,forward_id),
 FOREIGN KEY(forward_id,forward_revision) REFERENCES forward_revisions(forward_id,revision),
 FOREIGN KEY(scope_id,template_id,template_revision) REFERENCES path_template_revisions(scope_id,template_id,revision),
 CHECK(sequence BETWEEN 1 AND 64),
 CHECK(forward_revision BETWEEN 1 AND 9007199254740991),
 CHECK(template_revision BETWEEN 1 AND 64),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(expanded_spec)<=65536)
);
CREATE TABLE current_path_bindings (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 sequence BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY(forward_id,sequence) REFERENCES forward_path_bindings(forward_id,sequence)
);

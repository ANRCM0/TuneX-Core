CREATE TABLE transport_profiles (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 current_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 CONSTRAINT transport_profile_revision CHECK(current_revision BETWEEN 0 AND 9007199254740991),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 INDEX transport_scope(scope_id,id)
);
CREATE TABLE transport_profile_revisions (
 profile_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 config_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(profile_id,revision),
 CONSTRAINT transport_config_revision CHECK(revision BETWEEN 1 AND 9007199254740991),
 FOREIGN KEY(profile_id) REFERENCES transport_profiles(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
);

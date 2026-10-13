ALTER TABLE transport_profiles ADD COLUMN grant_revision BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE transport_profiles ADD CONSTRAINT transport_grant_revision CHECK(grant_revision BETWEEN 1 AND 9007199254740991);
CREATE TABLE transport_profile_grants (
 profile_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(profile_id,actor_id),
 FOREIGN KEY(profile_id) REFERENCES transport_profiles(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
);
INSERT INTO transport_profile_grants(profile_id,actor_id) SELECT p.id,s.owner_id FROM transport_profiles p JOIN scopes s ON s.id=p.scope_id;
CREATE TABLE node_relay_endpoints (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL,
 config JSON NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 updated_at BIGINT UNSIGNED NOT NULL,
 CONSTRAINT node_endpoint_revision CHECK(revision BETWEEN 1 AND 9007199254740991),
 FOREIGN KEY(node_id) REFERENCES nodes(id),
 FOREIGN KEY(created_by) REFERENCES accounts(id)
);
ALTER TABLE node_security_events MODIFY kind ENUM('credential_rotation','policy_update','node_revocation','relay_endpoint_update') NOT NULL;
CREATE TABLE transport_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 profile_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 subject_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 details JSON NOT NULL,
 FOREIGN KEY(profile_id) REFERENCES transport_profiles(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
);

-- Existing resources remain explicitly unclassified until an audited owner command.
-- No execution history, credentials, grants or Runtime reservations are rewritten.
ALTER TABLE nodes
 ADD COLUMN resource_source ENUM('legacy-unclassified','private','admin-shared') NOT NULL DEFAULT 'legacy-unclassified',
 ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD COLUMN resource_revision BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE node_grants ADD COLUMN allowed_roles JSON NULL;
ALTER TABLE forwards ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE path_templates ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE path_groups ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE ingress_groups ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE node_security_events MODIFY kind ENUM('credential_rotation','policy_update','node_revocation','relay_endpoint_update','relay_credential_issue','resource_classification') NOT NULL;

CREATE TABLE forward_ownership_events (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 UNIQUE KEY forward_ownership_once(forward_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 FOREIGN KEY(forward_id,revision) REFERENCES forward_revisions(forward_id,revision),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 FOREIGN KEY(owner_actor_id) REFERENCES accounts(id),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(created_at<=9007199254740991)
);
ALTER TABLE path_template_events
 MODIFY kind ENUM('publish','archive','classify-owner') NOT NULL,
 ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id),
 ADD CHECK((kind='classify-owner' AND owner_actor_id IS NOT NULL) OR (kind<>'classify-owner' AND owner_actor_id IS NULL));
ALTER TABLE path_group_events
 MODIFY kind ENUM('publish','archive','classify-owner') NOT NULL,
 ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id),
 ADD CHECK((kind='classify-owner' AND owner_actor_id IS NOT NULL) OR (kind<>'classify-owner' AND owner_actor_id IS NULL));
ALTER TABLE ingress_group_events
 MODIFY kind ENUM('publish','archive','classify-owner') NOT NULL,
 ADD COLUMN owner_actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id),
 ADD CHECK((kind='classify-owner' AND owner_actor_id IS NOT NULL) OR (kind<>'classify-owner' AND owner_actor_id IS NULL));
ALTER TABLE nodes
 ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id),
 ADD CHECK((resource_source='private' AND owner_actor_id IS NOT NULL) OR (resource_source<>'private' AND owner_actor_id IS NULL)),
 ADD CHECK(resource_revision BETWEEN 1 AND 9007199254740991);
ALTER TABLE forwards ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id);
ALTER TABLE path_templates ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id);
ALTER TABLE path_groups ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id);
ALTER TABLE ingress_groups ADD FOREIGN KEY(owner_actor_id) REFERENCES accounts(id);

ALTER TABLE scope_members ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE scope_members ADD COLUMN revision BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE scope_members ADD CONSTRAINT member_revision_range CHECK(revision BETWEEN 1 AND 9007199254740991);
ALTER TABLE nodes ADD COLUMN grant_revision BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE nodes ADD CONSTRAINT grant_revision_range CHECK(grant_revision BETWEEN 1 AND 9007199254740991);
ALTER TABLE forwards ADD COLUMN authorization_actor VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE forwards f SET authorization_actor=(SELECT o.requested_by FROM operations o WHERE o.forward_id=f.id AND o.kind IN ('create','update','enable','disable','retry') ORDER BY o.target_revision DESC,o.created_at DESC,o.id DESC LIMIT 1);
ALTER TABLE forwards ADD FOREIGN KEY(authorization_actor) REFERENCES accounts(id);
CREATE TABLE access_events (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subject_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('member_change','node_grant_change') NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  details JSON NOT NULL,
  FOREIGN KEY(scope_id) REFERENCES scopes(id),FOREIGN KEY(actor_id) REFERENCES accounts(id)
);

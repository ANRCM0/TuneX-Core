CREATE TABLE node_credentials (
  fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  issued_at BIGINT UNSIGNED NOT NULL,
  valid_until BIGINT UNSIGNED NOT NULL,
  retire_after BIGINT UNSIGNED NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX active_node_credentials(node_id,revoked,valid_until),
  FOREIGN KEY(node_id) REFERENCES nodes(id)
);
INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until,revoked)
SELECT credential_fingerprint,id,0,credential_until,revoked FROM nodes
WHERE credential_fingerprint IS NOT NULL AND credential_until IS NOT NULL;
CREATE TABLE credential_rotations (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  response JSON NOT NULL,
  PRIMARY KEY(node_id,request_id),
  FOREIGN KEY(node_id) REFERENCES nodes(id)
);
CREATE TABLE node_security_events (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  kind ENUM('credential_rotation','policy_update','node_revocation') NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  details JSON NOT NULL,
  FOREIGN KEY(node_id) REFERENCES nodes(id)
);
ALTER TABLE operations MODIFY kind ENUM('create','update','enable','disable','delete','retry','policy','revoke') NOT NULL;

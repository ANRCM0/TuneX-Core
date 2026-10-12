CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS scopes (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  owner_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES accounts(id)
);
CREATE TABLE IF NOT EXISTS scope_members (
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(scope_id,actor_id), FOREIGN KEY(scope_id) REFERENCES scopes(id), FOREIGN KEY(actor_id) REFERENCES accounts(id)
);
CREATE TABLE IF NOT EXISTS nodes (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  enrollment_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  enrollment_until BIGINT UNSIGNED NOT NULL,
  csr_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NULL,
  credential_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  credential_until BIGINT UNSIGNED NULL,
  enrollment_response JSON NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  facts JSON NOT NULL,
  FOREIGN KEY(scope_id) REFERENCES scopes(id)
);
CREATE TABLE IF NOT EXISTS node_grants (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY(node_id,actor_id), FOREIGN KEY(node_id) REFERENCES nodes(id), FOREIGN KEY(actor_id) REFERENCES accounts(id)
);
CREATE TABLE IF NOT EXISTS forwards (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision BIGINT UNSIGNED NOT NULL, spec JSON NOT NULL, deleting BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY(scope_id) REFERENCES scopes(id), CHECK(revision BETWEEN 1 AND 9007199254740991)
);
CREATE TABLE IF NOT EXISTS forward_revisions (
  forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision BIGINT UNSIGNED NOT NULL, spec JSON NOT NULL,
  PRIMARY KEY(forward_id,revision), FOREIGN KEY(forward_id) REFERENCES forwards(id)
);
CREATE TABLE IF NOT EXISTS port_slots (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  protocol ENUM('tcp','udp') NOT NULL, port INT UNSIGNED NOT NULL,
  owner_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  fence BIGINT UNSIGNED NOT NULL DEFAULT 0, deployment_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY(node_id,protocol,port), FOREIGN KEY(node_id) REFERENCES nodes(id),
  CHECK(port BETWEEN 1 AND 65535), CHECK(fence<=9007199254740991), CHECK(deployment_generation<=9007199254740991)
);
CREATE TABLE IF NOT EXISTS operations (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  target_revision BIGINT UNSIGNED NOT NULL, kind ENUM('create') NOT NULL,
  status ENUM('accepted','running','succeeded','failed','superseded') NOT NULL,
  requested_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL, updated_at BIGINT UNSIGNED NOT NULL,
  execution_deadline BIGINT UNSIGNED NOT NULL, attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  claim_token VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  claim_until BIGINT UNSIGNED NULL, last_error JSON NULL,
  superseded_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  cleanup_pending BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX pending_work(status,claim_until,execution_deadline),
  FOREIGN KEY(forward_id) REFERENCES forwards(id), FOREIGN KEY(scope_id) REFERENCES scopes(id)
);
CREATE TABLE IF NOT EXISTS idempotency (
  scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  http_status INT NULL, response JSON NULL,
  PRIMARY KEY(scope_id,actor_id,request_key), FOREIGN KEY(scope_id) REFERENCES scopes(id), FOREIGN KEY(actor_id) REFERENCES accounts(id)
);
CREATE TABLE IF NOT EXISTS runtime_nodes (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  session_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0,
  boot_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
  snapshot_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_report_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_report JSON NULL, received_at BIGINT UNSIGNED NULL,
  FOREIGN KEY(node_id) REFERENCES nodes(id), CHECK(session_epoch<=9007199254740991), CHECK(snapshot_generation<=9007199254740991)
);
CREATE TABLE IF NOT EXISTS node_boots (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  boot_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_epoch BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY(node_id,boot_id), FOREIGN KEY(node_id) REFERENCES nodes(id)
);
CREATE TABLE IF NOT EXISTS snapshots (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  generation BIGINT UNSIGNED NOT NULL, session_epoch BIGINT UNSIGNED NOT NULL,
  valid_until BIGINT UNSIGNED NOT NULL, body JSON NOT NULL,
  PRIMARY KEY(node_id,generation), FOREIGN KEY(node_id) REFERENCES nodes(id)
);
CREATE TABLE IF NOT EXISTS reports (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_epoch BIGINT UNSIGNED NOT NULL, sequence BIGINT UNSIGNED NOT NULL,
  request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY(node_id,session_epoch,sequence), FOREIGN KEY(node_id) REFERENCES nodes(id)
);

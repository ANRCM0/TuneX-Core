CREATE TABLE IF NOT EXISTS account_credential_events (
  id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('credential_rotated') NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY(actor_id) REFERENCES accounts(id),
  INDEX account_credential_timeline(actor_id,created_at,id),
  CHECK(created_at<=253402300799999)
);

CREATE TABLE node_relay_credentials (
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 issued_at BIGINT UNSIGNED NOT NULL,
 valid_until BIGINT UNSIGNED NOT NULL,
 retire_after BIGINT UNSIGNED NULL,
 revoked BOOLEAN NOT NULL DEFAULT FALSE,
 certificate TEXT NOT NULL,
 FOREIGN KEY(node_id) REFERENCES nodes(id),
 INDEX relay_node_credentials(node_id,revoked,valid_until)
);
CREATE TABLE relay_credential_requests (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 response JSON NOT NULL,
 PRIMARY KEY(node_id,request_id),
 FOREIGN KEY(node_id) REFERENCES nodes(id)
);
ALTER TABLE node_security_events MODIFY kind ENUM('credential_rotation','policy_update','node_revocation','relay_endpoint_update','relay_credential_issue') NOT NULL;

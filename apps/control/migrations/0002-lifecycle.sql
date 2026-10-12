ALTER TABLE operations MODIFY kind ENUM('create','update','enable','disable','delete','retry') NOT NULL;
ALTER TABLE operations ADD COLUMN source_operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE operations ADD COLUMN previous_spec JSON NULL;
CREATE TABLE IF NOT EXISTS retirements (
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  assignment_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  deployment_generation BIGINT UNSIGNED NOT NULL,
  binding_fence BIGINT UNSIGNED NOT NULL,
  forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  body JSON NOT NULL,
  removed_epoch BIGINT UNSIGNED NULL,
  retirement_generation BIGINT UNSIGNED NULL,
  safe BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(node_id,assignment_id,deployment_generation,binding_fence),
  FOREIGN KEY(node_id) REFERENCES nodes(id),FOREIGN KEY(forward_id) REFERENCES forwards(id),FOREIGN KEY(operation_id) REFERENCES operations(id)
);
CREATE TABLE IF NOT EXISTS execution_leases (
  forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  assignment_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  deployment_generation BIGINT UNSIGNED NOT NULL,
  binding_fence BIGINT UNSIGNED NOT NULL,
  session_epoch BIGINT UNSIGNED NOT NULL,
  valid_until BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY(node_id,assignment_id,deployment_generation,binding_fence,session_epoch),
  FOREIGN KEY(node_id) REFERENCES nodes(id)
);

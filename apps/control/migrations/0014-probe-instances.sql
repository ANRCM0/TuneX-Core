-- Non-executable instance ownership only. No task, permit, target or execution lease.
CREATE TABLE probe_instances (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
 boot_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 session_epoch BIGINT UNSIGNED NULL,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 instance_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 state ENUM('empty','registered','revoked','quarantined') NOT NULL DEFAULT 'empty',
 registered_at BIGINT UNSIGNED NULL,
 expires_at BIGINT UNSIGNED NULL,
 revoked_at BIGINT UNSIGNED NULL,
 FOREIGN KEY(node_id) REFERENCES nodes(id),
 CONSTRAINT probe_instance_counter CHECK(generation <= 9007199254740991),
 CONSTRAINT probe_instance_shape CHECK(
  (state='empty' AND generation=0 AND boot_id IS NULL AND session_epoch IS NULL AND
   fingerprint IS NULL AND instance_id IS NULL AND registered_at IS NULL AND expires_at IS NULL AND revoked_at IS NULL)
  OR (state<>'empty' AND generation>0 AND boot_id IS NOT NULL AND session_epoch IS NOT NULL AND
   session_epoch>0 AND session_epoch<=9007199254740991 AND fingerprint IS NOT NULL AND instance_id IS NOT NULL AND
   registered_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at>registered_at AND expires_at<=registered_at+30000 AND
   ((state='registered' AND revoked_at IS NULL) OR (state<>'registered' AND revoked_at IS NOT NULL)))
 )
);

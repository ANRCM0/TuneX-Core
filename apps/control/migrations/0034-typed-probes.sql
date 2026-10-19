-- Explicit type qualification never allocates a second instance or issuance budget.
ALTER TABLE probe_permits ADD COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1') NOT NULL DEFAULT 'tcp-connect-v1';
ALTER TABLE probe_runs ADD COLUMN measurement ENUM('tcp-connect-v1','tcp-ingress-connect-v1') NOT NULL DEFAULT 'tcp-connect-v1';
CREATE TABLE probe_type_qualifications (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 boot_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 session_epoch BIGINT UNSIGNED NULL,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 instance_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 instance_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
 state ENUM('empty','qualified','revoked','quarantined') NOT NULL DEFAULT 'empty',
 qualified_at BIGINT UNSIGNED NULL,
 expires_at BIGINT UNSIGNED NULL,
 CHECK((state='empty' AND instance_generation=0 AND boot_id IS NULL AND session_epoch IS NULL AND fingerprint IS NULL
    AND instance_id IS NULL AND qualified_at IS NULL AND expires_at IS NULL)
    OR (state<>'empty' AND instance_generation BETWEEN 1 AND 9007199254740991 AND boot_id IS NOT NULL
    AND session_epoch IS NOT NULL AND fingerprint IS NOT NULL AND instance_id IS NOT NULL AND qualified_at IS NOT NULL AND expires_at IS NOT NULL)),
 CHECK(session_epoch IS NULL OR session_epoch BETWEEN 1 AND 9007199254740991),
 CHECK(qualified_at IS NULL OR (qualified_at<=253402300799999 AND expires_at>qualified_at AND expires_at<=qualified_at+30000))
);

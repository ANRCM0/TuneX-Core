-- Internal one-use Probe authority only. No remote dispatch or execution lease.
CREATE TABLE probe_permit_budget (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 observed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 CONSTRAINT probe_budget_singleton CHECK(id=1),
 CONSTRAINT probe_budget_clock CHECK(observed_at<=9007199254740991)
);
INSERT INTO probe_permit_budget(id) VALUES(1);
CREATE TABLE probe_permits (
 id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 binding JSON NOT NULL,
 instance_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 instance_generation BIGINT UNSIGNED NOT NULL,
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 timeout_ms INT UNSIGNED NOT NULL,
 issued_at BIGINT UNSIGNED NOT NULL,
 expires_at BIGINT UNSIGNED NOT NULL,
 state ENUM('issued','consumed','revoked','quarantined') NOT NULL,
 closed_at BIGINT UNSIGNED NULL,
 CONSTRAINT probe_permit_window CHECK(expires_at>issued_at AND expires_at<=issued_at+2000 AND expires_at<=9007199254740991),
 CONSTRAINT probe_permit_timeout CHECK(timeout_ms>=100 AND timeout_ms<=2000),
 CONSTRAINT probe_permit_instance CHECK(instance_generation>0 AND instance_generation<=9007199254740991),
 CONSTRAINT probe_permit_closed CHECK((state='issued' AND closed_at IS NULL) OR (state<>'issued' AND closed_at IS NOT NULL))
);

-- Short-lived Agent-reported observations, not health history or execution authority.
CREATE TABLE probe_results (
 permit_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 body JSON NOT NULL,
 result_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 accepted_at BIGINT UNSIGNED NOT NULL,
 CONSTRAINT probe_result_time CHECK(accepted_at<=9007199254740991),
 CONSTRAINT probe_result_size CHECK(OCTET_LENGTH(body)<=4096),
 FOREIGN KEY(permit_id) REFERENCES probe_permits(id) ON DELETE CASCADE
);

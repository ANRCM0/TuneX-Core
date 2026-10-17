-- Independent withdrawal preserves the one-use consumption fact and issuance reservation.
CREATE TABLE probe_permit_withdrawals (
 permit_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 withdrawn_at BIGINT UNSIGNED NOT NULL,
 CONSTRAINT probe_withdrawal_time CHECK(withdrawn_at<=9007199254740991),
 FOREIGN KEY(permit_id) REFERENCES probe_permits(id) ON DELETE CASCADE
);
-- Old consumed receipts were non-executable. Never make them newly eligible on upgrade.
INSERT INTO probe_permit_withdrawals(permit_id,withdrawn_at)
 SELECT id,closed_at FROM probe_permits WHERE state='consumed';

-- Offline Control orchestration ledger. No live Snapshot or executor reads this table.
-- Every row is pinned to an immutable reserved Transit staging generation.
CREATE TABLE transit_coordination (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 generation BIGINT UNSIGNED NOT NULL,
 plan_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phase ENUM('preparing','activating','compensating','sealed','quarantined') NOT NULL,
 position INT UNSIGNED NOT NULL DEFAULT 0,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 receipt_highwater JSON NOT NULL,
 journal_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 updated_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(forward_id,generation),
 FOREIGN KEY(forward_id,generation) REFERENCES transit_deployments(forward_id,generation),
 CHECK(generation BETWEEN 1 AND 9007199254740991),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(position BETWEEN 0 AND 8),
 INDEX transit_coordination_phase(phase,updated_at)
);

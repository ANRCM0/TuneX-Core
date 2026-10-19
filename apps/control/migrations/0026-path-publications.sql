-- Durable manual coordination only. Forward and Runtime remain the execution owners.
CREATE TABLE path_publications (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 created_by VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 plan_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 cancelled BOOLEAN NOT NULL DEFAULT FALSE,
 recovery_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
 plan JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(revision BETWEEN 1 AND 24),
 CHECK(created_at<=9007199254740991),
 CHECK(cancelled IN (0,1)),
 CHECK(recovery_invalidated IN (0,1)),
 CHECK(OCTET_LENGTH(plan)<=131072),
 CHECK(JSON_LENGTH(plan,'$.items') BETWEEN 1 AND 10)
);
CREATE TABLE path_publication_attempts (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 position BIGINT UNSIGNED NOT NULL,
 kind ENUM('apply','compensate') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 outcome JSON NOT NULL,
 PRIMARY KEY(scope_id,batch_id,position,kind),
 FOREIGN KEY(scope_id,batch_id) REFERENCES path_publications(scope_id,batch_id),
 CHECK(position BETWEEN 1 AND 10),
 CHECK(created_at<=9007199254740991),
 CHECK(OCTET_LENGTH(outcome)<=32768)
);
CREATE TABLE path_publication_events (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 batch_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 kind ENUM('create','apply','compensate','cancel','recovery') NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(scope_id,batch_id,revision),
 FOREIGN KEY(scope_id,batch_id) REFERENCES path_publications(scope_id,batch_id),
 CHECK(revision BETWEEN 1 AND 24),
 CHECK(created_at<=9007199254740991)
);

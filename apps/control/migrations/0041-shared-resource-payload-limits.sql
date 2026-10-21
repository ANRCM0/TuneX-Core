-- Product policy only. Runtime slots, authority, leases and Agent history stay original.
CREATE TABLE shared_resource_limit_heads (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 bucket_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(node_id,actor_id),
 FOREIGN KEY(node_id) REFERENCES nodes(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 CHECK(revision<=9007199254740991),
 CHECK((revision=0 AND bucket_id IS NULL) OR (revision>0 AND bucket_id IS NOT NULL))
);
CREATE TABLE shared_resource_limit_buckets (
 bucket_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 starts_at BIGINT UNSIGNED NOT NULL,
 ends_at BIGINT UNSIGNED NOT NULL,
 bytes_per_second BIGINT UNSIGNED NULL,
 burst_bytes INT UNSIGNED NOT NULL,
 byte_limit BIGINT UNSIGNED NULL,
 KEY shared_resource_limit_period(node_id,actor_id,starts_at,ends_at),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 FOREIGN KEY(node_id,actor_id) REFERENCES shared_resource_limit_heads(node_id,actor_id),
 CHECK(revision BETWEEN 1 AND 9007199254740991),
 CHECK(starts_at<ends_at AND ends_at<=9007199254740991),
 CHECK(bytes_per_second IS NULL OR bytes_per_second<=9007199254740991),
 CHECK(byte_limit IS NULL OR byte_limit<=9007199254740991),
 CHECK(bytes_per_second IS NOT NULL OR byte_limit IS NOT NULL),
 CHECK(burst_bytes BETWEEN 1 AND 65536)
);
ALTER TABLE shared_resource_limit_heads ADD FOREIGN KEY(bucket_id) REFERENCES shared_resource_limit_buckets(bucket_id);
CREATE TABLE shared_resource_limit_requests (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 response JSON NOT NULL,
 PRIMARY KEY(scope_id,actor_id,request_id),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id)
);
CREATE TABLE shared_resource_limit_audit (
 event_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 bucket_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 at_ms BIGINT UNSIGNED NOT NULL,
 body JSON NOT NULL,
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 FOREIGN KEY(bucket_id) REFERENCES shared_resource_limit_buckets(bucket_id),
 CHECK(at_ms<=9007199254740991)
);

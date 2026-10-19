-- Bounded operational aggregates; these budgets never issue execution or billing authority.
CREATE TABLE telemetry_rollup_scope_heads (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 FOREIGN KEY(scope_id) REFERENCES scopes(id)
);
CREATE TABLE telemetry_rollup_heads (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 family ENUM('process','host','forward','probe') NOT NULL,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 minute_evicted DECIMAL(20,0) UNSIGNED NOT NULL DEFAULT 0,
 hour_evicted DECIMAL(20,0) UNSIGNED NOT NULL DEFAULT 0,
 cursor_evicted DECIMAL(20,0) UNSIGNED NOT NULL DEFAULT 0,
 cursor_expired DECIMAL(20,0) UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(node_id,family),
 INDEX rollup_head_scope(scope_id,family,node_id),
 FOREIGN KEY(node_id) REFERENCES nodes(id), FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(minute_evicted<=18446744073709551615 AND hour_evicted<=18446744073709551615),
 CHECK(cursor_evicted<=18446744073709551615 AND cursor_expired<=18446744073709551615)
);
CREATE TABLE telemetry_rollup_cursors (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 family ENUM('process','host','forward','probe') NOT NULL,
 series_key CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 last_received_at BIGINT UNSIGNED NOT NULL,
 body JSON NOT NULL, digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(node_id,family,series_key),
 INDEX rollup_cursor_scope(scope_id,last_received_at,node_id,family,series_key),
 INDEX rollup_cursor_node(node_id,family,last_received_at,series_key),
 INDEX rollup_cursor_expiry(last_received_at,scope_id),
 FOREIGN KEY(node_id,family) REFERENCES telemetry_rollup_heads(node_id,family),
 FOREIGN KEY(scope_id) REFERENCES scopes(id),
 CHECK(last_received_at<=253402300799999), CHECK(OCTET_LENGTH(body)<=8192)
);
CREATE TABLE telemetry_rollup_buckets (
 scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 family ENUM('process','host','forward','probe') NOT NULL,
 resolution ENUM('minute','hour') NOT NULL,
 bucket_start BIGINT UNSIGNED NOT NULL,
 series_key CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
 body JSON NOT NULL, digest CHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 recovery_suspended BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(node_id,family,resolution,bucket_start,series_key),
 INDEX rollup_bucket_node(scope_id,node_id,family,resolution,bucket_start,series_key),
 INDEX rollup_bucket_forward(scope_id,forward_id,family,resolution,bucket_start,node_id,series_key),
 INDEX rollup_bucket_scope(scope_id,resolution,bucket_start,node_id,family,series_key),
 INDEX rollup_bucket_expiry(resolution,bucket_start,scope_id),
 FOREIGN KEY(node_id,family) REFERENCES telemetry_rollup_heads(node_id,family),
 FOREIGN KEY(scope_id) REFERENCES scopes(id), FOREIGN KEY(forward_id) REFERENCES forwards(id),
 CHECK(bucket_start<=253402300799999), CHECK(OCTET_LENGTH(body)<=8192),
 CHECK(recovery_suspended IN (0,1)),
 CHECK((family IN ('process','host') AND forward_id IS NULL) OR (family IN ('forward','probe') AND forward_id IS NOT NULL))
);

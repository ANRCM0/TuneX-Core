CREATE TABLE resource_usage_heads (
    node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    session_epoch BIGINT UNSIGNED NOT NULL,
    report_sequence BIGINT UNSIGNED NOT NULL,
    digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    FOREIGN KEY (node_id) REFERENCES nodes(id)
) ENGINE=InnoDB;

CREATE TABLE resource_usage_samples (
    bucket_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    scope_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    actor_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    revision BIGINT UNSIGNED NOT NULL,
    starts_at BIGINT NOT NULL,
    ends_at BIGINT NOT NULL,
    consumed_bytes VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    session_epoch BIGINT UNSIGNED NOT NULL,
    report_sequence BIGINT UNSIGNED NOT NULL,
    snapshot_generation BIGINT UNSIGNED NOT NULL,
    received_at BIGINT NOT NULL,
    FOREIGN KEY (bucket_id) REFERENCES shared_resource_limit_buckets(bucket_id),
    INDEX resource_usage_subject (node_id,actor_id)
) ENGINE=InnoDB;

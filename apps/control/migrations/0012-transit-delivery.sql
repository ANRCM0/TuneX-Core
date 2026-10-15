-- Transport-only, non-executable Transit command preview and receipt journal.
-- These rows DO NOT grant a listener, session lease, or live Transit activation.
CREATE TABLE transit_delivery_outbox (
 envelope_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 generation BIGINT UNSIGNED NOT NULL,
 coordination_revision BIGINT UNSIGNED NOT NULL,
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_epoch BIGINT UNSIGNED NOT NULL,
 command_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 body JSON NOT NULL,
 state ENUM('pending','acknowledged') NOT NULL DEFAULT 'pending',
 created_at BIGINT UNSIGNED NOT NULL,
 acknowledged_at BIGINT UNSIGNED NULL,
 UNIQUE KEY transit_delivery_command_revision(forward_id,generation,coordination_revision,node_id),
 KEY transit_delivery_node_pending(node_id,state,created_at),
 FOREIGN KEY(forward_id,generation) REFERENCES transit_coordination(forward_id,generation),
 FOREIGN KEY(node_id) REFERENCES nodes(id)
);
CREATE TABLE transit_delivery_receipts (
 node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_epoch BIGINT UNSIGNED NOT NULL,
 report_sequence BIGINT UNSIGNED NOT NULL,
 envelope_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_digest VARCHAR(71) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 received_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(node_id,session_epoch,report_sequence),
 FOREIGN KEY(envelope_digest) REFERENCES transit_delivery_outbox(envelope_digest),
 FOREIGN KEY(node_id) REFERENCES nodes(id),
 KEY transit_delivery_receipt_target(envelope_digest)
);

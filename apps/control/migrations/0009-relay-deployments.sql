CREATE TABLE relay_deployments (
 forward_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 generation BIGINT UNSIGNED NOT NULL,
 target_revision BIGINT UNSIGNED NOT NULL,
 ingress_node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 egress_node_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 stage ENUM('preparing','egress_active','ingress_active','active','withdrawn') NOT NULL DEFAULT 'preparing',
 body JSON NOT NULL,
 created_at BIGINT UNSIGNED NOT NULL,
 updated_at BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(forward_id,generation),
 CHECK(generation BETWEEN 1 AND 9007199254740991),
 FOREIGN KEY(forward_id) REFERENCES forwards(id),
 FOREIGN KEY(ingress_node_id) REFERENCES nodes(id),
 FOREIGN KEY(egress_node_id) REFERENCES nodes(id),
 INDEX relay_ingress(ingress_node_id,forward_id,generation),
 INDEX relay_egress(egress_node_id,forward_id,generation)
);

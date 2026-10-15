ALTER TABLE relay_deployments
 ADD COLUMN path_nodes JSON NULL,
 ADD COLUMN prepared_count INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN activated_count INT UNSIGNED NOT NULL DEFAULT 0,
 ADD CONSTRAINT multihop_prepared_count CHECK(prepared_count <= 8),
 ADD CONSTRAINT multihop_activated_count CHECK(activated_count <= 8);

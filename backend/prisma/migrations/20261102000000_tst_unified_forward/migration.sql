-- Non-destructive replacement. Historical credentials/snapshots stay sealed and
-- retained for backup/audit. They are never interpreted as TST configurations.
ALTER TABLE `link_resource`
  MODIFY `carrier` VARCHAR(32) NOT NULL DEFAULT 'tst_v1',
  ADD COLUMN `managed_by` VARCHAR(24) NOT NULL DEFAULT 'manual',
  ADD COLUMN `reuse_key` CHAR(64) NULL,
  ADD COLUMN `last_unreferenced_at` DATETIME(3) NULL;
CREATE UNIQUE INDEX `link_resource_reuse_key_key` ON `link_resource` (`reuse_key`);
ALTER TABLE `tunnel` ADD COLUMN `forward_delete_requested_at` DATETIME(3) NULL;
UPDATE `link_resource` SET `status` = 'legacy_unsupported' WHERE `carrier` <> 'tst_v1';
UPDATE `link_deployment` d JOIN `link_resource` l ON l.id = d.link_id
  SET d.status = 'legacy_unsupported' WHERE l.carrier <> 'tst_v1';
UPDATE `tunnel` t JOIN `link_resource` l ON l.id = t.link_resource_id
  SET t.apply_status = 'error', t.apply_error_code = 'legacy_transport_unsupported',
      t.apply_error = '旧加密传输已停止支持，请创建 TST 替代规则。'
  WHERE l.carrier <> 'tst_v1';
CREATE TABLE `forward_operation` (
  `id` VARCHAR(36) NOT NULL,
  `workspace_id` INTEGER NOT NULL,
  `actor_id` INTEGER NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `request` JSON NOT NULL,
  `forward_id` INTEGER NULL,
  `link_id` INTEGER NULL,
  `state` VARCHAR(24) NOT NULL DEFAULT 'accepted',
  `stage` VARCHAR(32) NOT NULL DEFAULT 'accepted',
  `error_code` VARCHAR(64) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `executor_token` VARCHAR(36) NULL,
  `executor_expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `forward_operation_workspace_id_actor_id_idempotency_key_key` (`workspace_id`, `actor_id`, `idempotency_key`),
  INDEX `forward_operation_state_executor_expires_at_idx` (`state`, `executor_expires_at`),
  INDEX `forward_operation_workspace_id_forward_id_idx` (`workspace_id`, `forward_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

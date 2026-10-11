ALTER TABLE `tunnel` ADD COLUMN `routing_security_version` INTEGER NOT NULL DEFAULT 0;
CREATE TABLE `routing_decision` (
  `id` CHAR(36) NOT NULL, `policy_id` INTEGER NOT NULL, `workspace_id` INTEGER NOT NULL,
  `forward_id` INTEGER NOT NULL, `policy_version` INTEGER NOT NULL, `receipt` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `routing_decision_workspace_id_forward_id_created_at_idx` (`workspace_id`,`forward_id`,`created_at`),
  CONSTRAINT `routing_decision_policy_id_fkey` FOREIGN KEY (`policy_id`) REFERENCES `routing_policy` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `routing_runtime` (
  `id` INTEGER NOT NULL AUTO_INCREMENT, `workspace_id` INTEGER NOT NULL, `forward_id` INTEGER NOT NULL,
  `revision` INTEGER NOT NULL, `path` JSON NOT NULL, `sealed_credentials` JSON NOT NULL,
  `expires_at` DATETIME(3) NOT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `routing_runtime_forward_id_revision_key` (`forward_id`,`revision`),
  CONSTRAINT `routing_runtime_forward_id_fkey` FOREIGN KEY (`forward_id`) REFERENCES `tunnel` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

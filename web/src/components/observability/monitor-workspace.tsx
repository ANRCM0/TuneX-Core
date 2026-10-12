"use client";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useI18n } from "@/components/providers";
import { MonitorPanel } from "./monitor-panel";

export function MonitorWorkspace() {
  const workspace = useWorkspace(), { locale } = useI18n();
  if (workspace.loading || workspace.permissionsLoading) return <p role="status">{locale === "en" ? "Loading workspace permissions…" : "正在读取工作空间权限…"}</p>;
  if (workspace.currentId === null) return <p role="status">{locale === "en" ? "Select an available workspace." : "请选择可用的工作空间。"}</p>;
  return <MonitorPanel key={workspace.currentId} workspaceId={workspace.currentId} locale={locale} canRead={workspace.can("forward:read") && workspace.can("node:read")} />;
}

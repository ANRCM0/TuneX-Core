import { AppShell, currentLocale } from "@/components/app-shell";
import { MonitorWorkspace } from "@/components/observability/monitor-workspace";

export default async function MonitorPage() {
  const en = (await currentLocale()) === "en";
  return <AppShell title={en ? "Unified monitoring" : "统一监控"} subtitle={en ? "Workspace usage, resource relationships and observation freshness" : "空间用量、资源关联与观测新鲜度"}>
    <MonitorWorkspace />
  </AppShell>;
}

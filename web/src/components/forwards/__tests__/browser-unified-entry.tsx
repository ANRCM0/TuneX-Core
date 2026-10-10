import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/components/providers";
import { WorkspaceContext, type WorkspaceContextValue } from "@/components/workspace/workspace-context";
import { getDictionary } from "@/lib/i18n";
import { setActiveWorkspace } from "@/lib/api/core";
import { ForwardWorkspace } from "../forward-workspace";
function Harness() {
  const [workspaceId, setWorkspaceId] = useState(5);
  const [epoch, setEpoch] = useState(0);
  const [reader, setReader] = useState(false);
  setActiveWorkspace(workspaceId);
  const workspace = { currentId: workspaceId, loading: false, permissionsLoading: false,
    permissions: { workspace_id: workspaceId, role: reader ? "viewer" : "owner" }, can: (key: string) => !reader || key.endsWith(":read"), canForward: () => !reader } as unknown as WorkspaceContextValue;
  async function scenario(value: Record<string, unknown>) {
    await fetch("/__test/scenario", { method: "POST", body: JSON.stringify(value) }); setEpoch((current) => current + 1);
  }
  return <WorkspaceContext.Provider value={workspace}><main data-fixture-epoch={epoch} className="mx-auto max-w-7xl space-y-4 p-4"><h1>Unified Forward browser fixture</h1><p>Isolated HTTP fixture using production CSS; no real Agent or production traffic.</p>
    <div className="flex flex-wrap gap-3"><button onClick={() => setWorkspaceId((current) => current === 5 ? 6 : 5)}>Switch fixture workspace</button>
      <button onClick={() => setReader((current) => !current)}>Toggle fixture reader</button>
      <button onClick={() => void scenario({ tst: true })}>Enable fixture TST</button>
      <button onClick={() => void scenario({ delay: true })}>Delay fixture requests</button>
      <button onClick={() => void scenario({ delay: false, tst: false })}>Reset fixture scenario</button></div>
    <p>Workspace {workspaceId}</p><ForwardWorkspace key={epoch} />
  </main></WorkspaceContext.Provider>;
}
const fixtureLocale = new URLSearchParams(window.location.search).get("locale") === "zh" ? "zh" : "en";
createRoot(document.getElementById("root")!).render(<I18nProvider locale={fixtureLocale} dict={getDictionary(fixtureLocale)}><Harness /></I18nProvider>);

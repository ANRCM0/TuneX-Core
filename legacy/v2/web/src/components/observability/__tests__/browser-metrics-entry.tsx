import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MonitorPanel } from "../monitor-panel";
function Harness() {
  const [workspaceId, setWorkspaceId] = useState(5), [canRead, setCanRead] = useState(true), [generation, setGeneration] = useState(0);
  const locale = new URLSearchParams(location.search).get("locale") ?? "en";
  return <main className="mx-auto max-w-6xl space-y-5 p-4">
    <h1>Isolated unified monitoring acceptance</h1><p>Server-projected HTTP fixtures and production CSS; no live collector.</p>
    <div className="flex flex-wrap gap-3"><button onClick={() => setWorkspaceId((id) => id === 5 ? 6 : 5)}>Switch workspace</button>
      <button onClick={() => setCanRead((value) => !value)}>Toggle permissions</button><button onClick={() => setGeneration((value) => value + 1)}>Reload fixture</button></div>
    <MonitorPanel key={generation} workspaceId={workspaceId} canRead={canRead} locale={locale} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);

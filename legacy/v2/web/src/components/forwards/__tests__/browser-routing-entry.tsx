import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ForwardRoutingCard } from "../forward-routing-card";
function Harness() {
  const [workspaceId, setWorkspaceId] = useState(5), [reader, setReader] = useState(false), [epoch, setEpoch] = useState(0);
  async function scenario(body: unknown) { await fetch("/__test/scenario", { method: "POST", body: JSON.stringify(body) }); setEpoch((value) => value + 1); }
  return <main className="mx-auto max-w-2xl space-y-4 p-4" data-testid="fixture-gates">
    <h1>Isolated routing component acceptance</h1><p>HTTP fixtures, production CSS; no production or Agent traffic.</p>
    <div className="flex flex-wrap gap-3"><button onClick={() => setWorkspaceId((id) => id === 5 ? 6 : 5)}>Switch workspace</button>
      <button onClick={() => setReader((value) => !value)}>Toggle reader</button><button onClick={() => void scenario({ conflict: true })}>Enable conflict</button>
      <button onClick={() => void scenario({ delay: true })}>Delay reads</button><button onClick={() => void scenario({ enabled: false })}>Disable routing</button></div>
    <p>Workspace {workspaceId}</p><ForwardRoutingCard key={`${workspaceId}-${epoch}`} forwardId={40} workspaceId={workspaceId} locale={new URLSearchParams(location.search).get("locale") ?? "en"} canUpdate={!reader} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);

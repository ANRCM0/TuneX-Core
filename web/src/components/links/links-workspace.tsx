"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { linksApi } from "@/lib/links-api";
import type { LinkResource } from "@/lib/links-types";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";

export function LinksWorkspace() {
  const workspace = useWorkspace(); const { locale } = useI18n();
  const T = (key: string) => unifiedForwardText(locale, key);
  if (workspace.loading || workspace.permissionsLoading) return <p role="status">{T("loading")}</p>;
  if (workspace.currentId === null) return <p>{T("workspace")}</p>;
  if (!workspace.can("node:read")) return <p role="alert">{T("denied")}</p>;
  return <ScopedLinks key={JSON.stringify([workspace.currentId, workspace.permissions])} workspaceId={workspace.currentId} locale={locale} />;
}
function ScopedLinks({ workspaceId, locale }: { workspaceId: number; locale: string }) {
  const [rows, setRows] = useState<LinkResource[]>([]); const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true); const [epoch, setEpoch] = useState(0);
  const T = (key: string) => unifiedForwardText(locale, key);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false);
    void linksApi.list(workspaceId, controller.signal).then((value) => { if (!controller.signal.aborted) setRows(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, epoch]);
  return <div className="space-y-4"><p className="text-sm text-[var(--muted-foreground)]">{T("advancedHint")}</p><div className="flex gap-2"><Button variant="outline" onClick={() => setEpoch((value) => value + 1)}>{T("refresh")}</Button><Button asChild><Link href="/forwards">{T("forwards")}</Link></Button></div>
    {loading ? <p role="status">{T("loading")}</p> : error ? <p role="alert">{T("failed")}</p> : !rows.length ? <p>{T("noLinks")}</p> : rows.map((row) => <Card key={row.id}><CardHeader><CardTitle>{row.name} <Badge variant="outline">TST/1</Badge></CardTitle></CardHeader><CardContent><dl className="grid gap-3 text-sm sm:grid-cols-4">{[[T("status"), row.status], [T("version"), row.desired_version], [T("generation"), row.generation], [T("references"), row.ref_count ?? T("unknown")]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl></CardContent></Card>)}
  </div>;
}

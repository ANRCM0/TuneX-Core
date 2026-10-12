import { z } from "zod";
import { metricWindow, ObservabilityError, usage, type ArchiveFact, type CheckpointFact, type MetricWindow } from "./model.ts";

export interface HistorySelection { scope: "workspace" | "forward" | "link" | "node"; id: number | null }
const Query = z.strictObject({
  start_date: z.string().optional(), end_date: z.string().optional(),
  scope: z.enum(["workspace", "forward", "link", "node"]).default("workspace"),
  id: z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger).optional(),
}).refine((q) => q.scope === "workspace" ? q.id === undefined : q.id !== undefined);
export function historyQuery(raw: unknown, now = new Date()) {
  const q = Query.parse(raw);
  return { selection: { scope: q.scope, id: q.id ?? null } as HistorySelection,
    window: metricWindow({ start_date: q.start_date, end_date: q.end_date }, now) };
}
export type DailyArchive = Pick<ArchiveFact, "_sum" | "_count"> & { date: Date };
export type DailyCheckpoint = Pick<CheckpointFact, "_sum" | "_max" | "_count"> & { date: Date };
export function historyDates(window: MetricWindow) {
  const result: string[] = [];
  for (let stamp = Date.parse(`${window.start_date}T00:00:00Z`); stamp <= Date.parse(`${window.end_date}T00:00:00Z`); stamp += 86400_000)
    result.push(new Date(stamp).toISOString().slice(0, 10));
  return result;
}
/** All calendar days are present; missing ledger rows remain null. Sources never merge. */
export function projectHistory(workspace: number, selection: HistorySelection, inputWindow: MetricWindow,
  archives: DailyArchive[], checkpoints: DailyCheckpoint[], now = new Date()) {
  selection = historyQuery({ scope: selection.scope, ...(selection.id === null ? {} : { id: String(selection.id) }) }, now).selection;
  const window = metricWindow({ start_date: inputWindow.start_date, end_date: inputWindow.end_date }, now);
  const dates = historyDates(window), allowed = new Set(dates);
  const index = <T extends { date: Date; _count: { _all: number } }>(rows: T[]) => {
    if (rows.length > dates.length) throw new ObservabilityError("metrics_limit_exceeded", 422);
    const mapped = new Map<string, T>();
    for (const row of rows) {
      if (!Number.isFinite(row.date.getTime()) || row.date.getTime() % 86400_000 !== 0
        || !Number.isSafeInteger(row._count._all) || row._count._all < 1) throw new ObservabilityError("metrics_history_invalid", 503);
      const date = row.date.toISOString().slice(0, 10);
      if (!allowed.has(date) || mapped.has(date)) throw new ObservabilityError("metrics_history_invalid", 503);
      mapped.set(date, row);
    }
    return mapped;
  };
  const a = index(archives), c = index(checkpoints);
  const attributed = selection.scope === "workspace" || selection.scope === "forward";
  if (!attributed && archives.length) throw new ObservabilityError("metrics_history_invalid", 503);
  const archiveFacts = (rows: DailyArchive[]) => rows.map((row) => ({ ...row, _max: { date: row.date } }));
  const dailyUsage = (ar: DailyArchive[], cp: DailyCheckpoint[]) => {
    const result = usage(archiveFacts(ar), cp, now);
    if (!attributed) {
      result.archive.bytes.freshness.reason = "archive_not_attributed";
      result.archive.cost_bytes.freshness.reason = "archive_not_attributed";
    }
    return result;
  };
  return { schema_version: 1 as const, workspace_id: workspace, selection, generated_at: now.toISOString(), window,
    grain: "day" as const, archive_scope: selection.scope === "workspace" ? "immutable_workspace_ledger" as const
      : selection.scope === "forward" ? "immutable_forward_ledger" as const : "not_attributed" as const,
    totals: dailyUsage(archives, checkpoints),
    days: dates.map((date) => ({ date, usage: dailyUsage(a.has(date) ? [a.get(date)!] : [], c.has(date) ? [c.get(date)!] : []) })) };
}
export type ObservabilityHistory = ReturnType<typeof projectHistory>;

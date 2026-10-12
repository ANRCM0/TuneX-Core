/** Internal resource metadata only. Keys, certificates and deployment snapshots stay on the server. */
export interface LinkResource {
  id: number; workspace_id: number; name: string; carrier: string; status: string;
  desired_version: number; generation: number; ref_count: number | null;
}
export function projectLinkList(value: unknown, workspaceId: number): LinkResource[] {
  if (!Array.isArray(value)) throw new Error("invalid_link_response");
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("invalid_link_response");
    const row = raw as Record<string, unknown>;
    const number = (key: string) => {
      const n = row[key];
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("invalid_link_response");
      return n;
    };
    if (row.workspace_id !== workspaceId || typeof row.name !== "string" || typeof row.status !== "string" || typeof row.carrier !== "string") throw new Error("invalid_link_response");
    return { id: number("id"), workspace_id: workspaceId, name: row.name, carrier: row.carrier, status: row.status,
      desired_version: number("desired_version"), generation: number("generation"), ref_count: row.ref_count == null ? null : number("ref_count") };
  });
}

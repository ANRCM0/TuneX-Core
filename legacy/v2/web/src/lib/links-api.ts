import { request } from "./api/core";
import { projectLinkList } from "./links-types";
export const linksApi = {
  list: async (workspaceId: number, signal?: AbortSignal) => projectLinkList(await request<unknown>("/links", { workspaceId, signal }), workspaceId),
};

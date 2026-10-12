import { Prisma } from "@prisma/client";
import { LinkResourceError } from "./link-errors.ts";

/** Must run after the workspace lock and before reserving resources. A replaced
 * executor can neither create a second business row nor overwrite its ledger. */
export async function lockForwardOperation(tx: Prisma.TransactionClient, id: string,
  token: string | undefined, workspaceId: number, actorId: number): Promise<number | null> {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM forward_operation WHERE id=${id} FOR UPDATE`);
  const operation = await tx.forwardOperation.findUnique({ where: { id } });
  if (!token || !operation || operation.workspace_id !== workspaceId || operation.actor_id !== actorId ||
    operation.executor_token !== token || !operation.executor_expires_at || operation.executor_expires_at <= new Date())
    throw new LinkResourceError("forward_executor_lost", 409);
  return operation.forward_id;
}

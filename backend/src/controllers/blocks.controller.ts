import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type { blockUserSchemas } from "../schemas/blocks.schemas.js";
import * as blockService from "../services/block.service.js";
import { sendNoContent, sendOk } from "../utils/response.js";

export async function listBlocks(req: Request, res: Response): Promise<void> {
  sendOk(res, await blockService.listBlockedUsers(currentUser(req).id));
}

export async function blockUser(req: ValidatedRequest<typeof blockUserSchemas>, res: Response): Promise<void> {
  const { block, created } = await blockService.blockUser(currentUser(req).id, req.params.userId);
  sendOk(res, block, created ? 201 : 200);
}

export async function unblockUser(req: ValidatedRequest<typeof blockUserSchemas>, res: Response): Promise<void> {
  await blockService.unblockUser(currentUser(req).id, req.params.userId);
  sendNoContent(res);
}

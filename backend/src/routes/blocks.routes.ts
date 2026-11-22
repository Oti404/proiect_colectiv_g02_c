import { Router } from "express";
import * as blocksController from "../controllers/blocks.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { blockUserSchemas } from "../schemas/blocks.schemas.js";

export const blocksRouter = Router();

blocksRouter.use(requireAuth);

blocksRouter.get("/", blocksController.listBlocks);
blocksRouter.post("/:userId", validate(blockUserSchemas), blocksController.blockUser);
blocksRouter.delete("/:userId", validate(blockUserSchemas), blocksController.unblockUser);

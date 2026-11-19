import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type { searchDogsSchemas } from "../routes/search.routes.js";
import * as searchService from "../services/search.service.js";
import { sendPaginated } from "../utils/response.js";

export async function searchDogs(req: ValidatedRequest<typeof searchDogsSchemas>, res: Response): Promise<void> {
  const { items, meta } = await searchService.searchDogs(currentUser(req as unknown as Request), req.query);
  sendPaginated(res, items, meta);
}

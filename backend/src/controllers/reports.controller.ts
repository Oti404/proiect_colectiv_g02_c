import type { Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type { createReportSchemas } from "../schemas/reports.schemas.js";
import * as reportsService from "../services/reports.service.js";
import { sendCreated } from "../utils/response.js";

export async function createReport(req: ValidatedRequest<typeof createReportSchemas>, res: Response): Promise<void> {
  sendCreated(res, await reportsService.createReport(currentUser(req).id, req.body));
}

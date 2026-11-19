import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  createHealthRecordSchemas,
  deleteHealthRecordSchemas,
  dogCareParamsSchemas,
  listHealthRecordsSchemas,
  updateHealthRecordSchemas,
} from "../routes/care.routes.js";
import * as careService from "../services/care.service.js";
import { sendCreated, sendNoContent, sendOk } from "../utils/response.js";

export async function listHealthRecords(
  req: ValidatedRequest<typeof listHealthRecordsSchemas>,
  res: Response,
): Promise<void> {
  const records = await careService.listHealthRecords(
    currentUser(req as unknown as Request).id,
    req.params.id,
    req.query.type,
  );
  sendOk(res, records);
}

export async function createHealthRecord(
  req: ValidatedRequest<typeof createHealthRecordSchemas>,
  res: Response,
): Promise<void> {
  const record = await careService.createHealthRecord(currentUser(req).id, req.params.id, req.body);
  sendCreated(res, record);
}

export async function updateHealthRecord(
  req: ValidatedRequest<typeof updateHealthRecordSchemas>,
  res: Response,
): Promise<void> {
  const record = await careService.updateHealthRecord(
    currentUser(req).id,
    req.params.id,
    req.params.recordId,
    req.body,
  );
  sendOk(res, record);
}

export async function deleteHealthRecord(
  req: ValidatedRequest<typeof deleteHealthRecordSchemas>,
  res: Response,
): Promise<void> {
  await careService.deleteHealthRecord(currentUser(req).id, req.params.id, req.params.recordId);
  sendNoContent(res);
}

export async function getReminders(
  req: ValidatedRequest<typeof dogCareParamsSchemas>,
  res: Response,
): Promise<void> {
  const reminders = await careService.getReminders(currentUser(req).id, req.params.id);
  sendOk(res, reminders);
}

export async function getWeightHistory(
  req: ValidatedRequest<typeof dogCareParamsSchemas>,
  res: Response,
): Promise<void> {
  const history = await careService.getWeightHistory(currentUser(req).id, req.params.id);
  sendOk(res, history);
}

export async function getDailyTip(
  req: ValidatedRequest<typeof dogCareParamsSchemas>,
  res: Response,
): Promise<void> {
  const tip = await careService.getDailyTip(currentUser(req).id, req.params.id);
  sendOk(res, tip);
}

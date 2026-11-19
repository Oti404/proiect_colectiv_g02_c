import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type { deleteMeSchemas, getUserSchemas, updateMeSchemas } from "../schemas/users.schemas.js";
import * as usersService from "../services/users.service.js";
import { sendNoContent, sendOk } from "../utils/response.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  sendOk(res, await usersService.getSelf(currentUser(req).id));
}

export async function updateMe(req: ValidatedRequest<typeof updateMeSchemas>, res: Response): Promise<void> {
  sendOk(res, await usersService.updateMe(currentUser(req).id, req.body));
}

export async function deleteMe(req: ValidatedRequest<typeof deleteMeSchemas>, res: Response): Promise<void> {
  await usersService.deleteMe(currentUser(req).id, req.body.password);
  sendNoContent(res);
}

export async function getUser(req: ValidatedRequest<typeof getUserSchemas>, res: Response): Promise<void> {
  sendOk(res, await usersService.getPublicProfile(currentUser(req).id, req.params.id));
}

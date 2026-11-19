import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type { loginSchemas, registerSchemas } from "../schemas/auth.schemas.js";
import * as authService from "../services/auth.service.js";
import { sendCreated, sendOk } from "../utils/response.js";

export async function register(req: ValidatedRequest<typeof registerSchemas>, res: Response): Promise<void> {
  sendCreated(res, await authService.register(req.body));
}

export async function login(req: ValidatedRequest<typeof loginSchemas>, res: Response): Promise<void> {
  sendOk(res, await authService.login(req.body));
}

export async function me(req: Request, res: Response): Promise<void> {
  sendOk(res, await authService.getSelf(currentUser(req).id));
}

import type { Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  createDogSchemas,
  deleteDogSchemas,
  getDogSchemas,
  updateDogSchemas,
} from "../routes/dogs.routes.js";
import * as dogsService from "../services/dogs.service.js";
import { sendCreated, sendNoContent, sendOk } from "../utils/response.js";

export async function getDog(req: ValidatedRequest<typeof getDogSchemas>, res: Response): Promise<void> {
  const dog = await dogsService.getDog(currentUser(req).id, req.params.id);
  sendOk(res, dog);
}

export async function createDog(req: ValidatedRequest<typeof createDogSchemas>, res: Response): Promise<void> {
  const dog = await dogsService.createDog(currentUser(req).id, req.body);
  sendCreated(res, dog);
}

export async function updateDog(req: ValidatedRequest<typeof updateDogSchemas>, res: Response): Promise<void> {
  const dog = await dogsService.updateDog(currentUser(req).id, req.params.id, req.body);
  sendOk(res, dog);
}

export async function deleteDog(req: ValidatedRequest<typeof deleteDogSchemas>, res: Response): Promise<void> {
  await dogsService.deleteDog(currentUser(req).id, req.params.id);
  sendNoContent(res);
}

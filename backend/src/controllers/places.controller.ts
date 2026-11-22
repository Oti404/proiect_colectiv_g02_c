import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  createPlaceReviewSchemas,
  getPlaceSchemas,
  listPlacesSchemas,
} from "../routes/places.routes.js";
import * as placesService from "../services/places.service.js";
import { sendCreated, sendOk } from "../utils/response.js";

export async function listPlaces(req: ValidatedRequest<typeof listPlacesSchemas>, res: Response): Promise<void> {
  const places = await placesService.listPlaces(req.query);
  sendOk(res, places);
}

export async function getPlace(req: ValidatedRequest<typeof getPlaceSchemas>, res: Response): Promise<void> {
  const place = await placesService.getPlaceById(req.params.id);
  sendOk(res, place);
}

export async function createPlaceReview(
  req: ValidatedRequest<typeof createPlaceReviewSchemas>,
  res: Response,
): Promise<void> {
  const review = await placesService.createPlaceReview(
    currentUser(req as unknown as Request).id,
    req.params.id,
    req.body,
  );
  sendCreated(res, review);
}

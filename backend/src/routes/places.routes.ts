import { Router } from "express";
import { z } from "zod";
import { createPlaceReview, getPlace, listPlaces } from "../controllers/places.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";

const placeTypeSchema = z.enum(["PARK", "DOG_PARK", "CAFE", "VET", "PET_SHOP"]);

const placeIdParams = z.object({
  id: z.uuid(),
});

export const listPlacesSchemas = {
  query: z.object({
    type: placeTypeSchema.optional(),
    q: z.string().trim().max(100).optional(),
  }),
};

export const getPlaceSchemas = {
  params: placeIdParams,
};

export const createPlaceReviewSchemas = {
  params: placeIdParams,
  body: z.object({
    eventId: z.uuid(),
    rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
    tags: z
      .array(z.string().trim().min(1, "Tag cannot be empty").max(50, "Tag is too long"))
      .max(10, "Maximum 10 tags allowed")
      .default([]),
  }),
};

export const placesRouter = Router();

placesRouter.use(requireAuth);

placesRouter.get("/", validate(listPlacesSchemas), listPlaces);
placesRouter.get("/:id", validate(getPlaceSchemas), getPlace);
placesRouter.post("/:id/reviews", validate(createPlaceReviewSchemas), createPlaceReview);

import { Router } from "express";
import { z } from "zod";
import { searchDogs } from "../controllers/search.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { paginationQuery } from "../utils/pagination.js";

export const searchDogsSchemas = {
  query: paginationQuery.extend({
    q: z
      .string()
      .trim()
      .max(100)
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    breedId: z.uuid().optional(),
    size: z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]).optional(),
    temperament: z.enum(["FRIENDLY", "PLAYFUL", "SHY", "REACTIVE"]).optional(),
    ageGroup: z.enum(["PUPPY", "ADULT", "SENIOR"]).optional(),
    neuteredOnly: z.stringbool().optional(),
    maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  }),
};

export const searchRouter = Router();

searchRouter.use(requireAuth);
searchRouter.get("/dogs", validate(searchDogsSchemas), searchDogs);

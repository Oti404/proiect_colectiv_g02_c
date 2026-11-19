import { Router } from "express";
import { z } from "zod";
import { createDog, deleteDog, getDog, updateDog } from "../controllers/dogs.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";

const sexSchema = z.enum(["MALE", "FEMALE"]);
const dogSizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]);
const temperamentSchema = z.enum(["FRIENDLY", "PLAYFUL", "SHY", "REACTIVE"]);

const birthDateSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid birthDate" })
      .transform((value) => new Date(value))
      .refine((date) => date <= new Date(), { message: "birthDate cannot be in the future" }),
    z.null(),
  ]);

const photoUrlSchema = z.union([
  z
    .string()
    .trim()
    .max(2048, "photoUrl is too long")
    .transform((value) => (value === "" ? null : value)),
  z.null(),
]);

const dogIdParams = z.object({
  id: z.uuid(),
});

export const getDogSchemas = {
  params: dogIdParams,
};

export const createDogSchemas = {
  body: z.object({
    breedId: z.uuid(),
    name: z.string().trim().min(1, "Dog name is required").max(100),
    birthDate: birthDateSchema.optional(),
    sex: sexSchema,
    size: dogSizeSchema,
    temperament: temperamentSchema,
    neutered: z.boolean().default(false),
    photoUrl: photoUrlSchema.optional(),
  }),
};

export const updateDogSchemas = {
  params: dogIdParams,
  body: z
    .object({
      breedId: z.uuid().optional(),
      name: z.string().trim().min(1, "Dog name cannot be empty").max(100).optional(),
      birthDate: birthDateSchema.optional(),
      sex: sexSchema.optional(),
      size: dogSizeSchema.optional(),
      temperament: temperamentSchema.optional(),
      neutered: z.boolean().optional(),
      photoUrl: photoUrlSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
};

export const deleteDogSchemas = {
  params: dogIdParams,
};

export const dogsRouter = Router();

dogsRouter.get("/:id", requireAuth, validate(getDogSchemas), getDog);
dogsRouter.post("/", requireAuth, validate(createDogSchemas), createDog);
dogsRouter.patch("/:id", requireAuth, validate(updateDogSchemas), updateDog);
dogsRouter.delete("/:id", requireAuth, validate(deleteDogSchemas), deleteDog);

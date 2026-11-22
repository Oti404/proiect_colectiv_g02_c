import { z } from "zod";
import {
  bioSchema,
  emailSchema,
  latitudeSchema,
  longitudeSchema,
  nameSchema,
  newPasswordSchema,
} from "./common.schemas.js";

export const registerSchemas = {
  body: z.object({
    email: emailSchema,
    password: newPasswordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    bio: bioSchema.nullish(),
    // Locația exactă nu se salvează: serviciul o rotunjește la 2 zecimale (~1 km).
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    // GDPR: contul se creează doar cu acordul explicit; momentul se salvează în `consentAt`.
    consentAccepted: z.literal(true, { error: "GDPR consent is required" }),
  }),
};

export type RegisterInput = z.infer<typeof registerSchemas.body>;

export const loginSchemas = {
  body: z.object({
    email: emailSchema,
    // La login nu verificăm lungimea minimă: conturile demo au parole scurte.
    password: z.string().min(1, "Required"),
  }),
};

export type LoginInput = z.infer<typeof loginSchemas.body>;

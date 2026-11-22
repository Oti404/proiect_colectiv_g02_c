import { z } from "zod";
import { bioSchema, latitudeSchema, longitudeSchema, nameSchema, uuidParam } from "./common.schemas.js";

const avatarUrlSchema = z.url({ protocol: /^https?$/, error: "Must be an http(s) URL" }).max(2048);

export const updateMeSchemas = {
  body: z
    .object({
      firstName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      // `null` sau "" șterge valoarea.
      bio: bioSchema.nullable().optional(),
      avatarUrl: z.union([avatarUrlSchema, z.literal("")]).nullable().optional(),
      latitude: latitudeSchema.optional(),
      longitude: longitudeSchema.optional(),
    })
    .strict()
    .refine((body) => (body.latitude === undefined) === (body.longitude === undefined), {
      error: "latitude and longitude must be sent together",
      path: ["latitude"],
    })
    .refine((body) => Object.keys(body).length > 0, { error: "Nothing to update" }),
};

export type UpdateMeInput = z.infer<typeof updateMeSchemas.body>;

export const deleteMeSchemas = {
  // Parola se cere din nou, ca un token furat să nu poată șterge contul.
  body: z.object({ password: z.string().min(1, "Required") }),
};

export const getUserSchemas = {
  params: uuidParam("id"),
};

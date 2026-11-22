import { z } from "zod";

// Bucăți de validare refolosite de mai multe module.

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Invalid email address").max(254));

// bcrypt folosește doar primii 72 de octeți din parolă; peste atât refuzăm, ca să nu fie trunchiată pe tăcute.
export const newPasswordSchema = z
  .string()
  .min(8, "Password must have at least 8 characters")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long (max 72 bytes)");

export const nameSchema = z.string().trim().min(1, "Required").max(50);

export const bioSchema = z.string().trim().max(500);

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const uuidParam = (name: string) => z.object({ [name]: z.uuid(`Invalid ${name}`) });

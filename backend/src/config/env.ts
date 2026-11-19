import "dotenv/config";
import { z } from "zod";

// Variabilele de mediu sunt validate o singură dată, la pornire.
// Dacă lipsește ceva obligatoriu, serverul se oprește imediat cu un mesaj clar.

const DEV_JWT_SECRET = "dev-only-secret-schimbati-l-in-productie";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL lipsește"),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variabile de mediu invalide:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

// În producție JWT_SECRET e obligatoriu și trebuie să fie lung.
// În dezvoltare și la teste folosim un secret implicit, ca să nu blocăm pe nimeni.
let jwtSecret = raw.JWT_SECRET;
if (!jwtSecret) {
  if (raw.NODE_ENV === "production") {
    console.error("JWT_SECRET lipsește. Adăugați-l în .env (minim 32 de caractere).");
    process.exit(1);
  }
  if (raw.NODE_ENV === "development") {
    console.warn("JWT_SECRET nu e setat, se folosește un secret de dezvoltare.");
  }
  jwtSecret = DEV_JWT_SECRET;
} else if (raw.NODE_ENV === "production" && jwtSecret.length < 32) {
  console.error("JWT_SECRET trebuie să aibă cel puțin 32 de caractere în producție.");
  process.exit(1);
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  jwtSecret,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
} as const;

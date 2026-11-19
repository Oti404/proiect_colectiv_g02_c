import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";
import { signAccessToken } from "../../src/utils/jwt.js";

/** Golește toate tabelele (în afară de istoricul migrărilor). */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export const TEST_PASSWORD = "parola-de-test-123";

let userCounter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  /** Header-ul gata făcut: `.set(auth(user))` → `Authorization: Bearer ...` */
  authHeader: { Authorization: string };
}

/** Creează direct în baza de date un utilizator, cu token JWT valid. */
export async function createUser(
  overrides: Partial<{ email: string; firstName: string; lastName: string; bio: string | null }> = {},
): Promise<TestUser> {
  userCounter += 1;
  const email = overrides.email ?? `user${userCounter}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      // Cost mic: testele nu au nevoie de un hash lent.
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      firstName: overrides.firstName ?? `First${userCounter}`,
      lastName: overrides.lastName ?? `Last${userCounter}`,
      bio: overrides.bio ?? null,
      approxLatitude: 46.77,
      approxLongitude: 23.59,
      consentAt: new Date(),
    },
  });
  const token = signAccessToken(user.id);
  return { id: user.id, email, token, authHeader: { Authorization: `Bearer ${token}` } };
}

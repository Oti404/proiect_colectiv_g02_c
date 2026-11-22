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

let breedCounter = 0;

/** Creează o rasă de test (numele e unic în baza de date). */
export async function createBreed(): Promise<{ id: string }> {
  breedCounter += 1;
  return prisma.breed.create({
    data: { name: `Test breed ${breedCounter}`, size: "MEDIUM", careTips: "Test tips", energyLevel: 3 },
    select: { id: true },
  });
}

/** Creează un câine al lui `owner` (utilizatorul sau doar id-ul lui). Fără `breedId`, creează și o rasă nouă. */
export async function createDog(
  owner: TestUser | string,
  overrides: Partial<{ name: string; breedId: string }> = {},
): Promise<{ id: string; name: string }> {
  const breedId = overrides.breedId ?? (await createBreed()).id;
  return prisma.dog.create({
    data: {
      ownerId: typeof owner === "string" ? owner : owner.id,
      breedId,
      name: overrides.name ?? "Rex",
      sex: "MALE",
      size: "MEDIUM",
      temperament: "FRIENDLY",
    },
    select: { id: true, name: true },
  });
}

export async function createEvent(
  organizerId: string,
  overrides: Partial<{ status: "ACTIVE" | "CANCELLED"; title: string }> = {},
) {
  const startsAt = new Date(Date.now() + 24 * 3600 * 1000);
  return prisma.event.create({
    data: {
      organizerId,
      title: overrides.title ?? "Plimbare",
      type: "GROUP_WALK",
      visibility: "PRIVATE",
      locationText: "Parcul Central",
      status: overrides.status ?? "ACTIVE",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600 * 1000),
    },
  });
}

export async function createPost(authorId: string) {
  return prisma.post.create({ data: { authorId, content: "Salut!" } });
}

/**
 * `blocker` îl blochează pe `blocked`. Încă nu există rută de block în API,
 * așa că testele scriu direct în tabelul `Block`.
 */
export async function block(blocker: TestUser, blocked: TestUser): Promise<void> {
  await prisma.block.create({ data: { blockerId: blocker.id, blockedId: blocked.id } });
}

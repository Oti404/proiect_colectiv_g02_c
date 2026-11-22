import { Prisma } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { HttpError, notFound } from "../utils/http-error.js";
import { userSummarySelect, type UserSummary } from "./user-selects.js";

/**
 * `true` dacă A l-a blocat pe B sau B l-a blocat pe A.
 * Se folosește la profil, mesaje, căutare, feed: blocarea ascunde ambele părți una de cealaltă.
 */
export async function isBlockedEitherWay(userA: string, userB: string, db: DbClient = prisma): Promise<boolean> {
  if (userA === userB) return false;
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { blockerId: true },
  });
  return block !== null;
}

/**
 * Id-urile utilizatorilor cu care `userId` are un block în oricare direcție.
 * Pentru filtrarea listelor: `where: { ownerId: { notIn: await getBlockedUserIds(me.id) } }`.
 */
export async function getBlockedUserIds(userId: string, db: DbClient = prisma): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  return [...new Set(ids)];
}

// ───────────── Endpoint-urile /api/blocks ─────────────

export interface BlockedUser {
  user: UserSummary;
  createdAt: Date;
}

/**
 * Blochează un utilizator. Idempotent: dacă block-ul există deja, îl întoarce pe cel existent.
 * `created` spune dacă s-a creat acum (201) sau exista deja (200).
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ block: BlockedUser; created: boolean }> {
  if (blockerId === blockedId) {
    throw new HttpError(400, "CANNOT_BLOCK_SELF", "You cannot block yourself");
  }
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: userSummarySelect });
  if (!target) throw notFound("User not found");

  const key = { blockerId_blockedId: { blockerId, blockedId } };
  const existing = await prisma.block.findUnique({ where: key, select: { createdAt: true } });
  if (existing) {
    return { block: { user: target, createdAt: existing.createdAt }, created: false };
  }

  try {
    const block = await prisma.block.create({ data: { blockerId, blockedId }, select: { createdAt: true } });
    return { block: { user: target, createdAt: block.createdAt }, created: true };
  } catch (err) {
    // Două cereri simultane: a doua găsește block-ul creat de prima.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const block = await prisma.block.findUniqueOrThrow({ where: key, select: { createdAt: true } });
      return { block: { user: target, createdAt: block.createdAt }, created: false };
    }
    throw err;
  }
}

/** Deblochează. Idempotent: nu e eroare dacă block-ul nu exista. */
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
}

/** Utilizatorii blocați de `userId` (doar în direcția lui), cei mai recenți primii. */
export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    select: { createdAt: true, blocked: { select: userSummarySelect } },
    orderBy: { createdAt: "desc" },
  });
  return blocks.map((b) => ({ user: b.blocked, createdAt: b.createdAt }));
}

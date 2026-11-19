import { prisma, type DbClient } from "../lib/prisma.js";

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

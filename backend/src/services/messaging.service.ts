import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { ListMessagesQuery } from "../schemas/messaging.schemas.js";
import { badRequest, HttpError, notFound } from "../utils/http-error.js";
import { getBlockedUserIds, isBlockedEitherWay } from "./block.service.js";
import { userSummarySelect, type UserSummary } from "./user-selects.js";

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  sentAt: true,
} satisfies Prisma.MessageSelect;

export type MessageDto = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export interface ConversationSummary {
  id: string;
  createdAt: Date;
  /** Ceilalți participanți. Gol dacă celălalt utilizator și-a șters contul. */
  otherParticipants: UserSummary[];
  lastMessage: MessageDto | null;
  unreadCount: number;
}

const conversationSelect = {
  id: true,
  createdAt: true,
  participants: { select: { userId: true, lastReadAt: true, user: { select: userSummarySelect } } },
  messages: { select: messageSelect, orderBy: [{ sentAt: "desc" }, { id: "desc" }], take: 1 },
} satisfies Prisma.ConversationSelect;

type ConversationRow = Prisma.ConversationGetPayload<{ select: typeof conversationSelect }>;

const blockedError = () => new HttpError(403, "BLOCKED", "You cannot exchange messages with this user");

function toSummary(row: ConversationRow, me: string, unreadCount: number): ConversationSummary {
  return {
    id: row.id,
    createdAt: row.createdAt,
    otherParticipants: row.participants.filter((p) => p.userId !== me).map((p) => p.user),
    lastMessage: row.messages[0] ?? null,
    unreadCount,
  };
}

const lastActivity = (c: ConversationSummary) => (c.lastMessage?.sentAt ?? c.createdAt).getTime();

/**
 * Mesajele necitite din fiecare conversație a utilizatorului, într-o singură interogare.
 * Necitit = trimis de altcineva (sau de un cont șters) după `lastReadAt`.
 */
async function getUnreadCounts(me: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ conversationId: string; count: number }[]>`
    SELECT cp."conversationId" AS "conversationId", COUNT(m."id")::int AS "count"
    FROM "ConversationParticipant" cp
    JOIN "Message" m ON m."conversationId" = cp."conversationId"
    WHERE cp."userId" = ${me}::uuid
      AND (m."senderId" IS NULL OR m."senderId" <> cp."userId")
      AND (cp."lastReadAt" IS NULL OR m."sentAt" > cp."lastReadAt")
    GROUP BY cp."conversationId"
  `;
  return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
}

/** Conversația, dacă utilizatorul participă la ea. Altfel 404 (nu dezvăluim că există). */
async function getConversationForParticipant(me: string, conversationId: string): Promise<ConversationRow> {
  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId: me } } },
    select: conversationSelect,
  });
  if (!row) throw notFound("Conversation not found");
  return row;
}

async function assertNoBlock(me: string, row: ConversationRow): Promise<void> {
  for (const p of row.participants) {
    if (p.userId !== me && (await isBlockedEitherWay(me, p.userId))) {
      throw blockedError();
    }
  }
}

// ───────────── Conversații ─────────────

/** Conversațiile mele, cele cu activitate recentă primele. Cele cu utilizatori blocați nu apar. */
export async function listConversations(me: string): Promise<ConversationSummary[]> {
  const [rows, blocked, unread] = await Promise.all([
    prisma.conversation.findMany({ where: { participants: { some: { userId: me } } }, select: conversationSelect }),
    getBlockedUserIds(me).then((ids) => new Set(ids)),
    getUnreadCounts(me),
  ]);

  return rows
    .filter((row) => !row.participants.some((p) => blocked.has(p.userId)))
    .map((row) => toSummary(row, me, unread.get(row.id) ?? 0))
    .sort((a, b) => lastActivity(b) - lastActivity(a));
}

export async function getConversation(me: string, conversationId: string): Promise<ConversationSummary> {
  const row = await getConversationForParticipant(me, conversationId);
  await assertNoBlock(me, row);
  const unread = await getUnreadCounts(me);
  return toSummary(row, me, unread.get(row.id) ?? 0);
}

/**
 * Deschide conversația 1-la-1 cu `otherUserId` sau o întoarce pe cea existentă.
 * Un lock pe perechea de utilizatori (în tranzacție) împiedică două conversații
 * create simultan pentru aceeași pereche.
 */
export async function startConversation(
  me: string,
  otherUserId: string,
): Promise<{ conversation: ConversationSummary; created: boolean }> {
  if (me === otherUserId) {
    throw new HttpError(400, "CANNOT_MESSAGE_SELF", "You cannot start a conversation with yourself");
  }
  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!other) throw notFound("User not found");
  if (await isBlockedEitherWay(me, otherUserId)) throw blockedError();

  const pairKey = [me, otherUserId].sort().join(":");
  const { conversationId, created } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${pairKey}))`;

    const existing = await tx.conversation.findFirst({
      where: {
        AND: [{ participants: { some: { userId: me } } }, { participants: { some: { userId: otherUserId } } }],
        participants: { every: { userId: { in: [me, otherUserId] } } },
      },
      select: { id: true },
    });
    if (existing) return { conversationId: existing.id, created: false };

    const conversation = await tx.conversation.create({
      data: {
        participants: {
          create: [
            { userId: me, lastReadAt: new Date() },
            { userId: otherUserId, lastReadAt: null },
          ],
        },
      },
      select: { id: true },
    });
    return { conversationId: conversation.id, created: true };
  });

  return { conversation: await getConversation(me, conversationId), created };
}

// ───────────── Mesaje ─────────────

export interface MessagesPage {
  messages: MessageDto[];
  hasMore: boolean;
}

/** Mesajele unei conversații, în ordine cronologică (cel mai vechi primul). */
export async function listMessages(me: string, conversationId: string, query: ListMessagesQuery): Promise<MessagesPage> {
  const row = await getConversationForParticipant(me, conversationId);
  await assertNoBlock(me, row);

  const cursorId = query.before ?? query.after;
  let cursor: { id: string; sentAt: Date } | null = null;
  if (cursorId) {
    cursor = await prisma.message.findFirst({
      where: { id: cursorId, conversationId },
      select: { id: true, sentAt: true },
    });
    if (!cursor) throw badRequest("The message used as cursor does not belong to this conversation");
  }

  // Ordinea e (sentAt, id), ca mesajele cu aceeași oră să nu se piardă sau dubleze între pagini.
  const newer = query.after !== undefined;
  const where: Prisma.MessageWhereInput = { conversationId };
  if (cursor) {
    const op = newer ? "gt" : "lt";
    where.OR = [{ sentAt: { [op]: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { [op]: cursor.id } }];
  }

  const direction = newer ? "asc" : "desc";
  const rows = await prisma.message.findMany({
    where,
    select: messageSelect,
    orderBy: [{ sentAt: direction }, { id: direction }],
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  return { messages: newer ? page : page.reverse(), hasMore };
}

export async function sendMessage(me: string, conversationId: string, content: string): Promise<MessageDto> {
  const row = await getConversationForParticipant(me, conversationId);
  if (!row.participants.some((p) => p.userId !== me)) {
    throw new HttpError(409, "CONVERSATION_CLOSED", "The other user has deleted their account");
  }
  await assertNoBlock(me, row);

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId: me, content },
      select: messageSelect,
    });
    // Cine trimite a citit, evident, conversația până la propriul mesaj.
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: me } },
      data: { lastReadAt: message.sentAt },
    });
    return message;
  });
}

/** Marchează conversația ca citită, până la ultimul mesaj. `lastReadAt` nu se mută niciodată înapoi. */
export async function markAsRead(me: string, conversationId: string): Promise<void> {
  const row = await getConversationForParticipant(me, conversationId);
  const mine = row.participants.find((p) => p.userId === me);
  const latest = row.messages[0]?.sentAt ?? new Date();
  if (mine?.lastReadAt && mine.lastReadAt >= latest) return;

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: me } },
    data: { lastReadAt: latest },
  });
}

/** Totalul de mesaje necitite (badge-ul din meniu), fără conversațiile cu utilizatori blocați. */
export async function getTotalUnreadCount(me: string): Promise<number> {
  const counts = await getUnreadCounts(me);
  if (counts.size === 0) return 0;

  const blocked = await getBlockedUserIds(me);
  let hidden = new Set<string>();
  if (blocked.length > 0) {
    const rows = await prisma.conversationParticipant.findMany({
      where: { conversationId: { in: [...counts.keys()] }, userId: { in: blocked } },
      select: { conversationId: true },
    });
    hidden = new Set(rows.map((r) => r.conversationId));
  }

  let total = 0;
  for (const [conversationId, count] of counts) {
    if (!hidden.has(conversationId)) total += count;
  }
  return total;
}

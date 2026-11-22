import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createUser, type TestUser } from "./helpers.js";

async function startConversation(me: TestUser, other: TestUser): Promise<string> {
  const res = await request(app).post("/api/conversations").set(me.authHeader).send({ userId: other.id });
  expect([200, 201]).toContain(res.status);
  return res.body.data.id;
}

async function send(me: TestUser, conversationId: string, content: string) {
  return request(app).post(`/api/conversations/${conversationId}/messages`).set(me.authHeader).send({ content });
}

async function unreadCount(user: TestUser): Promise<number> {
  const res = await request(app).get("/api/messages/unread-count").set(user.authHeader);
  expect(res.status).toBe(200);
  return res.body.data.count;
}

/** Mesaje cu ore fixe, ca ordinea să fie sigură. */
async function seedMessages(conversationId: string, senderId: string, count: number, start = Date.UTC(2026, 0, 1)) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = await prisma.message.create({
      data: { conversationId, senderId, content: `m${i}`, sentAt: new Date(start + i * 1000) },
    });
    ids.push(m.id);
  }
  return ids;
}

describe("POST /api/conversations", () => {
  it("creates the conversation once and then returns the existing one, from either side", async () => {
    const ana = await createUser({ firstName: "Ana" });
    const mihai = await createUser({ firstName: "Mihai" });

    const first = await request(app).post("/api/conversations").set(ana.authHeader).send({ userId: mihai.id });
    const again = await request(app).post("/api/conversations").set(ana.authHeader).send({ userId: mihai.id });
    const fromOtherSide = await request(app).post("/api/conversations").set(mihai.authHeader).send({ userId: ana.id });

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      otherParticipants: [{ id: mihai.id, firstName: "Mihai" }],
      lastMessage: null,
      unreadCount: 0,
    });
    expect(first.body.data.otherParticipants[0]).not.toHaveProperty("email");
    expect(again.status).toBe(200);
    expect(fromOtherSide.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(fromOtherSide.body.data.id).toBe(first.body.data.id);
  });

  it("never creates duplicates when requests arrive at the same time", async () => {
    const ana = await createUser();
    const mihai = await createUser();

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 === 0
          ? request(app).post("/api/conversations").set(ana.authHeader).send({ userId: mihai.id })
          : request(app).post("/api/conversations").set(mihai.authHeader).send({ userId: ana.id }),
      ),
    );

    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.conversation.count()).toBe(1);
  });

  it("rejects yourself, unknown users and blocked users", async () => {
    const me = await createUser();
    const other = await createUser();
    await prisma.block.create({ data: { blockerId: other.id, blockedId: me.id } });

    const self = await request(app).post("/api/conversations").set(me.authHeader).send({ userId: me.id });
    const unknown = await request(app)
      .post("/api/conversations")
      .set(me.authHeader)
      .send({ userId: "00000000-0000-4000-8000-000000000000" });
    const blocked = await request(app).post("/api/conversations").set(me.authHeader).send({ userId: other.id });

    expect(self.body.error.code).toBe("CANNOT_MESSAGE_SELF");
    expect(unknown.status).toBe(404);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("BLOCKED");
  });
});

describe("GET /api/conversations", () => {
  it("sorts by the latest message and counts unread messages per conversation", async () => {
    const me = await createUser();
    const a = await createUser();
    const b = await createUser();
    const convA = await startConversation(me, a);
    const convB = await startConversation(me, b);

    await send(a, convA, "salut de la A");
    await send(b, convB, "salut de la B 1");
    await send(b, convB, "salut de la B 2");

    const res = await request(app).get("/api/conversations").set(me.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([convB, convA]);
    expect(res.body.data[0]).toMatchObject({
      unreadCount: 2,
      lastMessage: { content: "salut de la B 2", senderId: b.id },
      otherParticipants: [{ id: b.id }],
    });
    expect(res.body.data[1].unreadCount).toBe(1);
  });

  it("hides conversations with a blocked user, in both directions", async () => {
    const me = await createUser();
    const a = await createUser();
    const b = await createUser();
    const convA = await startConversation(me, a);
    const convB = await startConversation(me, b);
    await send(a, convA, "1");
    await send(b, convB, "2");

    await prisma.block.create({ data: { blockerId: me.id, blockedId: a.id } });
    await prisma.block.create({ data: { blockerId: b.id, blockedId: me.id } });

    const res = await request(app).get("/api/conversations").set(me.authHeader);
    expect(res.body.data).toEqual([]);
    expect(await unreadCount(me)).toBe(0);
  });
});

describe("messages", () => {
  it("sends a message, marks it read for the sender and unread for the recipient", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);

    const res = await send(ana, conv, "  Ne vedem la 5?  ");

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ conversationId: conv, senderId: ana.id, content: "Ne vedem la 5?" });
    expect(await unreadCount(ana)).toBe(0);
    expect(await unreadCount(mihai)).toBe(1);
  });

  it("validates the content", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);

    expect((await send(ana, conv, "   ")).status).toBe(400);
    expect((await send(ana, conv, "x".repeat(2001))).status).toBe(400);
  });

  it("only lets participants read or write", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const outsider = await createUser();
    const conv = await startConversation(ana, mihai);

    expect((await send(outsider, conv, "intrus")).status).toBe(404);
    expect((await request(app).get(`/api/conversations/${conv}/messages`).set(outsider.authHeader)).status).toBe(404);
    expect((await request(app).get(`/api/conversations/${conv}`).set(outsider.authHeader)).status).toBe(404);
    expect((await request(app).post(`/api/conversations/${conv}/read`).set(outsider.authHeader)).status).toBe(404);
  });

  it("blocks reading and writing after a block", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    await prisma.block.create({ data: { blockerId: mihai.id, blockedId: ana.id } });

    const write = await send(ana, conv, "mai ești?");
    const read = await request(app).get(`/api/conversations/${conv}/messages`).set(ana.authHeader);

    expect(write.status).toBe(403);
    expect(read.status).toBe(403);
  });

  it("keeps the history when the other user deletes the account, but closes the conversation", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    await send(mihai, conv, "pa!");
    await prisma.user.delete({ where: { id: mihai.id } });

    const list = await request(app).get("/api/conversations").set(ana.authHeader);
    const messages = await request(app).get(`/api/conversations/${conv}/messages`).set(ana.authHeader);
    const write = await send(ana, conv, "alo?");

    expect(list.body.data[0]).toMatchObject({ id: conv, otherParticipants: [], unreadCount: 1 });
    expect(messages.body.data).toEqual([expect.objectContaining({ content: "pa!", senderId: null })]);
    expect(write.status).toBe(409);
    expect(write.body.error.code).toBe("CONVERSATION_CLOSED");
  });
});

describe("GET /api/conversations/:id/messages (cursor pagination)", () => {
  it("returns the latest messages in chronological order, then older pages with before", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    const ids = await seedMessages(conv, mihai.id, 5);

    const latest = await request(app).get(`/api/conversations/${conv}/messages?limit=2`).set(ana.authHeader);
    expect(latest.body.data.map((m: { id: string }) => m.id)).toEqual([ids[3], ids[4]]);
    expect(latest.body.meta).toEqual({ hasMore: true, limit: 2 });

    const older = await request(app)
      .get(`/api/conversations/${conv}/messages?limit=2&before=${ids[3]}`)
      .set(ana.authHeader);
    expect(older.body.data.map((m: { id: string }) => m.id)).toEqual([ids[1], ids[2]]);
    expect(older.body.meta.hasMore).toBe(true);

    const oldest = await request(app)
      .get(`/api/conversations/${conv}/messages?limit=2&before=${ids[1]}`)
      .set(ana.authHeader);
    expect(oldest.body.data.map((m: { id: string }) => m.id)).toEqual([ids[0]]);
    expect(oldest.body.meta.hasMore).toBe(false);
  });

  it("returns only newer messages with after (polling)", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    const ids = await seedMessages(conv, mihai.id, 4);

    const res = await request(app).get(`/api/conversations/${conv}/messages?after=${ids[1]}`).set(ana.authHeader);
    expect(res.body.data.map((m: { id: string }) => m.id)).toEqual([ids[2], ids[3]]);
    expect(res.body.meta.hasMore).toBe(false);

    const nothingNew = await request(app)
      .get(`/api/conversations/${conv}/messages?after=${ids[3]}`)
      .set(ana.authHeader);
    expect(nothingNew.body.data).toEqual([]);
  });

  it("handles messages sent in the same millisecond without losing any", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    const sentAt = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 4; i++) {
      await prisma.message.create({ data: { conversationId: conv, senderId: mihai.id, content: `m${i}`, sentAt } });
    }

    const seen: string[] = [];
    let before = "";
    for (let page = 0; page < 4; page++) {
      const res = await request(app)
        .get(`/api/conversations/${conv}/messages?limit=1${before ? `&before=${before}` : ""}`)
        .set(ana.authHeader);
      if (res.body.data.length === 0) break;
      seen.push(res.body.data[0].id);
      before = res.body.data[0].id;
    }
    expect(new Set(seen).size).toBe(4);
  });

  it("rejects a cursor from another conversation and both cursors together", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const elena = await createUser();
    const conv = await startConversation(ana, mihai);
    const otherConv = await startConversation(ana, elena);
    const [foreign] = await seedMessages(otherConv, elena.id, 1);

    const wrongCursor = await request(app)
      .get(`/api/conversations/${conv}/messages?before=${foreign}`)
      .set(ana.authHeader);
    const both = await request(app)
      .get(`/api/conversations/${conv}/messages?before=${foreign}&after=${foreign}`)
      .set(ana.authHeader);

    expect(wrongCursor.status).toBe(400);
    expect(both.status).toBe(400);
  });
});

describe("POST /api/conversations/:id/read and GET /api/messages/unread-count", () => {
  it("resets the unread count, and new messages count again", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const elena = await createUser();
    const withMihai = await startConversation(mihai, ana);
    const withElena = await startConversation(elena, ana);
    await send(mihai, withMihai, "1");
    await send(mihai, withMihai, "2");
    await send(elena, withElena, "3");

    expect(await unreadCount(ana)).toBe(3);

    await request(app).post(`/api/conversations/${withMihai}/read`).set(ana.authHeader).expect(204);
    expect(await unreadCount(ana)).toBe(1);

    await send(mihai, withMihai, "4");
    expect(await unreadCount(ana)).toBe(2);

    const summary = await request(app).get(`/api/conversations/${withMihai}`).set(ana.authHeader);
    expect(summary.body.data.unreadCount).toBe(1);
  });

  it("does not count my own messages", async () => {
    const ana = await createUser();
    const mihai = await createUser();
    const conv = await startConversation(ana, mihai);
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: conv, userId: ana.id } },
      data: { lastReadAt: null },
    });
    await seedMessages(conv, ana.id, 3);

    expect(await unreadCount(ana)).toBe(0);
  });
});

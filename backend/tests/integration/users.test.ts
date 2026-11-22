import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createDog, createEvent, createUser, TEST_PASSWORD } from "./helpers.js";

describe("GET /api/users/me", () => {
  it("returns the current user without the password hash", async () => {
    const me = await createUser({ email: "ana@test.local" });
    const res = await request(app).get("/api/users/me").set(me.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: me.id, email: "ana@test.local" });
    expect(res.body.data).not.toHaveProperty("passwordHash");
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/users/me")).status).toBe(401);
  });
});

describe("PATCH /api/users/me", () => {
  it("updates the profile and rounds the location", async () => {
    const me = await createUser();
    const res = await request(app)
      .patch("/api/users/me")
      .set(me.authHeader)
      .send({ firstName: " Elena ", bio: "Iubesc câinii", latitude: 46.754321, longitude: 23.556789 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: "Elena",
      bio: "Iubesc câinii",
      approxLatitude: 46.75,
      approxLongitude: 23.56,
    });
  });

  it("clears bio and avatar with null or empty string", async () => {
    const me = await createUser({ bio: "ceva" });
    const res = await request(app).patch("/api/users/me").set(me.authHeader).send({ bio: "", avatarUrl: null });
    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBeNull();
    expect(res.body.data.avatarUrl).toBeNull();
  });

  it("rejects unknown fields, an empty body and half a location", async () => {
    const me = await createUser();
    const unknown = await request(app).patch("/api/users/me").set(me.authHeader).send({ email: "x@y.z" });
    const empty = await request(app).patch("/api/users/me").set(me.authHeader).send({});
    const half = await request(app).patch("/api/users/me").set(me.authHeader).send({ latitude: 46.7 });
    const badUrl = await request(app)
      .patch("/api/users/me")
      .set(me.authHeader)
      .send({ avatarUrl: "javascript:alert(1)" });

    for (const res of [unknown, empty, half, badUrl]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("GET /api/users/:id", () => {
  it("returns the public profile with the user's dogs and no email", async () => {
    const me = await createUser();
    const other = await createUser({ firstName: "Mihai" });
    await createDog(other.id, { name: "Max" });

    const res = await request(app).get(`/api/users/${other.id}`).set(me.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: other.id, firstName: "Mihai" });
    expect(res.body.data).not.toHaveProperty("email");
    expect(res.body.data.dogs).toHaveLength(1);
    expect(res.body.data.dogs[0]).toMatchObject({ name: "Max", breed: { name: expect.any(String) } });
  });

  it("hides the profile when either user blocked the other", async () => {
    const me = await createUser();
    const blockedByMe = await createUser();
    const blockedMe = await createUser();
    await prisma.block.create({ data: { blockerId: me.id, blockedId: blockedByMe.id } });
    await prisma.block.create({ data: { blockerId: blockedMe.id, blockedId: me.id } });

    for (const target of [blockedByMe, blockedMe]) {
      const res = await request(app).get(`/api/users/${target.id}`).set(me.authHeader);
      expect(res.status).toBe(404);
    }
  });

  it("returns 404 for an unknown user and 400 for a malformed id", async () => {
    const me = await createUser();
    const unknown = await request(app)
      .get("/api/users/00000000-0000-4000-8000-000000000000")
      .set(me.authHeader);
    const malformed = await request(app).get("/api/users/abc").set(me.authHeader);
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});

describe("DELETE /api/users/me", () => {
  it("deletes the account and cancels its active events in the same transaction", async () => {
    const me = await createUser();
    const other = await createUser();
    const active = await createEvent(me.id);
    const othersEvent = await createEvent(other.id);

    const res = await request(app).delete("/api/users/me").set(me.authHeader).send({ password: TEST_PASSWORD });

    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: me.id } })).toBeNull();
    const event = await prisma.event.findUniqueOrThrow({ where: { id: active.id } });
    expect(event).toMatchObject({ status: "CANCELLED", organizerId: null });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: othersEvent.id } })).status).toBe("ACTIVE");

    // Token-ul vechi nu mai funcționează.
    expect((await request(app).get("/api/users/me").set(me.authHeader)).status).toBe(401);
  });

  it("keeps messages, with the sender set to null", async () => {
    const me = await createUser();
    const other = await createUser();
    const conversation = await prisma.conversation.create({
      data: { participants: { create: [{ userId: me.id }, { userId: other.id }] } },
    });
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: me.id, content: "Salut" },
    });

    await request(app).delete("/api/users/me").set(me.authHeader).send({ password: TEST_PASSWORD }).expect(204);

    expect((await prisma.message.findUniqueOrThrow({ where: { id: message.id } })).senderId).toBeNull();
  });

  it("requires the correct password", async () => {
    const me = await createUser();
    const wrong = await request(app).delete("/api/users/me").set(me.authHeader).send({ password: "gresit" });
    const missing = await request(app).delete("/api/users/me").set(me.authHeader);

    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe("INVALID_PASSWORD");
    expect(missing.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: me.id } })).not.toBeNull();
  });
});

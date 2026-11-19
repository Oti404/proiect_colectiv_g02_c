import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createUser } from "./helpers.js";

describe("POST /api/blocks/:userId", () => {
  it("blocks a user (201), and is idempotent (200)", async () => {
    const me = await createUser();
    const other = await createUser({ firstName: "Mihai" });

    const first = await request(app).post(`/api/blocks/${other.id}`).set(me.authHeader);
    const second = await request(app).post(`/api/blocks/${other.id}`).set(me.authHeader);

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ user: { id: other.id, firstName: "Mihai" }, createdAt: expect.any(String) });
    expect(first.body.data.user).not.toHaveProperty("email");
    expect(second.status).toBe(200);
    expect(second.body.data.createdAt).toBe(first.body.data.createdAt);
    expect(await prisma.block.count()).toBe(1);
  });

  it("cannot block yourself or an unknown user", async () => {
    const me = await createUser();
    const self = await request(app).post(`/api/blocks/${me.id}`).set(me.authHeader);
    const unknown = await request(app)
      .post("/api/blocks/00000000-0000-4000-8000-000000000000")
      .set(me.authHeader);

    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe("CANNOT_BLOCK_SELF");
    expect(unknown.status).toBe(404);
  });
});

describe("GET /api/blocks", () => {
  it("lists only the users I blocked, newest first", async () => {
    const me = await createUser();
    const a = await createUser();
    const b = await createUser();
    const blockedMe = await createUser();

    await request(app).post(`/api/blocks/${a.id}`).set(me.authHeader).expect(201);
    await request(app).post(`/api/blocks/${b.id}`).set(me.authHeader).expect(201);
    await request(app).post(`/api/blocks/${me.id}`).set(blockedMe.authHeader).expect(201);

    const res = await request(app).get("/api/blocks").set(me.authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.map((x: { user: { id: string } }) => x.user.id)).toEqual([b.id, a.id]);
  });
});

describe("DELETE /api/blocks/:userId", () => {
  it("unblocks, and does not fail when there is nothing to remove", async () => {
    const me = await createUser();
    const other = await createUser();
    await request(app).post(`/api/blocks/${other.id}`).set(me.authHeader).expect(201);

    await request(app).delete(`/api/blocks/${other.id}`).set(me.authHeader).expect(204);
    await request(app).delete(`/api/blocks/${other.id}`).set(me.authHeader).expect(204);

    expect(await prisma.block.count()).toBe(0);
    expect((await request(app).get(`/api/users/${other.id}`).set(me.authHeader)).status).toBe(200);
  });

  it("cannot remove a block made by the other user", async () => {
    const me = await createUser();
    const other = await createUser();
    await request(app).post(`/api/blocks/${me.id}`).set(other.authHeader).expect(201);

    await request(app).delete(`/api/blocks/${other.id}`).set(me.authHeader).expect(204);

    expect(await prisma.block.count()).toBe(1);
  });
});

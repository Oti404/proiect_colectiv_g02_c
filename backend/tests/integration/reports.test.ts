import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createPost, createUser } from "./helpers.js";

describe("POST /api/reports", () => {
  it("reports a user", async () => {
    const me = await createUser();
    const other = await createUser();

    const res = await request(app)
      .post("/api/reports")
      .set(me.authHeader)
      .send({ reportedUserId: other.id, reason: "  Mesaje jignitoare  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reportedUserId: other.id,
      postId: null,
      reason: "Mesaje jignitoare",
      status: "OPEN",
    });
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(stored.reporterId).toBe(me.id);
  });

  it("reports a post", async () => {
    const me = await createUser();
    const author = await createUser();
    const post = await createPost(author.id);

    const res = await request(app).post("/api/reports").set(me.authHeader).send({ postId: post.id, reason: "Spam" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ postId: post.id, reportedUserId: null });
  });

  it("needs exactly one target and a reason", async () => {
    const me = await createUser();
    const other = await createUser();
    const post = await createPost(other.id);

    const none = await request(app).post("/api/reports").set(me.authHeader).send({ reason: "Spam" });
    const both = await request(app)
      .post("/api/reports")
      .set(me.authHeader)
      .send({ reportedUserId: other.id, postId: post.id, reason: "Spam" });
    const noReason = await request(app).post("/api/reports").set(me.authHeader).send({ reportedUserId: other.id });

    for (const res of [none, both, noReason]) expect(res.status).toBe(400);
  });

  it("cannot report yourself or your own post", async () => {
    const me = await createUser();
    const myPost = await createPost(me.id);

    const self = await request(app).post("/api/reports").set(me.authHeader).send({ reportedUserId: me.id, reason: "Test" });
    const ownPost = await request(app).post("/api/reports").set(me.authHeader).send({ postId: myPost.id, reason: "Test" });

    expect(self.body.error.code).toBe("CANNOT_REPORT_SELF");
    expect(ownPost.body.error.code).toBe("CANNOT_REPORT_SELF");
  });

  it("returns 404 for a missing target", async () => {
    const me = await createUser();
    const res = await request(app)
      .post("/api/reports")
      .set(me.authHeader)
      .send({ postId: "00000000-0000-4000-8000-000000000000", reason: "Spam" });
    expect(res.status).toBe(404);
  });

  it("does not accept a second open report on the same target", async () => {
    const me = await createUser();
    const other = await createUser();
    const body = { reportedUserId: other.id, reason: "Spam" };

    await request(app).post("/api/reports").set(me.authHeader).send(body).expect(201);
    const again = await request(app).post("/api/reports").set(me.authHeader).send(body);

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_REPORTED");
  });
});

import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { block, createDog, createUser, type TestUser } from "./helpers.js";

// Un block ascunde ambele părți una de cealaltă, indiferent cine a blocat pe cine.
// Fiecare test rulează în ambele direcții: Ana îl blochează pe Mihai, apoi Mihai pe Ana.

const inDays = (days: number, hours = 0) => new Date(Date.now() + (days * 24 + hours) * 3_600_000).toISOString();

let ana: TestUser;
let mihai: TestUser;
let elena: TestUser;

beforeEach(async () => {
  ana = await createUser({ firstName: "Ana" });
  mihai = await createUser({ firstName: "Mihai" });
  elena = await createUser({ firstName: "Elena" });
});

const directions = [
  { name: "Ana blocks Mihai", apply: () => block(ana, mihai) },
  { name: "Mihai blocks Ana", apply: () => block(mihai, ana) },
];

async function searchDogIds(viewer: TestUser): Promise<string[]> {
  const res = await request(app).get("/api/search/dogs").set(viewer.authHeader);
  expect(res.status).toBe(200);
  return res.body.data.map((d: { id: string }) => d.id);
}

async function feedPostIds(viewer: TestUser): Promise<string[]> {
  const res = await request(app).get("/api/posts").set(viewer.authHeader);
  expect(res.status).toBe(200);
  return res.body.data.map((p: { id: string }) => p.id);
}

async function createPost(author: TestUser, content = "Salut!") {
  const res = await request(app).post("/api/posts").set(author.authHeader).send({ content });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

async function createPublicEvent(organizer: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/events")
    .set(organizer.authHeader)
    .send({
      title: "Plimbare",
      type: "GROUP_WALK",
      visibility: "PUBLIC",
      startsAt: inDays(2),
      endsAt: inDays(2, 2),
      locationText: "Parcul Central",
      ...overrides,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: string };
}

describe.each(directions)("Block ($name)", ({ apply }) => {
  describe("dogs", () => {
    it("hides the other user's dogs from search, in both directions", async () => {
      const rex = await createDog(ana, { name: "Rex" });
      const max = await createDog(mihai, { name: "Max" });
      const luna = await createDog(elena, { name: "Luna" });

      expect(await searchDogIds(ana)).toEqual(expect.arrayContaining([max.id, luna.id]));

      await apply();

      expect(await searchDogIds(ana)).toEqual([luna.id]);
      expect(await searchDogIds(mihai)).toEqual([luna.id]);
      expect((await searchDogIds(elena)).sort()).toEqual([rex.id, max.id].sort());
    });

    it("returns 404 for the other user's dog profile", async () => {
      const rex = await createDog(ana);
      const max = await createDog(mihai);
      await apply();

      await request(app).get(`/api/dogs/${max.id}`).set(ana.authHeader).expect(404);
      await request(app).get(`/api/dogs/${rex.id}`).set(mihai.authHeader).expect(404);
      await request(app).get(`/api/dogs/${max.id}`).set(elena.authHeader).expect(200);
    });
  });

  describe("feed", () => {
    it("hides the other user's posts from the feed", async () => {
      const anaPost = await createPost(ana);
      const mihaiPost = await createPost(mihai);
      await apply();

      expect(await feedPostIds(ana)).toEqual([anaPost.id]);
      expect(await feedPostIds(mihai)).toEqual([mihaiPost.id]);
      expect((await feedPostIds(elena)).sort()).toEqual([anaPost.id, mihaiPost.id].sort());
    });

    it("refuses likes and comments on the other user's posts", async () => {
      const post = await createPost(ana);
      await apply();

      await request(app).post(`/api/posts/${post.id}/like`).set(mihai.authHeader).expect(404);
      await request(app)
        .post(`/api/posts/${post.id}/comments`)
        .set(mihai.authHeader)
        .send({ content: "Hei" })
        .expect(404);
      await request(app).get(`/api/posts/${post.id}/comments`).set(mihai.authHeader).expect(404);
    });

    it("hides likes and comments left before the block", async () => {
      const post = await createPost(elena);
      await request(app).post(`/api/posts/${post.id}/like`).set(mihai.authHeader).expect(200);
      await request(app).post(`/api/posts/${post.id}/comments`).set(mihai.authHeader).send({ content: "Frumos!" }).expect(201);
      await apply();

      const feed = await request(app).get("/api/posts").set(ana.authHeader);
      const seenByAna = feed.body.data.find((p: { id: string }) => p.id === post.id);
      expect(seenByAna).toMatchObject({ likeCount: 0, likedByUserIds: [], comments: [] });

      const comments = await request(app).get(`/api/posts/${post.id}/comments`).set(ana.authHeader);
      expect(comments.body.data).toEqual([]);

      // Pentru un utilizator neimplicat, like-ul și comentariul rămân vizibile
      const forElena = await request(app).get(`/api/posts/${post.id}/comments`).set(elena.authHeader);
      expect(forElena.body.data).toHaveLength(1);
    });
  });

  describe("events", () => {
    it("hides the other user's public events from lists and details", async () => {
      const event = await createPublicEvent(mihai);
      await apply();

      const list = await request(app).get("/api/events?tab=ALL").set(ana.authHeader);
      expect(list.body.data).toEqual([]);
      await request(app).get(`/api/events/${event.id}`).set(ana.authHeader).expect(404);

      // Elena, care nu e implicată, îl vede în continuare
      await request(app).get(`/api/events/${event.id}`).set(elena.authHeader).expect(200);
    });

    it("refuses RSVP to the other user's event", async () => {
      const rex = await createDog(ana);
      const event = await createPublicEvent(mihai);
      await apply();

      const res = await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .set(ana.authHeader)
        .send({ dogId: rex.id, status: "GOING" });
      expect(res.status).toBe(404);
    });

    it("silently skips blocked users when inviting", async () => {
      await createDog(ana);
      await createDog(elena);
      await apply();

      const res = await request(app)
        .post("/api/events")
        .set(mihai.authHeader)
        .send({
          title: "Playdate",
          type: "PLAYDATE",
          visibility: "PRIVATE",
          startsAt: inDays(2),
          endsAt: inDays(2, 1),
          locationText: "Curtea blocului",
          invitedUserIds: [ana.id, elena.id],
        });
      expect(res.status).toBe(201);

      const invited = await prisma.eventParticipant.findMany({ where: { eventId: res.body.data.id } });
      expect(invited.map((row) => row.userId)).toEqual([elena.id]);

      // Nici invitația ulterioară nu trece
      await request(app)
        .post(`/api/events/${res.body.data.id}/invitations`)
        .set(mihai.authHeader)
        .send({ userIds: [ana.id] })
        .expect(200);
      expect(await prisma.eventParticipant.count({ where: { eventId: res.body.data.id, userId: ana.id } })).toBe(0);
    });

    it("hides the other user's dogs from an event's participants, but still counts them for capacity", async () => {
      const rex = await createDog(ana, { name: "Rex" });
      const luna = await createDog(elena, { name: "Luna" });
      const event = await createPublicEvent(elena, { maxParticipants: 2, organizerGoingDogIds: [luna.id] });
      await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .set(ana.authHeader)
        .send({ dogId: rex.id, status: "GOING" })
        .expect(200);
      await apply();

      const seenByMihai = await request(app).get(`/api/events/${event.id}`).set(mihai.authHeader);
      expect(seenByMihai.status).toBe(200);
      const dogIds = seenByMihai.body.data.participants.map((p: { rsvp: { dogId: string } }) => p.rsvp.dogId);
      expect(dogIds).toEqual([luna.id]);

      // Locul lui Rex e ocupat chiar dacă Mihai nu-l vede
      const max = await createDog(mihai, { name: "Max" });
      const res = await request(app)
        .post(`/api/events/${event.id}/rsvp`)
        .set(mihai.authHeader)
        .send({ dogId: max.id, status: "GOING" });
      expect(res.status).toBe(409);
    });
  });
});

describe("Without a block", () => {
  it("users see each other's dogs, posts and events normally", async () => {
    const max = await createDog(mihai);
    const post = await createPost(mihai);
    const event = await createPublicEvent(mihai);

    expect(await searchDogIds(ana)).toEqual([max.id]);
    expect(await feedPostIds(ana)).toEqual([post.id]);
    await request(app).get(`/api/events/${event.id}`).set(ana.authHeader).expect(200);
  });
});

import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createDog, createUser, type TestUser } from "./helpers.js";

const inDays = (days: number, hours = 0) => new Date(Date.now() + (days * 24 + hours) * 3_600_000).toISOString();

function publicEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: "Plimbare în Parcul Central",
    type: "GROUP_WALK",
    visibility: "PUBLIC",
    startsAt: inDays(2),
    endsAt: inDays(2, 2),
    locationText: "Parcul Central, intrarea dinspre lac",
    ...overrides,
  };
}

function privateEvent(invitedUserIds: string[], overrides: Record<string, unknown> = {}) {
  return publicEvent({
    title: "Playdate",
    type: "PLAYDATE",
    visibility: "PRIVATE",
    locationText: "Curtea blocului",
    invitedUserIds,
    ...overrides,
  });
}

async function createEvent(organizer: TestUser, body: Record<string, unknown>) {
  const res = await request(app).post("/api/events").set(organizer.authHeader).send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: string };
}

function rsvp(user: TestUser, eventId: string, dogId: string, status: string) {
  return request(app).post(`/api/events/${eventId}/rsvp`).set(user.authHeader).send({ dogId, status });
}

function getEvent(user: TestUser, eventId: string) {
  return request(app).get(`/api/events/${eventId}`).set(user.authHeader);
}

let ana: TestUser;
let mihai: TestUser;
let elena: TestUser;

beforeEach(async () => {
  ana = await createUser({ firstName: "Ana" });
  mihai = await createUser({ firstName: "Mihai" });
  elena = await createUser({ firstName: "Elena" });
});

describe("POST /api/events", () => {
  it("creates a public event with the organizer's dogs already GOING", async () => {
    const rex = await createDog(ana, { name: "Rex" });

    const res = await request(app)
      .post("/api/events")
      .set(ana.authHeader)
      .send(publicEvent({ organizerGoingDogIds: [rex.id], maxParticipants: 5 }));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      organizerId: ana.id,
      visibility: "PUBLIC",
      status: "ACTIVE",
      maxParticipants: 5,
      goingDogsCount: 1,
      isFull: false,
      isOrganizer: true,
    });
    expect(res.body.data.participants).toEqual([
      expect.objectContaining({ rsvp: expect.objectContaining({ dogId: rex.id, status: "GOING" }) }),
    ]);
  });

  it("invites every dog of the invited users to a private event", async () => {
    await createDog(mihai, { name: "Max" });
    await createDog(mihai, { name: "Luna" });

    const event = await createEvent(ana, privateEvent([mihai.id]));

    const rows = await prisma.eventParticipant.findMany({ where: { eventId: event.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.userId === mihai.id && row.status === "INVITED")).toBe(true);
  });

  it("refuses the organizer's GOING dogs if they belong to someone else", async () => {
    const max = await createDog(mihai);
    const res = await request(app)
      .post("/api/events")
      .set(ana.authHeader)
      .send(publicEvent({ organizerGoingDogIds: [max.id] }));

    expect(res.status).toBe(403);
    expect(await prisma.event.count()).toBe(0);
  });

  it("validates the time interval and the location rules", async () => {
    const endsBeforeStart = await request(app)
      .post("/api/events")
      .set(ana.authHeader)
      .send(publicEvent({ startsAt: inDays(2), endsAt: inDays(1) }));
    expect(endsBeforeStart.status).toBe(400);

    const privateWithoutLocation = await request(app)
      .post("/api/events")
      .set(ana.authHeader)
      .send(privateEvent([], { locationText: null }));
    expect(privateWithoutLocation.status).toBe(400);
  });

  it("requires a token", async () => {
    const res = await request(app).post("/api/events").send(publicEvent());
    expect(res.status).toBe(401);
  });
});

describe("Event visibility", () => {
  it("shows a private event only to the organizer and the invited users", async () => {
    await createDog(mihai);
    const event = await createEvent(ana, privateEvent([mihai.id]));

    expect((await getEvent(ana, event.id)).status).toBe(200);
    expect((await getEvent(mihai, event.id)).status).toBe(200);
    expect((await getEvent(elena, event.id)).status).toBe(404);
  });

  it("lists events per tab", async () => {
    await createDog(mihai);
    const walk = await createEvent(ana, publicEvent());
    const playdate = await createEvent(ana, privateEvent([mihai.id]));

    const tab = async (user: TestUser, name: string) => {
      const res = await request(app).get(`/api/events?tab=${name}`).set(user.authHeader);
      expect(res.status).toBe(200);
      return res.body.data.map((e: { id: string }) => e.id).sort();
    };

    expect(await tab(elena, "PUBLIC")).toEqual([walk.id]);
    expect(await tab(ana, "ORGANIZED")).toEqual([walk.id, playdate.id].sort());
    expect(await tab(mihai, "INVITATIONS")).toEqual([playdate.id]);
    expect(await tab(elena, "INVITATIONS")).toEqual([]);
    expect(await tab(mihai, "ALL")).toEqual([walk.id, playdate.id].sort());
    expect(await tab(elena, "ALL")).toEqual([walk.id]);
  });
});

describe("RSVP", () => {
  it("lets anyone RSVP to a public event and change the answer later", async () => {
    const max = await createDog(mihai);
    const event = await createEvent(ana, publicEvent());

    const going = await rsvp(mihai, event.id, max.id, "GOING");
    expect(going.status).toBe(200);
    expect(going.body.data.goingDogsCount).toBe(1);
    expect(going.body.data.currentUserDogRsvps).toEqual([expect.objectContaining({ dogId: max.id, status: "GOING" })]);

    const maybe = await request(app)
      .put(`/api/events/${event.id}/rsvp/${max.id}`)
      .set(mihai.authHeader)
      .send({ status: "MAYBE" });
    expect(maybe.status).toBe(200);
    expect(maybe.body.data.goingDogsCount).toBe(0);

    // Același câine are un singur rând, actualizat, nu două
    expect(await prisma.eventParticipant.count({ where: { eventId: event.id, dogId: max.id } })).toBe(1);
  });

  it("only allows RSVP with your own dogs", async () => {
    const rex = await createDog(ana);
    const event = await createEvent(ana, publicEvent());

    const res = await rsvp(mihai, event.id, rex.id, "GOING");
    expect(res.status).toBe(403);
  });

  it("refuses RSVP to a private event you were not invited to", async () => {
    const luna = await createDog(elena);
    const event = await createEvent(ana, privateEvent([mihai.id]));

    const res = await rsvp(elena, event.id, luna.id, "GOING");
    expect(res.status).toBe(403);
  });

  it("enforces maxParticipants (counted in dogs, not people)", async () => {
    const rex = await createDog(ana);
    const max = await createDog(mihai, { name: "Max" });
    const luna = await createDog(mihai, { name: "Luna" });
    const event = await createEvent(ana, publicEvent({ maxParticipants: 2, organizerGoingDogIds: [rex.id] }));

    const second = await rsvp(mihai, event.id, max.id, "GOING");
    expect(second.status).toBe(200);
    expect(second.body.data.isFull).toBe(true);

    const third = await rsvp(mihai, event.id, luna.id, "GOING");
    expect(third.status).toBe(409);

    // MAYBE nu ocupă loc, deci merge și când evenimentul e plin
    const maybe = await rsvp(mihai, event.id, luna.id, "MAYBE");
    expect(maybe.status).toBe(200);

    // Re-confirmarea unui câine deja GOING nu e respinsă ca depășire
    expect((await rsvp(mihai, event.id, max.id, "GOING")).status).toBe(200);
  });

  it("frees the spot when a GOING dog changes to NOT_GOING", async () => {
    const max = await createDog(mihai);
    const luna = await createDog(elena);
    const event = await createEvent(ana, publicEvent({ maxParticipants: 1 }));

    await rsvp(mihai, event.id, max.id, "GOING").expect(200);
    await rsvp(elena, event.id, luna.id, "GOING").expect(409);
    await rsvp(mihai, event.id, max.id, "NOT_GOING").expect(200);
    await rsvp(elena, event.id, luna.id, "GOING").expect(200);
  });

  it("refuses RSVP once the event is cancelled", async () => {
    const max = await createDog(mihai);
    const event = await createEvent(ana, publicEvent());

    await request(app).post(`/api/events/${event.id}/cancel`).set(ana.authHeader).expect(200);

    const res = await rsvp(mihai, event.id, max.id, "GOING");
    expect(res.status).toBe(409);
  });

  it("validates the RSVP status", async () => {
    const max = await createDog(mihai);
    const event = await createEvent(ana, publicEvent());

    // INVITED e doar o stare internă, nu se poate trimite ca RSVP
    const res = await rsvp(mihai, event.id, max.id, "INVITED");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Invitations", () => {
  it("accepting replaces the INVITED rows with the selected dogs as GOING", async () => {
    const max = await createDog(mihai, { name: "Max" });
    await createDog(mihai, { name: "Luna" });
    const event = await createEvent(ana, privateEvent([mihai.id]));

    const res = await request(app)
      .post(`/api/events/${event.id}/invitations/respond`)
      .set(mihai.authHeader)
      .send({ status: "ACCEPTED", goingDogIds: [max.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.currentUserInvitation).toMatchObject({ status: "ACCEPTED", dogIds: [max.id] });
    const rows = await prisma.eventParticipant.findMany({ where: { eventId: event.id, userId: mihai.id } });
    expect(rows).toEqual([expect.objectContaining({ dogId: max.id, status: "GOING" })]);
  });

  it("declining removes the invitation and hides the private event", async () => {
    await createDog(mihai);
    const event = await createEvent(ana, privateEvent([mihai.id]));

    const res = await request(app)
      .post(`/api/events/${event.id}/invitations/respond`)
      .set(mihai.authHeader)
      .send({ status: "DECLINED" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ eventId: event.id, status: "DECLINED" });
    expect((await getEvent(mihai, event.id)).status).toBe(404);
  });

  it("requires at least one dog to accept and respects capacity", async () => {
    const rex = await createDog(ana);
    const max = await createDog(mihai);
    const event = await createEvent(ana, privateEvent([mihai.id], { maxParticipants: 1, organizerGoingDogIds: [rex.id] }));

    const noDogs = await request(app)
      .post(`/api/events/${event.id}/invitations/respond`)
      .set(mihai.authHeader)
      .send({ status: "ACCEPTED", goingDogIds: [] });
    expect(noDogs.status).toBe(400);

    const full = await request(app)
      .post(`/api/events/${event.id}/invitations/respond`)
      .set(mihai.authHeader)
      .send({ status: "ACCEPTED", goingDogIds: [max.id] });
    expect(full.status).toBe(409);
  });

  it("returns 404 when responding without an invitation", async () => {
    const event = await createEvent(ana, publicEvent());
    const res = await request(app)
      .post(`/api/events/${event.id}/invitations/respond`)
      .set(elena.authHeader)
      .send({ status: "DECLINED" });
    expect(res.status).toBe(404);
  });

  it("only the organizer can invite, and re-inviting does not duplicate rows", async () => {
    await createDog(elena);
    const event = await createEvent(ana, privateEvent([]));

    await request(app)
      .post(`/api/events/${event.id}/invitations`)
      .set(mihai.authHeader)
      .send({ userIds: [elena.id] })
      .expect(403);

    for (let i = 0; i < 2; i++) {
      await request(app)
        .post(`/api/events/${event.id}/invitations`)
        .set(ana.authHeader)
        .send({ userIds: [elena.id] })
        .expect(200);
    }
    expect(await prisma.eventParticipant.count({ where: { eventId: event.id, userId: elena.id } })).toBe(1);
  });
});

describe("Organizer-only actions", () => {
  it("only the organizer can edit, cancel or delete", async () => {
    const event = await createEvent(ana, publicEvent());

    await request(app).patch(`/api/events/${event.id}`).set(mihai.authHeader).send({ title: "Altul" }).expect(403);
    await request(app).post(`/api/events/${event.id}/cancel`).set(mihai.authHeader).expect(403);
    await request(app).delete(`/api/events/${event.id}`).set(mihai.authHeader).expect(403);

    await request(app).patch(`/api/events/${event.id}`).set(ana.authHeader).send({ title: "Nou" }).expect(200);
    await request(app).delete(`/api/events/${event.id}`).set(ana.authHeader).expect(204);
    expect(await prisma.event.count()).toBe(0);
  });

  it("cannot lower maxParticipants below the dogs already GOING", async () => {
    const max = await createDog(mihai, { name: "Max" });
    const luna = await createDog(elena, { name: "Luna" });
    const event = await createEvent(ana, publicEvent({ maxParticipants: 5 }));
    await rsvp(mihai, event.id, max.id, "GOING").expect(200);
    await rsvp(elena, event.id, luna.id, "GOING").expect(200);

    const res = await request(app).patch(`/api/events/${event.id}`).set(ana.authHeader).send({ maxParticipants: 1 });
    expect(res.status).toBe(409);
  });

  it("a cancelled event leaves the PUBLIC tab and cannot be edited or cancelled again", async () => {
    const event = await createEvent(ana, publicEvent());
    const cancelled = await request(app).post(`/api/events/${event.id}/cancel`).set(ana.authHeader);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    const publicTab = await request(app).get("/api/events?tab=PUBLIC").set(mihai.authHeader);
    expect(publicTab.body.data).toEqual([]);

    await request(app).post(`/api/events/${event.id}/cancel`).set(ana.authHeader).expect(409);
    await request(app).patch(`/api/events/${event.id}`).set(ana.authHeader).send({ title: "X" }).expect(409);
  });
});

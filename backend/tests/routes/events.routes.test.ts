import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as eventsService from "../../src/services/events.service.js";
import { conflict, forbidden } from "../../src/utils/http-error.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/events.service.js", () => ({
  listEvents: vi.fn(),
  getEventById: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  cancelEvent: vi.fn(),
  deleteEvent: vi.fn(),
  inviteUsersToEvent: vi.fn(),
  respondToInvitation: vi.fn(),
  upsertDogRsvp: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PLACE_ID = "44444444-4444-4444-8444-444444444444";
const DOG_ID = "55555555-5555-4555-8555-555555555555";

const token = signAccessToken(USER_ID);

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const listEventsMock = vi.mocked(eventsService.listEvents);
const getEventByIdMock = vi.mocked(eventsService.getEventById);
const createEventMock = vi.mocked(eventsService.createEvent);
const updateEventMock = vi.mocked(eventsService.updateEvent);
const cancelEventMock = vi.mocked(eventsService.cancelEvent);
const deleteEventMock = vi.mocked(eventsService.deleteEvent);
const inviteUsersMock = vi.mocked(eventsService.inviteUsersToEvent);
const respondToInvitationMock = vi.mocked(eventsService.respondToInvitation);
const upsertDogRsvpMock = vi.mocked(eventsService.upsertDogRsvp);

const sampleEventView = {
  id: EVENT_ID,
  organizerId: USER_ID,
  placeId: PLACE_ID,
  locationText: null,
  title: "Morning Walk",
  description: "Parcul Central",
  type: "GROUP_WALK" as const,
  visibility: "PUBLIC" as const,
  status: "ACTIVE" as const,
  startsAt: new Date("2026-11-20T09:30:00.000Z"),
  endsAt: new Date("2026-11-20T11:00:00.000Z"),
  maxParticipants: 8,
  createdAt: new Date("2026-11-11T10:00:00.000Z"),
  updatedAt: new Date("2026-11-11T10:00:00.000Z"),
  organizer: {
    id: USER_ID,
    firstName: "Ana",
    lastName: "Pop",
    avatarUrl: null,
    bio: null,
    approxLatitude: 46.77,
    approxLongitude: 23.59,
  },
  place: null,
  invitations: [],
  participants: [],
  goingDogsCount: 1,
  isFull: false,
  isOrganizer: true,
  currentUserInvitation: null,
  currentUserDogRsvps: [],
};

describe("events routes", () => {
  beforeEach(() => {
    findAuthUserMock.mockResolvedValue({
      id: USER_ID,
      email: "ana@demo.local",
      firstName: "Ana",
      lastName: "Pop",
      avatarUrl: null,
      approxLatitude: 46.77,
      approxLongitude: 23.59,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/events", () => {
    it("lists events for the requested tab", async () => {
      listEventsMock.mockResolvedValue([sampleEventView]);

      const res = await request(app)
        .get("/api/events?tab=ORGANIZED")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(listEventsMock).toHaveBeenCalledWith(USER_ID, "ORGANIZED");
    });

    it("rejects invalid tab query", async () => {
      const res = await request(app)
        .get("/api/events?tab=UNKNOWN")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/events", () => {
    it("creates a public event and returns 201", async () => {
      createEventMock.mockResolvedValue(sampleEventView);

      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Morning Walk",
          description: "Parcul Central",
          type: "GROUP_WALK",
          visibility: "PUBLIC",
          startsAt: "2026-11-20T09:30:00.000Z",
          endsAt: "2026-11-20T11:00:00.000Z",
          maxParticipants: 8,
          placeId: PLACE_ID,
          organizerGoingDogIds: [DOG_ID],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(EVENT_ID);
      expect(createEventMock).toHaveBeenCalledTimes(1);
    });

    it("rejects event when endsAt <= startsAt or private event has placeId", async () => {
      const res = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Invalid Event",
          type: "PLAYDATE",
          visibility: "PRIVATE",
          startsAt: "2026-11-20T11:00:00.000Z",
          endsAt: "2026-11-20T09:30:00.000Z",
          placeId: PLACE_ID,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(createEventMock).not.toHaveBeenCalled();
    });
  });

  describe("GET, PATCH, POST /cancel & DELETE /api/events/:id", () => {
    it("gets event details", async () => {
      getEventByIdMock.mockResolvedValue(sampleEventView);

      const res = await request(app)
        .get(`/api/events/${EVENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(EVENT_ID);
    });

    it("updates an event", async () => {
      updateEventMock.mockResolvedValue({ ...sampleEventView, title: "Updated Walk" });

      const res = await request(app)
        .patch(`/api/events/${EVENT_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Walk" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Updated Walk");
    });

    it("cancels an event via POST /api/events/:id/cancel", async () => {
      cancelEventMock.mockResolvedValue({ ...sampleEventView, status: "CANCELLED" });

      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELLED");
      expect(cancelEventMock).toHaveBeenCalledWith(USER_ID, EVENT_ID);
    });

    it("deletes an event and returns 204", async () => {
      deleteEventMock.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/events/${EVENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(deleteEventMock).toHaveBeenCalledWith(USER_ID, EVENT_ID);
    });
  });

  describe("Invitations & RSVP endpoints", () => {
    it("invites users via POST /api/events/:id/invitations", async () => {
      inviteUsersMock.mockResolvedValue(sampleEventView);

      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/invitations`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userIds: [OTHER_USER_ID] });

      expect(res.status).toBe(200);
      expect(inviteUsersMock).toHaveBeenCalledWith(USER_ID, EVENT_ID, {
        userIds: [OTHER_USER_ID],
      });
    });

    it("validates that accepting an invitation requires at least one dog", async () => {
      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/invitations/respond`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "ACCEPTED", goingDogIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(respondToInvitationMock).not.toHaveBeenCalled();
    });

    it("accepts an invitation with selected dogs", async () => {
      respondToInvitationMock.mockResolvedValue(sampleEventView);

      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/invitations/respond`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "ACCEPTED", goingDogIds: [DOG_ID] });

      expect(res.status).toBe(200);
      expect(respondToInvitationMock).toHaveBeenCalledWith(USER_ID, EVENT_ID, {
        status: "ACCEPTED",
        goingDogIds: [DOG_ID],
      });
    });

    it("updates per-dog RSVP via POST /api/events/:id/rsvp and PUT /api/events/:id/rsvp/:dogId", async () => {
      upsertDogRsvpMock.mockResolvedValue(sampleEventView);

      const postRes = await request(app)
        .post(`/api/events/${EVENT_ID}/rsvp`)
        .set("Authorization", `Bearer ${token}`)
        .send({ dogId: DOG_ID, status: "GOING" });

      expect(postRes.status).toBe(200);
      expect(upsertDogRsvpMock).toHaveBeenCalledWith(USER_ID, EVENT_ID, {
        dogId: DOG_ID,
        status: "GOING",
      });

      const putRes = await request(app)
        .put(`/api/events/${EVENT_ID}/rsvp/${DOG_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "MAYBE" });

      expect(putRes.status).toBe(200);
      expect(upsertDogRsvpMock).toHaveBeenCalledWith(USER_ID, EVENT_ID, {
        dogId: DOG_ID,
        status: "MAYBE",
      });
    });

    it("returns 409 when event is CANCELLED or full", async () => {
      upsertDogRsvpMock.mockRejectedValue(conflict("Cannot RSVP to a cancelled event"));

      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/rsvp`)
        .set("Authorization", `Bearer ${token}`)
        .send({ dogId: DOG_ID, status: "GOING" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("returns 403 when non-organizer tries to cancel", async () => {
      cancelEventMock.mockRejectedValue(forbidden("Only the organizer can cancel this event"));

      const res = await request(app)
        .post(`/api/events/${EVENT_ID}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});

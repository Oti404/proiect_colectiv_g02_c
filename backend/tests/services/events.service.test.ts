import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  getEventById,
  inviteUsersToEvent,
  listEvents,
  respondToInvitation,
  updateEvent,
  upsertDogRsvp,
} from "../../src/services/events.service.js";

const ORGANIZER_ID = "11111111-1111-4111-8111-111111111111";
const INVITED_USER_ID = "22222222-2222-4222-8222-222222222222";
const BLOCKED_USER_ID = "33333333-3333-4333-8333-333333333333";
const PLACE_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";
const ORG_DOG_ID = "66666666-6666-4666-8666-666666666666";
const INV_DOG_ID = "77777777-7777-4777-8777-777777777777";
const BREED_ID = "88888888-8888-4888-8888-888888888888";

const organizerUser = {
  id: ORGANIZER_ID,
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  bio: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const invitedUser = {
  id: INVITED_USER_ID,
  firstName: "Elena",
  lastName: "Rusu",
  avatarUrl: null,
  bio: null,
  approxLatitude: 46.77,
  approxLongitude: 23.62,
};

const sampleBreed = {
  id: BREED_ID,
  name: "Labrador Retriever",
  size: "LARGE",
  careTips: "Walk daily",
  heatSensitive: false,
  breathingIssues: false,
  energyLevel: 4,
};

const sampleRawEvent = {
  id: EVENT_ID,
  organizerId: ORGANIZER_ID,
  placeId: null,
  locationText: "Courtyard Centru",
  title: "Afternoon Playdate",
  description: "Friendly dogs",
  type: "PLAYDATE" as const,
  visibility: "PRIVATE" as const,
  status: "ACTIVE" as const,
  startsAt: new Date("2026-11-20T15:00:00.000Z"),
  endsAt: new Date("2026-11-20T16:30:00.000Z"),
  maxParticipants: 2,
  createdAt: new Date("2026-11-11T10:00:00.000Z"),
  updatedAt: new Date("2026-11-11T10:00:00.000Z"),
  organizer: organizerUser,
  place: null,
  participants: [
    {
      id: "part-1",
      eventId: EVENT_ID,
      userId: ORGANIZER_ID,
      dogId: ORG_DOG_ID,
      status: "GOING" as const,
      createdAt: new Date("2026-11-11T10:00:00.000Z"),
      updatedAt: new Date("2026-11-11T10:00:00.000Z"),
      user: organizerUser,
      dog: {
        id: ORG_DOG_ID,
        ownerId: ORGANIZER_ID,
        breedId: BREED_ID,
        name: "Rex",
        birthDate: null,
        sex: "MALE",
        size: "LARGE",
        temperament: "FRIENDLY",
        neutered: true,
        photoUrl: null,
        breed: sampleBreed,
      },
    },
    {
      id: "part-2",
      eventId: EVENT_ID,
      userId: INVITED_USER_ID,
      dogId: INV_DOG_ID,
      status: "INVITED" as const,
      createdAt: new Date("2026-11-11T10:00:00.000Z"),
      updatedAt: new Date("2026-11-11T10:00:00.000Z"),
      user: invitedUser,
      dog: {
        id: INV_DOG_ID,
        ownerId: INVITED_USER_ID,
        breedId: BREED_ID,
        name: "Luna",
        birthDate: null,
        sex: "FEMALE",
        size: "LARGE",
        temperament: "FRIENDLY",
        neutered: true,
        photoUrl: null,
        breed: sampleBreed,
      },
    },
  ],
};

function fakeDb(mocks: {
  event?: Record<string, unknown>;
  eventParticipant?: Record<string, unknown>;
  dog?: Record<string, unknown>;
  place?: Record<string, unknown>;
  block?: Record<string, unknown>;
}): DbClient {
  return mocks as unknown as DbClient;
}

describe("events.service", () => {
  describe("listEvents & getEventById", () => {
    it("builds EventView with invitations, goingDogsCount, and currentUserInvitation", async () => {
      const findManyEvents = vi.fn().mockResolvedValue([sampleRawEvent]);
      const findManyBlocks = vi.fn().mockResolvedValue([]);

      const views = await listEvents(
        INVITED_USER_ID,
        "INVITATIONS",
        fakeDb({
          event: { findMany: findManyEvents },
          block: { findMany: findManyBlocks },
        }),
      );

      expect(views).toHaveLength(1);
      expect(views[0]?.goingDogsCount).toBe(1);
      expect(views[0]?.isFull).toBe(false);
      expect(views[0]?.currentUserInvitation?.status).toBe("PENDING");
      expect(views[0]?.invitations).toHaveLength(1);
      expect(views[0]?.participants).toHaveLength(1);
    });

    it("throws 404 when an uninvited user tries to view a private event", async () => {
      const findUnique = vi.fn().mockResolvedValue(sampleRawEvent);
      const findManyBlocks = vi.fn().mockResolvedValue([]);

      await expect(
        getEventById(
          BLOCKED_USER_ID,
          EVENT_ID,
          fakeDb({
            event: { findUnique },
            block: { findMany: findManyBlocks },
          }),
        ),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });
  });

  describe("createEvent", () => {
    it("creates a private playdate with organizer GOING dog and invited user dogs", async () => {
      const findManyDogs = vi
        .fn()
        .mockResolvedValueOnce([{ id: ORG_DOG_ID }])
        .mockResolvedValueOnce([{ id: INV_DOG_ID, ownerId: INVITED_USER_ID }]);
      const findManyBlocks = vi.fn().mockResolvedValue([]);
      const create = vi.fn().mockResolvedValue({ id: EVENT_ID });
      const createMany = vi.fn().mockResolvedValue({ count: 2 });
      const findUnique = vi.fn().mockResolvedValue(sampleRawEvent);

      const view = await createEvent(
        ORGANIZER_ID,
        {
          title: "Afternoon Playdate",
          description: "Friendly dogs",
          type: "PLAYDATE",
          visibility: "PRIVATE",
          startsAt: new Date("2026-11-20T15:00:00.000Z"),
          endsAt: new Date("2026-11-20T16:30:00.000Z"),
          maxParticipants: 2,
          locationText: "Courtyard Centru",
          organizerGoingDogIds: [ORG_DOG_ID],
          invitedUserIds: [INVITED_USER_ID],
        },
        fakeDb({
          dog: { findMany: findManyDogs },
          block: { findMany: findManyBlocks },
          event: { create, findUnique },
          eventParticipant: { createMany },
        }),
      );

      expect(view.id).toBe(EVENT_ID);
      expect(createMany).toHaveBeenCalledWith({
        data: [
          { eventId: EVENT_ID, userId: ORGANIZER_ID, dogId: ORG_DOG_ID, status: "GOING" },
          { eventId: EVENT_ID, userId: INVITED_USER_ID, dogId: INV_DOG_ID, status: "INVITED" },
        ],
        skipDuplicates: true,
      });
    });

    it("rejects when endsAt <= startsAt or maxParticipants < organizerGoingDogIds", async () => {
      await expect(
        createEvent(
          ORGANIZER_ID,
          {
            title: "Bad dates",
            type: "GROUP_WALK",
            visibility: "PUBLIC",
            startsAt: new Date("2026-11-20T16:00:00.000Z"),
            endsAt: new Date("2026-11-20T15:00:00.000Z"),
            placeId: PLACE_ID,
          },
          fakeDb({}),
        ),
      ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });

      await expect(
        createEvent(
          ORGANIZER_ID,
          {
            title: "Too many dogs",
            type: "GROUP_WALK",
            visibility: "PUBLIC",
            startsAt: new Date("2026-11-20T15:00:00.000Z"),
            endsAt: new Date("2026-11-20T16:00:00.000Z"),
            maxParticipants: 1,
            placeId: PLACE_ID,
            organizerGoingDogIds: [ORG_DOG_ID, INV_DOG_ID],
          },
          fakeDb({}),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });
  });

  describe("updateEvent & cancelEvent", () => {
    it("prevents setting maxParticipants lower than current GOING dogs", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        visibility: "PUBLIC",
        status: "ACTIVE",
        startsAt: new Date("2026-11-20T15:00:00.000Z"),
        endsAt: new Date("2026-11-20T16:30:00.000Z"),
        maxParticipants: 5,
      });
      const count = vi.fn().mockResolvedValue(3);

      await expect(
        updateEvent(
          ORGANIZER_ID,
          EVENT_ID,
          { maxParticipants: 2 },
          fakeDb({
            event: { findUnique },
            eventParticipant: { count },
          }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });

    it("prevents editing a CANCELLED event", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        visibility: "PUBLIC",
        status: "CANCELLED",
        startsAt: new Date("2026-11-20T15:00:00.000Z"),
        endsAt: new Date("2026-11-20T16:30:00.000Z"),
        maxParticipants: 5,
      });

      await expect(
        updateEvent(
          ORGANIZER_ID,
          EVENT_ID,
          { title: "Updated" },
          fakeDb({ event: { findUnique } }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });

    it("allows only the organizer to cancel an active event", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        status: "ACTIVE",
      });

      await expect(
        cancelEvent(INVITED_USER_ID, EVENT_ID, fakeDb({ event: { findUnique } })),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    });
  });

  describe("respondToInvitation", () => {
    it("accepts invitation when at least one dog is selected and capacity allows", async () => {
      const findEvent = vi
        .fn()
        .mockResolvedValueOnce({
          id: EVENT_ID,
          organizerId: ORGANIZER_ID,
          status: "ACTIVE",
          maxParticipants: 3,
        })
        .mockResolvedValueOnce({
          ...sampleRawEvent,
          participants: [
            sampleRawEvent.participants[0],
            {
              ...sampleRawEvent.participants[1],
              status: "GOING",
            },
          ],
        });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const findManyBlocks = vi.fn().mockResolvedValue([]);
      const findManyParticipants = vi
        .fn()
        .mockResolvedValue([{ id: "part-2", dogId: INV_DOG_ID, status: "INVITED" }]);
      const findManyDogs = vi.fn().mockResolvedValue([{ id: INV_DOG_ID }]);
      const countGoing = vi.fn().mockResolvedValue(1);
      const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
      const createMany = vi.fn().mockResolvedValue({ count: 1 });

      const result = await respondToInvitation(
        INVITED_USER_ID,
        EVENT_ID,
        { status: "ACCEPTED", goingDogIds: [INV_DOG_ID] },
        fakeDb({
          event: { findUnique: findEvent },
          block: { findFirst: findFirstBlock, findMany: findManyBlocks },
          eventParticipant: {
            findMany: findManyParticipants,
            count: countGoing,
            deleteMany,
            createMany,
          },
          dog: { findMany: findManyDogs },
        }),
      );

      expect("goingDogsCount" in result && result.goingDogsCount).toBe(2);
      expect(deleteMany).toHaveBeenCalledWith({
        where: { eventId: EVENT_ID, userId: INVITED_USER_ID },
      });
      expect(createMany).toHaveBeenCalledWith({
        data: [
          {
            eventId: EVENT_ID,
            userId: INVITED_USER_ID,
            dogId: INV_DOG_ID,
            status: "GOING",
          },
        ],
      });
    });

    it("deletes user RSVPs when invitation is DECLINED", async () => {
      const findEvent = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        status: "ACTIVE",
        maxParticipants: 3,
      });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const findManyParticipants = vi
        .fn()
        .mockResolvedValue([{ id: "part-2", dogId: INV_DOG_ID, status: "INVITED" }]);
      const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

      const res = await respondToInvitation(
        INVITED_USER_ID,
        EVENT_ID,
        { status: "DECLINED" },
        fakeDb({
          event: { findUnique: findEvent },
          block: { findFirst: findFirstBlock },
          eventParticipant: {
            findMany: findManyParticipants,
            deleteMany,
          },
        }),
      );

      expect(res).toEqual({ eventId: EVENT_ID, status: "DECLINED" });
      expect(deleteMany).toHaveBeenCalledWith({
        where: { eventId: EVENT_ID, userId: INVITED_USER_ID },
      });
    });
  });

  describe("upsertDogRsvp", () => {
    it("blocks RSVP on CANCELLED events or when capacity is full", async () => {
      const findCancelled = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        visibility: "PUBLIC",
        status: "CANCELLED",
        maxParticipants: 2,
      });
      const findFirstBlock = vi.fn().mockResolvedValue(null);

      await expect(
        upsertDogRsvp(
          INVITED_USER_ID,
          EVENT_ID,
          { dogId: INV_DOG_ID, status: "GOING" },
          fakeDb({
            event: { findUnique: findCancelled },
            block: { findFirst: findFirstBlock },
          }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

      const findActiveFull = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        visibility: "PUBLIC",
        status: "ACTIVE",
        maxParticipants: 1,
      });
      const findDog = vi.fn().mockResolvedValue({ id: INV_DOG_ID, ownerId: INVITED_USER_ID });
      const countGoing = vi.fn().mockResolvedValue(1);

      await expect(
        upsertDogRsvp(
          INVITED_USER_ID,
          EVENT_ID,
          { dogId: INV_DOG_ID, status: "GOING" },
          fakeDb({
            event: { findUnique: findActiveFull },
            block: { findFirst: findFirstBlock },
            dog: { findUnique: findDog },
            eventParticipant: { count: countGoing },
          }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });

    it("deletes event only when requested by organizer", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: EVENT_ID, organizerId: ORGANIZER_ID });
      const del = vi.fn().mockResolvedValue({});

      await deleteEvent(ORGANIZER_ID, EVENT_ID, fakeDb({ event: { findUnique, delete: del } }));
      expect(del).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
    });

    it("rejects inviteUsersToEvent on cancelled event", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        organizerId: ORGANIZER_ID,
        status: "CANCELLED",
      });

      await expect(
        inviteUsersToEvent(
          ORGANIZER_ID,
          EVENT_ID,
          { userIds: [INVITED_USER_ID] },
          fakeDb({ event: { findUnique } }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });
  });
});

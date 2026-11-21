import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import {
  createPlaceReview,
  getPlaceById,
  importOsmElements,
  listPlaces,
  parseOsmElement,
} from "../../src/services/places.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const REVIEW_ID = "55555555-5555-4555-8555-555555555555";

const samplePlace = {
  id: PLACE_ID,
  name: "Parcul Central Simion Bărnuțiu",
  latitude: 46.7689,
  longitude: 23.5784,
  address: "Aleea Stadionului, Cluj-Napoca",
  phone: null,
  website: null,
  openingHours: "00:00-24:00",
  type: "PARK" as const,
  source: "OSM" as const,
  osmId: "way/24100101",
  createdAt: new Date("2026-11-10T10:00:00.000Z"),
  updatedAt: new Date("2026-11-10T10:00:00.000Z"),
};

function fakeDb(mocks: {
  place?: Record<string, unknown>;
  event?: Record<string, unknown>;
  eventParticipant?: Record<string, unknown>;
  placeReview?: Record<string, unknown>;
}): DbClient {
  return mocks as unknown as DbClient;
}

describe("places.service", () => {
  describe("listPlaces", () => {
    it("filters by type and text query and computes average rating", async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          ...samplePlace,
          reviews: [{ rating: 5 }, { rating: 4 }],
        },
      ]);

      const result = await listPlaces(
        { type: "PARK", q: "Central" },
        fakeDb({ place: { findMany } }),
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: "PARK",
            OR: [
              { name: { contains: "Central", mode: "insensitive" } },
              { address: { contains: "Central", mode: "insensitive" } },
            ],
          },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.reviewCount).toBe(2);
      expect(result[0]?.averageRating).toBe(4.5);
    });
  });

  describe("getPlaceById", () => {
    it("returns the place with reviews and rating stats", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        ...samplePlace,
        reviews: [
          {
            id: REVIEW_ID,
            userId: USER_ID,
            placeId: PLACE_ID,
            eventId: EVENT_ID,
            rating: 5,
            tags: ["clean", "fenced"],
            createdAt: new Date("2026-11-11T10:00:00.000Z"),
            user: {
              id: USER_ID,
              firstName: "Ana",
              lastName: "Pop",
              avatarUrl: null,
            },
          },
        ],
      });

      const result = await getPlaceById(PLACE_ID, fakeDb({ place: { findUnique } }));

      expect(result.id).toBe(PLACE_ID);
      expect(result.reviewCount).toBe(1);
      expect(result.averageRating).toBe(5);
      expect(result.reviews).toHaveLength(1);
    });

    it("throws 404 when the place does not exist", async () => {
      const findUnique = vi.fn().mockResolvedValue(null);

      await expect(getPlaceById(PLACE_ID, fakeDb({ place: { findUnique } }))).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
      });
    });
  });

  describe("createPlaceReview", () => {
    it("creates a review when the user participated with a GOING dog at that event", async () => {
      const findPlace = vi.fn().mockResolvedValue({ id: PLACE_ID });
      const findEvent = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        placeId: PLACE_ID,
        organizerId: OTHER_USER_ID,
        status: "ACTIVE",
      });
      const findParticipation = vi.fn().mockResolvedValue({ id: "part-1" });
      const findExistingReview = vi.fn().mockResolvedValue(null);
      const create = vi.fn().mockResolvedValue({
        id: REVIEW_ID,
        userId: USER_ID,
        placeId: PLACE_ID,
        eventId: EVENT_ID,
        rating: 5,
        tags: ["shaded", "water"],
        createdAt: new Date("2026-11-11T12:00:00.000Z"),
        user: {
          id: USER_ID,
          firstName: "Ana",
          lastName: "Pop",
          avatarUrl: null,
        },
      });

      const review = await createPlaceReview(
        USER_ID,
        PLACE_ID,
        { eventId: EVENT_ID, rating: 5, tags: [" shaded ", "water", "shaded"] },
        fakeDb({
          place: { findUnique: findPlace },
          event: { findUnique: findEvent },
          eventParticipant: { findFirst: findParticipation },
          placeReview: { findUnique: findExistingReview, create },
        }),
      );

      expect(review.id).toBe(REVIEW_ID);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: USER_ID,
            placeId: PLACE_ID,
            eventId: EVENT_ID,
            rating: 5,
            tags: ["shaded", "water"],
          },
        }),
      );
    });

    it("throws 403 when user did not attend the event", async () => {
      const findPlace = vi.fn().mockResolvedValue({ id: PLACE_ID });
      const findEvent = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        placeId: PLACE_ID,
        organizerId: OTHER_USER_ID,
        status: "ACTIVE",
      });
      const findParticipation = vi.fn().mockResolvedValue(null);

      await expect(
        createPlaceReview(
          USER_ID,
          PLACE_ID,
          { eventId: EVENT_ID, rating: 4, tags: [] },
          fakeDb({
            place: { findUnique: findPlace },
            event: { findUnique: findEvent },
            eventParticipant: { findFirst: findParticipation },
          }),
        ),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    });

    it("throws 400 when event did not happen at this place", async () => {
      const findPlace = vi.fn().mockResolvedValue({ id: PLACE_ID });
      const findEvent = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        placeId: "99999999-9999-4999-8999-999999999999",
        organizerId: USER_ID,
        status: "ACTIVE",
      });

      await expect(
        createPlaceReview(
          USER_ID,
          PLACE_ID,
          { eventId: EVENT_ID, rating: 4, tags: [] },
          fakeDb({
            place: { findUnique: findPlace },
            event: { findUnique: findEvent },
          }),
        ),
      ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
    });

    it("throws 409 when user already reviewed the place for the same event", async () => {
      const findPlace = vi.fn().mockResolvedValue({ id: PLACE_ID });
      const findEvent = vi.fn().mockResolvedValue({
        id: EVENT_ID,
        placeId: PLACE_ID,
        organizerId: USER_ID,
        status: "ACTIVE",
      });
      const findExistingReview = vi.fn().mockResolvedValue({ id: REVIEW_ID });

      await expect(
        createPlaceReview(
          USER_ID,
          PLACE_ID,
          { eventId: EVENT_ID, rating: 5, tags: [] },
          fakeDb({
            place: { findUnique: findPlace },
            event: { findUnique: findEvent },
            placeReview: { findUnique: findExistingReview },
          }),
        ),
      ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    });
  });

  describe("parseOsmElement & importOsmElements", () => {
    it("maps OSM tags and deduplicates by osmId on import", async () => {
      const parsed = parseOsmElement({
        type: "way",
        id: 100,
        center: { lat: 46.7662, lon: 23.6275 },
        tags: {
          name: "Dog Park Gheorgheni",
          leisure: "dog_park",
          "addr:street": "Str. Vaida Voevod",
          "addr:housenumber": "2",
          "addr:city": "Cluj-Napoca",
        },
      });

      expect(parsed).toEqual({
        osmId: "way/100",
        name: "Dog Park Gheorgheni",
        latitude: 46.7662,
        longitude: 23.6275,
        address: "Str. Vaida Voevod nr. 2, Cluj-Napoca",
        phone: null,
        website: null,
        openingHours: null,
        type: "DOG_PARK",
        source: "OSM",
      });

      const upsert = vi.fn().mockResolvedValue({});
      const summary = await importOsmElements(
        [
          {
            type: "way",
            id: 100,
            center: { lat: 46.7662, lon: 23.6275 },
            tags: { name: "Dog Park Gheorgheni", leisure: "dog_park" },
          },
          // Duplicate osmId in the same batch
          {
            type: "way",
            id: 100,
            center: { lat: 46.7662, lon: 23.6275 },
            tags: { name: "Dog Park Gheorgheni", leisure: "dog_park" },
          },
          // Element without name (should be skipped)
          {
            type: "node",
            id: 101,
            lat: 46.77,
            lon: 23.59,
            tags: { leisure: "park" },
          },
        ],
        fakeDb({ place: { upsert } }),
      );

      expect(summary).toEqual({ imported: 1, skipped: 2 });
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { osmId: "way/100" },
        }),
      );
    });
  });
});

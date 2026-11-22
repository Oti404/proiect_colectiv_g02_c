import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as placesService from "../../src/services/places.service.js";
import { forbidden, notFound } from "../../src/utils/http-error.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/places.service.js", () => ({
  listPlaces: vi.fn(),
  getPlaceById: vi.fn(),
  createPlaceReview: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLACE_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const REVIEW_ID = "44444444-4444-4444-8444-444444444444";

const token = signAccessToken(USER_ID);

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const listPlacesMock = vi.mocked(placesService.listPlaces);
const getPlaceByIdMock = vi.mocked(placesService.getPlaceById);
const createPlaceReviewMock = vi.mocked(placesService.createPlaceReview);

const samplePlaceSummary = {
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
  reviewCount: 1,
  averageRating: 5,
};

describe("places routes", () => {
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

  describe("GET /api/places", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/places");
      expect(res.status).toBe(401);
    });

    it("returns filtered places", async () => {
      listPlacesMock.mockResolvedValue([samplePlaceSummary]);

      const res = await request(app)
        .get("/api/places?type=PARK&q=Central")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(listPlacesMock).toHaveBeenCalledWith({ type: "PARK", q: "Central" });
    });

    it("rejects invalid place type filter", async () => {
      const res = await request(app)
        .get("/api/places?type=INVALID")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/places/:id", () => {
    it("returns place details with reviews", async () => {
      getPlaceByIdMock.mockResolvedValue({
        ...samplePlaceSummary,
        reviews: [],
      });

      const res = await request(app)
        .get(`/api/places/${PLACE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(PLACE_ID);
      expect(getPlaceByIdMock).toHaveBeenCalledWith(PLACE_ID);
    });

    it("returns 404 when place is not found", async () => {
      getPlaceByIdMock.mockRejectedValue(notFound("Place not found"));

      const res = await request(app)
        .get(`/api/places/${PLACE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/places/:id/reviews", () => {
    it("creates a review and returns 201", async () => {
      createPlaceReviewMock.mockResolvedValue({
        id: REVIEW_ID,
        userId: USER_ID,
        placeId: PLACE_ID,
        eventId: EVENT_ID,
        rating: 5,
        tags: ["clean", "fenced"],
        createdAt: new Date("2026-11-11T12:00:00.000Z"),
        user: {
          id: USER_ID,
          firstName: "Ana",
          lastName: "Pop",
          avatarUrl: null,
        },
      });

      const res = await request(app)
        .post(`/api/places/${PLACE_ID}/reviews`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventId: EVENT_ID,
          rating: 5,
          tags: ["clean", "fenced"],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(REVIEW_ID);
      expect(createPlaceReviewMock).toHaveBeenCalledWith(USER_ID, PLACE_ID, {
        eventId: EVENT_ID,
        rating: 5,
        tags: ["clean", "fenced"],
      });
    });

    it("rejects out-of-range rating", async () => {
      const res = await request(app)
        .post(`/api/places/${PLACE_ID}/reviews`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventId: EVENT_ID,
          rating: 6,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(createPlaceReviewMock).not.toHaveBeenCalled();
    });

    it("returns 403 when user has not attended the event", async () => {
      createPlaceReviewMock.mockRejectedValue(
        forbidden("You can only review a place after participating in an event there"),
      );

      const res = await request(app)
        .post(`/api/places/${PLACE_ID}/reviews`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          eventId: EVENT_ID,
          rating: 4,
          tags: [],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as dogsService from "../../src/services/dogs.service.js";
import { forbidden, notFound } from "../../src/utils/http-error.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/dogs.service.js", () => ({
  getDog: vi.fn(),
  createDog: vi.fn(),
  updateDog: vi.fn(),
  deleteDog: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BREED_ID = "22222222-2222-4222-8222-222222222222";
const DOG_ID = "33333333-3333-4333-8333-333333333333";

const authUser = {
  id: USER_ID,
  email: "ana@demo.local",
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const sampleDogResponse = {
  id: DOG_ID,
  ownerId: USER_ID,
  breedId: BREED_ID,
  name: "Rex",
  birthDate: new Date("2023-05-01T00:00:00.000Z"),
  sex: "MALE" as const,
  size: "LARGE" as const,
  temperament: "FRIENDLY" as const,
  neutered: true,
  photoUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  breed: {
    id: BREED_ID,
    name: "Golden Retriever",
    size: "LARGE" as const,
    careTips: "Brush weekly",
    heatSensitive: false,
    breathingIssues: false,
    energyLevel: 4,
  },
};

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const getDogMock = vi.mocked(dogsService.getDog);
const createDogMock = vi.mocked(dogsService.createDog);
const updateDogMock = vi.mocked(dogsService.updateDog);
const deleteDogMock = vi.mocked(dogsService.deleteDog);

describe("/api/dogs routes", () => {
  let token: string;

  beforeEach(() => {
    token = signAccessToken(USER_ID);
    findAuthUserMock.mockResolvedValue(authUser);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/dogs/:id", () => {
    it("requires authentication", async () => {
      const res = await request(app).get(`/api/dogs/${DOG_ID}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects non-uuid id param", async () => {
      const res = await request(app).get("/api/dogs/not-a-uuid").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns the dog for an authenticated user", async () => {
      getDogMock.mockResolvedValue({
        ...sampleDogResponse,
        owner: {
          id: USER_ID,
          firstName: "Ana",
          lastName: "Pop",
          avatarUrl: null,
          bio: null,
          approxLatitude: 46.77,
          approxLongitude: 23.59,
        },
      });

      const res = await request(app).get(`/api/dogs/${DOG_ID}`).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(DOG_ID);
      expect(getDogMock).toHaveBeenCalledWith(USER_ID, DOG_ID);
    });

    it("returns 404 when the service throws notFound", async () => {
      getDogMock.mockRejectedValue(notFound("Dog not found"));

      const res = await request(app).get(`/api/dogs/${DOG_ID}`).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/dogs", () => {
    it("creates a dog and returns 201", async () => {
      createDogMock.mockResolvedValue(sampleDogResponse);

      const res = await request(app)
        .post("/api/dogs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          breedId: BREED_ID,
          name: "  Rex  ",
          birthDate: "2023-05-01",
          sex: "MALE",
          size: "LARGE",
          temperament: "FRIENDLY",
          neutered: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Rex");
      expect(createDogMock).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          breedId: BREED_ID,
          name: "Rex",
          sex: "MALE",
          size: "LARGE",
          temperament: "FRIENDLY",
          neutered: true,
        }),
      );
    });

    it("rejects invalid payload (missing required fields or future birthDate)", async () => {
      const res = await request(app)
        .post("/api/dogs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          breedId: "bad-id",
          name: "   ",
          birthDate: "2099-01-01",
          sex: "UNKNOWN",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(createDogMock).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/dogs/:id", () => {
    it("updates a dog and returns 200", async () => {
      updateDogMock.mockResolvedValue({ ...sampleDogResponse, name: "Rexy" });

      const res = await request(app)
        .patch(`/api/dogs/${DOG_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Rexy" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Rexy");
      expect(updateDogMock).toHaveBeenCalledWith(USER_ID, DOG_ID, { name: "Rexy" });
    });

    it("rejects an empty patch body", async () => {
      const res = await request(app)
        .patch(`/api/dogs/${DOG_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(updateDogMock).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not the owner", async () => {
      updateDogMock.mockRejectedValue(forbidden("You can only edit your own dogs"));

      const res = await request(app)
        .patch(`/api/dogs/${DOG_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Rexy" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("DELETE /api/dogs/:id", () => {
    it("deletes a dog and returns 204", async () => {
      deleteDogMock.mockResolvedValue(undefined);

      const res = await request(app).delete(`/api/dogs/${DOG_ID}`).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(res.text).toBe("");
      expect(deleteDogMock).toHaveBeenCalledWith(USER_ID, DOG_ID);
    });

    it("returns 403 when user is not the owner", async () => {
      deleteDogMock.mockRejectedValue(forbidden("You can only delete your own dogs"));

      const res = await request(app).delete(`/api/dogs/${DOG_ID}`).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});

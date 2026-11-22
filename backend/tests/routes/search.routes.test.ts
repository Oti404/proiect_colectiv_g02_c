import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as searchService from "../../src/services/search.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/search.service.js", () => ({
  searchDogs: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BREED_ID = "22222222-2222-4222-8222-222222222222";

const authUser = {
  id: USER_ID,
  email: "ana@demo.local",
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const searchDogsMock = vi.mocked(searchService.searchDogs);

describe("GET /api/search/dogs", () => {
  let token: string;

  beforeEach(() => {
    token = signAccessToken(USER_ID);
    findAuthUserMock.mockResolvedValue(authUser);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/search/dogs");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("parses filters and returns a paginated response", async () => {
    searchDogsMock.mockResolvedValue({
      items: [{ id: "dog-1", name: "Luna", distanceKm: 1.5 }],
      meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
    });

    const res = await request(app)
      .get("/api/search/dogs")
      .query({
        q: "Luna",
        breedId: BREED_ID,
        size: "MEDIUM",
        temperament: "FRIENDLY",
        ageGroup: "ADULT",
        neuteredOnly: "false",
        maxDistanceKm: "15",
        page: "2",
        pageSize: "5",
      })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: "dog-1", name: "Luna", distanceKm: 1.5 }],
      meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
    });
    expect(searchDogsMock).toHaveBeenCalledWith(authUser, {
      q: "Luna",
      breedId: BREED_ID,
      size: "MEDIUM",
      temperament: "FRIENDLY",
      ageGroup: "ADULT",
      neuteredOnly: false,
      maxDistanceKm: 15,
      page: 2,
      pageSize: 5,
    });
  });

  it("rejects invalid query parameters", async () => {
    const res = await request(app)
      .get("/api/search/dogs")
      .query({ breedId: "not-a-uuid", ageGroup: "OLD", maxDistanceKm: "-5", neuteredOnly: "invalid" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(searchDogsMock).not.toHaveBeenCalled();
  });
});

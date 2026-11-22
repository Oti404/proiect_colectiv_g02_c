import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as breedsService from "../../src/services/breeds.service.js";

vi.mock("../../src/services/breeds.service.js", () => ({
  listBreeds: vi.fn(),
}));

const listBreedsMock = vi.mocked(breedsService.listBreeds);

describe("GET /api/breeds", () => {
  afterEach(() => {
    listBreedsMock.mockReset();
  });

  it("returns the list of breeds in standard format", async () => {
    const breeds = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Beagle",
        size: "MEDIUM" as const,
        careTips: "Keep active",
        heatSensitive: false,
        breathingIssues: false,
        energyLevel: 4,
      },
    ];
    listBreedsMock.mockResolvedValue(breeds);

    const res = await request(app).get("/api/breeds");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: breeds });
  });
});

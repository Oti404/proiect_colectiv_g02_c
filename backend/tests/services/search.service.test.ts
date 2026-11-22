import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import { getDogAgeGroup, searchDogs } from "../../src/services/search.service.js";

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const BLOCKED_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_NEAR_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_FAR_ID = "44444444-4444-4444-8444-444444444444";
const BREED_ID = "55555555-5555-4555-8555-555555555555";

const NOW = new Date("2026-11-19T12:00:00.000Z");

const viewer = {
  id: VIEWER_ID,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

function makeDog(overrides: {
  id: string;
  name: string;
  ownerId: string;
  birthDate: Date | null;
  approxLatitude: number;
  approxLongitude: number;
}) {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId,
    breedId: BREED_ID,
    name: overrides.name,
    birthDate: overrides.birthDate,
    sex: "FEMALE" as const,
    size: "MEDIUM" as const,
    temperament: "FRIENDLY" as const,
    neutered: true,
    photoUrl: null,
    breed: {
      id: BREED_ID,
      name: "Beagle",
      size: "MEDIUM" as const,
      careTips: "Daily walks",
      heatSensitive: false,
      breathingIssues: false,
      energyLevel: 4,
    },
    owner: {
      id: overrides.ownerId,
      firstName: "Elena",
      lastName: "Rusu",
      avatarUrl: null,
      bio: null,
      approxLatitude: overrides.approxLatitude,
      approxLongitude: overrides.approxLongitude,
    },
  };
}

function fakeDb(dogFindMany: unknown, blockFindMany: unknown): DbClient {
  return {
    dog: { findMany: dogFindMany },
    block: { findMany: blockFindMany },
  } as unknown as DbClient;
}

describe("getDogAgeGroup", () => {
  it("returns null when birthDate is missing", () => {
    expect(getDogAgeGroup(null, NOW)).toBeNull();
  });

  it("classifies PUPPY (< 1.5y), ADULT (1.5y..7y), and SENIOR (>= 7y)", () => {
    expect(getDogAgeGroup(new Date("2026-01-01T00:00:00.000Z"), NOW)).toBe("PUPPY");
    expect(getDogAgeGroup(new Date("2023-01-01T00:00:00.000Z"), NOW)).toBe("ADULT");
    expect(getDogAgeGroup(new Date("2018-01-01T00:00:00.000Z"), NOW)).toBe("SENIOR");
  });
});

describe("searchDogs", () => {
  it("excludes viewer's own dogs and blocked users, and passes DB filters to Prisma", async () => {
    const blockFindMany = vi.fn().mockResolvedValue([{ blockerId: VIEWER_ID, blockedId: BLOCKED_ID }]);
    const dogFindMany = vi.fn().mockResolvedValue([]);

    await searchDogs(
      viewer,
      {
        q: "Luna",
        breedId: BREED_ID,
        size: "MEDIUM",
        temperament: "FRIENDLY",
        neuteredOnly: true,
        page: 1,
        pageSize: 20,
      },
      fakeDb(dogFindMany, blockFindMany),
      NOW,
    );

    expect(dogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: { notIn: [VIEWER_ID, BLOCKED_ID] },
          breedId: BREED_ID,
          size: "MEDIUM",
          temperament: "FRIENDLY",
          neutered: true,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("filters by ageGroup and maxDistanceKm, sorts by distance, and paginates", async () => {
    const nearPuppy = makeDog({
      id: "aaaa1111-1111-4111-8111-111111111111",
      name: "Milo",
      ownerId: OWNER_NEAR_ID,
      birthDate: new Date("2026-03-01T00:00:00.000Z"),
      approxLatitude: 46.78, // ~1.1 km
      approxLongitude: 23.59,
    });
    const farAdult = makeDog({
      id: "bbbb2222-2222-4222-8222-222222222222",
      name: "Rocky",
      ownerId: OWNER_FAR_ID,
      birthDate: new Date("2022-01-01T00:00:00.000Z"),
      approxLatitude: 46.95, // ~20 km
      approxLongitude: 23.59,
    });
    const nearAdult = makeDog({
      id: "cccc3333-3333-4333-8333-333333333333",
      name: "Luna",
      ownerId: OWNER_NEAR_ID,
      birthDate: new Date("2023-01-01T00:00:00.000Z"),
      approxLatitude: 46.79, // ~2.2 km
      approxLongitude: 23.59,
    });

    const blockFindMany = vi.fn().mockResolvedValue([]);
    const dogFindMany = vi.fn().mockResolvedValue([farAdult, nearAdult, nearPuppy]);

    const onlyAdultsWithin10Km = await searchDogs(
      viewer,
      { ageGroup: "ADULT", maxDistanceKm: 10, page: 1, pageSize: 10 },
      fakeDb(dogFindMany, blockFindMany),
      NOW,
    );

    expect(onlyAdultsWithin10Km.items).toHaveLength(1);
    expect((onlyAdultsWithin10Km.items[0] as { name: string }).name).toBe("Luna");
    expect(onlyAdultsWithin10Km.meta).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });

    const allSortedPage1 = await searchDogs(
      viewer,
      { page: 1, pageSize: 2 },
      fakeDb(dogFindMany, blockFindMany),
      NOW,
    );

    expect(allSortedPage1.items.map((d) => (d as { name: string }).name)).toEqual(["Milo", "Luna"]);
    expect(allSortedPage1.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });
});

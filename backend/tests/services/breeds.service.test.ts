import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import { breedSelect, listBreeds } from "../../src/services/breeds.service.js";

function fakeDb(breed: { findMany?: unknown }): DbClient {
  return { breed } as unknown as DbClient;
}

describe("listBreeds", () => {
  it("returns breeds ordered alphabetically with the public select fields", async () => {
    const sample = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Beagle",
        size: "MEDIUM",
        careTips: "Daily walks",
        heatSensitive: false,
        breathingIssues: false,
        energyLevel: 4,
      },
    ];
    const findMany = vi.fn().mockResolvedValue(sample);

    const result = await listBreeds(fakeDb({ findMany }));

    expect(result).toEqual(sample);
    expect(findMany).toHaveBeenCalledWith({
      select: breedSelect,
      orderBy: { name: "asc" },
    });
  });
});

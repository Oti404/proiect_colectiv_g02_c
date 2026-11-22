import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import { createDog, deleteDog, getDog, updateDog } from "../../src/services/dogs.service.js";
import { HttpError } from "../../src/utils/http-error.js";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const BREED_ID = "33333333-3333-4333-8333-333333333333";
const DOG_ID = "44444444-4444-4444-8444-444444444444";

const sampleDog = {
  id: DOG_ID,
  ownerId: OWNER_ID,
  breedId: BREED_ID,
  name: "Rex",
  birthDate: new Date("2023-05-01T00:00:00.000Z"),
  sex: "MALE" as const,
  size: "LARGE" as const,
  temperament: "FRIENDLY" as const,
  neutered: true,
  photoUrl: null,
  breed: {
    id: BREED_ID,
    name: "Golden Retriever",
    size: "LARGE" as const,
    careTips: "Brush weekly",
    heatSensitive: false,
    breathingIssues: false,
    energyLevel: 4,
  },
  owner: {
    id: OWNER_ID,
    firstName: "Ana",
    lastName: "Pop",
    avatarUrl: null,
    bio: null,
    approxLatitude: 46.77,
    approxLongitude: 23.59,
  },
};

function fakeDb(mocks: {
  dog?: Record<string, unknown>;
  breed?: Record<string, unknown>;
  block?: Record<string, unknown>;
}): DbClient {
  return mocks as unknown as DbClient;
}

describe("dogs.service", () => {
  describe("getDog", () => {
    it("returns the dog when it exists and there is no block", async () => {
      const findUnique = vi.fn().mockResolvedValue(sampleDog);
      const findFirst = vi.fn().mockResolvedValue(null);

      const result = await getDog(OTHER_USER_ID, DOG_ID, fakeDb({ dog: { findUnique }, block: { findFirst } }));

      expect(result).toEqual(sampleDog);
      expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: DOG_ID } }));
    });

    it("throws 404 when the dog does not exist", async () => {
      const findUnique = vi.fn().mockResolvedValue(null);

      await expect(getDog(OTHER_USER_ID, DOG_ID, fakeDb({ dog: { findUnique } }))).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
      });
    });

    it("throws 404 when viewer and owner have a block in either direction", async () => {
      const findUnique = vi.fn().mockResolvedValue(sampleDog);
      const findFirst = vi.fn().mockResolvedValue({ blockerId: OWNER_ID });

      await expect(
        getDog(OTHER_USER_ID, DOG_ID, fakeDb({ dog: { findUnique }, block: { findFirst } })),
      ).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
      });
    });
  });

  describe("createDog", () => {
    it("creates a dog when the breed exists", async () => {
      const findBreed = vi.fn().mockResolvedValue({ id: BREED_ID });
      const create = vi.fn().mockResolvedValue(sampleDog);

      const result = await createDog(
        OWNER_ID,
        {
          breedId: BREED_ID,
          name: "Rex",
          birthDate: sampleDog.birthDate,
          sex: "MALE",
          size: "LARGE",
          temperament: "FRIENDLY",
          neutered: true,
          photoUrl: null,
        },
        fakeDb({ breed: { findUnique: findBreed }, dog: { create } }),
      );

      expect(result).toEqual(sampleDog);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: OWNER_ID, breedId: BREED_ID, name: "Rex" }),
        }),
      );
    });

    it("throws 404 when the breed does not exist", async () => {
      const findBreed = vi.fn().mockResolvedValue(null);
      const create = vi.fn();

      await expect(
        createDog(
          OWNER_ID,
          {
            breedId: BREED_ID,
            name: "Rex",
            sex: "MALE",
            size: "LARGE",
            temperament: "FRIENDLY",
            neutered: false,
          },
          fakeDb({ breed: { findUnique: findBreed }, dog: { create } }),
        ),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });

      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("updateDog", () => {
    it("updates the dog when called by the owner", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const update = vi.fn().mockResolvedValue({ ...sampleDog, name: "Rexy" });

      const result = await updateDog(OWNER_ID, DOG_ID, { name: "Rexy" }, fakeDb({ dog: { findUnique, update } }));

      expect(result.name).toBe("Rexy");
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: DOG_ID }, data: { name: "Rexy" } }));
    });

    it("throws 404 when the dog does not exist", async () => {
      const findUnique = vi.fn().mockResolvedValue(null);

      await expect(updateDog(OWNER_ID, DOG_ID, { name: "Rexy" }, fakeDb({ dog: { findUnique } }))).rejects.toMatchObject(
        { status: 404, code: "NOT_FOUND" },
      );
    });

    it("throws 403 when called by another user", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const update = vi.fn();

      await expect(
        updateDog(OTHER_USER_ID, DOG_ID, { name: "Rexy" }, fakeDb({ dog: { findUnique, update } })),
      ).rejects.toBeInstanceOf(HttpError);

      await expect(
        updateDog(OTHER_USER_ID, DOG_ID, { name: "Rexy" }, fakeDb({ dog: { findUnique, update } })),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
      expect(update).not.toHaveBeenCalled();
    });

    it("throws 404 when updating to a non-existent breed", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findBreed = vi.fn().mockResolvedValue(null);
      const update = vi.fn();

      await expect(
        updateDog(
          OWNER_ID,
          DOG_ID,
          { breedId: BREED_ID },
          fakeDb({ dog: { findUnique, update }, breed: { findUnique: findBreed } }),
        ),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("deleteDog", () => {
    it("deletes the dog when called by the owner", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const del = vi.fn().mockResolvedValue(sampleDog);

      await deleteDog(OWNER_ID, DOG_ID, fakeDb({ dog: { findUnique, delete: del } }));

      expect(del).toHaveBeenCalledWith({ where: { id: DOG_ID } });
    });

    it("throws 404 when the dog does not exist", async () => {
      const findUnique = vi.fn().mockResolvedValue(null);

      await expect(deleteDog(OWNER_ID, DOG_ID, fakeDb({ dog: { findUnique } }))).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
      });
    });

    it("throws 403 when called by another user", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const del = vi.fn();

      await expect(deleteDog(OTHER_USER_ID, DOG_ID, fakeDb({ dog: { findUnique, delete: del } }))).rejects.toMatchObject(
        { status: 403, code: "FORBIDDEN" },
      );
      expect(del).not.toHaveBeenCalled();
    });
  });
});

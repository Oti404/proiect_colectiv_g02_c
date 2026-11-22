import type { DogSize, Prisma, Temperament } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { haversineKm } from "../utils/geo.js";
import { paginateArray, type PaginationMeta, type PaginationParams } from "../utils/pagination.js";
import type { AuthUser } from "./auth.service.js";
import { getBlockedUserIds } from "./block.service.js";

export type DogAgeGroup = "PUPPY" | "ADULT" | "SENIOR";

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

const breedSelect = {
  id: true,
  name: true,
  size: true,
  careTips: true,
  heatSensitive: true,
  breathingIssues: true,
  energyLevel: true,
} as const;

const publicOwnerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
} as const;

export interface SearchDogsFilters extends PaginationParams {
  q?: string;
  breedId?: string;
  size?: DogSize;
  temperament?: Temperament;
  ageGroup?: DogAgeGroup;
  neuteredOnly?: boolean;
  maxDistanceKm?: number;
}

export function getDogAgeGroup(birthDate: Date | null, now: Date = new Date()): DogAgeGroup | null {
  if (!birthDate) return null;
  const diffMs = now.getTime() - birthDate.getTime();
  const years = diffMs < 0 ? 0 : diffMs / MS_PER_YEAR;
  if (years < 1.5) return "PUPPY";
  if (years < 7) return "ADULT";
  return "SENIOR";
}

export async function searchDogs(
  viewer: Pick<AuthUser, "id" | "approxLatitude" | "approxLongitude">,
  filters: SearchDogsFilters,
  db: DbClient = prisma,
  now: Date = new Date(),
): Promise<{ items: unknown[]; meta: PaginationMeta }> {
  const blockedIds = await getBlockedUserIds(viewer.id, db);
  const excludedOwnerIds = [viewer.id, ...blockedIds];

  const where: Prisma.DogWhereInput = {
    ownerId: { notIn: excludedOwnerIds },
  };

  if (filters.breedId) where.breedId = filters.breedId;
  if (filters.size) where.size = filters.size;
  if (filters.temperament) where.temperament = filters.temperament;
  if (filters.neuteredOnly) where.neutered = true;

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { breed: { name: { contains: filters.q, mode: "insensitive" } } },
      { owner: { firstName: { contains: filters.q, mode: "insensitive" } } },
      { owner: { lastName: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const dogs = await db.dog.findMany({
    where,
    include: {
      breed: { select: breedSelect },
      owner: { select: publicOwnerSelect },
    },
  });

  const matched = dogs
    .map((dog) => {
      const distanceKm =
        Math.round(
          haversineKm(
            viewer.approxLatitude,
            viewer.approxLongitude,
            dog.owner.approxLatitude,
            dog.owner.approxLongitude,
          ) * 10,
        ) / 10;
      const ageGroup = getDogAgeGroup(dog.birthDate, now);
      return { ...dog, ageGroup, distanceKm };
    })
    .filter((item) => {
      if (filters.ageGroup && item.ageGroup !== filters.ageGroup) return false;
      if (filters.maxDistanceKm !== undefined && item.distanceKm > filters.maxDistanceKm) return false;
      return true;
    })
    .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name));

  return paginateArray(matched, { page: filters.page, pageSize: filters.pageSize });
}

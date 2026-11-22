import { prisma, type DbClient } from "../lib/prisma.js";

export const breedSelect = {
  id: true,
  name: true,
  size: true,
  careTips: true,
  heatSensitive: true,
  breathingIssues: true,
  energyLevel: true,
} as const;

export async function listBreeds(db: DbClient = prisma) {
  return db.breed.findMany({
    select: breedSelect,
    orderBy: { name: "asc" },
  });
}

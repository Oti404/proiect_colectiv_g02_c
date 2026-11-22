import type { DogSize, Sex, Temperament } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { forbidden, notFound } from "../utils/http-error.js";
import { isBlockedEitherWay } from "./block.service.js";
import { breedSelect } from "./breeds.service.js";

const publicOwnerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
} as const;

export interface CreateDogInput {
  breedId: string;
  name: string;
  birthDate?: Date | null;
  sex: Sex;
  size: DogSize;
  temperament: Temperament;
  neutered: boolean;
  photoUrl?: string | null;
}

export interface UpdateDogInput {
  breedId?: string;
  name?: string;
  birthDate?: Date | null;
  sex?: Sex;
  size?: DogSize;
  temperament?: Temperament;
  neutered?: boolean;
  photoUrl?: string | null;
}

async function ensureBreedExists(breedId: string, db: DbClient): Promise<void> {
  const breed = await db.breed.findUnique({
    where: { id: breedId },
    select: { id: true },
  });
  if (!breed) {
    throw notFound("Breed not found");
  }
}

export async function getDog(viewerId: string, dogId: string, db: DbClient = prisma) {
  const dog = await db.dog.findUnique({
    where: { id: dogId },
    include: {
      breed: { select: breedSelect },
      owner: { select: publicOwnerSelect },
    },
  });

  if (!dog || (await isBlockedEitherWay(viewerId, dog.ownerId, db))) {
    throw notFound("Dog not found");
  }

  return dog;
}

export async function createDog(ownerId: string, input: CreateDogInput, db: DbClient = prisma) {
  await ensureBreedExists(input.breedId, db);

  return db.dog.create({
    data: {
      ownerId,
      breedId: input.breedId,
      name: input.name,
      birthDate: input.birthDate ?? null,
      sex: input.sex,
      size: input.size,
      temperament: input.temperament,
      neutered: input.neutered,
      photoUrl: input.photoUrl ?? null,
    },
    include: {
      breed: { select: breedSelect },
    },
  });
}

export async function updateDog(ownerId: string, dogId: string, patch: UpdateDogInput, db: DbClient = prisma) {
  const existing = await db.dog.findUnique({
    where: { id: dogId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    throw notFound("Dog not found");
  }
  if (existing.ownerId !== ownerId) {
    throw forbidden("You can only edit your own dogs");
  }

  if (patch.breedId !== undefined) {
    await ensureBreedExists(patch.breedId, db);
  }

  return db.dog.update({
    where: { id: dogId },
    data: patch,
    include: {
      breed: { select: breedSelect },
    },
  });
}

export async function deleteDog(ownerId: string, dogId: string, db: DbClient = prisma): Promise<void> {
  const existing = await db.dog.findUnique({
    where: { id: dogId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    throw notFound("Dog not found");
  }
  if (existing.ownerId !== ownerId) {
    throw forbidden("You can only delete your own dogs");
  }

  await db.dog.delete({ where: { id: dogId } });
}

import bcrypt from "bcryptjs";
import { EventStatus, type Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { UpdateMeInput } from "../schemas/users.schemas.js";
import { roundLocation } from "../utils/geo.js";
import { HttpError, notFound } from "../utils/http-error.js";
import { isBlockedEitherWay } from "./block.service.js";
import { publicUserSelect, selfUserSelect, type PublicUser, type SelfUser } from "./user-selects.js";

export { getSelf } from "./auth.service.js";

export async function updateMe(userId: string, input: UpdateMeInput): Promise<SelfUser> {
  const data: Prisma.UserUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.bio !== undefined) data.bio = input.bio || null;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl || null;
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const { latitude, longitude } = roundLocation(input.latitude, input.longitude);
    data.approxLatitude = latitude;
    data.approxLongitude = longitude;
  }

  return prisma.user.update({ where: { id: userId }, data, select: selfUserSelect });
}

// Câinii afișați pe profilul public.
const profileDogSelect = {
  id: true,
  name: true,
  birthDate: true,
  sex: true,
  size: true,
  temperament: true,
  neutered: true,
  photoUrl: true,
  breed: { select: { id: true, name: true } },
} satisfies Prisma.DogSelect;

export type PublicProfile = PublicUser & {
  dogs: Prisma.DogGetPayload<{ select: typeof profileDogSelect }>[];
};

/**
 * Profilul public al unui utilizator, cu câinii lui.
 * Dacă există un block în oricare direcție, răspundem ca și cum utilizatorul n-ar exista.
 */
export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile> {
  if (await isBlockedEitherWay(viewerId, userId)) {
    throw notFound("User not found");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, dogs: { select: profileDogSelect, orderBy: { createdAt: "asc" } } },
  });
  if (!user) throw notFound("User not found");
  return user;
}

/**
 * Șterge contul. În aceeași tranzacție, evenimentele active organizate de utilizator
 * trec pe CANCELLED (altfel ar rămâne active, fără organizator, după ștergere).
 * Restul datelor se șterg în cascadă; mesajele rămân, cu expeditorul „Utilizator șters”.
 */
export async function deleteMe(userId: string, password: string): Promise<{ cancelledEvents: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw notFound("User not found");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(403, "INVALID_PASSWORD", "The password is incorrect");
  }

  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.event.updateMany({
      where: { organizerId: userId, status: EventStatus.ACTIVE },
      data: { status: EventStatus.CANCELLED },
    });
    await tx.user.delete({ where: { id: userId } });
    return { cancelledEvents: cancelled.count };
  });
}

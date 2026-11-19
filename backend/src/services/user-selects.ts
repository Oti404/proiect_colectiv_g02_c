import type { Prisma } from "../generated/prisma/client.js";

// Ce câmpuri ale unui utilizator trimitem în funcție de cine se uită.
// `passwordHash` nu apare niciodată în răspunsuri.

/** Utilizatorul curent, despre el însuși (`/auth/me`, `/users/me`). */
export const selfUserSelect = {
  id: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
  consentAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SelfUser = Prisma.UserGetPayload<{ select: typeof selfUserSelect }>;

/** Profilul public, văzut de alți utilizatori. Fără email. */
export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** Varianta scurtă, pentru liste (conversații, block-uri, autori). */
export const userSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

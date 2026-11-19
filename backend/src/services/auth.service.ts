import { prisma, type DbClient } from "../lib/prisma.js";

// Câmpurile utilizatorului curent disponibile pe `req.user`. Fără `passwordHash`.
const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  approxLatitude: true,
  approxLongitude: true,
} as const;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  approxLatitude: number;
  approxLongitude: number;
}

export async function findAuthUserById(id: string, db: DbClient = prisma): Promise<AuthUser | null> {
  return db.user.findUnique({ where: { id }, select: authUserSelect });
}

import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import { roundLocation } from "../utils/geo.js";
import { HttpError, notFound } from "../utils/http-error.js";
import { signAccessToken } from "../utils/jwt.js";
import { selfUserSelect, type SelfUser } from "./user-selects.js";

const BCRYPT_ROUNDS = 10;

// ───────────── Utilizatorul curent pentru requireAuth ─────────────

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

// ───────────── Register / login / me ─────────────

export interface AuthResult {
  token: string;
  user: SelfUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  const { latitude, longitude } = roundLocation(input.latitude, input.longitude);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        bio: input.bio || null,
        approxLatitude: latitude,
        approxLongitude: longitude,
        consentAt: new Date(),
      },
      select: selfUserSelect,
    });
    return { token: signAccessToken(user.id), user };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw err;
  }
}

// Hash folosit când emailul nu există: login-ul durează la fel de mult,
// ca timpul de răspuns să nu dezvăluie ce emailuri au cont.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("parola-inexistenta", BCRYPT_ROUNDS));

const invalidCredentials = () => new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export async function login(input: LoginInput): Promise<AuthResult> {
  const found = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...selfUserSelect, passwordHash: true },
  });

  const passwordOk = await bcrypt.compare(input.password, found?.passwordHash ?? (await getDummyHash()));
  if (!found || !passwordOk) {
    throw invalidCredentials();
  }

  const { passwordHash: _hash, ...user } = found;
  return { token: signAccessToken(user.id), user };
}

export async function getSelf(userId: string, db: DbClient = prisma): Promise<SelfUser> {
  const user = await db.user.findUnique({ where: { id: userId }, select: selfUserSelect });
  if (!user) throw notFound("User not found");
  return user;
}

import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { findAuthUserById, type AuthUser } from "../services/auth.service.js";
import { HttpError, unauthorized } from "../utils/http-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

const uuidSchema = z.uuid();

/**
 * Cere header-ul `Authorization: Bearer <token>`. Dacă token-ul e valid și utilizatorul
 * încă există, îl pune pe `req.user`. Altfel răspunde cu 401.
 *
 *   router.get("/me", requireAuth, getMe);
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();
  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, "TOKEN_EXPIRED", "The session has expired, please log in again");
    }
    throw new HttpError(401, "INVALID_TOKEN", "Invalid authentication token");
  }

  if (!uuidSchema.safeParse(userId).success) {
    throw new HttpError(401, "INVALID_TOKEN", "Invalid authentication token");
  }

  // Verificăm în baza de date: contul poate fi fost șters după emiterea token-ului.
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new HttpError(401, "INVALID_TOKEN", "The account for this token no longer exists");
  }

  req.user = user;
  next();
};

/**
 * Utilizatorul curent, în handler-ele de după `requireAuth`. Evită `req.user!` peste tot.
 *
 *   const me = currentUser(req);
 */
export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    // Ajunge aici doar dacă ruta a uitat `requireAuth`.
    throw unauthorized();
  }
  return req.user;
}

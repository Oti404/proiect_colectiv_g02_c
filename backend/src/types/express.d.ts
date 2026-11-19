import type { AuthUser } from "../services/auth.service.js";

// Adaugă `req.user` pe tipul Request din Express. Îl setează middleware-ul `requireAuth`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};

import express, { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { currentUser, requireAuth } from "../../src/middleware/require-auth.js";
import { findAuthUserById } from "../../src/services/auth.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { sendOk } from "../../src/utils/response.js";

// Fără bază de date: căutarea utilizatorului e înlocuită cu un mock (vi.mock e mutat automat sus).
vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

const findUser = vi.mocked(findAuthUserById);

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user1@demo.local",
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const app = express();
app.get("/me", requireAuth, (req: Request, res: Response) => sendOk(res, currentUser(req)));
app.use(errorHandler);

describe("requireAuth", () => {
  beforeEach(() => {
    findUser.mockReset();
  });

  it("sets req.user for a valid token", async () => {
    findUser.mockResolvedValue(USER);
    const res = await request(app).get("/me").set("Authorization", `Bearer ${signAccessToken(USER.id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: USER });
    expect(findUser).toHaveBeenCalledWith(USER.id);
  });

  it("rejects a request without a token", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed header", async () => {
    const res = await request(app).get("/me").set("Authorization", "Token abc");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a token signed with another secret", async () => {
    const forged = jwt.sign({}, "another-secret", { subject: USER.id });
    const res = await request(app).get("/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
    expect(findUser).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, env.jwtSecret, { subject: USER.id });
    const res = await request(app).get("/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects a token whose subject is not a uuid", async () => {
    const res = await request(app).get("/me").set("Authorization", `Bearer ${signAccessToken("not-a-uuid")}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
    expect(findUser).not.toHaveBeenCalled();
  });

  it("rejects a token for a deleted account", async () => {
    findUser.mockResolvedValue(null);
    const res = await request(app).get("/me").set("Authorization", `Bearer ${signAccessToken(USER.id)}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});

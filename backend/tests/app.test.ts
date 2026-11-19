import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { app } from "../src/app.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { isDatabaseReachable } from "../src/services/health.service.js";
import { notFound } from "../src/utils/http-error.js";

vi.mock("../src/services/health.service.js", () => ({
  isDatabaseReachable: vi.fn(),
}));

const dbReachable = vi.mocked(isDatabaseReachable);

describe("GET /api/health", () => {
  afterEach(() => {
    dbReachable.mockReset();
  });

  it("returns ok when the database is reachable", async () => {
    dbReachable.mockResolvedValue(true);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok", database: "up" } });
  });

  it("returns 503 when the database is down", async () => {
    dbReachable.mockResolvedValue(false);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("app-level error handling", () => {
  it("returns a 404 in the standard format for unknown routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "ROUTE_NOT_FOUND", message: "Route GET /api/does-not-exist not found" },
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await request(app).post("/api/health").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("does not expose the x-powered-by header", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("errorHandler", () => {
  const knownError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("db error", { code, clientVersion: "test" });

  const testApp = express();
  testApp.get("/http-error", () => {
    throw notFound("Dog not found");
  });
  testApp.get("/zod-error", () => {
    z.object({ name: z.string() }).parse({});
  });
  testApp.get("/prisma/:code", (req) => {
    throw knownError(req.params.code);
  });
  testApp.get("/async-crash", async () => {
    throw new Error("boom");
  });
  testApp.use(errorHandler);

  it("maps HttpError to its status and code", async () => {
    const res = await request(testApp).get("/http-error");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Dog not found" } });
  });

  it("maps ZodError thrown in a service to 400", async () => {
    const res = await request(testApp).get("/zod-error");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("name");
  });

  it.each([
    ["P2002", 409, "CONFLICT"],
    ["P2003", 409, "CONFLICT"],
    ["P2025", 404, "NOT_FOUND"],
  ])("maps Prisma %s to %i", async (code, status, errorCode) => {
    const res = await request(testApp).get(`/prisma/${code}`);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(errorCode);
  });

  it("maps unexpected (async) errors to 500", async () => {
    const res = await request(testApp).get("/async-crash");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.message).toBe("Something went wrong");
  });
});

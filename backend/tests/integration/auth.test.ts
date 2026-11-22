import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { createUser, TEST_PASSWORD } from "./helpers.js";

const validRegistration = {
  email: "  Ana.Pop@Example.com ",
  password: "o-parola-buna",
  firstName: " Ana ",
  lastName: "Pop",
  latitude: 46.770439,
  longitude: 23.591423,
  consentAccepted: true,
};

describe("POST /api/auth/register", () => {
  it("creates the account and returns a working token", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegistration);

    expect(res.status).toBe(201);
    const { token, user } = res.body.data;
    expect(typeof token).toBe("string");
    expect(user).toMatchObject({
      email: "ana.pop@example.com",
      firstName: "Ana",
      lastName: "Pop",
      bio: null,
      approxLatitude: 46.77,
      approxLongitude: 23.59,
      emailVerified: false,
    });
    expect(user.consentAt).toEqual(expect.any(String));
    expect(user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(user.id);
  });

  it("stores a bcrypt hash, never the password", async () => {
    await request(app).post("/api/auth/register").send(validRegistration).expect(201);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "ana.pop@example.com" } });
    expect(stored.passwordHash).not.toContain(validRegistration.password);
    expect(await bcrypt.compare(validRegistration.password, stored.passwordHash)).toBe(true);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await createUser({ email: "ana.pop@example.com" });
    const res = await request(app).post("/api/auth/register").send(validRegistration);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("requires GDPR consent", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, consentAccepted: false });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ location: "body", path: "consentAccepted", message: "GDPR consent is required" }),
    ]);
  });

  it("validates email, password and coordinates", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, email: "not-an-email", password: "short", latitude: 120 });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "password", "latitude"]));
  });

  it("rejects passwords longer than bcrypt can handle", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, password: "a".repeat(73) });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token and the user for valid credentials", async () => {
    const user = await createUser({ email: "mihai@test.local" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  MIHAI@test.local", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.data.token}`);
    expect(me.body.data.email).toBe("mihai@test.local");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser({ email: "mihai@test.local" });
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "mihai@test.local", password: "gresit" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nimeni@test.local", password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/auth/me", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 once the account is deleted", async () => {
    const user = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    const res = await request(app).get("/api/auth/me").set(user.authHeader);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});

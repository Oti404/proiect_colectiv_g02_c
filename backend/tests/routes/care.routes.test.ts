import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as careService from "../../src/services/care.service.js";
import { forbidden } from "../../src/utils/http-error.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/care.service.js", () => ({
  listHealthRecords: vi.fn(),
  createHealthRecord: vi.fn(),
  updateHealthRecord: vi.fn(),
  deleteHealthRecord: vi.fn(),
  getReminders: vi.fn(),
  getWeightHistory: vi.fn(),
  getDailyTip: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DOG_ID = "22222222-2222-4222-8222-222222222222";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

const authUser = {
  id: USER_ID,
  email: "ana@demo.local",
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const listMock = vi.mocked(careService.listHealthRecords);
const createMock = vi.mocked(careService.createHealthRecord);
const updateMock = vi.mocked(careService.updateHealthRecord);
const deleteMock = vi.mocked(careService.deleteHealthRecord);
const remindersMock = vi.mocked(careService.getReminders);
const weightHistoryMock = vi.mocked(careService.getWeightHistory);
const dailyTipMock = vi.mocked(careService.getDailyTip);

describe("Dog care routes (/api/dogs/:id/...)", () => {
  let token: string;

  beforeEach(() => {
    token = signAccessToken(USER_ID);
    findAuthUserMock.mockResolvedValue(authUser);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("requires authentication", async () => {
    const res = await request(app).get(`/api/dogs/${DOG_ID}/health-records`);
    expect(res.status).toBe(401);
  });

  it("lists health records with optional type filter", async () => {
    listMock.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/dogs/${DOG_ID}/health-records?type=VACCINE`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
    expect(listMock).toHaveBeenCalledWith(USER_ID, DOG_ID, "VACCINE");
  });

  it("creates a health record and returns 201", async () => {
    const created = {
      id: RECORD_ID,
      dogId: DOG_ID,
      type: "WEIGHT" as const,
      title: "Monthly weigh-in",
      date: new Date("2026-11-10T00:00:00.000Z"),
      nextDueDate: null,
      weightKg: 21.5,
      notes: null,
      createdAt: new Date("2026-11-10T00:00:00.000Z"),
      updatedAt: new Date("2026-11-10T00:00:00.000Z"),
    };
    createMock.mockResolvedValue(created);

    const res = await request(app)
      .post(`/api/dogs/${DOG_ID}/health-records`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "WEIGHT",
        title: "Monthly weigh-in",
        date: "2026-11-10",
        weightKg: 21.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(RECORD_ID);
  });

  it("rejects WEIGHT record with missing or non-positive weightKg", async () => {
    const res = await request(app)
      .post(`/api/dogs/${DOG_ID}/health-records`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "WEIGHT",
        title: "Weigh-in",
        date: "2026-11-10",
        weightKg: -2,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects nextDueDate earlier than date", async () => {
    const res = await request(app)
      .post(`/api/dogs/${DOG_ID}/health-records`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "VACCINE",
        title: "Rabies",
        date: "2026-11-15",
        nextDueDate: "2026-11-10",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("updates a health record and returns 200", async () => {
    updateMock.mockResolvedValue({
      id: RECORD_ID,
      dogId: DOG_ID,
      type: "VACCINE" as const,
      title: "Updated title",
      date: new Date("2026-11-10T00:00:00.000Z"),
      nextDueDate: null,
      weightKg: null,
      notes: null,
      createdAt: new Date("2026-11-10T00:00:00.000Z"),
      updatedAt: new Date("2026-11-10T00:00:00.000Z"),
    });

    const res = await request(app)
      .patch(`/api/dogs/${DOG_ID}/health-records/${RECORD_ID}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated title");
  });

  it("deletes a health record and returns 204", async () => {
    deleteMock.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/dogs/${DOG_ID}/health-records/${RECORD_ID}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith(USER_ID, DOG_ID, RECORD_ID);
  });

  it("returns reminders, weight history, and daily tip", async () => {
    remindersMock.mockResolvedValue([]);
    weightHistoryMock.mockResolvedValue([]);
    dailyTipMock.mockResolvedValue({
      headline: "Balanced daily routine for Rex",
      advice: "Brush weekly",
      isWarning: false,
      disclaimer: "Disclaimer",
    });

    const remRes = await request(app).get(`/api/dogs/${DOG_ID}/reminders`).set("Authorization", `Bearer ${token}`);
    expect(remRes.status).toBe(200);
    expect(remRes.body).toEqual({ data: [] });

    const weightRes = await request(app)
      .get(`/api/dogs/${DOG_ID}/weight-history`)
      .set("Authorization", `Bearer ${token}`);
    expect(weightRes.status).toBe(200);
    expect(weightRes.body).toEqual({ data: [] });

    const tipRes = await request(app).get(`/api/dogs/${DOG_ID}/daily-tip`).set("Authorization", `Bearer ${token}`);
    expect(tipRes.status).toBe(200);
    expect(tipRes.body.data.headline).toContain("Rex");
  });

  it("returns 403 when user does not own the dog", async () => {
    remindersMock.mockRejectedValue(forbidden("You can only access care records for your own dogs"));

    const res = await request(app).get(`/api/dogs/${DOG_ID}/reminders`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

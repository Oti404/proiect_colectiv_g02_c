import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import {
  createHealthRecord,
  deleteHealthRecord,
  getDailyTip,
  getReminders,
  getWeightHistory,
  listHealthRecords,
  MEDICAL_DISCLAIMER_TEXT,
  updateHealthRecord,
} from "../../src/services/care.service.js";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const DOG_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "44444444-4444-4444-8444-444444444444";

const NOW = new Date("2026-11-19T12:00:00.000Z");

function fakeDb(mocks: { dog?: Record<string, unknown>; healthRecord?: Record<string, unknown> }): DbClient {
  return mocks as unknown as DbClient;
}

describe("care.service", () => {
  describe("listHealthRecords", () => {
    it("lists records for the owner's dog with optional type filter", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findMany = vi.fn().mockResolvedValue([{ id: RECORD_ID, type: "VACCINE" }]);

      const result = await listHealthRecords(
        OWNER_ID,
        DOG_ID,
        "VACCINE",
        fakeDb({ dog: { findUnique: findDog }, healthRecord: { findMany } }),
      );

      expect(result).toHaveLength(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dogId: DOG_ID, type: "VACCINE" },
        }),
      );
    });

    it("throws 403 when user does not own the dog", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });

      await expect(listHealthRecords(OTHER_ID, DOG_ID, undefined, fakeDb({ dog: { findUnique: findDog } }))).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    });
  });

  describe("createHealthRecord", () => {
    it("creates a valid WEIGHT record", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const create = vi.fn().mockResolvedValue({ id: RECORD_ID, type: "WEIGHT", weightKg: 18.5 });

      const result = await createHealthRecord(
        OWNER_ID,
        DOG_ID,
        {
          type: "WEIGHT",
          title: "Monthly weigh-in",
          date: new Date("2026-11-10T00:00:00.000Z"),
          weightKg: 18.5,
        },
        fakeDb({ dog: { findUnique: findDog }, healthRecord: { create } }),
      );

      expect(result.id).toBe(RECORD_ID);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("rejects nextDueDate earlier than date", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const create = vi.fn();

      await expect(
        createHealthRecord(
          OWNER_ID,
          DOG_ID,
          {
            type: "VACCINE",
            title: "Rabies",
            date: new Date("2026-11-10T00:00:00.000Z"),
            nextDueDate: new Date("2026-11-05T00:00:00.000Z"),
          },
          fakeDb({ dog: { findUnique: findDog }, healthRecord: { create } }),
        ),
      ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects WEIGHT record without weightKg", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const create = vi.fn();

      await expect(
        createHealthRecord(
          OWNER_ID,
          DOG_ID,
          {
            type: "WEIGHT",
            title: "Weigh-in",
            date: new Date("2026-11-10T00:00:00.000Z"),
            weightKg: null,
          },
          fakeDb({ dog: { findUnique: findDog }, healthRecord: { create } }),
        ),
      ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("updateHealthRecord", () => {
    it("rejects patch that makes nextDueDate earlier than existing date", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findFirst = vi.fn().mockResolvedValue({
        id: RECORD_ID,
        dogId: DOG_ID,
        type: "VACCINE",
        date: new Date("2026-11-10T00:00:00.000Z"),
        nextDueDate: null,
        weightKg: null,
      });
      const update = vi.fn();

      await expect(
        updateHealthRecord(
          OWNER_ID,
          DOG_ID,
          RECORD_ID,
          { nextDueDate: new Date("2026-11-01T00:00:00.000Z") },
          fakeDb({ dog: { findUnique: findDog }, healthRecord: { findFirst, update } }),
        ),
      ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("deleteHealthRecord", () => {
    it("deletes an existing record belonging to the owner's dog", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findFirst = vi.fn().mockResolvedValue({ id: RECORD_ID });
      const del = vi.fn().mockResolvedValue({ id: RECORD_ID });

      await deleteHealthRecord(
        OWNER_ID,
        DOG_ID,
        RECORD_ID,
        fakeDb({ dog: { findUnique: findDog }, healthRecord: { findFirst, delete: del } }),
      );

      expect(del).toHaveBeenCalledWith({ where: { id: RECORD_ID } });
    });
  });

  describe("getReminders", () => {
    it("classifies OVERDUE, DUE_SOON (0-14 days), and FUTURE (>14 days)", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findMany = vi.fn().mockResolvedValue([
        { id: "r1", nextDueDate: new Date("2026-11-15T00:00:00.000Z") }, // -4 days -> OVERDUE
        { id: "r2", nextDueDate: new Date("2026-11-19T00:00:00.000Z") }, // 0 days -> DUE_SOON
        { id: "r3", nextDueDate: new Date("2026-12-03T00:00:00.000Z") }, // 14 days -> DUE_SOON
        { id: "r4", nextDueDate: new Date("2026-12-10T00:00:00.000Z") }, // 21 days -> FUTURE
      ]);

      const reminders = await getReminders(
        OWNER_ID,
        DOG_ID,
        fakeDb({ dog: { findUnique: findDog }, healthRecord: { findMany } }),
        NOW,
      );

      expect(reminders.map((r) => ({ id: r.record.id, status: r.status, daysDelta: r.daysDelta }))).toEqual([
        { id: "r1", status: "OVERDUE", daysDelta: -4 },
        { id: "r2", status: "DUE_SOON", daysDelta: 0 },
        { id: "r3", status: "DUE_SOON", daysDelta: 14 },
        { id: "r4", status: "FUTURE", daysDelta: 21 },
      ]);
    });
  });

  describe("getWeightHistory", () => {
    it("returns chronological weight points", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OWNER_ID });
      const findMany = vi.fn().mockResolvedValue([
        { id: "w1", title: "Oct", date: new Date("2026-10-01T00:00:00.000Z"), weightKg: 24.2 },
        { id: "w2", title: "Nov", date: new Date("2026-11-01T00:00:00.000Z"), weightKg: 25.0 },
      ]);

      const points = await getWeightHistory(
        OWNER_ID,
        DOG_ID,
        fakeDb({ dog: { findUnique: findDog }, healthRecord: { findMany } }),
      );

      expect(points).toHaveLength(2);
      expect(points[1].weightKg).toBe(25.0);
    });
  });

  describe("getDailyTip", () => {
    it("returns a warning tip for breeds with breathing issues", async () => {
      const findDog = vi.fn().mockResolvedValue({
        id: DOG_ID,
        ownerId: OWNER_ID,
        name: "Coco",
        birthDate: new Date("2023-01-01T00:00:00.000Z"),
        breed: {
          name: "French Bulldog",
          careTips: "Keep cool",
          heatSensitive: true,
          breathingIssues: true,
          energyLevel: 2,
        },
      });

      const tip = await getDailyTip(OWNER_ID, DOG_ID, fakeDb({ dog: { findUnique: findDog } }), NOW);

      expect(tip.isWarning).toBe(true);
      expect(tip.headline).toContain("Coco");
      expect(tip.disclaimer).toBe(MEDICAL_DISCLAIMER_TEXT);
    });

    it("returns a senior-friendly tip for dogs >= 7 years old", async () => {
      const findDog = vi.fn().mockResolvedValue({
        id: DOG_ID,
        ownerId: OWNER_ID,
        name: "Rex",
        birthDate: new Date("2018-01-01T00:00:00.000Z"),
        breed: {
          name: "Golden Retriever",
          careTips: "Brush weekly",
          heatSensitive: false,
          breathingIssues: false,
          energyLevel: 4,
        },
      });

      const tip = await getDailyTip(OWNER_ID, DOG_ID, fakeDb({ dog: { findUnique: findDog } }), NOW);

      expect(tip.isWarning).toBe(false);
      expect(tip.headline).toContain("senior");
    });
  });
});

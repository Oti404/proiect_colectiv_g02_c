import type { HealthRecordType } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../utils/http-error.js";

const MS_PER_DAY = 86_400_000;
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

export const MEDICAL_DISCLAIMER_TEXT =
  "Care tips are informational only and never replace a licensed veterinarian consultation.";

export type ReminderStatus = "OVERDUE" | "DUE_SOON" | "FUTURE";

export interface CreateHealthRecordInput {
  type: HealthRecordType;
  title: string;
  date: Date;
  nextDueDate?: Date | null;
  weightKg?: number | null;
  notes?: string | null;
}

export interface UpdateHealthRecordInput {
  type?: HealthRecordType;
  title?: string;
  date?: Date;
  nextDueDate?: Date | null;
  weightKg?: number | null;
  notes?: string | null;
}

export interface DailyCareTip {
  headline: string;
  advice: string;
  isWarning: boolean;
  disclaimer: string;
}

function startOfUtcDayMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function validateRecordConsistency(data: {
  type: HealthRecordType;
  date: Date;
  nextDueDate: Date | null;
  weightKg: number | null;
}): void {
  if (data.nextDueDate && startOfUtcDayMs(data.nextDueDate) < startOfUtcDayMs(data.date)) {
    throw badRequest("nextDueDate cannot be earlier than date");
  }
  if (data.weightKg !== null && data.weightKg <= 0) {
    throw badRequest("weightKg must be greater than 0");
  }
  if (data.type === "WEIGHT" && data.weightKg === null) {
    throw badRequest("weightKg is required when type is WEIGHT");
  }
}

async function ensureDogOwner(ownerId: string, dogId: string, db: DbClient) {
  const dog = await db.dog.findUnique({
    where: { id: dogId },
    select: { id: true, ownerId: true },
  });
  if (!dog) {
    throw notFound("Dog not found");
  }
  if (dog.ownerId !== ownerId) {
    throw forbidden("You can only access care records for your own dogs");
  }
  return dog;
}

export async function listHealthRecords(
  ownerId: string,
  dogId: string,
  type?: HealthRecordType,
  db: DbClient = prisma,
) {
  await ensureDogOwner(ownerId, dogId, db);

  return db.healthRecord.findMany({
    where: { dogId, ...(type ? { type } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function createHealthRecord(
  ownerId: string,
  dogId: string,
  input: CreateHealthRecordInput,
  db: DbClient = prisma,
) {
  await ensureDogOwner(ownerId, dogId, db);

  const nextDueDate = input.nextDueDate ?? null;
  const weightKg = input.weightKg ?? null;

  validateRecordConsistency({
    type: input.type,
    date: input.date,
    nextDueDate,
    weightKg,
  });

  return db.healthRecord.create({
    data: {
      dogId,
      type: input.type,
      title: input.title,
      date: input.date,
      nextDueDate,
      weightKg,
      notes: input.notes ?? null,
    },
  });
}

export async function updateHealthRecord(
  ownerId: string,
  dogId: string,
  recordId: string,
  patch: UpdateHealthRecordInput,
  db: DbClient = prisma,
) {
  await ensureDogOwner(ownerId, dogId, db);

  const existing = await db.healthRecord.findFirst({
    where: { id: recordId, dogId },
  });
  if (!existing) {
    throw notFound("Health record not found");
  }

  const merged = {
    type: patch.type ?? existing.type,
    date: patch.date ?? existing.date,
    nextDueDate: patch.nextDueDate !== undefined ? patch.nextDueDate : existing.nextDueDate,
    weightKg: patch.weightKg !== undefined ? patch.weightKg : existing.weightKg,
  };

  validateRecordConsistency(merged);

  return db.healthRecord.update({
    where: { id: recordId },
    data: patch,
  });
}

export async function deleteHealthRecord(
  ownerId: string,
  dogId: string,
  recordId: string,
  db: DbClient = prisma,
): Promise<void> {
  await ensureDogOwner(ownerId, dogId, db);

  const existing = await db.healthRecord.findFirst({
    where: { id: recordId, dogId },
    select: { id: true },
  });
  if (!existing) {
    throw notFound("Health record not found");
  }

  await db.healthRecord.delete({ where: { id: recordId } });
}

export async function getReminders(
  ownerId: string,
  dogId: string,
  db: DbClient = prisma,
  now: Date = new Date(),
) {
  await ensureDogOwner(ownerId, dogId, db);

  const records = await db.healthRecord.findMany({
    where: { dogId, nextDueDate: { not: null } },
    orderBy: { nextDueDate: "asc" },
  });

  const todayMs = startOfUtcDayMs(now);

  return records.map((record) => {
    const dueMs = startOfUtcDayMs(record.nextDueDate!);
    const daysDelta = Math.round((dueMs - todayMs) / MS_PER_DAY);
    const status: ReminderStatus = daysDelta < 0 ? "OVERDUE" : daysDelta <= 14 ? "DUE_SOON" : "FUTURE";
    return { record, status, daysDelta };
  });
}

export async function getWeightHistory(ownerId: string, dogId: string, db: DbClient = prisma) {
  await ensureDogOwner(ownerId, dogId, db);

  const records = await db.healthRecord.findMany({
    where: { dogId, type: "WEIGHT", weightKg: { not: null } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, date: true, weightKg: true },
  });

  return records.map((record) => ({
    id: record.id,
    title: record.title,
    date: record.date,
    weightKg: record.weightKg as number,
  }));
}

export async function getDailyTip(
  ownerId: string,
  dogId: string,
  db: DbClient = prisma,
  now: Date = new Date(),
): Promise<DailyCareTip> {
  const dog = await db.dog.findUnique({
    where: { id: dogId },
    include: {
      breed: {
        select: {
          name: true,
          careTips: true,
          heatSensitive: true,
          breathingIssues: true,
          energyLevel: true,
        },
      },
    },
  });

  if (!dog) {
    throw notFound("Dog not found");
  }
  if (dog.ownerId !== ownerId) {
    throw forbidden("You can only access care tips for your own dogs");
  }

  const ageYears = dog.birthDate ? Math.max(0, (now.getTime() - dog.birthDate.getTime()) / MS_PER_YEAR) : null;

  if (dog.breed.breathingIssues) {
    return {
      headline: `Gentle pace for ${dog.name} (${dog.breed.name})`,
      advice:
        "Keep walks steady with short sniff breaks, avoid strenuous exercise in warm weather, and use a Y-front harness instead of a neck collar.",
      isWarning: true,
      disclaimer: MEDICAL_DISCLAIMER_TEXT,
    };
  }

  if (dog.breed.heatSensitive) {
    return {
      headline: `Temperature-aware care for ${dog.name}`,
      advice:
        "Carry fresh water on walks, prefer shaded routes during warmer hours, and monitor for heavy panting.",
      isWarning: true,
      disclaimer: MEDICAL_DISCLAIMER_TEXT,
    };
  }

  if (ageYears !== null && ageYears >= 7) {
    return {
      headline: `Joint-friendly routine for senior ${dog.name}`,
      advice: "Favor softer park paths over concrete and split daily movement into two comfortable walks.",
      isWarning: false,
      disclaimer: MEDICAL_DISCLAIMER_TEXT,
    };
  }

  if (ageYears !== null && ageYears < 1.5) {
    return {
      headline: `Growth-safe play for young ${dog.name}`,
      advice: "Keep exercise sessions short and playful, avoiding repetitive high-impact jumping while joints develop.",
      isWarning: false,
      disclaimer: MEDICAL_DISCLAIMER_TEXT,
    };
  }

  if (dog.breed.energyLevel >= 4) {
    return {
      headline: `High-energy day plan for ${dog.name}`,
      advice: "Combine a 45-minute brisk walk with 10 minutes of scent work or fetch to engage both body and mind.",
      isWarning: false,
      disclaimer: MEDICAL_DISCLAIMER_TEXT,
    };
  }

  return {
    headline: `Balanced daily routine for ${dog.name}`,
    advice: dog.breed.careTips,
    isWarning: false,
    disclaimer: MEDICAL_DISCLAIMER_TEXT,
  };
}

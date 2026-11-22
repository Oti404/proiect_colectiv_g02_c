import { Router } from "express";
import { z } from "zod";
import {
  createHealthRecord,
  deleteHealthRecord,
  getDailyTip,
  getReminders,
  getWeightHistory,
  listHealthRecords,
  updateHealthRecord,
} from "../controllers/care.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";

const healthRecordTypeSchema = z.enum(["VACCINE", "DEWORMING", "VET_VISIT", "WEIGHT"]);

const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" })
  .transform((value) => new Date(value));

const nullableDateSchema = z.union([dateSchema, z.null()]);

const nullableNotesSchema = z.union([
  z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value === "" ? null : value)),
  z.null(),
]);

const dogIdParams = z.object({ id: z.uuid() });
const recordIdParams = z.object({ id: z.uuid(), recordId: z.uuid() });

export const listHealthRecordsSchemas = {
  params: dogIdParams,
  query: z.object({
    type: healthRecordTypeSchema.optional(),
  }),
};

export const createHealthRecordSchemas = {
  params: dogIdParams,
  body: z
    .object({
      type: healthRecordTypeSchema,
      title: z.string().trim().min(1, "Record title is required").max(150),
      date: dateSchema,
      nextDueDate: nullableDateSchema.optional(),
      weightKg: z.union([z.number().positive("weightKg must be greater than 0").max(200), z.null()]).optional(),
      notes: nullableNotesSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (data.nextDueDate && data.nextDueDate < data.date) {
        ctx.addIssue({
          code: "custom",
          path: ["nextDueDate"],
          message: "nextDueDate cannot be earlier than date",
        });
      }
      if (data.type === "WEIGHT" && (data.weightKg === undefined || data.weightKg === null)) {
        ctx.addIssue({
          code: "custom",
          path: ["weightKg"],
          message: "weightKg is required when type is WEIGHT",
        });
      }
    }),
};

export const updateHealthRecordSchemas = {
  params: recordIdParams,
  body: z
    .object({
      type: healthRecordTypeSchema.optional(),
      title: z.string().trim().min(1, "Record title cannot be empty").max(150).optional(),
      date: dateSchema.optional(),
      nextDueDate: nullableDateSchema.optional(),
      weightKg: z.union([z.number().positive("weightKg must be greater than 0").max(200), z.null()]).optional(),
      notes: nullableNotesSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
};

export const deleteHealthRecordSchemas = {
  params: recordIdParams,
};

export const dogCareParamsSchemas = {
  params: dogIdParams,
};

export const careRouter = Router();

careRouter.use(requireAuth);

careRouter.get("/:id/health-records", validate(listHealthRecordsSchemas), listHealthRecords);
careRouter.post("/:id/health-records", validate(createHealthRecordSchemas), createHealthRecord);
careRouter.patch("/:id/health-records/:recordId", validate(updateHealthRecordSchemas), updateHealthRecord);
careRouter.delete("/:id/health-records/:recordId", validate(deleteHealthRecordSchemas), deleteHealthRecord);

careRouter.get("/:id/reminders", validate(dogCareParamsSchemas), getReminders);
careRouter.get("/:id/weight-history", validate(dogCareParamsSchemas), getWeightHistory);
careRouter.get("/:id/daily-tip", validate(dogCareParamsSchemas), getDailyTip);

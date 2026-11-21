import { Router } from "express";
import { z } from "zod";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  getEvent,
  inviteUsers,
  listEvents,
  respondToInvitation,
  updateEvent,
  upsertDogRsvp,
  upsertDogRsvpByParam,
} from "../controllers/events.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";

const eventTypeSchema = z.enum(["PLAYDATE", "GROUP_WALK", "BREED_MEETUP"]);
const visibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const eventsTabSchema = z.enum(["PUBLIC", "ORGANIZED", "INVITATIONS", "ALL"]);
const activeRsvpStatusSchema = z.enum(["GOING", "MAYBE", "NOT_GOING"]);
const invitationResponseStatusSchema = z.enum(["ACCEPTED", "DECLINED"]);

const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" })
  .transform((value) => new Date(value));

const nullableStringSchema = (maxLen: number) =>
  z.union([
    z
      .string()
      .trim()
      .max(maxLen)
      .transform((value) => (value === "" ? null : value)),
    z.null(),
  ]);

const eventIdParams = z.object({
  id: z.uuid(),
});

const eventDogParams = z.object({
  id: z.uuid(),
  dogId: z.uuid(),
});

export const listEventsSchemas = {
  query: z.object({
    tab: eventsTabSchema.default("PUBLIC"),
  }),
};

export const eventIdParamsSchemas = {
  params: eventIdParams,
};

export const createEventSchemas = {
  body: z
    .object({
      title: z.string().trim().min(1, "Event title is required").max(150),
      description: nullableStringSchema(2000).optional(),
      type: eventTypeSchema,
      visibility: visibilitySchema,
      startsAt: dateSchema,
      endsAt: dateSchema,
      maxParticipants: z
        .union([z.number().int().min(1, "maxParticipants must be at least 1").max(500), z.null()])
        .optional(),
      placeId: z.union([z.uuid(), z.null()]).optional(),
      locationText: nullableStringSchema(300).optional(),
      invitedUserIds: z.array(z.uuid()).max(100).default([]),
      organizerGoingDogIds: z.array(z.uuid()).max(50).default([]),
    })
    .superRefine((data, ctx) => {
      if (data.endsAt <= data.startsAt) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "Event end time must be later than start time",
        });
      }
      if (
        data.maxParticipants !== undefined &&
        data.maxParticipants !== null &&
        data.organizerGoingDogIds.length > data.maxParticipants
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["organizerGoingDogIds"],
          message: "Selected GOING dogs exceed maxParticipants",
        });
      }
      if (data.visibility === "PRIVATE" && data.placeId) {
        ctx.addIssue({
          code: "custom",
          path: ["placeId"],
          message: "Private events cannot have a public placeId",
        });
      }
      if (data.visibility === "PRIVATE" && !data.locationText) {
        ctx.addIssue({
          code: "custom",
          path: ["locationText"],
          message: "locationText is required for a private playdate",
        });
      }
      if (data.visibility === "PUBLIC" && !data.placeId && !data.locationText) {
        ctx.addIssue({
          code: "custom",
          path: ["placeId"],
          message: "Please choose a placeId or provide locationText for a public event",
        });
      }
    }),
};

export const updateEventSchemas = {
  params: eventIdParams,
  body: z
    .object({
      title: z.string().trim().min(1, "Event title cannot be empty").max(150).optional(),
      description: nullableStringSchema(2000).optional(),
      type: eventTypeSchema.optional(),
      startsAt: dateSchema.optional(),
      endsAt: dateSchema.optional(),
      maxParticipants: z
        .union([z.number().int().min(1, "maxParticipants must be at least 1").max(500), z.null()])
        .optional(),
      placeId: z.union([z.uuid(), z.null()]).optional(),
      locationText: nullableStringSchema(300).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    })
    .superRefine((data, ctx) => {
      if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "Event end time must be later than start time",
        });
      }
    }),
};

export const inviteUsersSchemas = {
  params: eventIdParams,
  body: z.object({
    userIds: z.array(z.uuid()).min(1, "Provide at least one userId").max(100),
  }),
};

export const respondToInvitationSchemas = {
  params: eventIdParams,
  body: z
    .object({
      status: invitationResponseStatusSchema,
      goingDogIds: z.array(z.uuid()).max(50).default([]),
    })
    .superRefine((data, ctx) => {
      if (data.status === "ACCEPTED" && data.goingDogIds.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["goingDogIds"],
          message: "Select at least one dog when accepting an invitation",
        });
      }
    }),
};

export const upsertDogRsvpSchemas = {
  params: eventIdParams,
  body: z.object({
    dogId: z.uuid(),
    status: activeRsvpStatusSchema,
  }),
};

export const upsertDogRsvpByParamSchemas = {
  params: eventDogParams,
  body: z.object({
    status: activeRsvpStatusSchema,
  }),
};

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get("/", validate(listEventsSchemas), listEvents);
eventsRouter.post("/", validate(createEventSchemas), createEvent);
eventsRouter.get("/:id", validate(eventIdParamsSchemas), getEvent);
eventsRouter.patch("/:id", validate(updateEventSchemas), updateEvent);
eventsRouter.delete("/:id", validate(eventIdParamsSchemas), deleteEvent);
eventsRouter.post("/:id/cancel", validate(eventIdParamsSchemas), cancelEvent);

eventsRouter.post("/:id/invitations", validate(inviteUsersSchemas), inviteUsers);
eventsRouter.post("/:id/invitations/respond", validate(respondToInvitationSchemas), respondToInvitation);

eventsRouter.post("/:id/rsvp", validate(upsertDogRsvpSchemas), upsertDogRsvp);
eventsRouter.put("/:id/rsvp/:dogId", validate(upsertDogRsvpByParamSchemas), upsertDogRsvpByParam);

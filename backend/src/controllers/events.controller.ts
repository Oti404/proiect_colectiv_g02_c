import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  createEventSchemas,
  eventIdParamsSchemas,
  inviteUsersSchemas,
  listEventsSchemas,
  respondToInvitationSchemas,
  updateEventSchemas,
  upsertDogRsvpByParamSchemas,
  upsertDogRsvpSchemas,
} from "../routes/events.routes.js";
import * as eventsService from "../services/events.service.js";
import { sendCreated, sendNoContent, sendOk } from "../utils/response.js";

export async function listEvents(req: ValidatedRequest<typeof listEventsSchemas>, res: Response): Promise<void> {
  const events = await eventsService.listEvents(currentUser(req as unknown as Request).id, req.query.tab);
  sendOk(res, events);
}

export async function getEvent(req: ValidatedRequest<typeof eventIdParamsSchemas>, res: Response): Promise<void> {
  const event = await eventsService.getEventById(currentUser(req).id, req.params.id);
  sendOk(res, event);
}

export async function createEvent(req: ValidatedRequest<typeof createEventSchemas>, res: Response): Promise<void> {
  const event = await eventsService.createEvent(currentUser(req).id, req.body);
  sendCreated(res, event);
}

export async function updateEvent(req: ValidatedRequest<typeof updateEventSchemas>, res: Response): Promise<void> {
  const event = await eventsService.updateEvent(currentUser(req).id, req.params.id, req.body);
  sendOk(res, event);
}

export async function cancelEvent(req: ValidatedRequest<typeof eventIdParamsSchemas>, res: Response): Promise<void> {
  const event = await eventsService.cancelEvent(currentUser(req).id, req.params.id);
  sendOk(res, event);
}

export async function deleteEvent(req: ValidatedRequest<typeof eventIdParamsSchemas>, res: Response): Promise<void> {
  await eventsService.deleteEvent(currentUser(req).id, req.params.id);
  sendNoContent(res);
}

export async function inviteUsers(req: ValidatedRequest<typeof inviteUsersSchemas>, res: Response): Promise<void> {
  const event = await eventsService.inviteUsersToEvent(currentUser(req).id, req.params.id, req.body);
  sendOk(res, event);
}

export async function respondToInvitation(
  req: ValidatedRequest<typeof respondToInvitationSchemas>,
  res: Response,
): Promise<void> {
  const result = await eventsService.respondToInvitation(currentUser(req).id, req.params.id, req.body);
  sendOk(res, result);
}

export async function upsertDogRsvp(req: ValidatedRequest<typeof upsertDogRsvpSchemas>, res: Response): Promise<void> {
  const event = await eventsService.upsertDogRsvp(currentUser(req).id, req.params.id, req.body);
  sendOk(res, event);
}

export async function upsertDogRsvpByParam(
  req: ValidatedRequest<typeof upsertDogRsvpByParamSchemas>,
  res: Response,
): Promise<void> {
  const event = await eventsService.upsertDogRsvp(currentUser(req).id, req.params.id, {
    dogId: req.params.dogId,
    status: req.body.status,
  });
  sendOk(res, event);
}

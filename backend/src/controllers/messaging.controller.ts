import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  conversationSchemas,
  listMessagesSchemas,
  sendMessageSchemas,
  startConversationSchemas,
} from "../schemas/messaging.schemas.js";
import * as messagingService from "../services/messaging.service.js";
import { sendCreated, sendNoContent, sendOk, sendWithMeta } from "../utils/response.js";

export async function listConversations(req: Request, res: Response): Promise<void> {
  sendOk(res, await messagingService.listConversations(currentUser(req).id));
}

export async function startConversation(
  req: ValidatedRequest<typeof startConversationSchemas>,
  res: Response,
): Promise<void> {
  const { conversation, created } = await messagingService.startConversation(currentUser(req).id, req.body.userId);
  sendOk(res, conversation, created ? 201 : 200);
}

export async function getConversation(req: ValidatedRequest<typeof conversationSchemas>, res: Response): Promise<void> {
  sendOk(res, await messagingService.getConversation(currentUser(req).id, req.params.id));
}

export async function listMessages(req: ValidatedRequest<typeof listMessagesSchemas>, res: Response): Promise<void> {
  const { messages, hasMore } = await messagingService.listMessages(currentUser(req).id, req.params.id, req.query);
  sendWithMeta(res, messages, { hasMore, limit: req.query.limit });
}

export async function sendMessage(req: ValidatedRequest<typeof sendMessageSchemas>, res: Response): Promise<void> {
  sendCreated(res, await messagingService.sendMessage(currentUser(req).id, req.params.id, req.body.content));
}

export async function markAsRead(req: ValidatedRequest<typeof conversationSchemas>, res: Response): Promise<void> {
  await messagingService.markAsRead(currentUser(req).id, req.params.id);
  sendNoContent(res);
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  sendOk(res, { count: await messagingService.getTotalUnreadCount(currentUser(req).id) });
}

import { Router } from "express";
import * as messagingController from "../controllers/messaging.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import {
  conversationSchemas,
  listMessagesSchemas,
  sendMessageSchemas,
  startConversationSchemas,
} from "../schemas/messaging.schemas.js";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.get("/", messagingController.listConversations);
conversationsRouter.post("/", validate(startConversationSchemas), messagingController.startConversation);
conversationsRouter.get("/:id", validate(conversationSchemas), messagingController.getConversation);
conversationsRouter.get("/:id/messages", validate(listMessagesSchemas), messagingController.listMessages);
conversationsRouter.post("/:id/messages", validate(sendMessageSchemas), messagingController.sendMessage);
conversationsRouter.post("/:id/read", validate(conversationSchemas), messagingController.markAsRead);

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get("/unread-count", messagingController.getUnreadCount);

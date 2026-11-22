import { z } from "zod";
import { uuidParam } from "./common.schemas.js";

export const MESSAGE_MAX_LENGTH = 2000;
export const DEFAULT_MESSAGES_LIMIT = 50;

export const startConversationSchemas = {
  body: z.object({ userId: z.uuid("Invalid userId") }),
};

export const conversationSchemas = {
  params: uuidParam("id"),
};

export const listMessagesSchemas = {
  params: uuidParam("id"),
  // Paginare cu cursor (id de mesaj), potrivită pentru chat:
  //   fără cursor        → ultimele `limit` mesaje;
  //   ?before=<mesaj>    → mesajele mai vechi (scroll în sus);
  //   ?after=<mesaj>     → mesajele noi (polling).
  query: z
    .object({
      before: z.uuid().optional(),
      after: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_MESSAGES_LIMIT),
    })
    .refine((q) => !(q.before && q.after), { error: "Use either before or after, not both", path: ["before"] }),
};

export type ListMessagesQuery = z.infer<typeof listMessagesSchemas.query>;

export const sendMessageSchemas = {
  params: uuidParam("id"),
  body: z.object({
    content: z.string().trim().min(1, "Message cannot be empty").max(MESSAGE_MAX_LENGTH),
  }),
};

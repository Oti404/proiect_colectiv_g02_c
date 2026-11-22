import { z } from "zod";

export const createReportSchemas = {
  body: z
    .object({
      reportedUserId: z.uuid().optional(),
      postId: z.uuid().optional(),
      reason: z.string().trim().min(3, "Please describe the problem").max(1000),
    })
    .strict()
    // Un raport are exact o țintă: un utilizator SAU o postare.
    .refine((body) => (body.reportedUserId === undefined) !== (body.postId === undefined), {
      error: "Send exactly one of reportedUserId or postId",
      path: ["reportedUserId"],
    }),
};

export type CreateReportInput = z.infer<typeof createReportSchemas.body>;

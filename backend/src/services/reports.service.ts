import { ReportStatus } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { CreateReportInput } from "../schemas/reports.schemas.js";
import { HttpError, notFound } from "../utils/http-error.js";

const reportSelect = {
  id: true,
  reportedUserId: true,
  postId: true,
  reason: true,
  status: true,
  createdAt: true,
} as const;

/** Raportează un utilizator sau o postare. Moderarea (status REVIEWED / DISMISSED) nu e expusă în API. */
export async function createReport(reporterId: string, input: CreateReportInput) {
  const { reportedUserId, postId, reason } = input;

  if (reportedUserId) {
    if (reportedUserId === reporterId) {
      throw new HttpError(400, "CANNOT_REPORT_SELF", "You cannot report yourself");
    }
    const exists = await prisma.user.findUnique({ where: { id: reportedUserId }, select: { id: true } });
    if (!exists) throw notFound("User not found");
  }

  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) throw notFound("Post not found");
    if (post.authorId === reporterId) {
      throw new HttpError(400, "CANNOT_REPORT_SELF", "You cannot report your own post");
    }
  }

  // Un singur raport deschis pe aceeași țintă de la același utilizator.
  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId,
      status: ReportStatus.OPEN,
      ...(reportedUserId ? { reportedUserId } : { postId }),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new HttpError(409, "ALREADY_REPORTED", "You already reported this and it is still under review");
  }

  return prisma.report.create({
    data: { reporterId, reportedUserId: reportedUserId ?? null, postId: postId ?? null, reason },
    select: reportSelect,
  });
}

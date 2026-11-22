import type { Request, Response } from "express";
import { currentUser } from "../middleware/require-auth.js";
import type { ValidatedRequest } from "../middleware/validate.js";
import type {
  createCommentSchemas,
  createPostSchemas,
  listPostsSchemas,
  postIdParamsSchemas,
} from "../routes/posts.routes.js";
import * as postsService from "../services/posts.service.js";
import { sendCreated, sendNoContent, sendOk, sendPaginated } from "../utils/response.js";

export async function listPosts(req: ValidatedRequest<typeof listPostsSchemas>, res: Response): Promise<void> {
  const { items, meta } = await postsService.listPosts(currentUser(req as unknown as Request).id, req.query);
  sendPaginated(res, items, meta);
}

export async function createPost(req: ValidatedRequest<typeof createPostSchemas>, res: Response): Promise<void> {
  const post = await postsService.createPost(currentUser(req).id, req.body);
  sendCreated(res, post);
}

export async function deletePost(req: ValidatedRequest<typeof postIdParamsSchemas>, res: Response): Promise<void> {
  await postsService.deletePost(currentUser(req).id, req.params.id);
  sendNoContent(res);
}

export async function likePost(req: ValidatedRequest<typeof postIdParamsSchemas>, res: Response): Promise<void> {
  const result = await postsService.likePost(currentUser(req).id, req.params.id);
  sendOk(res, result);
}

export async function unlikePost(req: ValidatedRequest<typeof postIdParamsSchemas>, res: Response): Promise<void> {
  const result = await postsService.unlikePost(currentUser(req).id, req.params.id);
  sendOk(res, result);
}

export async function listComments(req: ValidatedRequest<typeof postIdParamsSchemas>, res: Response): Promise<void> {
  const comments = await postsService.listComments(currentUser(req).id, req.params.id);
  sendOk(res, comments);
}

export async function createComment(
  req: ValidatedRequest<typeof createCommentSchemas>,
  res: Response,
): Promise<void> {
  const comment = await postsService.createComment(currentUser(req).id, req.params.id, req.body);
  sendCreated(res, comment);
}

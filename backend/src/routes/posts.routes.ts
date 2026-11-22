import { Router } from "express";
import { z } from "zod";
import {
  createComment,
  createPost,
  deletePost,
  likePost,
  listComments,
  listPosts,
  unlikePost,
} from "../controllers/posts.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { paginationQuery } from "../utils/pagination.js";

const postIdParams = z.object({
  id: z.uuid(),
});

// Permitem atât URL-uri clasice, cât și data-URI SVG (cum sunt imaginile demo din frontend), până la 100 KB.
const imageUrlSchema = z.union([
  z
    .string()
    .trim()
    .max(100_000, "imageUrl is too long")
    .transform((value) => (value === "" ? null : value)),
  z.null(),
]);

export const listPostsSchemas = {
  query: paginationQuery.extend({
    authorId: z.uuid().optional(),
    dogId: z.uuid().optional(),
  }),
};

export const createPostSchemas = {
  body: z.object({
    content: z.string().trim().min(1, "Post content cannot be empty").max(2000, "Post content is too long"),
    dogId: z.union([z.uuid(), z.null()]).optional(),
    imageUrl: imageUrlSchema.optional(),
  }),
};

export const postIdParamsSchemas = {
  params: postIdParams,
};

export const createCommentSchemas = {
  params: postIdParams,
  body: z.object({
    content: z.string().trim().min(1, "Comment cannot be empty").max(1000, "Comment is too long"),
  }),
};

export const postsRouter = Router();

postsRouter.use(requireAuth);

postsRouter.get("/", validate(listPostsSchemas), listPosts);
postsRouter.post("/", validate(createPostSchemas), createPost);
postsRouter.delete("/:id", validate(postIdParamsSchemas), deletePost);

postsRouter.post("/:id/like", validate(postIdParamsSchemas), likePost);
postsRouter.delete("/:id/like", validate(postIdParamsSchemas), unlikePost);

postsRouter.get("/:id/comments", validate(postIdParamsSchemas), listComments);
postsRouter.post("/:id/comments", validate(createCommentSchemas), createComment);

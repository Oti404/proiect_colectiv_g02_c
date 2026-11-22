import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import * as authService from "../../src/services/auth.service.js";
import * as postsService from "../../src/services/posts.service.js";
import { forbidden, notFound } from "../../src/utils/http-error.js";
import { signAccessToken } from "../../src/utils/jwt.js";

vi.mock("../../src/services/auth.service.js", () => ({
  findAuthUserById: vi.fn(),
}));

vi.mock("../../src/services/posts.service.js", () => ({
  listPosts: vi.fn(),
  createPost: vi.fn(),
  deletePost: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DOG_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "33333333-3333-4333-8333-333333333333";
const COMMENT_ID = "44444444-4444-4444-8444-444444444444";

const token = signAccessToken(USER_ID);

const findAuthUserMock = vi.mocked(authService.findAuthUserById);
const listPostsMock = vi.mocked(postsService.listPosts);
const createPostMock = vi.mocked(postsService.createPost);
const deletePostMock = vi.mocked(postsService.deletePost);
const likePostMock = vi.mocked(postsService.likePost);
const unlikePostMock = vi.mocked(postsService.unlikePost);
const listCommentsMock = vi.mocked(postsService.listComments);
const createCommentMock = vi.mocked(postsService.createComment);

const samplePostView = {
  id: POST_ID,
  authorId: USER_ID,
  dogId: DOG_ID,
  content: "Morning walk in Parcul Central!",
  imageUrl: null,
  createdAt: new Date("2026-11-11T08:00:00.000Z"),
  updatedAt: new Date("2026-11-11T08:00:00.000Z"),
  author: {
    id: USER_ID,
    firstName: "Ana",
    lastName: "Pop",
    avatarUrl: null,
    bio: null,
    approxLatitude: 46.77,
    approxLongitude: 23.59,
  },
  dog: null,
  comments: [],
  likedByUserIds: [],
  likeCount: 0,
  isLikedByMe: false,
  canDelete: true,
};

const sampleCommentView = {
  id: COMMENT_ID,
  postId: POST_ID,
  userId: USER_ID,
  content: "Great walk!",
  createdAt: new Date("2026-11-11T08:10:00.000Z"),
  updatedAt: new Date("2026-11-11T08:10:00.000Z"),
  author: samplePostView.author,
};

describe("posts routes", () => {
  beforeEach(() => {
    findAuthUserMock.mockResolvedValue({
      id: USER_ID,
      email: "ana@demo.local",
      firstName: "Ana",
      lastName: "Pop",
      avatarUrl: null,
      approxLatitude: 46.77,
      approxLongitude: 23.59,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/posts", () => {
    it("requires authentication", async () => {
      const res = await request(app).get("/api/posts");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns paginated posts", async () => {
      listPostsMock.mockResolvedValue({
        items: [samplePostView],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get("/api/posts?page=1&pageSize=10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
      expect(listPostsMock).toHaveBeenCalledWith(USER_ID, { page: 1, pageSize: 10 });
    });

    it("rejects invalid authorId query param", async () => {
      const res = await request(app)
        .get("/api/posts?authorId=not-a-uuid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/posts", () => {
    it("creates a post and returns 201", async () => {
      createPostMock.mockResolvedValue(samplePostView);

      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          content: "  Morning walk in Parcul Central!  ",
          dogId: DOG_ID,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(POST_ID);
      expect(createPostMock).toHaveBeenCalledWith(USER_ID, {
        content: "Morning walk in Parcul Central!",
        dogId: DOG_ID,
      });
    });

    it("rejects empty post content", async () => {
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(createPostMock).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/posts/:id", () => {
    it("deletes own post and returns 204", async () => {
      deletePostMock.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/posts/${POST_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(deletePostMock).toHaveBeenCalledWith(USER_ID, POST_ID);
    });

    it("returns 403 when trying to delete another user's post", async () => {
      deletePostMock.mockRejectedValue(forbidden("You can only delete your own posts"));

      const res = await request(app)
        .delete(`/api/posts/${POST_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST & DELETE /api/posts/:id/like", () => {
    it("likes a post and returns 200", async () => {
      likePostMock.mockResolvedValue({ postId: POST_ID, likeCount: 1, isLikedByMe: true });

      const res = await request(app)
        .post(`/api/posts/${POST_ID}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ postId: POST_ID, likeCount: 1, isLikedByMe: true });
      expect(likePostMock).toHaveBeenCalledWith(USER_ID, POST_ID);
    });

    it("unlikes a post and returns 200", async () => {
      unlikePostMock.mockResolvedValue({ postId: POST_ID, likeCount: 0, isLikedByMe: false });

      const res = await request(app)
        .delete(`/api/posts/${POST_ID}/like`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ postId: POST_ID, likeCount: 0, isLikedByMe: false });
      expect(unlikePostMock).toHaveBeenCalledWith(USER_ID, POST_ID);
    });
  });

  describe("GET & POST /api/posts/:id/comments", () => {
    it("lists comments for a post", async () => {
      listCommentsMock.mockResolvedValue([sampleCommentView]);

      const res = await request(app)
        .get(`/api/posts/${POST_ID}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(listCommentsMock).toHaveBeenCalledWith(USER_ID, POST_ID);
    });

    it("adds a comment and returns 201", async () => {
      createCommentMock.mockResolvedValue(sampleCommentView);

      const res = await request(app)
        .post(`/api/posts/${POST_ID}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "  Great walk!  " });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(COMMENT_ID);
      expect(createCommentMock).toHaveBeenCalledWith(USER_ID, POST_ID, { content: "Great walk!" });
    });

    it("returns 404 when commenting on a missing or blocked post", async () => {
      createCommentMock.mockRejectedValue(notFound("Post not found"));

      const res = await request(app)
        .post(`/api/posts/${POST_ID}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});

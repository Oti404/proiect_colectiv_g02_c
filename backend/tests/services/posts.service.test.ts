import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import {
  createComment,
  createPost,
  deletePost,
  likePost,
  listComments,
  listPosts,
  unlikePost,
} from "../../src/services/posts.service.js";

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const BLOCKED_USER_ID = "33333333-3333-4333-8333-333333333333";
const DOG_ID = "44444444-4444-4444-8444-444444444444";
const BREED_ID = "55555555-5555-4555-8555-555555555555";
const POST_ID = "66666666-6666-4666-8666-666666666666";
const COMMENT_ID = "77777777-7777-4777-8777-777777777777";

const sampleAuthor = {
  id: VIEWER_ID,
  firstName: "Ana",
  lastName: "Pop",
  avatarUrl: null,
  bio: "Dog lover",
  approxLatitude: 46.77,
  approxLongitude: 23.59,
};

const otherAuthor = {
  id: OTHER_USER_ID,
  firstName: "Elena",
  lastName: "Rusu",
  avatarUrl: null,
  bio: null,
  approxLatitude: 46.77,
  approxLongitude: 23.62,
};

const blockedAuthor = {
  id: BLOCKED_USER_ID,
  firstName: "Blocked",
  lastName: "User",
  avatarUrl: null,
  bio: null,
  approxLatitude: 46.75,
  approxLongitude: 23.55,
};

const sampleDog = {
  id: DOG_ID,
  ownerId: VIEWER_ID,
  breedId: BREED_ID,
  name: "Rex",
  birthDate: new Date("2021-03-12T00:00:00.000Z"),
  sex: "MALE",
  size: "LARGE",
  temperament: "FRIENDLY",
  neutered: true,
  photoUrl: null,
  breed: {
    id: BREED_ID,
    name: "Labrador Retriever",
    size: "LARGE",
  },
};

const sampleRawPost = {
  id: POST_ID,
  authorId: VIEWER_ID,
  dogId: DOG_ID,
  content: "Morning walk in Parcul Central!",
  imageUrl: null,
  createdAt: new Date("2026-11-11T08:00:00.000Z"),
  updatedAt: new Date("2026-11-11T08:00:00.000Z"),
  author: sampleAuthor,
  dog: sampleDog,
  likes: [
    { userId: VIEWER_ID, createdAt: new Date("2026-11-11T08:05:00.000Z") },
    { userId: OTHER_USER_ID, createdAt: new Date("2026-11-11T08:06:00.000Z") },
    { userId: BLOCKED_USER_ID, createdAt: new Date("2026-11-11T08:07:00.000Z") },
  ],
  comments: [
    {
      id: COMMENT_ID,
      postId: POST_ID,
      userId: OTHER_USER_ID,
      content: "So cute!",
      createdAt: new Date("2026-11-11T08:10:00.000Z"),
      updatedAt: new Date("2026-11-11T08:10:00.000Z"),
      user: otherAuthor,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      postId: POST_ID,
      userId: BLOCKED_USER_ID,
      content: "Hidden comment",
      createdAt: new Date("2026-11-11T08:11:00.000Z"),
      updatedAt: new Date("2026-11-11T08:11:00.000Z"),
      user: blockedAuthor,
    },
  ],
};

function fakeDb(mocks: {
  post?: Record<string, unknown>;
  dog?: Record<string, unknown>;
  like?: Record<string, unknown>;
  comment?: Record<string, unknown>;
  block?: Record<string, unknown>;
}): DbClient {
  return mocks as unknown as DbClient;
}

describe("posts.service", () => {
  describe("listPosts", () => {
    it("excludes blocked authors, blocked likes, and blocked comments, and computes flags", async () => {
      const findManyBlocks = vi.fn().mockResolvedValue([{ blockerId: VIEWER_ID, blockedId: BLOCKED_USER_ID }]);
      const countPosts = vi.fn().mockResolvedValue(1);
      const findManyPosts = vi.fn().mockResolvedValue([sampleRawPost]);

      const result = await listPosts(
        VIEWER_ID,
        { page: 1, pageSize: 20 },
        fakeDb({
          block: { findMany: findManyBlocks },
          post: { count: countPosts, findMany: findManyPosts },
        }),
      );

      expect(countPosts).toHaveBeenCalledWith({
        where: { authorId: { notIn: [BLOCKED_USER_ID] } },
      });
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.likeCount).toBe(2);
      expect(result.items[0]?.likedByUserIds).toEqual([VIEWER_ID, OTHER_USER_ID]);
      expect(result.items[0]?.isLikedByMe).toBe(true);
      expect(result.items[0]?.canDelete).toBe(true);
      expect(result.items[0]?.comments).toHaveLength(1);
      expect(result.items[0]?.comments[0]?.author.id).toBe(OTHER_USER_ID);
    });

    it("returns an empty page immediately when filtering by a blocked authorId", async () => {
      const findManyBlocks = vi.fn().mockResolvedValue([{ blockerId: BLOCKED_USER_ID, blockedId: VIEWER_ID }]);
      const countPosts = vi.fn();
      const findManyPosts = vi.fn();

      const result = await listPosts(
        VIEWER_ID,
        { page: 1, pageSize: 10, authorId: BLOCKED_USER_ID },
        fakeDb({
          block: { findMany: findManyBlocks },
          post: { count: countPosts, findMany: findManyPosts },
        }),
      );

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(countPosts).not.toHaveBeenCalled();
    });
  });

  describe("createPost", () => {
    it("creates a post with an owned dog tag", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: VIEWER_ID });
      const create = vi.fn().mockResolvedValue({ ...sampleRawPost, likes: [], comments: [] });

      const result = await createPost(
        VIEWER_ID,
        { content: "Morning walk in Parcul Central!", dogId: DOG_ID, imageUrl: null },
        fakeDb({
          dog: { findUnique: findDog },
          post: { create },
        }),
      );

      expect(result.id).toBe(POST_ID);
      expect(result.dog?.id).toBe(DOG_ID);
      expect(result.canDelete).toBe(true);
    });

    it("throws 404 when tagged dog does not exist", async () => {
      const findDog = vi.fn().mockResolvedValue(null);
      const create = vi.fn();

      await expect(
        createPost(
          VIEWER_ID,
          { content: "Test", dogId: DOG_ID },
          fakeDb({ dog: { findUnique: findDog }, post: { create } }),
        ),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(create).not.toHaveBeenCalled();
    });

    it("throws 403 when trying to tag another user's dog", async () => {
      const findDog = vi.fn().mockResolvedValue({ id: DOG_ID, ownerId: OTHER_USER_ID });
      const create = vi.fn();

      await expect(
        createPost(
          VIEWER_ID,
          { content: "Test", dogId: DOG_ID },
          fakeDb({ dog: { findUnique: findDog }, post: { create } }),
        ),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("deletePost", () => {
    it("deletes own post", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: VIEWER_ID });
      const del = vi.fn().mockResolvedValue({});

      await deletePost(VIEWER_ID, POST_ID, fakeDb({ post: { findUnique, delete: del } }));

      expect(del).toHaveBeenCalledWith({ where: { id: POST_ID } });
    });

    it("throws 404 when post does not exist", async () => {
      const findUnique = vi.fn().mockResolvedValue(null);

      await expect(deletePost(VIEWER_ID, POST_ID, fakeDb({ post: { findUnique } }))).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
      });
    });

    it("throws 403 when user is not the author", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: OTHER_USER_ID });
      const del = vi.fn();

      await expect(
        deletePost(VIEWER_ID, POST_ID, fakeDb({ post: { findUnique, delete: del } })),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe("likePost & unlikePost", () => {
    it("likes a visible post idempotently and returns updated count", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: OTHER_USER_ID });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const findManyBlocks = vi.fn().mockResolvedValue([]);
      const upsert = vi.fn().mockResolvedValue({});
      const count = vi.fn().mockResolvedValue(3);

      const res = await likePost(
        VIEWER_ID,
        POST_ID,
        fakeDb({
          post: { findUnique },
          block: { findFirst: findFirstBlock, findMany: findManyBlocks },
          like: { upsert, count },
        }),
      );

      expect(res).toEqual({ postId: POST_ID, likeCount: 3, isLikedByMe: true });
      expect(upsert).toHaveBeenCalledWith({
        where: { userId_postId: { userId: VIEWER_ID, postId: POST_ID } },
        update: {},
        create: { userId: VIEWER_ID, postId: POST_ID },
      });
    });

    it("throws 404 when liking a post from a blocked author", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: BLOCKED_USER_ID });
      const findFirstBlock = vi.fn().mockResolvedValue({ blockerId: BLOCKED_USER_ID });

      await expect(
        likePost(
          VIEWER_ID,
          POST_ID,
          fakeDb({
            post: { findUnique },
            block: { findFirst: findFirstBlock },
          }),
        ),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    });

    it("unlikes a visible post and returns updated count", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: OTHER_USER_ID });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const findManyBlocks = vi.fn().mockResolvedValue([]);
      const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
      const count = vi.fn().mockResolvedValue(2);

      const res = await unlikePost(
        VIEWER_ID,
        POST_ID,
        fakeDb({
          post: { findUnique },
          block: { findFirst: findFirstBlock, findMany: findManyBlocks },
          like: { deleteMany, count },
        }),
      );

      expect(res).toEqual({ postId: POST_ID, likeCount: 2, isLikedByMe: false });
      expect(deleteMany).toHaveBeenCalledWith({
        where: { userId: VIEWER_ID, postId: POST_ID },
      });
    });
  });

  describe("listComments & createComment", () => {
    it("lists comments excluding blocked users", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: OTHER_USER_ID });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const findManyBlocks = vi.fn().mockResolvedValue([{ blockerId: VIEWER_ID, blockedId: BLOCKED_USER_ID }]);
      const findManyComments = vi.fn().mockResolvedValue([sampleRawPost.comments[0]]);

      const comments = await listComments(
        VIEWER_ID,
        POST_ID,
        fakeDb({
          post: { findUnique },
          block: { findFirst: findFirstBlock, findMany: findManyBlocks },
          comment: { findMany: findManyComments },
        }),
      );

      expect(comments).toHaveLength(1);
      expect(comments[0]?.author.firstName).toBe("Elena");
      expect(findManyComments).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId: POST_ID, userId: { notIn: [BLOCKED_USER_ID] } },
        }),
      );
    });

    it("creates a comment on a visible post", async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: POST_ID, authorId: OTHER_USER_ID });
      const findFirstBlock = vi.fn().mockResolvedValue(null);
      const create = vi.fn().mockResolvedValue(sampleRawPost.comments[0]);

      const comment = await createComment(
        VIEWER_ID,
        POST_ID,
        { content: "So cute!" },
        fakeDb({
          post: { findUnique },
          block: { findFirst: findFirstBlock },
          comment: { create },
        }),
      );

      expect(comment.id).toBe(COMMENT_ID);
      expect(comment.content).toBe("So cute!");
      expect(comment.author.id).toBe(OTHER_USER_ID);
    });
  });
});

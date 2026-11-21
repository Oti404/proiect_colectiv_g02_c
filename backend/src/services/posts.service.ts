import type { DbClient } from "../lib/prisma.js";
import { prisma } from "../lib/prisma.js";
import { forbidden, notFound } from "../utils/http-error.js";
import {
  buildPaginationMeta,
  toPrismaPagination,
  type PaginationMeta,
  type PaginationParams,
} from "../utils/pagination.js";
import { getBlockedUserIds, isBlockedEitherWay } from "./block.service.js";

const publicAuthorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
} as const;

const taggedDogSelect = {
  id: true,
  ownerId: true,
  breedId: true,
  name: true,
  birthDate: true,
  sex: true,
  size: true,
  temperament: true,
  neutered: true,
  photoUrl: true,
  breed: {
    select: {
      id: true,
      name: true,
      size: true,
    },
  },
} as const;

const commentInclude = {
  user: {
    select: publicAuthorSelect,
  },
} as const;

const postInclude = {
  author: {
    select: publicAuthorSelect,
  },
  dog: {
    select: taggedDogSelect,
  },
  likes: {
    select: {
      userId: true,
      createdAt: true,
    },
  },
  comments: {
    include: commentInclude,
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} as const;

export interface ListPostsQuery extends PaginationParams {
  authorId?: string;
  dogId?: string;
}

export interface CreatePostInput {
  content: string;
  dogId?: string | null;
  imageUrl?: string | null;
}

export interface CreateCommentInput {
  content: string;
}

export interface CommentView {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    approxLatitude: number;
    approxLongitude: number;
  };
}

export interface PostView {
  id: string;
  authorId: string;
  dogId: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    approxLatitude: number;
    approxLongitude: number;
  };
  dog: {
    id: string;
    ownerId: string;
    breedId: string;
    name: string;
    birthDate: Date | null;
    sex: string;
    size: string;
    temperament: string;
    neutered: boolean;
    photoUrl: string | null;
    breed: {
      id: string;
      name: string;
      size: string;
    };
  } | null;
  comments: CommentView[];
  likedByUserIds: string[];
  likeCount: number;
  isLikedByMe: boolean;
  canDelete: boolean;
}

type RawPostWithRelations = {
  id: string;
  authorId: string;
  dogId: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: PostView["author"];
  dog: PostView["dog"];
  likes: { userId: string; createdAt: Date }[];
  comments: {
    id: string;
    postId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: CommentView["author"];
  }[];
};

function toCommentView(raw: RawPostWithRelations["comments"][number]): CommentView {
  return {
    id: raw.id,
    postId: raw.postId,
    userId: raw.userId,
    content: raw.content,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.user,
  };
}

function toPostView(raw: RawPostWithRelations, viewerId: string, blockedSet: Set<string>): PostView {
  const visibleLikes = raw.likes.filter((like) => !blockedSet.has(like.userId));
  const likedByUserIds = visibleLikes.map((like) => like.userId);
  const visibleComments = raw.comments
    .filter((comment) => !blockedSet.has(comment.userId))
    .map(toCommentView);

  return {
    id: raw.id,
    authorId: raw.authorId,
    dogId: raw.dogId,
    content: raw.content,
    imageUrl: raw.imageUrl,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.author,
    dog: raw.dog,
    comments: visibleComments,
    likedByUserIds,
    likeCount: likedByUserIds.length,
    isLikedByMe: likedByUserIds.includes(viewerId),
    canDelete: raw.authorId === viewerId,
  };
}

async function getVisiblePostOrThrow(
  viewerId: string,
  postId: string,
  db: DbClient,
): Promise<{ id: string; authorId: string }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post || (await isBlockedEitherWay(viewerId, post.authorId, db))) {
    throw notFound("Post not found");
  }
  return post;
}

export async function listPosts(
  viewerId: string,
  query: ListPostsQuery,
  db: DbClient = prisma,
): Promise<{ items: PostView[]; meta: PaginationMeta }> {
  const blockedIds = await getBlockedUserIds(viewerId, db);
  const blockedSet = new Set(blockedIds);

  if (query.authorId && blockedSet.has(query.authorId)) {
    return {
      items: [],
      meta: buildPaginationMeta(query, 0),
    };
  }

  const where = {
    ...(query.authorId
      ? { authorId: query.authorId }
      : blockedIds.length > 0
        ? { authorId: { notIn: blockedIds } }
        : {}),
    ...(query.dogId ? { dogId: query.dogId } : {}),
  };

  const [total, posts] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...toPrismaPagination(query),
    }),
  ]);

  const items = (posts as unknown as RawPostWithRelations[]).map((post) =>
    toPostView(post, viewerId, blockedSet),
  );

  return {
    items,
    meta: buildPaginationMeta(query, total),
  };
}

export async function createPost(
  viewerId: string,
  input: CreatePostInput,
  db: DbClient = prisma,
): Promise<PostView> {
  if (input.dogId) {
    const dog = await db.dog.findUnique({
      where: { id: input.dogId },
      select: { id: true, ownerId: true },
    });
    if (!dog) {
      throw notFound("Dog not found");
    }
    if (dog.ownerId !== viewerId) {
      throw forbidden("You can only tag your own dogs in a post");
    }
  }

  const created = await db.post.create({
    data: {
      authorId: viewerId,
      dogId: input.dogId ?? null,
      content: input.content,
      imageUrl: input.imageUrl ?? null,
    },
    include: postInclude,
  });

  return toPostView(created as unknown as RawPostWithRelations, viewerId, new Set());
}

export async function deletePost(
  viewerId: string,
  postId: string,
  db: DbClient = prisma,
): Promise<void> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    throw notFound("Post not found");
  }
  if (post.authorId !== viewerId) {
    throw forbidden("You can only delete your own posts");
  }

  await db.post.delete({
    where: { id: postId },
  });
}

export async function likePost(
  viewerId: string,
  postId: string,
  db: DbClient = prisma,
): Promise<{ postId: string; likeCount: number; isLikedByMe: boolean }> {
  await getVisiblePostOrThrow(viewerId, postId, db);

  await db.like.upsert({
    where: {
      userId_postId: {
        userId: viewerId,
        postId,
      },
    },
    update: {},
    create: {
      userId: viewerId,
      postId,
    },
  });

  const blockedIds = await getBlockedUserIds(viewerId, db);
  const likeCount = await db.like.count({
    where: {
      postId,
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
    },
  });

  return {
    postId,
    likeCount,
    isLikedByMe: true,
  };
}

export async function unlikePost(
  viewerId: string,
  postId: string,
  db: DbClient = prisma,
): Promise<{ postId: string; likeCount: number; isLikedByMe: boolean }> {
  await getVisiblePostOrThrow(viewerId, postId, db);

  await db.like.deleteMany({
    where: {
      userId: viewerId,
      postId,
    },
  });

  const blockedIds = await getBlockedUserIds(viewerId, db);
  const likeCount = await db.like.count({
    where: {
      postId,
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
    },
  });

  return {
    postId,
    likeCount,
    isLikedByMe: false,
  };
}

export async function listComments(
  viewerId: string,
  postId: string,
  db: DbClient = prisma,
): Promise<CommentView[]> {
  await getVisiblePostOrThrow(viewerId, postId, db);

  const blockedIds = await getBlockedUserIds(viewerId, db);
  const comments = await db.comment.findMany({
    where: {
      postId,
      ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
    },
    include: commentInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return (comments as unknown as RawPostWithRelations["comments"]).map(toCommentView);
}

export async function createComment(
  viewerId: string,
  postId: string,
  input: CreateCommentInput,
  db: DbClient = prisma,
): Promise<CommentView> {
  await getVisiblePostOrThrow(viewerId, postId, db);

  const comment = await db.comment.create({
    data: {
      postId,
      userId: viewerId,
      content: input.content,
    },
    include: commentInclude,
  });

  return toCommentView(comment as unknown as RawPostWithRelations["comments"][number]);
}

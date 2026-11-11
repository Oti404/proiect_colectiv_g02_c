import { Dog } from './dog.model';
import { User } from './user.model';

export interface Post {
  id: string;
  authorId: string;
  dogId: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likedByUserIds: string[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface CommentView extends Comment {
  author: User;
}

export interface PostView {
  post: Post;
  author: User;
  dog: Dog | null;
  comments: CommentView[];
  likeCount: number;
  isLikedByMe: boolean;
  canDelete: boolean;
}

export interface CreatePostPayload {
  content: string;
  dogId: string | null;
  imageUrl: string | null;
}

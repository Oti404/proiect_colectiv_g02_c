import { Injectable, inject } from '@angular/core';
import { ActionResult, Comment, CommentView, CreatePostPayload, Post, PostView } from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);

  getFeedPosts(authorIdFilter?: string): PostView[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    const state = this.store.state();

    return state.posts
      .filter((post) => {
        if (authorIdFilter && post.authorId !== authorIdFilter) {
          return false;
        }
        if (post.authorId !== me.id && this.userService.isBlockedEitherWay(me.id, post.authorId)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((post) => {
        const author = state.users.find((u) => u.id === post.authorId);
        if (!author) {
          return null;
        }
        const dog = post.dogId ? (state.dogs.find((d) => d.id === post.dogId) ?? null) : null;
        const comments: CommentView[] = state.comments
          .filter((c) => c.postId === post.id)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((c) => {
            const commentAuthor = state.users.find((u) => u.id === c.userId);
            return commentAuthor ? { ...c, author: commentAuthor } : null;
          })
          .filter((c): c is CommentView => c !== null);

        return {
          post,
          author,
          dog,
          comments,
          likeCount: post.likedByUserIds.length,
          isLikedByMe: post.likedByUserIds.includes(me.id),
          canDelete: post.authorId === me.id,
        };
      })
      .filter((item): item is PostView => item !== null);
  }

  createPost(payload: CreatePostPayload): ActionResult<Post> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in to post.' };
    }
    const content = payload.content.trim();
    if (!content) {
      return { ok: false, error: 'Post content cannot be empty.' };
    }

    const post: Post = {
      id: this.store.allocateId('post'),
      authorId: me.id,
      dogId: payload.dogId || null,
      content,
      imageUrl: payload.imageUrl || null,
      createdAt: new Date().toISOString(),
      likedByUserIds: [],
    };

    this.store.updateState((draft) => {
      draft.posts.unshift(post);
      return draft;
    });

    return { ok: true, data: post };
  }

  deletePost(postId: string): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const post = this.store.state().posts.find((p) => p.id === postId);
    if (!post) {
      return { ok: false, error: 'Post not found.' };
    }
    if (post.authorId !== me.id) {
      return { ok: false, error: 'You can only delete your own posts.' };
    }

    this.store.updateState((draft) => {
      draft.posts = draft.posts.filter((p) => p.id !== postId);
      draft.comments = draft.comments.filter((c) => c.postId !== postId);
      return draft;
    });

    return { ok: true };
  }

  toggleLike(postId: string): void {
    const me = this.auth.currentUser();
    if (!me) {
      return;
    }
    this.store.updateState((draft) => {
      const post = draft.posts.find((p) => p.id === postId);
      if (post) {
        const idx = post.likedByUserIds.indexOf(me.id);
        if (idx >= 0) {
          post.likedByUserIds.splice(idx, 1);
        } else {
          post.likedByUserIds.push(me.id);
        }
      }
      return draft;
    });
  }

  addComment(postId: string, content: string): ActionResult<Comment> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const text = content.trim();
    if (!text) {
      return { ok: false, error: 'Comment cannot be empty.' };
    }
    const postExists = this.store.state().posts.some((p) => p.id === postId);
    if (!postExists) {
      return { ok: false, error: 'Post not found.' };
    }

    const comment: Comment = {
      id: this.store.allocateId('comment'),
      postId,
      userId: me.id,
      content: text,
      createdAt: new Date().toISOString(),
    };

    this.store.updateState((draft) => {
      draft.comments.push(comment);
      return draft;
    });

    return { ok: true, data: comment };
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DEMO_POST_IMAGES } from '../../core/mock-data/demo-images';
import { PostView, User } from '../../core/models';
import { DogService, FeedService } from '../../core/services';

@Component({
  selector: 'app-feed-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './feed-page.html',
})
export class FeedPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly feedService = inject(FeedService);
  private readonly dogService = inject(DogService);

  readonly demoImages = DEMO_POST_IMAGES;
  readonly myDogs = this.dogService.myDogs;
  readonly posts = computed<PostView[]>(() => this.feedService.getFeedPosts());

  readonly postError = signal<string | null>(null);
  readonly postSuccess = signal<string | null>(null);
  readonly confirmDeletePostId = signal<string | null>(null);
  readonly commentDrafts = signal<Record<string, string>>({});
  readonly commentErrors = signal<Record<string, string>>({});

  readonly postForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(500)]],
    dogId: [''],
    imageUrl: [''],
  });

  constructor() {
    effect(() => {
      const validIds = new Set(this.myDogs().map((d) => d.id));
      const selectedDogId = this.postForm.controls.dogId.value;
      if (selectedDogId && !validIds.has(selectedDogId)) {
        this.postForm.controls.dogId.setValue('');
      }
    });
  }

  onCreatePost(): void {
    this.postError.set(null);
    this.postSuccess.set(null);

    const raw = this.postForm.getRawValue();
    const result = this.feedService.createPost({
      content: raw.content,
      dogId: raw.dogId || null,
      imageUrl: raw.imageUrl || null,
    });

    if (!result.ok) {
      this.postForm.controls.content.markAsTouched();
      this.postError.set(result.error ?? 'Could not create post.');
      return;
    }

    this.postForm.reset({
      content: '',
      dogId: '',
      imageUrl: '',
    });
    this.postSuccess.set('Post published to the community feed.');
  }

  onToggleLike(postId: string): void {
    this.feedService.toggleLike(postId);
  }

  requestDeletePost(postId: string): void {
    this.confirmDeletePostId.set(postId);
    this.postError.set(null);
    this.postSuccess.set(null);
  }

  cancelDeletePost(): void {
    this.confirmDeletePostId.set(null);
  }

  confirmDeletePost(postId: string): void {
    const result = this.feedService.deletePost(postId);
    this.confirmDeletePostId.set(null);
    if (!result.ok) {
      this.postError.set(result.error ?? 'Could not delete post.');
      return;
    }
    this.postSuccess.set('Post deleted.');
  }

  getCommentDraft(postId: string): string {
    return this.commentDrafts()[postId] ?? '';
  }

  getCommentError(postId: string): string | null {
    return this.commentErrors()[postId] ?? null;
  }

  onCommentInput(postId: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = input ? input.value : '';
    this.commentDrafts.update((prev) => ({ ...prev, [postId]: value }));
    if (this.commentErrors()[postId]) {
      this.commentErrors.update((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    }
  }

  onAddComment(postId: string, event: Event): void {
    event.preventDefault();
    const draft = this.getCommentDraft(postId);
    const result = this.feedService.addComment(postId, draft);
    if (!result.ok) {
      this.commentErrors.update((prev) => ({
        ...prev,
        [postId]: result.error ?? 'Comment cannot be empty.',
      }));
      return;
    }

    this.commentDrafts.update((prev) => ({ ...prev, [postId]: '' }));
    this.commentErrors.update((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  }

  getFullName(user: User): string {
    return `${user.firstName} ${user.lastName}`;
  }

  getInitials(user: User): string {
    const first = user.firstName.trim().charAt(0).toUpperCase();
    const last = user.lastName.trim().charAt(0).toUpperCase();
    return `${first}${last}` || '?';
  }
}

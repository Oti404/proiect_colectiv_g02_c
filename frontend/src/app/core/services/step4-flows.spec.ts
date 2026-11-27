import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { FeedPageComponent } from '../../features/feed/feed-page';
import { DEMO_POST_IMAGES } from '../mock-data/demo-images';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { FeedService } from './feed.service';
import { UserService } from './user.service';

describe('STEP 4 Social Feed Flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  // Îngrijirea (Care) e pe API acum (testată în care.service.spec.ts)

  it('supports feed posting, likes across accounts, comments, owner-only delete, block filtering, persistence, and reset', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const feedService = TestBed.inject(FeedService);
    const userService = TestBed.inject(UserService);

    auth.enterDemo('user-ana');
    const feedFixture = TestBed.createComponent(FeedPageComponent);
    await feedFixture.whenStable();

    // Empty post validation
    feedFixture.componentInstance.postForm.controls.content.setValue('   ');
    feedFixture.componentInstance.onCreatePost();
    expect(feedFixture.componentInstance.postError()).toBe('Post content cannot be empty.');

    // Create a post with tagged dog and demo image
    feedFixture.componentInstance.postForm.setValue({
      content: 'Sunny walk in Parcul Central with Rex!',
      dogId: 'dog-rex',
      imageUrl: DEMO_POST_IMAGES[0]!.dataUri,
    });
    feedFixture.componentInstance.onCreatePost();
    await feedFixture.whenStable();

    const createdView = feedService
      .getFeedPosts()
      .find((p) => p.post.content === 'Sunny walk in Parcul Central with Rex!');
    expect(createdView).toBeDefined();
    expect(createdView?.dog?.id).toBe('dog-rex');
    expect(createdView?.post.imageUrl).toBe(DEMO_POST_IMAGES[0]!.dataUri);
    const createdPostId = createdView!.post.id;

    // Empty comment validation + valid comment
    const emptyComment = feedService.addComment(createdPostId, '   ');
    expect(emptyComment.ok).toBe(false);

    // Switch to Elena: can like & comment, cannot delete Ana's post
    expect(auth.switchDemoAccount('user-elena').ok).toBe(true);
    await feedFixture.whenStable();

    const elenaViewBefore = feedService.getFeedPosts().find((p) => p.post.id === createdPostId);
    expect(elenaViewBefore?.canDelete).toBe(false);
    expect(elenaViewBefore?.isLikedByMe).toBe(false);
    expect(feedService.deletePost(createdPostId).ok).toBe(false);

    feedService.toggleLike(createdPostId);
    const elenaComment = feedService.addComment(
      createdPostId,
      'Save some energy for the fetch session!',
    );
    expect(elenaComment.ok).toBe(true);

    const elenaViewAfter = feedService.getFeedPosts().find((p) => p.post.id === createdPostId);
    expect(elenaViewAfter?.likeCount).toBe(1);
    expect(elenaViewAfter?.isLikedByMe).toBe(true);
    expect(elenaViewAfter?.comments.some((c) => c.userId === 'user-elena')).toBe(true);

    // Switch back to Ana and like, then check mutual block filtering
    expect(auth.switchDemoAccount('user-ana').ok).toBe(true);
    feedService.toggleLike(createdPostId);
    const anaLiked = feedService.getFeedPosts().find((p) => p.post.id === createdPostId);
    expect(anaLiked?.likeCount).toBe(2);
    expect(anaLiked?.isLikedByMe).toBe(true);

    // Block Elena -> Elena's posts disappear from Ana's feed
    expect(userService.blockUser('user-elena').ok).toBe(true);
    await feedFixture.whenStable();
    expect(feedService.getFeedPosts().some((p) => p.author.id === 'user-elena')).toBe(false);

    // Mutual check: Elena also does not see Ana's posts while blocked
    auth.switchDemoAccount('user-elena');
    expect(feedService.getFeedPosts().some((p) => p.author.id === 'user-ana')).toBe(false);

    // Unblock restores visibility & persistence check across simulated browser reload
    auth.switchDemoAccount('user-ana');
    userService.unblockUser('user-elena');
    expect(feedService.getFeedPosts().some((p) => p.author.id === 'user-elena')).toBe(true);

    // Verify localStorage persisted posts and likes
    const rawSaved = window.localStorage.getItem(DEMO_STORAGE_KEY);
    expect(rawSaved).toContain('Sunny walk in Parcul Central with Rex!');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const reloadedFeed = TestBed.inject(FeedService);
    const reloadedPost = reloadedFeed.getFeedPosts().find((p) => p.post.id === createdPostId);
    expect(reloadedPost).toBeDefined();
    expect(reloadedPost?.likeCount).toBe(2);
    expect(reloadedPost?.comments.length).toBe(1);

    // Owner deletes her own post
    expect(reloadedFeed.deletePost(createdPostId).ok).toBe(true);
    expect(reloadedFeed.getFeedPosts().some((p) => p.post.id === createdPostId)).toBe(false);

    // Reset Demo Data clears custom mutations and signs out
    TestBed.inject(DemoStateService).resetDemoData();
    expect(TestBed.inject(DemoAuthService).currentUser()).toBeNull();
    TestBed.inject(DemoAuthService).enterDemo('user-ana');
    expect(reloadedFeed.getFeedPosts().some((p) => p.post.id === 'post-1')).toBe(true);
    expect(reloadedFeed.getFeedPosts().some((p) => p.post.id === createdPostId)).toBe(false);
  });
});

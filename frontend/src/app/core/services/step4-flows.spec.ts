import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { CarePageComponent } from '../../features/care/care-page';
import { FeedPageComponent } from '../../features/feed/feed-page';
import { DEMO_POST_IMAGES } from '../mock-data/demo-images';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { CareService, MEDICAL_DISCLAIMER_TEXT } from './care.service';
import { DemoAuthService } from './demo-auth.service';
import { DogService } from './dog.service';
import { FeedService } from './feed.service';
import { UserService } from './user.service';

describe('STEP 4 Care & Social Feed Flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('syncs Profile dog additions/removals into Care, renders personalized tips/reminders/weight chart, and manages health records CRUD', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const dogService = TestBed.inject(DogService);
    const careService = TestBed.inject(CareService);

    // Ana starts with Rex (dog-rex) and Bella (dog-bella)
    auth.enterDemo('user-ana');

    const careFixture = TestBed.createComponent(CarePageComponent);
    await careFixture.whenStable();

    expect(careFixture.componentInstance.selectedDog()?.id).toBe('dog-rex');
    expect(careFixture.componentInstance.dailyTip()?.weatherLabel).toContain('Demo Weather');
    expect((careFixture.nativeElement as HTMLElement).textContent).toContain(
      MEDICAL_DISCLAIMER_TEXT,
    );

    // Reminders for Rex include DUE_SOON ('2026-11-16' and '2026-11-20')
    const rexReminders = careService.getReminders('dog-rex');
    expect(rexReminders.some((r) => r.status === 'DUE_SOON')).toBe(true);

    // Reminders for Bella include FUTURE ('2026-12-01')
    const bellaReminders = careService.getReminders('dog-bella');
    expect(bellaReminders.some((r) => r.status === 'FUTURE')).toBe(true);

    // Weight history initially has 3 points for Rex
    expect(careFixture.componentInstance.weightChart().points.length).toBe(3);

    // Ownership enforcement: Ana cannot add or delete records for Bogdan's dog (dog-max)
    const unauthorizedAdd = careService.addHealthRecord('dog-max', {
      type: 'VET_VISIT',
      title: 'Unauthorized Checkup',
      date: '2026-11-11',
      nextDueDate: null,
      weightKg: null,
      notes: null,
    });
    expect(unauthorizedAdd.ok).toBe(false);
    expect(careService.removeHealthRecord('hr-9').ok).toBe(false);

    // Validation: nextDueDate before date is rejected, weight <= 0 is rejected
    const badDue = careService.addHealthRecord('dog-rex', {
      type: 'VACCINE',
      title: 'Invalid Date Vaccine',
      date: '2026-11-11',
      nextDueDate: '2026-11-01',
      weightKg: null,
      notes: null,
    });
    expect(badDue.ok).toBe(false);

    const badWeight = careService.addHealthRecord('dog-rex', {
      type: 'WEIGHT',
      title: 'Zero Weight',
      date: '2026-11-11',
      nextDueDate: null,
      weightKg: 0,
      notes: null,
    });
    expect(badWeight.ok).toBe(false);

    // Add overdue reminder + new weight entry for Rex
    const overdueRes = careService.addHealthRecord('dog-rex', {
      type: 'DEWORMING',
      title: 'Missed Heartworm Dose',
      date: '2026-10-01',
      nextDueDate: '2026-11-05',
      weightKg: null,
      notes: 'Catch up soon',
    });
    expect(overdueRes.ok).toBe(true);
    expect(careService.getReminders('dog-rex').some((r) => r.status === 'OVERDUE')).toBe(true);

    const weightRes = careService.addHealthRecord('dog-rex', {
      type: 'WEIGHT',
      title: 'November weigh-in',
      date: '2026-11-11',
      nextDueDate: null,
      weightKg: 32.1,
      notes: null,
    });
    expect(weightRes.ok).toBe(true);
    await careFixture.whenStable();
    expect(careFixture.componentInstance.weightChart().points.length).toBe(4);
    expect(careFixture.componentInstance.weightChart().latestWeight).toBe(32.1);

    // Delete the weight record via component confirmation flow
    const newRecordId = weightRes.data!.id;
    careFixture.componentInstance.requestDelete(newRecordId);
    careFixture.componentInstance.confirmDelete(newRecordId);
    await careFixture.whenStable();
    expect(careFixture.componentInstance.weightChart().points.length).toBe(3);

    // Adding a French Bulldog on Profile immediately updates CarePageComponent dogs & warning tip
    const addedDog = dogService.addDog({
      breedId: 'breed-french-bulldog',
      name: 'Biscuit',
      birthDate: '2024-06-01',
      sex: 'MALE',
      size: 'SMALL',
      temperament: 'FRIENDLY',
      neutered: true,
      photoUrl: null,
    });
    expect(addedDog.ok).toBe(true);
    expect(careFixture.componentInstance.myDogs().some((d) => d.name === 'Biscuit')).toBe(true);

    careFixture.componentInstance.selectedDogId.set(addedDog.data!.id);
    await careFixture.whenStable();
    expect(careFixture.componentInstance.dailyTip()?.isWarning).toBe(true);
    expect(careFixture.componentInstance.weightChart().points.length).toBe(0);

    // Removing all dogs shows empty state with link to /profile
    for (const d of [...dogService.myDogs()]) {
      dogService.removeDog(d.id);
    }
    await careFixture.whenStable();
    expect(careFixture.componentInstance.myDogs().length).toBe(0);
    expect((careFixture.nativeElement as HTMLElement).textContent).toContain(
      'No Dogs Registered Yet',
    );
  });

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
    const elenaComment = feedService.addComment(createdPostId, 'Save some energy for the fetch session!');
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

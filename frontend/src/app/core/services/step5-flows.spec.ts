import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { EventDetailPageComponent } from '../../features/events/event-detail-page';
import { EventFormPageComponent } from '../../features/events/event-form-page';
import { FeedPageComponent } from '../../features/feed/feed-page';
import { PlacesMapPageComponent } from '../../features/places/places-map-page';
import {
  DEMO_REFERENCE_DATE_ISO,
  offsetDemoDateIso,
  offsetDemoDateOnly,
  offsetDemoLocalDateTime,
} from '../../shared/utils/date.util';
import { SEED_EVENTS } from '../mock-data/seed-events';
import { SEED_HEALTH_RECORDS } from '../mock-data/seed-care';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { DogService } from './dog.service';
import { EventService } from './event.service';
import { FeedService } from './feed.service';

describe('STEP 5 Final Stabilization, Map & Full E2E Demo Audit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('completes the full 19-step end-to-end demo walkthrough with reload persistence and reset', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const eventService = TestBed.inject(EventService);
    const dogService = TestBed.inject(DogService);
    const feedService = TestBed.inject(FeedService);

    // 1. Enter Demo as Ana Pop
    expect(auth.enterDemo('user-ana').ok).toBe(true);

    // 2-3. Căutarea e pe API acum (testată în search.service.spec.ts)

    // 4-5. Invite Elena to a private playdate & create event
    const createdEvent = eventService.createEvent({
      title: 'Step 5 Playdate Rex & Luna',
      description: 'Controlled courtyard playdate',
      type: 'PLAYDATE',
      visibility: 'PRIVATE',
      startsAt: offsetDemoDateIso(9, '16:00:00.000Z'),
      endsAt: offsetDemoDateIso(9, '17:30:00.000Z'),
      maxParticipants: 3,
      placeId: null,
      locationText: 'Parcul Central meadow',
      invitedUserIds: ['user-elena'],
      organizerGoingDogIds: ['dog-rex'],
    });
    expect(createdEvent.ok).toBe(true);
    const playdateId = createdEvent.data!.id;

    // 6-7. Switch to Elena and accept invitation with Luna
    expect(auth.switchDemoAccount('user-elena').ok).toBe(true);
    expect(eventService.respondToInvitation(playdateId, 'ACCEPTED', ['dog-luna']).ok).toBe(true);

    // 8-9. Switch back to Ana and verify Luna & Rex participation
    expect(auth.switchDemoAccount('user-ana').ok).toBe(true);
    const eventView = eventService.getEventById(playdateId);
    expect(eventView?.goingDogsCount).toBe(2);
    expect(eventView?.participants.some((p) => p.dog.id === 'dog-luna')).toBe(true);

    // 10-12. Mesageria e pe API acum (testată în message.service.spec.ts)

    // 13-15. Switch to Ana, add & edit a dog, add health record & verify weight/reminders
    expect(auth.switchDemoAccount('user-ana').ok).toBe(true);
    const addDogRes = dogService.addDog({
      breedId: 'breed-beagle',
      name: 'Milo',
      birthDate: '2025-05-01',
      sex: 'MALE',
      size: 'MEDIUM',
      temperament: 'PLAYFUL',
      neutered: true,
      photoUrl: null,
    });
    expect(addDogRes.ok).toBe(true);
    const miloId = addDogRes.data!.id;
    expect(dogService.updateDog(miloId, { name: 'Milo Jr.' }).data?.name).toBe('Milo Jr.');

    // 14-15. Îngrijirea (Care) e pe API acum (testată în care.service.spec.ts)

    // 16-17. Create social post, switch to Elena, like & comment
    const postRes = feedService.createPost({
      content: 'Excited for Milo Jr. first park playdate!',
      dogId: miloId,
      imageUrl: null,
    });
    expect(postRes.ok).toBe(true);
    const postId = postRes.data!.id;

    expect(auth.switchDemoAccount('user-elena').ok).toBe(true);
    feedService.toggleLike(postId);
    expect(feedService.addComment(postId, 'Welcome to the pack Milo Jr.!').ok).toBe(true);

    // 18. Simulated refresh preserves all mutations from localStorage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const reloadedFeed = TestBed.inject(FeedService);
    const reloadedEvents = TestBed.inject(EventService);

    const savedPost = reloadedFeed.getFeedPosts().find((p) => p.post.id === postId);
    expect(savedPost?.likeCount).toBe(1);
    expect(savedPost?.comments.length).toBe(1);
    expect(reloadedEvents.getEventById(playdateId)?.goingDogsCount).toBe(2);

    // 19. Reset Demo Data restores original seed dataset cleanly
    TestBed.inject(DemoStateService).resetDemoData();
    expect(TestBed.inject(DemoAuthService).currentUser()).toBeNull();
    TestBed.inject(DemoAuthService).enterDemo('user-ana');
    expect(reloadedEvents.getEventById(playdateId)).toBeUndefined();
    expect(reloadedFeed.getFeedPosts().some((p) => p.post.id === postId)).toBe(false);
    expect(reloadedEvents.getEventById('event-1')?.status).toBe('ACTIVE');
  });

  it('validates demo date helpers, /map directory interactions, and stability edge cases', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const eventService = TestBed.inject(EventService);
    const dogService = TestBed.inject(DogService);
    const feedService = TestBed.inject(FeedService);

    // Phase 2: Relative date utilities stay predictable & shift cleanly for 2027+ demos
    expect(offsetDemoDateOnly(0, DEMO_REFERENCE_DATE_ISO)).toBe('2026-11-11');
    expect(offsetDemoDateOnly(5, '2027-01-15T12:00:00.000Z')).toBe('2027-01-20');
    expect(offsetDemoDateIso(3, '09:30:00.000Z', '2027-01-15T12:00:00.000Z')).toBe(
      '2027-01-18T09:30:00.000Z',
    );
    expect(offsetDemoLocalDateTime(2, 16, 0, '2027-01-15T12:00:00.000Z')).toBe('2027-01-17T16:00');
    expect(SEED_EVENTS.every((e) => e.startsAt >= DEMO_REFERENCE_DATE_ISO.slice(0, 10))).toBe(true);
    expect(SEED_HEALTH_RECORDS.length).toBeGreaterThan(0);

    // Phase 3: Places directory (/map) filtering, details & external directions
    auth.enterDemo('user-ana');
    const mapFixture = TestBed.createComponent(PlacesMapPageComponent);
    await mapFixture.whenStable();
    expect(mapFixture.componentInstance.filteredPlaces().length).toBeGreaterThan(5);

    mapFixture.componentInstance.setCategory('VET');
    await mapFixture.whenStable();
    expect(mapFixture.componentInstance.filteredPlaces().every((p) => p.type === 'VET')).toBe(true);
    const selectedVet = mapFixture.componentInstance.selectedPlace();
    expect(selectedVet).not.toBeNull();
    expect(mapFixture.componentInstance.getDirectionsUrl(selectedVet!)).toContain(
      'google.com/maps/dir',
    );

    const formFromMapFixture = TestBed.createComponent(EventFormPageComponent);
    formFromMapFixture.componentRef.setInput('placeId', selectedVet!.id);
    await formFromMapFixture.whenStable();
    expect(formFromMapFixture.componentInstance.eventForm.controls.placeId.value).toBe(
      selectedVet!.id,
    );

    // Phase 5: Edge cases — invalid event update dates & capacity < 1
    expect(
      eventService.updateEvent('event-1', {
        startsAt: 'not-a-date',
        endsAt: '2026-11-15T12:00:00.000Z',
      }).ok,
    ).toBe(false);
    expect(eventService.updateEvent('event-1', { maxParticipants: 0 }).ok).toBe(false);

    // Phase 5: Deleted dog cleanup keeps event RSVPs, posts & care records consistent
    const bellaPost = feedService.createPost({
      content: 'Bella park snap',
      dogId: 'dog-bella',
      imageUrl: null,
    });
    expect(bellaPost.ok).toBe(true);
    expect(dogService.removeDog('dog-bella').ok).toBe(true);
    expect(
      feedService.getFeedPosts().find((p) => p.post.id === bellaPost.data!.id)?.dog,
    ).toBeNull();
    expect(
      eventService.getEventById('event-4')?.participants.some((p) => p.dog.id === 'dog-bella'),
    ).toBe(false);

    // Phase 5: Invalid route IDs render safe fallback UI without throwing
    // (DogDetail, UserProfile, Care sunt pe API acum)
    const eventFixture = TestBed.createComponent(EventDetailPageComponent);
    eventFixture.componentRef.setInput('id', 'invalid-event-id');
    await eventFixture.whenStable();
    expect((eventFixture.nativeElement as HTMLElement).textContent).toContain(
      'Event Not Found or Private',
    );

    const feedFixture = TestBed.createComponent(FeedPageComponent);
    await feedFixture.whenStable();
    expect(feedFixture.componentInstance.posts().length).toBeGreaterThan(0);

    // Phase 5: Corrupted localStorage falls back cleanly to initial demo seed on reload
    window.localStorage.setItem(DEMO_STORAGE_KEY, '{corrupted-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const recoveredState = TestBed.inject(DemoStateService).state();
    expect(recoveredState.users.length).toBeGreaterThanOrEqual(7);
    expect(recoveredState.currentUserId).toBeNull();
  });
});

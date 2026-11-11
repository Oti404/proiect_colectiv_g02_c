import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { CarePageComponent } from '../../features/care/care-page';
import { DogDetailPageComponent } from '../../features/dogs/dog-detail-page';
import { EventDetailPageComponent } from '../../features/events/event-detail-page';
import { EventFormPageComponent } from '../../features/events/event-form-page';
import { FeedPageComponent } from '../../features/feed/feed-page';
import { MessagesPageComponent } from '../../features/messages/messages-page';
import { PlacesMapPageComponent } from '../../features/places/places-map-page';
import { UserProfilePageComponent } from '../../features/profile/user-profile-page';
import {
  DEMO_REFERENCE_DATE_ISO,
  offsetDemoDateIso,
  offsetDemoDateOnly,
  offsetDemoLocalDateTime,
} from '../../shared/utils/date.util';
import { SEED_EVENTS } from '../mock-data/seed-events';
import { SEED_HEALTH_RECORDS } from '../mock-data/seed-care';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { CareService } from './care.service';
import { DemoAuthService } from './demo-auth.service';
import { DogService } from './dog.service';
import { EventService } from './event.service';
import { FeedService } from './feed.service';
import { MessageService } from './message.service';
import { DEFAULT_SEARCH_FILTERS, SearchService } from './search.service';
import { UserService } from './user.service';

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
    const searchService = TestBed.inject(SearchService);
    const eventService = TestBed.inject(EventService);
    const messageService = TestBed.inject(MessageService);
    const dogService = TestBed.inject(DogService);
    const careService = TestBed.inject(CareService);
    const feedService = TestBed.inject(FeedService);

    // 1. Enter Demo as Ana Pop
    expect(auth.enterDemo('user-ana').ok).toBe(true);

    // 2-3. Search for Luna
    const searchResults = searchService.searchDogs({
      ...DEFAULT_SEARCH_FILTERS,
      query: 'Luna',
      maxDistanceKm: 20,
    });
    const luna = searchResults.find((r) => r.dog.id === 'dog-luna');
    expect(luna).toBeDefined();
    expect(luna?.owner.id).toBe('user-elena');

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

    // 10-12. Open messaging, send a message to Elena, switch to Elena & verify
    const convRes = messageService.startOrOpenConversation('user-elena');
    expect(convRes.ok).toBe(true);
    const convId = convRes.data!.id;
    expect(messageService.sendMessage(convId, 'See you at Parcul Central with Rex!').ok).toBe(true);

    expect(auth.switchDemoAccount('user-elena').ok).toBe(true);
    const elenaMessages = messageService.getMessages(convId);
    expect(elenaMessages.some((m) => m.content === 'See you at Parcul Central with Rex!')).toBe(
      true,
    );

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

    const addWeightRes = careService.addHealthRecord(miloId, {
      type: 'WEIGHT',
      title: 'Initial checkup',
      date: offsetDemoDateOnly(0),
      nextDueDate: offsetDemoDateOnly(10),
      weightKg: 11.2,
      notes: null,
    });
    expect(addWeightRes.ok).toBe(true);
    expect(careService.getWeightHistory(miloId).length).toBe(1);
    expect(careService.getReminders(miloId)[0]?.status).toBe('DUE_SOON');

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
    const reloadedCare = TestBed.inject(CareService);

    const savedPost = reloadedFeed.getFeedPosts().find((p) => p.post.id === postId);
    expect(savedPost?.likeCount).toBe(1);
    expect(savedPost?.comments.length).toBe(1);
    expect(reloadedEvents.getEventById(playdateId)?.goingDogsCount).toBe(2);
    expect(reloadedCare.getWeightHistory(miloId)[0]?.weightKg).toBe(11.2);

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
    const messageService = TestBed.inject(MessageService);
    const userService = TestBed.inject(UserService);
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

    // Phase 5: Messaging — unknown user rejected & blocked user hides messages
    expect(messageService.startOrOpenConversation('user-does-not-exist').ok).toBe(false);
    expect(userService.blockUser('user-elena').ok).toBe(true);
    expect(messageService.getMessages('conv-ana-elena').length).toBe(0);
    expect(messageService.sendMessage('conv-ana-elena', 'Should be blocked').ok).toBe(false);
    userService.unblockUser('user-elena');

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
      eventService
        .getEventById('event-4')
        ?.participants.some((p) => p.dog.id === 'dog-bella'),
    ).toBe(false);

    // Phase 5: Invalid route IDs render safe fallback UI without throwing
    const dogFixture = TestBed.createComponent(DogDetailPageComponent);
    dogFixture.componentRef.setInput('id', 'invalid-dog-id');
    await dogFixture.whenStable();
    expect((dogFixture.nativeElement as HTMLElement).textContent).toContain('Dog Not Found');

    const userFixture = TestBed.createComponent(UserProfilePageComponent);
    userFixture.componentRef.setInput('id', 'invalid-user-id');
    await userFixture.whenStable();
    expect((userFixture.nativeElement as HTMLElement).textContent).toContain('User Not Found');

    const eventFixture = TestBed.createComponent(EventDetailPageComponent);
    eventFixture.componentRef.setInput('id', 'invalid-event-id');
    await eventFixture.whenStable();
    expect((eventFixture.nativeElement as HTMLElement).textContent).toContain(
      'Event Not Found or Private',
    );

    const msgFixture = TestBed.createComponent(MessagesPageComponent);
    msgFixture.componentRef.setInput('id', 'invalid-conv-id');
    await msgFixture.whenStable();
    expect((msgFixture.nativeElement as HTMLElement).textContent).toContain(
      'Select a conversation on the left',
    );

    const careFixture = TestBed.createComponent(CarePageComponent);
    await careFixture.whenStable();
    expect(careFixture.componentInstance.selectedDog()?.id).toBe('dog-rex');

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

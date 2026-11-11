import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { EventDetailPageComponent } from '../../features/events/event-detail-page';
import { EventFormPageComponent } from '../../features/events/event-form-page';
import { EventsPageComponent } from '../../features/events/events-page';
import { MessagesPageComponent } from '../../features/messages/messages-page';
import { DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { EventService } from './event.service';
import { MessageService } from './message.service';
import { DEFAULT_SEARCH_FILTERS, SearchService } from './search.service';

describe('STEP 3 Events & Messaging Flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('executes full mandatory E2E demo scenario and survives browser refresh', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const searchService = TestBed.inject(SearchService);
    const eventService = TestBed.inject(EventService);
    const messageService = TestBed.inject(MessageService);

    // 1. Ana enters demo and searches Luna
    auth.enterDemo('user-ana');
    const lunaMatch = searchService
      .searchDogs({ ...DEFAULT_SEARCH_FILTERS, query: 'Luna', maxDistanceKm: 20 })
      .find((r) => r.dog.id === 'dog-luna');
    expect(lunaMatch).toBeDefined();
    expect(lunaMatch?.owner.id).toBe('user-elena');

    // 2. Ana creates a private playdate inviting Elena (with Rex going, capacity 2)
    const createRes = eventService.createEvent({
      title: 'Playdate Rex & Luna',
      description: 'Afternoon playdate test',
      type: 'PLAYDATE',
      visibility: 'PRIVATE',
      startsAt: '2026-11-22T15:00:00.000Z',
      endsAt: '2026-11-22T16:30:00.000Z',
      maxParticipants: 2,
      placeId: null,
      locationText: 'Parcul Central lawn',
      invitedUserIds: ['user-elena'],
      organizerGoingDogIds: ['dog-rex'],
    });
    expect(createRes.ok).toBe(true);
    const createdEventId = createRes.data!.id;

    // Non-invited user (e.g. Andrei) cannot see Ana's private playdate
    auth.switchDemoAccount('user-andrei');
    expect(eventService.getEventById(createdEventId)).toBeUndefined();

    // 3. Switch to Elena -> sees pending invitation -> accepts with Luna
    auth.switchDemoAccount('user-elena');
    const invited = eventService.getMyInvitedEvents();
    const pendingPlaydate = invited.find((e) => e.id === createdEventId);
    expect(pendingPlaydate?.currentUserInvitation?.status).toBe('PENDING');

    const detailFixture = TestBed.createComponent(EventDetailPageComponent);
    detailFixture.componentRef.setInput('id', createdEventId);
    await detailFixture.whenStable();
    detailFixture.componentInstance.inviteDogSelection.set(['dog-luna']);
    detailFixture.componentInstance.onAcceptInvitation(createdEventId);

    // 4. Switch back to Ana -> verify RSVP & capacity enforcement (2/2 full)
    auth.switchDemoAccount('user-ana');
    const anaView = eventService.getEventById(createdEventId)!;
    expect(anaView.goingDogsCount).toBe(2);
    expect(anaView.isFull).toBe(true);
    expect(anaView.currentUserInvitation).toBeNull();
    expect(anaView.participants.some((p) => p.dog.id === 'dog-luna' && p.rsvp.status === 'GOING')).toBe(
      true,
    );

    const overCapacity = eventService.respondToEvent(createdEventId, 'dog-bella', 'GOING');
    expect(overCapacity.ok).toBe(false);

    // 5. Open chat with Elena and send message
    const convRes = messageService.startOrOpenConversation('user-elena');
    expect(convRes.ok).toBe(true);
    const convId = convRes.data!.id;
    const sendRes = messageService.sendMessage(convId, 'See you with Rex on Sunday!');
    expect(sendRes.ok).toBe(true);

    // 6. Switch to Elena -> verify unread count & message -> open thread marks read
    auth.switchDemoAccount('user-elena');
    const elenaConvBefore = messageService.getConversationById(convId)!;
    expect(elenaConvBefore.unreadCount).toBe(1);

    const msgFixture = TestBed.createComponent(MessagesPageComponent);
    msgFixture.componentRef.setInput('id', convId);
    await msgFixture.whenStable();

    const messages = msgFixture.componentInstance.activeMessages();
    expect(messages.some((m) => m.content === 'See you with Rex on Sunday!')).toBe(true);
    expect(messageService.getConversationById(convId)?.unreadCount).toBe(0);

    // 7. Simulate browser refresh via fresh TestBed reading persisted localStorage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });

    const reloadedAuth = TestBed.inject(DemoAuthService);
    const reloadedEvents = TestBed.inject(EventService);
    const reloadedMessages = TestBed.inject(MessageService);

    expect(reloadedAuth.currentUser()?.id).toBe('user-elena');
    const persistedEvent = reloadedEvents.getEventById(createdEventId);
    expect(persistedEvent?.goingDogsCount).toBe(2);
    expect(
      reloadedMessages
        .getMessages(convId)
        .some((m) => m.content === 'See you with Rex on Sunday!'),
    ).toBe(true);
  });

  it('enforces organizer-only edit/cancel and start/end time validation', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const eventService = TestBed.inject(EventService);
    auth.enterDemo('user-ana');

    const badTime = eventService.createEvent({
      title: 'Invalid Time Event',
      description: null,
      type: 'GROUP_WALK',
      visibility: 'PUBLIC',
      startsAt: '2026-11-20T18:00:00.000Z',
      endsAt: '2026-11-20T17:00:00.000Z',
      maxParticipants: 5,
      placeId: 'place-parcul-central',
      locationText: null,
      invitedUserIds: [],
      organizerGoingDogIds: [],
    });
    expect(badTime.ok).toBe(false);

    // Ana cannot cancel Elena's event (event-2)
    expect(eventService.cancelEvent('event-2').ok).toBe(false);

    // Ana can cancel her own event (event-1)
    expect(eventService.cancelEvent('event-1').ok).toBe(true);
    expect(eventService.getEventById('event-1')?.status).toBe('CANCELLED');
    expect(eventService.respondToEvent('event-1', 'dog-rex', 'MAYBE').ok).toBe(false);

    // Render EventsPage and EventFormPage cleanly
    const eventsFixture = TestBed.createComponent(EventsPageComponent);
    await eventsFixture.whenStable();
    expect(eventsFixture.componentInstance.organizedEvents().length).toBeGreaterThan(0);

    const formFixture = TestBed.createComponent(EventFormPageComponent);
    formFixture.componentRef.setInput('inviteUserId', 'user-elena');
    await formFixture.whenStable();
    expect(formFixture.componentInstance.selectedInviteUserIds()).toEqual(['user-elena']);

    TestBed.inject(DemoStateService).resetDemoData();
    expect(eventService.getEventById('event-1')).toBeUndefined(); // logged out on full reset
  });
});

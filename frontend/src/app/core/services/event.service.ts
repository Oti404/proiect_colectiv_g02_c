import { Injectable, computed, inject } from '@angular/core';
import {
  ActionResult,
  CreateEventPayload,
  DogRsvpStatus,
  Event,
  EventDogRsvp,
  EventInvitation,
  EventInvitationDetail,
  EventParticipantDetail,
  EventView,
  InvitationStatus,
  UpdateEventPayload,
} from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);

  readonly pendingInvitationsCount = computed<number>(() => {
    const me = this.auth.currentUser();
    if (!me) {
      return 0;
    }
    const state = this.store.state();
    return state.eventInvitations.filter((inv) => {
      if (inv.userId !== me.id || inv.status !== 'PENDING') {
        return false;
      }
      const ev = state.events.find((e) => e.id === inv.eventId);
      return ev !== undefined && ev.status === 'ACTIVE';
    }).length;
  });

  getVisibleEvents(): EventView[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    const state = this.store.state();
    return state.events
      .filter((ev) => this.canUserSeeEvent(ev, me.id))
      .map((ev) => this.buildEventView(ev, me.id))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  getPublicUpcomingEvents(): EventView[] {
    return this.getVisibleEvents().filter(
      (ev) => ev.visibility === 'PUBLIC' && ev.status === 'ACTIVE',
    );
  }

  getMyOrganizedEvents(): EventView[] {
    return this.getVisibleEvents().filter((ev) => ev.isOrganizer);
  }

  getMyInvitedEvents(): EventView[] {
    return this.getVisibleEvents().filter((ev) => ev.currentUserInvitation !== null);
  }

  getEventById(eventId: string): EventView | undefined {
    const me = this.auth.currentUser();
    if (!me) {
      return undefined;
    }
    const ev = this.store.state().events.find((e) => e.id === eventId);
    if (!ev || !this.canUserSeeEvent(ev, me.id)) {
      return undefined;
    }
    return this.buildEventView(ev, me.id);
  }

  createEvent(payload: CreateEventPayload): ActionResult<Event> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in to create an event.' };
    }

    const title = payload.title.trim();
    if (!title) {
      return { ok: false, error: 'Event title is required.' };
    }

    const startMs = new Date(payload.startsAt).getTime();
    const endMs = new Date(payload.endsAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return { ok: false, error: 'Event end time must be later than start time.' };
    }

    if (payload.maxParticipants !== null && payload.maxParticipants < 1) {
      return { ok: false, error: 'Capacity must be at least 1 dog.' };
    }

    if (
      payload.maxParticipants !== null &&
      payload.organizerGoingDogIds.length > payload.maxParticipants
    ) {
      return {
        ok: false,
        error: `Selected dogs exceed max capacity (${payload.maxParticipants}).`,
      };
    }

    if (payload.visibility === 'PRIVATE' && !payload.locationText?.trim()) {
      return { ok: false, error: 'Location description is required for a private playdate.' };
    }

    if (payload.visibility === 'PUBLIC' && !payload.placeId && !payload.locationText?.trim()) {
      return { ok: false, error: 'Please choose a place for a public event.' };
    }

    const eventId = this.store.allocateId('event');
    const nowIso = new Date().toISOString();

    const newEvent: Event = {
      id: eventId,
      organizerId: me.id,
      placeId: payload.visibility === 'PUBLIC' ? payload.placeId : null,
      locationText: payload.visibility === 'PRIVATE' ? payload.locationText?.trim() ?? null : payload.locationText?.trim() ?? null,
      title,
      description: payload.description ? payload.description.trim() : null,
      type: payload.type,
      visibility: payload.visibility,
      status: 'ACTIVE',
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      maxParticipants: payload.maxParticipants,
    };

    const existingUserIds = new Set(this.store.state().users.map((u) => u.id));
    const uniqueInvitedUserIds = Array.from(new Set(payload.invitedUserIds)).filter(
      (uid) =>
        uid !== me.id &&
        existingUserIds.has(uid) &&
        !this.userService.isBlockedEitherWay(me.id, uid),
    );

    const newInvitations: EventInvitation[] = uniqueInvitedUserIds.map((uid) => ({
      id: this.store.allocateId('inv'),
      eventId,
      userId: uid,
      invitedByUserId: me.id,
      status: 'PENDING',
      createdAt: nowIso,
      respondedAt: null,
    }));

    const myDogIds = new Set(
      this.store
        .state()
        .dogs.filter((d) => d.ownerId === me.id)
        .map((d) => d.id),
    );

    const newRsvps: EventDogRsvp[] = Array.from(new Set(payload.organizerGoingDogIds))
      .filter((dogId) => myDogIds.has(dogId))
      .map((dogId) => ({
        id: this.store.allocateId('rsvp'),
        eventId,
        userId: me.id,
        dogId,
        status: 'GOING',
        updatedAt: nowIso,
      }));

    this.store.updateState((draft) => {
      draft.events.push(newEvent);
      draft.eventInvitations.push(...newInvitations);
      draft.eventDogRsvps.push(...newRsvps);
      return draft;
    });

    return { ok: true, data: newEvent };
  }

  updateEvent(eventId: string, patch: UpdateEventPayload): ActionResult<Event> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }

    const existing = this.store.state().events.find((e) => e.id === eventId);
    if (!existing) {
      return { ok: false, error: 'Event not found.' };
    }
    if (existing.organizerId !== me.id) {
      return { ok: false, error: 'Only the organizer can edit this event.' };
    }

    const nextStart = patch.startsAt ?? existing.startsAt;
    const nextEnd = patch.endsAt ?? existing.endsAt;
    const startMs = new Date(nextStart).getTime();
    const endMs = new Date(nextEnd).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return { ok: false, error: 'Event end time must be later than start time.' };
    }

    if (patch.title !== undefined && !patch.title.trim()) {
      return { ok: false, error: 'Event title cannot be empty.' };
    }

    if (patch.maxParticipants !== undefined && patch.maxParticipants !== null) {
      if (patch.maxParticipants < 1) {
        return { ok: false, error: 'Capacity must be at least 1 dog.' };
      }
      const currentGoing = this.store
        .state()
        .eventDogRsvps.filter((r) => r.eventId === eventId && r.status === 'GOING').length;
      if (patch.maxParticipants < currentGoing) {
        return {
          ok: false,
          error: `Capacity cannot be lower than current GOING dogs (${currentGoing}).`,
        };
      }
    }

    let updated: Event | undefined;
    this.store.updateState((draft) => {
      const target = draft.events.find((e) => e.id === eventId);
      if (target) {
        if (patch.title !== undefined) target.title = patch.title.trim();
        if (patch.description !== undefined) {
          target.description = patch.description ? patch.description.trim() : null;
        }
        if (patch.type !== undefined) target.type = patch.type;
        if (patch.startsAt !== undefined) target.startsAt = new Date(patch.startsAt).toISOString();
        if (patch.endsAt !== undefined) target.endsAt = new Date(patch.endsAt).toISOString();
        if (patch.maxParticipants !== undefined) target.maxParticipants = patch.maxParticipants;
        if (patch.placeId !== undefined && target.visibility === 'PUBLIC') {
          target.placeId = patch.placeId;
        }
        if (patch.locationText !== undefined) {
          target.locationText = patch.locationText ? patch.locationText.trim() : null;
        }
        updated = target;
      }
      return draft;
    });

    return updated ? { ok: true, data: updated } : { ok: false, error: 'Update failed.' };
  }

  cancelEvent(eventId: string): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const existing = this.store.state().events.find((e) => e.id === eventId);
    if (!existing) {
      return { ok: false, error: 'Event not found.' };
    }
    if (existing.organizerId !== me.id) {
      return { ok: false, error: 'Only the organizer can cancel this event.' };
    }

    this.store.updateState((draft) => {
      const target = draft.events.find((e) => e.id === eventId);
      if (target) {
        target.status = 'CANCELLED';
      }
      return draft;
    });
    return { ok: true };
  }

  inviteUsers(eventId: string, userIds: string[]): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const ev = this.store.state().events.find((e) => e.id === eventId);
    if (!ev) {
      return { ok: false, error: 'Event not found.' };
    }
    if (ev.organizerId !== me.id) {
      return { ok: false, error: 'Only the organizer can invite users.' };
    }
    if (ev.status === 'CANCELLED') {
      return { ok: false, error: 'Cannot invite users to a cancelled event.' };
    }

    const nowIso = new Date().toISOString();
    const state = this.store.state();
    const validUserIds = new Set(state.users.map((u) => u.id));
    const alreadyInvited = new Set(
      state.eventInvitations.filter((i) => i.eventId === eventId).map((i) => i.userId),
    );

    const newInvs: EventInvitation[] = Array.from(new Set(userIds))
      .filter(
        (uid) =>
          uid !== me.id &&
          validUserIds.has(uid) &&
          !alreadyInvited.has(uid) &&
          !this.userService.isBlockedEitherWay(me.id, uid),
      )
      .map((uid) => ({
        id: this.store.allocateId('inv'),
        eventId,
        userId: uid,
        invitedByUserId: me.id,
        status: 'PENDING',
        createdAt: nowIso,
        respondedAt: null,
      }));

    if (newInvs.length > 0) {
      this.store.updateState((draft) => {
        draft.eventInvitations.push(...newInvs);
        return draft;
      });
    }

    return { ok: true };
  }

  /**
   * Invited owner accepts or declines an owner-level invitation,
   * selecting which of their own dogs will attend if accepted.
   */
  respondToInvitation(
    eventId: string,
    status: Exclude<InvitationStatus, 'PENDING'>,
    goingDogIds: string[] = [],
  ): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const state = this.store.state();
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev) {
      return { ok: false, error: 'Event not found.' };
    }
    if (ev.status === 'CANCELLED') {
      return { ok: false, error: 'This event has been cancelled.' };
    }

    const inv = state.eventInvitations.find((i) => i.eventId === eventId && i.userId === me.id);
    if (!inv) {
      return { ok: false, error: 'No invitation found for your account.' };
    }

    const myDogIds = new Set(state.dogs.filter((d) => d.ownerId === me.id).map((d) => d.id));
    const validGoingDogs = Array.from(new Set(goingDogIds)).filter((id) => myDogIds.has(id));

    if (status === 'ACCEPTED' && validGoingDogs.length === 0) {
      return { ok: false, error: 'Select at least one of your dogs to attend.' };
    }

    if (status === 'ACCEPTED' && ev.maxParticipants !== null) {
      const otherGoingCount = state.eventDogRsvps.filter(
        (r) => r.eventId === eventId && r.status === 'GOING' && r.userId !== me.id,
      ).length;
      if (otherGoingCount + validGoingDogs.length > ev.maxParticipants) {
        return {
          ok: false,
          error: `Event capacity reached (${otherGoingCount}/${ev.maxParticipants} dogs going).`,
        };
      }
    }

    const nowIso = new Date().toISOString();
    const newRsvps: EventDogRsvp[] =
      status === 'ACCEPTED'
        ? validGoingDogs.map((dogId) => ({
            id: this.store.allocateId('rsvp'),
            eventId,
            userId: me.id,
            dogId,
            status: 'GOING',
            updatedAt: nowIso,
          }))
        : [];

    this.store.updateState((draft) => {
      const targetInv = draft.eventInvitations.find(
        (i) => i.eventId === eventId && i.userId === me.id,
      );
      if (targetInv) {
        targetInv.status = status;
        targetInv.respondedAt = nowIso;
      }

      // Replace current user's dog RSVPs for this event
      draft.eventDogRsvps = draft.eventDogRsvps.filter(
        (r) => !(r.eventId === eventId && r.userId === me.id),
      );
      if (status === 'ACCEPTED') {
        draft.eventDogRsvps.push(...newRsvps);
      }
      return draft;
    });

    return { ok: true };
  }

  /**
   * Per-dog RSVP action (for public events or updating participation after accepting).
   */
  respondToEvent(eventId: string, dogId: string, status: DogRsvpStatus): ActionResult {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const state = this.store.state();
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev) {
      return { ok: false, error: 'Event not found.' };
    }
    if (ev.status === 'CANCELLED') {
      return { ok: false, error: 'Cannot RSVP to a cancelled event.' };
    }
    if (!this.canUserSeeEvent(ev, me.id)) {
      return { ok: false, error: 'You do not have access to this private event.' };
    }

    const dog = state.dogs.find((d) => d.id === dogId);
    if (!dog || dog.ownerId !== me.id) {
      return { ok: false, error: 'You can only RSVP with your own dogs.' };
    }

    const existingRsvp = state.eventDogRsvps.find(
      (r) => r.eventId === eventId && r.dogId === dogId,
    );

    if (status === 'GOING' && ev.maxParticipants !== null) {
      const currentGoingCount = state.eventDogRsvps.filter(
        (r) => r.eventId === eventId && r.status === 'GOING' && r.dogId !== dogId,
      ).length;
      if (currentGoingCount >= ev.maxParticipants) {
        return {
          ok: false,
          error: `This event has reached its capacity of ${ev.maxParticipants} dogs.`,
        };
      }
    }

    const nowIso = new Date().toISOString();
    const newId = existingRsvp ? existingRsvp.id : this.store.allocateId('rsvp');

    this.store.updateState((draft) => {
      const target = draft.eventDogRsvps.find(
        (r) => r.eventId === eventId && r.dogId === dogId,
      );
      if (target) {
        target.status = status;
        target.updatedAt = nowIso;
      } else {
        draft.eventDogRsvps.push({
          id: newId,
          eventId,
          userId: me.id,
          dogId,
          status,
          updatedAt: nowIso,
        });
      }

      // If the user had a pending invitation and marks a dog GOING/MAYBE, mark invitation ACCEPTED.
      const inv = draft.eventInvitations.find(
        (i) => i.eventId === eventId && i.userId === me.id,
      );
      if (inv && inv.status === 'PENDING' && (status === 'GOING' || status === 'MAYBE')) {
        inv.status = 'ACCEPTED';
        inv.respondedAt = nowIso;
      }
      return draft;
    });

    return { ok: true };
  }

  private canUserSeeEvent(ev: Event, userId: string): boolean {
    if (ev.organizerId && ev.organizerId !== userId) {
      if (this.userService.isBlockedEitherWay(userId, ev.organizerId)) {
        return false;
      }
    }
    if (ev.visibility === 'PUBLIC') {
      return true;
    }
    if (ev.organizerId === userId) {
      return true;
    }
    return this.store
      .state()
      .eventInvitations.some((inv) => inv.eventId === ev.id && inv.userId === userId);
  }

  private buildEventView(ev: Event, currentUserId: string): EventView {
    const state = this.store.state();
    const organizer = ev.organizerId
      ? (state.users.find((u) => u.id === ev.organizerId) ?? null)
      : null;
    const place = ev.placeId ? (state.places.find((p) => p.id === ev.placeId) ?? null) : null;

    const invitations: EventInvitationDetail[] = state.eventInvitations
      .filter((inv) => inv.eventId === ev.id)
      .map((inv) => {
        const user = state.users.find((u) => u.id === inv.userId);
        const invitedBy = state.users.find((u) => u.id === inv.invitedByUserId) ?? null;
        return user ? { invitation: inv, user, invitedBy } : null;
      })
      .filter((item): item is EventInvitationDetail => item !== null);

    const participants: EventParticipantDetail[] = state.eventDogRsvps
      .filter((r) => r.eventId === ev.id)
      .map((r) => {
        const dog = state.dogs.find((d) => d.id === r.dogId);
        const owner = state.users.find((u) => u.id === r.userId);
        const breed = dog ? state.breeds.find((b) => b.id === dog.breedId) : undefined;
        return dog && owner && breed ? { rsvp: r, dog, breed, owner } : null;
      })
      .filter((item): item is EventParticipantDetail => item !== null);

    const goingDogsCount = participants.filter((p) => p.rsvp.status === 'GOING').length;
    const isFull = ev.maxParticipants !== null && goingDogsCount >= ev.maxParticipants;

    return {
      ...ev,
      organizer,
      place,
      invitations,
      participants,
      goingDogsCount,
      isFull,
      isOrganizer: ev.organizerId === currentUserId,
      currentUserInvitation:
        state.eventInvitations.find((i) => i.eventId === ev.id && i.userId === currentUserId) ??
        null,
      currentUserDogRsvps: state.eventDogRsvps.filter(
        (r) => r.eventId === ev.id && r.userId === currentUserId,
      ),
    };
  }
}

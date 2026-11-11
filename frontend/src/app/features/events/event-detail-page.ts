import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DogRsvpStatus } from '../../core/models';
import {
  DemoAuthService,
  DogService,
  EventService,
  MessageService,
  UserService,
} from '../../core/services';

@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './event-detail-page.html',
})
export class EventDetailPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(DemoAuthService);
  private readonly eventService = inject(EventService);
  private readonly dogService = inject(DogService);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);

  readonly id = input<string>();

  readonly myDogs = this.dogService.myDogs;
  readonly eventView = computed(() => {
    const eventId = this.id();
    return eventId ? this.eventService.getEventById(eventId) : undefined;
  });

  readonly invitableUsers = computed(() => {
    const ev = this.eventView();
    if (!ev) {
      return [];
    }
    const invitedIds = new Set(ev.invitations.map((i) => i.user.id));
    return this.userService.getOtherUsers().filter((u) => !invitedIds.has(u.id));
  });

  readonly canUserRsvp = computed(() => {
    const ev = this.eventView();
    if (!ev || ev.status !== 'ACTIVE') {
      return false;
    }
    if (ev.visibility === 'PUBLIC' || ev.isOrganizer) {
      return true;
    }
    return ev.currentUserInvitation?.status === 'ACCEPTED';
  });

  readonly inviteDogSelection = signal<string[]>([]);
  readonly extraInviteUserIds = signal<string[]>([]);
  readonly confirmingCancel = signal(false);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  private lastContextKey: string | null = null;

  constructor() {
    effect(() => {
      const me = this.auth.currentUser()?.id ?? '';
      const eventId = this.id() ?? '';
      const key = `${me}|${eventId}`;
      if (key === this.lastContextKey) {
        return;
      }
      this.lastContextKey = key;
      const firstDog = this.myDogs()[0]?.id;
      this.inviteDogSelection.set(firstDog ? [firstDog] : []);
      this.extraInviteUserIds.set([]);
      this.confirmingCancel.set(false);
      this.actionMessage.set(null);
      this.actionError.set(null);
    });
  }

  getMyDogRsvpStatus(dogId: string): DogRsvpStatus | null {
    const ev = this.eventView();
    if (!ev) {
      return null;
    }
    return ev.currentUserDogRsvps.find((r) => r.dogId === dogId)?.status ?? null;
  }

  isInviteDogSelected(dogId: string): boolean {
    return this.inviteDogSelection().includes(dogId);
  }

  toggleInviteDog(dogId: string): void {
    this.inviteDogSelection.update((list) =>
      list.includes(dogId) ? list.filter((id) => id !== dogId) : [...list, dogId],
    );
  }

  onAcceptInvitation(eventId: string): void {
    this.actionMessage.set(null);
    this.actionError.set(null);
    const res = this.eventService.respondToInvitation(
      eventId,
      'ACCEPTED',
      this.inviteDogSelection(),
    );
    if (res.ok) {
      this.actionMessage.set('Invitation accepted and your selected dog(s) marked GOING.');
    } else {
      this.actionError.set(res.error ?? 'Could not accept invitation.');
    }
  }

  onDeclineInvitation(eventId: string): void {
    this.actionMessage.set(null);
    this.actionError.set(null);
    const res = this.eventService.respondToInvitation(eventId, 'DECLINED');
    if (res.ok) {
      this.actionMessage.set('Invitation declined.');
    } else {
      this.actionError.set(res.error ?? 'Could not decline invitation.');
    }
  }

  onDogRsvp(eventId: string, dogId: string, status: DogRsvpStatus): void {
    this.actionMessage.set(null);
    this.actionError.set(null);
    const res = this.eventService.respondToEvent(eventId, dogId, status);
    if (res.ok) {
      this.actionMessage.set(`Updated RSVP to ${status}.`);
    } else {
      this.actionError.set(res.error ?? 'Could not update RSVP.');
    }
  }

  isExtraInviteSelected(userId: string): boolean {
    return this.extraInviteUserIds().includes(userId);
  }

  toggleExtraInvite(userId: string): void {
    this.extraInviteUserIds.update((list) =>
      list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId],
    );
  }

  onSendAdditionalInvites(eventId: string): void {
    this.actionMessage.set(null);
    this.actionError.set(null);
    const ids = this.extraInviteUserIds();
    if (ids.length === 0) {
      return;
    }
    const res = this.eventService.inviteUsers(eventId, ids);
    if (res.ok) {
      this.extraInviteUserIds.set([]);
      this.actionMessage.set(`Sent ${ids.length} invitation(s).`);
    } else {
      this.actionError.set(res.error ?? 'Could not send invitations.');
    }
  }

  onConfirmCancelEvent(eventId: string): void {
    this.actionMessage.set(null);
    this.actionError.set(null);
    const res = this.eventService.cancelEvent(eventId);
    this.confirmingCancel.set(false);
    if (res.ok) {
      this.actionMessage.set('Event cancelled.');
    } else {
      this.actionError.set(res.error ?? 'Could not cancel event.');
    }
  }

  onMessageOrganizer(organizerId: string): void {
    const res = this.messageService.startOrOpenConversation(organizerId);
    if (res.ok && res.data) {
      void this.router.navigate(['/messages', res.data.id]);
    }
  }
}

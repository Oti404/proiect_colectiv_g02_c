import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EventType, Visibility } from '../../core/models';
import { offsetDemoLocalDateTime } from '../../shared/utils/date.util';
import {
  DemoAuthService,
  DogService,
  EventService,
  PlaceService,
  UserService,
} from '../../core/services';

function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-event-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form-page.html',
})
export class EventFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(DemoAuthService);
  private readonly eventService = inject(EventService);
  private readonly dogService = inject(DogService);
  private readonly userService = inject(UserService);
  private readonly placeService = inject(PlaceService);

  // Route & query params bound via withComponentInputBinding()
  readonly id = input<string>();
  readonly inviteUserId = input<string>();
  readonly type = input<string>();
  readonly visibility = input<string>();
  readonly placeId = input<string>();

  readonly myDogs = this.dogService.myDogs;
  readonly places = computed(() => this.placeService.getPlaces('ALL'));
  readonly otherUsers = computed(() => this.userService.getOtherUsers());

  readonly isEditMode = computed(() => Boolean(this.id()));
  readonly editingEvent = computed(() => {
    const eventId = this.id();
    return eventId ? this.eventService.getEventById(eventId) : undefined;
  });
  readonly unauthorizedEdit = computed(() => {
    const ev = this.editingEvent();
    return this.isEditMode() && (!ev || !ev.isOrganizer);
  });

  readonly selectedInviteUserIds = signal<string[]>([]);
  readonly selectedGoingDogIds = signal<string[]>([]);
  readonly formError = signal<string | null>(null);
  readonly currentVisibility = signal<Visibility>('PUBLIC');

  private initializedKey: string | null = null;

  readonly eventForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['GROUP_WALK' as EventType, [Validators.required]],
    visibility: ['PUBLIC' as Visibility, [Validators.required]],
    startsAt: ['', [Validators.required]],
    endsAt: ['', [Validators.required]],
    maxParticipants: [''],
    placeId: [''],
    locationText: [''],
  });

  constructor() {
    effect(() => {
      const editId = this.id() ?? '';
      const invUser = this.inviteUserId() ?? '';
      const qType = this.type() ?? '';
      const qVis = this.visibility() ?? '';
      const qPlace = this.placeId() ?? '';
      const me = this.auth.currentUser()?.id ?? '';
      const key = `${me}|${editId}|${invUser}|${qType}|${qVis}|${qPlace}`;

      if (key === this.initializedKey) {
        return;
      }
      this.initializedKey = key;
      this.formError.set(null);

      if (editId) {
        const ev = this.eventService.getEventById(editId);
        if (ev && ev.isOrganizer) {
          this.currentVisibility.set(ev.visibility);
          this.eventForm.patchValue({
            title: ev.title,
            description: ev.description ?? '',
            type: ev.type,
            visibility: ev.visibility,
            startsAt: toDateTimeLocalString(new Date(ev.startsAt)),
            endsAt: toDateTimeLocalString(new Date(ev.endsAt)),
            maxParticipants: ev.maxParticipants !== null ? String(ev.maxParticipants) : '',
            placeId: ev.placeId ?? '',
            locationText: ev.locationText ?? '',
          });
        }
        return;
      }

      // Create mode defaults
      const initialVis: Visibility =
        qVis === 'PRIVATE' || qVis === 'PUBLIC' ? qVis : invUser ? 'PRIVATE' : 'PUBLIC';
      const initialType: EventType =
        qType === 'PLAYDATE' || qType === 'GROUP_WALK' || qType === 'BREED_MEETUP'
          ? qType
          : initialVis === 'PRIVATE'
            ? 'PLAYDATE'
            : 'GROUP_WALK';

      const firstPlaceId = qPlace || (this.places()[0]?.id ?? '');

      this.currentVisibility.set(initialVis);
      this.eventForm.reset({
        title: initialVis === 'PRIVATE' ? 'Afternoon Playdate' : '',
        description: '',
        type: initialType,
        visibility: initialVis,
        startsAt: offsetDemoLocalDateTime(9, 16, 0),
        endsAt: offsetDemoLocalDateTime(9, 17, 30),
        maxParticipants: initialVis === 'PRIVATE' ? '4' : '8',
        placeId: initialVis === 'PUBLIC' ? firstPlaceId : '',
        locationText: initialVis === 'PRIVATE' ? 'Parcul Central, Centru' : '',
      });

      this.selectedInviteUserIds.set(invUser && invUser !== me ? [invUser] : []);
      const firstMyDog = this.myDogs()[0]?.id;
      this.selectedGoingDogIds.set(firstMyDog ? [firstMyDog] : []);
    });
  }

  onVisibilityChange(): void {
    const vis = this.eventForm.controls.visibility.value;
    this.currentVisibility.set(vis);
    if (vis === 'PUBLIC' && !this.eventForm.controls.placeId.value) {
      this.eventForm.controls.placeId.setValue(this.places()[0]?.id ?? '');
    }
    if (vis === 'PRIVATE' && this.eventForm.controls.type.value !== 'PLAYDATE') {
      this.eventForm.controls.type.setValue('PLAYDATE');
    }
  }

  isUserInvited(userId: string): boolean {
    return this.selectedInviteUserIds().includes(userId);
  }

  toggleInviteUser(userId: string): void {
    this.selectedInviteUserIds.update((list) =>
      list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId],
    );
  }

  isDogSelected(dogId: string): boolean {
    return this.selectedGoingDogIds().includes(dogId);
  }

  toggleMyDog(dogId: string): void {
    this.selectedGoingDogIds.update((list) =>
      list.includes(dogId) ? list.filter((id) => id !== dogId) : [...list, dogId],
    );
  }

  onSubmit(): void {
    this.formError.set(null);
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }

    const raw = this.eventForm.getRawValue();
    const maxPartTrimmed = raw.maxParticipants.trim();
    const maxParticipants = maxPartTrimmed ? Number(maxPartTrimmed) : null;
    if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 1)) {
      this.formError.set('Capacity must be a whole number of at least 1 dog.');
      return;
    }

    const editId = this.id();
    if (editId) {
      const res = this.eventService.updateEvent(editId, {
        title: raw.title,
        description: raw.description.trim() ? raw.description.trim() : null,
        type: raw.type,
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        maxParticipants,
        placeId: this.currentVisibility() === 'PUBLIC' ? raw.placeId || null : null,
        locationText: this.currentVisibility() === 'PRIVATE' ? raw.locationText : null,
      });

      if (res.ok) {
        void this.router.navigate(['/events', editId]);
      } else {
        this.formError.set(res.error ?? 'Could not update event.');
      }
      return;
    }

    const res = this.eventService.createEvent({
      title: raw.title,
      description: raw.description.trim() ? raw.description.trim() : null,
      type: raw.type,
      visibility: raw.visibility,
      startsAt: raw.startsAt,
      endsAt: raw.endsAt,
      maxParticipants,
      placeId: raw.visibility === 'PUBLIC' ? raw.placeId || null : null,
      locationText: raw.visibility === 'PRIVATE' ? raw.locationText : null,
      invitedUserIds: this.selectedInviteUserIds(),
      organizerGoingDogIds: this.selectedGoingDogIds(),
    });

    if (res.ok && res.data) {
      void this.router.navigate(['/events', res.data.id]);
    } else {
      this.formError.set(res.error ?? 'Could not create event.');
    }
  }
}

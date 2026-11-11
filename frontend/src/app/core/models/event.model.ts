import {
  DogRsvpStatus,
  EventStatus,
  EventType,
  InvitationStatus,
  Visibility,
} from './enums';
import { Breed, Dog } from './dog.model';
import { Place } from './place.model';
import { User } from './user.model';

export interface Event {
  id: string;
  organizerId: string | null;
  placeId: string | null;
  locationText: string | null;
  title: string;
  description: string | null;
  type: EventType;
  visibility: Visibility;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  maxParticipants: number | null;
}

/** Invitation addressed to an owner (User). */
export interface EventInvitation {
  id: string;
  eventId: string;
  userId: string;
  invitedByUserId: string;
  status: InvitationStatus;
  createdAt: string;
  respondedAt: string | null;
}

/** RSVP participation associated with a specific dog. */
export interface EventDogRsvp {
  id: string;
  eventId: string;
  userId: string;
  dogId: string;
  status: DogRsvpStatus;
  updatedAt: string;
}

export interface EventParticipantDetail {
  rsvp: EventDogRsvp;
  dog: Dog;
  breed: Breed;
  owner: User;
}

export interface EventInvitationDetail {
  invitation: EventInvitation;
  user: User;
  invitedBy: User | null;
}

export interface EventView extends Event {
  organizer: User | null;
  place: Place | null;
  invitations: EventInvitationDetail[];
  participants: EventParticipantDetail[];
  goingDogsCount: number;
  isFull: boolean;
  isOrganizer: boolean;
  currentUserInvitation: EventInvitation | null;
  currentUserDogRsvps: EventDogRsvp[];
}

export interface CreateEventPayload {
  title: string;
  description: string | null;
  type: EventType;
  visibility: Visibility;
  startsAt: string;
  endsAt: string;
  maxParticipants: number | null;
  placeId: string | null;
  locationText: string | null;
  invitedUserIds: string[];
  organizerGoingDogIds: string[];
}

export interface UpdateEventPayload {
  title?: string;
  description?: string | null;
  type?: EventType;
  startsAt?: string;
  endsAt?: string;
  maxParticipants?: number | null;
  placeId?: string | null;
  locationText?: string | null;
}
